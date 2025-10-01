import fs from "fs";
import { chromium } from "playwright";

const BASE = "https://www.kokstadstasjon.no/";
const AREAS = [
  "valgt.html?per=19","valgt.html?per=20","valgt.html?per=21","valgt.html?per=22",
  "valgt.html?per=23","valgt.html?per=24","valgt.html?per=25","valgt.html?per=26",
  "valgt.html?per=27","valgt.html?per=28","valgt.html?per=29","valgt.html?per=30",
  "valgt.html?per=31","valgt.html?per=32","valgt.html?per=33","valgt.html?per=34",
  "valgt.html?per=35","valgt.html?per=36","valgt.html?per=37","valgt.html?per=38",
  "valgt.html?per=39","valgt.html?per=40","valgt.html?per=41","valgt.html?per=42",
  "valgt.html?per=43","valgt.html?per=44","valgt.html?per=45","valgt.html?per=46",
  "valgt.html?per=47","valgt.html?per=48","valgt.html?per=49","valgt.html?per=50"
];

// allow: node scripts/check-apartments.playwright.mjs --only=25
const ONLY = process.argv.find(a => a.startsWith("--only="))?.split("=")[1];

function statusFrom(text, cls = "") {
  const t = (text || "").toLowerCase();
  if (cls.includes("plantegning_solgt") || t.includes("solgt")) return "sold";
  if (cls.includes("plantegning_reservert") || t.includes("reservert")) return "reserved";
  if (cls.includes("plantegning_ledig") || t.includes("ledig")) return "available";
  return "unknown";
}
const normalizePrice = txt => {
  const n = Number((txt || "").replace(/[^\d]/g, ""));
  return Number.isFinite(n) ? n : 0;
};

async function extractStatus(page) {
  // exact element you showed:
  const loc = page.locator(
    ".maintext_valgt >> :is(.plantegning_ledig, .plantegning_solgt, .plantegning_reservert)"
  ).first();

  await loc.waitFor({ timeout: 8000 }).catch(() => {});
  if (await loc.count()) {
    const text = (await loc.textContent())?.trim();
    const cls  = await loc.getAttribute("class");
    const st   = statusFrom(text, cls);

    // optional price lookup
    const priceTxt = await page.locator(".price, .pris, .apartment-price").first().textContent().catch(() => null);
    const price = st === "available" ? normalizePrice(priceTxt) : 0;
    return { status: st, price };
  }

  // fallback: keywords in fully rendered HTML
  const html = await page.content();
  const st = statusFrom(html);
  const m = html.match(/([\d\s.\u00A0]{5,})\s*(kr|nok)/i);
  const price = st === "available" && m ? normalizePrice(m[1]) : 0;
  return { status: st, price };
}

async function main() {
  const browser = await chromium.launch();
  const ctx = await browser.newContext({
    userAgent: "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0 Safari/537.36",
    locale: "nb-NO"
  });
  const page = await ctx.newPage();

  const out = {};
  const targets = ONLY ? AREAS.filter(h => h.includes(`per=${ONLY}`)) : AREAS;

  for (const href of targets) {
    const url = new URL(href, BASE).toString();
    const per = new URL(url).searchParams.get("per");
    console.log("Visiting", url);
    try {
      await page.goto(url, { waitUntil: "domcontentloaded", timeout: 30000 });
      await page.waitForTimeout(500); // small render buffer
      out[per] = await extractStatus(page);
      console.log(`per=${per} ->`, out[per]);
    } catch (e) {
      console.error("Failed", url, e.message);
      out[per] = { status: "unknown", price: 0 };
      try {
        if (!fs.existsSync("debug")) fs.mkdirSync("debug");
        await page.screenshot({ path: `debug/per-${per}.png`, fullPage: true });
        fs.writeFileSync(`debug/per-${per}.html`, await page.content());
      } catch {}
    }
  }

  fs.writeFileSync("status.json", JSON.stringify(out, null, 2));
  console.log("Wrote status.json");
  await browser.close();
}

main();
