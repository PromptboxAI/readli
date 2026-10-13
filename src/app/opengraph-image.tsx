import { ImageResponse } from "next/og";

export const alt = "Readli: Every Book. Every Voice. Their favorite stories, read by their favorite people.";
export const size = { width: 1200, height: 630 };
export const contentType = "image/png";

/** The default share card for any page that doesn't set its own image. Colors follow globals.css. */
export default function OpengraphImage() {
  return new ImageResponse(
    (
      <div style={{ width: "100%", height: "100%", display: "flex", position: "relative", background: "#7bc7f3", color: "#283548" }}>
        <div style={{ position: "absolute", right: 90, top: 110, width: 380, height: 380, borderRadius: "40% 60% 55% 45%", background: "#9ce2bc" }} />
        <div style={{ position: "absolute", right: 420, bottom: 90, width: 110, height: 110, borderRadius: 32, background: "#ffce58" }} />
        <div style={{ position: "absolute", right: 110, top: 70, width: 90, height: 90, borderRadius: 999, background: "#cbb7f5" }} />
        <div style={{ position: "absolute", left: 0, right: 0, bottom: 0, height: 70, background: "#fff9ed" }} />
        <div style={{ display: "flex", flexDirection: "column", justifyContent: "center", padding: "0 80px 70px", width: 760, gap: 22 }}>
          <div style={{ fontSize: 34, fontWeight: 700, color: "#c9402f" }}>Every Book. Every Voice.</div>
          <div style={{ fontSize: 66, fontWeight: 700, lineHeight: 1.05 }}>Their favorite stories. Read by their favorite people.</div>
          <div style={{ fontSize: 44, fontWeight: 700, marginTop: 10 }}>readli.ai</div>
        </div>
      </div>
    ),
    size,
  );
}
