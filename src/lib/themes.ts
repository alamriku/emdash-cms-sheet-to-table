/**
 * Table themes. Every theme is data: a set of colors plus a few structural options. The table's CSS
 * (src/astro/sheet-table.css) reads the colors from CSS variables and the options from modifier
 * classes, so built-in themes, custom themes made in the theme builder, and per-table color tweaks all
 * render through the same rules.
 */

export interface ThemeColors {
	headerBg: string;
	headerText: string;
	bodyBg: string;
	bodyText: string;
	/** Background of every other row (or column, with `stripes: "columns"`). */
	stripeBg: string;
	hoverBg: string;
	borderColor: string;
	/** Links, sort arrows, focus rings and the active page button. */
	accent: string;
}

export interface ThemeOptions {
	/** "all" draws a grid, "horizontal" only lines between rows, "none" no cell lines at all. */
	borders: "all" | "horizontal" | "none";
	stripes: "none" | "rows" | "columns";
	uppercaseHeader: boolean;
}

export interface ThemeDefinition {
	colors: ThemeColors;
	options: ThemeOptions;
}

/** A theme made in the theme builder. Stored in the `themes` storage collection. */
export interface CustomThemeRecord extends ThemeDefinition {
	name: string;
	createdAt: string;
	updatedAt: string;
}

export const THEME_COLOR_KEYS = [
	"headerBg",
	"headerText",
	"bodyBg",
	"bodyText",
	"stripeBg",
	"hoverBg",
	"borderColor",
	"accent",
] as const satisfies readonly (keyof ThemeColors)[];

export const THEME_COLOR_LABELS: Record<keyof ThemeColors, string> = {
	headerBg: "Header background",
	headerText: "Header text",
	bodyBg: "Body background",
	bodyText: "Body text",
	stripeBg: "Striped background",
	hoverBg: "Row hover",
	borderColor: "Borders",
	accent: "Accent (links, sorting, active page)",
};

const CSS_VAR: Record<keyof ThemeColors, string> = {
	headerBg: "--ft-head-bg",
	headerText: "--ft-head-fg",
	bodyBg: "--ft-bg",
	bodyText: "--ft-fg",
	stripeBg: "--ft-stripe",
	hoverBg: "--ft-hover",
	borderColor: "--ft-border",
	accent: "--ft-accent",
};

const SIMPLE: ThemeDefinition = {
	colors: {
		headerBg: "#f6f8fa",
		headerText: "#1f2328",
		bodyBg: "#ffffff",
		bodyText: "#1f2328",
		stripeBg: "#f6f8fa",
		hoverBg: "#f6f8fa",
		borderColor: "#d8dee4",
		accent: "#2563eb",
	},
	options: { borders: "all", stripes: "none", uppercaseHeader: false },
};

const SIMPLE_DARK: ThemeDefinition = {
	colors: {
		headerBg: "#1a2029",
		headerText: "#e6edf3",
		bodyBg: "#10151c",
		bodyText: "#e6edf3",
		stripeBg: "#161b22",
		hoverBg: "#1a2029",
		borderColor: "#3d444d",
		accent: "#60a5fa",
	},
	options: { borders: "all", stripes: "none", uppercaseHeader: false },
};

export interface BuiltinTheme {
	id: string;
	label: string;
	definition: ThemeDefinition;
}

/** "auto" is listed first and uses SIMPLE / SIMPLE_DARK, switched by the visitor's color scheme in CSS. */
export const BUILTIN_THEMES: BuiltinTheme[] = [
	{ id: "auto", label: "Auto (light / dark)", definition: SIMPLE },
	{ id: "simple", label: "Simple", definition: SIMPLE },
	{ id: "simple-dark", label: "Simple on dark", definition: SIMPLE_DARK },
	{
		id: "minimal",
		label: "Minimal",
		definition: {
			colors: {
				headerBg: "#e8f0fe",
				headerText: "#1e293b",
				bodyBg: "#ffffff",
				bodyText: "#334155",
				stripeBg: "#f5f8ff",
				hoverBg: "#eaf1ff",
				borderColor: "#e2e8f0",
				accent: "#2563eb",
			},
			options: { borders: "horizontal", stripes: "rows", uppercaseHeader: false },
		},
	},
	{
		id: "minimal-dark",
		label: "Minimal on dark",
		definition: {
			colors: {
				headerBg: "#1e1b3a",
				headerText: "#ffffff",
				bodyBg: "#ffffff",
				bodyText: "#334155",
				stripeBg: "#f4f4f8",
				hoverBg: "#ececf4",
				borderColor: "#e5e7eb",
				accent: "#4f46e5",
			},
			options: { borders: "horizontal", stripes: "rows", uppercaseHeader: false },
		},
	},
	{
		id: "minimal-elegant",
		label: "Minimal elegant",
		definition: {
			colors: {
				headerBg: "#6366f1",
				headerText: "#ffffff",
				bodyBg: "#ffffff",
				bodyText: "#374151",
				stripeBg: "#eef2ff",
				hoverBg: "#e0e7ff",
				borderColor: "#e0e7ff",
				accent: "#6366f1",
			},
			options: { borders: "horizontal", stripes: "rows", uppercaseHeader: false },
		},
	},
	{
		id: "uppercase-heading",
		label: "Uppercase heading",
		definition: {
			colors: {
				headerBg: "#f3f4f6",
				headerText: "#4b5563",
				bodyBg: "#ffffff",
				bodyText: "#1f2937",
				stripeBg: "#f9fafb",
				hoverBg: "#f3f4f6",
				borderColor: "#e5e7eb",
				accent: "#2563eb",
			},
			options: { borders: "horizontal", stripes: "none", uppercaseHeader: true },
		},
	},
	{
		id: "uppercase-elegant",
		label: "Uppercase elegant",
		definition: {
			colors: {
				headerBg: "#e0e7ff",
				headerText: "#3730a3",
				bodyBg: "#ffffff",
				bodyText: "#374151",
				stripeBg: "#f8faff",
				hoverBg: "#eef2ff",
				borderColor: "#e0e7ff",
				accent: "#4f46e5",
			},
			options: { borders: "horizontal", stripes: "rows", uppercaseHeader: true },
		},
	},
	{
		id: "vertical",
		label: "Vertical style",
		definition: {
			colors: {
				headerBg: "#5b4fe0",
				headerText: "#ffffff",
				bodyBg: "#ffffff",
				bodyText: "#374151",
				stripeBg: "#f3f1ff",
				hoverBg: "#ebe8ff",
				borderColor: "#e5e7eb",
				accent: "#5b4fe0",
			},
			options: { borders: "horizontal", stripes: "columns", uppercaseHeader: false },
		},
	},
	{
		id: "dark-knight",
		label: "Dark knight",
		definition: {
			colors: {
				headerBg: "#7c6ff0",
				headerText: "#ffffff",
				bodyBg: "#2b2c3d",
				bodyText: "#e5e7eb",
				stripeBg: "#33344a",
				hoverBg: "#3b3d55",
				borderColor: "#3f4058",
				accent: "#a5b4fc",
			},
			options: { borders: "horizontal", stripes: "rows", uppercaseHeader: false },
		},
	},
];

export const CUSTOM_THEME_PREFIX = "custom:";

export function customThemeId(id: string): string {
	return `${CUSTOM_THEME_PREFIX}${id}`;
}

const HEX_COLOR = /^#(?:[0-9a-f]{3,4}|[0-9a-f]{6}|[0-9a-f]{8})$/i;

/** Only plain hex colors are accepted anywhere a theme color is stored, so they're safe to put in a style attribute. */
export function isHexColor(value: unknown): value is string {
	return typeof value === "string" && HEX_COLOR.test(value);
}

/** Drops anything that isn't a known color key with a hex value. */
export function cleanColors(colors: Partial<Record<string, unknown>> | undefined): Partial<ThemeColors> {
	const clean: Partial<ThemeColors> = {};
	for (const key of THEME_COLOR_KEYS) {
		const value = colors?.[key];
		if (isHexColor(value)) clean[key] = value;
	}
	return clean;
}

/** The definition behind a theme id, or null for an unknown id (e.g. a deleted custom theme). */
export function findThemeDefinition(
	themeId: string,
	customThemes: Record<string, ThemeDefinition>,
): ThemeDefinition | null {
	if (themeId.startsWith(CUSTOM_THEME_PREFIX)) {
		return customThemes[themeId.slice(CUSTOM_THEME_PREFIX.length)] ?? null;
	}
	return BUILTIN_THEMES.find((theme) => theme.id === themeId)?.definition ?? null;
}

export interface ResolvedTheme {
	/** Space-separated classes for the table's outer element. */
	className: string;
	/** CSS custom property declarations for its style attribute. Built only from validated hex colors. */
	style: string;
}

/**
 * Turns a theme id plus the table's own color tweaks into the classes and CSS variables the table
 * renders with. An unknown theme id (a custom theme that was deleted) falls back to "auto".
 */
export function resolveTheme(
	themeId: string,
	overrides: Partial<ThemeColors> | undefined,
	customThemes: Record<string, ThemeDefinition> = {},
): ResolvedTheme {
	const definition = findThemeDefinition(themeId, customThemes);
	const isAuto = !definition || themeId === "auto";
	const base = definition ?? SIMPLE;
	const classes = [
		isAuto ? "emdash-sheet-table--auto" : "emdash-sheet-table--themed",
		`ft-borders--${base.options.borders}`,
		`ft-stripes--${base.options.stripes}`,
	];
	if (base.options.uppercaseHeader) classes.push("ft-upper");

	// "auto" takes its colors from the stylesheet (which switches with prefers-color-scheme); only the
	// table's own tweaks go inline. Every other theme puts its full palette inline.
	const colors: Partial<ThemeColors> = { ...(isAuto ? {} : base.colors), ...cleanColors(overrides) };
	const style = THEME_COLOR_KEYS.filter((key) => colors[key])
		.map((key) => `${CSS_VAR[key]}:${colors[key]}`)
		.join(";");
	return { className: classes.join(" "), style };
}
