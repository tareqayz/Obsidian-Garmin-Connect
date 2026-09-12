/**
 * Constants mirroring cyberjunky/python-garminconnect @ master (the post-2026-03
 * rewrite that dropped garth). The old OAuth1 `preauthorized` / `exchange/user/2.0`
 * flow is gone; this is the mobile-app flow that replaced it.
 */

export type GarminDomain = "garmin.com" | "garmin.cn";

/** The iOS Garmin Connect Mobile app's SSO client. */
export const IOS_SSO_CLIENT_ID = "GCM_IOS_DARK";

export const IOS_LOGIN_UA =
	"Mozilla/5.0 (iPhone; CPU iPhone OS 18_7 like Mac OS X) " +
	"AppleWebKit/605.1.15 (KHTML, like Gecko) Mobile/15E148";

export const DI_GRANT_TYPE =
	"https://connectapi.garmin.com/di-oauth2-service/oauth/grant/service_ticket";

/** Tried in order; the first that returns 200 wins. Garmin rotates these quarterly. */
export const DI_CLIENT_IDS = [
	"GARMIN_CONNECT_MOBILE_ANDROID_DI_2025Q2",
	"GARMIN_CONNECT_MOBILE_ANDROID_DI_2024Q4",
	"GARMIN_CONNECT_MOBILE_ANDROID_DI",
	"GARMIN_CONNECT_MOBILE_IOS_DI",
] as const;

export function endpoints(domain: GarminDomain) {
	return {
		sso: `https://sso.${domain}`,
		connectApi: `https://connectapi.${domain}`,
		diToken: `https://diauth.${domain}/di-oauth2-service/oauth/token`,
		iosService: `https://mobile.integration.${domain}/gcm/ios`,
	};
}

/** Header set the Android app sends on every authenticated call. */
export function nativeHeaders(extra?: Record<string, string>): Record<string, string> {
	return {
		"User-Agent": "GCM-Android-5.23",
		"X-Garmin-User-Agent":
			"com.garmin.android.apps.connectmobile/5.23; ; Google/sdk_gphone64_arm64/google; " +
			"Android/33; Dalvik/2.1.0",
		"X-Garmin-Paired-App-Version": "10861",
		"X-Garmin-Client-Platform": "Android",
		"X-App-Ver": "10861",
		"X-Lang": "en",
		"X-GCExperience": "GC5",
		"Accept-Language": "en-US,en;q=0.9",
		...extra,
	};
}

/** DI's token endpoint uses HTTP Basic with an empty password. */
export function basicAuth(clientId: string): string {
	return `Basic ${btoa(`${clientId}:`)}`;
}
