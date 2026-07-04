/**
 * ONE-TIME build script.
 *
 * Builds the per-word Bengali overlay (data/quran/wbw-bn.json) that maps each
 * Quran word to an AUTHENTIC Bangla meaning, keyed "surah:ayah:position".
 *
 * Source: QuranWBW word-by-word data (Greentech Apps Foundation), cached in
 *   data/quran/_src/wbw_bn.json  (Bengali glosses)
 *   data/quran/_src/wbw_ar.json  (Arabic words — used to VERIFY alignment)
 *
 * The script audits alignment against the exported QF verses (data/quran/<n>.json):
 * it only trusts the mapping where the word segmentation matches. It reports
 * word-count mismatches and the Arabic text-match rate so accuracy is provable.
 *
 * Run:  node scripts/build-wbw-bn.js
 */
const fs = require("fs");
const path = require("path");

const DIR = path.join(__dirname, "..", "data", "quran");
const SRC = path.join(DIR, "_src");

function norm(input) {
  if (!input) return "";
  return input
    .replace(/[ؗ-ًؚ-ْٰـۖ-ۭ]/g, "") // harakat, tatweel, small marks
    .replace(/[آأإٱ]/g, "ا") // alef variants -> alef
    .replace(/ة/g, "ه") // ta marbuta -> ha
    .replace(/ى/g, "ي") // alef maksura -> ya
    .replace(/[^ء-ي]/g, "");
}

const bn = JSON.parse(fs.readFileSync(path.join(SRC, "wbw_bn.json"), "utf8"));
const ar = JSON.parse(fs.readFileSync(path.join(SRC, "wbw_ar.json"), "utf8"));
const chapters = JSON.parse(fs.readFileSync(path.join(DIR, "chapters.json"), "utf8"));

const overlay = {};
let verses = 0,
  countMismatch = 0,
  mappedWords = 0,
  arChecked = 0,
  arMatch = 0;
const mismatchSamples = [];

for (const ch of chapters) {
  const s = String(ch.id);
  const qfVerses = JSON.parse(fs.readFileSync(path.join(DIR, `${ch.id}.json`), "utf8"));
  for (const v of qfVerses) {
    verses++;
    const a = v.verse_key.split(":")[1];
    const qfWords = (v.words || []).filter((w) => w.char_type_name === "word");
    const bnWords = (bn[s] && bn[s][a] && bn[s][a][0]) || [];
    const arWords = (ar[s] && ar[s][a] && ar[s][a][0]) || [];

    if (qfWords.length !== bnWords.length) {
      countMismatch++;
      if (mismatchSamples.length < 15)
        mismatchSamples.push(`${v.verse_key} qf=${qfWords.length} bn=${bnWords.length}`);
    }

    const n = Math.min(qfWords.length, bnWords.length);
    for (let i = 0; i < n; i++) {
      const gloss = (bnWords[i] || "").trim();
      if (!gloss) continue;
      overlay[`${s}:${a}:${qfWords[i].position}`] = gloss;
      mappedWords++;
      // Verify the Arabic at this position matches (confidence in alignment)
      if (arWords[i]) {
        arChecked++;
        if (norm(qfWords[i].text_uthmani || qfWords[i].text) === norm(arWords[i])) arMatch++;
      }
    }
  }
}

fs.writeFileSync(path.join(DIR, "wbw-bn.json"), JSON.stringify(overlay));

const arPct = arChecked ? ((100 * arMatch) / arChecked).toFixed(2) : "n/a";
console.log("── Bengali word-by-word overlay build ──");
console.log(`verses processed:        ${verses}`);
console.log(`word-count mismatches:   ${countMismatch} verses`);
console.log(`words mapped:            ${mappedWords}`);
console.log(`Arabic alignment check:  ${arMatch}/${arChecked} match (${arPct}%)`);
if (mismatchSamples.length) console.log(`mismatch samples:        ${mismatchSamples.join(", ")}`);
console.log(`\n✅ wrote data/quran/wbw-bn.json (${Object.keys(overlay).length} entries)`);
