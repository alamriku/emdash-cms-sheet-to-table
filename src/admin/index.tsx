import type { PluginAdminExports } from "emdash";

import { SheetTableStatusWidget } from "./DashboardWidget.js";
import { TabGroupsPage } from "./TabGroupsPage.js";
import { TablesPage } from "./TablesPage.js";
import { withPluginStyles } from "./shared.js";

export const pages: PluginAdminExports["pages"] = {
	"/tables": withPluginStyles(TablesPage),
	"/tab-groups": withPluginStyles(TabGroupsPage),
};

export const widgets: PluginAdminExports["widgets"] = {
	"sheet-table-status": withPluginStyles(SheetTableStatusWidget),
};
