const Word = require('../models/Word');
const { normalizeArabic, candidateForms } = require('../utils/arabic');

/**
 * Lazily-built, process-cached index mapping normalized Arabic forms to the
 * app's vocabulary word. Lets us match an inflected Quran verse token to the
 * corresponding base-form word without scanning the collection on every call.
 */
let indexPromise = null;

async function buildIndex() {
  const words = await Word.find({}).select('id arabic frequency').lean();

  // form -> word (prefer the highest-frequency word on collisions)
  const map = new Map();
  for (const w of words) {
    const base = normalizeArabic(w.arabic);
    if (!base) continue;
    const existing = map.get(base);
    if (!existing || w.frequency > existing.frequency) {
      map.set(base, { id: w.id, arabic: w.arabic, frequency: w.frequency });
    }
  }

  console.log(`📇 Word index built: ${map.size} normalized forms`);
  return map;
}

function getIndex() {
  if (!indexPromise) indexPromise = buildIndex();
  return indexPromise;
}

/**
 * Find the app vocabulary word that best matches a raw verse token.
 * Tries the exact normalized form first, then particle/article-stripped forms.
 * @param {string} token - Raw Arabic token (may carry diacritics/particles)
 * @returns {Promise<{id:number, arabic:string, frequency:number}|null>}
 */
async function matchToken(token) {
  const map = await getIndex();
  for (const form of candidateForms(token)) {
    const hit = map.get(form);
    if (hit) return hit;
  }
  return null;
}

module.exports = { matchToken, getIndex };
