/**
 * The admin's small UI kit: buttons, inputs, switches, cards and the step indicator, styled the way
 * Tailwind UI does it (rounded-md, shadow-sm, focus rings, semibold labels).
 *
 * EmDash's admin stylesheet only contains the utility classes EmDash itself uses, so these components
 * use their own `st-` classes, defined in UI_CSS below and scoped to the plugin's pages. Colors come
 * from the admin's theme variables (kumo), so everything follows its light/dark mode.
 */

import * as React from "react";

export const UI_CSS = `
.sheet-table-admin {
	--st-surface: var(--color-kumo-elevated, var(--color-kumo-base, #fff));
	--st-base: var(--color-kumo-base, #fff);
	--st-recessed: var(--color-kumo-recessed, #f9fafb);
	--st-line: var(--color-kumo-line, #e5e7eb);
	--st-hairline: var(--color-kumo-hairline, #f3f4f6);
	--st-text: var(--text-color-kumo-default, #111827);
	--st-strong: var(--text-color-kumo-strong, #030712);
	--st-subtle: var(--text-color-kumo-subtle, #6b7280);
	--st-primary: var(--color-kumo-brand, #4f46e5);
	--st-primary-hover: var(--color-kumo-brand-hover, #4338ca);
	--st-primary-tint: color-mix(in srgb, var(--st-primary) 10%, transparent);
	--st-ring: color-mix(in srgb, var(--st-primary) 45%, transparent);
	--st-danger: var(--color-kumo-danger, #dc2626);
	--st-danger-tint: var(--color-kumo-danger-tint, #fef2f2);
	--st-success: var(--color-kumo-success, #16a34a);
	--st-success-tint: var(--color-kumo-success-tint, #f0fdf4);
	--st-warning: var(--text-color-kumo-warning, #b45309);
	--st-warning-tint: var(--color-kumo-warning-tint, #fffbeb);
	--st-shadow-sm: 0 1px 2px 0 rgb(0 0 0 / 0.05);
	--st-shadow: 0 1px 3px 0 rgb(0 0 0 / 0.08), 0 1px 2px -1px rgb(0 0 0 / 0.08);
	color: var(--st-text);
}
.sheet-table-admin *, .sheet-table-admin *::before, .sheet-table-admin *::after { box-sizing: border-box; }

/* Buttons */
.st-btn { display: inline-flex; align-items: center; justify-content: center; gap: 0.375rem; font: inherit; font-weight: 600; line-height: 1.25rem; border-radius: 0.5rem; border: 1px solid transparent; white-space: nowrap; transition: background-color .15s, border-color .15s, color .15s, box-shadow .15s, transform .05s; text-decoration: none; }
.st-btn:not(:disabled) { cursor: pointer; }
.st-btn:active:not(:disabled) { transform: translateY(0.5px); }
.st-btn:focus-visible { outline: none; box-shadow: 0 0 0 2px var(--st-base), 0 0 0 4px var(--st-ring); }
.st-btn:disabled { opacity: 0.5; cursor: not-allowed; }
.st-btn svg { width: 1rem; height: 1rem; flex: none; }
.st-btn--md { padding: 0.5rem 0.875rem; font-size: 0.875rem; }
.st-btn--sm { padding: 0.3125rem 0.625rem; font-size: 0.8125rem; border-radius: 0.375rem; }
.st-btn--lg { padding: 0.625rem 1.125rem; font-size: 0.9375rem; }
.st-btn--primary { background: var(--st-primary); color: #fff; box-shadow: var(--st-shadow-sm); }
.st-btn--primary:hover:not(:disabled) { background: var(--st-primary-hover); }
.st-btn--secondary { background: var(--st-surface); color: var(--st-text); border-color: var(--st-line); box-shadow: var(--st-shadow-sm); }
.st-btn--secondary:hover:not(:disabled) { background: var(--st-recessed); }
.st-btn--soft { background: var(--st-primary-tint); color: var(--st-primary); }
.st-btn--soft:hover:not(:disabled) { background: color-mix(in srgb, var(--st-primary) 16%, transparent); }
.st-btn--ghost { background: transparent; color: var(--st-subtle); }
.st-btn--ghost:hover:not(:disabled) { background: var(--st-recessed); color: var(--st-text); }
.st-btn--danger { background: transparent; color: var(--st-danger); }
.st-btn--danger:hover:not(:disabled) { background: var(--st-danger-tint); }

/* Inputs */
.st-input { display: block; width: 100%; font: inherit; font-size: 0.875rem; line-height: 1.25rem; color: var(--st-text); background: var(--st-base); border: 1px solid var(--st-line); border-radius: 0.5rem; padding: 0.5rem 0.75rem; box-shadow: var(--st-shadow-sm); transition: border-color .15s, box-shadow .15s; }
.st-input:focus { outline: none; border-color: var(--st-primary); box-shadow: 0 0 0 3px var(--st-ring); }
.st-input:disabled { opacity: 0.6; cursor: not-allowed; }
.st-input--mono { font-family: ui-monospace, SFMono-Regular, Menlo, Consolas, monospace; font-size: 0.8125rem; }
select.st-input { appearance: auto; }
.st-label { display: block; font-size: 0.875rem; font-weight: 600; color: var(--st-text); margin-bottom: 0.375rem; }
.st-help { display: block; font-size: 0.75rem; color: var(--st-subtle); margin-top: 0.375rem; line-height: 1.1rem; }
.st-field { display: block; min-width: 0; }

/* Switch */
.st-switch { display: flex; align-items: flex-start; gap: 0.75rem; cursor: pointer; }
.st-switch input { position: absolute; opacity: 0; width: 1px; height: 1px; }
.st-switch__track { position: relative; flex: none; width: 2.25rem; height: 1.25rem; margin-top: 0.0625rem; border-radius: 999px; background: color-mix(in srgb, var(--st-subtle) 35%, transparent); transition: background-color .2s; }
.st-switch__thumb { position: absolute; top: 0.125rem; left: 0.125rem; width: 1rem; height: 1rem; border-radius: 999px; background: #fff; box-shadow: 0 1px 2px rgb(0 0 0 / 0.25); transition: transform .2s; }
.st-switch input:checked + .st-switch__track { background: var(--st-primary); }
.st-switch input:checked + .st-switch__track .st-switch__thumb { transform: translateX(1rem); }
.st-switch input:focus-visible + .st-switch__track { box-shadow: 0 0 0 2px var(--st-base), 0 0 0 4px var(--st-ring); }
.st-switch input:disabled + .st-switch__track { opacity: 0.5; }
.st-switch__text { font-size: 0.875rem; font-weight: 500; line-height: 1.375rem; }
.st-switch__desc { display: block; font-size: 0.75rem; font-weight: 400; color: var(--st-subtle); line-height: 1.1rem; }

/* Cards */
.st-card { background: var(--st-surface); border: 1px solid var(--st-line); border-radius: 0.75rem; box-shadow: var(--st-shadow); }
.st-card__head:last-child { border-bottom: 0; }
.st-card__head { display: flex; align-items: flex-start; justify-content: space-between; gap: 1rem; padding: 1rem 1.25rem; border-bottom: 1px solid var(--st-line); }
.st-card__title { font-size: 0.9375rem; font-weight: 600; margin: 0; color: var(--st-strong); }
.st-card__desc { font-size: 0.8125rem; color: var(--st-subtle); margin: 0.125rem 0 0; }
.st-card__body { padding: 1.25rem; }

/* Segmented control */
.st-seg { display: inline-flex; flex-wrap: wrap; padding: 0.1875rem; gap: 0.1875rem; border-radius: 0.5rem; background: var(--st-recessed); border: 1px solid var(--st-line); }
.st-seg button { font: inherit; font-size: 0.8125rem; font-weight: 500; padding: 0.3125rem 0.75rem; border-radius: 0.375rem; border: 0; background: transparent; color: var(--st-subtle); cursor: pointer; transition: background-color .15s, color .15s, box-shadow .15s; }
.st-seg button:hover { color: var(--st-text); }
.st-seg button[aria-pressed="true"] { background: var(--st-surface); color: var(--st-text); box-shadow: var(--st-shadow); }
.st-seg button:focus-visible { outline: none; box-shadow: 0 0 0 2px var(--st-ring); }

/* Chips (multi-select) */
.st-chip { display: inline-flex; align-items: center; gap: 0.375rem; font: inherit; font-size: 0.8125rem; font-weight: 500; padding: 0.375rem 0.75rem; border-radius: 999px; border: 1px solid var(--st-line); background: var(--st-surface); color: var(--st-text); cursor: pointer; transition: all .15s; }
.st-chip:hover { border-color: color-mix(in srgb, var(--st-primary) 50%, var(--st-line)); }
.st-chip[aria-pressed="true"] { background: var(--st-primary-tint); border-color: var(--st-primary); color: var(--st-primary); }
.st-chip svg { width: 0.875rem; height: 0.875rem; }

/* Alerts and badges */
.st-alert { display: flex; gap: 0.625rem; align-items: flex-start; border-radius: 0.5rem; padding: 0.75rem 1rem; font-size: 0.875rem; border: 1px solid; }
.st-alert svg { width: 1.125rem; height: 1.125rem; flex: none; margin-top: 0.0625rem; }
.st-alert--info { background: var(--st-primary-tint); border-color: color-mix(in srgb, var(--st-primary) 25%, transparent); }
.st-alert--success { background: var(--st-success-tint); border-color: color-mix(in srgb, var(--st-success) 35%, transparent); }
.st-alert--warning { background: var(--st-warning-tint); border-color: color-mix(in srgb, var(--st-warning) 35%, transparent); color: var(--st-warning); }
.st-alert--error { background: var(--st-danger-tint); border-color: color-mix(in srgb, var(--st-danger) 35%, transparent); color: var(--st-danger); }
.st-badge { display: inline-flex; align-items: center; gap: 0.25rem; font-size: 0.6875rem; font-weight: 600; line-height: 1rem; padding: 0.0625rem 0.5rem; border-radius: 999px; background: var(--st-recessed); color: var(--st-subtle); border: 1px solid var(--st-line); }
.st-badge--primary { background: var(--st-primary-tint); color: var(--st-primary); border-color: transparent; }
.st-badge--success { background: var(--st-success-tint); color: var(--st-success); border-color: transparent; }
.st-badge--warning { background: var(--st-warning-tint); color: var(--st-warning); border-color: transparent; }
.st-badge--danger { background: var(--st-danger-tint); color: var(--st-danger); border-color: transparent; }

/* Stepper */
.st-stepper { display: flex; align-items: flex-start; gap: 0; overflow-x: auto; padding: 0.25rem 0 0.5rem; scrollbar-width: thin; }
.st-step { flex: 1 1 0; min-width: 7.5rem; display: flex; flex-direction: column; align-items: center; gap: 0.5rem; position: relative; background: none; border: 0; font: inherit; color: var(--st-subtle); padding: 0 0.25rem; }
.st-step:not(:disabled) { cursor: pointer; }
.st-step:disabled { cursor: not-allowed; }
.st-step::before { content: ""; position: absolute; top: 1.125rem; right: calc(50% + 1.5rem); left: calc(-50% + 1.5rem); height: 2px; border-radius: 2px; background: var(--st-line); }
.st-step:first-child::before { display: none; }
.st-step.is-done::before, .st-step.is-current::before { background: var(--st-primary); }
.st-step__dot { position: relative; z-index: 1; display: grid; place-items: center; width: 2.25rem; height: 2.25rem; border-radius: 999px; background: var(--st-recessed); border: 1px solid var(--st-line); color: var(--st-subtle); transition: all .2s; }
.st-step__dot svg { width: 1.125rem; height: 1.125rem; }
.st-step:hover:not(:disabled) .st-step__dot { border-color: var(--st-primary); color: var(--st-primary); }
.st-step.is-done .st-step__dot { background: var(--st-primary-tint); border-color: transparent; color: var(--st-primary); }
.st-step.is-current .st-step__dot { background: var(--st-primary); border-color: var(--st-primary); color: #fff; box-shadow: 0 0 0 4px var(--st-primary-tint); }
.st-step__label { font-size: 0.8125rem; font-weight: 500; text-align: center; white-space: nowrap; }
.st-step.is-current .st-step__label { color: var(--st-strong); font-weight: 600; }
.st-step:focus-visible { outline: none; }
.st-step:focus-visible .st-step__dot { box-shadow: 0 0 0 4px var(--st-ring); }

/* Choice cards (data source) */
.st-choice { display: flex; gap: 0.75rem; align-items: flex-start; padding: 0.875rem 1rem; border-radius: 0.625rem; border: 1px solid var(--st-line); background: var(--st-surface); cursor: pointer; text-align: left; font: inherit; color: inherit; transition: border-color .15s, box-shadow .15s; width: 100%; }
.st-choice:hover:not(:disabled) { border-color: color-mix(in srgb, var(--st-primary) 50%, var(--st-line)); }
.st-choice[aria-pressed="true"] { border-color: var(--st-primary); box-shadow: 0 0 0 1px var(--st-primary); }
.st-choice:disabled { opacity: 0.55; cursor: not-allowed; }
.st-choice__radio { flex: none; width: 1rem; height: 1rem; margin-top: 0.1875rem; border-radius: 999px; border: 1.5px solid var(--st-line); display: grid; place-items: center; }
.st-choice[aria-pressed="true"] .st-choice__radio { border: 5px solid var(--st-primary); }
.st-choice__title { font-size: 0.875rem; font-weight: 600; }
.st-choice__desc { font-size: 0.75rem; color: var(--st-subtle); margin-top: 0.125rem; }

/* Theme cards */
.st-theme-grid { display: grid; grid-template-columns: repeat(auto-fill, minmax(10.5rem, 1fr)); gap: 0.875rem; }
.st-theme { position: relative; display: flex; flex-direction: column; border-radius: 0.75rem; border: 1px solid var(--st-line); background: var(--st-surface); overflow: hidden; cursor: pointer; text-align: left; font: inherit; color: inherit; padding: 0; transition: border-color .15s, box-shadow .15s, transform .15s; }
.st-theme:hover { transform: translateY(-1px); box-shadow: var(--st-shadow); }
.st-theme[aria-checked="true"] { border-color: var(--st-primary); box-shadow: 0 0 0 2px var(--st-primary); }
.st-theme:focus-visible { outline: none; box-shadow: 0 0 0 3px var(--st-ring); }
.st-theme__name { display: flex; align-items: center; gap: 0.5rem; padding: 0.625rem 0.75rem; font-size: 0.8125rem; font-weight: 600; }
.st-theme__check { flex: none; width: 1rem; height: 1rem; border-radius: 999px; border: 1.5px solid var(--st-line); }
.st-theme[aria-checked="true"] .st-theme__check { border: 5px solid var(--st-primary); }
.st-theme__art { height: 6.5rem; padding: 0.875rem 0 0 1.75rem; overflow: hidden; }
.st-theme__mini { border-radius: 0.375rem 0 0 0; overflow: hidden; box-shadow: 0 4px 12px -2px rgb(0 0 0 / 0.18); font-size: 0.5625rem; line-height: 1; }
.st-theme__mini-row { display: grid; grid-template-columns: 1.6fr 1fr; }
.st-theme__mini-row span { padding: 0.3125rem 0.4375rem; white-space: nowrap; overflow: hidden; }
.st-theme__tools { position: absolute; top: 0.375rem; right: 0.375rem; display: flex; gap: 0.25rem; opacity: 0; transition: opacity .15s; }
.st-theme:hover .st-theme__tools, .st-theme:focus-within .st-theme__tools { opacity: 1; }
.st-theme__tool { display: grid; place-items: center; width: 1.75rem; height: 1.75rem; border-radius: 0.375rem; border: 1px solid var(--st-line); background: var(--st-surface); color: var(--st-subtle); cursor: pointer; }
.st-theme__tool:hover { color: var(--st-text); }
.st-theme__tool svg { width: 0.875rem; height: 0.875rem; }
.st-theme--new { align-items: center; justify-content: center; gap: 0.5rem; min-height: 9.5rem; border-style: dashed; border-width: 1.5px; background: var(--st-primary-tint); color: var(--st-primary); font-weight: 600; font-size: 0.875rem; }
.st-theme--new svg { width: 1.5rem; height: 1.5rem; }

/* Color field */
.st-color { display: flex; align-items: center; gap: 0.5rem; padding: 0.375rem 0.5rem 0.375rem 0.375rem; border: 1px solid var(--st-line); border-radius: 0.5rem; background: var(--st-base); box-shadow: var(--st-shadow-sm); }
.st-color input[type="color"] { flex: none; width: 2rem; height: 2rem; padding: 0; border: 1px solid var(--st-line); border-radius: 0.375rem; background: none; cursor: pointer; }
.st-color input[type="color"]::-webkit-color-swatch-wrapper { padding: 0; }
.st-color input[type="color"]::-webkit-color-swatch { border: 0; border-radius: 0.3rem; }
.st-color__text { flex: 1; min-width: 0; }
.st-color__label { display: block; font-size: 0.8125rem; font-weight: 500; overflow: hidden; text-overflow: ellipsis; white-space: nowrap; }
.st-color__value { display: block; font-size: 0.75rem; color: var(--st-subtle); font-family: ui-monospace, SFMono-Regular, Menlo, monospace; }

/* Modal */
.st-modal-backdrop { position: fixed; inset: 0; z-index: 1000; background: rgb(15 23 42 / 0.5); backdrop-filter: blur(2px); display: grid; place-items: center; padding: 1rem; animation: st-fade .15s ease-out; }
.st-modal { width: min(56rem, 100%); max-height: calc(100vh - 2rem); overflow: auto; background: var(--st-surface); border-radius: 0.875rem; box-shadow: 0 25px 50px -12px rgb(0 0 0 / 0.35); animation: st-pop .18s ease-out; }
.st-modal__head { display: flex; align-items: center; justify-content: space-between; padding: 1rem 1.25rem; border-bottom: 1px solid var(--st-line); position: sticky; top: 0; background: var(--st-surface); z-index: 1; }
.st-modal__foot { display: flex; justify-content: flex-end; gap: 0.5rem; padding: 0.875rem 1.25rem; border-top: 1px solid var(--st-line); background: var(--st-recessed); position: sticky; bottom: 0; }
@keyframes st-fade { from { opacity: 0; } }
@keyframes st-pop { from { opacity: 0; transform: translateY(6px) scale(0.98); } }

/* Data grid (hide rows / cells) */
.st-grid-wrap { overflow: auto; max-height: 30rem; border: 1px solid var(--st-line); border-radius: 0.5rem; }
.st-grid { border-collapse: separate; border-spacing: 0; font-size: 0.8125rem; width: max-content; min-width: 100%; }
.st-grid th, .st-grid td { border-bottom: 1px solid var(--st-hairline); border-right: 1px solid var(--st-hairline); padding: 0.375rem 0.625rem; text-align: left; max-width: 16rem; overflow: hidden; text-overflow: ellipsis; white-space: nowrap; }
.st-grid thead th { position: sticky; top: 0; z-index: 2; background: var(--st-recessed); font-weight: 600; }
.st-grid .st-grid__rowhead { position: sticky; left: 0; z-index: 1; background: var(--st-recessed); color: var(--st-subtle); font-variant-numeric: tabular-nums; }
.st-grid thead .st-grid__rowhead { z-index: 3; }
.st-grid td.is-cell { cursor: pointer; transition: background-color .1s; }
.st-grid td.is-cell:hover { background: var(--st-primary-tint); }
.st-grid td.is-hidden, .st-grid tr.is-hidden td { color: var(--st-subtle); text-decoration: line-through; background: repeating-linear-gradient(135deg, transparent 0 6px, color-mix(in srgb, var(--st-danger) 8%, transparent) 6px 12px); }
.st-grid th.is-hidden-col, .st-grid td.is-hidden-col { opacity: 0.45; }

/* Layout helpers */
.st-stack > * + * { margin-top: 1rem; }
.st-stack-lg > * + * { margin-top: 1.5rem; }
.st-row { display: flex; align-items: center; gap: 0.5rem; flex-wrap: wrap; }
.st-between { display: flex; align-items: center; justify-content: space-between; gap: 1rem; flex-wrap: wrap; }
.st-grid-2 { display: grid; grid-template-columns: repeat(auto-fit, minmax(15rem, 1fr)); gap: 1rem 1.25rem; }
.st-grid-3 { display: grid; grid-template-columns: repeat(auto-fit, minmax(12rem, 1fr)); gap: 1rem 1.25rem; }
.st-grid-4 { display: grid; grid-template-columns: repeat(auto-fill, minmax(13rem, 1fr)); gap: 0.75rem; }
.st-muted { color: var(--st-subtle); }
.st-small { font-size: 0.8125rem; }
.st-xs { font-size: 0.75rem; }
.st-h1 { font-size: 1.5rem; font-weight: 700; letter-spacing: -0.01em; margin: 0; color: var(--st-strong); }
.st-h2 { font-size: 1rem; font-weight: 600; margin: 0; color: var(--st-strong); }
.st-code { font-family: ui-monospace, SFMono-Regular, Menlo, monospace; font-size: 0.75rem; background: var(--st-recessed); border: 1px solid var(--st-line); border-radius: 0.375rem; padding: 0.0625rem 0.375rem; }
.st-divider { height: 1px; background: var(--st-line); border: 0; margin: 1.25rem 0; }
.st-sticky-bar { position: sticky; top: 0; z-index: 20; background: color-mix(in srgb, var(--st-base) 88%, transparent); backdrop-filter: blur(8px); padding: 0.75rem 0; border-bottom: 1px solid var(--st-line); }
@media (max-width: 640px) { .st-sticky-bar { position: static; } }
.st-link { color: var(--st-primary); font-weight: 500; text-decoration: none; }
.st-link:hover { text-decoration: underline; }
.st-icon { width: 1rem; height: 1rem; flex: none; }
.st-spin { animation: st-spin 1s linear infinite; }
@keyframes st-spin { to { transform: rotate(360deg); } }
`;

const ICON_PATHS = {
	link: "M13.19 8.688a4.5 4.5 0 0 1 1.242 7.244l-4.5 4.5a4.5 4.5 0 0 1-6.364-6.364l1.757-1.757m13.35-.622 1.757-1.757a4.5 4.5 0 0 0-6.364-6.364l-4.5 4.5a4.5 4.5 0 0 0 1.242 7.244",
	palette:
		"M12 21a9 9 0 1 1 9-9c0 1.66-1.34 3-3 3h-1.5a1.5 1.5 0 0 0-1.06 2.56l.12.12A1.5 1.5 0 0 1 14.5 20.2 9 9 0 0 1 12 21Z M7.5 11.25h.008v.008H7.5v-.008Zm3-3.75h.008v.008H10.5V7.5Zm4.5.75h.008v.008H15v-.008Z",
	sliders: "M10.5 6h9.75M10.5 6a1.5 1.5 0 1 1-3 0m3 0a1.5 1.5 0 1 0-3 0M3.75 6H7.5m3 12h9.75m-9.75 0a1.5 1.5 0 0 1-3 0m3 0a1.5 1.5 0 0 0-3 0m-3.75 0H7.5m9-6h3.75m-3.75 0a1.5 1.5 0 0 1-3 0m3 0a1.5 1.5 0 0 0-3 0m-9.75 0h9.75",
	eyeSlash:
		"M3.98 8.223A10.477 10.477 0 0 0 1.934 12C3.226 16.338 7.244 19.5 12 19.5c.993 0 1.953-.138 2.863-.395M6.228 6.228A10.451 10.451 0 0 1 12 4.5c4.756 0 8.773 3.162 10.065 7.498a10.522 10.522 0 0 1-4.293 5.774M6.228 6.228 3 3m3.228 3.228 3.65 3.65m7.894 7.894L21 21m-3.228-3.228-3.65-3.65m0 0a3 3 0 1 0-4.243-4.243m4.242 4.242L9.88 9.88",
	code: "M17.25 6.75 22.5 12l-5.25 5.25m-10.5 0L1.5 12l5.25-5.25m7.5-3-4.5 16.5",
	check: "m4.5 12.75 6 6 9-13.5",
	arrowLeft: "M10.5 19.5 3 12m0 0 7.5-7.5M3 12h18",
	arrowRight: "M13.5 4.5 21 12m0 0-7.5 7.5M21 12H3",
	plus: "M12 4.5v15m7.5-7.5h-15",
	x: "M6 18 18 6M6 6l12 12",
	copy: "M16.5 8.25V6a2.25 2.25 0 0 0-2.25-2.25H6A2.25 2.25 0 0 0 3.75 6v8.25A2.25 2.25 0 0 0 6 16.5h2.25m8.25-8.25H18a2.25 2.25 0 0 1 2.25 2.25V18A2.25 2.25 0 0 1 18 20.25h-7.5A2.25 2.25 0 0 1 8.25 18v-1.5m8.25-8.25h-6a2.25 2.25 0 0 0-2.25 2.25v6",
	refresh:
		"M16.023 9.348h4.992v-.001M2.985 19.644v-4.992m0 0h4.992m-4.993 0 3.181 3.183a8.25 8.25 0 0 0 13.803-3.7M4.031 9.865a8.25 8.25 0 0 1 13.803-3.7l3.181 3.182m0-4.991v4.99",
	pencil:
		"m16.862 4.487 1.687-1.688a1.875 1.875 0 1 1 2.652 2.652L10.582 16.07a4.5 4.5 0 0 1-1.897 1.13L6 18l.8-2.685a4.5 4.5 0 0 1 1.13-1.897l8.932-8.931Zm0 0L19.5 7.125",
	trash:
		"m14.74 9-.346 9m-4.788 0L9.26 9m9.968-3.21c.342.052.682.107 1.022.166m-1.022-.165L18.16 19.673a2.25 2.25 0 0 1-2.244 2.077H8.084a2.25 2.25 0 0 1-2.244-2.077L4.772 5.79m14.456 0a48.108 48.108 0 0 0-3.478-.397m-12 .562c.34-.059.68-.114 1.022-.165m0 0a48.11 48.11 0 0 1 3.478-.397m7.5 0v-.916c0-1.18-.91-2.164-2.09-2.201a51.964 51.964 0 0 0-3.32 0c-1.18.037-2.09 1.022-2.09 2.201v.916m7.5 0a48.667 48.667 0 0 0-7.5 0",
	info: "m11.25 11.25.041-.02a.75.75 0 0 1 1.063.852l-.708 2.836a.75.75 0 0 0 1.063.853l.041-.021M21 12a9 9 0 1 1-18 0 9 9 0 0 1 18 0Zm-9-3.75h.008v.008H12V8.25Z",
	warning:
		"M12 9v3.75m-9.303 3.376c-.866 1.5.217 3.374 1.948 3.374h14.71c1.73 0 2.813-1.874 1.948-3.374L13.949 3.378c-.866-1.5-3.032-1.5-3.898 0L2.697 16.126ZM12 15.75h.007v.008H12v-.008Z",
	desktop:
		"M9 17.25v1.007a3 3 0 0 1-.879 2.122L7.5 21h9l-.621-.621A3 3 0 0 1 15 18.257V17.25m6-12V15a2.25 2.25 0 0 1-2.25 2.25H5.25A2.25 2.25 0 0 1 3 15V5.25m18 0A2.25 2.25 0 0 0 18.75 3H5.25A2.25 2.25 0 0 0 3 5.25m18 0V12a2.25 2.25 0 0 1-2.25 2.25H5.25A2.25 2.25 0 0 1 3 12V5.25",
	phone:
		"M10.5 1.5H8.25A2.25 2.25 0 0 0 6 3.75v16.5a2.25 2.25 0 0 0 2.25 2.25h7.5A2.25 2.25 0 0 0 18 20.25V3.75a2.25 2.25 0 0 0-2.25-2.25H13.5m-3 0V3h3V1.5m-3 0h3m-3 18.75h3",
	table: "M3.375 4.5h17.25c.621 0 1.125.504 1.125 1.125v12.75c0 .621-.504 1.125-1.125 1.125H3.375A1.125 1.125 0 0 1 2.25 18.375V5.625c0-.621.504-1.125 1.125-1.125ZM2.25 9.75h19.5M2.25 14.625h19.5M9 9.75v9.75",
	download: "M3 16.5v2.25A2.25 2.25 0 0 0 5.25 21h13.5A2.25 2.25 0 0 0 21 18.75V16.5M16.5 12 12 16.5m0 0L7.5 12m4.5 4.5V3",
	sparkles:
		"M9.813 15.904 9 18.75l-.813-2.846a4.5 4.5 0 0 0-3.09-3.09L2.25 12l2.846-.813a4.5 4.5 0 0 0 3.09-3.09L9 5.25l.813 2.846a4.5 4.5 0 0 0 3.09 3.09L15.75 12l-2.846.813a4.5 4.5 0 0 0-3.09 3.09ZM18.259 8.715 18 9.75l-.259-1.035a3.375 3.375 0 0 0-2.455-2.456L14.25 6l1.036-.259a3.375 3.375 0 0 0 2.455-2.456L18 2.25l.259 1.035a3.375 3.375 0 0 0 2.456 2.456L21.75 6l-1.035.259a3.375 3.375 0 0 0-2.456 2.456Z",
	external: "M13.5 6H5.25A2.25 2.25 0 0 0 3 8.25v10.5A2.25 2.25 0 0 0 5.25 21h10.5A2.25 2.25 0 0 0 18 18.75V10.5m-10.5 6L21 3m0 0h-5.25M21 3v5.25",
} as const;

export type IconName = keyof typeof ICON_PATHS;

export function Icon({ name, className = "st-icon" }: { name: IconName; className?: string }) {
	return (
		<svg className={className} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={1.6} strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
			<path d={ICON_PATHS[name]} />
		</svg>
	);
}

type ButtonProps = React.ButtonHTMLAttributes<HTMLButtonElement> & {
	variant?: "primary" | "secondary" | "soft" | "ghost" | "danger";
	size?: "sm" | "md" | "lg";
	icon?: IconName;
	iconRight?: IconName;
	loading?: boolean;
};

export function Button({ variant = "secondary", size = "md", icon, iconRight, loading, className, children, type = "button", disabled, ...rest }: ButtonProps) {
	return (
		<button type={type} className={`st-btn st-btn--${variant} st-btn--${size}${className ? ` ${className}` : ""}`} disabled={disabled || loading} {...rest}>
			{loading ? <Icon name="refresh" className="st-icon st-spin" /> : icon && <Icon name={icon} />}
			{children}
			{iconRight && <Icon name={iconRight} />}
		</button>
	);
}

export function Field({ label, help, children, className }: { label: React.ReactNode; help?: React.ReactNode; children: React.ReactNode; className?: string }) {
	return (
		<label className={`st-field${className ? ` ${className}` : ""}`}>
			<span className="st-label">{label}</span>
			{children}
			{help && <span className="st-help">{help}</span>}
		</label>
	);
}

export function Switch({
	label,
	description,
	checked,
	onChange,
	disabled,
}: {
	label: React.ReactNode;
	description?: React.ReactNode;
	checked: boolean;
	onChange: (value: boolean) => void;
	disabled?: boolean;
}) {
	return (
		<label className="st-switch">
			<input type="checkbox" role="switch" checked={checked} disabled={disabled} onChange={(e) => onChange(e.target.checked)} />
			<span className="st-switch__track">
				<span className="st-switch__thumb" />
			</span>
			<span className="st-switch__text">
				{label}
				{description && <span className="st-switch__desc">{description}</span>}
			</span>
		</label>
	);
}

export function Card({
	title,
	description,
	actions,
	children,
	className,
	bodyClassName,
	flush = false,
}: {
	title?: React.ReactNode;
	description?: React.ReactNode;
	actions?: React.ReactNode;
	children?: React.ReactNode;
	className?: string;
	bodyClassName?: string;
	/** No padding around the body, for lists that draw their own rows. */
	flush?: boolean;
}) {
	return (
		<section className={`st-card${className ? ` ${className}` : ""}`}>
			{(title || actions) && (
				<header className="st-card__head">
					<div>
						{title && <h2 className="st-card__title">{title}</h2>}
						{description && <p className="st-card__desc">{description}</p>}
					</div>
					{actions && <div className="st-row">{actions}</div>}
				</header>
			)}
			{children && <div className={`${flush ? "" : "st-card__body"}${bodyClassName ? ` ${bodyClassName}` : ""}`}>{children}</div>}
		</section>
	);
}

export function Segmented<T extends string>({
	value,
	options,
	onChange,
	label,
}: {
	value: T;
	options: { value: T; label: React.ReactNode }[];
	onChange: (value: T) => void;
	label: string;
}) {
	return (
		<div className="st-seg" role="group" aria-label={label}>
			{options.map((option) => (
				<button key={option.value} type="button" aria-pressed={option.value === value} onClick={() => onChange(option.value)}>
					{option.label}
				</button>
			))}
		</div>
	);
}

export function Alert({ kind, children }: { kind: "info" | "success" | "warning" | "error"; children: React.ReactNode }) {
	const icon: IconName = kind === "success" ? "check" : kind === "info" ? "info" : "warning";
	return (
		<div className={`st-alert st-alert--${kind}`} role={kind === "error" ? "alert" : "status"}>
			<Icon name={icon} />
			<div>{children}</div>
		</div>
	);
}

export function Badge({ kind, children }: { kind?: "primary" | "success" | "warning" | "danger"; children: React.ReactNode }) {
	return <span className={`st-badge${kind ? ` st-badge--${kind}` : ""}`}>{children}</span>;
}

export interface StepDefinition {
	key: string;
	label: string;
	icon: IconName;
}

export function Stepper({
	steps,
	current,
	onSelect,
	enabled,
}: {
	steps: StepDefinition[];
	current: number;
	onSelect: (index: number) => void;
	enabled: boolean;
}) {
	return (
		<nav className="st-stepper" aria-label="Table setup steps">
			{steps.map((step, index) => {
				const state = index === current ? "is-current" : index < current ? "is-done" : "";
				return (
					<button
						key={step.key}
						type="button"
						className={`st-step ${state}`}
						aria-current={index === current ? "step" : undefined}
						disabled={!enabled && index !== current}
						onClick={() => onSelect(index)}
					>
						<span className="st-step__dot">{index < current ? <Icon name="check" /> : <Icon name={step.icon} />}</span>
						<span className="st-step__label">
							{index + 1}. {step.label}
						</span>
					</button>
				);
			})}
		</nav>
	);
}

/** A labeled color picker with an optional reset back to the theme's own color. */
export function ColorField({
	label,
	value,
	fallback,
	onChange,
	onReset,
}: {
	label: string;
	/** The chosen color, or "" to use `fallback`. */
	value: string;
	fallback: string;
	onChange: (value: string) => void;
	onReset?: () => void;
}) {
	const shown = value || fallback;
	return (
		<div className="st-color">
			<input type="color" aria-label={label} value={toSixDigitHex(shown)} onChange={(e) => onChange(e.target.value)} />
			<span className="st-color__text">
				<span className="st-color__label" title={label}>
					{label}
				</span>
				<span className="st-color__value">{value ? shown : `${shown} · theme`}</span>
			</span>
			{onReset && value && (
				<button type="button" className="st-theme__tool" title="Reset to theme color" aria-label={`Reset ${label}`} onClick={onReset}>
					<Icon name="refresh" />
				</button>
			)}
		</div>
	);
}

/** <input type="color"> only accepts #rrggbb. */
export function toSixDigitHex(color: string): string {
	if (/^#[0-9a-f]{6}$/i.test(color)) return color;
	if (/^#[0-9a-f]{8}$/i.test(color)) return color.slice(0, 7);
	const short = color.match(/^#([0-9a-f])([0-9a-f])([0-9a-f])[0-9a-f]?$/i);
	if (short) return `#${short[1]}${short[1]}${short[2]}${short[2]}${short[3]}${short[3]}`;
	return "#000000";
}

export function Modal({
	title,
	onClose,
	footer,
	children,
}: {
	title: React.ReactNode;
	onClose: () => void;
	footer?: React.ReactNode;
	children: React.ReactNode;
}) {
	React.useEffect(() => {
		const onKey = (event: KeyboardEvent) => {
			if (event.key === "Escape") onClose();
		};
		window.addEventListener("keydown", onKey);
		return () => window.removeEventListener("keydown", onKey);
	}, [onClose]);
	return (
		<div className="st-modal-backdrop" onMouseDown={(event) => event.target === event.currentTarget && onClose()}>
			<div className="st-modal" role="dialog" aria-modal="true" aria-label={typeof title === "string" ? title : undefined}>
				<div className="st-modal__head">
					<h2 className="st-h2">{title}</h2>
					<Button variant="ghost" size="sm" icon="x" aria-label="Close" onClick={onClose} />
				</div>
				<div className="st-card__body">{children}</div>
				{footer && <div className="st-modal__foot">{footer}</div>}
			</div>
		</div>
	);
}

/** Copies text and briefly confirms it on the button. */
export function CopyButton({ text, label = "Copy" }: { text: string; label?: string }) {
	const [copied, setCopied] = React.useState(false);
	React.useEffect(() => {
		if (!copied) return;
		const timer = window.setTimeout(() => setCopied(false), 1500);
		return () => window.clearTimeout(timer);
	}, [copied]);
	return (
		<Button
			size="sm"
			variant="ghost"
			icon={copied ? "check" : "copy"}
			aria-label={label}
			title={label}
			onClick={() => {
				void navigator.clipboard?.writeText(text).then(() => setCopied(true));
			}}
		/>
	);
}
