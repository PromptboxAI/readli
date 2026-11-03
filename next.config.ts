import type { NextConfig } from "next";
import { helpLinkMap } from "./src/lib/help/search";

const nextConfig: NextConfig = {
  reactStrictMode: true,
  poweredByHeader: false,
  // In-app help links point only at articles this build publishes (drafts stay off the production site).
  env: { NEXT_PUBLIC_HELP_LINKS: JSON.stringify(helpLinkMap()) },
  // No other site may frame Readli (clickjacking on parent controls), browsers mustn't guess file types,
  // links out never carry a page's path (invitation, gift and demo links have tokens in them), and the
  // microphone is for Readli's own pages only.
  async headers() {
    return [
      {
        source: "/:path*",
        headers: [
          { key: "X-Frame-Options", value: "DENY" },
          { key: "Content-Security-Policy", value: "frame-ancestors 'none'" },
          { key: "X-Content-Type-Options", value: "nosniff" },
          { key: "Referrer-Policy", value: "strict-origin-when-cross-origin" },
          { key: "Strict-Transport-Security", value: "max-age=63072000" },
          { key: "Permissions-Policy", value: "microphone=(self), geolocation=()" },
        ],
      },
    ];
  },
  // Account settings and Parent Controls became Settings (2026-10-29). Old links, in emails and bookmarks, keep working; the query string carries over.
  async redirects() {
    return [
      { source: "/family/controls", destination: "/family/settings", permanent: false },
      { source: "/family/account", destination: "/family/settings/account", permanent: false },
      { source: "/family/billing", destination: "/family/settings/plan", permanent: false },
      { source: "/family/credits", destination: "/family/settings/plan", permanent: false },
      { source: "/family/devices", destination: "/family/settings/kids-mode", permanent: false },
    ];
  },
};

export default nextConfig;
