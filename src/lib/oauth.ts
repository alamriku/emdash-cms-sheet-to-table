import type { PluginContext } from "emdash/plugin";

const AUTH_URL = "https://accounts.google.com/o/oauth2/v2/auth";
const TOKEN_URL = "https://oauth2.googleapis.com/token";
const REVOKE_URL = "https://oauth2.googleapis.com/revoke";
const USERINFO_URL = "https://www.googleapis.com/oauth2/v2/userinfo";

export const OAUTH_SCOPES = [
	"https://www.googleapis.com/auth/drive.readonly",
	"https://www.googleapis.com/auth/spreadsheets.readonly",
	"https://www.googleapis.com/auth/userinfo.email",
];

const STATE_KEY_PREFIX = "oauth:state:";
const STATE_TTL_MS = 10 * 60 * 1000;

export function callbackUrl(ctx: PluginContext): string {
	// ctx.url() only prefixes the site origin, so the plugin route's full path has to be spelled out.
	return ctx.url("/_emdash/api/plugins/sheet-table/oauth/callback");
}

export async function createOAuthState(ctx: PluginContext): Promise<string> {
	const state = crypto.randomUUID();
	await ctx.kv.set(`${STATE_KEY_PREFIX}${state}`, { createdAt: Date.now() });
	return state;
}

/** Validates and consumes a one-time OAuth state value. */
export async function consumeOAuthState(ctx: PluginContext, state: string): Promise<boolean> {
	const key = `${STATE_KEY_PREFIX}${state}`;
	const stored = await ctx.kv.get<{ createdAt: number }>(key);
	await ctx.kv.delete(key);
	if (!stored) return false;
	return Date.now() - stored.createdAt <= STATE_TTL_MS;
}

export interface GoogleClientConfig {
	clientId: string;
	clientSecret: string;
}

export async function getClientConfig(ctx: PluginContext): Promise<GoogleClientConfig | null> {
	const clientId = await ctx.settings.get<string>("googleClientId");
	const clientSecret = await ctx.settings.get<string>("googleClientSecret");
	if (!clientId || !clientSecret) return null;
	return { clientId, clientSecret };
}

export async function buildAuthUrl(ctx: PluginContext, state: string): Promise<string | null> {
	const config = await getClientConfig(ctx);
	if (!config) return null;

	const params = new URLSearchParams({
		client_id: config.clientId,
		redirect_uri: callbackUrl(ctx),
		response_type: "code",
		scope: OAUTH_SCOPES.join(" "),
		access_type: "offline",
		prompt: "consent",
		state,
	});
	return `${AUTH_URL}?${params.toString()}`;
}

interface TokenResponse {
	access_token: string;
	expires_in: number;
	refresh_token?: string;
	token_type: string;
	scope: string;
}

export async function exchangeCodeForRefreshToken(
	ctx: PluginContext,
	code: string,
): Promise<{ refreshToken: string; accessToken: string } | { error: string }> {
	const config = await getClientConfig(ctx);
	if (!config) return { error: "Google Client ID/Secret not configured" };
	if (!ctx.http) return { error: "Network capability not granted" };

	const response = await ctx.http.fetch(TOKEN_URL, {
		method: "POST",
		headers: { "Content-Type": "application/x-www-form-urlencoded" },
		body: new URLSearchParams({
			client_id: config.clientId,
			client_secret: config.clientSecret,
			code,
			grant_type: "authorization_code",
			redirect_uri: callbackUrl(ctx),
		}).toString(),
	});

	if (!response.ok) {
		return { error: `Google rejected the authorization code (${response.status})` };
	}
	const data = (await response.json()) as TokenResponse;
	if (!data.refresh_token) {
		return {
			error:
				"Google did not return a refresh token. Disconnect any prior grant for this app at https://myaccount.google.com/permissions and try connecting again.",
		};
	}
	return { refreshToken: data.refresh_token, accessToken: data.access_token };
}

/** Exchanges the stored refresh token for a fresh access token. Not cached; called once per sync. */
export async function getAccessToken(ctx: PluginContext): Promise<string | null> {
	const config = await getClientConfig(ctx);
	const refreshToken = await ctx.settings.get<string>("googleRefreshToken");
	if (!config || !refreshToken || !ctx.http) return null;

	const response = await ctx.http.fetch(TOKEN_URL, {
		method: "POST",
		headers: { "Content-Type": "application/x-www-form-urlencoded" },
		body: new URLSearchParams({
			client_id: config.clientId,
			client_secret: config.clientSecret,
			refresh_token: refreshToken,
			grant_type: "refresh_token",
		}).toString(),
	});
	if (!response.ok) return null;
	const data = (await response.json()) as TokenResponse;
	return data.access_token;
}

export async function fetchConnectedEmail(ctx: PluginContext, accessToken: string): Promise<string | null> {
	if (!ctx.http) return null;
	const response = await ctx.http.fetch(USERINFO_URL, {
		headers: { Authorization: `Bearer ${accessToken}` },
	});
	if (!response.ok) return null;
	const data = (await response.json()) as { email?: string };
	return data.email ?? null;
}

export async function disconnectGoogle(ctx: PluginContext): Promise<void> {
	const refreshToken = await ctx.settings.get<string>("googleRefreshToken");
	if (refreshToken && ctx.http) {
		try {
			await ctx.http.fetch(REVOKE_URL, {
				method: "POST",
				headers: { "Content-Type": "application/x-www-form-urlencoded" },
				body: new URLSearchParams({ token: refreshToken }).toString(),
			});
		} catch {
			// Best-effort revoke; still clear local state below.
		}
	}
	await ctx.settings.delete("googleRefreshToken");
	await ctx.settings.delete("googleConnectedEmail");
}
