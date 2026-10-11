/**
 * Reads cell formatting (colors, fonts, alignment) and merged ranges from a Google Sheet.
 *
 * Public sheets: Google's htmlview page renders the tab as an HTML table whose cells carry style
 * classes (`.ritz .waffle .s3{background-color:#fce5cd;...}`) and real rowspan/colspan attributes.
 * Connected-account sheets: the Sheets API's grid data has each cell's effective format and the
 * tab's merges. Both are turned into the same shape: a grid of palette indexes and a merge list in
 * sheet coordinates, which alignFormat() then lines up with the synced rows.
 */

import type { CellMerge, SheetFormat } from "./types.js";

/** One cell's formatting, before it's turned into CSS. Default values (white, black, Arial 10) are left out. */
export interface CellStyle {
	background?: string;
	color?: string;
	bold?: boolean;
	italic?: boolean;
	underline?: boolean;
	strike?: boolean;
	fontFamily?: string;
	/** Points. Sheets' default is 10. */
	fontSize?: number;
	align?: "center" | "right";
}

/** Formatting in sheet coordinates: `grid[sheetRow][sheetColumn]` is a palette index (0 = none). */
export interface RawSheetFormat {
	palette: string[];
	grid: number[][];
	merges: CellMerge[];
}

const HEX = /^#[0-9a-f]{6}$/i;
const DEFAULT_BACKGROUND = "#ffffff";
const DEFAULT_COLOR = "#000000";
const DEFAULT_FONT = "arial";
const DEFAULT_FONT_SIZE = 10;

/** CSS for a cell style. Every value is validated, so the result is safe for a style attribute. */
export function styleToCss(style: CellStyle): string {
	const parts: string[] = [];
	if (style.background && HEX.test(style.background)) parts.push(`background-color:${style.background}`);
	if (style.color && HEX.test(style.color)) parts.push(`color:${style.color}`);
	if (style.bold) parts.push("font-weight:700");
	if (style.italic) parts.push("font-style:italic");
	const decorations = [style.underline && "underline", style.strike && "line-through"].filter(Boolean);
	if (decorations.length) parts.push(`text-decoration:${decorations.join(" ")}`);
	if (style.fontFamily) {
		const family = style.fontFamily.replace(/[^a-zA-Z0-9 _-]/g, "").trim();
		// `inherit` isn't allowed inside a font list, so the fallback is a generic family.
		if (family && family.toLowerCase() !== DEFAULT_FONT) parts.push(`font-family:"${family}",ui-sans-serif,system-ui,sans-serif`);
	}
	if (style.fontSize && style.fontSize > 0 && style.fontSize !== DEFAULT_FONT_SIZE) {
		// Relative to the table's own font size, so a theme or site font size still scales everything.
		parts.push(`font-size:${Math.round((style.fontSize / DEFAULT_FONT_SIZE) * 100) / 100}em`);
	}
	if (style.align) parts.push(`text-align:${style.align}`);
	return parts.join(";");
}

class Palette {
	readonly entries: string[] = [];
	private readonly index = new Map<string, number>();

	/** Palette index for a style; 0 when the style has no formatting at all. */
	add(style: CellStyle): number {
		const css = styleToCss(style);
		if (!css) return 0;
		let found = this.index.get(css);
		if (found === undefined) {
			this.entries.push(css);
			found = this.entries.length;
			this.index.set(css, found);
		}
		return found;
	}
}

function normalizeHex(value: string): string | undefined {
	const v = value.trim().toLowerCase();
	if (/^#[0-9a-f]{6}$/.test(v)) return v;
	if (/^#[0-9a-f]{3}$/.test(v)) return `#${v[1]}${v[1]}${v[2]}${v[2]}${v[3]}${v[3]}`;
	const rgb = v.match(/^rgba?\((\d+),\s*(\d+),\s*(\d+)/);
	if (rgb) return `#${rgb.slice(1, 4).map((n) => Math.min(255, Number(n)).toString(16).padStart(2, "0")).join("")}`;
	return undefined;
}

/** Turns one htmlview style class body (`background-color:#fff;font-weight:bold;...`) into a CellStyle. */
export function parseHtmlviewDeclarations(body: string): CellStyle {
	const style: CellStyle = {};
	for (const declaration of body.split(";")) {
		const colon = declaration.indexOf(":");
		if (colon < 0) continue;
		const property = declaration.slice(0, colon).trim().toLowerCase();
		const value = declaration.slice(colon + 1).trim();
		switch (property) {
			case "background-color": {
				const hex = normalizeHex(value);
				if (hex && hex !== DEFAULT_BACKGROUND) style.background = hex;
				break;
			}
			case "color": {
				const hex = normalizeHex(value);
				if (hex && hex !== DEFAULT_COLOR) style.color = hex;
				break;
			}
			case "font-weight":
				if (value === "bold" || Number(value) >= 600) style.bold = true;
				break;
			case "font-style":
				if (value === "italic") style.italic = true;
				break;
			case "text-decoration":
				if (value.includes("underline")) style.underline = true;
				if (value.includes("line-through")) style.strike = true;
				break;
			case "font-family":
				style.fontFamily = value.split(",")[0]?.replace(/["']/g, "").trim();
				break;
			case "font-size": {
				const pt = value.match(/^([\d.]+)pt$/);
				if (pt) style.fontSize = Number(pt[1]);
				break;
			}
			case "text-align":
				if (value === "center" || value === "right") style.align = value;
				break;
		}
	}
	return style;
}

const STYLE_CLASS_PATTERN = /\.ritz \.waffle \.(s\d+)\s*\{([^}]*)\}/g;
const ROW_PATTERN = /<tr[^>]*>([\s\S]*?)<\/tr>/g;
const ROW_ID_PATTERN = /<th[^>]*\bid="\d+R(\d+)"/;
const CELL_PATTERN = /<td\b([^>]*)>/g;

function attribute(attributes: string, name: string): string | undefined {
	return attributes.match(new RegExp(`\\b${name}="([^"]*)"`))?.[1];
}

/**
 * Reads formatting and merges from a sheet's htmlview page
 * (`/spreadsheets/d/<id>/htmlview/sheet?headers=false&gid=<gid>`).
 */
export function parseHtmlviewFormat(html: string): RawSheetFormat {
	const classStyles = new Map<string, CellStyle>();
	for (const [, name = "", body = ""] of html.matchAll(STYLE_CLASS_PATTERN)) {
		classStyles.set(name, parseHtmlviewDeclarations(body));
	}

	const palette = new Palette();
	const grid: number[][] = [];
	const merges: CellMerge[] = [];
	// Columns still covered by a rowspan from an earlier row: column -> last covered sheet row.
	const coveredUntil = new Map<number, number>();

	for (const [, rowHtml = ""] of html.matchAll(ROW_PATTERN)) {
		const rowId = rowHtml.match(ROW_ID_PATTERN);
		if (!rowId) continue; // header shim and freeze-bar rows have no row id
		const row = Number(rowId[1]);
		const cells: number[] = [];
		let col = 0;
		for (const [, attributes = ""] of rowHtml.matchAll(CELL_PATTERN)) {
			while ((coveredUntil.get(col) ?? -1) >= row) col++;
			const className = attribute(attributes, "class") ?? "";
			const styleClass = className.split(/\s+/).find((name) => /^s\d+$/.test(name));
			const index = styleClass ? palette.add(classStyles.get(styleClass) ?? {}) : 0;
			const rowSpan = Math.max(1, Number(attribute(attributes, "rowspan") ?? 1) || 1);
			const colSpan = Math.max(1, Number(attribute(attributes, "colspan") ?? 1) || 1);
			for (let c = col; c < col + colSpan; c++) {
				cells[c] = index;
				if (rowSpan > 1) coveredUntil.set(c, row + rowSpan - 1);
			}
			if (rowSpan > 1 || colSpan > 1) merges.push({ row, col, rowSpan, colSpan });
			col += colSpan;
		}
		grid[row] = trimTrailingZeros(cells);
	}

	return { palette: palette.entries, grid, merges };
}

interface ApiColor {
	red?: number;
	green?: number;
	blue?: number;
}

interface ApiCellFormat {
	backgroundColor?: ApiColor;
	horizontalAlignment?: string;
	textFormat?: {
		foregroundColor?: ApiColor;
		fontFamily?: string;
		fontSize?: number;
		bold?: boolean;
		italic?: boolean;
		underline?: boolean;
		strikethrough?: boolean;
	};
}

export interface ApiGridData {
	sheets?: Array<{
		merges?: Array<{ startRowIndex?: number; endRowIndex?: number; startColumnIndex?: number; endColumnIndex?: number }>;
		data?: Array<{
			startRow?: number;
			startColumn?: number;
			rowData?: Array<{ values?: Array<{ effectiveFormat?: ApiCellFormat }> }>;
		}>;
	}>;
}

function apiColorToHex(color: ApiColor | undefined): string | undefined {
	if (!color) return undefined;
	// The API leaves out components that are 0.
	const channel = (value: number | undefined) =>
		Math.round(Math.min(1, Math.max(0, value ?? 0)) * 255)
			.toString(16)
			.padStart(2, "0");
	return `#${channel(color.red)}${channel(color.green)}${channel(color.blue)}`;
}

/** Reads formatting and merges from a Sheets API `spreadsheets.get` response with grid data. */
export function parseApiGridFormat(data: ApiGridData): RawSheetFormat {
	const palette = new Palette();
	const grid: number[][] = [];
	const sheet = data.sheets?.[0];

	for (const block of sheet?.data ?? []) {
		const startRow = block.startRow ?? 0;
		const startColumn = block.startColumn ?? 0;
		(block.rowData ?? []).forEach((rowData, rowOffset) => {
			const cells: number[] = [];
			(rowData.values ?? []).forEach((value, colOffset) => {
				const format = value.effectiveFormat;
				if (!format) return;
				const text = format.textFormat ?? {};
				const background = apiColorToHex(format.backgroundColor);
				const color = apiColorToHex(text.foregroundColor);
				const align = format.horizontalAlignment?.toLowerCase();
				cells[startColumn + colOffset] = palette.add({
					background: background === DEFAULT_BACKGROUND ? undefined : background,
					color: color === DEFAULT_COLOR ? undefined : color,
					bold: text.bold,
					italic: text.italic,
					underline: text.underline,
					strike: text.strikethrough,
					fontFamily: text.fontFamily,
					fontSize: text.fontSize,
					align: align === "center" || align === "right" ? align : undefined,
				});
			});
			grid[startRow + rowOffset] = trimTrailingZeros(Array.from(cells, (cell) => cell ?? 0));
		});
	}

	const merges: CellMerge[] = (sheet?.merges ?? []).map((merge) => {
		const row = merge.startRowIndex ?? 0;
		const col = merge.startColumnIndex ?? 0;
		return {
			row,
			col,
			rowSpan: Math.max(1, (merge.endRowIndex ?? row + 1) - row),
			colSpan: Math.max(1, (merge.endColumnIndex ?? col + 1) - col),
		};
	});

	return { palette: palette.entries, grid, merges };
}

function trimTrailingZeros(cells: number[]): number[] {
	const filled = Array.from(cells, (cell) => cell ?? 0);
	let end = filled.length;
	while (end > 0 && filled[end - 1] === 0) end--;
	return filled.slice(0, end);
}

/**
 * Re-maps a merged range onto a subset of rows and columns. The maps take each remaining original
 * index to its new position (a null column map keeps columns as they are). A range keeps the part of itself that survives; it's dropped when
 * its top-left cell is gone or it no longer spans more than one cell.
 */
export function remapMerge(merge: CellMerge, rowPosition: Map<number, number>, colPosition: Map<number, number> | null): CellMerge | null {
	const row = rowPosition.get(merge.row);
	const col = colPosition ? colPosition.get(merge.col) : merge.col;
	if (row === undefined || col === undefined) return null;
	let rowSpan = 0;
	for (let r = merge.row; r < merge.row + merge.rowSpan; r++) if (rowPosition.has(r)) rowSpan++;
	let colSpan = merge.colSpan;
	if (colPosition) {
		colSpan = 0;
		for (let c = merge.col; c < merge.col + merge.colSpan; c++) if (colPosition.has(c)) colSpan++;
	}
	if (rowSpan * colSpan <= 1) return null;
	return { row, col, rowSpan, colSpan };
}

/**
 * Lines sheet-coordinate formatting up with the synced table. `headerRow` is the sheet row used as the
 * header (or null) and `dataRows` the sheet row of each data row, in order. Merges that start in the
 * header stay within it (row -1).
 */
export function alignFormat(raw: RawSheetFormat, headerRow: number | null, dataRows: number[]): SheetFormat {
	// Data merges never reach up into the header, so the header row isn't in this map.
	const dataPosition = new Map<number, number>();
	dataRows.forEach((sheetRow, index) => dataPosition.set(sheetRow, index));

	const merges: CellMerge[] = [];
	for (const merge of raw.merges) {
		if (headerRow !== null && merge.row === headerRow) {
			if (merge.colSpan > 1) merges.push({ row: -1, col: merge.col, rowSpan: 1, colSpan: merge.colSpan });
			continue;
		}
		const mapped = remapMerge(merge, dataPosition, null);
		if (mapped) merges.push(mapped);
	}

	return {
		palette: raw.palette,
		header: headerRow !== null ? (raw.grid[headerRow] ?? []) : [],
		rows: trimTrailingEmptyRows(dataRows.map((sheetRow) => raw.grid[sheetRow] ?? [])),
		merges,
	};
}

function trimTrailingEmptyRows(rows: number[][]): number[][] {
	let end = rows.length;
	while (end > 0 && (rows[end - 1]?.length ?? 0) === 0) end--;
	return rows.slice(0, end);
}

/** Google's single-tab HTML view of a public sheet; it carries the cell styles and merges. */
export function htmlviewSheetUrl(sheetId: string, gid: string): string {
	return `https://docs.google.com/spreadsheets/d/${encodeURIComponent(sheetId)}/htmlview/sheet?headers=false&gid=${encodeURIComponent(gid)}`;
}
