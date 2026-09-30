import { apiFetch, getErrorMessage, parseApiResponse } from "emdash/plugin-utils";
import * as React from "react";

interface TableListItem {
	id: string;
	syncedAt: string | null;
	syncError: string | null;
}

export function SheetTableStatusWidget() {
	const [items, setItems] = React.useState<TableListItem[] | null>(null);
	const [error, setError] = React.useState<string | null>(null);

	React.useEffect(() => {
		let cancelled = false;
		async function load() {
			try {
				const response = await apiFetch("/_emdash/api/plugins/sheet-table/tables/list");
				if (!response.ok) {
					setError(await getErrorMessage(response, "Could not load Sheet Table status"));
					return;
				}
				const data = await parseApiResponse<{ items: TableListItem[] }>(response);
				if (!cancelled) setItems(data.items);
			} catch (cause) {
				if (!cancelled) setError(cause instanceof Error ? cause.message : "Could not load Sheet Table status");
			}
		}
		void load();
		return () => {
			cancelled = true;
		};
	}, []);

	if (error) return <p className="text-xs text-red-500">{error}</p>;
	if (!items) return <p className="text-sm text-muted-foreground">Loading…</p>;

	const withErrors = items.filter((item) => item.syncError).length;

	return (
		<div className="space-y-1 text-sm">
			<p>{items.length} table{items.length === 1 ? "" : "s"} connected</p>
			{withErrors > 0 && <p className="text-red-500">{withErrors} failing to sync</p>}
		</div>
	);
}
