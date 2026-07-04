const fs = require("fs");
const path = require("path");

/**
 * Local (offline) Quran data provider.
 *
 * Serves the entire Quran — chapter metadata, verses, word-by-word tokens and
 * Bengali/English translations — from bundled JSON on disk. NO third-party API
 * is contacted at runtime.
 *
 * Data files (produced by scripts/export-quran.js + scripts/build-wbw-bn.js):
 *   data/quran/chapters.json      114 chapter metadata objects
 *   data/quran/<n>.json           verses for surah n, each with words[] + translations[]
 *   data/quran/wbw-bn.json        optional: { "s:a:p": "bangla meaning" } per-word overlay
 */
const DATA_DIR = path.join(__dirname, "..", "data", "quran");

/** Strip Arabic diacritics, tatweel and normalize letter forms for matching. */
function normalizeArabic(input) {
  if (!input) return "";
  return input
    .replace(/[ً-ْٰـ]/g, "") // harakat, superscript alef, tatweel
    .replace(/[آأإٱ]/g, "ا") // alef variants -> alef
    .replace(/ة/g, "ه") // ta marbuta -> ha
    .replace(/ى/g, "ي") // alef maksura -> ya
    .replace(/[^ء-ي]/g, "") // keep only Arabic letters
    .trim();
}

class LocalQuran {
  constructor() {
    this.chapters = null; // cached chapter metadata
    this.verseCache = new Map(); // surah number -> verses array
    this.wbwBangla = null; // "s:a:p" -> bangla
    this.searchIndex = null; // normalized word -> [verse_key, ...]
    this.available = fs.existsSync(path.join(DATA_DIR, "chapters.json"));
  }

  _loadChapters() {
    if (this.chapters) return this.chapters;
    const file = path.join(DATA_DIR, "chapters.json");
    this.chapters = JSON.parse(fs.readFileSync(file, "utf8"));
    return this.chapters;
  }

  _loadWbwBangla() {
    if (this.wbwBangla !== null) return this.wbwBangla;
    const file = path.join(DATA_DIR, "wbw-bn.json");
    try {
      this.wbwBangla = JSON.parse(fs.readFileSync(file, "utf8"));
    } catch (_) {
      this.wbwBangla = {}; // overlay is optional
    }
    return this.wbwBangla;
  }

  /** Load raw verses for a surah and apply the Bangla word overlay. */
  _loadSurah(surah) {
    // Defense-in-depth: only ever read 1.json .. 114.json (no path traversal),
    // regardless of what callers pass.
    const n = Number(surah);
    if (!Number.isInteger(n) || n < 1 || n > 114) {
      throw new Error(`Invalid surah number: ${surah}`);
    }
    if (this.verseCache.has(n)) return this.verseCache.get(n);
    const file = path.join(DATA_DIR, `${n}.json`);
    const verses = JSON.parse(fs.readFileSync(file, "utf8"));
    const bn = this._loadWbwBangla();

    for (const v of verses) {
      const [s, a] = v.verse_key.split(":");
      for (const w of v.words || []) {
        if (w.char_type_name !== "word") continue;
        const key = `${s}:${a}:${w.position}`;
        const gloss = bn[key];
        if (gloss) {
          // Keep the English gloss available but surface Bangla as the primary
          // per-word meaning the UI reads (word.translation.text).
          w.english = w.translation ? w.translation.text : undefined;
          w.bangla = gloss;
          w.translation = { text: gloss, language_name: "bengali" };
        }
      }
    }
    this.verseCache.set(n, verses);
    return verses;
  }

  /** All 114 chapters. */
  getChapters() {
    return { chapters: this._loadChapters() };
  }

  /** Verses for a chapter, paginated, shape-compatible with the old QF proxy. */
  getChapterVerses(chapterNumber, _translations = "161,131", page = 1, perPage = 20) {
    const all = this._loadSurah(chapterNumber);
    const totalRecords = all.length;
    const totalPages = Math.max(Math.ceil(totalRecords / perPage), 1);
    const current = Math.min(Math.max(page, 1), totalPages);
    const start = (current - 1) * perPage;
    const verses = all.slice(start, start + perPage);
    return {
      verses,
      pagination: {
        per_page: perPage,
        current_page: current,
        next_page: current < totalPages ? current + 1 : null,
        total_pages: totalPages,
        total_records: totalRecords,
      },
    };
  }

  /** A single verse by "s:a" reference. */
  getVerseDetails(verseRef) {
    const [surah] = verseRef.split(":");
    const verses = this._loadSurah(Number(surah));
    const verse = verses.find((v) => v.verse_key === verseRef);
    if (!verse) throw new Error(`Verse ${verseRef} not found`);
    return { success: true, data: { verse } };
  }

  /** Build (once) a normalized-Arabic-word -> verse_keys index across the Quran. */
  _buildSearchIndex() {
    if (this.searchIndex) return this.searchIndex;
    const index = new Map();
    const chapters = this._loadChapters();
    for (const ch of chapters) {
      const verses = this._loadSurah(ch.id);
      for (const v of verses) {
        const seen = new Set();
        for (const w of v.words || []) {
          if (w.char_type_name !== "word") continue;
          const norm = normalizeArabic(w.text_uthmani || w.text || "");
          if (!norm || seen.has(norm)) continue;
          seen.add(norm);
          if (!index.has(norm)) index.set(norm, []);
          index.get(norm).push(v.verse_key);
        }
      }
    }
    this.searchIndex = index;
    return index;
  }

  /**
   * Search verses that contain a given Arabic word. Mirrors the old
   * getVerses() response envelope so routes/frontend are unchanged.
   */
  getVerses(arabicWord, size = 2, _translations = "161,131", page = 1) {
    const index = this._buildSearchIndex();
    const norm = normalizeArabic(arabicWord);
    const keys = index.get(norm) || [];
    const totalRecords = keys.length;
    const totalPages = Math.max(Math.ceil(totalRecords / size), 0);
    const start = (page - 1) * size;
    const pageKeys = keys.slice(start, start + size);

    const results = pageKeys.map((key) => {
      const [surah] = key.split(":");
      const verses = this._loadSurah(Number(surah));
      return verses.find((v) => v.verse_key === key);
    }).filter(Boolean);

    return {
      success: true,
      data: { search: { results } },
      query: arabicWord,
      pagination: {
        current_page: page,
        total_pages: totalPages,
        total_records: totalRecords,
      },
    };
  }
}

module.exports = new LocalQuran();
module.exports.normalizeArabic = normalizeArabic;
