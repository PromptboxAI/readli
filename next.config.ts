import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  reactStrictMode: true,
  poweredByHeader: false,
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
