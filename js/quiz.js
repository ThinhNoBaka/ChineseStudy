// quiz.js
// The heart of the app: an Anki-like (but simplified) scheduler.
//
// A study session is a dynamic queue of word ids. Each word starts as
// 'learning'. Answer correctly on the very first attempt -> 'mastered',
// removed from the queue forever. Answer wrong -> stays 'learning' and
// gets re-inserted a random distance ahead (further away the first time
// it's missed, closer the next time), so the session finishes only once
// every word has been mastered.

import { Settings } from './settings.js';

function shuffleArray(arr) {
  const a = [...arr];
  for (let i = a.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [a[i], a[j]] = [a[j], a[i]];
  }
  return a;
}

function randomInRange([min, max]) {
  return Math.floor(Math.random() * (max - min + 1)) + min;
}

export class QuizSession {
  /**
   * @param {Array} words - vocabulary objects {id, hanzi, pinyin, vi}
   * @param {Object} [restore] - a previously-serialized session to resume
   */
  constructor(words, restore = null) {
    this.words = new Map(words.map((w) => [w.id, w]));

    if (restore) {
      this.queue = restore.queue.filter((id) => this.words.has(id));
      this.order = restore.order;
      this.lastWordId = restore.lastWordId;
      this.correctFirstTry = restore.correctFirstTry;
      this.wrongAnswers = restore.wrongAnswers;
      this.totalReviews = restore.totalReviews;
      this.responseTimes = restore.responseTimes || [];
      this.startTime = restore.startTime;
      this.wordStats = restore.wordStats || {};
      this.currentStartedAt = Date.now();
      return;
    }

    const ids = words.map((w) => w.id);
    this.order = Settings.get().shuffle ? shuffleArray(ids) : ids;
    this.queue = [...this.order];
    this.lastWordId = null;
    this.correctFirstTry = 0;
    this.wrongAnswers = 0;
    this.totalReviews = 0;
    this.responseTimes = [];
    this.startTime = Date.now();
    this.currentStartedAt = Date.now();
    // Per-word tracking: has it ever been answered wrong this session?
    this.wordStats = {};
    ids.forEach((id) => {
      this.wordStats[id] = { missedOnce: false, attempts: 0 };
    });
  }

  get totalWords() {
    return this.words.size;
  }

  get remaining() {
    return this.queue.length;
  }

  get isFinished() {
    return this.queue.length === 0;
  }

  /** Returns the word object that should be shown next, or null if done. */
  peekCurrent() {
    if (this.queue.length === 0) return null;

    // Avoid immediate repeats unless it's the only word left.
    if (this.queue[0] === this.lastWordId && this.queue.length > 1) {
      // rotate the front word to a random later slot
      const w = this.queue.shift();
      const insertAt = Math.min(this.queue.length, 1 + Math.floor(Math.random() * this.queue.length));
      this.queue.splice(insertAt, 0, w);
    }

    return this.words.get(this.queue[0]);
  }

  /** Marks the beginning of the response timer for the current word. */
  startTimer() {
    this.currentStartedAt = Date.now();
  }

  /**
   * Submits an answer for the current front-of-queue word.
   * @param {boolean} isCorrect
   * @returns {{isCorrect:boolean, mastered:boolean}}
   */
  submitAnswer(isCorrect) {
    const id = this.queue.shift();
    const stat = this.wordStats[id] || { missedOnce: false, attempts: 0 };
    stat.attempts += 1;
    this.totalReviews += 1;

    const elapsed = (Date.now() - this.currentStartedAt) / 1000;
    this.responseTimes.push(elapsed);

    let mastered = false;

    if (isCorrect) {
      if (stat.attempts === 1) this.correctFirstTry += 1;
      mastered = true; // correct answer always masters the word, per spec
    } else {
      this.wrongAnswers += 1;
      const range = stat.missedOnce
        ? Settings.repeatMissDelayRange()
        : Settings.firstMissDelayRange();
      stat.missedOnce = true;
      const gap = randomInRange(range);
      const insertAt = Math.min(this.queue.length, gap);
      this.queue.splice(insertAt, 0, id);
    }

    this.wordStats[id] = stat;
    this.lastWordId = id;

    return { isCorrect, mastered };
  }

  progressCount() {
    // "Question N / total": how many distinct words have reached a
    // terminal (mastered) state so far, out of the whole set.
    const mastered = this.totalWords - new Set(this.queue).size;
    return { done: mastered, total: this.totalWords };
  }

  summary() {
    const elapsedSec = (Date.now() - this.startTime) / 1000;
    const avgResponse = this.responseTimes.length
      ? this.responseTimes.reduce((a, b) => a + b, 0) / this.responseTimes.length
      : 0;
    const accuracy = this.totalReviews
      ? Math.round((this.correctFirstTry / this.totalWords) * 100)
      : 0;

    return {
      totalWords: this.totalWords,
      correctFirstTry: this.correctFirstTry,
      wrongAnswers: this.wrongAnswers,
      accuracy,
      studyTimeSec: Math.round(elapsedSec),
      avgResponseSec: Math.round(avgResponse * 10) / 10,
      totalReviews: this.totalReviews,
    };
  }

  serialize() {
    return {
      queue: this.queue,
      order: this.order,
      lastWordId: this.lastWordId,
      correctFirstTry: this.correctFirstTry,
      wrongAnswers: this.wrongAnswers,
      totalReviews: this.totalReviews,
      responseTimes: this.responseTimes,
      startTime: this.startTime,
      wordStats: this.wordStats,
    };
  }
}

/**
 * Checks a typed answer against the expected value for the active mode.
 * @param {string} typed
 * @param {string} expected
 * @param {'cn-vi'|'vi-cn'} mode
 */

// Splits a Vietnamese meaning cell into individual accepted answers.
// Excel authors can write multiple meanings in one cell separated by
// "/", ",", ";" or the Chinese enumeration comma "、" — e.g.
// "Bưu điện / Nhà bưu chính" — and any single one of them counts as correct.
function splitAlternatives(str) {
  return (str || '')
    .split(/\s*(\/|,|;|、)\s*/)
    .map((s) => s.trim())
    .filter(Boolean);
}

export function checkAnswer(typed, expected, mode) {
  const a = (typed || '').trim();
  const b = (expected || '').trim();

  if (mode === 'vi-cn') {
    // Chinese target: must match exactly (characters are unambiguous,
    // no case concept applies).
    return a === b;
  }

  // Vietnamese target: case-insensitive, and correct if it matches ANY
  // one of the alternative meanings listed in the cell.
  const alternatives = splitAlternatives(b);
  const candidates = alternatives.length > 0 ? alternatives : [b];
  const aLower = a.toLowerCase();
  return candidates.some((alt) => alt.toLowerCase() === aLower);
}
