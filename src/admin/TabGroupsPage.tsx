import * as React from "react";

import { Checkbox, Field, SectionNav, callRoute, inputClass, writeViewToUrl } from "./shared.js";

const TABLES_PAGE = "/_emdash/admin/plugins/sheet-table/tables";

interface TableOption {
	id: string;
	name: string;
}

interface TabGroupListItem {
	id: string;
	name: string;
	tabs: { name: string; tableId: string; tableName: string | null }[];
}

/** A tab row in the form. `key` is client-only, so React keeps each row's inputs stable while reordering. */
interface TabRow {
	key: number;
	name: string;
	tableId: string;
}

interface TabGroupForm {
	name: string;
	showName: boolean;
	tabPosition: "before" | "after";
	tabs: TabRow[];
}

interface StoredTabGroup {
	name: string;
	showName: boolean;
	tabPosition: "before" | "after";
	tabs: { name: string; tableId: string }[];
}

let nextRowKey = 1;
const newRow = (name = "", tableId = ""): TabRow => ({ key: nextRowKey++, name, tableId });

const emptyForm = (): TabGroupForm => ({
	name: "",
	showName: true,
	tabPosition: "before",
	tabs: [newRow(), newRow()],
});

export function TabGroupsPage() {
	const [view, setView] = React.useState<"list" | "form">("list");
	const [editingId, setEditingId] = React.useState<string | null>(null);
	const [items, setItems] = React.useState<TabGroupListItem[]>([]);
	const [tables, setTables] = React.useState<TableOption[] | null>(null);
	const [loading, setLoading] = React.useState(true);
	const [error, setError] = React.useState<string | null>(null);
	const [form, setForm] = React.useState<TabGroupForm>(emptyForm);
	const [saving, setSaving] = React.useState(false);
	const [saveError, setSaveError] = React.useState<string | null>(null);
	const [savedNotice, setSavedNotice] = React.useState(false);
	const [createdId, setCreatedId] = React.useState<string | null>(null);

	React.useEffect(() => {
		if (!savedNotice) return;
		const timer = window.setTimeout(() => setSavedNotice(false), 3000);
		return () => window.clearTimeout(timer);
	}, [savedNotice]);

	const loadList = React.useCallback(async () => {
		setLoading(true);
		setError(null);
		try {
			const data = await callRoute<{ items: TabGroupListItem[] }>("tab-groups/list");
			setItems(data.items);
		} catch (cause) {
			setError(cause instanceof Error ? cause.message : "Could not load tab groups");
		} finally {
			setLoading(false);
		}
	}, []);

	// The table picker in the form needs every table's id and name.
	React.useEffect(() => {
		callRoute<{ items: TableOption[] }>("tables/list")
			.then((data) => setTables(data.items.map(({ id, name }) => ({ id, name }))))
			.catch(() => setTables([]));
	}, []);

	React.useEffect(() => {
		if (view === "list") void loadList();
	}, [view, loadList]);

	function showList() {
		writeViewToUrl({});
		setView("list");
	}

	function startCreate() {
		writeViewToUrl({ new: "1" });
		setForm(emptyForm());
		setEditingId(null);
		setCreatedId(null);
		setSaveError(null);
		setView("form");
	}

	async function startEdit(id: string) {
		writeViewToUrl({ edit: id });
		setSaveError(null);
		setCreatedId(null);
		try {
			const data = await callRoute<{ group?: StoredTabGroup }>(`tab-groups/get?id=${encodeURIComponent(id)}`);
			if (!data.group) throw new Error("Tab group not found");
			const { name, showName, tabPosition, tabs } = data.group;
			setForm({ name, showName, tabPosition, tabs: tabs.map((tab) => newRow(tab.name, tab.tableId)) });
			setEditingId(id);
			setView("form");
		} catch (cause) {
			window.history.replaceState(null, "", window.location.pathname);
			setView("list");
			setError(cause instanceof Error ? cause.message : "Could not load tab group");
		}
	}

	// Open whatever the URL points at on first load, and follow the browser's Back/Forward buttons.
	React.useEffect(() => {
		function applyUrl() {
			const params = new URLSearchParams(window.location.search);
			const editId = params.get("edit");
			if (editId) void startEdit(editId);
			else if (params.get("new")) startCreate();
			else setView("list");
		}
		applyUrl();
		window.addEventListener("popstate", applyUrl);
		return () => window.removeEventListener("popstate", applyUrl);
		// eslint-disable-next-line react-hooks/exhaustive-deps -- run once; the handlers only use state setters.
	}, []);

	function updateRow(key: number, changes: Partial<TabRow>) {
		setForm((f) => ({ ...f, tabs: f.tabs.map((row) => (row.key === key ? { ...row, ...changes } : row)) }));
	}

	function moveRow(index: number, direction: -1 | 1) {
		setForm((f) => {
			const target = index + direction;
			if (target < 0 || target >= f.tabs.length) return f;
			const tabs = [...f.tabs];
			[tabs[index], tabs[target]] = [tabs[target]!, tabs[index]!];
			return { ...f, tabs };
		});
	}

	function removeRow(key: number) {
		setForm((f) => ({ ...f, tabs: f.tabs.filter((row) => row.key !== key) }));
	}

	// Picking a table for a tab with no name yet fills the name in from the table, saving a step.
	function pickTable(row: TabRow, tableId: string) {
		const table = tables?.find((t) => t.id === tableId);
		updateRow(row.key, { tableId, name: row.name.trim() ? row.name : (table?.name ?? "") });
	}

	async function handleSubmit(event: React.SyntheticEvent<HTMLFormElement>) {
		event.preventDefault();
		setSaving(true);
		setSaveError(null);
		setSavedNotice(false);
		const body = {
			name: form.name,
			showName: form.showName,
			tabPosition: form.tabPosition,
			tabs: form.tabs.map(({ name, tableId }) => ({ name, tableId })),
		};
		try {
			if (editingId) {
				await callRoute(`tab-groups/update`, { id: editingId, ...body });
				setSavedNotice(true);
			} else {
				const result = await callRoute<{ id: string }>(`tab-groups/create`, body);
				// Switch to editing the new group, so a second Save updates it instead of making a copy.
				setCreatedId(result.id);
				setEditingId(result.id);
				window.history.replaceState(null, "", `${window.location.pathname}?edit=${encodeURIComponent(result.id)}`);
			}
		} catch (cause) {
			setSaveError(cause instanceof Error ? cause.message : "Save failed");
		} finally {
			setSaving(false);
		}
	}

	async function handleDelete(id: string, name: string) {
		if (!window.confirm(`Delete the tab group "${name}"? The tables inside it are not deleted.`)) return;
		try {
			await callRoute(`tab-groups/delete`, { id });
			await loadList();
		} catch (cause) {
			setError(cause instanceof Error ? cause.message : "Delete failed");
		}
	}

	if (view === "form") {
		const noTables = tables !== null && tables.length === 0;
		return (
			<section className="space-y-6 max-w-2xl">
				<div className="flex items-center justify-between">
					<h1 className="text-2xl font-semibold">{editingId ? "Edit tab group" : "New tab group"}</h1>
					<button type="button" className="text-sm text-muted-foreground hover:underline" onClick={showList}>
						Back to tab groups
					</button>
				</div>

				{createdId && (
					<div className="rounded border border-green-500/40 bg-green-500/10 p-3 text-sm">
						Tab group created. To show it on a page, insert the <strong>Sheet Table Tabs</strong> block in the
						content editor and pick this group from its list.
					</div>
				)}

				{saveError && <div className="text-sm text-red-500 bg-red-500/10 rounded p-2">{saveError}</div>}

				{noTables && (
					<div className="text-sm text-amber-600 bg-amber-500/10 rounded p-2">
						You don't have any tables yet. <a className="underline" href={`${TABLES_PAGE}?new=1`}>Create a table</a> first,
						then come back to put it in a tab.
					</div>
				)}

				<form onSubmit={handleSubmit} className="space-y-4">
					<Field label="Tab group title">
						<input
							required
							className={inputClass}
							value={form.name}
							onChange={(e) => setForm((f) => ({ ...f, name: e.target.value }))}
						/>
					</Field>

					<Checkbox
						label="Show the title above the tabs"
						checked={form.showName}
						onChange={(v) => setForm((f) => ({ ...f, showName: v }))}
					/>

					<fieldset className="space-y-2">
						<legend className="text-sm font-medium">Tab position</legend>
						<div className="flex flex-wrap gap-4 text-sm">
							<label className="flex items-center gap-2">
								<input
									type="radio"
									name="tabPosition"
									checked={form.tabPosition === "before"}
									onChange={() => setForm((f) => ({ ...f, tabPosition: "before" }))}
								/>
								Above the table
							</label>
							<label className="flex items-center gap-2">
								<input
									type="radio"
									name="tabPosition"
									checked={form.tabPosition === "after"}
									onChange={() => setForm((f) => ({ ...f, tabPosition: "after" }))}
								/>
								Below the table
							</label>
						</div>
					</fieldset>

					<fieldset className="rounded-lg border p-4 space-y-3">
						<legend className="text-sm font-medium px-1">Tabs</legend>
						{form.tabs.length === 0 && <p className="text-sm text-muted-foreground">No tabs yet. Add one below.</p>}
						{form.tabs.map((row, index) => (
							<div key={row.key} className="flex flex-wrap items-end gap-2">
								<span className="text-xs text-muted-foreground w-5 pb-2.5">{index + 1}.</span>
								<label className="flex-1 min-w-40 space-y-1">
									<span className="text-xs text-muted-foreground">Tab name</span>
									<input
										required
										className={inputClass}
										value={row.name}
										placeholder="e.g. 2025 results"
										onChange={(e) => updateRow(row.key, { name: e.target.value })}
									/>
								</label>
								<label className="flex-1 min-w-40 space-y-1">
									<span className="text-xs text-muted-foreground">Table</span>
									<select required className={inputClass} value={row.tableId} onChange={(e) => pickTable(row, e.target.value)}>
										<option value="">{tables === null ? "Loading tables…" : "Choose a table"}</option>
										{tables?.map((table) => (
											<option key={table.id} value={table.id}>
												{table.name}
											</option>
										))}
										{row.tableId && tables !== null && !tables.some((t) => t.id === row.tableId) && (
											<option value={row.tableId}>(deleted table — pick another)</option>
										)}
									</select>
								</label>
								<div className="flex items-center gap-1 pb-1 text-sm">
									<button type="button" className="px-2 py-1 rounded border hover:bg-muted disabled:opacity-30" disabled={index === 0} onClick={() => moveRow(index, -1)} aria-label={`Move tab ${index + 1} up`}>
										↑
									</button>
									<button
										type="button"
										className="px-2 py-1 rounded border hover:bg-muted disabled:opacity-30"
										disabled={index === form.tabs.length - 1}
										onClick={() => moveRow(index, 1)}
										aria-label={`Move tab ${index + 1} down`}
									>
										↓
									</button>
									<button type="button" className="px-2 py-1 rounded text-red-500 hover:bg-red-500/10" onClick={() => removeRow(row.key)} aria-label={`Remove tab ${index + 1}`}>
										Remove
									</button>
								</div>
							</div>
						))}
						<button type="button" className="text-sm hover:underline" onClick={() => setForm((f) => ({ ...f, tabs: [...f.tabs, newRow()] }))}>
							+ Add tab
						</button>
					</fieldset>

					<div className="flex items-center gap-3">
						<button type="submit" disabled={saving} className="inline-flex items-center gap-2 px-4 py-2 bg-primary text-primary-foreground rounded-md disabled:opacity-50">
							{saving ? "Saving…" : editingId ? "Save changes" : "Create tab group"}
						</button>
						<button type="button" className="text-sm text-muted-foreground hover:underline" onClick={showList}>
							Cancel
						</button>
						{saveError && <span className="text-sm text-red-500">{saveError}</span>}
						{savedNotice && <span className="text-sm text-green-600">Changes saved.</span>}
					</div>
				</form>
			</section>
		);
	}

	return (
		<section className="space-y-4">
			<div className="flex items-center justify-between">
				<h1 className="text-2xl font-semibold">Sheet Table</h1>
				<button type="button" onClick={startCreate} className="inline-flex items-center gap-2 px-4 py-2 bg-primary text-primary-foreground rounded-md">
					New tab group
				</button>
			</div>

			<SectionNav current="tab-groups" />

			<p className="text-sm text-muted-foreground">
				A tab group shows several tables in one place. Visitors switch between them with tabs, like the sheet
				tabs in Google Sheets.
			</p>

			{error && <div className="text-sm text-red-500 bg-red-500/10 rounded p-2">{error}</div>}

			{loading ? (
				<p className="text-sm text-muted-foreground">Loading…</p>
			) : items.length === 0 ? (
				<p className="text-sm text-muted-foreground">No tab groups yet. Create one to put several tables behind tabs.</p>
			) : (
				<div className="border rounded-lg divide-y">
					{items.map((item) => {
						const missing = item.tabs.filter((tab) => tab.tableName === null).length;
						return (
							<div key={item.id} className="p-4 flex items-center justify-between gap-4">
								<div className="min-w-0">
									<div className="font-medium">
										{item.name}{" "}
										<span className="text-xs font-normal text-muted-foreground">
											({item.tabs.length} {item.tabs.length === 1 ? "tab" : "tabs"})
										</span>
									</div>
									<div className="text-xs text-muted-foreground truncate">{item.tabs.map((tab) => tab.name).join(" · ")}</div>
									<div className="text-xs text-muted-foreground mt-1">
										Tab Group ID: <code className="font-mono">{item.id}</code>
									</div>
									{missing > 0 && (
										<div className="text-xs text-amber-600 mt-1">
											{missing} {missing === 1 ? "tab points" : "tabs point"} to a deleted table and {missing === 1 ? "is" : "are"} hidden
											from visitors. Edit the group to fix {missing === 1 ? "it" : "them"}.
										</div>
									)}
								</div>
								<div className="flex items-center gap-2 shrink-0 text-sm">
									<button type="button" className="hover:underline" onClick={() => void startEdit(item.id)}>
										Edit
									</button>
									<button type="button" className="text-red-500 hover:underline" onClick={() => void handleDelete(item.id, item.name)}>
										Delete
									</button>
								</div>
							</div>
						);
					})}
				</div>
			)}
		</section>
	);
}
