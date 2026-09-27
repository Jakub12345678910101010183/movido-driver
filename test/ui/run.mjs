// Layout / accessibility checks of every driver screen at phone widths, on the
// React Native Web build (test doubles for native modules and app state).
// Real-device behaviour (GPS, camera, background, push) is NOT covered here.
import http from "node:http";
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const here = path.dirname(fileURLToPath(import.meta.url));
const root = path.join(here, "dist");
const { chromium } = await import(process.env.PLAYWRIGHT_MODULE ?? "playwright");
const exe = process.env.CHROMIUM_PATH;

const mime = { ".html": "text/html", ".js": "text/javascript", ".css": "text/css", ".png": "image/png", ".ttf": "font/ttf", ".json": "application/json", ".ico": "image/x-icon" };
const server = http.createServer((req, res) => {
  const u = decodeURIComponent(new URL(req.url, "http://x").pathname);
  let f = path.join(root, u);
  if (!f.startsWith(root) || !fs.existsSync(f) || fs.statSync(f).isDirectory()) f = path.join(root, "index.html");
  res.writeHead(200, { "Content-Type": mime[path.extname(f)] ?? "application/octet-stream" });
  fs.createReadStream(f).pipe(res);
}).listen(0);
const base = `http://127.0.0.1:${server.address().port}`;

const pages = [
  ["home", "/"], ["jobs", "/jobs"], ["messages", "/messages"], ["more", "/more"],
  ["job-multistop", "/job/101"], ["job-not-started", "/job/102"], ["job-completed", "/job/99"],
  ["pod", "/pod/101"], ["vehicle-check", "/check"], ["incident", "/incident?jobId=101"], ["fuel", "/fuel"], ["sync", "/sync"],
  ["home-offline", "/?mock=offline"], ["sync-offline", "/sync?mock=offline"], ["home-empty", "/?mock=empty"], ["jobs-empty", "/jobs?mock=empty"],
  ["login", "/login?mock=login"], ["login-disabled", "/login?mock=disabled"], ["forgot-password", "/forgot-password?mock=login"],
];
const widths = (process.env.WIDTHS ?? "375,390,430").split(",").map(Number);
const only = process.env.ONLY?.split(",");

const browser = await chromium.launch(exe ? { executablePath: exe } : {});
let problems = 0;
fs.mkdirSync(path.join(here, "shots"), { recursive: true });
for (const w of widths) {
  const ctx = await browser.newContext({ viewport: { width: w, height: 844 }, deviceScaleFactor: 2, isMobile: true, hasTouch: true });
  await ctx.route((u) => !u.toString().startsWith(base), (r) => r.abort()); // no network: deterministic
  for (const [name, url] of pages) {
    if (only && !only.includes(name)) continue;
    const p = await ctx.newPage();
    const errors = [];
    p.on("pageerror", (e) => errors.push(e.message.slice(0, 160)));
    p.on("console", (m) => { if (m.type() === "error" && !/Failed to load resource|net::ERR|fetch|Network request failed/i.test(m.text())) errors.push(m.text().slice(0, 160)); });
    await p.goto(base + url);
    await p.waitForTimeout(1800);
    const r = await p.evaluate(() => {
      const vw = document.documentElement.clientWidth;
      const overflow = Math.max(document.documentElement.scrollWidth, document.body.scrollWidth) - vw;
      const clipped = [];
      for (const el of document.querySelectorAll("body *")) {
        const b = el.getBoundingClientRect();
        if (b.width && b.right > vw + 1 && getComputedStyle(el).position !== "fixed") clipped.push(`${el.tagName.toLowerCase()}[${(el.getAttribute("aria-label") || el.textContent || "").trim().slice(0, 30)}] right=${Math.round(b.right)}`);
        if (clipped.length > 3) break;
      }
      const interactive = [...document.querySelectorAll('[role=button],[role=radio],[role=link],button,a,input,textarea')].filter((e) => { const b = e.getBoundingClientRect(); return b.width > 0 && b.height > 0; });
      const small = interactive.filter((e) => { const b = e.getBoundingClientRect(); return b.height < 44 || b.width < 44; })
        .map((e) => `${(e.getAttribute("aria-label") || e.textContent || e.tagName).trim().slice(0, 28)} ${Math.round(e.getBoundingClientRect().width)}x${Math.round(e.getBoundingClientRect().height)}`);
      const unnamed = interactive.filter((e) => !(e.getAttribute("aria-label") || e.textContent?.trim() || e.getAttribute("placeholder"))).length;
      const smallText = [...document.querySelectorAll("div,span")].filter((e) => e.childNodes.length && [...e.childNodes].some((n) => n.nodeType === 3 && n.textContent.trim()) && parseFloat(getComputedStyle(e).fontSize) < 12).length;
      return { overflow, clipped, small: small.slice(0, 5), smallCount: small.length, unnamed, smallText, title: document.body.innerText.slice(0, 60).replace(/\s+/g, " ") };
    });
    await p.screenshot({ path: path.join(here, "shots", `${name}-${w}.png`), fullPage: true });
    const bad = r.overflow > 0 || r.clipped.length || r.unnamed || errors.length || r.smallText;
    if (bad) problems++;
    console.log(`${bad ? "FAIL" : "PASS"} ${String(w).padEnd(3)} ${name.padEnd(17)} overflow=${r.overflow} clipped=${r.clipped.length} unnamed=${r.unnamed} small<44=${r.smallCount} tinyText=${r.smallText} errors=${errors.length}`
      + (r.clipped.length ? `\n      clipped: ${r.clipped.join(" | ")}` : "") + (r.smallCount ? `\n      small: ${r.small.join(" | ")}` : "") + (errors.length ? `\n      errors: ${errors.slice(0, 2).join(" | ")}` : ""));
    await p.close();
  }
  await ctx.close();
}
await browser.close();
server.close();
console.log(problems ? `\n${problems} screen(s) with problems` : "\nAll screens PASS");
process.exit(problems ? 1 : 0);
