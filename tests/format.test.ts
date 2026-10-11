import { describe, expect, it } from "vitest";

import { toRenderPayload } from "../src/lib/payload.js";
import { alignFormat, parseApiGridFormat, parseHtmlviewFormat, styleToCss } from "../src/lib/sheet-format.js";
import { resolveTheme } from "../src/lib/themes.js";
import type { TableSnapshot } from "../src/lib/types.js";

const HTMLVIEW = `
<style>.ritz .waffle .s0{background-color:#ffffff;text-align:left;font-weight:bold;color:#000000;}
.ritz .waffle .s1{background-color:#fce5cd;color:#cc0000;font-size:14pt;text-align:center;}</style>
<table><thead><tr><th class="row-header"></th><th id="0C0"></th></tr></thead><tbody>
<tr><th id="0R0" class="row-headers-background"><div>1</div></th><td class="s0">Name</td><td class="s0">Score</td><td class="s0">Note</td></tr>
<tr><th style="height:3px;" class="freezebar-cell"></th><td class="freezebar-cell"></td></tr>
<tr><th id="0R1"><div>2</div></th><td class="s1" rowspan="2">Ann</td><td class="s0">1</td><td class="s0" >x</td></tr>
<tr><th id="0R2"><div>3</div></th><td class="s0" colspan="2">wide</td></tr>
<tr><th id="0R3"><div>4</div></th><td class="s0">Bob</td><td class="s1">3</td><td class="s0">z</td></tr>
</tbody></table>`;

describe("parseHtmlviewFormat", () => {
	const raw = parseHtmlviewFormat(HTMLVIEW);

	it("turns style classes into a palette, leaving out Sheets' defaults", () => {
		expect(raw.palette).toEqual([
			"font-weight:700",
			"background-color:#fce5cd;color:#cc0000;font-size:1.4em;text-align:center",
		]);
	});

	it("places cells by sheet row and column, skipping cells covered by a rowspan", () => {
		expect(raw.grid[0]).toEqual([1, 1, 1]);
		expect(raw.grid[1]).toEqual([2, 1, 1]);
		// Column 0 is covered by "Ann", so "wide" starts at column 1.
		expect(raw.grid[2]).toEqual([0, 1, 1]);
		expect(raw.grid[3]).toEqual([1, 2, 1]);
	});

	it("reads merged ranges", () => {
		expect(raw.merges).toEqual([
			{ row: 1, col: 0, rowSpan: 2, colSpan: 1 },
			{ row: 2, col: 1, rowSpan: 1, colSpan: 2 },
		]);
	});

	it("lines formatting up with the synced rows, dropping skipped rows from merges", () => {
		const format = alignFormat(raw, 0, [1, 3]);
		expect(format.header).toEqual([1, 1, 1]);
		expect(format.rows).toEqual([
			[2, 1, 1],
			[1, 2, 1],
		]);
		// The rowspan lost its second row, and the colspan's row was skipped entirely.
		expect(format.merges).toEqual([]);
	});
});

describe("parseApiGridFormat", () => {
	it("reads effective formats and merges", () => {
		const raw = parseApiGridFormat({
			sheets: [
				{
					merges: [{ startRowIndex: 0, endRowIndex: 1, startColumnIndex: 0, endColumnIndex: 2 }],
					data: [
						{
							rowData: [
								{
									values: [
										{ effectiveFormat: { backgroundColor: { red: 1, green: 1, blue: 1 }, textFormat: { bold: true, fontFamily: "Arial", fontSize: 10 } } },
										{ effectiveFormat: { backgroundColor: { red: 1 }, horizontalAlignment: "RIGHT", textFormat: { italic: true } } },
									],
								},
							],
						},
					],
				},
			],
		});
		expect(raw.palette).toEqual(["font-weight:700", "background-color:#ff0000;font-style:italic;text-align:right"]);
		expect(raw.grid[0]).toEqual([1, 2]);
		expect(raw.merges).toEqual([{ row: 0, col: 0, rowSpan: 1, colSpan: 2 }]);
	});
});

describe("styleToCss", () => {
	it("drops unsafe font names and colors", () => {
		expect(styleToCss({ fontFamily: 'x";}body{color:red', color: "red" })).toBe('font-family:"xbodycolorred",ui-sans-serif,system-ui,sans-serif');
	});
});

describe("resolveTheme", () => {
	it("puts a built-in theme's palette inline", () => {
		const theme = resolveTheme("dark-knight", { accent: "#ff0000" });
		expect(theme.className).toContain("ft-stripes--rows");
		expect(theme.style).toContain("--ft-bg:#2b2c3d");
		expect(theme.style).toContain("--ft-accent:#ff0000");
	});

	it("keeps auto's colors in the stylesheet and falls back to auto for a missing custom theme", () => {
		expect(resolveTheme("auto", {}).style).toBe("");
		expect(resolveTheme("custom:gone", {}).className).toContain("emdash-sheet-table--auto");
	});

	it("ignores colors that aren't hex", () => {
		expect(resolveTheme("auto", { accent: "red;background:url(x)" }).style).toBe("");
	});
});

describe("toRenderPayload", () => {
	const snapshot: TableSnapshot = {
		headers: ["A", "B", "C"],
		rows: [
			["1", "x", "secret"],
			["2", "y", "z"],
			["3", "w", "v"],
		],
		totalRowCount: 3,
		syncedAt: "2026-01-01T00:00:00.000Z",
		format: {
			palette: ["font-weight:700"],
			header: [1, 1, 1],
			rows: [[0, 1, 1]],
			merges: [{ row: 0, col: 0, rowSpan: 3, colSpan: 1 }],
		},
	};

	it("removes hidden rows, cells and fully hidden columns before they reach visitors", () => {
		const payload = toRenderPayload("t", {
			hiddenRows: [1],
			hiddenCells: ["0:2"],
			hiddenColumnsDesktop: [1],
			hiddenColumnsMobile: [1, 2],
			importStyles: true,
			mergeCells: true,
			defaultSortColumn: 2,
		}, snapshot);
		expect(payload.headers).toEqual(["A", "C"]);
		expect(payload.rows).toEqual([
			["1", ""],
			["3", "v"],
		]);
		expect(payload.hideMobile).toEqual([1]);
		expect(payload.hideDesktop).toEqual([]);
		expect(payload.format?.rows[0]).toEqual([0, 0]);
		expect(payload.format?.merges).toEqual([{ row: 0, col: 0, rowSpan: 2, colSpan: 1 }]);
		expect(payload.defaultSort).toEqual({ column: 1, direction: "asc" });
		expect(payload.totalRowCount).toBe(2);
	});

	it("leaves out styles and merges that are turned off", () => {
		const payload = toRenderPayload("t", {}, snapshot);
		expect(payload.format?.palette).toEqual([]);
		expect(payload.format?.merges).toEqual([]);
	});
});
