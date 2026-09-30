# emdash-plugin-sheet-table

A native EmDash CMS plugin that pulls data from a Google Sheet and shows it as a live, cached,
searchable, sortable table you can drop into any piece of content.

> **Free version.** Up to 10 tables, unlimited tab groups, public and private sheets.
> Need more? See [Sheet Table Pro](#sheet-table-pro) or [get in touch](https://kazibadrul.com/contact/).

## What this covers

- Connect a Google Sheet by URL; the plugin polls it on a schedule and caches the result.
- Configurable cache duration and response timeout per table.
- Search, client-side sorting, pagination, and an "info block" ("Showing X to Y of Z").
- Three responsive styles: default, collapsible (stacked on mobile), and scrollable.
- Themes: Simple (light), Simple (dark), and Auto (follows the visitor's OS/browser preference).
- Link and image-URL detection (renders `<a>` / `<img>` instead of raw text).
- Table title/description, duplicate table, manual "Sync now", multisite works for free since
  every EmDash site is its own deployment.
- Embeds via a Portable Text block (`sheet-table`) inserted from the editor's slash menu.
- Tab groups: several tables in one block (`sheet-table-tabs`), switched with tabs above or
  below the table.
- Optional Google OAuth connection: once connected, tables can read **private** sheets through
  the real Sheets API, picked from a spreadsheet/tab dropdown instead of a pasted URL. The
  public-CSV path still works with no setup for anyone who doesn't need private sheets.

Free version limit: up to **10 tables** per site. Each table can be used on as many pages as
you like, and tab groups are unlimited.

## Install

```bash
npm install emdash-plugin-sheet-table   # or: pnpm add emdash-plugin-sheet-table
```

```js title="astro.config.mjs"
import { defineConfig } from "astro/config";
import emdash from "emdash/astro";
import { sheetTablePlugin } from "emdash-plugin-sheet-table";

export default defineConfig({
	integrations: [
		emdash({
			plugins: [sheetTablePlugin()],
		}),
	],
});
```

This is a **native** plugin (full process trust, no sandbox runner needed) because it ships a
Portable Text rendering component and a React admin UI — both are native-only surfaces in
EmDash. It declares one capability, `network:request`, restricted to `docs.google.com`,
`*.googleusercontent.com` (the CDN host Google's CSV export redirects to), `oauth2.googleapis.com`,
`www.googleapis.com`, and `sheets.googleapis.com`.

## Using it — public sheets (no setup)

1. Share the Google Sheet as "Anyone with the link can view" (or publish it to the web). This
   path reads the sheet through its public CSV export endpoint — no Google account connection
   needed.
2. In the admin, open **Plugins → Sheet Table → Tables → New table**, choose **Public sheet
   URL**, paste the link, and configure display options. Saving triggers an immediate sync.
3. In the content editor, open the slash menu, insert **Sheet Table**, and pick the table from
   its **Table** dropdown.

The free version allows up to 10 tables. Each table can be used on as many pages as you like.

A recurring cron task (`sheet-table-sync`, every 15 minutes) refreshes every table whose cache
has expired; the per-table "Cache duration" setting controls how stale data can get before that
happens. "Sync now" on the Tables page forces an immediate refresh regardless of cache age.

## Using it — tab groups (several tables behind tabs)

A tab group shows several tables in one block. Visitors switch between them with tabs, like the
sheet tabs at the bottom of Google Sheets.

1. Create the tables first (see above). Each tab shows one table.
2. Open **Plugins → Sheet Table**, switch to **Tab Groups**, and click **New tab group**. Give it a title, choose whether to show
   the title, and choose whether the tabs sit **above** or **below** the table.
3. Add a tab for each table: give it a name and pick the table. Use ↑ / ↓ to reorder.
4. Save.
5. In the content editor, insert **Sheet Table Tabs** from the slash menu and pick the group
   from its **Tab group** dropdown.

Each table keeps its own settings (theme, search, sorting, async loading) inside its tab. If a
table is deleted, its tab is hidden from visitors and the tab group list shows a warning.

## Using it — private sheets (Google OAuth)

To read a sheet that isn't publicly link-viewable, connect a Google account once per site.

**Prerequisite:** EmDash records the site's canonical URL once, the first time an administrator
completes the real setup wizard at `/_emdash/admin` on the site's real domain. Until that's done,
`ctx.url()` (and this plugin's redirect URI) resolves to a relative path, which Google will
reject. The local dev-bypass shortcut some EmDash dev tooling offers skips this and leaves the
URL unset — if the Google Account panel says the site has no canonical URL, that's why. Complete
setup for real first.

**Prerequisite:** EmDash encrypts secret plugin settings (the Client Secret and the stored Google
token), so the site needs an `EMDASH_ENCRYPTION_KEY` environment variable. Without it, saving the
settings fails with "Plugin secret settings require EMDASH_ENCRYPTION_KEY". Generate one with:

```bash
npx emdash secrets generate --write .env
```

EmDash reads the key from the server's real environment (`process.env`), and `astro dev` does not
load `.env` into it. Locally, start the dev server with the file loaded:

```bash
node --env-file=.env node_modules/astro/bin/astro.mjs dev
```

In production, set `EMDASH_ENCRYPTION_KEY` in your host's environment settings, and keep a backup
of it: if the key is lost, saved secrets can't be decrypted and must be entered again.

1. In [Google Cloud Console](https://console.cloud.google.com/), create (or reuse) a project,
   enable the **Google Sheets API** and **Google Drive API**, then create an **OAuth client ID**
   of type **Web application** under *APIs & Services → Credentials*.
2. Open **Plugins → Sheet Table → Tables** in the EmDash admin. The Google Account panel there
   shows the exact **redirect URI** this site expects
   (`<site>/_emdash/api/plugins/sheet-table/oauth/callback`). Add that exact URI to the OAuth
   client's **Authorized redirect URIs** in Google Cloud Console.
3. While your OAuth consent screen is in "Testing" mode, add the Google account(s) that will
   connect as **test users** — otherwise Google will refuse the consent screen for anyone but
   the project owner. Publish the consent screen if you want any Google account to be able to
   connect, not just listed test users.
4. Back in the EmDash admin, open **Plugins**, find the Sheet Table card, and open its settings
   form. Paste the OAuth **Client ID** and **Client Secret** from step 1 there.
5. Return to **Tables**, click **Connect Google account**, and approve the consent screen
   (read-only Drive + Sheets access).
6. When creating or editing a table, choose **Pick from connected Google account** and select
   the spreadsheet and tab from the dropdowns — no URL or gid to copy.

The plugin stores only a refresh token (AES-GCM encrypted at rest by EmDash's settings store,
scoped to this plugin) and mints short-lived access tokens on demand; it never persists an
access token. **Disconnect** on the Tables page revokes the token with Google and clears it.

## Known limitations

- **No dynamic table picker in the block editor.** EmDash's Portable Text block fields are a
  static form schema (Block Kit), not a live-searchable reference field, so inserting a table
  means pasting its ID rather than picking it from a dropdown.
- **Sorting/search/pagination are client-side** against the cached snapshot (via a small inline
  script in the rendered block), not server-rendered — fine for typical sheet sizes, but not
  built for tens of thousands of rows.
- **One Google connection per site**, not per table or per user. Every OAuth-sourced table on a
  site reads through the same connected account.

## Sheet Table Pro

A Pro version is planned for sites that need more. Features being considered:

- **Unlimited tables** (the free version allows 10)
- **Merged cells** and cell styles (colors, bold) imported from Google Sheets
- **Export** buttons: CSV, Excel and PDF
- **Freeze** the header row and first column while scrolling
- **Premium themes** and custom CSS per table
- **Priority support**

Interested, or need a feature for your site? [Contact me](https://kazibadrul.com/contact/).

## Support

Found a bug or have a question? Reach out at [kazibadrul.com/contact](https://kazibadrul.com/contact/).

## License

MIT © [Kazi Badrul](https://kazibadrul.com)
