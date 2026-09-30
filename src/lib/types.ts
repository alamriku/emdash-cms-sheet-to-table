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
	theme: "simple" | "simple-dark" | "auto";
	responsiveStyle: "default" | "collapsible" | "scrollable";
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
	createdAt: string;
	updatedAt: string;
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
	responsiveStyle: "default",
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

/** Data a plugin route or the public frontend needs to render one table. */
export interface TableRenderPayload {
	id: string;
	name: string;
	showTitle: boolean;
	description: string;
	theme: TableRecord["theme"];
	responsiveStyle: TableRecord["responsiveStyle"];
	rowsPerPage: number;
	showInfoBlock: boolean;
	allowSorting: boolean;
	showSearch: boolean;
	asyncLoading: boolean;
	linksAsLinks: boolean;
	linksOpenInNewTab: boolean;
	imagesAsImages: boolean;
	headers: string[];
	rows: string[][];
	totalRowCount: number;
	syncedAt: string | null;
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
	tabs: TabGroupTab[];
}
