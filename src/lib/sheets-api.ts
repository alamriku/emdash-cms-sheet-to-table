import type { PluginContext } from "emdash/plugin";

const DRIVE_FILES_URL = "https://www.googleapis.com/drive/v3/files";
const SHEETS_API_BASE = "https://sheets.googleapis.com/v4/spreadsheets";

export interface DriveSpreadsheet {
	id: string;
	name: string;
}

export interface SheetTab {
	gid: string;
	title: string;
}

async function authedFetch(ctx: PluginContext, accessToken: string, url: string): Promise<Response> {
	if (!ctx.http) throw new Error("Network capability not granted");
	return ctx.http.fetch(url, { headers: { Authorization: `Bearer ${accessToken}` } });
}

export async function listSpreadsheets(ctx: PluginContext, accessToken: string): Promise<DriveSpreadsheet[]> {
	const params = new URLSearchParams({
		q: "mimeType='application/vnd.google-apps.spreadsheet' and trashed=false",
		fields: "files(id,name)",
		orderBy: "modifiedTime desc",
		pageSize: "100",
	});
	const response = await authedFetch(ctx, accessToken, `${DRIVE_FILES_URL}?${params.toString()}`);
	if (!response.ok) {
		throw new Error(`Google Drive returned ${response.status}`);
	}
	const data = (await response.json()) as { files?: Array<{ id: string; name: string }> };
	return data.files ?? [];
}

export async function listSheetTabs(
	ctx: PluginContext,
	accessToken: string,
	spreadsheetId: string,
): Promise<SheetTab[]> {
	const encodedId = encodeURIComponent(spreadsheetId);
	const params = new URLSearchParams({ fields: "sheets.properties" });
	const response = await authedFetch(
		ctx,
		accessToken,
		`${SHEETS_API_BASE}/${encodedId}?${params.toString()}`,
	);
	if (!response.ok) {
		throw new Error(`Google Sheets returned ${response.status}`);
	}
	const data = (await response.json()) as {
		sheets?: Array<{ properties: { sheetId: number; title: string } }>;
	};
	return (data.sheets ?? []).map((sheet) => ({
		gid: String(sheet.properties.sheetId),
		title: sheet.properties.title,
	}));
}

/** Fetches every value in the given tab as rows of strings, ragged rows padded to the widest row. */
export async function fetchSheetValues(
	ctx: PluginContext,
	accessToken: string,
	spreadsheetId: string,
	sheetTitle: string,
): Promise<string[][]> {
	const encodedId = encodeURIComponent(spreadsheetId);
	const encodedRange = encodeURIComponent(sheetTitle);
	const params = new URLSearchParams({ majorDimension: "ROWS", valueRenderOption: "FORMATTED_VALUE" });
	const response = await authedFetch(
		ctx,
		accessToken,
		`${SHEETS_API_BASE}/${encodedId}/values/${encodedRange}?${params.toString()}`,
	);
	if (!response.ok) {
		throw new Error(`Google Sheets returned ${response.status}`);
	}
	const data = (await response.json()) as { values?: unknown[][] };
	const rows = data.values ?? [];
	const width = rows.reduce((max, row) => Math.max(max, row.length), 0);
	return rows.map((row) => {
		const cells = row.map((cell) => (cell == null ? "" : String(cell)));
		while (cells.length < width) cells.push("");
		return cells;
	});
}
