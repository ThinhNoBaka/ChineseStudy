// pinyin.js
// A "virtual IME" for people without a Chinese keyboard installed.
//
// We do NOT attempt a general pinyin->hanzi dictionary (that needs a large
// external database). Instead we search inside the vocabulary the user has
// already loaded: type pinyin without tone marks (e.g. "yiyuan") and get
// back the matching word(s) from the current deck — exactly the words this
// quiz can ask about, so it's always accurate for this app's purpose.

const TONE_MAP = {
  ā: 'a', á: 'a', ǎ: 'a', à: 'a',
  ē: 'e', é: 'e', ě: 'e', è: 'e',
  ī: 'i', í: 'i', ǐ: 'i', ì: 'i',
  ō: 'o', ó: 'o', ǒ: 'o', ò: 'o',
  ū: 'u', ú: 'u', ǔ: 'u', ù: 'u',
  ǖ: 'v', ǘ: 'v', ǚ: 'v', ǜ: 'v', ü: 'v',
  ń: 'n', ň: 'n', ǹ: 'n',
};

/** Strips tone diacritics, lowercases, and removes spaces/punctuation. */
export function normalizePinyin(str) {
  return (str || '')
    .toLowerCase()
    .split('')
    .map((ch) => TONE_MAP[ch] || ch)
    .join('')
    .replace(/[^a-z0-9]/g, '');
}

/**
 * Finds words in `vocab` whose pinyin matches the typed query.
 * @param {Array<{hanzi,pinyin,vi}>} vocab
 * @param {string} query - raw pinyin typed by the user, tones optional
 * @param {number} [limit]
 */
export function searchByPinyin(vocab, query, limit = 8) {
  const q = normalizePinyin(query);
  if (!q) return [];
  const matches = vocab.filter((w) => normalizePinyin(w.pinyin).includes(q));
  // Prefix matches first, then anything else that contains the query.
  matches.sort((a, b) => {
    const an = normalizePinyin(a.pinyin).startsWith(q) ? 0 : 1;
    const bn = normalizePinyin(b.pinyin).startsWith(q) ? 0 : 1;
    return an - bn;
  });
  return matches.slice(0, limit);
}
