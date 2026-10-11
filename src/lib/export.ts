/**
 * Table export: CSV, Excel (.xlsx), PDF, JSON, print and copy. Browser only, no dependencies; the
 * renderer loads this module with a dynamic import the first time a visitor clicks an export button.
 */

import type { ExportFormat } from "./types.js";

export interface ExportData {
	name: string;
	/** Empty when the table has no header row. */
	headers: string[];
	rows: string[][];
}

export async function exportTable(format: ExportFormat, data: ExportData): Promise<"done" | "copied"> {
	const base = fileBaseName(data.name);
	switch (format) {
		case "csv":
			download(`${base}.csv`, "text/csv;charset=utf-8", `﻿${toDelimited(data, ",")}`);
			break;
		case "json":
			download(`${base}.json`, "application/json", toJson(data));
			break;
		case "excel":
			download(`${base}.xlsx`, "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet", buildXlsx(data));
			break;
		case "pdf":
			download(`${base}.pdf`, "application/pdf", buildPdf(data));
			break;
		case "print":
			printTable(data);
			break;
		case "copy":
			await copyText(toDelimited(data, "\t"));
			return "copied";
	}
	return "done";
}

function fileBaseName(name: string): string {
	return (
		name
			.trim()
			.replace(/[^\p{L}\p{N}]+/gu, "-")
			.replace(/^-+|-+$/g, "")
			.slice(0, 80) || "table"
	);
}

function download(filename: string, type: string, content: string | Uint8Array) {
	const blob = new Blob([content as BlobPart], { type });
	const url = URL.createObjectURL(blob);
	const link = document.createElement("a");
	link.href = url;
	link.download = filename;
	link.style.display = "none";
	document.body.appendChild(link);
	link.click();
	link.remove();
	window.setTimeout(() => URL.revokeObjectURL(url), 10_000);
}

function allRows(data: ExportData): string[][] {
	return data.headers.length ? [data.headers, ...data.rows] : data.rows;
}

export function toDelimited(data: ExportData, separator: "," | "\t"): string {
	const quote = (value: string) =>
		separator === "," && /[",\n\r]/.test(value)
			? `"${value.replace(/"/g, '""')}"`
			: separator === "\t"
				? value.replace(/[\t\r\n]+/g, " ")
				: value;
	return allRows(data)
		.map((row) => row.map(quote).join(separator))
		.join("\r\n");
}

export function toJson(data: ExportData): string {
	if (!data.headers.length) return JSON.stringify(data.rows, null, 2);
	// Repeated or blank header names would overwrite each other as object keys.
	const seen = new Map<string, number>();
	const keys = data.headers.map((header, index) => {
		const base = header.trim() || `Column ${index + 1}`;
		const count = seen.get(base) ?? 0;
		seen.set(base, count + 1);
		return count ? `${base} (${count + 1})` : base;
	});
	const objects = data.rows.map((row) => Object.fromEntries(keys.map((key, index) => [key, row[index] ?? ""])));
	return JSON.stringify(objects, null, 2);
}

async function copyText(text: string) {
	try {
		await navigator.clipboard.writeText(text);
	} catch {
		const area = document.createElement("textarea");
		area.value = text;
		area.style.position = "fixed";
		area.style.opacity = "0";
		document.body.appendChild(area);
		area.select();
		document.execCommand("copy");
		area.remove();
	}
}

function escapeHtml(value: string): string {
	return value.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;").replace(/"/g, "&quot;");
}

/** Prints through a hidden iframe, so no pop-up window is needed. */
function printTable(data: ExportData) {
	const head = data.headers.length ? `<thead><tr>${data.headers.map((h) => `<th>${escapeHtml(h)}</th>`).join("")}</tr></thead>` : "";
	const body = data.rows.map((row) => `<tr>${row.map((cell) => `<td>${escapeHtml(cell)}</td>`).join("")}</tr>`).join("");
	const html = `<!doctype html><html><head><meta charset="utf-8"><title>${escapeHtml(data.name)}</title><style>
		body{font-family:system-ui,-apple-system,"Segoe UI",Roboto,sans-serif;font-size:11px;color:#111;margin:16px}
		h1{font-size:16px;margin:0 0 12px}table{border-collapse:collapse;width:100%}
		th,td{border:1px solid #bbb;padding:4px 6px;text-align:left;vertical-align:top}
		th{background:#f1f3f5}thead{display:table-header-group}tr{break-inside:avoid}
	</style></head><body><h1>${escapeHtml(data.name)}</h1><table>${head}<tbody>${body}</tbody></table></body></html>`;

	const frame = document.createElement("iframe");
	frame.setAttribute("aria-hidden", "true");
	frame.style.cssText = "position:fixed;right:0;bottom:0;width:0;height:0;border:0;visibility:hidden";
	document.body.appendChild(frame);
	const doc = frame.contentDocument;
	if (!doc || !frame.contentWindow) {
		frame.remove();
		return;
	}
	doc.open();
	doc.write(html);
	doc.close();
	frame.contentWindow.focus();
	frame.contentWindow.print();
	window.setTimeout(() => frame.remove(), 60_000);
}

/* ------------------------------------------------------------------ XLSX */

const CRC_TABLE = (() => {
	const table = new Uint32Array(256);
	for (let n = 0; n < 256; n++) {
		let c = n;
		for (let k = 0; k < 8; k++) c = c & 1 ? 0xedb88320 ^ (c >>> 1) : c >>> 1;
		table[n] = c >>> 0;
	}
	return table;
})();

function crc32(bytes: Uint8Array): number {
	let crc = 0xffffffff;
	for (const byte of bytes) crc = (CRC_TABLE[(crc ^ byte) & 0xff] ?? 0) ^ (crc >>> 8);
	return (crc ^ 0xffffffff) >>> 0;
}

/** A zip archive with every file stored uncompressed; that's all an .xlsx needs to open. */
export function zipStore(files: { name: string; content: string }[]): Uint8Array {
	const encoder = new TextEncoder();
	const chunks: Uint8Array[] = [];
	const central: Uint8Array[] = [];
	let offset = 0;

	for (const file of files) {
		const name = encoder.encode(file.name);
		const data = encoder.encode(file.content);
		const crc = crc32(data);

		const local = new DataView(new ArrayBuffer(30));
		local.setUint32(0, 0x04034b50, true);
		local.setUint16(4, 20, true);
		local.setUint16(6, 0x0800, true); // UTF-8 names
		local.setUint16(8, 0, true); // stored
		local.setUint32(14, crc, true);
		local.setUint32(18, data.length, true);
		local.setUint32(22, data.length, true);
		local.setUint16(26, name.length, true);
		chunks.push(new Uint8Array(local.buffer), name, data);

		const entry = new DataView(new ArrayBuffer(46));
		entry.setUint32(0, 0x02014b50, true);
		entry.setUint16(4, 20, true);
		entry.setUint16(6, 20, true);
		entry.setUint16(8, 0x0800, true);
		entry.setUint32(16, crc, true);
		entry.setUint32(20, data.length, true);
		entry.setUint32(24, data.length, true);
		entry.setUint16(28, name.length, true);
		entry.setUint32(42, offset, true);
		central.push(new Uint8Array(entry.buffer), name);

		offset += 30 + name.length + data.length;
	}

	const centralSize = central.reduce((sum, chunk) => sum + chunk.length, 0);
	const end = new DataView(new ArrayBuffer(22));
	end.setUint32(0, 0x06054b50, true);
	end.setUint16(8, files.length, true);
	end.setUint16(10, files.length, true);
	end.setUint32(12, centralSize, true);
	end.setUint32(16, offset, true);

	const parts = [...chunks, ...central, new Uint8Array(end.buffer)];
	const out = new Uint8Array(parts.reduce((sum, part) => sum + part.length, 0));
	let position = 0;
	for (const part of parts) {
		out.set(part, position);
		position += part.length;
	}
	return out;
}

function xmlEscape(value: string): string {
	return value
		// Control characters aren't allowed in XML at all.
		// eslint-disable-next-line no-control-regex
		.replace(/[\u0000-\u0008\u000B\u000C\u000E-\u001F]/g, "")
		.replace(/&/g, "&amp;")
		.replace(/</g, "&lt;")
		.replace(/>/g, "&gt;")
		.replace(/"/g, "&quot;");
}

function columnName(index: number): string {
	let name = "";
	for (let n = index + 1; n > 0; n = Math.floor((n - 1) / 26)) name = String.fromCharCode(65 + ((n - 1) % 26)) + name;
	return name;
}

const PLAIN_NUMBER = /^-?(0|[1-9]\d{0,14})(\.\d+)?$/;

export function buildXlsx(data: ExportData): Uint8Array {
	const rows = allRows(data);
	const sheetRows = rows
		.map((row, r) => {
			const isHeader = r === 0 && data.headers.length > 0;
			const cells = row
				.map((value, c) => {
					const ref = `${columnName(c)}${r + 1}`;
					const style = isHeader ? ' s="1"' : "";
					if (!isHeader && PLAIN_NUMBER.test(value)) return `<c r="${ref}"${style}><v>${value}</v></c>`;
					if (value === "") return "";
					return `<c r="${ref}" t="inlineStr"${style}><is><t xml:space="preserve">${xmlEscape(value)}</t></is></c>`;
				})
				.join("");
			return `<row r="${r + 1}">${cells}</row>`;
		})
		.join("");
	const sheetName = xmlEscape(data.name.replace(/[[\]:*?/\\]/g, " ").trim().slice(0, 31) || "Sheet1");
	const main = "http://schemas.openxmlformats.org/spreadsheetml/2006/main";
	const rel = "http://schemas.openxmlformats.org/officeDocument/2006/relationships";
	const pkg = "http://schemas.openxmlformats.org/package/2006";
	const freeze = data.headers.length
		? '<sheetViews><sheetView workbookViewId="0"><pane ySplit="1" topLeftCell="A2" activePane="bottomLeft" state="frozen"/></sheetView></sheetViews>'
		: "";

	return zipStore([
		{
			name: "[Content_Types].xml",
			content: `<?xml version="1.0" encoding="UTF-8" standalone="yes"?><Types xmlns="${pkg}/content-types"><Default Extension="rels" ContentType="application/vnd.openxmlformats-package.relationships+xml"/><Default Extension="xml" ContentType="application/xml"/><Override PartName="/xl/workbook.xml" ContentType="application/vnd.openxmlformats-officedocument.spreadsheetml.sheet.main+xml"/><Override PartName="/xl/worksheets/sheet1.xml" ContentType="application/vnd.openxmlformats-officedocument.spreadsheetml.worksheet+xml"/><Override PartName="/xl/styles.xml" ContentType="application/vnd.openxmlformats-officedocument.spreadsheetml.styles+xml"/></Types>`,
		},
		{
			name: "_rels/.rels",
			content: `<?xml version="1.0" encoding="UTF-8" standalone="yes"?><Relationships xmlns="${pkg}/relationships"><Relationship Id="rId1" Type="${rel}/officeDocument" Target="xl/workbook.xml"/></Relationships>`,
		},
		{
			name: "xl/workbook.xml",
			content: `<?xml version="1.0" encoding="UTF-8" standalone="yes"?><workbook xmlns="${main}" xmlns:r="${rel}"><sheets><sheet name="${sheetName}" sheetId="1" r:id="rId1"/></sheets></workbook>`,
		},
		{
			name: "xl/_rels/workbook.xml.rels",
			content: `<?xml version="1.0" encoding="UTF-8" standalone="yes"?><Relationships xmlns="${pkg}/relationships"><Relationship Id="rId1" Type="${rel}/worksheet" Target="worksheets/sheet1.xml"/><Relationship Id="rId2" Type="${rel}/styles" Target="styles.xml"/></Relationships>`,
		},
		{
			name: "xl/styles.xml",
			content: `<?xml version="1.0" encoding="UTF-8" standalone="yes"?><styleSheet xmlns="${main}"><fonts count="2"><font><sz val="11"/><name val="Calibri"/></font><font><b/><sz val="11"/><name val="Calibri"/></font></fonts><fills count="2"><fill><patternFill patternType="none"/></fill><fill><patternFill patternType="gray125"/></fill></fills><borders count="1"><border><left/><right/><top/><bottom/><diagonal/></border></borders><cellStyleXfs count="1"><xf numFmtId="0" fontId="0" fillId="0" borderId="0"/></cellStyleXfs><cellXfs count="2"><xf numFmtId="0" fontId="0" fillId="0" borderId="0" xfId="0"/><xf numFmtId="0" fontId="1" fillId="0" borderId="0" xfId="0" applyFont="1"/></cellXfs></styleSheet>`,
		},
		{
			name: "xl/worksheets/sheet1.xml",
			content: `<?xml version="1.0" encoding="UTF-8" standalone="yes"?><worksheet xmlns="${main}">${freeze}<sheetData>${sheetRows}</sheetData></worksheet>`,
		},
	]);
}

/* ------------------------------------------------------------------- PDF */

// Helvetica glyph widths (1/1000 em) for ASCII 32–126, from the standard Adobe font metrics.
const HELVETICA_WIDTHS = [
	278, 278, 355, 556, 556, 889, 667, 191, 333, 333, 389, 584, 278, 333, 278, 278, 556, 556, 556, 556, 556, 556, 556, 556,
	556, 556, 278, 278, 584, 584, 584, 556, 1015, 667, 667, 722, 722, 667, 611, 778, 722, 278, 500, 667, 556, 833, 722, 778,
	667, 778, 722, 667, 611, 722, 667, 944, 667, 667, 611, 278, 278, 278, 469, 556, 333, 556, 556, 500, 556, 556, 278, 556,
	556, 222, 222, 500, 222, 833, 556, 556, 556, 556, 333, 500, 278, 556, 500, 722, 500, 500, 500, 334, 260, 334, 584,
];

// Characters outside Latin-1 that WinAnsiEncoding still has, mapped to their byte.
const WIN_ANSI_EXTRA: Record<string, number> = {
	"€": 0x80, "‚": 0x82, "ƒ": 0x83, "„": 0x84, "…": 0x85, "†": 0x86, "‡": 0x87, "ˆ": 0x88, "‰": 0x89, "Š": 0x8a,
	"‹": 0x8b, "Œ": 0x8c, "Ž": 0x8e, "‘": 0x91, "’": 0x92, "“": 0x93, "”": 0x94, "•": 0x95, "–": 0x96, "—": 0x97,
	"˜": 0x98, "™": 0x99, "š": 0x9a, "›": 0x9b, "œ": 0x9c, "ž": 0x9e, "Ÿ": 0x9f,
};

/** The text as single-byte WinAnsi characters; anything the built-in PDF fonts can't show becomes "?". */
function toWinAnsi(text: string): string {
	let out = "";
	for (const char of text.replace(/[\r\n\t]+/g, " ")) {
		const code = char.codePointAt(0) ?? 63;
		if ((code >= 32 && code < 127) || (code >= 160 && code <= 255)) out += char;
		else if (WIN_ANSI_EXTRA[char] !== undefined) out += String.fromCharCode(WIN_ANSI_EXTRA[char]);
		else out += "?";
	}
	return out;
}

function textWidth(text: string, size: number, bold: boolean): number {
	let units = 0;
	for (const char of text) {
		const code = char.charCodeAt(0);
		units += code >= 32 && code <= 126 ? (HELVETICA_WIDTHS[code - 32] ?? 556) : 556;
	}
	return (units / 1000) * size * (bold ? 1.06 : 1);
}

function pdfString(text: string): string {
	return `(${text.replace(/\\/g, "\\\\").replace(/\(/g, "\\(").replace(/\)/g, "\\)")})`;
}

/** Splits text into lines that fit `width`, at most `maxLines` (the last one ends with "…" if cut). */
function wrapText(text: string, width: number, size: number, bold: boolean, maxLines: number): string[] {
	const words = text.split(/ +/).filter(Boolean);
	const lines: string[] = [];
	let line = "";
	const pushWord = (word: string) => {
		const candidate = line ? `${line} ${word}` : word;
		if (textWidth(candidate, size, bold) <= width) {
			line = candidate;
			return;
		}
		if (line) lines.push(line);
		line = "";
		// A single word wider than the column is broken by characters.
		let piece = "";
		for (const char of word) {
			if (textWidth(piece + char, size, bold) > width && piece) {
				lines.push(piece);
				piece = "";
			}
			piece += char;
		}
		line = piece;
	};
	words.forEach(pushWord);
	if (line) lines.push(line);
	if (lines.length > maxLines) {
		const kept = lines.slice(0, maxLines);
		let last = kept[maxLines - 1] ?? "";
		while (last && textWidth(`${last}…`, size, bold) > width) last = last.slice(0, -1);
		kept[maxLines - 1] = `${last}${String.fromCharCode(0x85)}`;
		return kept;
	}
	return lines.length ? lines : [""];
}

/** A landscape A4 PDF of the table, drawn with the built-in Helvetica font. Header row repeats on every page. */
export function buildPdf(data: ExportData): Uint8Array {
	const pageWidth = 842;
	const pageHeight = 595;
	const margin = 32;
	const size = 8;
	const lineHeight = 10;
	const pad = 4;
	const maxLines = 6;
	const usable = pageWidth - margin * 2;

	const headers = data.headers.map(toWinAnsi);
	const rows = data.rows.map((row) => row.map(toWinAnsi));
	const columnCount = Math.max(headers.length, ...rows.map((row) => row.length), 1);

	// Natural column widths from the header and a sample of rows, then scaled to the page.
	const natural = Array.from({ length: columnCount }, (_, col) => {
		let width = textWidth(headers[col] ?? "", size, true);
		for (const row of rows.slice(0, 300)) width = Math.max(width, textWidth(row[col] ?? "", size, false));
		return Math.min(Math.max(width + pad * 2, 36), 240);
	});
	const totalNatural = natural.reduce((sum, width) => sum + width, 0);
	const widths = natural.map((width) => (width / totalNatural) * usable);

	const pages: string[] = [];
	let ops: string[] = [];
	let y = pageHeight - margin;

	const title = toWinAnsi(data.name);
	const drawRow = (cells: string[], bold: boolean) => {
		const wrapped = widths.map((width, col) => wrapText(cells[col] ?? "", width - pad * 2, size, bold, maxLines));
		const height = Math.max(...wrapped.map((lines) => lines.length)) * lineHeight + pad * 2;
		return { wrapped, height };
	};
	const paint = (row: { wrapped: string[][]; height: number }, bold: boolean) => {
		if (bold) ops.push(`0.945 0.953 0.961 rg ${margin} ${y - row.height} ${usable} ${row.height} re f`);
		let x = margin;
		ops.push("0 0 0 rg", `BT /${bold ? "F2" : "F1"} ${size} Tf`);
		row.wrapped.forEach((lines, col) => {
			lines.forEach((line, index) => {
				const ty = y - pad - size - index * lineHeight + 1;
				ops.push(`1 0 0 1 ${(x + pad).toFixed(2)} ${ty.toFixed(2)} Tm ${pdfString(line)} Tj`);
			});
			x += widths[col] ?? 0;
		});
		ops.push("ET");
		ops.push(`0.8 0.82 0.85 RG 0.5 w ${margin} ${(y - row.height).toFixed(2)} m ${margin + usable} ${(y - row.height).toFixed(2)} l S`);
		y -= row.height;
	};
	const header = headers.length ? drawRow(headers, true) : null;
	const startPage = (first: boolean) => {
		if (!first) pages.push(ops.join("\n"));
		ops = [];
		y = pageHeight - margin;
		if (first && title) {
			ops.push(`0 0 0 rg BT /F2 13 Tf ${margin} ${y - 13} Td ${pdfString(title)} Tj ET`);
			y -= 24;
		}
		ops.push(`0.8 0.82 0.85 RG 0.5 w ${margin} ${y} m ${margin + usable} ${y} l S`);
		if (header) paint(header, true);
	};

	startPage(true);
	for (const cells of rows) {
		const row = drawRow(cells, false);
		if (y - row.height < margin && y < pageHeight - margin - (header?.height ?? 0) - 30) startPage(false);
		paint(row, false);
	}
	pages.push(ops.join("\n"));

	// Assemble: catalog, page tree, two fonts, then a page + content stream per page.
	const objects: string[] = [];
	const pageIds = pages.map((_, index) => 5 + index * 2);
	objects[1] = "<< /Type /Catalog /Pages 2 0 R >>";
	objects[2] = `<< /Type /Pages /Kids [${pageIds.map((id) => `${id} 0 R`).join(" ")}] /Count ${pages.length} >>`;
	objects[3] = "<< /Type /Font /Subtype /Type1 /BaseFont /Helvetica /Encoding /WinAnsiEncoding >>";
	objects[4] = "<< /Type /Font /Subtype /Type1 /BaseFont /Helvetica-Bold /Encoding /WinAnsiEncoding >>";
	pages.forEach((content, index) => {
		const pageId = pageIds[index] ?? 0;
		objects[pageId] =
			`<< /Type /Page /Parent 2 0 R /MediaBox [0 0 ${pageWidth} ${pageHeight}] /Resources << /Font << /F1 3 0 R /F2 4 0 R >> >> /Contents ${pageId + 1} 0 R >>`;
		objects[pageId + 1] = `<< /Length ${content.length} >>\nstream\n${content}\nendstream`;
	});

	let pdf = "%PDF-1.4\n%\xE2\xE3\xCF\xD3\n";
	const offsets: number[] = [];
	for (let id = 1; id < objects.length; id++) {
		offsets[id] = pdf.length;
		pdf += `${id} 0 obj\n${objects[id]}\nendobj\n`;
	}
	const xref = pdf.length;
	pdf += `xref\n0 ${objects.length}\n0000000000 65535 f \n`;
	for (let id = 1; id < objects.length; id++) pdf += `${String(offsets[id]).padStart(10, "0")} 00000 n \n`;
	pdf += `trailer\n<< /Size ${objects.length} /Root 1 0 R >>\nstartxref\n${xref}\n%%EOF`;

	// Every character is a single byte by now, so offsets above are byte offsets.
	const bytes = new Uint8Array(pdf.length);
	for (let i = 0; i < pdf.length; i++) bytes[i] = pdf.charCodeAt(i) & 0xff;
	return bytes;
}
