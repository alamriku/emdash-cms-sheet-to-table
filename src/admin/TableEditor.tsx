import * as React from "react";

import { toRenderPayload } from "../lib/payload.js";
import { EXPORT_LABELS } from "../lib/render.js";
import { parseSheetUrl, sheetUrlForTab } from "../lib/sheets.js";
import {
	DEFAULT_TABLE,
	EXPORT_FORMATS,
	type ExportFormat,
	type PaginationStyle,
	type TableRecord,
	type TableSnapshot,
} from "../lib/types.js";
import { TablePreview } from "./TablePreview.js";
import { type CustomTheme, ThemeStep, customThemeMap } from "./ThemeStep.js";
import { WIDTH_HELP, callRoute } from "./shared.js";
import { Alert, Badge, Button, Card, CopyButton, Field, Icon, Segmented, type StepDefinition, Stepper, Switch } from "./ui.js";

export type TableForm = Omit<TableRecord, "createdAt" | "updatedAt">;

export const EMPTY_FORM: TableForm = { ...DEFAULT_TABLE, name: "", gid: "" };

export interface GoogleStatus {
	configured: boolean;
	connected: boolean;
	email: string | null;
	redirectUri: string;
	siteUrlConfigured: boolean;
}

interface SheetTab {
	gid: string;
	title: string;
}

interface DriveSpreadsheet {
	id: string;
	name: string;
}

const STEPS: StepDefinition[] = [
	{ key: "source", label: "Data source", icon: "link" },
	{ key: "theme", label: "Table theme", icon: "palette" },
	{ key: "customize", label: "Customization", icon: "sliders" },
	{ key: "hide", label: "Hide rows & columns", icon: "eyeSlash" },
	{ key: "advanced", label: "Advanced", icon: "code" },
];

const STEP_HEADINGS = [
	"Connect your Google Sheet",
	"Choose how your table looks",
	"Choose what visitors can do",
	"Hide what visitors shouldn't see",
	"Custom CSS, loading and syncing",
];

type Changes = Partial<TableForm>;

/** The spreadsheet ID and tab gid in a pasted link, or null while it isn't a valid link yet. */
function readSheetUrl(url: string): { sheetId: string; gid: string } | null {
	try {
		return url.trim() ? parseSheetUrl(url) : null;
	} catch {
		return null;
	}
}

function stepFromUrl(): number {
	const key = new URLSearchParams(window.location.search).get("step");
	return Math.max(0, STEPS.findIndex((step) => step.key === key));
}

function writeStepToUrl(index: number) {
	const params = new URLSearchParams(window.location.search);
	if (index > 0) params.set("step", STEPS[index]?.key ?? "");
	else params.delete("step");
	window.history.replaceState(null, "", `${window.location.pathname}?${params.toString()}`);
}

/**
 * The table setup wizard: data source → theme → customization → hiding → advanced, with a live
 * preview underneath. A new table is created when the visitor leaves the first step (the later steps
 * need the sheet's data); after that, "Save changes" saves everything at once.
 */
export function TableEditor({
	editingId,
	google,
	onBack,
	onListChanged,
	onLoadError,
}: {
	editingId: string | null;
	google: GoogleStatus | null;
	onBack: () => void;
	onListChanged: () => void;
	onLoadError: (message: string) => void;
}) {
	const [tableId, setTableId] = React.useState<string | null>(editingId);
	const [form, setForm] = React.useState<TableForm>(EMPTY_FORM);
	const [savedJson, setSavedJson] = React.useState(JSON.stringify(EMPTY_FORM));
	const [snapshot, setSnapshot] = React.useState<TableSnapshot | null>(null);
	const [loading, setLoading] = React.useState(Boolean(editingId));
	const [step, setStepState] = React.useState(() => (editingId ? stepFromUrl() : 0));
	const [saving, setSaving] = React.useState(false);
	const [syncing, setSyncing] = React.useState(false);
	const [notice, setNotice] = React.useState<{ kind: "success" | "error" | "info"; text: React.ReactNode } | null>(null);
	const [customThemes, setCustomThemes] = React.useState<CustomTheme[]>([]);

	const dirty = JSON.stringify(form) !== savedJson;
	const change = React.useCallback((changes: Changes) => setForm((f) => ({ ...f, ...changes })), []);

	function setStep(index: number) {
		setStepState(index);
		if (tableId) writeStepToUrl(index);
		window.scrollTo({ top: 0, behavior: "smooth" });
	}

	const loadThemes = React.useCallback(async () => {
		try {
			const data = await callRoute<{ items: CustomTheme[] }>("themes/list");
			setCustomThemes(data.items);
		} catch {
			// The built-in themes still work without the list.
		}
	}, []);

	React.useEffect(() => {
		void loadThemes();
	}, [loadThemes]);

	React.useEffect(() => {
		if (!editingId) return;
		let cancelled = false;
		callRoute<{ table?: TableForm; snapshot?: TableSnapshot | null }>(`tables/get?id=${encodeURIComponent(editingId)}`)
			.then((data) => {
				if (cancelled) return;
				if (!data.table) throw new Error("Table not found");
				// Spread over the defaults: tables saved by an older version lack newer fields.
				const loaded = { ...EMPTY_FORM, ...data.table };
				setForm(loaded);
				setSavedJson(JSON.stringify(loaded));
				setSnapshot(data.snapshot ?? null);
				setLoading(false);
			})
			.catch((cause) => !cancelled && onLoadError(cause instanceof Error ? cause.message : "Could not load table"));
		return () => {
			cancelled = true;
		};
	}, [editingId, onLoadError]);

	// Warn before leaving with unsaved edits.
	React.useEffect(() => {
		if (!dirty) return;
		const onUnload = (event: BeforeUnloadEvent) => event.preventDefault();
		window.addEventListener("beforeunload", onUnload);
		return () => window.removeEventListener("beforeunload", onUnload);
	}, [dirty]);

	function sourceProblem(): string | null {
		if (!form.name.trim()) return "Give the table a name.";
		if (form.source === "public" && !readSheetUrl(form.sheetUrl)) return "Paste a Google Sheets link.";
		if (form.source === "oauth" && (!form.sheetId || !form.sheetTitle)) return "Pick a spreadsheet and a tab.";
		return null;
	}

	async function save(goTo?: number) {
		const problem = sourceProblem();
		if (problem) {
			setStep(0);
			setNotice({ kind: "error", text: problem });
			return;
		}
		setSaving(true);
		setNotice(null);
		try {
			const result = await callRoute<{ id?: string; table: TableForm; snapshot: TableSnapshot | null }>(
				tableId ? "tables/update" : "tables/create",
				tableId ? { id: tableId, ...form } : form,
			);
			const next = { ...EMPTY_FORM, ...result.table };
			setForm(next);
			setSavedJson(JSON.stringify(next));
			setSnapshot(result.snapshot);
			if (!tableId && result.id) {
				setTableId(result.id);
				const step = goTo ? `&step=${STEPS[goTo]?.key}` : "";
				window.history.replaceState(null, "", `${window.location.pathname}?edit=${encodeURIComponent(result.id)}${step}`);
				setNotice({
					kind: "success",
					text: (
						<>
							Table created and synced. Keep going to style it, or insert the <strong>Sheet Table</strong> block in any post and pick
							"{next.name}".
						</>
					),
				});
			} else if (result.snapshot?.error) {
				setNotice({ kind: "error", text: `Saved, but the sheet could not be loaded: ${result.snapshot.error}` });
			} else {
				setNotice({ kind: "success", text: "Changes saved." });
			}
			onListChanged();
			if (goTo !== undefined) {
				setStepState(goTo);
				window.scrollTo({ top: 0, behavior: "smooth" });
			}
		} catch (cause) {
			setNotice({ kind: "error", text: cause instanceof Error ? cause.message : "Save failed" });
		} finally {
			setSaving(false);
		}
	}

	async function syncNow() {
		if (!tableId) return;
		setSyncing(true);
		try {
			const result = await callRoute<{ snapshot: TableSnapshot }>("tables/sync", { id: tableId });
			setSnapshot(result.snapshot);
			setNotice(
				result.snapshot.error
					? { kind: "error", text: `Sync failed: ${result.snapshot.error}` }
					: { kind: "success", text: `Synced ${result.snapshot.rows.length} rows from Google Sheets.` },
			);
			onListChanged();
		} catch (cause) {
			setNotice({ kind: "error", text: cause instanceof Error ? cause.message : "Sync failed" });
		} finally {
			setSyncing(false);
		}
	}

	React.useEffect(() => {
		if (notice?.kind !== "success") return;
		const timer = window.setTimeout(() => setNotice(null), 5000);
		return () => window.clearTimeout(timer);
	}, [notice]);

	// Typing in a field shouldn't wait for the preview to redraw.
	const previewForm = React.useDeferredValue(form);
	const payload = React.useMemo(
		() => (tableId && snapshot ? toRenderPayload(tableId, previewForm, snapshot, customThemeMap(customThemes)) : null),
		[tableId, previewForm, snapshot, customThemes],
	);

	const columns = React.useMemo(() => columnNames(snapshot, form.hasHeaderRow), [snapshot, form.hasHeaderRow]);

	if (loading) {
		return <p className="st-small st-muted">Loading table…</p>;
	}

	const isLast = step === STEPS.length - 1;
	const creating = !tableId;

	return (
		<div className="st-stack-lg" style={{ maxWidth: "76rem" }}>
			<div className="st-between">
				<div className="st-row" style={{ gap: "0.75rem" }}>
					<Button variant="ghost" size="sm" icon="arrowLeft" onClick={onBack}>
						Tables
					</Button>
					<h1 className="st-h1">{creating ? "New table" : form.name || "Edit table"}</h1>
					{dirty && !creating && <Badge kind="warning">Unsaved changes</Badge>}
				</div>
				{tableId && (
					<div className="st-row">
						{snapshot && (
							<span className="st-xs st-muted">
								{snapshot.rows.length.toLocaleString()} rows · synced {new Date(snapshot.syncedAt).toLocaleString()}
							</span>
						)}
						<Button size="sm" variant="secondary" icon="refresh" loading={syncing} onClick={() => void syncNow()}>
							Sync now
						</Button>
					</div>
				)}
			</div>

			<Card bodyClassName="st-stack">
				<Stepper steps={STEPS} current={step} enabled={!creating} onSelect={setStep} />
			</Card>

			<div className="st-sticky-bar">
				<div className="st-between">
					<div>
						<h2 className="st-h2">{STEP_HEADINGS[step]}</h2>
						<p className="st-xs st-muted" style={{ margin: "0.125rem 0 0" }}>
							Step {step + 1} of {STEPS.length}
						</p>
					</div>
					<div className="st-row">
						{tableId && (
							<span className="st-row st-code" style={{ gap: "0.25rem", padding: "0.125rem 0.125rem 0.125rem 0.5rem" }} title="Table ID">
								{tableId}
								<CopyButton text={tableId} label="Copy table ID" />
							</span>
						)}
						<Button variant="secondary" icon="arrowLeft" disabled={step === 0} onClick={() => setStep(step - 1)}>
							Back
						</Button>
						{creating ? (
							<Button variant="primary" iconRight="arrowRight" loading={saving} onClick={() => void save(1)}>
								Create table &amp; continue
							</Button>
						) : (
							<>
								{!isLast && (
									<Button variant="secondary" iconRight="arrowRight" onClick={() => setStep(step + 1)}>
										Next
									</Button>
								)}
								<Button variant="primary" icon="check" loading={saving} disabled={!dirty && !saving} onClick={() => void save()}>
									Save changes
								</Button>
							</>
						)}
					</div>
				</div>
			</div>

			{notice && <Alert kind={notice.kind}>{notice.text}</Alert>}
			{snapshot?.error && notice?.kind !== "error" && <Alert kind="warning">Could not load data from this sheet: {snapshot.error}</Alert>}

			{step === 0 && <SourceStep form={form} change={change} google={google} creating={creating} />}
			{step === 1 && (
				<ThemeStep
					theme={form.theme}
					themeColors={form.themeColors}
					importStyles={form.importStyles}
					mergeCells={form.mergeCells}
					customThemes={customThemes}
					formatError={snapshot?.formatError ?? null}
					onChange={change}
					onThemesChanged={loadThemes}
				/>
			)}
			{step === 2 && <CustomizeStep form={form} change={change} columns={columns} />}
			{step === 3 && <HideStep form={form} change={change} columns={columns} snapshot={snapshot} />}
			{step === 4 && <AdvancedStep form={form} change={change} tableId={tableId} />}

			{tableId && (
				<Card title="Live preview" description="Exactly what visitors will see, including search, sorting and pagination.">
					<TablePreview payload={payload} />
				</Card>
			)}

			<div className="st-between">
				<Button variant="ghost" icon="arrowLeft" onClick={onBack}>
					Back to tables
				</Button>
				{!creating && !isLast && (
					<Button variant="soft" iconRight="arrowRight" onClick={() => setStep(step + 1)}>
						Next: {STEPS[step + 1]?.label}
					</Button>
				)}
			</div>
		</div>
	);
}

/** Display names for the sheet's columns: the header text, or "Column N" when there's none. */
function columnNames(snapshot: TableSnapshot | null, hasHeaderRow: boolean): string[] {
	if (!snapshot) return [];
	const width = Math.max(snapshot.headers.length, ...snapshot.rows.slice(0, 200).map((row) => row.length), 0);
	return Array.from({ length: width }, (_, index) => (hasHeaderRow ? snapshot.headers[index]?.trim() : "") || `Column ${index + 1}`);
}

/* ------------------------------------------------------------- 1. Source */

type PublicTabsState = { status: "idle" } | { status: "loading" } | { status: "ok"; items: SheetTab[] } | { status: "error"; message: string };

function SourceStep({ form, change, google, creating }: { form: TableForm; change: (c: Changes) => void; google: GoogleStatus | null; creating: boolean }) {
	const [spreadsheets, setSpreadsheets] = React.useState<DriveSpreadsheet[] | null>(null);
	const [tabs, setTabs] = React.useState<SheetTab[] | null>(null);
	const [loadingList, setLoadingList] = React.useState(false);
	const [error, setError] = React.useState<string | null>(null);

	// Tab picker for public sheets: once the pasted link has a spreadsheet ID, list that sheet's tabs.
	// Keyed on the ID alone, so picking a different tab (which only changes the gid) doesn't refetch.
	const [publicTabs, setPublicTabs] = React.useState<PublicTabsState>({ status: "idle" });
	const publicLink = form.source === "public" ? readSheetUrl(form.sheetUrl) : null;
	const publicSheetId = publicLink?.sheetId ?? null;
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

	const loadSpreadsheets = React.useCallback(async () => {
		setLoadingList(true);
		try {
			const data = await callRoute<{ items: DriveSpreadsheet[] }>("sheets/list");
			setSpreadsheets(data.items);
		} catch (cause) {
			setError(cause instanceof Error ? cause.message : "Could not load your Google Sheets");
		} finally {
			setLoadingList(false);
		}
	}, []);

	const loadTabs = React.useCallback(async (spreadsheetId: string) => {
		setTabs(null);
		try {
			const data = await callRoute<{ items: SheetTab[] }>(`sheets/tabs?spreadsheetId=${encodeURIComponent(spreadsheetId)}`);
			setTabs(data.items);
		} catch (cause) {
			setError(cause instanceof Error ? cause.message : "Could not load sheet tabs");
		}
	}, []);

	// Editing an account-connected table: load its lists so the current choice shows.
	React.useEffect(() => {
		if (form.source !== "oauth" || !google?.connected) return;
		if (!spreadsheets && !loadingList) void loadSpreadsheets();
		if (form.sheetId && !tabs) void loadTabs(form.sheetId);
		// eslint-disable-next-line react-hooks/exhaustive-deps -- only when the source or connection changes
	}, [form.source, google?.connected]);

	return (
		<div className="st-stack-lg">
			{error && <Alert kind="error">{error}</Alert>}
			<Card title="Table name" description="Shown as the table's title (if you turn the title on) and in the editor's table list.">
				<input
					className="st-input"
					value={form.name}
					placeholder="e.g. Price list"
					autoFocus={creating}
					onChange={(e) => change({ name: e.target.value })}
				/>
			</Card>

			<Card title="Where's the data?" description="A link-shared sheet works right away. Private sheets need a connected Google account.">
				<div className="st-stack">
					<div className="st-grid-2">
						<button type="button" className="st-choice" aria-pressed={form.source === "public"} onClick={() => change({ source: "public" })}>
							<span className="st-choice__radio" />
							<span>
								<span className="st-choice__title">Public sheet URL</span>
								<span className="st-choice__desc" style={{ display: "block" }}>
									Shared as "Anyone with the link can view". No Google account needed.
								</span>
							</span>
						</button>
						<button
							type="button"
							className="st-choice"
							aria-pressed={form.source === "oauth"}
							disabled={!google?.connected}
							onClick={() => {
								change({ source: "oauth" });
								if (!spreadsheets) void loadSpreadsheets();
							}}
						>
							<span className="st-choice__radio" />
							<span>
								<span className="st-choice__title">Connected Google account</span>
								<span className="st-choice__desc" style={{ display: "block" }}>
									{google?.connected
										? `Pick any sheet ${google.email ?? "your account"} can open, including private ones.`
										: "Connect a Google account on the Tables page first."}
								</span>
							</span>
						</button>
					</div>

					{form.source === "public" ? (
						<>
							<Field label="Google Sheet URL" help='Paste the share link. In Google Sheets: Share → General access → "Anyone with the link".'>
								<input
									className="st-input"
									value={form.sheetUrl}
									onChange={(e) => change({ sheetUrl: e.target.value })}
									placeholder="https://docs.google.com/spreadsheets/d/…/edit#gid=0"
								/>
							</Field>
							{publicTabs.status === "loading" && <p className="st-xs st-muted">Loading the sheet's tabs…</p>}
							{publicTabs.status === "error" && <Alert kind="warning">Couldn't list this sheet's tabs: {publicTabs.message}</Alert>}
							{publicTabs.status === "ok" && publicLink && (
								<Field label="Sheet tab" help="Which tab of the spreadsheet this table shows.">
									<select className="st-input" value={publicLink.gid} onChange={(e) => change({ sheetUrl: sheetUrlForTab(publicLink.sheetId, e.target.value) })}>
										{/* The link's gid may not match any tab (e.g. a link with no #gid, and no tab with gid 0). */}
										{!publicTabs.items.some((tab) => tab.gid === publicLink.gid) && <option value={publicLink.gid}>Choose a tab…</option>}
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
						<div className="st-grid-2">
							<Field label="Spreadsheet">
								<select
									className="st-input"
									value={form.sheetId}
									disabled={loadingList}
									onChange={(e) => {
										const spreadsheetId = e.target.value;
										change({ sheetId: spreadsheetId, gid: "", sheetTitle: "" });
										if (spreadsheetId) void loadTabs(spreadsheetId);
									}}
								>
									<option value="">{loadingList ? "Loading…" : "Select a spreadsheet…"}</option>
									{spreadsheets?.map((sheet) => (
										<option key={sheet.id} value={sheet.id}>
											{sheet.name}
										</option>
									))}
								</select>
							</Field>
							<Field label="Tab">
								<select
									className="st-input"
									disabled={!form.sheetId}
									value={form.gid}
									onChange={(e) => {
										const tab = tabs?.find((t) => t.gid === e.target.value);
										change({ gid: e.target.value, sheetTitle: tab?.title ?? "" });
									}}
								>
									<option value="">{form.sheetId && !tabs ? "Loading…" : "Select a tab…"}</option>
									{tabs?.map((tab) => (
										<option key={tab.gid} value={tab.gid}>
											{tab.title}
										</option>
									))}
								</select>
							</Field>
						</div>
					)}

					<Switch
						label="First row is the header row"
						description="Its cells become the column names. Turn off if the sheet starts straight with data."
						checked={form.hasHeaderRow}
						onChange={(value) => change({ hasHeaderRow: value })}
					/>
				</div>
			</Card>

			{creating && (
				<Alert kind="info">
					Next, the sheet is read once so you can style the table with a live preview. You can change the source any time.
				</Alert>
			)}
		</div>
	);
}

/* ------------------------------------------------------ 3. Customization */

const PAGINATION_LABELS: Record<PaginationStyle, string> = {
	default: "Default",
	modern: "Modern",
	minimal: "Minimal",
	tailwind: "Tailwind",
	outlined: "Outlined",
};

function NumberInput({ value, min, max, step, onChange }: { value: number; min: number; max: number; step?: number; onChange: (value: number) => void }) {
	return (
		<input
			type="number"
			className="st-input"
			min={min}
			max={max}
			step={step}
			value={Number.isFinite(value) ? value : ""}
			onChange={(e) => onChange(Number(e.target.value))}
		/>
	);
}

function CustomizeStep({ form, change, columns }: { form: TableForm; change: (c: Changes) => void; columns: string[] }) {
	// Kept in EXPORT_FORMATS order, so the buttons always appear in the same order.
	const toggleExport = (format: ExportFormat) =>
		change({
			exportButtons: EXPORT_FORMATS.filter((f) => (f === format ? !form.exportButtons.includes(f) : form.exportButtons.includes(f))),
		});

	return (
		<div className="st-stack-lg">
			<Card title="Display" description="What appears around the table.">
				<div className="st-stack">
					<div className="st-grid-2">
						<Switch label="Show table title" checked={form.showTitle} onChange={(v) => change({ showTitle: v })} />
						<Switch label="Show search bar" checked={form.showSearch} onChange={(v) => change({ showSearch: v })} />
						<Switch label="Show info block" description={'"Showing 1 to 10 of 240 entries"'} checked={form.showInfoBlock} onChange={(v) => change({ showInfoBlock: v })} />
						<Switch label="Show URLs as links" checked={form.linksAsLinks} onChange={(v) => change({ linksAsLinks: v })} />
						<Switch label="Open links in a new tab" checked={form.linksOpenInNewTab} disabled={!form.linksAsLinks} onChange={(v) => change({ linksOpenInNewTab: v })} />
						<Switch label="Show image URLs as images" checked={form.imagesAsImages} onChange={(v) => change({ imagesAsImages: v })} />
					</div>
					<Field label="Description" help="Optional text under the title.">
						<textarea className="st-input" rows={2} value={form.description} onChange={(e) => change({ description: e.target.value })} />
					</Field>
				</div>
			</Card>

			<Card title="Layout & scrolling">
				<div className="st-stack">
					<div className="st-grid-2">
						<Field label="On small screens" help="Collapsible stacks each row into a card on phones. Scrollable keeps a fixed-height box.">
							<Segmented
								label="Responsive style"
								value={form.responsiveStyle}
								onChange={(responsiveStyle) => change({ responsiveStyle })}
								options={[
									{ value: "default", label: "Default" },
									{ value: "collapsible", label: "Collapsible" },
									{ value: "scrollable", label: "Scrollable" },
								]}
							/>
						</Field>
						<div className="st-stack">
							<Field label="Table width" help={WIDTH_HELP[form.tableWidth]}>
								<Segmented
									label="Table width"
									value={form.tableWidth}
									onChange={(tableWidth) => change({ tableWidth })}
									options={[
										{ value: "content", label: "Content" },
										{ value: "wide", label: "Wide" },
										{ value: "full", label: "Full width" },
									]}
								/>
							</Field>
							{form.tableWidth === "wide" && (
								<Field label="Max width (px)" help="Never narrower than the text column, never wider than the screen.">
									<NumberInput value={form.maxWidth} min={480} max={3840} step={20} onChange={(maxWidth) => change({ maxWidth })} />
								</Field>
							)}
						</div>
					</div>
					<hr className="st-divider" />
					<div className="st-grid-2">
						<div className="st-stack">
							<Switch
								label="Vertical scroll & sticky header"
								description="The table body scrolls inside a box and the header row stays in view."
								checked={form.freezeHeader}
								onChange={(v) => change({ freezeHeader: v })}
							/>
							{form.freezeHeader && (
								<Field label="Table height (px)">
									<NumberInput value={form.tableHeight} min={150} max={3000} step={10} onChange={(tableHeight) => change({ tableHeight })} />
								</Field>
							)}
						</div>
						<Switch
							label="Horizontal dragging"
							description="Visitors can drag a wide table sideways with the mouse."
							checked={form.horizontalDrag}
							onChange={(v) => change({ horizontalDrag: v })}
						/>
					</div>
					<hr className="st-divider" />
					<div className="st-grid-2">
						<Field label="Freeze columns from the left" help="These columns stay in place while the rest scrolls sideways.">
							<NumberInput value={form.freezeColumnsLeft} min={0} max={10} onChange={(freezeColumnsLeft) => change({ freezeColumnsLeft })} />
						</Field>
						<Field label="Freeze columns from the right">
							<NumberInput value={form.freezeColumnsRight} min={0} max={10} onChange={(freezeColumnsRight) => change({ freezeColumnsRight })} />
						</Field>
					</div>
				</div>
			</Card>

			<Card title="Sorting">
				<div className="st-stack">
					<Switch
						label="Show sorting controls"
						description="Visitors can click a column header to sort. Turn off for a cleaner header; the default sort below still applies."
						checked={form.allowSorting}
						onChange={(v) => change({ allowSorting: v })}
					/>
					<div className="st-grid-2">
						<Field label="Sort when the page loads">
							<select className="st-input" value={form.defaultSortColumn} onChange={(e) => change({ defaultSortColumn: Number(e.target.value) })}>
								<option value={-1}>Keep the sheet's order</option>
								{columns.map((name, index) => (
									<option key={index} value={index}>
										{name}
									</option>
								))}
							</select>
						</Field>
						{form.defaultSortColumn >= 0 && (
							<Field label="Direction">
								<Segmented
									label="Sort direction"
									value={form.defaultSortDirection}
									onChange={(defaultSortDirection) => change({ defaultSortDirection })}
									options={[
										{ value: "asc", label: "Ascending (A → Z)" },
										{ value: "desc", label: "Descending (Z → A)" },
									]}
								/>
							</Field>
						)}
					</div>
				</div>
			</Card>

			<Card title="Pagination">
				<div className="st-stack">
					<div className="st-grid-3">
						<Field label="Rows per page">
							<NumberInput value={form.rowsPerPage} min={1} max={500} onChange={(rowsPerPage) => change({ rowsPerPage })} />
						</Field>
						<Field label="Position">
							<Segmented
								label="Pagination position"
								value={form.paginationPosition}
								onChange={(paginationPosition) => change({ paginationPosition })}
								options={[
									{ value: "center", label: "Middle" },
									{ value: "right", label: "Bottom right" },
								]}
							/>
						</Field>
						<Field label="Active page color" help="Leave empty to use the theme's accent color.">
							<div className="st-row" style={{ flexWrap: "nowrap" }}>
								<input
									type="color"
									aria-label="Active page color"
									value={form.paginationColor || "#4f46e5"}
									onChange={(e) => change({ paginationColor: e.target.value })}
									style={{ width: "2.5rem", height: "2.25rem", padding: 0, border: "1px solid var(--st-line)", borderRadius: "0.375rem", flex: "none" }}
								/>
								<input
									className="st-input st-input--mono"
									value={form.paginationColor}
									placeholder="theme accent"
									onChange={(e) => change({ paginationColor: e.target.value.trim() })}
								/>
							</div>
						</Field>
					</div>
					<Field label="Style">
						<Segmented
							label="Pagination style"
							value={form.paginationStyle}
							onChange={(paginationStyle) => change({ paginationStyle })}
							options={(Object.keys(PAGINATION_LABELS) as PaginationStyle[]).map((value) => ({ value, label: PAGINATION_LABELS[value] }))}
						/>
					</Field>
				</div>
			</Card>

			<Card title="Export buttons" description="Let visitors download or copy the table. Exports include every page of what they've searched and sorted.">
				<div className="st-row">
					{EXPORT_FORMATS.map((format) => (
						<button key={format} type="button" className="st-chip" aria-pressed={form.exportButtons.includes(format)} onClick={() => toggleExport(format)}>
							<Icon name={form.exportButtons.includes(format) ? "check" : format === "copy" ? "copy" : "download"} />
							{EXPORT_LABELS[format]}
						</button>
					))}
				</div>
			</Card>
		</div>
	);
}

/* ------------------------------------------------------------- 4. Hiding */

const GRID_PAGE = 25;

const plural = (count: number, word: string) => `${count} ${word}${count === 1 ? "" : "s"}`;

function HideStep({ form, change, columns, snapshot }: { form: TableForm; change: (c: Changes) => void; columns: string[]; snapshot: TableSnapshot | null }) {
	const [page, setPage] = React.useState(0);
	const desktop = new Set(form.hiddenColumnsDesktop);
	const mobile = new Set(form.hiddenColumnsMobile);
	const hiddenRows = new Set(form.hiddenRows);
	const hiddenCells = new Set(form.hiddenCells);
	const rows = snapshot?.rows ?? [];
	const pageCount = Math.max(1, Math.ceil(rows.length / GRID_PAGE));
	const start = page * GRID_PAGE;
	// Sheet row number shown next to each data row, so it matches what people see in Google Sheets.
	const firstSheetRow = form.hasHeaderRow ? 2 : 1;

	const toggleIn = (list: number[], value: number) => (list.includes(value) ? list.filter((v) => v !== value) : [...list, value].sort((a, b) => a - b));
	const toggleCell = (key: string) =>
		change({ hiddenCells: hiddenCells.has(key) ? form.hiddenCells.filter((k) => k !== key) : [...form.hiddenCells, key] });

	if (!snapshot) return <Alert kind="info">Sync the table to choose rows and columns to hide.</Alert>;

	return (
		<div className="st-stack-lg">
			<Card
				title="Hide columns"
				description="Hide a column on wide screens, on phones, or both. Columns hidden on both are never sent to visitors."
				actions={
					(form.hiddenColumnsDesktop.length > 0 || form.hiddenColumnsMobile.length > 0) && (
						<Button size="sm" variant="ghost" onClick={() => change({ hiddenColumnsDesktop: [], hiddenColumnsMobile: [] })}>
							Show all
						</Button>
					)
				}
			>
				<div className="st-grid-wrap" style={{ maxHeight: "22rem" }}>
					<table className="st-grid" style={{ width: "100%" }}>
						<thead>
							<tr>
								<th>Column</th>
								<th style={{ width: "8rem" }}>
									<span className="st-row" style={{ gap: "0.375rem" }}>
										<Icon name="desktop" /> Desktop
									</span>
								</th>
								<th style={{ width: "8rem" }}>
									<span className="st-row" style={{ gap: "0.375rem" }}>
										<Icon name="phone" /> Phone
									</span>
								</th>
							</tr>
						</thead>
						<tbody>
							{columns.map((name, index) => (
								<tr key={index}>
									<td className={desktop.has(index) && mobile.has(index) ? "is-hidden" : undefined}>{name}</td>
									<td>
										<Switch label={desktop.has(index) ? "Hidden" : "Visible"} checked={!desktop.has(index)} onChange={() => change({ hiddenColumnsDesktop: toggleIn(form.hiddenColumnsDesktop, index) })} />
									</td>
									<td>
										<Switch label={mobile.has(index) ? "Hidden" : "Visible"} checked={!mobile.has(index)} onChange={() => change({ hiddenColumnsMobile: toggleIn(form.hiddenColumnsMobile, index) })} />
									</td>
								</tr>
							))}
						</tbody>
					</table>
				</div>
			</Card>

			<Card
				title="Hide rows and cells"
				description="Tick a row to hide it, or click a cell to blank it out. Hidden rows and cells are removed before the table reaches visitors."
				actions={
					<>
						<Badge>{plural(form.hiddenRows.length, "row")}</Badge>
						<Badge>{plural(form.hiddenCells.length, "cell")}</Badge>
						{(form.hiddenRows.length > 0 || form.hiddenCells.length > 0) && (
							<Button size="sm" variant="ghost" onClick={() => change({ hiddenRows: [], hiddenCells: [] })}>
								Clear
							</Button>
						)}
					</>
				}
			>
				<div className="st-stack">
					<Alert kind="info">Rows are matched by position. If you insert or delete rows in the sheet, check this list again.</Alert>
					<div className="st-grid-wrap">
						<table className="st-grid">
							<thead>
								<tr>
									<th className="st-grid__rowhead">Row</th>
									{columns.map((name, index) => (
										<th key={index} className={desktop.has(index) && mobile.has(index) ? "is-hidden-col" : undefined}>
											{name}
										</th>
									))}
								</tr>
							</thead>
							<tbody>
								{rows.slice(start, start + GRID_PAGE).map((row, offset) => {
									const r = start + offset;
									const rowHidden = hiddenRows.has(r);
									return (
										<tr key={r} className={rowHidden ? "is-hidden" : undefined}>
											<td className="st-grid__rowhead">
												<label className="st-row" style={{ gap: "0.375rem", flexWrap: "nowrap", cursor: "pointer" }}>
													<input type="checkbox" checked={!rowHidden} onChange={() => change({ hiddenRows: toggleIn(form.hiddenRows, r) })} aria-label={`Show row ${r + firstSheetRow}`} />
													{r + firstSheetRow}
												</label>
											</td>
											{columns.map((_, c) => {
												const key = `${r}:${c}`;
												const classes = ["is-cell", hiddenCells.has(key) ? "is-hidden" : "", desktop.has(c) && mobile.has(c) ? "is-hidden-col" : ""];
												return (
													<td
														key={c}
														className={classes.filter(Boolean).join(" ")}
														title={hiddenCells.has(key) ? "Hidden. Click to show." : "Click to hide this cell"}
														onClick={() => !rowHidden && toggleCell(key)}
													>
														{row[c] ?? ""}
													</td>
												);
											})}
										</tr>
									);
								})}
							</tbody>
						</table>
					</div>
					{pageCount > 1 && (
						<div className="st-between">
							<span className="st-xs st-muted">
								Rows {start + 1}–{Math.min(start + GRID_PAGE, rows.length)} of {rows.length}
							</span>
							<div className="st-row">
								<Button size="sm" icon="arrowLeft" disabled={page === 0} onClick={() => setPage(page - 1)}>
									Previous
								</Button>
								<span className="st-xs st-muted">
									Page {page + 1} of {pageCount}
								</span>
								<Button size="sm" iconRight="arrowRight" disabled={page >= pageCount - 1} onClick={() => setPage(page + 1)}>
									Next
								</Button>
							</div>
						</div>
					)}
				</div>
			</Card>
		</div>
	);
}

/* ----------------------------------------------------------- 5. Advanced */

function AdvancedStep({ form, change, tableId }: { form: TableForm; change: (c: Changes) => void; tableId: string | null }) {
	const selector = `.emdash-sheet-table[data-sheet-table-id="${tableId ?? "…"}"]`;
	return (
		<div className="st-stack-lg">
			<Card title="Custom CSS" description="Added to every page that shows this table. Style the table or anything else on the page.">
				<div className="st-stack">
					<textarea
						className="st-input st-input--mono"
						rows={10}
						spellCheck={false}
						value={form.customCss}
						placeholder={`${selector} th {\n  font-size: 0.8rem;\n}`}
						onChange={(e) => change({ customCss: e.target.value })}
					/>
					<p className="st-help" style={{ marginTop: 0 }}>
						Target only this table with <code className="st-code">{selector}</code>. CSS also applies in the preview below.
					</p>
				</div>
			</Card>

			<Card title="Loading">
				<div className="st-stack">
					<Switch
						label="Load asynchronously"
						description="The page loads first and the table fills in right after. Off: the table is part of the page's HTML, so it works without JavaScript and search engines see it."
						checked={form.asyncLoading}
						onChange={(v) => change({ asyncLoading: v })}
					/>
					<Alert kind="info">
						<strong>Optimized loading is always on.</strong> The table's script and styles are only included on pages that show a table, and
						the export code downloads the first time a visitor clicks an export button.
					</Alert>
				</div>
			</Card>

			<Card title="Syncing" description="Pages serve a cached copy of the sheet. A background task refreshes it when it's older than the cache duration.">
				<div className="st-grid-2">
					<Field label="Cache duration (days)" help="0 refreshes on every background run (every 15 minutes).">
						<NumberInput value={form.cacheDurationDays} min={0} max={365} step={0.5} onChange={(cacheDurationDays) => change({ cacheDurationDays })} />
					</Field>
					<Field label="Response timeout (seconds)" help="How long to wait for Google Sheets before giving up.">
						<NumberInput value={form.responseTimeoutSeconds} min={1} max={120} onChange={(responseTimeoutSeconds) => change({ responseTimeoutSeconds })} />
					</Field>
				</div>
			</Card>
		</div>
	);
}
