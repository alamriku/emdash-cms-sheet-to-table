import type { ThemeColors } from "./themes.js";

/**
 * How wide a table (or tab group) may grow. "content" stays inside the page's content column; "wide"
 * breaks out of it up to `maxWidth` pixels; "full" spans the viewport. Both break-outs stay centered on
 * the content column, never get narrower than it, and keep a 1rem gap from the screen edges.
 */
export type TableWidth = "content" | "wide" | "full";

/** Default cap, in pixels, for the "wide" table width. */
export const DEFAULT_MAX_WIDTH = 1200;

export type ExportFormat = "csv" | "excel" | "pdf" | "json" | "print" | "copy";
export const EXPORT_FORMATS: ExportFormat[] = ["csv", "excel", "pdf", "json", "print", "copy"];

export type PaginationStyle = "default" | "modern" | "minimal" | "tailwind" | "outlined";
export const PAGINATION_STYLES: PaginationStyle[] = ["default", "modern", "minimal", "tailwind", "outlined"];

/** Built-in theme ids (see themes.ts), or "custom:<id>" for a theme made in the theme builder. */
export type ThemeId = string;

/** A saved table configuration, stored in the `tables` storage collection. */
export interface TableRecord {
	name: string;
	/** "public" reads the sheet's public CSV export; "oauth" reads it via the Sheets API using the connected Google account. */
	source: "public" | "oauth";
	sheetUrl: string;
	sheetId: string;
	gid: string;
	/** Tab name, required and used for addressing when source is "oauth". */
	sheetTitle: string;
	hasHeaderRow: boolean;
	showTitle: boolean;
	description: string;
	theme: ThemeId;
	/** Per-table color tweaks on top of the theme. Only hex colors; missing keys keep the theme's color. */
	themeColors: Partial<ThemeColors>;
	/** Copy cell colors, font weight/style/size/family and alignment from the sheet. */
	importStyles: boolean;
	responsiveStyle: "default" | "collapsible" | "scrollable";
	/** Missing on tables saved before this setting existed; read it as "content". */
	tableWidth: TableWidth;
	/** Pixel cap used when tableWidth is "wide". */
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
	exportButtons: ExportFormat[];
	paginationStyle: PaginationStyle;
	paginationPosition: "center" | "right";
	/** Active page button color; "" uses the theme's accent. */
	paginationColor: string;
	/** Keep the header visible while the table body scrolls inside a box `tableHeight` pixels tall. */
	freezeHeader: boolean;
	tableHeight: number;
	/** Let visitors drag the table sideways with the mouse. */
	horizontalDrag: boolean;
	/** How many columns stay pinned at the left / right edge while scrolling sideways. */
	freezeColumnsLeft: number;
	freezeColumnsRight: number;
	/** Sheet column indexes (0-based) hidden on wide screens / on phones. */
	hiddenColumnsDesktop: number[];
	hiddenColumnsMobile: number[];
	/** Data row indexes (0-based, header excluded) never sent to visitors. */
	hiddenRows: number[];
	/** "row:column" data cell positions whose value is blanked before it reaches visitors. */
	hiddenCells: string[];
	/** Column sorted when the page loads, or -1 to keep the sheet's order. */
	defaultSortColumn: number;
	defaultSortDirection: "asc" | "desc";
	/** CSS added to the page wherever this table is shown. */
	customCss: string;
	createdAt: string;
	updatedAt: string;
}

/** A merged range. Row -1 is the header row; data rows count from 0. */
export interface CellMerge {
	row: number;
	col: number;
	rowSpan: number;
	colSpan: number;
}

/**
 * Formatting read from the sheet. Each cell holds an index into `palette` (0 = no formatting,
 * n = palette[n - 1]); every palette entry is a CSS declaration list built from validated values.
 * Rows missing at the end, or cells missing at the end of a row, have no formatting.
 */
export interface SheetFormat {
	palette: string[];
	header: number[];
	rows: number[][];
	merges: CellMerge[];
}

/** The synced snapshot of a sheet's data, cached in KV under `cache:table:<id>`. */
export interface TableSnapshot {
	headers: string[];
	/** Capped at MAX_TABLE_ROWS (see sync.ts) so a huge sheet can't blow up memory client-side. */
	rows: string[][];
	/** The sheet's real row count, before any capping. Compare to `rows.length` to tell if it was truncated. */
	totalRowCount: number;
	syncedAt: string;
	/** Which sheet/tab these rows came from (see `sourceKeyFor`). Guards against showing old rows after the table is pointed at a different sheet. */
	sourceKey?: string;
	/** Present when the table imports styles or merged cells. */
	format?: SheetFormat;
	/** Why the formatting couldn't be read. The values still synced. */
	formatError?: string;
	error?: string;
}

export const DEFAULT_TABLE: Omit<TableRecord, "createdAt" | "updatedAt"> = {
	name: "Untitled table",
	source: "public",
	sheetUrl: "",
	sheetId: "",
	gid: "0",
	sheetTitle: "",
	hasHeaderRow: true,
	showTitle: true,
	description: "",
	theme: "auto",
	themeColors: {},
	importStyles: false,
	responsiveStyle: "default",
	tableWidth: "content",
	maxWidth: DEFAULT_MAX_WIDTH,
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
	exportButtons: [],
	paginationStyle: "default",
	paginationPosition: "right",
	paginationColor: "",
	freezeHeader: false,
	tableHeight: 480,
	horizontalDrag: false,
	freezeColumnsLeft: 0,
	freezeColumnsRight: 0,
	hiddenColumnsDesktop: [],
	hiddenColumnsMobile: [],
	hiddenRows: [],
	hiddenCells: [],
	defaultSortColumn: -1,
	defaultSortDirection: "asc",
	customCss: "",
};

/** Data a plugin route or the public frontend needs to render one table. Built by toRenderPayload(). */
export interface TableRenderPayload {
	id: string;
	name: string;
	showTitle: boolean;
	description: string;
	/** Resolved theme: classes and CSS variables (see resolveTheme in themes.ts). */
	themeClass: string;
	themeStyle: string;
	responsiveStyle: TableRecord["responsiveStyle"];
	tableWidth: TableWidth;
	maxWidth: number;
	rowsPerPage: number;
	showInfoBlock: boolean;
	allowSorting: boolean;
	showSearch: boolean;
	asyncLoading: boolean;
	linksAsLinks: boolean;
	linksOpenInNewTab: boolean;
	imagesAsImages: boolean;
	/** False when the sheet has no header row; headers are then all "" and no header row is drawn. */
	hasHeader: boolean;
	/** Columns hidden on both screen sizes, hidden rows and hidden cells are already removed. */
	headers: string[];
	rows: string[][];
	/** Real row count of the sheet minus hidden rows; larger than rows.length when the sheet was cut off. */
	totalRowCount: number;
	syncedAt: string | null;
	/** Payload column indexes hidden on wide screens / on phones. */
	hideDesktop: number[];
	hideMobile: number[];
	format: SheetFormat | null;
	exportButtons: ExportFormat[];
	paginationStyle: PaginationStyle;
	paginationPosition: "center" | "right";
	paginationColor: string;
	freezeHeader: boolean;
	tableHeight: number;
	horizontalDrag: boolean;
	freezeLeft: number;
	freezeRight: number;
	/** Payload column index and direction to sort by on load, or null. */
	defaultSort: { column: number; direction: "asc" | "desc" } | null;
	customCss: string;
	error?: string;
}

/** The cheap `metaOnly` render response: display settings only, no sheet data or sync. */
export interface TableRenderMeta {
	id: string;
	asyncLoading: boolean;
}

/** One tab in a tab group: a label shown on the tab button, and the table it opens. */
export interface TabGroupTab {
	name: string;
	tableId: string;
}

/** Several tables shown in one block, switched between with tabs. Stored in the `tabGroups` collection. */
export interface TabGroupRecord {
	name: string;
	/** Show the group's name as a heading above the tabs. */
	showName: boolean;
	/** Whether the tab buttons sit above ("before") or below ("after") the table. */
	tabPosition: "before" | "after";
	/** Width of the whole group. Tables inside a group fill it and ignore their own width setting. Missing on older groups; read it as "content". */
	tableWidth: TableWidth;
	maxWidth: number;
	tabs: TabGroupTab[];
	createdAt: string;
	updatedAt: string;
}

/** What the public frontend needs to draw a tab group. Tabs whose table was deleted are left out. */
export interface TabGroupRenderPayload {
	id: string;
	name: string;
	showName: boolean;
	tabPosition: TabGroupRecord["tabPosition"];
	tableWidth: TableWidth;
	maxWidth: number;
	tabs: TabGroupTab[];
}
