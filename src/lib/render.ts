/**
 * Draws a table from its render payload. The same code makes the server-rendered first paint
 * (renderTableHtml, a plain string) and runs in the browser (mountTable), where it adds search,
 * sorting, pagination, export buttons, frozen columns and drag-to-scroll. The admin's live preview
 * uses mountTable too, so what the editor shows is what visitors get.
 *
 * Nothing here touches the DOM at import time, so it's safe to import during server rendering.
 */

import type { CellMerge, ExportFormat, TableRenderPayload } from "./types.js";

export interface ViewState {
	query: string;
	sortColumn: number;
	sortDirection: "asc" | "desc" | null;
	page: number;
}

const IMAGE_PATTERN = /\.(png|jpe?g|gif|webp|avif|svg)(\?.*)?$/i;
const URL_PATTERN = /^https?:\/\/\S+$/i;

export const EXPORT_LABELS: Record<ExportFormat, string> = {
	csv: "CSV",
	excel: "Excel",
	pdf: "PDF",
	json: "JSON",
	print: "Print",
	copy: "Copy",
};

export function escapeHtml(value: string): string {
	return value
		.replace(/&/g, "&amp;")
		.replace(/</g, "&lt;")
		.replace(/>/g, "&gt;")
		.replace(/"/g, "&quot;")
		.replace(/'/g, "&#39;");
}

export function initialState(payload: TableRenderPayload): ViewState {
	return {
		query: "",
		sortColumn: payload.defaultSort?.column ?? -1,
		sortDirection: payload.defaultSort?.direction ?? null,
		page: 0,
	};
}

/** Strips thousands separators, currency signs and % so "1,200" and "$15" sort as numbers. */
function numericValue(value: string): number {
	const cleaned = value.replace(/[\s,$€£¥₹%]/g, "");
	return cleaned === "" ? Number.NaN : Number(cleaned);
}

/** Row indexes (into payload.rows) after search and sorting, in display order. */
export function visibleRows(payload: TableRenderPayload, state: ViewState): number[] {
	let indexes = payload.rows.map((_, index) => index);
	if (state.query) {
		const query = state.query.toLowerCase();
		indexes = indexes.filter((index) => payload.rows[index]?.some((cell) => cell.toLowerCase().includes(query)));
	}
	if (state.sortColumn >= 0 && state.sortDirection) {
		const column = state.sortColumn;
		const direction = state.sortDirection === "asc" ? 1 : -1;
		indexes.sort((a, b) => {
			const av = payload.rows[a]?.[column] ?? "";
			const bv = payload.rows[b]?.[column] ?? "";
			const an = numericValue(av);
			const bn = numericValue(bv);
			if (!Number.isNaN(an) && !Number.isNaN(bn)) return (an - bn) * direction;
			return av.localeCompare(bv, undefined, { numeric: true, sensitivity: "base" }) * direction;
		});
	}
	return indexes;
}

/** Classes and inline style for the table's outer element. */
export function containerAttributes(payload: TableRenderPayload): { className: string; style: string } {
	const classes = [
		"emdash-sheet-table",
		payload.themeClass,
		`emdash-sheet-table--${payload.responsiveStyle}`,
		`emdash-sheet-width--${payload.tableWidth ?? "content"}`,
		`ft-pg--${payload.paginationStyle}`,
		`ft-pg-pos--${payload.paginationPosition}`,
	];
	if (payload.freezeHeader) classes.push("ft-freeze-header");
	if (payload.horizontalDrag) classes.push("ft-draggable");
	if (payload.freezeLeft || payload.freezeRight) classes.push("ft-has-frozen");

	const style = [payload.themeStyle];
	if (payload.tableWidth === "wide" && payload.maxWidth) style.push(`--ft-max-width:${payload.maxWidth}px`);
	if (payload.paginationColor) style.push(`--ft-page-active:${payload.paginationColor}`);
	if (payload.freezeHeader) style.push(`--ft-table-height:${Math.max(150, payload.tableHeight)}px`);
	return { className: classes.filter(Boolean).join(" "), style: style.filter(Boolean).join(";") };
}

function cellContent(payload: TableRenderPayload, value: string): string {
	if (payload.imagesAsImages && URL_PATTERN.test(value) && IMAGE_PATTERN.test(value)) {
		return `<img src="${escapeHtml(value)}" loading="lazy" alt="">`;
	}
	if (payload.linksAsLinks && URL_PATTERN.test(value)) {
		const target = payload.linksOpenInNewTab ? ' target="_blank" rel="noopener noreferrer"' : "";
		return `<a href="${escapeHtml(value)}"${target}>${escapeHtml(value)}</a>`;
	}
	return escapeHtml(value);
}

/** Shared per-column classes: responsive hiding and frozen edges. */
function columnClasses(payload: TableRenderPayload): string[] {
	const count = payload.headers.length;
	const hideDesktop = new Set(payload.hideDesktop);
	const hideMobile = new Set(payload.hideMobile);
	return payload.headers.map((_, col) => {
		const classes: string[] = [];
		if (hideDesktop.has(col)) classes.push("ft-hd");
		if (hideMobile.has(col)) classes.push("ft-hm");
		if (col < payload.freezeLeft) classes.push("ft-fl");
		if (col >= count - payload.freezeRight) classes.push("ft-fr");
		if (col === payload.freezeLeft - 1) classes.push("ft-fl-edge");
		if (payload.freezeRight && col === count - payload.freezeRight) classes.push("ft-fr-edge");
		return classes.join(" ");
	});
}

function cellStyle(payload: TableRenderPayload, styleIndex: number | undefined): string {
	if (!styleIndex || !payload.format) return "";
	const css = payload.format.palette[styleIndex - 1];
	return css ? ` style="${escapeHtml(css)}"` : "";
}

function cellAttrs(classes: string, extra: string): string {
	return `${classes ? ` class="${classes}"` : ""}${extra}`;
}

function mergesIn(payload: TableRenderPayload, header: boolean): CellMerge[] {
	return (payload.format?.merges ?? []).filter((merge) => (merge.row === -1) === header);
}

export function renderHeadRow(payload: TableRenderPayload, state: ViewState): string {
	if (!payload.hasHeader) return "";
	const classes = columnClasses(payload);
	const covered = new Set<number>();
	const spans = new Map<number, number>();
	for (const merge of mergesIn(payload, true)) {
		spans.set(merge.col, merge.colSpan);
		for (let c = merge.col + 1; c < merge.col + merge.colSpan; c++) covered.add(c);
	}
	const cells = payload.headers.map((header, col) => {
		if (covered.has(col)) return "";
		const span = spans.get(col);
		let extra = ` data-c="${col}"${span ? ` colspan="${span}"` : ""}${cellStyle(payload, payload.format?.header[col])}`;
		if (payload.allowSorting) {
			const sort = state.sortColumn === col && state.sortDirection ? state.sortDirection : "";
			const ariaSort = sort === "asc" ? "ascending" : sort === "desc" ? "descending" : "none";
			extra += ` data-sortable="true" tabindex="0" aria-sort="${ariaSort}"${sort ? ` data-sort="${sort}"` : ""}`;
		}
		return `<th scope="col"${cellAttrs(classes[col] ?? "", extra)}>${escapeHtml(header)}</th>`;
	});
	return `<tr>${cells.join("")}</tr>`;
}

export function renderBody(payload: TableRenderPayload, state: ViewState, order: number[]): string {
	const classes = columnClasses(payload);
	const perPage = Math.max(1, payload.rowsPerPage);
	const start = state.page * perPage;
	const pageRows = order.slice(start, start + perPage);

	// Merged cells only line up with the sheet when rows are in the sheet's order and unfiltered.
	const naturalOrder = !state.query && !(state.sortColumn >= 0 && state.sortDirection);
	const anchors = new Map<string, { rowSpan: number; colSpan: number }>();
	const covered = new Set<string>();
	if (naturalOrder) {
		const end = start + pageRows.length;
		for (const merge of mergesIn(payload, false)) {
			if (merge.row < start || merge.row >= end) continue;
			const rowSpan = Math.min(merge.rowSpan, end - merge.row);
			anchors.set(`${merge.row}:${merge.col}`, { rowSpan, colSpan: merge.colSpan });
			for (let r = merge.row; r < merge.row + rowSpan; r++) {
				for (let c = merge.col; c < merge.col + merge.colSpan; c++) {
					if (r !== merge.row || c !== merge.col) covered.add(`${r}:${c}`);
				}
			}
		}
	}

	const html: string[] = [];
	for (const rowIndex of pageRows) {
		const row = payload.rows[rowIndex] ?? [];
		const styles = payload.format?.rows[rowIndex];
		let tr = "<tr>";
		payload.headers.forEach((header, col) => {
			const key = `${rowIndex}:${col}`;
			if (covered.has(key)) return;
			const span = anchors.get(key);
			const spanAttrs = span
				? `${span.rowSpan > 1 ? ` rowspan="${span.rowSpan}"` : ""}${span.colSpan > 1 ? ` colspan="${span.colSpan}"` : ""}`
				: "";
			const label = payload.hasHeader ? ` data-label="${escapeHtml(header)}"` : "";
			const extra = ` data-c="${col}"${label}${spanAttrs}${cellStyle(payload, styles?.[col])}`;
			tr += `<td${cellAttrs(classes[col] ?? "", extra)}>${cellContent(payload, row[col] ?? "")}</td>`;
		});
		html.push(`${tr}</tr>`);
	}
	if (pageRows.length === 0) {
		html.push(
			`<tr class="ft-empty"><td colspan="${Math.max(1, payload.headers.length)}">${state.query ? "No matching entries" : "No data"}</td></tr>`,
		);
	}
	return html.join("");
}

/** Page numbers to show, with null for a "…" gap: 1 … 4 5 6 … 20. */
export function pageList(current: number, count: number): (number | null)[] {
	if (count <= 7) return Array.from({ length: count }, (_, i) => i);
	const pages = new Set([0, count - 1, current - 1, current, current + 1]);
	if (current <= 2) [1, 2, 3].forEach((p) => pages.add(p));
	if (current >= count - 3) [count - 4, count - 3, count - 2].forEach((p) => pages.add(p));
	const sorted = [...pages].filter((p) => p >= 0 && p < count).sort((a, b) => a - b);
	const result: (number | null)[] = [];
	sorted.forEach((page, index) => {
		if (index > 0 && page - (sorted[index - 1] ?? 0) > 1) result.push(null);
		result.push(page);
	});
	return result;
}

export function renderFooter(payload: TableRenderPayload, state: ViewState, total: number): string {
	const perPage = Math.max(1, payload.rowsPerPage);
	const pageCount = Math.max(1, Math.ceil(total / perPage));
	if (!payload.showInfoBlock && pageCount <= 1) return "";

	const parts: string[] = [];
	if (payload.showInfoBlock) {
		const from = total === 0 ? 0 : state.page * perPage + 1;
		const to = Math.min((state.page + 1) * perPage, total);
		const filtered = total < payload.rows.length ? ` (filtered from ${payload.rows.length} total entries)` : "";
		parts.push(`<span class="emdash-sheet-table__info">Showing ${from} to ${to} of ${total} entries${filtered}</span>`);
	}
	if (pageCount > 1) {
		const button = (page: number, label: string, ariaLabel: string, disabled: boolean, current = false) =>
			`<button type="button" class="ft-page${current ? " is-active" : ""}" data-page="${page}" aria-label="${ariaLabel}"${
				current ? ' aria-current="page"' : ""
			}${disabled ? " disabled" : ""}>${label}</button>`;
		const nav: string[] = [];
		if (payload.paginationStyle === "default") {
			nav.push(button(state.page - 1, "Previous", "Previous page", state.page === 0));
			nav.push(`<span class="ft-page-label">Page ${state.page + 1} of ${pageCount}</span>`);
			nav.push(button(state.page + 1, "Next", "Next page", state.page >= pageCount - 1));
		} else {
			nav.push(button(state.page - 1, "‹", "Previous page", state.page === 0));
			for (const page of pageList(state.page, pageCount)) {
				nav.push(
					page === null
						? '<span class="ft-page-gap" aria-hidden="true">…</span>'
						: button(page, String(page + 1), `Page ${page + 1}`, false, page === state.page),
				);
			}
			nav.push(button(state.page + 1, "›", "Next page", state.page >= pageCount - 1));
		}
		parts.push(`<nav class="emdash-sheet-table__pages" aria-label="Table pages">${nav.join("")}</nav>`);
	}
	return `<div class="emdash-sheet-table__pagination">${parts.join("")}</div>`;
}

/** Everything inside the table's outer element, for the given view state. */
export function renderTableHtml(payload: TableRenderPayload, state: ViewState = initialState(payload)): string {
	const out: string[] = [];
	if (payload.customCss.trim()) out.push(`<style>${payload.customCss}</style>`);

	if (payload.error && payload.rows.length === 0) {
		out.push(`<p class="emdash-sheet-table__error">Could not load table: ${escapeHtml(payload.error)}</p>`);
		return out.join("");
	}

	if (payload.showTitle) out.push(`<h3 class="emdash-sheet-table__title">${escapeHtml(payload.name)}</h3>`);
	if (payload.description) out.push(`<p class="emdash-sheet-table__description">${escapeHtml(payload.description)}</p>`);
	if (payload.totalRowCount > payload.rows.length) {
		out.push(
			`<p class="emdash-sheet-table__notice">This sheet has ${payload.totalRowCount.toLocaleString()} rows. Showing the first ${payload.rows.length.toLocaleString()}, the rest can't be displayed here.</p>`,
		);
	}

	if (payload.showSearch || payload.exportButtons.length) {
		const exports = payload.exportButtons
			.map((format) => `<button type="button" class="ft-export" data-export="${format}">${EXPORT_LABELS[format]}</button>`)
			.join("");
		out.push(
			`<div class="emdash-sheet-table__toolbar">${exports ? `<div class="emdash-sheet-table__exports" role="group" aria-label="Export table">${exports}</div>` : ""}${
				payload.showSearch
					? `<input type="search" class="emdash-sheet-table__search" placeholder="Search…" aria-label="Search table" value="${escapeHtml(state.query)}">`
					: ""
			}</div>`,
		);
	}

	const order = visibleRows(payload, state);
	out.push(
		`<div class="emdash-sheet-table__scroll"><table><thead>${renderHeadRow(payload, state)}</thead><tbody>${renderBody(payload, state, order)}</tbody></table></div>`,
	);
	out.push(`<div class="emdash-sheet-table__footer">${renderFooter(payload, state, order.length)}</div>`);
	return out.join("");
}

const MOBILE_QUERY = "(max-width: 640px)";

/** Draws the table into `container` and makes it interactive. Safe to call again with a new payload. */
export function mountTable(container: HTMLElement, payload: TableRenderPayload): void {
	const attributes = containerAttributes(payload);
	// Keep classes that aren't the table's own (e.g. added by a theme or page builder).
	const keep = Array.from(container.classList).filter(
		(name) => !name.startsWith("emdash-sheet-") && !name.startsWith("ft-"),
	);
	container.className = [...keep, attributes.className].join(" ");
	container.setAttribute("style", attributes.style);

	const state = initialState(payload);
	container.innerHTML = renderTableHtml(payload, state);

	const thead = container.querySelector("thead");
	const tbody = container.querySelector("tbody");
	const footer = container.querySelector<HTMLElement>(".emdash-sheet-table__footer");
	const scroll = container.querySelector<HTMLElement>(".emdash-sheet-table__scroll");
	if (!tbody || !footer || !scroll) return;

	let order = visibleRows(payload, state);

	function update(resort: boolean) {
		if (resort) order = visibleRows(payload, state);
		const pageCount = Math.max(1, Math.ceil(order.length / Math.max(1, payload.rowsPerPage)));
		state.page = Math.min(Math.max(0, state.page), pageCount - 1);
		if (thead) thead.innerHTML = renderHeadRow(payload, state);
		tbody!.innerHTML = renderBody(payload, state, order);
		footer!.innerHTML = renderFooter(payload, state, order.length);
		positionFrozenColumns(container, payload);
	}

	const search = container.querySelector<HTMLInputElement>(".emdash-sheet-table__search");
	search?.addEventListener("input", () => {
		state.query = search.value.trim();
		state.page = 0;
		update(true);
	});

	function toggleSort(th: HTMLElement) {
		const col = Number(th.dataset.c);
		if (state.sortColumn === col) {
			state.sortDirection = state.sortDirection === "asc" ? "desc" : state.sortDirection === "desc" ? null : "asc";
		} else {
			state.sortColumn = col;
			state.sortDirection = "asc";
		}
		state.page = 0;
		update(true);
	}

	container.addEventListener("click", (event) => {
		const target = event.target as HTMLElement;
		const th = target.closest<HTMLElement>("th[data-sortable]");
		if (th && container.contains(th)) {
			toggleSort(th);
			return;
		}
		const pageButton = target.closest<HTMLButtonElement>("button[data-page]");
		if (pageButton && !pageButton.disabled) {
			state.page = Number(pageButton.dataset.page);
			update(false);
			return;
		}
		const exportButton = target.closest<HTMLButtonElement>("button[data-export]");
		if (exportButton) void runExport(exportButton, payload, order);
	});

	container.addEventListener("keydown", (event) => {
		const th = (event.target as HTMLElement).closest<HTMLElement>("th[data-sortable]");
		if (th && (event.key === "Enter" || event.key === " ")) {
			event.preventDefault();
			toggleSort(th);
			// The header row was redrawn; put focus back on the same column.
			container.querySelector<HTMLElement>(`thead th[data-c="${th.dataset.c}"]`)?.focus();
		}
	});

	if (payload.horizontalDrag) enableDragScroll(scroll);
	if (payload.freezeLeft || payload.freezeRight) {
		positionFrozenColumns(container, payload);
		if (typeof ResizeObserver !== "undefined") {
			new ResizeObserver(() => positionFrozenColumns(container, payload)).observe(scroll);
		}
		// Images change column widths once they load.
		container.addEventListener("load", () => positionFrozenColumns(container, payload), true);
	}
}

/**
 * Pins the first/last columns with position: sticky. Sticky cells need their exact offset from the
 * edge, which depends on the widths of the pinned columns before them, so it's measured after each draw.
 */
function positionFrozenColumns(container: HTMLElement, payload: TableRenderPayload) {
	if (!payload.freezeLeft && !payload.freezeRight) return;
	const table = container.querySelector("table");
	if (!table) return;
	const count = payload.headers.length;
	const widths = new Array<number>(count).fill(0);
	const measured = new Array<boolean>(count).fill(false);
	for (const row of Array.from(table.rows)) {
		for (const cell of Array.from(row.cells)) {
			const col = Number(cell.dataset.c);
			if (Number.isNaN(col) || measured[col] || cell.colSpan > 1) continue;
			widths[col] = cell.getBoundingClientRect().width;
			measured[col] = true;
		}
		if (measured.every(Boolean)) break;
	}
	const left: number[] = [];
	let offset = 0;
	for (let col = 0; col < payload.freezeLeft; col++) {
		left[col] = offset;
		offset += widths[col] ?? 0;
	}
	const right: number[] = [];
	offset = 0;
	for (let col = count - 1; col >= count - payload.freezeRight; col--) {
		right[col] = offset;
		offset += widths[col] ?? 0;
	}
	table.querySelectorAll<HTMLElement>(".ft-fl, .ft-fr").forEach((cell) => {
		const col = Number(cell.dataset.c);
		if (cell.classList.contains("ft-fl")) cell.style.left = `${left[col] ?? 0}px`;
		if (cell.classList.contains("ft-fr")) cell.style.right = `${right[col] ?? 0}px`;
	});
}

/** Lets mouse users drag the table sideways. Touch devices already scroll natively. */
function enableDragScroll(scroll: HTMLElement) {
	let startX = 0;
	let startScroll = 0;
	let pointerId: number | null = null;
	let moved = false;

	scroll.addEventListener("pointerdown", (event) => {
		if (event.pointerType !== "mouse" || event.button !== 0) return;
		if ((event.target as HTMLElement).closest("a, button, input, th[data-sortable]")) return;
		pointerId = event.pointerId;
		startX = event.clientX;
		startScroll = scroll.scrollLeft;
		moved = false;
	});
	scroll.addEventListener("pointermove", (event) => {
		if (pointerId !== event.pointerId) return;
		const delta = event.clientX - startX;
		if (!moved && Math.abs(delta) < 4) return;
		if (!moved) {
			moved = true;
			scroll.setPointerCapture(event.pointerId);
			scroll.classList.add("is-dragging");
		}
		scroll.scrollLeft = startScroll - delta;
	});
	const stop = (event: PointerEvent) => {
		if (pointerId !== event.pointerId) return;
		pointerId = null;
		scroll.classList.remove("is-dragging");
		if (scroll.hasPointerCapture(event.pointerId)) scroll.releasePointerCapture(event.pointerId);
	};
	scroll.addEventListener("pointerup", stop);
	scroll.addEventListener("pointercancel", stop);
	// A drag shouldn't also count as a click on whatever was under the pointer.
	scroll.addEventListener(
		"click",
		(event) => {
			if (moved) {
				event.preventDefault();
				event.stopPropagation();
				moved = false;
			}
		},
		true,
	);
}

/** Exports what the visitor currently sees: all pages of the filtered, sorted rows, minus hidden columns. */
async function runExport(button: HTMLButtonElement, payload: TableRenderPayload, order: number[]) {
	const hidden = new Set(window.matchMedia(MOBILE_QUERY).matches ? payload.hideMobile : payload.hideDesktop);
	const columns = payload.headers.map((_, col) => col).filter((col) => !hidden.has(col));
	const data = {
		name: payload.name || "table",
		headers: payload.hasHeader ? columns.map((col) => payload.headers[col] ?? "") : [],
		rows: order.map((index) => columns.map((col) => payload.rows[index]?.[col] ?? "")),
	};
	const format = button.dataset.export as ExportFormat;
	button.disabled = true;
	try {
		// Loaded on first use, so pages that never export never download the export code.
		const { exportTable } = await import("./export.js");
		const result = await exportTable(format, data);
		if (result === "copied") flash(button, "Copied!");
	} catch {
		flash(button, "Failed");
	} finally {
		button.disabled = false;
	}
}

function flash(button: HTMLButtonElement, text: string) {
	const original = button.textContent;
	button.textContent = text;
	window.setTimeout(() => {
		button.textContent = original;
	}, 1500);
}
