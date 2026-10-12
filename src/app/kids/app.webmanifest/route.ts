/**
 * The Readli Kids home-screen app. Saved from the kids bookshelf, it opens straight to Readli Kids in
 * its own window, without the website around it.
 */
export function GET() {
  return Response.json(
    {
      name: "Readli Kids",
      short_name: "Readli Kids",
      id: "/kids",
      start_url: "/kids",
      scope: "/kids",
      display: "standalone",
      orientation: "any",
      background_color: "#FFF9ED",
      theme_color: "#FFF9ED",
      icons: [
        { src: "/icon.png", sizes: "512x512", type: "image/png", purpose: "any" },
        { src: "/apple-icon.png", sizes: "180x180", type: "image/png" },
      ],
    },
    { headers: { "content-type": "application/manifest+json", "cache-control": "public, max-age=3600" } },
  );
}
