# Readli for Android

The Android app is a **Trusted Web Activity (TWA)**. It's a real Play Store app that opens
`https://readli.ai/family` full screen in the phone's own Chrome. Recording, playback, lock-screen
controls and Google sign-in work exactly as they do on the website, and every website deploy updates
the app without a new Play release. A new Play release is only needed if something in `android/`
changes (the icon, name, colours or start page).

## What's in the repo

| Path | What it is |
|---|---|
| `android/` | The Android project (package `ai.readli.app`). It has no app code of its own: Google's `androidbrowserhelper` library opens the site. |
| `android/store/play-icon-512.png` | The 512×512 icon for the Play listing. |
| `src/app/.well-known/assetlinks.json/route.ts` | The file Android checks to confirm readli.ai trusts the app. It lists the signing keys from the `ANDROID_CERT_FINGERPRINTS` Vercel env var. |
| `.github/workflows/android.yml` | Builds the app on GitHub. You don't need Android Studio. |

## Install the test app on a phone

1. On GitHub, open **Releases** and pick the newest **Readli Android test build**. (A build from a
   pull request that isn't merged yet is under **Actions → Android app → the run → Artifacts** as a zip.)
2. Open that page on the Android phone, signed in to GitHub, and tap the `.apk` file.
3. Android asks whether Chrome may install apps. Allow it, then tap **Install**.
4. Open Readli from the home screen.

Newer test builds install over the old one. If Android ever says the app "conflicts with an existing
package", uninstall Readli first and install again.

**The address bar at the top** stays until readli.ai vouches for the app's signing key. To remove it
in test builds, copy the "Test key SHA-256" from the workflow run's summary page and add it to
`ANDROID_CERT_FINGERPRINTS` on Vercel (Production). Then redeploy, force-stop the app and open it again.
Everything else works the same with the bar showing.

## Putting it on Google Play

Only you can do these steps, because they're tied to your identity and your Google account.

1. **Create a Play developer account** at <https://play.google.com/console>: a $25 one-time fee and
   ID verification, which takes a few days. Choose an organization account if Readli has a company
   with a D-U-N-S number. New *personal* accounts have to run a closed test with at least 12 testers
   for 14 days before the app can go public. Organization accounts skip that.
2. **Create the app** in Play Console: name "Readli", app (not game), free.
3. **Make an upload key.** This is the key the build signs with, and Google re-signs the app for
   users ("Play App Signing"), so a lost upload key can be reset. Claude can generate it and tell you
   what to paste into GitHub (**Settings → Secrets and variables → Actions**):
   `ANDROID_KEYSTORE_BASE64`, `ANDROID_KEYSTORE_PASSWORD`, `ANDROID_KEY_ALIAS`, `ANDROID_KEY_PASSWORD`.
   After that, each build also makes `readli-play-<n>.aab`, the file Play wants.
4. **Upload the `.aab`** to a testing track (Internal testing first). Play Console then shows the
   **app signing key** SHA-256 on its **App integrity** page (search "App integrity" in Play Console). Add it to
   `ANDROID_CERT_FINGERPRINTS` on Vercel, comma separated from the test key, and redeploy.
   Without this, people who install from Play see the address bar.
5. **Fill in the store listing and policies**: description, phone screenshots, the 512 icon above,
   the privacy policy URL (`https://readli.ai/privacy`), content rating, data safety (microphone
   recordings, account email), and **Target audience**. Readli is used by children but is set up by
   parents, so answer carefully: choosing under-13 ages enrols the app in Google's Families policy.
6. **Billing.** Google requires Google Play Billing for subscriptions bought *inside* an Android app.
   The app must not show buy, upgrade or credit-pack buttons that go to Stripe until a billing choice
   is made. Hiding them inside the app is a separate change.

## Changing the app

* **Start page, colours, name:** `android/app/src/main/res/values/` (`strings.xml`, `colors.xml`).
* **Icon:** regenerate the PNGs in `android/app/src/main/res/mipmap-*` from `src/app/icon.png`.
* **Version:** the build number comes from the GitHub run number, so each upload to Play is higher than the last.
