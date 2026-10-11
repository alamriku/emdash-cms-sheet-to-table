import * as React from "react";

import {
	BUILTIN_THEMES,
	THEME_COLOR_KEYS,
	THEME_COLOR_LABELS,
	type ThemeColors,
	type ThemeDefinition,
	type ThemeOptions,
	customThemeId,
	findThemeDefinition,
} from "../lib/themes.js";
import { callRoute } from "./shared.js";
import { Alert, Button, Card, ColorField, Field, Icon, Modal, Segmented, Switch } from "./ui.js";

export interface CustomTheme extends ThemeDefinition {
	id: string;
	name: string;
}

export function customThemeMap(themes: CustomTheme[]): Record<string, ThemeDefinition> {
	return Object.fromEntries(themes.map((theme) => [theme.id, theme]));
}

const SAMPLE_ROWS = [
	["Ahmed Sabir", "130456"],
	["Hayati Ane", "4535345"],
	["Francis Xavier", "1213244"],
	["Tommy Kent", "678976"],
];

// Soft backdrops behind the theme thumbnails, cycled through like the cards in a gallery.
const BACKDROPS = [
	"linear-gradient(135deg,#eef2ff,#e0e7ff)",
	"linear-gradient(135deg,#fff7ed,#fde2e4)",
	"linear-gradient(135deg,#fdf2f8,#e0f2fe)",
	"linear-gradient(135deg,#f5f3ff,#ede9fe)",
	"linear-gradient(135deg,#ecfeff,#e0e7ff)",
	"linear-gradient(135deg,#f1f5f9,#e2e8f0)",
	"linear-gradient(135deg,#fefce8,#fef3c7)",
];

/** A tiny table drawn with a theme's colors and options, for the theme cards and the builder. */
export function ThemeArt({ definition, large = false }: { definition: ThemeDefinition; large?: boolean }) {
	const { colors, options } = definition;
	const line = `1px solid ${colors.borderColor}`;
	const cell = (col: number, row: number, header: boolean): React.CSSProperties => ({
		background: header
			? colors.headerBg
			: (options.stripes === "rows" && row % 2 === 1) || (options.stripes === "columns" && col === 1)
				? colors.stripeBg
				: colors.bodyBg,
		color: header ? colors.headerText : colors.bodyText,
		fontWeight: header ? 700 : 400,
		textTransform: header && options.uppercaseHeader ? "uppercase" : undefined,
		letterSpacing: header && options.uppercaseHeader ? "0.05em" : undefined,
		borderBottom: options.borders === "none" ? undefined : line,
		borderRight: options.borders === "all" ? line : undefined,
		fontSize: large ? "0.75rem" : undefined,
		padding: large ? "0.5rem 0.75rem" : undefined,
	});
	return (
		<div className="st-theme__mini" style={{ background: colors.bodyBg, border: options.borders === "all" ? line : undefined }}>
			<div className="st-theme__mini-row">
				<span style={cell(0, -1, true)}>Name</span>
				<span style={cell(1, -1, true)}>ID</span>
			</div>
			{SAMPLE_ROWS.map((row, r) => (
				<div className="st-theme__mini-row" key={row[0]}>
					{row.map((value, c) => (
						<span key={c} style={cell(c, r, false)}>
							{value}
						</span>
					))}
				</div>
			))}
		</div>
	);
}

interface ThemeStepProps {
	theme: string;
	themeColors: Partial<ThemeColors>;
	importStyles: boolean;
	mergeCells: boolean;
	customThemes: CustomTheme[];
	formatError: string | null;
	onChange: (changes: { theme?: string; themeColors?: Partial<ThemeColors>; importStyles?: boolean; mergeCells?: boolean }) => void;
	onThemesChanged: () => Promise<void>;
}

export function ThemeStep({ theme, themeColors, importStyles, mergeCells, customThemes, formatError, onChange, onThemesChanged }: ThemeStepProps) {
	const [builder, setBuilder] = React.useState<{ id: string | null; name: string; definition: ThemeDefinition } | null>(null);
	const [error, setError] = React.useState<string | null>(null);
	const map = customThemeMap(customThemes);
	const current = findThemeDefinition(theme, map) ?? BUILTIN_THEMES[0]!.definition;
	const hasTweaks = Object.keys(themeColors).length > 0;

	async function deleteTheme(custom: CustomTheme) {
		if (!window.confirm(`Delete the theme "${custom.name}"? Tables using it switch to Auto.`)) return;
		try {
			await callRoute("themes/delete", { id: custom.id });
			if (theme === customThemeId(custom.id)) onChange({ theme: "auto" });
			await onThemesChanged();
		} catch (cause) {
			setError(cause instanceof Error ? cause.message : "Could not delete the theme");
		}
	}

	const cards = [
		...BUILTIN_THEMES.map((builtin) => ({ id: builtin.id, label: builtin.label, definition: builtin.definition, custom: null as CustomTheme | null })),
		...customThemes.map((custom) => ({ id: customThemeId(custom.id), label: custom.name, definition: custom as ThemeDefinition, custom })),
	];

	return (
		<div className="st-stack-lg">
			{error && <Alert kind="error">{error}</Alert>}

			<Card title="Sheet formatting" description="Bring the look of your Google Sheet into the table.">
				<div className="st-grid-2">
					<Switch
						label="Import colors and text styles from sheet"
						description="Cell background and text colors, bold, italic, underline, font size, font family and alignment. Applied on top of the theme."
						checked={importStyles}
						onChange={(value) => onChange({ importStyles: value })}
					/>
					<Switch
						label="Show merged cells"
						description="Cells merged in the sheet stay merged. Merges show while the table is in sheet order, not while it's sorted or searched."
						checked={mergeCells}
						onChange={(value) => onChange({ mergeCells: value })}
					/>
				</div>
				{(importStyles || mergeCells) && formatError && (
					<div style={{ marginTop: "1rem" }}>
						<Alert kind="warning">Couldn't read the sheet's formatting last time: {formatError}</Alert>
					</div>
				)}
				{(importStyles || mergeCells) && (
					<p className="st-help">Formatting is read the next time you save or sync.</p>
				)}
			</Card>

			<Card title="Select theme" description="Pick a starting look. You can fine-tune its colors below or build your own theme.">
				<div className="st-theme-grid" role="radiogroup" aria-label="Table theme">
					{cards.map((card, index) => (
						<div
							key={card.id}
							className="st-theme"
							role="radio"
							tabIndex={0}
							aria-checked={theme === card.id}
							onClick={() => onChange({ theme: card.id })}
							onKeyDown={(event) => {
								if (event.key === "Enter" || event.key === " ") {
									event.preventDefault();
									onChange({ theme: card.id });
								}
							}}
						>
							<span className="st-theme__name">
								<span className="st-theme__check" aria-hidden="true" />
								{card.label}
							</span>
							<div className="st-theme__art" style={{ background: BACKDROPS[index % BACKDROPS.length] }}>
								{card.id === "auto" ? (
									<div style={{ display: "flex", gap: 4 }}>
										<div style={{ flex: 1 }}>
											<ThemeArt definition={card.definition} />
										</div>
										<div style={{ flex: 1 }}>
											<ThemeArt definition={BUILTIN_THEMES.find((t) => t.id === "simple-dark")!.definition} />
										</div>
									</div>
								) : (
									<ThemeArt definition={card.definition} />
								)}
							</div>
							{card.custom && (
								<span className="st-theme__tools">
									<button
										type="button"
										className="st-theme__tool"
										title="Edit theme"
										aria-label={`Edit ${card.label}`}
										onClick={(event) => {
											event.stopPropagation();
											setBuilder({ id: card.custom!.id, name: card.custom!.name, definition: card.custom! });
										}}
									>
										<Icon name="pencil" />
									</button>
									<button
										type="button"
										className="st-theme__tool"
										title="Delete theme"
										aria-label={`Delete ${card.label}`}
										onClick={(event) => {
											event.stopPropagation();
											void deleteTheme(card.custom!);
										}}
									>
										<Icon name="trash" />
									</button>
								</span>
							)}
						</div>
					))}
					<button
						type="button"
						className="st-theme st-theme--new"
						onClick={() =>
							setBuilder({
								id: null,
								name: "",
								definition: { colors: { ...current.colors, ...themeColors }, options: { ...current.options } },
							})
						}
					>
						<Icon name="palette" />
						New theme
					</button>
				</div>
			</Card>

			<Card
				title="Customize theme colors"
				description={theme === "auto" ? "Auto follows each visitor's light/dark setting. Colors you set here apply in both." : "Override any of this theme's colors for this table only."}
				actions={
					hasTweaks && (
						<Button size="sm" variant="ghost" icon="refresh" onClick={() => onChange({ themeColors: {} })}>
							Reset all
						</Button>
					)
				}
			>
				<div className="st-grid-4">
					{THEME_COLOR_KEYS.map((key) => (
						<ColorField
							key={key}
							label={THEME_COLOR_LABELS[key]}
							value={themeColors[key] ?? ""}
							fallback={current.colors[key]}
							onChange={(value) => onChange({ themeColors: { ...themeColors, [key]: value } })}
							onReset={() => {
								const { [key]: _removed, ...rest } = themeColors;
								onChange({ themeColors: rest });
							}}
						/>
					))}
				</div>
			</Card>

			{builder && (
				<ThemeBuilder
					initial={builder}
					onClose={() => setBuilder(null)}
					onSaved={async (id) => {
						setBuilder(null);
						await onThemesChanged();
						// A newly built theme already contains the table's tweaks, so they're cleared.
						onChange({ theme: customThemeId(id), ...(builder.id ? {} : { themeColors: {} }) });
					}}
				/>
			)}
		</div>
	);
}

function ThemeBuilder({
	initial,
	onClose,
	onSaved,
}: {
	initial: { id: string | null; name: string; definition: ThemeDefinition };
	onClose: () => void;
	onSaved: (id: string) => Promise<void>;
}) {
	const [name, setName] = React.useState(initial.name);
	const [colors, setColors] = React.useState<ThemeColors>(initial.definition.colors);
	const [options, setOptions] = React.useState<ThemeOptions>(initial.definition.options);
	const [saving, setSaving] = React.useState(false);
	const [error, setError] = React.useState<string | null>(null);

	async function save() {
		if (!name.trim()) {
			setError("Give the theme a name.");
			return;
		}
		setSaving(true);
		setError(null);
		try {
			const body = { name: name.trim(), colors, options };
			const result = initial.id
				? await callRoute<{ id: string }>("themes/update", { id: initial.id, ...body })
				: await callRoute<{ id: string }>("themes/create", body);
			await onSaved(result.id);
		} catch (cause) {
			setError(cause instanceof Error ? cause.message : "Could not save the theme");
			setSaving(false);
		}
	}

	return (
		<Modal
			title={initial.id ? "Edit theme" : "Create a theme"}
			onClose={onClose}
			footer={
				<>
					<Button variant="secondary" onClick={onClose}>
						Cancel
					</Button>
					<Button variant="primary" icon="check" loading={saving} onClick={() => void save()}>
						{initial.id ? "Save theme" : "Create theme"}
					</Button>
				</>
			}
		>
			<div className="st-stack-lg">
				{error && <Alert kind="error">{error}</Alert>}
				<div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(18rem, 1fr))", gap: "1.5rem" }}>
					<div className="st-stack">
						<Field label="Theme name">
							<input className="st-input" value={name} autoFocus placeholder="e.g. Brand blue" onChange={(e) => setName(e.target.value)} />
						</Field>
						<div className="st-grid-2" style={{ gap: "0.625rem" }}>
							{THEME_COLOR_KEYS.map((key) => (
								<ColorField
									key={key}
									label={THEME_COLOR_LABELS[key]}
									value={colors[key]}
									fallback={colors[key]}
									onChange={(value) => setColors((c) => ({ ...c, [key]: value }))}
								/>
							))}
						</div>
					</div>
					<div className="st-stack">
						<span className="st-label">Preview</span>
						<div style={{ padding: "1.25rem", borderRadius: "0.75rem", background: BACKDROPS[0] }}>
							<ThemeArt definition={{ colors, options }} large />
						</div>
						<Field label="Borders">
							<Segmented
								label="Borders"
								value={options.borders}
								onChange={(borders) => setOptions((o) => ({ ...o, borders }))}
								options={[
									{ value: "all", label: "Grid" },
									{ value: "horizontal", label: "Rows" },
									{ value: "none", label: "None" },
								]}
							/>
						</Field>
						<Field label="Stripes">
							<Segmented
								label="Stripes"
								value={options.stripes}
								onChange={(stripes) => setOptions((o) => ({ ...o, stripes }))}
								options={[
									{ value: "none", label: "None" },
									{ value: "rows", label: "Rows" },
									{ value: "columns", label: "Columns" },
								]}
							/>
						</Field>
						<Switch label="Uppercase header" checked={options.uppercaseHeader} onChange={(uppercaseHeader) => setOptions((o) => ({ ...o, uppercaseHeader }))} />
					</div>
				</div>
			</div>
		</Modal>
	);
}
