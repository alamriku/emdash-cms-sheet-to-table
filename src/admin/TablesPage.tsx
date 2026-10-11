import * as React from "react";

import { type GoogleStatus, TableEditor } from "./TableEditor.js";
import { PRO_CONTACT_URL, SectionNav, callRoute, writeViewToUrl } from "./shared.js";
import { Alert, Badge, Button, Card, CopyButton, Icon } from "./ui.js";

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

type View = { kind: "list" } | { kind: "new" } | { kind: "edit"; id: string };

function viewFromUrl(): View {
	const params = new URLSearchParams(window.location.search);
	const editId = params.get("edit");
	if (editId) return { kind: "edit", id: editId };
	if (params.get("new")) return { kind: "new" };
	return { kind: "list" };
}

export function TablesPage() {
	const [view, setView] = React.useState<View>(viewFromUrl);
	const [items, setItems] = React.useState<TableListItem[]>([]);
	// Max tables allowed (free version). The server enforces it too; this only greys out the buttons.
	const [tableLimit, setTableLimit] = React.useState<number | null>(null);
	const atLimit = tableLimit !== null && items.length >= tableLimit;
	const [loading, setLoading] = React.useState(true);
	const [error, setError] = React.useState<string | null>(null);
	const [busy, setBusy] = React.useState<string | null>(null);
	const [banner, setBanner] = React.useState<{ kind: "success" | "error"; text: string } | null>(null);
	const [google, setGoogle] = React.useState<GoogleStatus | null>(null);
	const [connecting, setConnecting] = React.useState(false);

	const loadGoogleStatus = React.useCallback(async () => {
		try {
			setGoogle(await callRoute<GoogleStatus>("oauth/status"));
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
		void loadList();
	}, [loadList]);

	// Follow the browser's Back/Forward buttons between the list and the editor.
	React.useEffect(() => {
		const onPop = () => setView(viewFromUrl());
		window.addEventListener("popstate", onPop);
		return () => window.removeEventListener("popstate", onPop);
	}, []);

	function open(next: View) {
		writeViewToUrl(next.kind === "edit" ? { edit: next.id } : next.kind === "new" ? { new: "1" } : {});
		setView(next);
		window.scrollTo({ top: 0 });
	}

	const showLoadError = React.useCallback((message: string) => {
		// A stale ?edit= link (e.g. the table was deleted) falls back to the list with the error.
		window.history.replaceState(null, "", window.location.pathname);
		setView({ kind: "list" });
		setError(message);
	}, []);

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
		} catch (cause) {
			setBanner({ kind: "error", text: cause instanceof Error ? cause.message : "Disconnect failed" });
		}
	}

	async function act(id: string, action: "sync" | "duplicate" | "delete") {
		setError(null);
		setBusy(`${action}:${id}`);
		try {
			await callRoute(`tables/${action}`, { id });
			await loadList();
		} catch (cause) {
			setError(cause instanceof Error ? cause.message : `${action} failed`);
		} finally {
			setBusy(null);
		}
	}

	if (view.kind !== "list") {
		return (
			<TableEditor
				key={view.kind === "edit" ? view.id : "new"}
				editingId={view.kind === "edit" ? view.id : null}
				google={google}
				onBack={() => open({ kind: "list" })}
				onListChanged={() => void loadList()}
				onLoadError={showLoadError}
			/>
		);
	}

	const googleCard = (
		<Card
			title={
				<span className="st-row" style={{ gap: "0.5rem" }}>
					Google account
					{google?.connected ? <Badge kind="success">Connected</Badge> : <Badge>Optional</Badge>}
				</span>
			}
			description={
				!google
					? "Loading…"
					: google.connected
						? `Signed in as ${google.email ?? "a Google account"}. Pick sheets straight from Drive, including private ones.`
						: "Public sheets work without this. Connect an account to show private sheets."
			}
			actions={
				google?.connected ? (
					<Button size="sm" variant="danger" onClick={() => void handleDisconnect()}>
						Disconnect
					</Button>
				) : (
					<Button
						size="sm"
						variant="secondary"
						loading={connecting}
						disabled={!google?.configured || !google?.siteUrlConfigured}
						onClick={() => void handleConnect()}
					>
						Connect Google account
					</Button>
				)
			}
		>
			{google && (!google.configured || !google.siteUrlConfigured || !google.connected) && (
			<div className="st-stack st-small">
				{google && !google.configured && (
					<p className="st-muted" style={{ margin: 0 }}>
						To connect, add a Google OAuth Client ID and Secret in{" "}
						<a className="st-link" href="/_emdash/admin/plugins-manager/sheet-table/settings">
							Sheet Table settings
						</a>
						.
					</p>
				)}
				{google && !google.siteUrlConfigured && (
					<Alert kind="warning">
						This site has no canonical URL recorded yet, so Google can't be given a working redirect URI. Complete the EmDash setup
						wizard on the real domain first (not the local dev-bypass shortcut).
					</Alert>
				)}
				{google && !google.connected && google.siteUrlConfigured && (
					<p className="st-muted" style={{ margin: 0 }}>
						Authorized redirect URI for your OAuth client: <code className="st-code" style={{ wordBreak: "break-all" }}>{google.redirectUri}</code>
					</p>
				)}
			</div>
			)}
		</Card>
	);

	return (
		<section className="st-stack-lg" style={{ maxWidth: "76rem" }}>
			<div className="st-between">
				<div>
					<h1 className="st-h1">Sheet Table</h1>
					<p className="st-small st-muted" style={{ margin: "0.25rem 0 0" }}>
						Live, searchable tables from Google Sheets.
					</p>
				</div>
				<Button
					variant="primary"
					icon="plus"
					onClick={() => open({ kind: "new" })}
					disabled={atLimit}
					title={atLimit ? `The free version allows up to ${tableLimit} tables` : undefined}
				>
					New table
				</Button>
			</div>

			<SectionNav current="tables" />

			{banner && <Alert kind={banner.kind}>{banner.text}</Alert>}
			{error && <Alert kind="error">{error}</Alert>}

			{loading ? (
				<p className="st-small st-muted">Loading…</p>
			) : items.length === 0 ? (
				<GettingStarted onCreate={() => open({ kind: "new" })} />
			) : (
				<Card
					title="Your tables"
					description={
						tableLimit !== null ? (
							<span style={atLimit ? { color: "var(--st-warning)" } : undefined}>
								{items.length} of {tableLimit} tables used.
								{atLimit && (
									<>
										{" "}
										Delete one you no longer need, or{" "}
										<a className="st-link" href={PRO_CONTACT_URL} target="_blank" rel="noopener noreferrer">
											ask about Sheet Table Pro
										</a>{" "}
										for unlimited tables.
									</>
								)}
							</span>
						) : undefined
					}
					flush
				>
					<ul style={{ listStyle: "none", margin: 0, padding: 0 }}>
						{items.map((item, index) => (
							<li
								key={item.id}
								className="st-between"
								style={{ padding: "1rem 1.25rem", borderTop: index === 0 ? undefined : "1px solid var(--st-line)", flexWrap: "nowrap" }}
							>
								<div className="st-row" style={{ gap: "0.875rem", flexWrap: "nowrap", minWidth: 0 }}>
									<span
										style={{
											display: "grid",
											placeItems: "center",
											width: "2.5rem",
											height: "2.5rem",
											flex: "none",
											borderRadius: "0.625rem",
											background: "var(--st-primary-tint)",
											color: "var(--st-primary)",
										}}
									>
										<Icon name="table" className="st-icon" />
									</span>
									<div style={{ minWidth: 0 }}>
										<div className="st-row" style={{ gap: "0.5rem" }}>
											<button
												type="button"
												onClick={() => open({ kind: "edit", id: item.id })}
												style={{ background: "none", border: 0, padding: 0, font: "inherit", fontWeight: 600, color: "var(--st-strong)", cursor: "pointer" }}
											>
												{item.name}
											</button>
											<Badge>{item.source === "oauth" ? "Google account" : "Public URL"}</Badge>
											{item.syncError && <Badge kind="danger">Sync error</Badge>}
										</div>
										<div className="st-xs st-muted" style={{ marginTop: "0.25rem" }}>
											{item.rowCount.toLocaleString()} rows ·{" "}
											{item.syncedAt ? `synced ${new Date(item.syncedAt).toLocaleString()}` : "not synced yet"} ·{" "}
											<span className="st-row" style={{ display: "inline-flex", gap: 0 }}>
												<code className="st-code">{item.id}</code>
												<CopyButton text={item.id} label="Copy table ID" />
											</span>
										</div>
										{item.syncError && (
											<div className="st-xs" style={{ color: "var(--st-danger)", marginTop: "0.125rem" }}>
												{item.syncError}
											</div>
										)}
									</div>
								</div>
								<div className="st-row" style={{ flexWrap: "nowrap", flex: "none" }}>
									<Button size="sm" variant="secondary" icon="pencil" onClick={() => open({ kind: "edit", id: item.id })}>
										Edit
									</Button>
									<Button size="sm" variant="ghost" icon="refresh" title="Sync now" aria-label="Sync now" loading={busy === `sync:${item.id}`} onClick={() => void act(item.id, "sync")} />
									<Button
										size="sm"
										variant="ghost"
										icon="copy"
										title="Duplicate"
										aria-label="Duplicate"
										disabled={atLimit}
										loading={busy === `duplicate:${item.id}`}
										onClick={() => void act(item.id, "duplicate")}
									/>
									<Button
										size="sm"
										variant="danger"
										icon="trash"
										title="Delete"
										aria-label="Delete"
										onClick={() => {
											if (window.confirm(`Delete "${item.name}"? This cannot be undone.`)) void act(item.id, "delete");
										}}
									/>
								</div>
							</li>
						))}
					</ul>
				</Card>
			)}

			{googleCard}
		</section>
	);
}

/** First-run onboarding: the three steps from a Google Sheet to a table on a page. */
function GettingStarted({ onCreate }: { onCreate: () => void }) {
	const steps = [
		{ icon: "link" as const, title: "Share your sheet", text: 'In Google Sheets, click Share and set access to "Anyone with the link can view".' },
		{ icon: "sparkles" as const, title: "Create a table", text: "Paste the link, pick a tab, then choose a theme and the features you want." },
		{ icon: "table" as const, title: "Add it to a page", text: "Type / in the editor, insert the Sheet Table block and pick your table." },
	];
	return (
		<Card>
			<div className="st-stack-lg" style={{ textAlign: "center", padding: "1.5rem 0.5rem" }}>
				<div>
					<span
						style={{
							display: "inline-grid",
							placeItems: "center",
							width: "3.5rem",
							height: "3.5rem",
							borderRadius: "1rem",
							background: "var(--st-primary-tint)",
							color: "var(--st-primary)",
						}}
					>
						<Icon name="table" className="st-icon" />
					</span>
					<h2 className="st-h1" style={{ fontSize: "1.25rem", marginTop: "1rem" }}>
						Turn a Google Sheet into a live table
					</h2>
					<p className="st-small st-muted" style={{ maxWidth: "32rem", margin: "0.5rem auto 0" }}>
						Edit the sheet and the table on your site follows. Visitors can search, sort, page through and export it.
					</p>
				</div>
				<div className="st-grid-3" style={{ textAlign: "left" }}>
					{steps.map((step, index) => (
						<div key={step.title} style={{ padding: "1rem", borderRadius: "0.75rem", border: "1px solid var(--st-line)", background: "var(--st-recessed)" }}>
							<div className="st-row" style={{ gap: "0.5rem" }}>
								<span
									style={{
										display: "grid",
										placeItems: "center",
										width: "1.75rem",
										height: "1.75rem",
										borderRadius: "999px",
										background: "var(--st-primary)",
										color: "#fff",
										fontSize: "0.8125rem",
										fontWeight: 700,
									}}
								>
									{index + 1}
								</span>
								<strong className="st-small">{step.title}</strong>
							</div>
							<p className="st-xs st-muted" style={{ margin: "0.5rem 0 0" }}>
								{step.text}
							</p>
						</div>
					))}
				</div>
				<div>
					<Button variant="primary" size="lg" icon="plus" onClick={onCreate}>
						Create your first table
					</Button>
				</div>
			</div>
		</Card>
	);
}
