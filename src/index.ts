import type { PluginContext, PluginDescriptor, ResolvedPlugin } from "emdash";
import { definePlugin, pluginResponse } from "emdash";
import { z } from "zod";

import {
	buildAuthUrl,
	callbackUrl,
	consumeOAuthState,
	createOAuthState,
	disconnectGoogle,
	exchangeCodeForRefreshToken,
	fetchConnectedEmail,
	getAccessToken,
	getClientConfig,
} from "./lib/oauth.js";
import { parseSheetUrl } from "./lib/sheets.js";
import { listSheetTabs, listSpreadsheets } from "./lib/sheets-api.js";
import { fetchPublicSheetTabs, snapshotKey, syncTable } from "./lib/sync.js";
import {
	DEFAULT_MAX_WIDTH,
	DEFAULT_TABLE,
	type TabGroupRecord,
	type TabGroupRenderPayload,
	type TableRecord,
	type TableRenderMeta,
	type TableRenderPayload,
	type TableSnapshot,
} from "./lib/types.js";

import { version } from "../package.json";

const SYNC_TASK_NAME = "sheet-table-sync";
const SYNC_SCHEDULE = "*/15 * * * *"; // every 15 minutes; syncTable() itself honors per-table cache duration.
const ADMIN_TABLES_PAGE = "/_emdash/admin/plugins/sheet-table/tables";

/** The free version's cap on how many tables a site can have. Existing tables past the cap keep working. */
const FREE_TABLE_LIMIT = 10;
const TABLE_LIMIT_MESSAGE = `The free version of Sheet Table allows up to ${FREE_TABLE_LIMIT} tables. Delete a table you no longer need to add a new one.`;

export interface SheetTablePluginOptions {}

export function sheetTablePlugin(
	options: SheetTablePluginOptions = {},
): PluginDescriptor<SheetTablePluginOptions> {
	return {
		id: "sheet-table",
		version,
		format: "native",
		entrypoint: "emdash-plugin-sheet-table",
		options,
		adminEntry: "emdash-plugin-sheet-table/admin",
		componentsEntry: "emdash-plugin-sheet-table/astro",
		adminPages: ADMIN_PAGES,
		adminWidgets: [{ id: "sheet-table-status", title: "Sheet Table" }],
	};
}

// One sidebar entry for the whole plugin. The Tab Groups page (/tab-groups) is still a registered admin
// page (see src/admin/index.tsx); it's reached from the "Tables | Tab Groups" switch at the top of each page.
const ADMIN_PAGES = [{ path: "/tables", label: "Sheet Table", icon: "table" }];

// Shared by tables and tab groups. Defaults keep older admin builds (which don't send these) valid.
const widthFields = {
	tableWidth: z.enum(["content", "wide", "full"]).default("content"),
	maxWidth: z.number().int().min(480).max(3840).default(DEFAULT_MAX_WIDTH),
};

const commonTableFields = {
	name: z.string().min(1).max(200),
	hasHeaderRow: z.boolean(),
	showTitle: z.boolean(),
	description: z.string().max(2000),
	theme: z.enum(["simple", "simple-dark", "auto"]),
	responsiveStyle: z.enum(["default", "collapsible", "scrollable"]),
	...widthFields,
	rowsPerPage: z.number().int().min(1).max(500),
	showInfoBlock: z.boolean(),
	allowSorting: z.boolean(),
	showSearch: z.boolean(),
	asyncLoading: z.boolean(),
	mergeCells: z.boolean(),
	linksAsLinks: z.boolean(),
	linksOpenInNewTab: z.boolean(),
	imagesAsImages: z.boolean(),
	cacheDurationDays: z.number().min(0).max(365),
	responseTimeoutSeconds: z.number().min(1).max(120),
};

const createInputSchema = z.discriminatedUnion("source", [
	z.object({ source: z.literal("public"), sheetUrl: z.string().min(1), ...commonTableFields }),
	z.object({
		source: z.literal("oauth"),
		sheetId: z.string().min(1),
		gid: z.string().min(1),
		sheetTitle: z.string().min(1),
		...commonTableFields,
	}),
]);

const updateInputSchema = z
	.object(commonTableFields)
	.partial()
	.extend({
		id: z.string().min(1),
		source: z.enum(["public", "oauth"]).optional(),
		sheetUrl: z.string().min(1).optional(),
		sheetId: z.string().min(1).optional(),
		gid: z.string().min(1).optional(),
		// Public-URL tables store sheetTitle as "", and the admin form sends it back on every save.
		sheetTitle: z.string().optional(),
	});

const idInputSchema = z.object({ id: z.string().min(1) });

const tabGroupFields = {
	name: z.string().trim().min(1).max(200),
	showName: z.boolean(),
	tabPosition: z.enum(["before", "after"]),
	...widthFields,
	tabs: z
		.array(z.object({ name: z.string().trim().min(1).max(100), tableId: z.string().min(1) }))
		.min(1, "Add at least one tab")
		.max(50),
};
const tabGroupCreateSchema = z.object(tabGroupFields);
const tabGroupUpdateSchema = z.object({ id: z.string().min(1), ...tabGroupFields });

// `metaOnly` lets the SSR renderer check a table's asyncLoading setting without paying for a
// syncTable() call (and the Google Sheets fetch it can trigger) on every page render.
const renderInputSchema = idInputSchema.extend({ metaOnly: z.string().optional() });

export function createPlugin(_options: SheetTablePluginOptions = {}): ResolvedPlugin {
	return definePlugin({
		id: "sheet-table",
		version,

		capabilities: ["network:request"],
		allowedHosts: [
			"docs.google.com",
			// The public CSV export redirects to a per-document googleusercontent.com host to
			// serve the actual bytes; every redirect hop is host-checked, so this is required too.
			"*.googleusercontent.com",
			"oauth2.googleapis.com",
			"www.googleapis.com",
			"sheets.googleapis.com",
		],

		storage: {
			tables: {
				indexes: ["createdAt"],
			},
			tabGroups: {
				indexes: ["createdAt"],
			},
		},

		admin: {
			entry: "emdash-plugin-sheet-table/admin",
			pages: ADMIN_PAGES,
			widgets: [{ id: "sheet-table-status", title: "Sheet Table" }],
			settingsSchema: {
				defaultCacheDurationDays: {
					type: "number",
					label: "Default cache duration (days)",
					description: "How long a new table's synced data is reused before refetching from Google Sheets.",
					min: 0,
					max: 365,
					default: DEFAULT_TABLE.cacheDurationDays,
				},
				defaultResponseTimeoutSeconds: {
					type: "number",
					label: "Default response timeout (seconds)",
					description: "How long to wait for Google Sheets before giving up on a sync.",
					min: 1,
					max: 120,
					default: DEFAULT_TABLE.responseTimeoutSeconds,
				},
				defaultRowsPerPage: {
					type: "number",
					label: "Default rows per page",
					min: 1,
					max: 500,
					default: DEFAULT_TABLE.rowsPerPage,
				},
				defaultTheme: {
					type: "select",
					label: "Default theme",
					options: [
						{ value: "auto", label: "Auto (match visitor's light/dark preference)" },
						{ value: "simple", label: "Simple (light)" },
						{ value: "simple-dark", label: "Simple (dark)" },
					],
					default: DEFAULT_TABLE.theme,
				},
				googleClientId: {
					type: "string",
					label: "Google OAuth Client ID",
					description:
						"From a Google Cloud OAuth 2.0 Web application client. Only needed to connect private sheets — public sheets work without it.",
				},
				googleClientSecret: {
					type: "secret",
					label: "Google OAuth Client Secret",
				},
				googleRefreshToken: {
					type: "secret",
					label: "Google refresh token",
					description: "Managed automatically by Connect/Disconnect on the Tables page. Do not paste a value here.",
				},
				googleConnectedEmail: {
					type: "email",
					label: "Connected Google account",
					description: "Managed automatically. Read-only.",
				},
			},
			portableTextBlocks: [
				{
					type: "sheet-table",
					label: "Sheet Table",
					icon: "table",
					description: "Embed a synced Google Sheet table — pick one of your tables from the list",
					category: "Embeds",
					fields: [
						{
							// Same action_id as the old free-text "Table ID" field, so blocks already in
							// content keep their table. Options are filled from the tables/options route.
							type: "select",
							action_id: "tableId",
							label: "Table",
							options: [],
							optionsRoute: "tables/options",
						},
					],
				},
				{
					type: "sheet-table-tabs",
					label: "Sheet Table Tabs",
					icon: "table",
					description: "Show several tables in one block, switched with tabs — pick one of your tab groups",
					category: "Embeds",
					fields: [
						{
							type: "select",
							action_id: "tabGroupId",
							label: "Tab group",
							options: [],
							optionsRoute: "tab-groups/options",
						},
					],
				},
			],
		},

		hooks: {
			"plugin:install": async (_event, ctx) => {
				if (!ctx.cron) {
					ctx.log.warn("Cron access unavailable; Sheet Table will only sync on demand");
					return;
				}
				await ctx.cron.schedule(SYNC_TASK_NAME, { schedule: SYNC_SCHEDULE });
			},

			"plugin:activate": async (_event, ctx) => {
				if (!ctx.cron) {
					ctx.log.warn("Cron access unavailable; Sheet Table will only sync on demand");
					return;
				}
				await ctx.cron.schedule(SYNC_TASK_NAME, { schedule: SYNC_SCHEDULE });
			},

			"plugin:uninstall": async (event, ctx) => {
				await ctx.cron?.cancel(SYNC_TASK_NAME);
				if (event.deleteData) {
					await deleteAllTables(ctx);
					await deleteAllTabGroups(ctx);
					await disconnectGoogle(ctx);
				}
			},

			cron: async (event, ctx) => {
				if (event.name !== SYNC_TASK_NAME) return;
				let cursor: string | undefined;
				do {
					const page = await ctx.storage.tables.query({ limit: 50, cursor });
					for (const item of page.items) {
						try {
							await syncTable(ctx, item.id, item.data as TableRecord, { force: false });
						} catch (error) {
							ctx.log.warn("Sheet Table sync failed", {
								tableId: item.id,
								error: error instanceof Error ? error.message : String(error),
							});
						}
					}
					cursor = page.cursor;
				} while (cursor);
			},
		},

		routes: {
			"tables/list": {
				handler: async (ctx) => {
					const result = await ctx.storage.tables.query({
						orderBy: { createdAt: "desc" },
						limit: 100,
					});
					const items = await Promise.all(
						result.items.map(async ({ id, data }) => {
							const table = data as TableRecord;
							const snapshot = await ctx.kv.get<TableSnapshot>(snapshotKey(id));
							return {
								id,
								name: table.name,
								source: table.source,
								sheetUrl: table.sheetUrl,
								rowsPerPage: table.rowsPerPage,
								rowCount: snapshot?.totalRowCount ?? snapshot?.rows.length ?? 0,
								syncedAt: snapshot?.syncedAt ?? null,
								syncError: snapshot?.error ?? null,
							};
						}),
					);
					return { items, limit: FREE_TABLE_LIMIT };
				},
			},

			// Feeds the table dropdown in the Sheet Table block (the admin editor POSTs to it).
			"tables/options": {
				methods: ["GET", "POST"],
				handler: async (ctx) => {
					const result = await ctx.storage.tables.query({ orderBy: { createdAt: "desc" }, limit: 100 });
					return { items: result.items.map(({ id, data }) => ({ id, name: (data as TableRecord).name })) };
				},
			},

			"tables/get": {
				handler: async (ctx) => {
					const parsed = idInputSchema.safeParse(ctx.input);
					if (!parsed.success) return { ok: false, error: "INVALID_ID" };

					const table = (await ctx.storage.tables.get(parsed.data.id)) as TableRecord | null;
					if (!table) return { ok: false, error: "NOT_FOUND" };

					const snapshot = await ctx.kv.get<TableSnapshot>(snapshotKey(parsed.data.id));
					return { ok: true, id: parsed.data.id, table, snapshot: snapshot ?? null };
				},
			},

			"tables/create": {
				methods: ["POST"],
				handler: async (ctx) => {
					const parsed = createInputSchema.safeParse(ctx.input);
					if (!parsed.success) {
						return { ok: false, error: "VALIDATION_ERROR", issues: parsed.error.issues };
					}
					if ((await ctx.storage.tables.count()) >= FREE_TABLE_LIMIT) {
						return { ok: false, error: "TABLE_LIMIT_REACHED", message: TABLE_LIMIT_MESSAGE };
					}
					const input = parsed.data;

					let sheetId: string;
					let gid: string;
					let sheetTitle: string;
					let sheetUrl: string;

					if (input.source === "public") {
						try {
							const parsedUrl = parseSheetUrl(input.sheetUrl);
							sheetId = parsedUrl.sheetId;
							gid = parsedUrl.gid;
						} catch (error) {
							return {
								ok: false,
								error: "INVALID_SHEET_URL",
								message: error instanceof Error ? error.message : String(error),
							};
						}
						sheetTitle = "";
						sheetUrl = input.sheetUrl;
					} else {
						sheetId = input.sheetId;
						gid = input.gid;
						sheetTitle = input.sheetTitle;
						sheetUrl = `https://docs.google.com/spreadsheets/d/${sheetId}/edit#gid=${gid}`;
					}

					const now = new Date().toISOString();
					const id = `table_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`;
					const table: TableRecord = {
						name: input.name,
						source: input.source,
						sheetUrl,
						sheetId,
						gid,
						sheetTitle,
						hasHeaderRow: input.hasHeaderRow,
						showTitle: input.showTitle,
						description: input.description,
						theme: input.theme,
						responsiveStyle: input.responsiveStyle,
						tableWidth: input.tableWidth,
						maxWidth: input.maxWidth,
						rowsPerPage: input.rowsPerPage,
						showInfoBlock: input.showInfoBlock,
						allowSorting: input.allowSorting,
						showSearch: input.showSearch,
						asyncLoading: input.asyncLoading,
						mergeCells: input.mergeCells,
						linksAsLinks: input.linksAsLinks,
						linksOpenInNewTab: input.linksOpenInNewTab,
						imagesAsImages: input.imagesAsImages,
						cacheDurationDays: input.cacheDurationDays,
						responseTimeoutSeconds: input.responseTimeoutSeconds,
						createdAt: now,
						updatedAt: now,
					};

					await ctx.storage.tables.put(id, table);
					const snapshot = await syncTable(ctx, id, table, { force: true });

					return { ok: true, id, table, snapshot };
				},
			},

			"tables/update": {
				methods: ["POST"],
				handler: async (ctx) => {
					const parsed = updateInputSchema.safeParse(ctx.input);
					if (!parsed.success) {
						return { ok: false, error: "VALIDATION_ERROR", issues: parsed.error.issues };
					}
					const { id, ...changes } = parsed.data;

					const existing = (await ctx.storage.tables.get(id)) as TableRecord | null;
					if (!existing) return { ok: false, error: "NOT_FOUND" };

					let sheetId = existing.sheetId;
					let gid = existing.gid;
					let sheetTitle = changes.sheetTitle ?? existing.sheetTitle;
					let sheetUrl = existing.sheetUrl;
					let sourceChanged = false;

					const effectiveSource = changes.source ?? existing.source;
					if (effectiveSource === "public" && changes.sheetUrl && changes.sheetUrl !== existing.sheetUrl) {
						try {
							const parsedUrl = parseSheetUrl(changes.sheetUrl);
							sheetId = parsedUrl.sheetId;
							gid = parsedUrl.gid;
							sheetUrl = changes.sheetUrl;
							sourceChanged = true;
						} catch (error) {
							return {
								ok: false,
								error: "INVALID_SHEET_URL",
								message: error instanceof Error ? error.message : String(error),
							};
						}
					} else if (
						effectiveSource === "oauth" &&
						((changes.sheetId && changes.sheetId !== existing.sheetId) ||
							(changes.sheetTitle && changes.sheetTitle !== existing.sheetTitle))
					) {
						sheetId = changes.sheetId ?? existing.sheetId;
						gid = changes.gid ?? existing.gid;
						sheetTitle = changes.sheetTitle ?? existing.sheetTitle;
						sheetUrl = `https://docs.google.com/spreadsheets/d/${sheetId}/edit#gid=${gid}`;
						sourceChanged = true;
					}

					const updated: TableRecord = {
						...existing,
						...changes,
						source: effectiveSource,
						sheetId,
						gid,
						sheetTitle,
						sheetUrl,
						updatedAt: new Date().toISOString(),
					};

					await ctx.storage.tables.put(id, updated);
					const snapshot = sourceChanged
						? await syncTable(ctx, id, updated, { force: true })
						: await ctx.kv.get<TableSnapshot>(snapshotKey(id));

					return { ok: true, id, table: updated, snapshot: snapshot ?? null };
				},
			},

			"tables/duplicate": {
				methods: ["POST"],
				handler: async (ctx) => {
					const parsed = idInputSchema.safeParse(ctx.input);
					if (!parsed.success) return { ok: false, error: "INVALID_ID" };

					const source = (await ctx.storage.tables.get(parsed.data.id)) as TableRecord | null;
					if (!source) return { ok: false, error: "NOT_FOUND" };
					if ((await ctx.storage.tables.count()) >= FREE_TABLE_LIMIT) {
						return { ok: false, error: "TABLE_LIMIT_REACHED", message: TABLE_LIMIT_MESSAGE };
					}

					const now = new Date().toISOString();
					const newId = `table_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`;
					const copy: TableRecord = { ...source, name: `${source.name} (copy)`, createdAt: now, updatedAt: now };
					await ctx.storage.tables.put(newId, copy);

					const sourceSnapshot = await ctx.kv.get<TableSnapshot>(snapshotKey(parsed.data.id));
					if (sourceSnapshot) {
						await ctx.kv.set(snapshotKey(newId), sourceSnapshot);
					}

					return { ok: true, id: newId, table: copy };
				},
			},

			"tables/delete": {
				methods: ["POST"],
				handler: async (ctx) => {
					const parsed = idInputSchema.safeParse(ctx.input);
					if (!parsed.success) return { ok: false, error: "INVALID_ID" };

					const deleted = await ctx.storage.tables.delete(parsed.data.id);
					await ctx.kv.delete(snapshotKey(parsed.data.id));
					return { ok: true, deleted };
				},
			},

			"tables/sync": {
				methods: ["POST"],
				handler: async (ctx) => {
					const parsed = idInputSchema.safeParse(ctx.input);
					if (!parsed.success) return { ok: false, error: "INVALID_ID" };

					const table = (await ctx.storage.tables.get(parsed.data.id)) as TableRecord | null;
					if (!table) return { ok: false, error: "NOT_FOUND" };

					const snapshot = await syncTable(ctx, parsed.data.id, table, { force: true });
					return { ok: true, snapshot };
				},
			},

			render: {
				public: true,
				methods: ["GET"],
				handler: async (ctx): Promise<TableRenderPayload | TableRenderMeta | { error: string }> => {
					const parsed = renderInputSchema.safeParse(ctx.input);
					if (!parsed.success) return { error: "INVALID_ID" };

					const table = (await ctx.storage.tables.get(parsed.data.id)) as TableRecord | null;
					if (!table) return { error: "NOT_FOUND" };

					if (parsed.data.metaOnly === "1") {
						return { id: parsed.data.id, asyncLoading: table.asyncLoading };
					}

					const snapshot = await syncTable(ctx, parsed.data.id, table, { force: false });

					return {
						id: parsed.data.id,
						name: table.name,
						showTitle: table.showTitle,
						description: table.description,
						theme: table.theme,
						responsiveStyle: table.responsiveStyle,
						tableWidth: table.tableWidth ?? "content",
						maxWidth: table.maxWidth ?? DEFAULT_MAX_WIDTH,
						rowsPerPage: table.rowsPerPage,
						showInfoBlock: table.showInfoBlock,
						allowSorting: table.allowSorting,
						showSearch: table.showSearch,
						asyncLoading: table.asyncLoading,
						linksAsLinks: table.linksAsLinks,
						linksOpenInNewTab: table.linksOpenInNewTab,
						imagesAsImages: table.imagesAsImages,
						headers: snapshot.headers,
						rows: snapshot.rows,
						totalRowCount: snapshot.totalRowCount,
						syncedAt: snapshot.syncedAt,
						error: snapshot.error,
					};
				},
			},

			"tab-groups/list": {
				handler: async (ctx) => {
					const result = await ctx.storage.tabGroups.query({
						orderBy: { createdAt: "desc" },
						limit: 100,
					});
					const items = await Promise.all(
						result.items.map(async ({ id, data }) => {
							const group = data as TabGroupRecord;
							return {
								id,
								name: group.name,
								tabs: await Promise.all(
									group.tabs.map(async (tab) => {
										const table = (await ctx.storage.tables.get(tab.tableId)) as TableRecord | null;
										return { name: tab.name, tableId: tab.tableId, tableName: table?.name ?? null };
									}),
								),
							};
						}),
					);
					return { items };
				},
			},

			// Feeds the tab group dropdown in the Sheet Table Tabs block (the admin editor POSTs to it).
			"tab-groups/options": {
				methods: ["GET", "POST"],
				handler: async (ctx) => {
					const result = await ctx.storage.tabGroups.query({ orderBy: { createdAt: "desc" }, limit: 100 });
					return { items: result.items.map(({ id, data }) => ({ id, name: (data as TabGroupRecord).name })) };
				},
			},

			"tab-groups/get": {
				handler: async (ctx) => {
					const parsed = idInputSchema.safeParse(ctx.input);
					if (!parsed.success) return { ok: false, error: "INVALID_ID" };

					const group = (await ctx.storage.tabGroups.get(parsed.data.id)) as TabGroupRecord | null;
					if (!group) return { ok: false, error: "NOT_FOUND" };
					return { ok: true, id: parsed.data.id, group };
				},
			},

			"tab-groups/create": {
				methods: ["POST"],
				handler: async (ctx) => {
					const parsed = tabGroupCreateSchema.safeParse(ctx.input);
					if (!parsed.success) {
						return { ok: false, error: "VALIDATION_ERROR", message: firstIssue(parsed.error) };
					}
					const missing = await findMissingTable(ctx, parsed.data.tabs);
					if (missing) return { ok: false, error: "TABLE_NOT_FOUND", message: missing };

					const now = new Date().toISOString();
					const id = `tabs_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`;
					const group: TabGroupRecord = { ...parsed.data, createdAt: now, updatedAt: now };
					await ctx.storage.tabGroups.put(id, group);
					return { ok: true, id, group };
				},
			},

			"tab-groups/update": {
				methods: ["POST"],
				handler: async (ctx) => {
					const parsed = tabGroupUpdateSchema.safeParse(ctx.input);
					if (!parsed.success) {
						return { ok: false, error: "VALIDATION_ERROR", message: firstIssue(parsed.error) };
					}
					const { id, ...changes } = parsed.data;

					const existing = (await ctx.storage.tabGroups.get(id)) as TabGroupRecord | null;
					if (!existing) return { ok: false, error: "NOT_FOUND" };

					const missing = await findMissingTable(ctx, changes.tabs);
					if (missing) return { ok: false, error: "TABLE_NOT_FOUND", message: missing };

					const group: TabGroupRecord = { ...existing, ...changes, updatedAt: new Date().toISOString() };
					await ctx.storage.tabGroups.put(id, group);
					return { ok: true, id, group };
				},
			},

			"tab-groups/delete": {
				methods: ["POST"],
				handler: async (ctx) => {
					const parsed = idInputSchema.safeParse(ctx.input);
					if (!parsed.success) return { ok: false, error: "INVALID_ID" };
					await ctx.storage.tabGroups.delete(parsed.data.id);
					return { ok: true };
				},
			},

			"tab-groups/render": {
				public: true,
				methods: ["GET"],
				handler: async (ctx): Promise<TabGroupRenderPayload | { error: string }> => {
					const parsed = idInputSchema.safeParse(ctx.input);
					if (!parsed.success) return { error: "INVALID_ID" };

					const group = (await ctx.storage.tabGroups.get(parsed.data.id)) as TabGroupRecord | null;
					if (!group) return { error: "NOT_FOUND" };

					// A table can be deleted after it was added to a group; skip its tab rather than
					// showing visitors an empty "table not found" panel.
					const tabs = [];
					for (const tab of group.tabs) {
						if (await ctx.storage.tables.get(tab.tableId)) tabs.push(tab);
					}

					return {
						id: parsed.data.id,
						name: group.name,
						showName: group.showName,
						tabPosition: group.tabPosition,
						tableWidth: group.tableWidth ?? "content",
						maxWidth: group.maxWidth ?? DEFAULT_MAX_WIDTH,
						tabs,
					};
				},
			},

			"oauth/status": {
				handler: async (ctx) => {
					const config = await getClientConfig(ctx);
					const refreshToken = await ctx.settings.get<string>("googleRefreshToken");
					const email = await ctx.settings.get<string>("googleConnectedEmail");
					return {
						configured: config !== null,
						connected: Boolean(refreshToken),
						email: email ?? null,
						redirectUri: callbackUrl(ctx),
						siteUrlConfigured: /^https?:\/\//.test(ctx.site.url),
					};
				},
			},

			"oauth/start": {
				methods: ["POST"],
				handler: async (ctx) => {
					if (!/^https?:\/\//.test(ctx.site.url)) {
						return {
							ok: false,
							error: "SITE_URL_NOT_CONFIGURED",
							message:
								"This site has no canonical URL recorded yet, so Google cannot be given a working redirect URI. EmDash records this once when an administrator completes the real setup wizard at /_emdash/admin (not the local dev-bypass shortcut). Complete setup on the real domain, then try connecting again.",
						};
					}
					const config = await getClientConfig(ctx);
					if (!config) {
						return {
							ok: false,
							error: "NOT_CONFIGURED",
							message: "Set a Google OAuth Client ID and Secret in Sheet Table settings first.",
						};
					}
					const state = await createOAuthState(ctx);
					const authUrl = await buildAuthUrl(ctx, state);
					if (!authUrl) {
						return { ok: false, error: "NOT_CONFIGURED" };
					}
					return { ok: true, authUrl };
				},
			},

			"oauth/callback": {
				public: true,
				methods: ["GET"],
				response: "raw",
				handler: async (ctx) => {
					const parsed = z
						.object({ code: z.string().optional(), state: z.string().optional(), error: z.string().optional() })
						.safeParse(ctx.input);

					const redirectTo = (message?: string, ok?: boolean) =>
						pluginResponse({
							status: 302,
							headers: {
								Location: message
									? `${ADMIN_TABLES_PAGE}?oauth=${ok ? "success" : "error"}&message=${encodeURIComponent(message)}`
									: `${ADMIN_TABLES_PAGE}?oauth=success`,
							},
							body: { kind: "text", value: "" },
						});

					if (!parsed.success) return redirectTo("Invalid response from Google");
					if (parsed.data.error) return redirectTo(parsed.data.error);

					const { code, state } = parsed.data;
					if (!code || !state) return redirectTo("Missing authorization code");

					const validState = await consumeOAuthState(ctx, state);
					if (!validState) {
						return redirectTo("This connection link expired or was already used. Try connecting again.");
					}

					const result = await exchangeCodeForRefreshToken(ctx, code);
					if ("error" in result) return redirectTo(result.error);

					await ctx.settings.set("googleRefreshToken", result.refreshToken);
					const email = await fetchConnectedEmail(ctx, result.accessToken);
					if (email) await ctx.settings.set("googleConnectedEmail", email);

					return redirectTo(undefined, true);
				},
			},

			"oauth/disconnect": {
				methods: ["POST"],
				handler: async (ctx) => {
					await disconnectGoogle(ctx);
					return { ok: true };
				},
			},

			"sheets/list": {
				handler: async (ctx) => {
					const accessToken = await getAccessToken(ctx);
					if (!accessToken) return { ok: false, error: "NOT_CONNECTED" };
					try {
						const items = await listSpreadsheets(ctx, accessToken);
						return { ok: true, items };
					} catch (error) {
						return { ok: false, error: "REQUEST_FAILED", message: error instanceof Error ? error.message : String(error) };
					}
				},
			},

			// Tab list for a public (link-shared) sheet, so the admin can offer a tab picker without a
			// connected Google account. Input: `sheetUrl` (a share link or bare spreadsheet ID).
			"sheets/public-tabs": {
				handler: async (ctx) => {
					const parsed = z.object({ sheetUrl: z.string().min(1) }).safeParse(ctx.input);
					if (!parsed.success) return { ok: false, error: "INVALID_SHEET_URL" };

					let sheetId: string;
					try {
						sheetId = parseSheetUrl(parsed.data.sheetUrl).sheetId;
					} catch (error) {
						return { ok: false, error: "INVALID_SHEET_URL", message: error instanceof Error ? error.message : String(error) };
					}
					try {
						return { ok: true, items: await fetchPublicSheetTabs(ctx, sheetId) };
					} catch (error) {
						return { ok: false, error: "REQUEST_FAILED", message: error instanceof Error ? error.message : String(error) };
					}
				},
			},

			"sheets/tabs": {
				handler: async (ctx) => {
					const parsed = z.object({ spreadsheetId: z.string().min(1) }).safeParse(ctx.input);
					if (!parsed.success) return { ok: false, error: "INVALID_SPREADSHEET_ID" };

					const accessToken = await getAccessToken(ctx);
					if (!accessToken) return { ok: false, error: "NOT_CONNECTED" };
					try {
						const items = await listSheetTabs(ctx, accessToken, parsed.data.spreadsheetId);
						return { ok: true, items };
					} catch (error) {
						return { ok: false, error: "REQUEST_FAILED", message: error instanceof Error ? error.message : String(error) };
					}
				},
			},
		},
	});
}

/** A readable one-line version of the first validation problem, for showing in the admin form. */
function firstIssue(error: z.ZodError): string {
	const issue = error.issues[0];
	if (!issue) return "Invalid input";
	const [field, index, subfield] = issue.path;
	if (field === "tabs" && typeof index === "number") {
		return `Tab ${index + 1}${subfield === "name" ? " name" : subfield === "tableId" ? " table" : ""}: ${issue.message}`;
	}
	return field ? `${String(field)}: ${issue.message}` : issue.message;
}

/** Returns an error message naming the first tab whose table doesn't exist, or null if all do. */
async function findMissingTable(ctx: PluginContext, tabs: { name: string; tableId: string }[]): Promise<string | null> {
	for (const [index, tab] of tabs.entries()) {
		if (!(await ctx.storage.tables.get(tab.tableId))) {
			return `Tab ${index + 1} ("${tab.name}") points to a table that no longer exists. Pick another table.`;
		}
	}
	return null;
}

async function deleteAllTabGroups(ctx: PluginContext): Promise<void> {
	let cursor: string | undefined;
	do {
		const page = await ctx.storage.tabGroups.query({ limit: 100, cursor });
		if (page.items.length === 0) break;
		await ctx.storage.tabGroups.deleteMany(page.items.map((item) => item.id));
		cursor = page.cursor;
	} while (cursor);
}

async function deleteAllTables(ctx: PluginContext): Promise<void> {
	let cursor: string | undefined;
	do {
		const page = await ctx.storage.tables.query({ limit: 100, cursor });
		if (page.items.length === 0) break;
		await ctx.storage.tables.deleteMany(page.items.map((item) => item.id));
		for (const item of page.items) {
			await ctx.kv.delete(snapshotKey(item.id));
		}
		cursor = page.cursor;
	} while (cursor);
}

export default createPlugin;
