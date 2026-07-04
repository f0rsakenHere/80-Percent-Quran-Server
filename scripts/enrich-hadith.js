/**
 * ONE-TIME build script.
 *
 * Enriches data/stories.json (7,406 Sahih Bukhari hadiths, English paraphrase)
 * with:
 *   - authentic BENGALI translation (mapped by hadith number from the
 *     fawazahmed0/hadith-api ben-bukhari edition, cached in data/_src/)
 *   - the Bukhari BOOK the hadith belongs to
 *   - a browsable topical CATEGORY (Bukhari's 97 books grouped into ~17 themes)
 *
 * Output: data/stories.enriched.json  (used by seed.js to repopulate MongoDB)
 *
 * Run:  node scripts/enrich-hadith.js
 */
const fs = require('fs');
const path = require('path');

const DATA = path.join(__dirname, '..', 'data');
const stories = require(path.join(DATA, 'stories.json'));
const ben = require(path.join(DATA, '_src', 'ben-bukhari.json'));

// hadith number -> { text, book }
const byNum = {};
for (const h of ben.hadiths || []) {
  byNum[h.hadithnumber] = { text: h.text, book: h.reference?.book ?? 0 };
}

// Bukhari's 97 books (English names).
const BOOK_NAMES = {
  1: 'Revelation', 2: 'Belief', 3: 'Knowledge', 4: 'Ablutions (Wudu)', 5: 'Bathing (Ghusl)',
  6: 'Menstrual Periods', 7: 'Rubbing Hands with Dust (Tayammum)', 8: 'Prayers (Salat)',
  9: 'Times of the Prayers', 10: 'Call to Prayer (Adhaan)', 11: 'Friday Prayer', 12: 'Fear Prayer',
  13: 'The Two Festivals (Eids)', 14: 'Witr Prayer', 15: 'Rain Prayer (Istisqaa)', 16: 'Eclipses',
  17: 'Prostration During Recital', 18: 'Shortening the Prayers', 19: 'Night Prayer (Tahajjud)',
  20: 'Prayer at Makkah & Madinah', 21: 'Actions in Prayer', 22: 'Forgetfulness in Prayer',
  23: 'Funerals (Al-Janaa\'iz)', 24: 'Obligatory Charity (Zakat)', 25: 'Hajj (Pilgrimage)',
  26: 'Umrah', 27: 'Pilgrims Prevented', 28: 'Hunting Penalty on Pilgrimage', 29: 'Virtues of Madinah',
  30: 'Fasting (Sawm)', 31: 'Praying at Night in Ramadan', 32: 'The Night of Qadr',
  33: 'Retiring to a Mosque (I\'tikaf)', 34: 'Sales and Trade', 35: 'Sales with Deferred Price (Salam)',
  36: 'Pre-emption (Shufa)', 37: 'Hiring', 38: 'Transfer of Debt', 39: 'Surety (Kafala)',
  40: 'Agency (Wakala)', 41: 'Agriculture', 42: 'Distribution of Water', 43: 'Loans & Bankruptcy',
  44: 'Lawsuits', 45: 'Lost Things Picked Up', 46: 'Oppressions (Mazalim)', 47: 'Partnership',
  48: 'Mortgaging', 49: 'Manumission of Slaves', 50: 'Emancipation Contracts', 51: 'Gifts (Hiba)',
  52: 'Witnesses', 53: 'Peacemaking', 54: 'Conditions', 55: 'Wills and Testaments',
  56: 'Fighting for Allah (Jihad)', 57: 'One-Fifth of Booty', 58: 'Jizyah', 59: 'Beginning of Creation',
  60: 'Prophets', 61: 'Virtues of the Prophet', 62: 'Companions of the Prophet',
  63: 'Merits of the Ansar', 64: 'Military Expeditions (Maghazi)', 65: 'Commentary on the Quran (Tafsir)',
  66: 'Virtues of the Quran', 67: 'Marriage (Nikah)', 68: 'Divorce', 69: 'Family Provisions',
  70: 'Food and Meals', 71: 'Aqiqah', 72: 'Hunting & Slaughtering', 73: 'Al-Adha Sacrifice',
  74: 'Drinks', 75: 'Patients', 76: 'Medicine', 77: 'Dress', 78: 'Good Manners (Adab)',
  79: 'Asking Permission', 80: 'Invocations (Da\'awaat)', 81: 'Softening of the Heart (Riqaq)',
  82: 'Divine Will (Qadar)', 83: 'Oaths and Vows', 84: 'Expiation for Broken Oaths',
  85: 'Laws of Inheritance', 86: 'Limits & Punishments (Hudood)', 87: 'Blood Money (Diyat)',
  88: 'Dealing with Apostates', 89: 'Coercion', 90: 'Tricks (Hiyal)', 91: 'Interpretation of Dreams',
  92: 'Afflictions & End of the World (Fitan)', 93: 'Judgments (Ahkaam)', 94: 'Wishes',
  95: 'Accepting Truthful Information', 96: 'Holding Fast to Quran & Sunnah', 97: 'Oneness of Allah (Tawheed)',
};

// Topical categories -> { en, bn, books[] }.
const CATEGORIES = {
  faith: { en: 'Faith & Belief', bn: 'ঈমান ও বিশ্বাস', books: [1, 2, 82, 95, 96, 97] },
  knowledge: { en: 'Knowledge & Quran', bn: 'জ্ঞান ও কুরআন', books: [3, 65, 66] },
  purification: { en: 'Purification', bn: 'পবিত্রতা', books: [4, 5, 6, 7] },
  prayer: { en: 'Prayer', bn: 'নামায', books: [8, 9, 10, 11, 12, 13, 14, 15, 16, 17, 18, 19, 20, 21, 22] },
  funeral: { en: 'Death & Funerals', bn: 'মৃত্যু ও জানাযা', books: [23] },
  charity: { en: 'Charity (Zakat)', bn: 'যাকাত ও দান', books: [24] },
  hajj: { en: 'Hajj & Umrah', bn: 'হজ্জ ও উমরাহ', books: [25, 26, 27, 28, 29] },
  fasting: { en: 'Fasting', bn: 'রোযা', books: [30, 31, 32, 33] },
  business: { en: 'Trade & Dealings', bn: 'ব্যবসা ও লেনদেন', books: [34, 35, 36, 37, 38, 39, 40, 41, 42, 43, 45, 47, 48, 49, 50, 51] },
  justice: { en: 'Justice & Law', bn: 'বিচার ও আইন', books: [44, 46, 52, 53, 54, 55, 85, 86, 87, 88, 89, 90, 93, 94] },
  jihad: { en: 'Struggle & Sacrifice', bn: 'জিহাদ ও ত্যাগ', books: [56, 57, 58] },
  prophets: { en: 'Prophets & Companions', bn: 'নবী ও সাহাবা', books: [59, 60, 61, 62, 63, 64] },
  marriage: { en: 'Marriage & Family', bn: 'বিবাহ ও পরিবার', books: [67, 68, 69, 71] },
  food: { en: 'Food, Drink & Health', bn: 'খাদ্য, পানীয় ও স্বাস্থ্য', books: [70, 72, 73, 74, 75, 76, 77] },
  manners: { en: 'Manners & Supplication', bn: 'আদব ও দোয়া', books: [78, 79, 80, 83, 84, 91] },
  heart: { en: 'Heart & the Hereafter', bn: 'অন্তর ও আখিরাত', books: [81, 92] },
  general: { en: 'General', bn: 'বিবিধ', books: [0] },
};

// book -> category id
const bookToCat = {};
for (const [cat, def] of Object.entries(CATEGORIES)) {
  for (const b of def.books) bookToCat[b] = cat;
}

function cleanBengali(text) {
  if (!text) return '';
  return text.replace(/ /g, ' ').replace(/[ \t]+/g, ' ').trim();
}

let withBn = 0;
const catCounts = {};
const enriched = stories.map((s) => {
  const b = byNum[s.id];
  const bangla = b ? cleanBengali(b.text) : '';
  const book = b ? b.book : 0;
  const category = bookToCat[book] ?? 'general';
  if (bangla) withBn++;
  catCounts[category] = (catCounts[category] || 0) + 1;
  return {
    id: s.id,
    source: s.source,
    title: s.title,
    content: s.content,
    bangla,
    book,
    bookName: BOOK_NAMES[book] || 'General',
    category,
  };
});

// write enriched hadiths + the category index (for the UI/API)
fs.writeFileSync(path.join(DATA, 'stories.enriched.json'), JSON.stringify(enriched));
const catIndex = Object.entries(CATEGORIES).map(([id, def]) => ({
  id, en: def.en, bn: def.bn, count: catCounts[id] || 0,
}));
fs.writeFileSync(path.join(DATA, 'hadith-categories.json'), JSON.stringify(catIndex, null, 2));

console.log(`Enriched ${enriched.length} hadiths | with Bengali: ${withBn} | missing: ${enriched.length - withBn}`);
console.log('Categories:');
catIndex.forEach((c) => console.log(`  ${c.en.padEnd(26)} ${c.count}`));
