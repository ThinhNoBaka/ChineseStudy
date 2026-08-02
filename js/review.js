// review.js
// Helpers for the two special study pools: words the user has ever
// gotten wrong, and words the user has starred as difficult.
// Every function is scoped to a single deck (deckId) since each
// uploaded vocabulary set tracks its own wrong/starred lists.

import { Storage } from './storage.js';

export const Review = {
  recordWrong(deckId, id) {
    const list = Storage.getDeckWrong(deckId);
    if (!list.includes(id)) {
      list.push(id);
      Storage.setDeckWrong(deckId, list);
    }
  },

  clearWrong(deckId, id) {
    const list = Storage.getDeckWrong(deckId).filter((w) => w !== id);
    Storage.setDeckWrong(deckId, list);
  },

  getWrongIds(deckId) {
    return Storage.getDeckWrong(deckId);
  },

  isStarred(deckId, id) {
    return Storage.getDeckStarred(deckId).includes(id);
  },

  toggleStar(deckId, id) {
    const list = Storage.getDeckStarred(deckId);
    const idx = list.indexOf(id);
    if (idx === -1) {
      list.push(id);
    } else {
      list.splice(idx, 1);
    }
    Storage.setDeckStarred(deckId, list);
    return list.includes(id);
  },

  getStarredIds(deckId) {
    return Storage.getDeckStarred(deckId);
  },

  /** Filters a vocab list down to only the given ids, preserving order. */
  filterVocab(vocab, ids) {
    const idSet = new Set(ids);
    return vocab.filter((w) => idSet.has(w.id));
  },

  recordSessionStats(summary) {
    const stats = Storage.getStats();
    stats.sessionsCompleted += 1;
    stats.totalWordsStudied += summary.totalWords;
    Storage.setStats(stats);
  },
};
