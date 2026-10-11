// Lets plain `tsc` resolve `.astro` imports; `astro check` does the real checking of these files.
declare module "*.astro" {
	const Component: (props: Record<string, unknown>) => unknown;
	export default Component;
}

// Vite's `?raw` suffix imports a file's text; the admin preview uses it to load the table stylesheet.
declare module "*.css?raw" {
	const css: string;
	export default css;
}
