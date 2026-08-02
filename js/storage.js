// storage.js
// Thin wrapper around localStorage. Every key is namespaced so the app
// never collides with anything else the user has stored in the browser.
//
// Data model: the user can upload multiple Excel files over time. Each
// upload becomes a "deck" with its own id, vocabulary, session progress,
// starred words and wrong-word list — completely independent from other
// decks. A small "decks" index lists all of them for the history screen.

const NS = 'chinesestudy:';

const KEYS = {
  DECKS: NS + 'decks',
  ACTIVE_DECK: NS + 'activeDeck',
  STATS: NS + 'stats',
  SETTINGS: NS + 'settings',
  LEGACY_VOCAB: NS + 'vocab', // pre-history-feature single-deck key, for migration only
};

function deckPrefix(deckId) {
  return `${NS}deck:${deckId}:`;
}
function deckKey(deckId, field) {
  return `${deckPrefix(deckId)}${field}`;
}

function safeParse(raw, fallback) {
  if (raw === null || raw === undefined) return fallback;
  try {
    return JSON.parse(raw);
  } catch (err) {
    console.warn('Storage parse failed, using fallback', err);
    return fallback;
  }
}

function get(key, fallback = null) {
  return safeParse(localStorage.getItem(key), fallback);
}

function set(key, value) {
  try {
    localStorage.setItem(key, JSON.stringify(value));
    return true;
  } catch (err) {
    console.error('Storage write failed', err);
    return false;
  }
}

function remove(key) {
  localStorage.removeItem(key);
}

function allLocalKeys() {
  return Object.keys(localStorage);
}

export const Storage = {
  KEYS,

  // ---- Deck index ----------------------------------------------------
  getDecks: () => get(KEYS.DECKS, []),
  setDecks: (decks) => set(KEYS.DECKS, decks),

  getActiveDeckId: () => get(KEYS.ACTIVE_DECK, null),
  setActiveDeckId: (id) => set(KEYS.ACTIVE_DECK, id),

  // ---- Per-deck data ---------------------------------------------------
  getDeckVocab: (deckId) => get(deckKey(deckId, 'vocab'), []),
  setDeckVocab: (deckId, vocab) => set(deckKey(deckId, 'vocab'), vocab),

  getDeckSession: (deckId) => get(deckKey(deckId, 'session'), null),
  setDeckSession: (deckId, session) => set(deckKey(deckId, 'session'), session),
  clearDeckSession: (deckId) => remove(deckKey(deckId, 'session')),

  getDeckStarred: (deckId) => get(deckKey(deckId, 'starred'), []),
  setDeckStarred: (deckId, ids) => set(deckKey(deckId, 'starred'), ids),

  getDeckWrong: (deckId) => get(deckKey(deckId, 'wrong'), []),
  setDeckWrong: (deckId, ids) => set(deckKey(deckId, 'wrong'), ids),

  deleteDeck: (deckId) => {
    const prefix = deckPrefix(deckId);
    allLocalKeys().forEach((k) => {
      if (k.startsWith(prefix)) remove(k);
    });
    const decks = Storage.getDecks().filter((d) => d.id !== deckId);
    Storage.setDecks(decks);
    if (Storage.getActiveDeckId() === deckId) {
      Storage.setActiveDeckId(null);
    }
  },

  // ---- Lifetime stats (across all decks) --------------------------------
  getStats: () => get(KEYS.STATS, { sessionsCompleted: 0, totalWordsStudied: 0 }),
  setStats: (stats) => set(KEYS.STATS, stats),

  // ---- App settings ----
  getSettings: (defaults) => get(KEYS.SETTINGS, defaults),
  setSettings: (settings) => set(KEYS.SETTINGS, settings),

  // ---- Migration: users who used the app before the history feature -----
  // had a single vocab list under KEYS.LEGACY_VOCAB. Wrap it into a deck.
  migrateLegacyVocabIfNeeded: () => {
    const decks = Storage.getDecks();
    const legacy = get(KEYS.LEGACY_VOCAB, null);
    if (!legacy || legacy.length === 0 || decks.length > 0) return null;

    const id = `d${Date.now()}_legacy`;
    Storage.setDeckVocab(id, legacy);
    const oldStarred = get(NS + 'starred', []);
    const oldWrong = get(NS + 'wrong', []);
    if (oldStarred.length) Storage.setDeckStarred(id, oldStarred);
    if (oldWrong.length) Storage.setDeckWrong(id, oldWrong);
    const deckMeta = { id, name: 'Bộ từ trước đó', wordCount: legacy.length, createdAt: Date.now() };
    Storage.setDecks([deckMeta]);
    Storage.setActiveDeckId(id);
    remove(KEYS.LEGACY_VOCAB);
    remove(NS + 'starred');
    remove(NS + 'wrong');
    remove(NS + 'session');
    remove(NS + 'progress');
    return deckMeta;
  },

  clearAll: () => {
    allLocalKeys().forEach((k) => {
      if (k.startsWith(NS)) remove(k);
    });
  },
};
