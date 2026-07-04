/**
 * ONE-TIME build script.
 *
 * Downloads the full Quran (all 114 chapters, every verse with word-by-word
 * tokens + transliteration, plus Bengali + English verse translations) DIRECTLY
 * from the Quran Foundation API and writes it to disk so the app can serve
 * everything OFFLINE afterwards. This talks to the API itself (not the local
 * backend), so it is independent of the app's runtime code.
 *
 * Run once:  node scripts/export-quran.js
 * Output:    data/quran/chapters.json  and  data/quran/<n>.json  (one per surah)
 *
 * Verse translations: Bengali id 161 (Taisirul Quran) + English id 131
 * (Saheeh International) — the same resources the app already showed.
 */
require("dotenv").config();
const fs = require("fs");
const path = require("path");
const axios = require("axios");
const dns = require("dns");

// Some local routers refuse DNS queries; prefer public resolvers.
try {
  dns.setServers(["8.8.8.8", "1.1.1.1", ...dns.getServers()]);
} catch (_) {}

const OUT_DIR = path.join(__dirname, "..", "data", "quran");
const TRANSLATIONS = "161,131";
const PER_PAGE = 50; // QF max

const ENV = process.env.QF_ENV || "production";
const CLIENT_ID = process.env.QF_CLIENT_ID;
const CLIENT_SECRET = process.env.QF_CLIENT_SECRET;
const AUTH_URL =
  ENV === "production"
    ? "https://oauth2.quran.foundation"
    : "https://prelive-oauth2.quran.foundation";
const API =
  ENV === "production"
    ? "https://apis.quran.foundation"
    : "https://apis-prelive.quran.foundation";

const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

let token = null;
let tokenExpiry = 0;
async function getToken() {
  if (token && Date.now() < tokenExpiry - 30000) return token;
  const params = new URLSearchParams();
  params.append("grant_type", "client_credentials");
  params.append("scope", "content");
  const auth = Buffer.from(`${CLIENT_ID}:${CLIENT_SECRET}`).toString("base64");
  const res = await axios.post(`${AUTH_URL}/oauth2/token`, params, {
    headers: {
      Authorization: `Basic ${auth}`,
      "Content-Type": "application/x-www-form-urlencoded",
    },
  });
  token = res.data.access_token;
  tokenExpiry = Date.now() + res.data.expires_in * 1000;
  return token;
}

async function qfGet(url, params, tries = 5) {
  for (let attempt = 1; attempt <= tries; attempt++) {
    try {
      const t = await getToken();
      const res = await axios.get(url, {
        params,
        timeout: 60000,
        headers: { "x-auth-token": t, "x-client-id": CLIENT_ID },
      });
      return res.data;
    } catch (err) {
      const msg = err.response?.data?.message || err.message;
      if (attempt === tries) throw new Error(msg);
      await sleep(1200 * attempt);
    }
  }
}

async function getChapters() {
  const data = await qfGet(`${API}/content/api/v4/chapters`, { language: "en" });
  return data.chapters || [];
}

async function getChapterVerses(id) {
  let page = 1;
  let totalPages = 1;
  const verses = [];
  do {
    const data = await qfGet(`${API}/content/api/v4/verses/by_chapter/${id}`, {
      language: "en",
      words: true,
      word_fields: "text_uthmani",
      fields: "text_uthmani",
      translations: TRANSLATIONS,
      per_page: PER_PAGE,
      page,
    });
    verses.push(...(data.verses || []));
    totalPages = data.pagination?.total_pages || 1;
    page++;
    if (page <= totalPages) await sleep(120);
  } while (page <= totalPages);
  return verses;
}

async function main() {
  if (!CLIENT_ID || !CLIENT_SECRET) {
    throw new Error("QF_CLIENT_ID / QF_CLIENT_SECRET missing in .env");
  }
  fs.mkdirSync(OUT_DIR, { recursive: true });

  console.log(`📖 Fetching chapter list from QF (${ENV})...`);
  const chapters = await getChapters();
  if (!chapters.length) throw new Error("No chapters returned from QF");
  fs.writeFileSync(path.join(OUT_DIR, "chapters.json"), JSON.stringify(chapters));
  console.log(`✅ chapters.json (${chapters.length} surahs)`);

  let total = 0;
  for (const ch of chapters) {
    process.stdout.write(`   Surah ${String(ch.id).padStart(3)} ${ch.name_simple}… `);
    const verses = await getChapterVerses(ch.id);
    fs.writeFileSync(path.join(OUT_DIR, `${ch.id}.json`), JSON.stringify(verses));
    total += verses.length;
    console.log(`${verses.length} verses`);
  }
  console.log(`\n🎉 Done. ${chapters.length} chapters, ${total} verses -> ${OUT_DIR}`);
}

main().catch((err) => {
  console.error("❌ Export failed:", err.message);
  process.exit(1);
});
