// Rendered-HTML audit. Start the site (npm run build && npm start), then:
//   node scripts/audit_pages.mjs http://localhost:3000 data
// Needs Playwright (npm i -g playwright). Checks every page at 1280px and 375px for:
// a real school name inside a simulated element, more than one health band on a real
// school page, a past date under "Coming up", a projection quoted in alert text, and
// horizontal page scroll. Exits 1 on any failure.
import { readFileSync } from "node:fs";
const { chromium } = await import("playwright").catch(async () => {
  const { createRequire } = await import("node:module");
  const { execSync } = await import("node:child_process");
  return createRequire(execSync("npm root -g").toString().trim() + "/")("playwright");
});

const [base, dataDir] = process.argv.slice(2);
const csv = (f) => { const [h, ...rows] = readFileSync(f, "utf8").trim().split("\n"); const k = h.split(","); return rows.map((r) => { const v = r.match(/("([^"]|"")*"|[^,]*)(,|$)/g).map((x) => x.replace(/,$/, "").replace(/^"|"$/g, "").replace(/""/g, '"')); return Object.fromEntries(k.map((x, i) => [x, v[i]])); }); };
const schools = csv(`${dataDir}/schools.csv`);
const match = csv(`${dataDir}/match_review.csv`);
// Every name a real school appears under, plus its core name without "School"
const names = new Set();
for (const s of schools) names.add(s.name);
for (const m of match) { names.add(m.directory_name); names.add(m.cde_name); for (const f of (m.former_cde_names || "").split(/\s*;\s*/)) if (f) names.add(f); }
for (const n of ["St. Lawrence School", "St. Joseph School (Mountain View)", "St. Joseph of Cupertino School"]) names.add(n);
const cores = [...names].map((n) => n.replace(/\s*\(.*\)\s*/, "").replace(/ (School|Schools|Catholic School|Elementary|Elementary and Middle School)$/, "").trim()).filter((n) => n.length > 6 && !/^St\.? Joseph$/.test(n));
const realNames = [...new Set([...names, ...cores])].filter(Boolean);

const paths = ["/", "/alerts", "/alerts?view=demo", "/turnaround", "/demo", "/about", "/about-me",
  ...schools.filter((s) => s.governance === "parish_elementary").map((s) => `/schools/${s.id}`),
  ..."abcdefghijklmnopqrstuvwxy".split("").map((l) => `/demo/schools/demo-${l}`)];

const browser = await chromium.launch();
const fails = [];
for (const width of [1280, 375]) {
  const page = await browser.newPage({ viewport: { width, height: 900 } });
  for (const p of paths) {
    const res = await page.goto(base + p, { waitUntil: "networkidle" });
    if (!res.ok()) { fails.push(`${p}: HTTP ${res.status()}`); continue; }
    await page.waitForTimeout(150);
    const r = await page.evaluate((realNames) => {
      const out = { simWithName: [], bands: 0, overflow: document.documentElement.scrollWidth - window.innerWidth, comingUpPast: [], alertProj: [] };
      // 1. no real school name inside a simulated element (cards, stats, notes, tiles)
      for (const el of document.querySelectorAll("[data-simulated], .sample-edge")) {
        const t = el.textContent || "";
        for (const n of realNames) if (t.includes(n)) out.simWithName.push(`${n} in "${t.slice(0, 80)}"`);
      }
      // 2. tier/band pills on the page
      out.bands = [...document.querySelectorAll("[data-band]")].map((s) => "-" + s.dataset.band);
      // 3. "Coming up" shows nothing earlier than today
      const cal = document.getElementById("cal-h")?.closest("section");
      if (cal) {
        const today = new Date(); today.setHours(0, 0, 0, 0);
        const ul = cal.querySelector("ul");
        for (const li of ul ? ul.querySelectorAll(":scope > li") : []) {
          const m = li.textContent.match(/([A-Z][a-z]{2} \d{1,2})(?: – ([A-Z][a-z]{2} \d{1,2}))?/);
          if (!m) continue;
          const yr = today.getFullYear();
          let end = new Date(`${m[2] || m[1]} ${yr}`);
          if (end < today && today - end > 180 * 864e5) end = new Date(`${m[2] || m[1]} ${yr + 1}`);
          if (end < today) out.comingUpPast.push(li.textContent.slice(0, 80));
        }
      }
      // 4. alert text never quotes a projection
      for (const li of document.querySelectorAll("#att-h, #watch-h, #al-h, #top-h")) {
        const sec = li.closest("section"); if (!sec) continue;
        const t = sec.querySelector("ul, ol")?.textContent || "";
        if (/project|scenario|forecast|2029-30/i.test(t)) out.alertProj.push(t.slice(0, 100));
      }
      return out;
    }, realNames);
    const real = p.startsWith("/schools/");
    if (r.simWithName.length) fails.push(`${p} @${width}: real name in simulated element: ${r.simWithName.slice(0, 3).join(" | ")}`);
    if (real && new Set(r.bands.map((b) => b.slice(1))).size > 1) fails.push(`${p}: ${r.bands.length} bands ${r.bands.join(",")}`);
    if (r.comingUpPast.length) fails.push(`${p}: past date under Coming up: ${r.comingUpPast.join(" | ")}`);
    if (r.alertProj.length) fails.push(`${p}: projection in alerts`);
    if (r.overflow > 0) fails.push(`${p} @${width}: horizontal overflow ${r.overflow}px`);
    // the demo-only pages must not mention any real school at all
    if (p === "/turnaround" || p.startsWith("/demo") || p === "/alerts?view=demo") {
      const body = await page.locator("main").innerText();
      for (const n of realNames) if (body.includes(n)) fails.push(`${p}: real name "${n}" on a demo page`);
    }
  }
  await page.close();
}
await browser.close();
console.log(`${paths.length} pages x 2 widths checked; ${realNames.length} real-name strings`);
console.log(fails.length ? fails.join("\n") : "ALL CHECKS PASSED");
process.exit(fails.length ? 1 : 0);
