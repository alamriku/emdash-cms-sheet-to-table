import * as React from "react";

import { parseSheetUrl, sheetUrlForTab } from "../lib/sheets.js";
import { Checkbox, Field, PRO_CONTACT_URL, SectionNav, type TableWidth, WidthFields, callRoute, inputClass, writeViewToUrl } from "./shared.js";

/** The spreadsheet ID and tab gid in a pasted link, or null while it isn't a valid link yet. */
function readSheetUrl(url: string): { sheetId: string; gid: string } | null {
	try {
		return url.trim() ? parseSheetUrl(url) : null;
	} catch {
		return null;
	}
}

type PublicTabsState =
	| { status: "idle" }
	| { status: "loading" }
	| { status: "ok"; items: SheetTab[] }
	| { status: "error"; message: string };

interface TableListItem {
	id: string;
	name: string;
	source: "public" | "oauth";
	sheetUrl: string;
	rowsPerPage: number;
	rowCount: number;
	syncedAt: string | null;
	syncError: string | null;
}

interface SnapshotStatus {
	error?: string;
}

interface TableFormState {
	name: string;
	source: "public" | "oauth";
	sheetUrl: string;
	sheetId: string;
	gid: string;
	sheetTitle: string;
	hasHeaderRow: boolean;
	showTitle: boolean;
	description: string;
	theme: "simple" | "simple-dark" | "auto";
	responsiveStyle: "default" | "collapsible" | "scrollable";
	tableWidth: TableWidth;
	maxWidth: number;
	rowsPerPage: number;
	showInfoBlock: boolean;
	allowSorting: boolean;
	showSearch: boolean;
	asyncLoading: boolean;
	mergeCells: boolean;
	linksAsLinks: boolean;
	linksOpenInNewTab: boolean;
	imagesAsImages: boolean;
	cacheDurationDays: number;
	responseTimeoutSeconds: number;
}

interface GoogleStatus {
	configured: boolean;
	connected: boolean;
	email: string | null;
	redirectUri: string;
	siteUrlConfigured: boolean;
}

interface DriveSpreadsheet {
	id: string;
	name: string;
}

interface SheetTab {
	gid: string;
	title: string;
}

const EMPTY_FORM: TableFormState = {
	name: "",
	source: "public",
	sheetUrl: "",
	sheetId: "",
	gid: "",
	sheetTitle: "",
	hasHeaderRow: true,
	showTitle: true,
	description: "",
	theme: "auto",
	responsiveStyle: "default",
	tableWidth: "content",
	maxWidth: 1200,
	rowsPerPage: 10,
	showInfoBlock: true,
	allowSorting: true,
	showSearch: true,
	asyncLoading: false,
	mergeCells: false,
	linksAsLinks: true,
	linksOpenInNewTab: true,
	imagesAsImages: true,
	cacheDurationDays: 1,
	responseTimeoutSeconds: 15,
};

export function TablesPage() {
	const [view, setView] = React.useState<"list" | "form">("list");
	const [editingId, setEditingId] = React.useState<string | null>(null);
	const [items, setItems] = React.useState<TableListItem[]>([]);
	// Max tables allowed (free version). The server enforces it too; this only greys out the buttons.
	const [tableLimit, setTableLimit] = React.useState<number | null>(null);
	const atLimit = tableLimit !== null && items.length >= tableLimit;
	const [loading, setLoading] = React.useState(true);
	const [error, setError] = React.useState<string | null>(null);
	const [form, setForm] = React.useState<TableFormState>(EMPTY_FORM);
	const [saving, setSaving] = React.useState(false);
	const [saveError, setSaveError] = React.useState<string | null>(null);
	const [savedNotice, setSavedNotice] = React.useState(false);
	// The table's last sync error (e.g. a private sheet). The save itself can succeed while the sheet fetch fails.
	const [syncWarning, setSyncWarning] = React.useState<string | null>(null);

	React.useEffect(() => {
		if (!savedNotice) return;
		const timer = window.setTimeout(() => setSavedNotice(false), 3000);
		return () => window.clearTimeout(timer);
	}, [savedNotice]);
	const [createdId, setCreatedId] = React.useState<string | null>(null);
	const [banner, setBanner] = React.useState<{ kind: "success" | "error"; text: string } | null>(null);

	const [google, setGoogle] = React.useState<GoogleStatus | null>(null);
	const [connecting, setConnecting] = React.useState(false);
	const [spreadsheets, setSpreadsheets] = React.useState<DriveSpreadsheet[] | null>(null);
	const [loadingSpreadsheets, setLoadingSpreadsheets] = React.useState(false);
	const [tabs, setTabs] = React.useState<SheetTab[] | null>(null);
	const [loadingTabs, setLoadingTabs] = React.useState(false);

	// Tab picker for public sheets: once the pasted link has a spreadsheet ID, list that sheet's tabs.
	// Keyed on the ID alone, so picking a different tab (which only changes the gid) doesn't refetch.
	const [publicTabs, setPublicTabs] = React.useState<PublicTabsState>({ status: "idle" });
	const publicLink = form.source === "public" ? readSheetUrl(form.sheetUrl) : null;
	const publicSheetId = view === "form" ? (publicLink?.sheetId ?? null) : null;
	React.useEffect(() => {
		if (!publicSheetId) {
			setPublicTabs({ status: "idle" });
			return;
		}
		let cancelled = false;
		setPublicTabs({ status: "loading" });
		// Short pause so typing or pasting a link doesn't fire a request per keystroke.
		const timer = window.setTimeout(() => {
			callRoute<{ items: SheetTab[] }>(`sheets/public-tabs?sheetUrl=${encodeURIComponent(publicSheetId)}`)
				.then((data) => !cancelled && setPublicTabs({ status: "ok", items: data.items }))
				.catch(
					(cause) =>
						!cancelled &&
						setPublicTabs({ status: "error", message: cause instanceof Error ? cause.message : "Could not load the sheet's tabs" }),
				);
		}, 400);
		return () => {
			cancelled = true;
			window.clearTimeout(timer);
		};
	}, [publicSheetId]);

	const loadGoogleStatus = React.useCallback(async () => {
		try {
			const status = await callRoute<GoogleStatus>("oauth/status");
			setGoogle(status);
		} catch {
			setGoogle({ configured: false, connected: false, email: null, redirectUri: "", siteUrlConfigured: false });
		}
	}, []);

	React.useEffect(() => {
		void loadGoogleStatus();

		const params = new URLSearchParams(window.location.search);
		const oauthResult = params.get("oauth");
		if (oauthResult) {
			const message = params.get("message");
			setBanner({
				kind: oauthResult === "success" ? "success" : "error",
				text: oauthResult === "success" ? "Google account connected." : (message ?? "Could not connect Google account."),
			});
			params.delete("oauth");
			params.delete("message");
			const newSearch = params.toString();
			window.history.replaceState(null, "", window.location.pathname + (newSearch ? `?${newSearch}` : ""));
		}
	}, [loadGoogleStatus]);

	const loadList = React.useCallback(async () => {
		setLoading(true);
		setError(null);
		try {
			const data = await callRoute<{ items: TableListItem[]; limit?: number }>("tables/list");
			setItems(data.items);
			setTableLimit(data.limit ?? null);
		} catch (cause) {
			setError(cause instanceof Error ? cause.message : "Could not load tables");
		} finally {
			setLoading(false);
		}
	}, []);

	React.useEffect(() => {
		if (view === "list") void loadList();
	}, [view, loadList]);

	async function handleConnect() {
		setConnecting(true);
		try {
			const result = await callRoute<{ authUrl: string }>("oauth/start", {});
			window.location.href = result.authUrl;
		} catch (cause) {
			setBanner({ kind: "error", text: cause instanceof Error ? cause.message : "Could not start Google connection" });
			setConnecting(false);
		}
	}

	async function handleDisconnect() {
		if (!window.confirm("Disconnect the Google account? Tables reading via Google Sheets will stop syncing.")) return;
		try {
			await callRoute("oauth/disconnect", {});
			await loadGoogleStatus();
			setSpreadsheets(null);
			setTabs(null);
		} catch (cause) {
			setBanner({ kind: "error", text: cause instanceof Error ? cause.message : "Disconnect failed" });
		}
	}

	async function loadSpreadsheets() {
		setLoadingSpreadsheets(true);
		try {
			const data = await callRoute<{ items: DriveSpreadsheet[] }>("sheets/list");
			setSpreadsheets(data.items);
		} catch (cause) {
			setSaveError(cause instanceof Error ? cause.message : "Could not load your Google Sheets");
		} finally {
			setLoadingSpreadsheets(false);
		}
	}

	async function loadTabsFor(spreadsheetId: string) {
		setLoadingTabs(true);
		setTabs(null);
		try {
			const data = await callRoute<{ items: SheetTab[] }>(`sheets/tabs?spreadsheetId=${encodeURIComponent(spreadsheetId)}`);
			setTabs(data.items);
		} catch (cause) {
			setSaveError(cause instanceof Error ? cause.message : "Could not load sheet tabs");
		} finally {
			setLoadingTabs(false);
		}
	}

	function showList() {
		writeViewToUrl({});
		setView("list");
	}

	function startCreate() {
		writeViewToUrl({ new: "1" });
		setSyncWarning(null);
		setForm(EMPTY_FORM);
		setEditingId(null);
		setCreatedId(null);
		setSaveError(null);
		setSpreadsheets(null);
		setTabs(null);
		setView("form");
	}

	async function startEdit(id: string) {
		writeViewToUrl({ edit: id });
		setSaveError(null);
		setCreatedId(null);
		setSpreadsheets(null);
		setTabs(null);
		try {
			const data = await callRoute<{ table?: TableFormState; snapshot?: SnapshotStatus | null }>(
				`tables/get?id=${encodeURIComponent(id)}`,
			);
			if (!data.table) throw new Error("Table not found");
			// Spread over the defaults: tables saved by an older version lack newer fields (e.g. tableWidth).
			setForm({ ...EMPTY_FORM, ...data.table });
			setSyncWarning(data.snapshot?.error ?? null);
			setEditingId(id);
			setView("form");
		} catch (cause) {
			// A stale ?edit= link (e.g. the table was deleted) falls back to the list with the error.
			window.history.replaceState(null, "", window.location.pathname);
			setView("list");
			setError(cause instanceof Error ? cause.message : "Could not load table");
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

	async function handleSubmit(event: React.SyntheticEvent<HTMLFormElement>) {
		event.preventDefault();
		setSaving(true);
		setSaveError(null);
		setSavedNotice(false);
		try {
			if (editingId) {
				const result = await callRoute<{ snapshot?: SnapshotStatus | null }>(`tables/update`, { id: editingId, ...form });
				setSyncWarning(result.snapshot?.error ?? null);
			} else {
				const result = await callRoute<{ id: string; snapshot?: SnapshotStatus | null }>(`tables/create`, form);
				setSyncWarning(result.snapshot?.error ?? null);
				setCreatedId(result.id);
				// Switch to editing the new table, so a second click on Save updates it instead of
				// creating a duplicate. replaceState keeps Back from reopening the empty "new" form.
				setEditingId(result.id);
				window.history.replaceState(null, "", `${window.location.pathname}?edit=${encodeURIComponent(result.id)}`);
			}
			await loadList();
			if (editingId) setSavedNotice(true);
		} catch (cause) {
			setSaveError(cause instanceof Error ? cause.message : "Save failed");
		} finally {
			setSaving(false);
		}
	}

	async function handleSync(id: string) {
		setError(null);
		try {
			await callRoute(`tables/sync`, { id });
			await loadList();
		} catch (cause) {
			setError(cause instanceof Error ? cause.message : "Sync failed");
		}
	}

	async function handleDuplicate(id: string) {
		try {
			await callRoute(`tables/duplicate`, { id });
			await loadList();
		} catch (cause) {
			setError(cause instanceof Error ? cause.message : "Duplicate failed");
		}
	}

	async function handleDelete(id: string, name: string) {
		if (!window.confirm(`Delete "${name}"? This cannot be undone.`)) return;
		try {
			await callRoute(`tables/delete`, { id });
			await loadList();
		} catch (cause) {
			setError(cause instanceof Error ? cause.message : "Delete failed");
		}
	}

	const googleSection = (
		<div className="rounded-lg border p-4 space-y-2">
			<div className="flex flex-wrap items-center justify-between gap-4">
				<div className="min-w-0 flex-1">
					<div className="font-medium text-sm">Google account</div>
					<div className="text-xs text-muted-foreground">
						{!google
							? "Loading…"
							: google.connected
								? `Connected${google.email ? ` as ${google.email}` : ""} — pick sheets directly from Drive, including private ones.`
								: google.configured
									? "Not connected. Connect to embed private sheets via a picker."
									: (
											<>
												Public sheets work without this. To use private sheets, add a Google OAuth Client ID and
												Secret in{" "}
												<a className="underline" href="/_emdash/admin/plugins-manager/sheet-table/settings">
													Sheet Table settings
												</a>
												, then come back here and click Connect.
											</>
										)}
					</div>
				</div>
				{google?.connected ? (
					<button type="button" onClick={() => void handleDisconnect()} className="text-sm text-red-500 hover:underline shrink-0">
						Disconnect
					</button>
				) : (
					<button
						type="button"
						disabled={!google?.configured || !google?.siteUrlConfigured || connecting}
						onClick={() => void handleConnect()}
						className="text-sm px-3 py-1.5 rounded-md bg-primary text-primary-foreground disabled:opacity-50 shrink-0"
					>
						{connecting ? "Redirecting…" : "Connect Google account"}
					</button>
				)}
			</div>
			{google && !google.siteUrlConfigured && (
				<div className="text-xs text-amber-600">
					This site has no canonical URL recorded yet, so Google cannot be given a working
					redirect URI. Complete the EmDash setup wizard on the real domain first (not the
					local dev-bypass shortcut) — it records the site URL once, the first time.
				</div>
			)}
			{google && !google.connected && google.siteUrlConfigured && (
				<div className="text-xs text-muted-foreground">
					Authorized redirect URI for the Google Cloud OAuth client:{" "}
					<code className="font-mono break-all">{google.redirectUri}</code>
				</div>
			)}
		</div>
	);

	if (view === "form") {
		return (
			<section className="space-y-6 max-w-2xl">
				<div className="flex items-center justify-between">
					<h1 className="text-2xl font-semibold">{editingId ? "Edit table" : "New table"}</h1>
					<button type="button" className="text-sm text-muted-foreground hover:underline" onClick={showList}>
						Back to tables
					</button>
				</div>

				{createdId && (
					<div className="rounded border border-green-500/40 bg-green-500/10 p-3 text-sm">
						Table created. To show it on a page, insert the <strong>Sheet Table</strong> block in the
						content editor and pick this table from its list.
					</div>
				)}

				{saveError && <div className="text-sm text-red-500 bg-red-500/10 rounded p-2">{saveError}</div>}

				{syncWarning && (
					<div className="text-sm text-amber-600 bg-amber-500/10 rounded p-2">
						Could not load data from this sheet: {syncWarning}
					</div>
				)}

				<form onSubmit={handleSubmit} className="space-y-4">
					<Field label="Name">
						<input
							required
							className={inputClass}
							value={form.name}
							onChange={(e) => setForm((f) => ({ ...f, name: e.target.value }))}
						/>
					</Field>

					<fieldset className="space-y-3 rounded-md border p-3">
						<legend className="text-sm font-medium px-1">Data source</legend>
						<div className="flex gap-4 text-sm">
							<label className="flex items-center gap-2">
								<input
									type="radio"
									name="source"
									checked={form.source === "public"}
									onChange={() => setForm((f) => ({ ...f, source: "public" }))}
								/>
								Public sheet URL
							</label>
							<label className="flex items-center gap-2">
								<input
									type="radio"
									name="source"
									checked={form.source === "oauth"}
									disabled={!google?.connected}
									onChange={() => {
										setForm((f) => ({ ...f, source: "oauth" }));
										if (!spreadsheets) void loadSpreadsheets();
									}}
								/>
								Pick from connected Google account{!google?.connected && " (connect below first)"}
							</label>
						</div>

						{form.source === "public" ? (
							<>
								<Field label="Google Sheet URL" help='Paste the full share link. The sheet must be shared as "Anyone with the link can view".'>
									<input
										required
										className={inputClass}
										value={form.sheetUrl}
										onChange={(e) => setForm((f) => ({ ...f, sheetUrl: e.target.value }))}
										placeholder="https://docs.google.com/spreadsheets/d/.../edit#gid=0"
									/>
								</Field>

								{publicTabs.status === "loading" && <p className="text-xs text-muted-foreground">Loading the sheet's tabs…</p>}
								{publicTabs.status === "error" && (
									<p className="text-xs text-amber-600">Couldn't list this sheet's tabs: {publicTabs.message}</p>
								)}
								{publicTabs.status === "ok" && publicLink && (
									<Field label="Sheet tab" help="Which tab of the spreadsheet this table shows.">
										<select
											className={inputClass}
											value={publicLink.gid}
											onChange={(e) => setForm((f) => ({ ...f, sheetUrl: sheetUrlForTab(publicLink.sheetId, e.target.value) }))}
										>
											{/* The link's gid may not match any tab (e.g. a link with no #gid, and no tab with gid 0). */}
											{!publicTabs.items.some((tab) => tab.gid === publicLink.gid) && (
												<option value={publicLink.gid}>Choose a tab…</option>
											)}
											{publicTabs.items.map((tab) => (
												<option key={tab.gid} value={tab.gid}>
													{tab.title}
												</option>
											))}
										</select>
									</Field>
								)}
							</>
						) : (
							<div className="grid grid-cols-2 gap-4">
								<Field label="Spreadsheet">
									{loadingSpreadsheets ? (
										<p className="text-xs text-muted-foreground">Loading…</p>
									) : (
										<select
											required
											className={inputClass}
											value={form.sheetId}
											onChange={(e) => {
												const spreadsheetId = e.target.value;
												setForm((f) => ({ ...f, sheetId: spreadsheetId, gid: "", sheetTitle: "" }));
												if (spreadsheetId) void loadTabsFor(spreadsheetId);
											}}
										>
											<option value="">Select a spreadsheet…</option>
											{spreadsheets?.map((sheet) => (
												<option key={sheet.id} value={sheet.id}>
													{sheet.name}
												</option>
											))}
										</select>
									)}
								</Field>
								<Field label="Tab">
									{loadingTabs ? (
										<p className="text-xs text-muted-foreground">Loading…</p>
									) : (
										<select
											required
											className={inputClass}
											disabled={!form.sheetId}
											value={form.gid}
											onChange={(e) => {
												const tab = tabs?.find((t) => t.gid === e.target.value);
												setForm((f) => ({ ...f, gid: e.target.value, sheetTitle: tab?.title ?? "" }));
											}}
										>
											<option value="">Select a tab…</option>
											{tabs?.map((tab) => (
												<option key={tab.gid} value={tab.gid}>
													{tab.title}
												</option>
											))}
										</select>
									)}
								</Field>
							</div>
						)}
					</fieldset>

					<Checkbox label="First row is the header row" checked={form.hasHeaderRow} onChange={(v) => setForm((f) => ({ ...f, hasHeaderRow: v }))} />

					<div className="grid grid-cols-2 gap-4">
						<Field label="Theme">
							<select className={inputClass} value={form.theme} onChange={(e) => setForm((f) => ({ ...f, theme: e.target.value as TableFormState["theme"] }))}>
								<option value="auto">Auto (match visitor's preference)</option>
								<option value="simple">Simple (light)</option>
								<option value="simple-dark">Simple (dark)</option>
							</select>
						</Field>
						<Field label="Responsive style">
							<select
								className={inputClass}
								value={form.responsiveStyle}
								onChange={(e) => setForm((f) => ({ ...f, responsiveStyle: e.target.value as TableFormState["responsiveStyle"] }))}
							>
								<option value="default">Default</option>
								<option value="collapsible">Collapsible</option>
								<option value="scrollable">Scrollable</option>
							</select>
						</Field>
					</div>

					<WidthFields
						tableWidth={form.tableWidth}
						maxWidth={form.maxWidth}
						onChange={(changes) => setForm((f) => ({ ...f, ...changes }))}
					/>

					<Checkbox label="Show table title" checked={form.showTitle} onChange={(v) => setForm((f) => ({ ...f, showTitle: v }))} />

					<Field label="Description (optional)">
						<textarea
							className={inputClass}
							rows={2}
							value={form.description}
							onChange={(e) => setForm((f) => ({ ...f, description: e.target.value }))}
						/>
					</Field>

					<div className="grid grid-cols-2 gap-4">
						<Checkbox label="Allow sorting" checked={form.allowSorting} onChange={(v) => setForm((f) => ({ ...f, allowSorting: v }))} />
						<Checkbox label="Show search bar" checked={form.showSearch} onChange={(v) => setForm((f) => ({ ...f, showSearch: v }))} />
						<Checkbox label="Show info block" checked={form.showInfoBlock} onChange={(v) => setForm((f) => ({ ...f, showInfoBlock: v }))} />
						<Checkbox label="Load asynchronously" checked={form.asyncLoading} onChange={(v) => setForm((f) => ({ ...f, asyncLoading: v }))} />
						<Checkbox label="Show URLs as links" checked={form.linksAsLinks} onChange={(v) => setForm((f) => ({ ...f, linksAsLinks: v }))} />
						<Checkbox label="Open links in new tab" checked={form.linksOpenInNewTab} onChange={(v) => setForm((f) => ({ ...f, linksOpenInNewTab: v }))} />
						<Checkbox label="Show image URLs as images" checked={form.imagesAsImages} onChange={(v) => setForm((f) => ({ ...f, imagesAsImages: v }))} />
					</div>

					<div className="grid grid-cols-3 gap-4">
						<Field label="Rows per page">
							<input
								type="number"
								min={1}
								max={500}
								className={inputClass}
								value={form.rowsPerPage}
								onChange={(e) => setForm((f) => ({ ...f, rowsPerPage: Number(e.target.value) }))}
							/>
						</Field>
						<Field label="Cache duration (days)">
							<input
								type="number"
								min={0}
								max={365}
								className={inputClass}
								value={form.cacheDurationDays}
								onChange={(e) => setForm((f) => ({ ...f, cacheDurationDays: Number(e.target.value) }))}
							/>
						</Field>
						<Field label="Response timeout (s)">
							<input
								type="number"
								min={1}
								max={120}
								className={inputClass}
								value={form.responseTimeoutSeconds}
								onChange={(e) => setForm((f) => ({ ...f, responseTimeoutSeconds: Number(e.target.value) }))}
							/>
						</Field>
					</div>

					<div className="flex items-center gap-3">
						<button type="submit" disabled={saving} className="inline-flex items-center gap-2 px-4 py-2 bg-primary text-primary-foreground rounded-md disabled:opacity-50">
							{saving ? "Saving…" : editingId ? "Save changes" : "Create table"}
						</button>
						<button type="button" className="text-sm text-muted-foreground hover:underline" onClick={showList}>
							Cancel
						</button>
						{/* Repeated here because the top-of-form copy is scrolled out of view on long forms. */}
						{saveError && <span className="text-sm text-red-500">{saveError}</span>}
						{savedNotice && (
							<span className={`text-sm ${syncWarning ? "text-amber-600" : "text-green-600"}`}>
								{syncWarning ? "Settings saved, but the sheet could not be loaded — see the message above." : "Changes saved."}
							</span>
						)}
					</div>
				</form>
			</section>
		);
	}

	return (
		<section className="space-y-4">
			<div className="flex items-center justify-between">
				<h1 className="text-2xl font-semibold">Sheet Table</h1>
				<button
					type="button"
					onClick={startCreate}
					disabled={atLimit}
					title={atLimit ? `The free version allows up to ${tableLimit} tables` : undefined}
					className="inline-flex items-center gap-2 px-4 py-2 bg-primary text-primary-foreground rounded-md disabled:opacity-50"
				>
					New table
				</button>
			</div>

			<SectionNav current="tables" />

			{tableLimit !== null && !loading && (
				<p className={`text-sm ${atLimit ? "text-amber-600" : "text-muted-foreground"}`}>
					{items.length} of {tableLimit} tables used.
					{atLimit && (
						<>
							{" "}You've reached the free version's limit. Delete a table you no longer need, or{" "}
							<a className="underline" href={PRO_CONTACT_URL} target="_blank" rel="noopener noreferrer">
								ask about Sheet Table Pro
							</a>{" "}
							for unlimited tables.
						</>
					)}
				</p>
			)}

			{banner && (
				<div className={`text-sm rounded p-2 ${banner.kind === "success" ? "bg-green-500/10 text-green-600" : "bg-red-500/10 text-red-500"}`}>
					{banner.text}
				</div>
			)}

			{googleSection}

			{error && <div className="text-sm text-red-500 bg-red-500/10 rounded p-2">{error}</div>}

			{loading ? (
				<p className="text-sm text-muted-foreground">Loading…</p>
			) : items.length === 0 ? (
				<p className="text-sm text-muted-foreground">No tables yet. Create one to connect a Google Sheet.</p>
			) : (
				<div className="border rounded-lg divide-y">
					{items.map((item) => (
						<div key={item.id} className="p-4 flex items-center justify-between gap-4">
							<div className="min-w-0">
								<div className="font-medium">
									{item.name} <span className="text-xs font-normal text-muted-foreground">({item.source === "oauth" ? "connected account" : "public URL"})</span>
								</div>
								<div className="text-xs text-muted-foreground truncate">{item.sheetUrl}</div>
								<div className="text-xs text-muted-foreground mt-1">
									Table ID: <code className="font-mono">{item.id}</code> · {item.rowCount} rows
									{item.syncedAt ? ` · synced ${new Date(item.syncedAt).toLocaleString()}` : " · not synced yet"}
									{item.syncError ? ` · last sync error: ${item.syncError}` : ""}
								</div>
							</div>
							<div className="flex items-center gap-2 shrink-0 text-sm">
								<button type="button" className="hover:underline" onClick={() => void startEdit(item.id)}>
									Edit
								</button>
								<button type="button" className="hover:underline" onClick={() => void handleSync(item.id)}>
									Sync now
								</button>
								<button type="button" className="hover:underline disabled:opacity-40 disabled:no-underline" disabled={atLimit} onClick={() => void handleDuplicate(item.id)}>
									Duplicate
								</button>
								<button type="button" className="text-red-500 hover:underline" onClick={() => void handleDelete(item.id, item.name)}>
									Delete
								</button>
							</div>
						</div>
					))}
				</div>
			)}
		</section>
	);
}
