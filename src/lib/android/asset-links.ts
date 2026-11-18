/** The Readli Android app's package name, as in android/app/build.gradle. */
export const ANDROID_PACKAGE = "ai.readli.app";

/**
 * The Digital Asset Links statement that lets the Android app open readli.ai full screen and take
 * Readli links. It vouches only for the signing keys listed in ANDROID_CERT_FINGERPRINTS (SHA-256,
 * comma separated, as Play Console shows them), so an app signed with any other key gets nothing.
 */
export function assetLinks(fingerprints: string | undefined) {
  const keys = (fingerprints ?? "")
    .split(/[\s,]+/)
    .map((k) => k.trim().toUpperCase())
    .filter((k) => /^([0-9A-F]{2}:){31}[0-9A-F]{2}$/.test(k));
  if (keys.length === 0) return [];
  return [
    {
      relation: ["delegate_permission/common.handle_all_urls"],
      target: { namespace: "android_app", package_name: ANDROID_PACKAGE, sha256_cert_fingerprints: [...new Set(keys)] },
    },
  ];
}
