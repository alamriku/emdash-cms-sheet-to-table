import type { PluginContext } from "emdash/plugin";

import { getAccessToken } from "./oauth.js";
import { type PublicSheetTab, csvExportUrl, htmlviewUrl, parseCsv, parseHtmlviewTabs } from "./sheets.js";
import { fetchSheetValues } from "./sheets-api.js";
import type { TableRecord, TableSnapshot } from "./types.js";

export function snapshotKey(tableId: string): string {
	return `cache:table:${tableId}`;
}

/** Identifies the sheet/tab a snapshot's rows were read from. */
export function sourceKeyFor(table: TableRecord): string {
	return `${table.source}:${table.sheetId}:${table.gid}:${table.sheetTitle}`;
}

/**
 * Hard ceiling on how many data rows a snapshot keeps, regardless of sheet size. Without this, a
 * huge sheet gets synced in full, cached in full, and shipped to every visitor's browser in full —
 * risking an out-of-memory tab on the client and a multi-megabyte page load for everyone else. Rows
 * beyond this cap are dropped; `TableSnapshot.totalRowCount` still records the real count so the UI
 * can tell visitors some rows aren't shown, instead of silently hiding them.
 */
export const MAX_TABLE_ROWS = 10_000;

/**
 * Refreshes a table's cached data from its source (public CSV export or, when
 * connected, the Sheets API) and writes the result to `ctx.kv`. Used by both
 * the recurring cron sweep (which skips tables whose cache hasn't expired)
 * and the "Sync now" admin action (which always forces a refresh).
 */
export async function syncTable(
	ctx: PluginContext,
	tableId: string,
	table: TableRecord,
	options: { force?: boolean } = {},
): Promise<TableSnapshot> {
	if (!options.force) {
		const existing = await ctx.kv.get<TableSnapshot>(snapshotKey(tableId));
		if (existing && existing.sourceKey === sourceKeyFor(table) && !isStale(existing, table.cacheDurationDays)) {
			return existing;
		}
	}

	if (!ctx.http) {
		throw new Error("Network capability not granted");
	}

	let snapshot: TableSnapshot;
	try {
		const allRows =
			table.source === "oauth" ? await fetchViaOAuth(ctx, table) : await fetchViaPublicCsv(ctx, table);

		const headers = table.hasHeaderRow ? (allRows[0] ?? []) : [];
		const allDataRows = table.hasHeaderRow ? allRows.slice(1) : allRows;

		snapshot = {
			headers,
			rows: allDataRows.slice(0, MAX_TABLE_ROWS),
			totalRowCount: allDataRows.length,
			syncedAt: new Date().toISOString(),
			sourceKey: sourceKeyFor(table),
		};
	} catch (error) {
		const message = error instanceof Error ? error.message : "Sync failed";
		const cached = await ctx.kv.get<TableSnapshot>(snapshotKey(tableId));
		// Keep serving the last good rows through a temporary failure, but only if they came from
		// this same sheet — after the URL changes, the old sheet's rows would be the wrong data.
		const previous = cached?.sourceKey === sourceKeyFor(table) ? cached : null;
		snapshot = {
			sourceKey: sourceKeyFor(table),
			headers: previous?.headers ?? [],
			rows: previous?.rows ?? [],
			totalRowCount: previous?.totalRowCount ?? previous?.rows.length ?? 0,
			syncedAt: previous?.syncedAt ?? new Date().toISOString(),
			error: message,
		};
	}

	await ctx.kv.set(snapshotKey(tableId), snapshot);
	return snapshot;
}

async function fetchViaPublicCsv(ctx: PluginContext, table: TableRecord): Promise<string[][]> {
	if (!ctx.http) throw new Error("Network capability not granted");

	const url = csvExportUrl(table.sheetId, table.gid);
	const controller = new AbortController();
	const timeoutMs = Math.max(1, table.responseTimeoutSeconds) * 1000;
	const timer = setTimeout(() => controller.abort(), timeoutMs);
	try {
		const response = await ctx.http.fetch(url, { signal: controller.signal });
		if (response.status === 401 || response.status === 403 || response.status === 404) {
			throw new Error(
				`This sheet is private or doesn't exist (Google returned ${response.status}). Share it as "Anyone with the link can view", or connect a Google account and pick it from the list.`,
			);
		}
		if (!response.ok) {
			throw new Error(`Google Sheets returned ${response.status}. Try "Sync now" again in a moment.`);
		}
		const text = await response.text();
		return parseCsv(text);
	} finally {
		clearTimeout(timer);
	}
}

/**
 * Lists the tabs of a link-shared sheet without a Google account, by reading the sheet's htmlview
 * page. Throws a readable error when the sheet is private, missing, or the list can't be read.
 */
export async function fetchPublicSheetTabs(ctx: PluginContext, sheetId: string): Promise<PublicSheetTab[]> {
	if (!ctx.http) throw new Error("Network capability not granted");

	const privateMessage =
		'This sheet is private or doesn\'t exist. Share it as "Anyone with the link can view", or connect a Google account and pick it from the list.';
	const controller = new AbortController();
	const timer = setTimeout(() => controller.abort(), 15_000);
	let response: Response;
	try {
		response = await ctx.http.fetch(htmlviewUrl(sheetId), { signal: controller.signal });
	} catch (error) {
		// A private sheet redirects to Google's sign-in host, which this plugin isn't allowed to reach.
		if (error instanceof Error && /not allowed|host/i.test(error.message)) throw new Error(privateMessage);
		throw error;
	} finally {
		clearTimeout(timer);
	}
	if (response.status === 401 || response.status === 403 || response.status === 404) throw new Error(privateMessage);
	if (!response.ok) throw new Error(`Google Sheets returned ${response.status}. Try again in a moment.`);

	const tabs = parseHtmlviewTabs(await response.text());
	if (tabs.length === 0) throw new Error(privateMessage);
	return tabs;
}

async function fetchViaOAuth(ctx: PluginContext, table: TableRecord): Promise<string[][]> {
	const accessToken = await getAccessToken(ctx);
	if (!accessToken) {
		throw new Error("Google account is not connected. Reconnect it in Sheet Table settings.");
	}
	if (!table.sheetTitle) {
		throw new Error("This table has no sheet tab selected.");
	}
	return fetchSheetValues(ctx, accessToken, table.sheetId, table.sheetTitle);
}

function isStale(snapshot: TableSnapshot, cacheDurationDays: number): boolean {
	if (snapshot.error) return true;
	const ageMs = Date.now() - new Date(snapshot.syncedAt).getTime();
	const maxAgeMs = Math.max(0, cacheDurationDays) * 24 * 60 * 60 * 1000;
	return ageMs > maxAgeMs;
}
