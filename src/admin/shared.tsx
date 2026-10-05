import { apiFetch, getErrorMessage, parseApiResponse } from "emdash/plugin-utils";
import * as React from "react";

const ROUTE_BASE = "/_emdash/api/plugins/sheet-table";
export const inputClass = "w-full rounded-md border px-3 py-2 text-sm bg-background";

export async function callRoute<T>(route: string, body?: unknown): Promise<T> {
	const response = await apiFetch(`${ROUTE_BASE}/${route}`, {
		method: body === undefined ? "GET" : "POST",
		headers: body === undefined ? undefined : { "Content-Type": "application/json" },
		body: body === undefined ? undefined : JSON.stringify(body),
	});
	if (!response.ok) {
		throw new Error(await getErrorMessage(response, "Request failed"));
	}
	const data = await parseApiResponse<T>(response);
	if (data && typeof data === "object" && "ok" in data && (data as { ok: unknown }).ok === false) {
		const failure = data as { error?: string; message?: string };
		throw new Error(failure.message ?? failure.error ?? "Request failed");
	}
	return data;
}

// The open form lives in the URL (?new=1 or ?edit=<id>) so a reload or the browser's Back button
// lands on the same screen instead of always resetting to the list.
export function writeViewToUrl(params: Record<string, string>) {
	const search = new URLSearchParams(params).toString();
	const url = window.location.pathname + (search ? `?${search}` : "");
	if (url !== window.location.pathname + window.location.search) window.history.pushState(null, "", url);
}

const PLUGIN_ADMIN_BASE = "/_emdash/admin/plugins/sheet-table";

/** Where the free version sends people who ask about Sheet Table Pro or need help. */
export const PRO_CONTACT_URL = "https://kazibadrul.com/contact/";

/*
 * EmDash's admin stylesheet only contains the Tailwind classes EmDash itself uses, so classes that
 * only this plugin uses (primary buttons, error/warning colors, hover and disabled states) have no
 * CSS at all. These rules fill that gap, scoped to the plugin's pages and built on the admin's own
 * color variables so they follow its light/dark theme.
 */
const PLUGIN_CSS = `
.sheet-table-admin button:not(:disabled) { cursor: pointer; }
.sheet-table-admin button:disabled { cursor: not-allowed; }
.sheet-table-admin .-mb-px { margin-bottom: -1px; }
.sheet-table-admin .break-all { word-break: break-all; }
.sheet-table-admin .min-w-0 { min-width: 0; }
.sheet-table-admin .flex-1 { flex: 1 1 0%; }
.sheet-table-admin .ml-auto { margin-left: auto; }
.sheet-table-admin .pb-2\\.5 { padding-bottom: 0.625rem; }
.sheet-table-admin .border-b-2 { border-bottom-width: 2px; border-bottom-style: solid; }
.sheet-table-admin .border-primary { border-color: var(--color-kumo-brand, #2563eb); }
.sheet-table-admin .border-green-500\\/40 { border-color: var(--color-kumo-success, #16a34a); }
.sheet-table-admin .bg-background { background: var(--color-kumo-base, #fff); }
.sheet-table-admin .bg-primary { background: var(--color-kumo-brand, #2563eb); }
.sheet-table-admin .bg-primary:hover:not(:disabled) { background: var(--color-kumo-brand-hover, #1d4ed8); }
.sheet-table-admin .text-primary-foreground { color: #fff; }
.sheet-table-admin .bg-red-500\\/10 { background: var(--color-kumo-danger-tint, #fee2e2); }
.sheet-table-admin .bg-amber-500\\/10 { background: var(--color-kumo-warning-tint, #fef3c7); }
.sheet-table-admin .bg-green-500\\/10 { background: var(--color-kumo-success-tint, #dcfce7); }
.sheet-table-admin .text-red-500 { color: var(--text-color-kumo-danger, #dc2626); }
.sheet-table-admin .text-amber-600 { color: var(--text-color-kumo-warning, #d97706); }
.sheet-table-admin .text-green-600 { color: var(--text-color-kumo-success, #16a34a); }
.sheet-table-admin .text-muted-foreground { color: var(--text-color-kumo-subtle, #6b7280); }
.sheet-table-admin .hover\\:text-foreground:hover { color: var(--text-color-kumo-default, inherit); }
.sheet-table-admin .hover\\:bg-muted:hover:not(:disabled) { background: var(--color-kumo-fill-hover, #f3f4f6); }
.sheet-table-admin .hover\\:bg-red-500\\/10:hover:not(:disabled) { background: var(--color-kumo-danger-tint, #fee2e2); }
.sheet-table-admin .disabled\\:opacity-30:disabled { opacity: 0.3; }
.sheet-table-admin .disabled\\:opacity-40:disabled { opacity: 0.4; }
.sheet-table-admin .disabled\\:opacity-50:disabled { opacity: 0.5; }
.sheet-table-admin .disabled\\:no-underline:disabled { text-decoration: none; }
`;

/** Wraps an admin page or widget so the plugin's fallback styles (PLUGIN_CSS) apply to it. */
export function withPluginStyles<P extends object>(Page: React.ComponentType<P>): React.ComponentType<P> {
	function StyledPage(props: P) {
		return (
			<div className="sheet-table-admin">
				<style>{PLUGIN_CSS}</style>
				<Page {...props} />
			</div>
		);
	}
	StyledPage.displayName = `withPluginStyles(${Page.displayName ?? Page.name})`;
	return StyledPage;
}

/**
 * Switches between the plugin's two admin pages. EmDash's sidebar has no sub-menus, so the plugin
 * shows one "Sheet Table" sidebar item and puts this switch at the top of both pages instead.
 */
export function SectionNav({ current }: { current: "tables" | "tab-groups" }) {
	const links = [
		{ key: "tables", label: "Tables", href: `${PLUGIN_ADMIN_BASE}/tables` },
		{ key: "tab-groups", label: "Tab Groups", href: `${PLUGIN_ADMIN_BASE}/tab-groups` },
		// EmDash keeps plugin settings on its own Plugins screen; linked here so they're easy to find.
		{ key: "settings", label: "Settings", href: "/_emdash/admin/plugins-manager/sheet-table/settings" },
	] as const;
	return (
		<nav className="flex gap-1 border-b text-sm" aria-label="Sheet Table sections">
			{links.map((link) => (
				<a
					key={link.key}
					href={link.href}
					aria-current={current === link.key ? "page" : undefined}
					className={`px-3 py-2 -mb-px border-b-2 ${
						current === link.key ? "border-primary font-medium" : "border-transparent text-muted-foreground hover:text-foreground"
					}`}
				>
					{link.label}
				</a>
			))}
			<a
				href={PRO_CONTACT_URL}
				target="_blank"
				rel="noopener noreferrer"
				className="ml-auto px-3 py-2 text-muted-foreground hover:text-foreground"
			>
				Pro &amp; support ↗
			</a>
		</nav>
	);
}

export function Field({ label, help, children }: { label: string; help?: string; children: React.ReactNode }) {
	return (
		<label className="block space-y-1">
			<span className="text-sm font-medium">{label}</span>
			{children}
			{help && <span className="block text-xs text-muted-foreground">{help}</span>}
		</label>
	);
}

export function Checkbox({ label, checked, onChange }: { label: string; checked: boolean; onChange: (value: boolean) => void }) {
	return (
		<label className="flex items-center gap-2 text-sm">
			<input type="checkbox" checked={checked} onChange={(e) => onChange(e.target.checked)} />
			{label}
		</label>
	);
}

export type TableWidth = "content" | "wide" | "full";

const WIDTH_HELP: Record<TableWidth, string> = {
	content: "Stays inside the page's text column.",
	wide: "Grows past the text column, up to the max width, centered on it.",
	full: "Spans the screen, keeping a small gap at each edge.",
};

/** The "Table width" control, shared by the table and tab group forms. */
export function WidthFields({
	tableWidth,
	maxWidth,
	onChange,
}: {
	tableWidth: TableWidth;
	maxWidth: number;
	onChange: (changes: { tableWidth?: TableWidth; maxWidth?: number }) => void;
}) {
	return (
		<div className="grid grid-cols-2 gap-4">
			<Field label="Table width" help={WIDTH_HELP[tableWidth]}>
				<select className={inputClass} value={tableWidth} onChange={(e) => onChange({ tableWidth: e.target.value as TableWidth })}>
					<option value="content">Content width</option>
					<option value="wide">Wide</option>
					<option value="full">Full width</option>
				</select>
			</Field>
			{tableWidth === "wide" && (
				<Field label="Max width (px)" help="Never narrower than the text column, never wider than the screen.">
					<input
						type="number"
						min={480}
						max={3840}
						step={20}
						className={inputClass}
						value={maxWidth}
						onChange={(e) => onChange({ maxWidth: Number(e.target.value) })}
					/>
				</Field>
			)}
		</div>
	);
}
