import * as React from "react";

import tableCss from "../astro/sheet-table.css?raw";
import { mountTable } from "../lib/render.js";
import type { TableRenderPayload } from "../lib/types.js";
import { Segmented } from "./ui.js";

const FRAME_DOCUMENT = `<!doctype html><html><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1">
<style>${tableCss}
html,body{margin:0;background:transparent}
body{padding:4px 12px 12px;font-family:ui-sans-serif,system-ui,-apple-system,"Segoe UI",Roboto,sans-serif}
.emdash-sheet-table{margin:0}
</style></head><body><div id="table"></div></body></html>`;

/**
 * Live preview of a table, drawn by the same renderer and stylesheet visitors get. It sits in an
 * iframe so the admin's own styles can't leak in, and so the phone view triggers the table's real
 * mobile breakpoints (hidden columns, collapsible rows).
 */
export function TablePreview({ payload }: { payload: TableRenderPayload | null }) {
	const frameRef = React.useRef<HTMLIFrameElement>(null);
	const [ready, setReady] = React.useState(false);
	const [device, setDevice] = React.useState<"desktop" | "mobile">("desktop");

	React.useEffect(() => {
		const frame = frameRef.current;
		const doc = frame?.contentDocument;
		const win = frame?.contentWindow as (Window & typeof globalThis) | null | undefined;
		if (!frame || !doc || !win) return;
		doc.open();
		doc.write(FRAME_DOCUMENT);
		doc.close();
		// Paint the frame with the surrounding card's color; a transparent iframe whose color scheme
		// differs from the admin's gets an opaque white backdrop from the browser.
		const card = frame.closest(".st-card");
		if (card) doc.documentElement.style.background = getComputedStyle(card).backgroundColor;
		// Grow the iframe with its content, so the preview never scrolls inside the page.
		const observer = new win.ResizeObserver(() => {
			frame.style.height = `${Math.max(120, doc.documentElement.scrollHeight)}px`;
		});
		observer.observe(doc.body);
		setReady(true);
		return () => observer.disconnect();
	}, []);

	React.useEffect(() => {
		const doc = frameRef.current?.contentDocument;
		const current = doc?.getElementById("table");
		if (!ready || !doc || !current || !payload) return;
		// A fresh element per draw: mountTable attaches listeners to its container.
		const fresh = doc.createElement("div");
		fresh.id = "table";
		current.replaceWith(fresh);
		// Inside the preview the "wide" and "full" break-outs have nothing to break out of.
		mountTable(fresh, { ...payload, tableWidth: "content" });
	}, [payload, ready]);

	return (
		<div className="st-stack">
			<div className="st-between">
				<span className="st-xs st-muted">Updates as you change settings. Save to publish.</span>
				<Segmented
					label="Preview size"
					value={device}
					onChange={setDevice}
					options={[
						{ value: "desktop", label: "Desktop" },
						{ value: "mobile", label: "Phone" },
					]}
				/>
			</div>
			<div style={{ display: "flex", justifyContent: "center" }}>
				<iframe
					ref={frameRef}
					title="Table preview"
					style={{
						width: device === "mobile" ? 390 : "100%",
						border: device === "mobile" ? "8px solid var(--st-line)" : 0,
						borderRadius: device === "mobile" ? 24 : 0,
						height: 160,
						background: "transparent",
						transition: "width .2s ease",
					}}
				/>
			</div>
			{!payload && <p className="st-small st-muted">Create the table to see a preview.</p>}
		</div>
	);
}
