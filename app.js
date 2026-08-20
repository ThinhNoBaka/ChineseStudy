// app.js
// Application entry point. Wires storage, settings, excel parsing and the
// quiz engine to the DOM. No other file touches the DOM directly except ui.js.

import { Storage } from './js/storage.js';
import { Settings } from './js/settings.js';
import { parseExcelFile, withIds, deriveLessons } from './js/excel.js';
import { QuizSession, checkAnswer } from './js/quiz.js';
import { Review } from './js/review.js';
import { searchByPinyin } from './js/pinyin.js';
import { initHandwritingPad } from './js/handwriting.js';
import { speak } from './js/speech.js';
import * as UI from './js/ui.js';

const { El } = UI;

/** @type {Array} full vocabulary of the active deck (all lessons combined) */
let vocab = [];
/** @type {string|null} id of the deck currently loaded */
let activeDeckId = null;
/** @type {Array<{id,name,count}>} lessons derived from the active deck */
let lessons = [];
/** @type {string} 'ALL' or a specific lesson id — which lesson is being studied */
let currentLessonId = 'ALL';
/** @type {QuizSession|null} */
let session = null;
let timerInterval = null;
let handwritingPad = null;
/** @type {boolean} whether we are in a wrong-word review session */
let isWrongReview = false;
/** @type {string} which word pool we started with ('all', 'wrong', 'starred') */
let currentPool = 'all';

// ---------------------------------------------------------------------
// Boot
// ---------------------------------------------------------------------

function boot() {
  const settings = Settings.load();
  UI.setDarkMode(settings.darkMode);
  UI.setFontSize(settings.fontSize);
  UI.fillSettingsForm(settings);

  Storage.migrateLegacyVocabIfNeeded();

  activeDeckId = Storage.getActiveDeckId();
  const decks = Storage.getDecks();

  if (activeDeckId && decks.some((d) => d.id === activeDeckId)) {
    loadDeck(activeDeckId);
  }

  renderDeckHistory();
  bindEvents();
}

function renderDeckHistory() {
  UI.renderDeckHistory(Storage.getDecks(), activeDeckId);
}

// ---------------------------------------------------------------------
// Deck management
// ---------------------------------------------------------------------

function loadDeck(deckId) {
  activeDeckId = deckId;
  vocab = Storage.getDeckVocab(deckId);
  lessons = deriveLessons(vocab);
  Storage.setActiveDeckId(deckId);

  // Check for incomplete wrong-word review session first
  const wrongSessionData = Storage.getDeckWrongSession(deckId);
  if (wrongSessionData) {
    if (confirm('Bạn có phiên ôn từ sai chưa hoàn thành. Tiếp tục?')) {
      // Restore the wrong-word review session
      session = new QuizSession(vocab, wrongSessionData);
      isWrongReview = true;
      currentPool = 'wrongLastSession';
      // Clear the stored wrong-word list because it's now a session
      Storage.clearDeckWrongLastSessionIds(deckId);
      UI.showScreen('quiz');
      startTimerLoop();
      renderCurrentCard();
      return;
    } else {
      Storage.clearDeckWrongSession(deckId);
      Storage.clearDeckWrongLastSessionIds(deckId);
    }
  }

  // Normal session check
  const savedSession = Storage.getDeckSession(deckId);
  El.resumePanel.hidden = !savedSession;
  currentLessonId = (savedSession && savedSession.lessonId) || 'ALL';

  renderDeckHistory();

  if (lessons.length > 1 && !savedSession) {
    UI.renderLessonSelect(lessons, vocab.length);
    UI.showLessonSelect();
  } else {
    if (lessons.length === 1) currentLessonId = lessons[0].id;
    showModeSelectForLesson();
  }
}

function wordsForCurrentLesson() {
  if (currentLessonId === 'ALL') return vocab;
  return vocab.filter((w) => w.lessonId === currentLessonId);
}

function selectLesson(lessonId) {
  currentLessonId = lessonId;
  showModeSelectForLesson();
}

function showModeSelectForLesson() {
  refreshUploadCounts();
  let label = null;
  if (lessons.length > 1) {
    label = currentLessonId === 'ALL'
      ? 'Tất cả các bài'
      : (lessons.find((l) => l.id === currentLessonId) || {}).name;
  }
  UI.showModeSelectFor(label, lessons.length > 1);
}

function refreshUploadCounts() {
  const scoped = wordsForCurrentLesson();
  UI.renderUploadCounts({
    all: scoped.length,
    wrong: Review.getWrongIds(activeDeckId).filter((id) => scoped.some((w) => w.id === id)).length,
    starred: Review.getStarredIds(activeDeckId).filter((id) => scoped.some((w) => w.id === id)).length,
  });
}

function touchDeckLastStudied(deckId) {
  const decks = Storage.getDecks();
  const idx = decks.findIndex((d) => d.id === deckId);
  if (idx !== -1) {
    decks[idx].lastStudiedAt = Date.now();
    Storage.setDecks(decks);
  }
}

// ---------------------------------------------------------------------
// Upload flow
// ---------------------------------------------------------------------

async function handleFile(file) {
  El.uploadError.textContent = '';
  try {
    const parsedLessons = await parseExcelFile(file);
    const newVocab = withIds(parsedLessons);
    const id = `d${Date.now()}_${Math.random().toString(36).slice(2, 7)}`;
    const deckMeta = {
      id,
      name: file.name.replace(/\.(xlsx|xls|csv)$/i, ''),
      wordCount: newVocab.length,
      lessonCount: parsedLessons.length,
      createdAt: Date.now(),
      lastStudiedAt: Date.now(),
    };

    Storage.setDeckVocab(id, newVocab);
    const decks = Storage.getDecks();
    decks.push(deckMeta);
    Storage.setDecks(decks);

    loadDeck(id);
    const lessonNote = parsedLessons.length > 1 ? ` trong ${parsedLessons.length} bài` : '';
    UI.showToast(`Đã tải "${deckMeta.name}" — ${newVocab.length} từ${lessonNote}.`);
  } catch (err) {
    El.uploadError.textContent = err.message || 'Không thể đọc file này.';
  }
}

function bindUploadEvents() {
  El.fileInput.addEventListener('change', (e) => {
    const file = e.target.files[0];
    if (file) handleFile(file);
    e.target.value = '';
  });

  El.dropzone.addEventListener('dragover', (e) => {
    e.preventDefault();
    El.dropzone.classList.add('dragover');
  });
  El.dropzone.addEventListener('dragleave', () => El.dropzone.classList.remove('dragover'));
  El.dropzone.addEventListener('drop', (e) => {
    e.preventDefault();
    El.dropzone.classList.remove('dragover');
    const file = e.dataTransfer.files[0];
    if (file) handleFile(file);
  });

  El.btnResume.addEventListener('click', () => {
    const saved = Storage.getDeckSession(activeDeckId);
    if (saved && saved.lessonId) currentLessonId = saved.lessonId;
    startSession('all', saved);
  });

  El.btnNewSession.addEventListener('click', () => {
    Storage.clearDeckSession(activeDeckId);
    // Also clear wrong-word leftovers if starting a fresh session
    Storage.clearDeckWrongLastSessionIds(activeDeckId);
    Storage.clearDeckWrongSession(activeDeckId);
    El.resumePanel.hidden = true;
  });

  El.lessonSelectList.addEventListener('click', (e) => {
    const btn = e.target.closest('button[data-lesson-id]');
    if (!btn) return;
    selectLesson(btn.dataset.lessonId);
  });

  El.btnChangeLesson.addEventListener('click', () => {
    UI.renderLessonSelect(lessons, vocab.length);
    UI.showLessonSelect();
  });

  document.querySelectorAll('.mode-card').forEach((btn) => {
    btn.addEventListener('click', () => {
      if (btn.disabled) return;
      startSession(btn.dataset.start);
    });
  });

  // Deck history: event delegation for "Học" / "Xóa" buttons.
  El.deckHistoryList.addEventListener('click', (e) => {
    const btn = e.target.closest('button[data-action]');
    if (!btn) return;
    const { action, deckId } = btn.dataset;

    if (action === 'select') {
      loadDeck(deckId);
    } else if (action === 'delete') {
      const deck = Storage.getDecks().find((d) => d.id === deckId);
      const label = deck ? deck.name : 'bộ từ này';
      if (!confirm(`Xóa "${label}" cùng toàn bộ tiến độ? Không thể hoàn tác.`)) return;
      Storage.deleteDeck(deckId);
      if (activeDeckId === deckId) {
        activeDeckId = null;
        vocab = [];
        lessons = [];
        El.modeSelectPanel.hidden = true;
        El.lessonSelectPanel.hidden = true;
        El.resumePanel.hidden = true;
      }
      renderDeckHistory();
    }
  });
}

// ---------------------------------------------------------------------
// Session lifecycle
// ---------------------------------------------------------------------

function poolWords(pool) {
  const scoped = wordsForCurrentLesson();
  if (pool === 'wrong') return Review.filterVocab(scoped, Review.getWrongIds(activeDeckId));
  if (pool === 'starred') return Review.filterVocab(scoped, Review.getStarredIds(activeDeckId));
  return scoped;
}

function startSession(pool, restore = null) {
  const words = poolWords(pool);
  if (words.length === 0) {
    UI.showToast('Không có từ nào trong danh sách này.');
    return;
  }
  session = new QuizSession(words, restore);
  isWrongReview = false;
  currentPool = pool;
  // Clear wrong-word list when starting a fresh normal session
  if (pool === 'all' && !restore) {
    Storage.clearDeckWrongLastSessionIds(activeDeckId);
    Storage.clearDeckWrongSession(activeDeckId);
  }
  session.startTimer();
  persistSession(); // save immediately
  touchDeckLastStudied(activeDeckId);

  UI.showScreen('quiz');
  startTimerLoop();
  renderCurrentCard();
}

function persistSession() {
  if (isWrongReview) {
    Storage.setDeckWrongSession(activeDeckId, session.serialize());
  } else {
    Storage.setDeckSession(activeDeckId, { ...session.serialize(), lessonId: currentLessonId });
  }
}

function renderCurrentCard() {
  const settings = Settings.get();
  const word = session.peekCurrent();
  if (!word) {
    finishSession();
    return;
  }
  UI.renderProgress(session, settings.mode, settings.shuffle);
  UI.renderCard(word, settings.mode, Review.isStarred(activeDeckId, word.id));
  El.btnSpeak.classList.add('playing');
  speak(word.hanzi, 'zh-CN', { onEnd: () => El.btnSpeak.classList.remove('playing') }); // read the word aloud every time a new card appears
  if (handwritingPad) handwritingPad.clear();
  session.startTimer();
}

function finishSession() {
  stopTimerLoop();
  const summary = session.summary();
  Review.recordSessionStats(summary);

  let wrongCount = 0;
  if (!isWrongReview && currentPool === 'all') {
    // Only store wrong list for normal sessions (pool === 'all')
    const wrongIds = session.getWrongWordIds();
    if (wrongIds.length > 0) {
      Storage.setDeckWrongLastSessionIds(activeDeckId, wrongIds);
    }
    wrongCount = wrongIds.length;
    Storage.clearDeckSession(activeDeckId);
  } else {
    // Wrong-review session or other special pool: clear its own session data
    if (isWrongReview) {
      Storage.clearDeckWrongSession(activeDeckId);
      isWrongReview = false;
      currentPool = 'all';
    } else {
      // For 'wrong' or 'starred' pools, we do not store a "wrong list"
      Storage.clearDeckSession(activeDeckId);
    }
  }

  UI.renderSummary(summary, wrongCount);
  UI.showScreen('summary');
}

// ---------------------------------------------------------------------
// Wrong-word review of the last session
// ---------------------------------------------------------------------

function startWrongLastSession() {
  const ids = Storage.getDeckWrongLastSessionIds(activeDeckId);
  if (!ids || ids.length === 0) {
    UI.showToast('Không có từ sai nào để ôn.');
    return;
  }
  const words = vocab.filter((w) => ids.includes(w.id));
  if (words.length === 0) {
    UI.showToast('Không tìm thấy từ tương ứng.');
    return;
  }

  // Create a new session with the wrong words
  session = new QuizSession(words);
  isWrongReview = true;
  currentPool = 'wrongLastSession';
  Storage.setDeckWrongSession(activeDeckId, session.serialize());
  // Remove the stored list because we now have a session
  Storage.clearDeckWrongLastSessionIds(activeDeckId);

  session.startTimer();
  UI.showScreen('quiz');
  startTimerLoop();
  renderCurrentCard();
}

// ---------------------------------------------------------------------
// Timer
// ---------------------------------------------------------------------

function startTimerLoop() {
  stopTimerLoop();
  timerInterval = setInterval(() => {
    if (!session) return;
    const elapsed = Math.floor((Date.now() - session.startTime) / 1000);
    UI.renderTimer(elapsed);
  }, 1000);
}

function stopTimerLoop() {
  clearInterval(timerInterval);
  timerInterval = null;
}

// ---------------------------------------------------------------------
// Pinyin keyboard & handwriting pad
// ---------------------------------------------------------------------

function bindInputToolEvents() {
  El.btnTogglePinyin.addEventListener('click', () => {
    const willShow = El.pinyinPanel.hidden;
    UI.togglePinyinPanel(willShow);
  });

  El.btnToggleHandwrite.addEventListener('click', () => {
    const willShow = El.handwritePanel.hidden;
    UI.toggleHandwritePanel(willShow);
    if (willShow && !handwritingPad) {
      handwritingPad = initHandwritingPad(El.handwriteCanvas);
    }
  });

  El.pinyinSearch.addEventListener('input', () => {
    const candidates = searchByPinyin(vocab, El.pinyinSearch.value);
    UI.renderPinyinCandidates(candidates);
  });

  El.pinyinCandidates.addEventListener('click', (e) => {
    const btn = e.target.closest('button[data-hanzi]');
    if (!btn) return;
    El.answerInput.value = btn.dataset.hanzi;
    El.answerInput.focus();
  });

  El.btnClearHw.addEventListener('click', () => {
    if (handwritingPad) handwritingPad.clear();
  });
}

// ---------------------------------------------------------------------
// Settings
// ---------------------------------------------------------------------

function bindSettingsEvents() {
  El.btnSettings.addEventListener('click', () => {
    UI.fillSettingsForm(Settings.get());
    UI.openSettings();
  });
  El.btnCloseSettings.addEventListener('click', UI.closeSettings);
  El.settingsOverlay.addEventListener('click', UI.closeSettings);

  El.settingMode.addEventListener('change', () => {
    Settings.update({ mode: El.settingMode.value });
    if (session && !session.isFinished) renderCurrentCard();
  });

  El.settingShuffle.addEventListener('change', () => {
    Settings.update({ shuffle: El.settingShuffle.checked });
  });

  El.settingDarkmode.addEventListener('change', () => {
    Settings.update({ darkMode: El.settingDarkmode.checked });
    UI.setDarkMode(El.settingDarkmode.checked);
  });

  El.settingFontsize.addEventListener('change', () => {
    Settings.update({ fontSize: El.settingFontsize.value });
    UI.setFontSize(El.settingFontsize.value);
  });

  El.settingDelay.addEventListener('change', () => {
    Settings.update({ reviewDelay: Number(El.settingDelay.value) });
  });

  El.btnDark.addEventListener('click', () => {
    const next = !Settings.get().darkMode;
    Settings.update({ darkMode: next });
    UI.setDarkMode(next);
  });

  El.btnUploadNew.addEventListener('click', () => {
    UI.closeSettings();
    stopTimerLoop();
    session = null;
    UI.showScreen('upload');
    El.fileInput.click();
  });

  El.btnResetProgress.addEventListener('click', () => {
    if (!confirm('Xóa toàn bộ tiến độ, bộ từ đã tải và cài đặt? Hành động này không thể hoàn tác.')) return;
    Storage.clearAll();
    location.reload();
  });
}

// ---------------------------------------------------------------------
// Quiz + summary events
// ---------------------------------------------------------------------

function bindQuizEvents() {
  El.btnCheck.addEventListener('click', handleCheck);
  El.btnNext.addEventListener('click', handleNext);

  El.answerInput.addEventListener('keydown', (e) => {
    if (e.key !== 'Enter') return;
    e.preventDefault();
    if (!El.btnCheck.hidden) {
      handleCheck();
    } else if (!El.btnNext.hidden) {
      handleNext();
    }
  });

  El.btnStar.addEventListener('click', () => {
    const word = session.peekCurrent();
    if (!word) return;
    const starred = Review.toggleStar(activeDeckId, word.id);
    El.btnStar.setAttribute('aria-pressed', String(starred));
  });

  El.btnSpeak.addEventListener('click', () => {
    const word = session.peekCurrent();
    if (!word) return;
    El.btnSpeak.classList.add('playing');
    speak(word.hanzi, 'zh-CN', { onEnd: () => El.btnSpeak.classList.remove('playing') });
  });

  El.btnStudyWrongAgain.addEventListener('click', () => startSession('wrong'));
  El.btnBackHome.addEventListener('click', () => {
    refreshUploadCounts();
    renderDeckHistory();
    UI.showScreen('upload');
  });

  // Handle the "review wrong from last session" button
  document.addEventListener('click', (e) => {
    const btn = e.target.closest('[data-action="review-wrong-last"]');
    if (btn) {
      e.preventDefault();
      startWrongLastSession();
    }
  });
}

// ---------------------------------------------------------------------
// Answer checking
// ---------------------------------------------------------------------

function handleCheck() {
  const settings = Settings.get();
  const word = session.peekCurrent();
  if (!word) return;

  const typed = El.answerInput.value;
  const expected = settings.mode === 'cn-vi' ? word.vi : word.hanzi;
  const isCorrect = checkAnswer(typed, expected, settings.mode);

  const result = session.submitAnswer(isCorrect);

  if (isCorrect) {
    Review.clearWrong(activeDeckId, word.id);
  } else {
    Review.recordWrong(activeDeckId, word.id);
  }

  persistSession();
  UI.renderFeedback(result.isCorrect, word);
  UI.renderProgress(session, settings.mode, settings.shuffle);
}

function handleNext() {
  renderCurrentCard();
}

// ---------------------------------------------------------------------
// Init
// ---------------------------------------------------------------------

function bindEvents() {
  bindUploadEvents();
  bindSettingsEvents();
  bindQuizEvents();
  bindInputToolEvents();
}

boot();