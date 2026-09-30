import { describe, expect, it } from "vitest";

import { csvExportUrl, parseCsv, parseHtmlviewTabs, parseSheetUrl, sheetUrlForTab } from "../src/lib/sheets.js";

describe("parseSheetUrl", () => {
	it("extracts the ID and gid from a full edit URL with a hash fragment", () => {
		expect(parseSheetUrl("https://docs.google.com/spreadsheets/d/1AbC-XyZ_123/edit#gid=456")).toEqual({
			sheetId: "1AbC-XyZ_123",
			gid: "456",
		});
	});

	it("extracts the ID and gid from a URL with gid as a query param", () => {
		expect(parseSheetUrl("https://docs.google.com/spreadsheets/d/1AbC-XyZ_123/edit?usp=sharing&gid=789")).toEqual({
			sheetId: "1AbC-XyZ_123",
			gid: "789",
		});
	});

	it("defaults gid to 0 when absent", () => {
		expect(parseSheetUrl("https://docs.google.com/spreadsheets/d/1AbC-XyZ_123/edit")).toEqual({
			sheetId: "1AbC-XyZ_123",
			gid: "0",
		});
	});

	it("accepts a bare spreadsheet ID with no URL", () => {
		expect(parseSheetUrl("1AbC-XyZ_1234567890ABCDEF")).toEqual({
			sheetId: "1AbC-XyZ_1234567890ABCDEF",
			gid: "0",
		});
	});

	it("trims surrounding whitespace", () => {
		expect(parseSheetUrl("  https://docs.google.com/spreadsheets/d/1AbC-XyZ/edit#gid=5  ")).toEqual({
			sheetId: "1AbC-XyZ",
			gid: "5",
		});
	});

	it("rejects a URL with no discoverable spreadsheet ID", () => {
		expect(() => parseSheetUrl("https://example.com/not-a-sheet")).toThrow();
	});

	it("rejects an empty string", () => {
		expect(() => parseSheetUrl("")).toThrow();
	});

	it("rejects a short, non-URL string that isn't a plausible bare ID", () => {
		expect(() => parseSheetUrl("hello")).toThrow();
	});
});

describe("csvExportUrl", () => {
	it("builds Google's public CSV export URL", () => {
		expect(csvExportUrl("abc123", "456")).toBe(
			"https://docs.google.com/spreadsheets/d/abc123/export?format=csv&id=abc123&gid=456",
		);
	});

	it("URL-encodes the sheet ID and gid", () => {
		expect(csvExportUrl("a b", "c&d")).toBe(
			"https://docs.google.com/spreadsheets/d/a%20b/export?format=csv&id=a%20b&gid=c%26d",
		);
	});
});

describe("parseCsv", () => {
	it("parses a simple comma-separated grid", () => {
		expect(parseCsv("a,b,c\n1,2,3\n")).toEqual([
			["a", "b", "c"],
			["1", "2", "3"],
		]);
	});

	it("handles quoted fields containing commas", () => {
		expect(parseCsv('name,note\n"Doe, Jane","Hello, world"\n')).toEqual([
			["name", "note"],
			["Doe, Jane", "Hello, world"],
		]);
	});

	it("handles doubled-quote escaping inside a quoted field", () => {
		expect(parseCsv('a\n"She said ""hi"""\n')).toEqual([["a"], ['She said "hi"']]);
	});

	it("handles embedded newlines inside a quoted field", () => {
		expect(parseCsv('a,b\n"line one\nline two",value\n')).toEqual([
			["a", "b"],
			["line one\nline two", "value"],
		]);
	});

	it("handles CRLF line endings", () => {
		expect(parseCsv("a,b\r\n1,2\r\n")).toEqual([
			["a", "b"],
			["1", "2"],
		]);
	});

	it("drops fully blank rows", () => {
		expect(parseCsv("a,b\n1,2\n\n\n3,4\n")).toEqual([
			["a", "b"],
			["1", "2"],
			["3", "4"],
		]);
	});

	it("returns an empty array for empty input", () => {
		expect(parseCsv("")).toEqual([]);
	});
});

describe("parseHtmlviewTabs", () => {
	// Trimmed from a real htmlview response for a link-shared sheet with two tabs.
	const html = `<script>
		items.push({name: "Products", pageUrl: "https:\\/\\/docs.google.com\\/spreadsheets\\/d\\/abc\\/htmlview\\/sheet?headers\\x3dtrue&gid=1070239384", gid: "1070239384",initialSheet: ("1070239384" == gid)});
		items.push({name: "Sheet1", pageUrl: "https:\\/\\/docs.google.com\\/spreadsheets\\/d\\/abc\\/htmlview\\/sheet?headers\\x3dtrue&gid=2054732339", gid: "2054732339",initialSheet: ("2054732339" == gid)});
	</script>`;

	it("lists every tab's name and gid in sheet order", () => {
		expect(parseHtmlviewTabs(html)).toEqual([
			{ gid: "1070239384", title: "Products" },
			{ gid: "2054732339", title: "Sheet1" },
		]);
	});

	it("decodes escaped characters in tab names", () => {
		const escaped = `items.push({name: "SP1 \\x2d June \\u00e9 \\"Q2\\"", pageUrl: "x", gid: "5"});`;
		expect(parseHtmlviewTabs(escaped)).toEqual([{ gid: "5", title: 'SP1 - June é "Q2"' }]);
	});

	it("returns an empty list when the page has no tab list", () => {
		expect(parseHtmlviewTabs("<html><title>Sign in</title></html>")).toEqual([]);
	});
});

describe("sheetUrlForTab", () => {
	it("builds a link whose gid parseSheetUrl reads back", () => {
		expect(parseSheetUrl(sheetUrlForTab("1AbC-XyZ_123", "2054732339"))).toEqual({
			sheetId: "1AbC-XyZ_123",
			gid: "2054732339",
		});
	});
});
