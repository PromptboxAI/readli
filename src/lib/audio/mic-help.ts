/** Where the reader is, as far as fixing a blocked microphone goes. */
export type MicPlatform = "in_app" | "ios_safari" | "ios_chrome" | "ios_other" | "android_chrome" | "samsung" | "android_other" | "desktop";

const IN_APP = /FBAN|FBAV|FB_IAB|Instagram|Line\/|Snapchat|TikTok|musical_ly|Twitter|LinkedInApp|Pinterest|GSA\/|; wv\)/i;

export function micPlatform(ua: string): MicPlatform {
  if (IN_APP.test(ua)) return "in_app";
  const ios = /iPhone|iPad|iPod/i.test(ua) || (/Macintosh/.test(ua) && /Mobile/.test(ua));
  if (ios) return /CriOS/.test(ua) ? "ios_chrome" : /FxiOS|EdgiOS|OPiOS/.test(ua) ? "ios_other" : "ios_safari";
  if (/Android/i.test(ua)) return /SamsungBrowser/.test(ua) ? "samsung" : /Chrome\//.test(ua) && !/EdgA|OPR|Firefox/.test(ua) ? "android_chrome" : "android_other";
  return "desktop";
}

/** Step-by-step help for a microphone the browser blocked, in the reader's own browser. */
export function micBlockedSteps(platform: MicPlatform): { lead: string; steps: string[] } {
  switch (platform) {
    case "in_app":
      return {
        lead: "This page is open inside another app, which doesn't let websites use the microphone.",
        steps: ["Tap the ⋯ or share menu and choose Open in browser (Safari or Chrome).", "Go to readli.ai/try there and record."],
      };
    case "ios_safari":
      return {
        lead: "Safari blocked the microphone for readli.ai.",
        steps: [
          "Tap the AA (or page settings) icon at the left of the address bar, then Website Settings.",
          "Set Microphone to Allow or Ask.",
          "If it's missing there, open the Settings app, then Apps, Safari, Microphone, and choose Ask or Allow.",
          "Come back, reload this page and tap Start recording.",
        ],
      };
    case "ios_chrome":
    case "ios_other":
      return {
        lead: "Your phone blocked the microphone for this browser.",
        steps: [
          `Open the Settings app, find ${platform === "ios_chrome" ? "Chrome" : "this browser"} in the app list, and switch Microphone on.`,
          "Come back, reload this page and tap Start recording.",
        ],
      };
    case "android_chrome":
      return {
        lead: "Chrome blocked the microphone for readli.ai. This happens if the request was dismissed before.",
        steps: [
          "Tap the icon at the left of the address bar, then Permissions (or Site settings).",
          "Set Microphone to Allow. If it says Reset permissions, tap that.",
          "Still blocked? In the phone's Settings, go to Apps, Chrome, Permissions, Microphone, and allow it.",
          "Reload this page and tap Start recording.",
        ],
      };
    case "samsung":
      return {
        lead: "Samsung Internet blocked the microphone for readli.ai.",
        steps: [
          "Tap the lock icon in the address bar, then Permissions, and allow Microphone.",
          "Still blocked? In the phone's Settings, go to Apps, Samsung Internet, Permissions, Microphone, and allow it.",
          "Reload this page and tap Start recording.",
        ],
      };
    case "android_other":
      return {
        lead: "Your browser blocked the microphone for readli.ai.",
        steps: [
          "Tap the lock or info icon in the address bar and allow Microphone.",
          "Check the phone's Settings, Apps, then your browser, Permissions, Microphone.",
          "Reload this page and tap Start recording. Chrome is the most reliable choice on Android.",
        ],
      };
    default:
      return {
        lead: "Your browser blocked the microphone for readli.ai.",
        steps: [
          "Click the lock or settings icon at the left of the address bar and set Microphone to Allow.",
          "On a Mac, also check System Settings, Privacy & Security, Microphone, and switch your browser on.",
          "Reload this page and click Start recording.",
        ],
      };
  }
}
