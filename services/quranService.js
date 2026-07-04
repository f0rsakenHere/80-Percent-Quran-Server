const localQuran = require("./localQuran");

/**
 * Quran data service — OFFLINE / LOCAL.
 *
 * Previously proxied the Quran Foundation API (OAuth2). It now serves the entire
 * Quran from bundled JSON (see services/localQuran.js), so the app has NO
 * third-party API dependency at runtime. Method names and response shapes are
 * unchanged, so routes and the frontend keep working as-is.
 */
class QuranService {
  constructor() {
    this.environment = "local";
    this.authUrl = null;
    this.apiBaseUrl = null;
    console.log("✅ Quran Service initialized (offline / local data)");
    if (!localQuran.available) {
      console.warn(
        "⚠️  Local Quran data not found in data/quran/. Run: node scripts/export-quran.js",
      );
    }
  }

  // --- Health-check compatibility shims (no auth needed offline) ---
  isTokenValid() {
    return true;
  }
  async ensureValidToken() {
    return "local";
  }

  /** Search verses containing an Arabic word. */
  async getVerses(arabicWord, size = 2, translationIds = "161,131", page = 1) {
    return localQuran.getVerses(arabicWord, size, translationIds, page);
  }

  /** List all 114 chapters. */
  async getChapters() {
    return localQuran.getChapters();
  }

  /** Verses for a chapter (word-by-word), paginated. */
  async getChapterVerses(chapterNumber, translationIds = "131", page = 1, perPage = 20) {
    return localQuran.getChapterVerses(chapterNumber, translationIds, page, perPage);
  }

  /** A single verse by reference (e.g. "2:255"). */
  async getVerseDetails(verseRef, translationIds = "161,131") {
    return localQuran.getVerseDetails(verseRef, translationIds);
  }
}

module.exports = new QuranService();
