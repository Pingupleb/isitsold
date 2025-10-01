// Node 20 script: fetch each href and decide status.
// Customize the "decideStatus" function to match your actual page content!

import { JSDOM } from "jsdom";
import fs from "fs";

const AREAS = [
  // Put the full list of hrefs you care about:
  // you can also read this from your HTML at build time if you prefer
  "valgt.html?per=19",
  "valgt.html?per=20",
  "valgt.html?per=21",
  "valgt.html?per=22",
  "valgt.html?per=23",
  "valgt.html?per=24",
  "valgt.html?per=25",
  "valgt.html?per=26",
  "valgt.html?per=27",
  "valgt.html?per=28",
  "valgt.html?per=29",
  "valgt.html?per=30",
  "valgt.html?per=31",
  "valgt.html?per=32",
  "valgt.html?per=33",
  "valgt.html?per=34",
  "valgt.html?per=35",
  "valgt.html?per=36",
  "valgt.html?per=37",
  "valgt.html?per=38",
  "valgt.html?per=39",
  "valgt.html?per=40",
  "valgt.html?per=41",
  "valgt.html?per=42",
  "valgt.html?per=43",
  "valgt.html?per=44",
  "valgt.html?per=45",
  "valgt.html?per=46",
  "valgt.html?per=47",
  "valgt.html?per=48",
  "valgt.html?per=49",
  "valgt.html?per=50"
];

// Base URL where those pages live
const BASE = "https://www.kokstadstasjon.no/";

// Decide status by inspecting HTML. Adjust to your real DOM/text.
function decideStatus(document) {
  const statusEl = document.querySelector(
    ".maintext_valgt > .plantegning_ledig, " +
    ".maintext_valgt > .plantegning_solgt, " +
    ".maintext_valgt > .plantegning_reservert"
  );

  if (!statusEl) {
    return { status: "unknown", price: 0 };
  }

  const text = statusEl.textContent.trim().toLowerCase();

  if (statusEl.classList.contains("plantegning_solgt") || text.includes("solgt")) {
    return { status: "sold", price: 0 };
  }

  if (statusEl.classList.contains("plantegning_reservert") || text.includes("reservert")) {
    return { status: "reserved", price: 0 };
  }

  if (statusEl.classList.contains("plantegning_ledig") || text.includes("ledig")) {
    // still optional: look for a price element if you want
    const priceEl = document.querySelector(".price, .pris, .apartment-price");
    const price = priceEl
      ? Number(priceEl.textContent.replace(/[^\d]/g, ""))
      : 0;
    return { status: "available", price };
  }

  return { status: "unknown", price: 0 };
}

async function main() {
  const out = {};
  for (const href of AREAS) {
    const url = href.startsWith("http") ? href : BASE + href;
    const per = new URL(url).searchParams.get("per");
    try {
      const res = await fetch(url, { redirect: "follow" });
      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      const html = await res.text();
      console.log('Fetched:', url, 'length=', html.length,
            'has_ledig=', html.includes('plantegning_ledig'),
            'has_solgt=', html.includes('plantegning_solgt'),
            'has_res=', html.includes('plantegning_reservert'));
      const dom = new JSDOM(html);
      out[per] = decideStatus(dom.window.document);
    } catch (e) {
      // On failure, keep previous value if exists, or mark reserved as fallback
      console.error("Fetch failed for", url, e.message);
      out[per] = out[per] || { status: "reserved", price: 0 };
    }
  }

  fs.writeFileSync("status.json", JSON.stringify(out, null, 2));
  console.log("Wrote status.json");
}

main().catch(err => {
  console.error(err);
  process.exit(1);
});