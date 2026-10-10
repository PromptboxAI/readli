import { chromium } from "@playwright/test";
const b = await chromium.launch({ executablePath: "/opt/pw-browsers/chromium" });
const p = await b.newPage({ viewport: { width: 1440, height: 900 } });
p.on("response", (r) => { if (r.status() >= 400) console.log("BAD", r.status(), r.url()); });
await p.goto("http://localhost:3100/");
for (let y = 0; y < 12000; y += 600) { await p.evaluate((t) => scrollTo(0, t), y); await p.waitForTimeout(80); }
await p.waitForTimeout(2000);
console.log(await p.evaluate(() => [...document.images].filter((i) => !(i.complete && i.naturalWidth > 0)).map((i) => i.currentSrc || i.src)));
await b.close();
