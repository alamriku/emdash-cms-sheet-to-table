const SHEET_ID_PATTERN = /\/spreadsheets\/d\/([a-zA-Z0-9-_]+)/;
const GID_PATTERN = /[#&?]gid=(\d+)/;

export interface ParsedSheetUrl {
	sheetId: string;
	gid: string;
}

/**
 * Accepts a full Google Sheets share URL (edit, view, or gviz form) or a
 * bare spreadsheet ID, and extracts the spreadsheet ID and tab (gid).
 * Throws when no spreadsheet ID can be found.
 */
export function parseSheetUrl(input: string): ParsedSheetUrl {
	const trimmed = input.trim();
	const gidMatch = trimmed.match(GID_PATTERN);
	const gid = gidMatch?.[1] ?? "0";

	const idMatch = trimmed.match(SHEET_ID_PATTERN);
	if (idMatch?.[1]) {
		return { sheetId: idMatch[1], gid };
	}

	// Bare ID: no slashes, no spaces, reasonably long.
	if (/^[a-zA-Z0-9-_]{20,}$/.test(trimmed)) {
		return { sheetId: trimmed, gid };
	}

	throw new Error(
		"Could not find a spreadsheet ID in that URL. Paste the full Google Sheets share link.",
	);
}

export interface PublicSheetTab {
	gid: string;
	title: string;
}

/** Google's lightweight read-only view of a sheet. For link-shared sheets it lists every tab. */
export function htmlviewUrl(sheetId: string): string {
	return `https://docs.google.com/spreadsheets/d/${encodeURIComponent(sheetId)}/htmlview`;
}

/** A share link that opens one specific tab; parseSheetUrl() reads the gid back out of it. */
export function sheetUrlForTab(sheetId: string, gid: string): string {
	return `https://docs.google.com/spreadsheets/d/${sheetId}/edit#gid=${gid}`;
}

// The htmlview page builds its tab bar from inline script lines like:
//   items.push({name: "Sheet1", pageUrl: "...", gid: "2054732339", initialSheet: ...});
const HTMLVIEW_TAB_PATTERN = /items\.push\(\{name:\s*"((?:[^"\\]|\\.)*)"[^}]*?gid:\s*"(\d+)"/g;

/**
 * Reads the tab names and gids out of a sheet's htmlview page, in the sheet's own order.
 * Returns an empty list when the page has no tab list (e.g. a sign-in page for a private sheet).
 */
export function parseHtmlviewTabs(html: string): PublicSheetTab[] {
	const tabs: PublicSheetTab[] = [];
	const seen = new Set<string>();
	for (const match of html.matchAll(HTMLVIEW_TAB_PATTERN)) {
		const [, rawName = "", gid = ""] = match;
		if (seen.has(gid)) continue;
		seen.add(gid);
		tabs.push({ gid, title: decodeJsString(rawName) });
	}
	return tabs;
}

/** Undoes JavaScript string escapes (\x3d, é, \", \\, \/) in a tab name. */
function decodeJsString(value: string): string {
	return value.replace(/\\(?:x([0-9a-fA-F]{2})|u([0-9a-fA-F]{4})|(.))/g, (_, hex, unicode, char) => {
		if (hex) return String.fromCharCode(parseInt(hex, 16));
		if (unicode) return String.fromCharCode(parseInt(unicode, 16));
		return char === "n" ? "\n" : char === "t" ? "\t" : char;
	});
}

export function csvExportUrl(sheetId: string, gid: string): string {
	const encodedId = encodeURIComponent(sheetId);
	const encodedGid = encodeURIComponent(gid);
	// Google's public export endpoint — works for any sheet shared as
	// "Anyone with the link can view"; no OAuth or API key required.
	return `https://docs.google.com/spreadsheets/d/${encodedId}/export?format=csv&id=${encodedId}&gid=${encodedGid}`;
}

/**
 * Minimal RFC 4180 CSV parser: handles quoted fields, embedded commas,
 * embedded newlines, and doubled-quote escaping ("" -> ").
 */
export function parseCsv(text: string): string[][] {
	const rows: string[][] = [];
	let row: string[] = [];
	let field = "";
	let inQuotes = false;

	for (let i = 0; i < text.length; i++) {
		const char = text[i];
		const next = text[i + 1];

		if (inQuotes) {
			if (char === '"' && next === '"') {
				field += '"';
				i++;
			} else if (char === '"') {
				inQuotes = false;
			} else {
				field += char;
			}
			continue;
		}

		if (char === '"') {
			inQuotes = true;
		} else if (char === ",") {
			row.push(field);
			field = "";
		} else if (char === "\n") {
			row.push(field);
			rows.push(row);
			row = [];
			field = "";
		} else if (char === "\r") {
			// Skip; paired \n handles the row break.
		} else {
			field += char;
		}
	}

	if (field.length > 0 || row.length > 0) {
		row.push(field);
		rows.push(row);
	}

	return rows.filter((r) => r.some((cell) => cell.trim() !== ""));
}
