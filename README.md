# Sheet Table: Google Sheets to Table Plugin for EmDash CMS

**Turn any Google Sheet into a live, searchable, sortable table on your EmDash site.** Edit the
sheet, and your site's table follows. No copy-pasting data, no HTML tables to maintain.

[npm](https://www.npmjs.com/package/emdash-plugin-sheet-table) |
[GitHub](https://github.com/alamriku/emdash-cms-sheet-to-table) |
[Website & demo](https://kazibadrul.com/sheet-table/) |
[Report a bug](https://github.com/alamriku/emdash-cms-sheet-to-table/issues) |
[Pro & support](https://kazibadrul.com/contact/)

```bash
npm install emdash-plugin-sheet-table
```

> **Free and open source (MIT).** Up to 10 tables, unlimited tab groups, public and private
> Google Sheets. Need more? See [Sheet Table Pro](#sheet-table-pro).

## Why Sheet Table?

Your team already keeps its data in Google Sheets: price lists, event schedules, product specs,
staff directories, results. Sheet Table connects that sheet to your EmDash CMS site and keeps the
two in sync. Update a cell in Google Sheets and the table on your website updates on its own,
with no redeploy and no copying.

Visitors get a fast, mobile-friendly table they can search, sort, and page through. You get one
source of truth that anyone on your team can edit, right from the spreadsheet they already use.

## What you can build

- **Price lists and plan comparisons** that marketing updates without touching the site
- **Event schedules and timetables** that change often
- **Product catalogs and spec sheets**, with product images straight from image URLs
- **Staff, member, or resource directories** your visitors can search
- **Results, rankings, and leaderboards** kept current from a shared sheet
- **Inventory and availability lists** managed by non-technical teammates

## Free features

- **Live sync with Google Sheets.** Connect a sheet once. The plugin re-reads it on a schedule
  and caches the result, so pages stay fast and Google isn't called on every visit.
- **Pick the sheet tab from a list.** Paste a sheet link and choose which tab to show from a
  dropdown. No hunting for `gid` numbers in the URL.
- **Private sheets, too.** Connect a Google account (read-only access) and pick any spreadsheet
  and tab you can see, even ones that aren't shared publicly.
- **Tab groups.** Show several tables in one place, switched with tabs like the sheet tabs in
  Google Sheets. Put the tabs above or below the table and reorder them freely.
- **Insert from the editor.** Add a **Sheet Table** or **Sheet Table Tabs** block from the
  editor's slash menu and pick your table from a dropdown. No IDs to copy.
- **Search, sorting, and pagination.** Visitors can search every column, sort by any column
  (numbers sort as numbers), and page through long tables.
- **Responsive layouts.** Choose *Default*, *Collapsible* (rows stack into cards on phones), or
  *Scrollable* (fixed-height table that scrolls).
- **Table width.** Keep a table inside your post's text column, make it *Wide* (grows past the
  column up to a max width you set), or *Full width* (spans the screen with a small edge gap). Wide
  tables stay centered and on screen, even next to a sidebar. Tab groups have the same setting.
- **Light, dark, or automatic theme.** *Auto* follows each visitor's light/dark preference.
- **Links and images.** URLs in cells become clickable links (optionally opening in a new
  tab), and image URLs show as images.
- **Table title, description, and info block.** Show a heading, a short description, and
  "Showing 1 to 10 of 240 entries" under the table.
- **Rows per page, cache duration, and response timeout** are set per table.
- **Load asynchronously or server-render.** Load the table after the page for the fastest first
  paint, or render it on the server so it works without JavaScript and is visible to search
  engines.
- **Duplicate tables and "Sync now".** Copy a table's settings in one click, and refresh any
  table on demand.
- **Clear error messages.** If a sheet becomes private or a link breaks, the admin tells you
  why, and visitors never see another sheet's stale data.
- **Built for EmDash.** Uses EmDash's own storage, settings, cron, and editor blocks, and
  follows the admin's light/dark theme.

## Sheet Table Pro

A Pro version is planned for sites that need more. Features being considered:

- **Unlimited tables** (the free version allows 10)
- **Merged cells** and cell styles (background and text colors, bold) imported from Google Sheets
- **Export buttons:** CSV, Excel, and PDF
- **Sticky header and frozen columns** while scrolling
- **Hide columns or rows**, separately for desktop and mobile
- **Default sort order** when the page loads
- **Premium themes**, a theme customizer, and custom CSS per table
- **Priority support**

Interested, or need a feature for your site? See the [Pro roadmap](https://kazibadrul.com/sheet-table/#pro) or [get in touch](https://kazibadrul.com/contact/).

## Installation

Sheet Table is a **native** EmDash plugin: install it from npm and register it in your Astro
config.

**1. Install the package**

```bash
npm install emdash-plugin-sheet-table
```

**2. Register the plugin** in `astro.config.mjs`:

```js
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

**3. Restart your dev server.** **Sheet Table** now appears in the admin sidebar under Plugins.

## Quick start: show a public Google Sheet

1. In Google Sheets, click **Share** and set access to **Anyone with the link can view**.
2. In the EmDash admin, open **Sheet Table** and click **New table**.
3. Keep **Public sheet URL**, paste the sheet's link, and choose the tab from the
   **Sheet tab** dropdown.
4. Set the display options you want and click **Create table**. The sheet syncs right away.
5. Open a post or page, type `/` in the editor, insert **Sheet Table**, and pick your table.

That's it. The same table can be placed on as many pages as you like.

## Show several tables with tabs

1. Create the tables you want to show (one table per tab).
2. Open **Sheet Table**, switch to **Tab Groups**, and click **New tab group**.
3. Give the group a title, choose whether to show it, and choose whether the tabs sit
   **above** or **below** the table.
4. Add a tab for each table: name it and pick the table. Reorder with ↑ / ↓.
5. Save, then insert the **Sheet Table Tabs** block in the editor and pick your group.

Each table keeps its own settings (theme, search, sorting, loading) inside its tab. If a table
is deleted, its tab is hidden from visitors and the Tab Groups list shows a warning.

## Use private Google Sheets

To show a sheet that isn't shared publicly, connect a Google account once per site. The plugin
asks for **read-only** access to Sheets and Drive.

**Before you start**

- **Set an encryption key.** EmDash encrypts secret settings (the Client Secret and the Google
  token), so your site needs an `EMDASH_ENCRYPTION_KEY` environment variable. Without it, saving
  settings fails with "Plugin secret settings require EMDASH_ENCRYPTION_KEY". Generate one:

  ```bash
  npx emdash secrets generate --write .env
  ```

  EmDash reads the key from the server's environment (`process.env`), and `astro dev` doesn't
  load `.env` into it. Locally, start the dev server with the file loaded:

  ```bash
  node --env-file=.env node_modules/astro/bin/astro.mjs dev
  ```

  In production, set `EMDASH_ENCRYPTION_KEY` in your host's environment settings and keep a
  backup of it. If the key is lost, saved secrets can't be decrypted and must be entered again.
- **Finish EmDash's setup wizard on your real domain.** EmDash records your site's address the
  first time an administrator completes setup at `/_emdash/admin`. The Google redirect address
  depends on it. (The local "dev bypass" shortcut skips this step.)

**Connect Google**

1. In [Google Cloud Console](https://console.cloud.google.com/), create a project and enable the
   **Google Sheets API** and **Google Drive API**.
2. Set up the **OAuth consent screen** (type *External*). While it's in testing mode, add your
   Google account under **Test users**.
3. Under **Credentials**, create an **OAuth client ID** of type **Web application**. Add the
   redirect URI shown on the Sheet Table page
   (`https://your-site/_emdash/api/plugins/sheet-table/oauth/callback`) to **Authorized redirect
   URIs**.
4. In the EmDash admin, open **Sheet Table → Settings** and paste the **Client ID** and
   **Client Secret**.
5. Back on **Sheet Table**, click **Connect Google account** and approve access.
6. When creating a table, choose **Pick from connected Google account**, then pick the
   spreadsheet and tab.

The plugin stores only an encrypted refresh token and creates short-lived access tokens when it
needs them. **Disconnect** revokes access with Google and removes the token.

## How syncing works

- The plugin reads your sheet **on the server** and saves a cached copy. Visitors are served
  that copy. They never contact Google and never see your credentials.
- A background task runs every 15 minutes and refreshes any table whose **cache duration** has
  passed (for example, 1 day). Click **Sync now** to refresh a table immediately.
- If Google is briefly unreachable, the table keeps showing its last good copy. If you point a
  table at a different sheet and it can't be read, the old data is dropped instead of shown.

## Frequently asked questions

**Do I need a Google account or API key?**
Not for public sheets. Share the sheet as "Anyone with the link can view" and paste the link.
You only need a Google Cloud OAuth client if you want to show private sheets.

**How quickly do changes in Google Sheets show up?**
When the table's cache duration runs out (you choose it per table), or right away when you click
**Sync now**.

**How many tables can I create?**
Up to 10 in the free version, and each one can be used on any number of pages. Tab groups are
unlimited.

**Can a spreadsheet with several tabs be used?**
Yes. Pick the tab when you create the table. To show several tabs together, create one table per
tab and put them in a tab group.

**Will it slow down my site?**
No. Pages are served from the cached copy, not from Google. For the fastest first paint, turn on
**Load asynchronously**.

**Is data from a private sheet kept private?**
Only until you put it on a page. Once a table is on your site, anyone can see every row and
column of that tab, including rows beyond the first page. Only use tabs whose data is fine to
publish.

**Do I need to know how to code?**
Only to install the plugin (one npm command and one line in your Astro config). Everything else
happens in the EmDash admin.

## External services and privacy

Sheet Table only contacts Google, and only for the features you use:

| Service | Used for | When |
| --- | --- | --- |
| `docs.google.com`, `*.googleusercontent.com` | Reading public sheets (CSV export) and listing their tabs | When a public table syncs, or when you pick a tab |
| `oauth2.googleapis.com`, `www.googleapis.com` | Connecting a Google account and getting access tokens | Only if you connect Google |
| `sheets.googleapis.com` | Reading private sheets | Only for tables using a connected account |

The plugin sends no telemetry and no analytics. Google's
[Privacy Policy](https://policies.google.com/privacy) and
[Terms of Service](https://policies.google.com/terms) apply to data read from Google.

## Known limitations

- **Up to 10,000 rows per table.** Larger sheets are cut off, and the table says so.
- **Search, sorting, and pagination run in the visitor's browser**, so every row of the table is
  sent to the page. That's fast for typical sheets but not meant for huge datasets.
- **One Google account per site.** All private-sheet tables read through the same connection.
- **Tab list for public sheets** is read from Google's public sheet view. If Google changes that
  page, the dropdown may stop appearing, but pasting a link that includes `#gid=…` still works.

## Changelog

**Unreleased**
- New **Table width** setting for tables and tab groups: *Content width*, *Wide* (with a max width
  in pixels), or *Full width*. Existing tables keep their current width.

**0.1.1**
- Improved documentation.

**0.1.0** (30 September 2026)
- First release: Google Sheets tables with live sync, public and private sheets, tab picker,
  tab groups, editor blocks with table dropdowns, responsive layouts, and light/dark/auto themes.

## Support

- **Bugs and feature requests:** [open an issue on GitHub](https://github.com/alamriku/emdash-cms-sheet-to-table/issues)
- **Questions, Pro, or custom work:** [kazibadrul.com/contact](https://kazibadrul.com/contact/)

## License

MIT © [Kazi Badrul](https://kazibadrul.com)
