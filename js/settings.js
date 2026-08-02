// settings.js
// Central place for all user-configurable options. Everything here is
// persisted immediately on change so a reload never resets a preference.

import { Storage } from './storage.js';

export const DEFAULT_SETTINGS = {
  darkMode: false,
  shuffle: true,
  mode: 'cn-vi',        // 'cn-vi' = Chinese -> Vietnamese, 'vi-cn' = Vietnamese -> Chinese
  fontSize: 'medium',   // 'small' | 'medium' | 'large'
  reviewDelay: 5,        // base gap (in questions) before a missed word resurfaces
};

let current = null;

function clampDelay(value) {
  const allowed = [3, 5, 8, 10];
  return allowed.includes(Number(value)) ? Number(value) : DEFAULT_SETTINGS.reviewDelay;
}

export const Settings = {
  load() {
    current = { ...DEFAULT_SETTINGS, ...Storage.getSettings(DEFAULT_SETTINGS) };
    current.reviewDelay = clampDelay(current.reviewDelay);
    return current;
  },

  get() {
    if (!current) return Settings.load();
    return current;
  },

  update(partial) {
    current = { ...Settings.get(), ...partial };
    if (partial.reviewDelay !== undefined) {
      current.reviewDelay = clampDelay(partial.reviewDelay);
    }
    Storage.setSettings(current);
    return current;
  },

  // Returns the [min,max] question-gap window used by the scheduler for a
  // word missed for the first time this session.
  firstMissDelayRange() {
    const base = Settings.get().reviewDelay;
    // Anki-like: first miss gets the wider, further-out window.
    const map = {
      3: [3, 5],
      5: [5, 8],
      8: [8, 11],
      10: [10, 13],
    };
    return map[base] || [5, 8];
  },

  // Tighter window used once a word has already been missed again.
  repeatMissDelayRange() {
    const base = Settings.get().reviewDelay;
    const map = {
      3: [2, 3],
      5: [3, 5],
      8: [5, 7],
      10: [6, 8],
    };
    return map[base] || [3, 5];
  },
};
