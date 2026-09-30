// Lets plain `tsc` resolve `.astro` imports; `astro check` does the real checking of these files.
declare module "*.astro" {
	const Component: (props: Record<string, unknown>) => unknown;
	export default Component;
}
