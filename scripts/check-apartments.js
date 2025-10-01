// Node 20 script: fetch each href and decide status.
// Requires: "type": "module" in package.json and `npm i jsdom`

import { JSDOM } from "jsdom";
import fs from "fs";

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

// Base URL where those pages live
const BASE = "https://www.kokstadstasjon.no/";

// optional: run just one: node scripts/check-apartments.js --only=34
const ONLY = process.argv.find(a => a.startsWith("--only="))?.split("=")[1];

function decideStatus(document) {
  // DEBUG: dump what we see around the status
  console.log(document.querySelector(".maintext_valgt")?.outerHTML);

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
    const priceEl = document.querySelector(".price, .pris, .apartment-price");
    const price = priceEl ? Number(priceEl.textContent.replace(/[^\d]/g, "")) : 0;
    return { status: "available", price };
  }

  return { status: "unknown", price: 0 };
}

async function fetchHtml(url) {
  console.log("Requesting:", url);
  const res = await fetch(url, {
    redirect: "follow",
    headers: {
      "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0 Safari/537.36",
      "Accept": "text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8",
      "Accept-Language": "nb-NO,nb;q=0.9,en;q=0.8",
      "Cache-Control": "no-cache",
    },
  });

  console.log("Response:", res.status, res.statusText, "→", res.url);
  const html = await res.text();

  if (!res.ok) {
    console.error("Non-OK status. First 400 chars of body:");
    console.error(html.slice(0, 400));
    throw new Error(`HTTP ${res.status}`);
  }

  console.log(
    "Length=", html.length,
    "has maintext_valgt?", html.includes("maintext_valgt"),
    "has plantegning_", /(plantegning_(ledig|solgt|reservert))/.test(html)
  );

    // Save raw HTML for inspection
  const per = new URL(url).searchParams.get("per");
  fs.writeFileSync(`debug-${per}.html`, html, "utf8");
  console.log(`Saved raw HTML → debug-${per}.html (length ${html.length})`);

  return html;
}

async function main() {
  const out = {};
  const targets = ONLY ? AREAS.filter(h => h.includes(`per=${ONLY}`)) : AREAS;

  for (const href of targets) {
    const url = new URL(href, BASE).toString();
    const per = new URL(url).searchParams.get("per");
    try {
      const html = await fetchHtml(url);
      const dom = new JSDOM(html);
      out[per] = decideStatus(dom.window.document);
    } catch (e) {
      console.error("Fetch failed for", url, "-", e.message);
      out[per] = out[per] || { status: "unknown", price: 0 };
    }
  }

  fs.writeFileSync("status.json", JSON.stringify(out, null, 2));
  console.log("Wrote status.json");
}

main().catch(err => {
  console.error(err);
  process.exit(1);
});
