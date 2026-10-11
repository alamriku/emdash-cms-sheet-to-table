import { remapMerge } from "./sheet-format.js";
import { type ThemeDefinition, isHexColor, resolveTheme } from "./themes.js";
import {
	type CellMerge,
	DEFAULT_MAX_WIDTH,
	DEFAULT_TABLE,
	type SheetFormat,
	type TableRecord,
	type TableRenderPayload,
	type TableSnapshot,
} from "./types.js";

/** Fills in settings that tables saved by older versions don't have yet. */
export function withTableDefaults<T extends Partial<TableRecord>>(table: T): Omit<TableRecord, "createdAt" | "updatedAt"> & T {
	return { ...DEFAULT_TABLE, ...table };
}

/** Stops custom CSS from closing the <style> element it's printed in. */
export function safeCss(css: string): string {
	return css.replace(/<\/(style)/gi, "<\\/$1");
}

/**
 * Builds what visitors receive for one table: the synced rows with hidden rows, cells and columns
 * already taken out (so they never reach the browser), plus resolved theme and display settings.
 * Shared by the public render route and the admin's live preview.
 */
export function toRenderPayload(
	id: string,
	storedTable: Partial<TableRecord>,
	snapshot: TableSnapshot | null,
	customThemes: Record<string, ThemeDefinition> = {},
): TableRenderPayload {
	const table = withTableDefaults(storedTable);
	const sourceHeaders = snapshot?.headers ?? [];
	const sourceRows = snapshot?.rows ?? [];
	const width = Math.max(sourceHeaders.length, ...sourceRows.slice(0, 200).map((row) => row.length), 0);

	// Columns hidden on both screen sizes are removed outright; the rest are hidden with CSS.
	const desktop = new Set(table.hiddenColumnsDesktop);
	const mobile = new Set(table.hiddenColumnsMobile);
	const keptCols: number[] = [];
	for (let c = 0; c < width; c++) if (!(desktop.has(c) && mobile.has(c))) keptCols.push(c);
	const colPosition = new Map(keptCols.map((col, index) => [col, index]));

	const hiddenRows = new Set(table.hiddenRows);
	const hiddenCells = new Set(table.hiddenCells);
	const keptRows: number[] = [];
	sourceRows.forEach((_, index) => {
		if (!hiddenRows.has(index)) keptRows.push(index);
	});
	const rowPosition = new Map(keptRows.map((row, index) => [row, index]));

	const hasHeader = table.hasHeaderRow && sourceHeaders.length > 0;
	const headers = keptCols.map((col) => (hasHeader ? (sourceHeaders[col] ?? "") : ""));
	const rows = keptRows.map((r) => keptCols.map((c) => (hiddenCells.has(`${r}:${c}`) ? "" : (sourceRows[r]?.[c] ?? ""))));

	let format: SheetFormat | null = null;
	if (snapshot?.format) {
		const source = snapshot.format;
		const pick = (cells: number[] | undefined, r: number | null) =>
			keptCols.map((c) => (r !== null && hiddenCells.has(`${r}:${c}`) ? 0 : (cells?.[c] ?? 0)));
		const merges: CellMerge[] = [];
		if (table.mergeCells) {
			for (const merge of source.merges) {
				const mapped =
					merge.row === -1
						? remapMerge({ ...merge, row: 0 }, new Map([[0, 0]]), colPosition)
						: remapMerge(merge, rowPosition, colPosition);
				if (mapped) merges.push(merge.row === -1 ? { ...mapped, row: -1 } : mapped);
			}
		}
		format = {
			palette: table.importStyles ? source.palette : [],
			header: table.importStyles ? pick(source.header, null) : [],
			rows: table.importStyles ? keptRows.map((r) => pick(source.rows[r], r)) : [],
			merges,
		};
	}

	const theme = resolveTheme(table.theme, table.themeColors, customThemes);
	const freezeLeft = Math.min(Math.max(0, table.freezeColumnsLeft), keptCols.length);
	const sortPosition = table.defaultSortColumn >= 0 ? colPosition.get(table.defaultSortColumn) : undefined;

	return {
		id,
		name: table.name,
		showTitle: table.showTitle,
		description: table.description,
		themeClass: theme.className,
		themeStyle: theme.style,
		responsiveStyle: table.responsiveStyle,
		tableWidth: table.tableWidth ?? "content",
		maxWidth: table.maxWidth ?? DEFAULT_MAX_WIDTH,
		rowsPerPage: table.rowsPerPage,
		showInfoBlock: table.showInfoBlock,
		allowSorting: table.allowSorting && hasHeader,
		showSearch: table.showSearch,
		asyncLoading: table.asyncLoading,
		linksAsLinks: table.linksAsLinks,
		linksOpenInNewTab: table.linksOpenInNewTab,
		imagesAsImages: table.imagesAsImages,
		hasHeader,
		headers,
		rows,
		totalRowCount: Math.max(rows.length, (snapshot?.totalRowCount ?? sourceRows.length) - (sourceRows.length - rows.length)),
		syncedAt: snapshot?.syncedAt ?? null,
		hideDesktop: keptCols.flatMap((col, index) => (desktop.has(col) ? [index] : [])),
		hideMobile: keptCols.flatMap((col, index) => (mobile.has(col) ? [index] : [])),
		format,
		exportButtons: table.exportButtons,
		paginationStyle: table.paginationStyle,
		paginationPosition: table.paginationPosition,
		paginationColor: isHexColor(table.paginationColor) ? table.paginationColor : "",
		freezeHeader: table.freezeHeader,
		tableHeight: table.tableHeight,
		horizontalDrag: table.horizontalDrag,
		freezeLeft,
		freezeRight: Math.min(Math.max(0, table.freezeColumnsRight), keptCols.length - freezeLeft),
		defaultSort: sortPosition !== undefined ? { column: sortPosition, direction: table.defaultSortDirection } : null,
		customCss: safeCss(table.customCss ?? ""),
		error: snapshot?.error,
	};
}
