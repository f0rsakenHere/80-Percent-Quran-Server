/**
 * Arabic normalization (server mirror of the client's src/lib/arabic.ts).
 * Used to match inflected Quran verse tokens against the app's base-form
 * vocabulary.
 */

// Harakat, tatweel, superscript alef, Quranic annotation marks
const DIACRITICS = /[ؐ-ًؚ-ٰٟۖ-ۭـ]/g;

const LEADING_PARTICLES = ['و', 'ف', 'ب', 'ك', 'ل']; // و ف ب ك ل

function normalizeArabic(input) {
  if (!input) return '';
  return input
    .replace(DIACRITICS, '')
    .replace(/[آأإٱ]/g, 'ا') // آ أ إ ٱ -> ا
    .replace(/ى/g, 'ي') // ى -> ي
    .replace(/ة/g, 'ه') // ة -> ه
    .replace(/ؤ/g, 'و') // ؤ -> و
    .replace(/ئ/g, 'ي') // ئ -> ي
    .replace(/ء/g, '') // ء
    .trim();
}

function candidateForms(token) {
  const base = normalizeArabic(token);
  const forms = new Set([base]);

  const stripArticle = (s) =>
    s.startsWith('ال') && s.length > 3 ? s.slice(2) : s;

  forms.add(stripArticle(base));

  for (const p of LEADING_PARTICLES) {
    if (base.startsWith(p) && base.length > 2) {
      const stripped = base.slice(1);
      forms.add(stripped);
      forms.add(stripArticle(stripped));
    }
  }

  return [...forms].filter(Boolean);
}

module.exports = { normalizeArabic, candidateForms };
