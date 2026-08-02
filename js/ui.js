// ui.js
// All direct DOM manipulation lives here so app.js can stay declarative.

const $ = (sel) => document.querySelector(sel);

export const El = {
  screens: {
    upload: $('#screen-upload'),
    quiz: $('#screen-quiz'),
    summary: $('#screen-summary'),
  },
  dropzone: $('#dropzone'),
  fileInput: $('#file-input'),
  uploadError: $('#upload-error'),
  resumePanel: $('#resume-panel'),
  btnResume: $('#btn-resume'),
  btnNewSession: $('#btn-new-session'),
  modeSelectPanel: $('#mode-select-panel'),
  modeSelectHeading: $('#mode-select-heading'),
  btnChangeLesson: $('#btn-change-lesson'),
  countAll: $('#count-all'),
  countWrong: $('#count-wrong'),
  countStarred: $('#count-starred'),

  lessonSelectPanel: $('#lesson-select-panel'),
  lessonSelectList: $('#lesson-select-list'),

  deckHistoryPanel: $('#deck-history-panel'),
  deckHistoryList: $('#deck-history-list'),

  progressText: $('#progress-text'),
  modeIndicator: $('#mode-indicator'),
  shuffleIndicator: $('#shuffle-indicator'),
  progressFill: $('#progress-bar-fill'),
  progressTrack: $('#progress-bar-track'),
  timer: $('#quiz-timer'),

  card: $('#vocab-card'),
  cardPrompt: $('#card-prompt'),
  answerInput: $('#answer-input'),
  btnStar: $('#btn-star'),
  cardFeedback: $('#card-feedback'),
  feedbackBadge: $('#feedback-badge'),
  fdHanzi: $('#fd-hanzi'),
  fdPinyin: $('#fd-pinyin'),
  fdVi: $('#fd-vi'),
  btnCheck: $('#btn-check'),
  btnNext: $('#btn-next'),

  inputTools: $('#input-tools'),
  btnTogglePinyin: $('#btn-toggle-pinyin'),
  btnToggleHandwrite: $('#btn-toggle-handwrite'),
  pinyinPanel: $('#pinyin-panel'),
  pinyinSearch: $('#pinyin-search'),
  pinyinCandidates: $('#pinyin-candidates'),
  pinyinEmpty: $('#pinyin-empty'),
  handwritePanel: $('#handwrite-panel'),
  handwriteCanvas: $('#handwrite-canvas'),
  btnClearHw: $('#btn-clear-hw'),

  summaryGrid: $('#summary-grid'),
  btnStudyWrongAgain: $('#btn-study-wrong-again'),
  btnBackHome: $('#btn-back-home'),

  btnSettings: $('#btn-settings'),
  btnCloseSettings: $('#btn-close-settings'),
  settingsPanel: $('#settings-panel'),
  settingsOverlay: $('#settings-overlay'),
  settingMode: $('#setting-mode'),
  settingShuffle: $('#setting-shuffle'),
  settingDarkmode: $('#setting-darkmode'),
  settingFontsize: $('#setting-fontsize'),
  settingDelay: $('#setting-delay'),
  btnUploadNew: $('#btn-upload-new'),
  btnResetProgress: $('#btn-reset-progress'),

  btnDark: $('#btn-dark'),
  toast: $('#toast'),
  sealStamp: $('#seal-stamp'),
};

export function showScreen(name) {
  Object.entries(El.screens).forEach(([key, node]) => {
    node.classList.toggle('active', key === name);
  });
  window.scrollTo({ top: 0, behavior: 'smooth' });
}

let toastTimer = null;
export function showToast(message) {
  El.toast.textContent = message;
  El.toast.hidden = false;
  clearTimeout(toastTimer);
  toastTimer = setTimeout(() => { El.toast.hidden = true; }, 2400);
}

export function setDarkMode(isDark) {
  document.documentElement.setAttribute('data-theme', isDark ? 'dark' : 'light');
  El.settingDarkmode.checked = isDark;
}

export function setFontSize(size) {
  document.body.setAttribute('data-fontsize', size);
  El.settingFontsize.value = size;
}

export function openSettings() {
  El.settingsPanel.classList.add('open');
  El.settingsPanel.setAttribute('aria-hidden', 'false');
  El.settingsOverlay.hidden = false;
}

export function closeSettings() {
  El.settingsPanel.classList.remove('open');
  El.settingsPanel.setAttribute('aria-hidden', 'true');
  El.settingsOverlay.hidden = true;
}

export function fillSettingsForm(settings) {
  El.settingMode.value = settings.mode;
  El.settingShuffle.checked = settings.shuffle;
  El.settingDarkmode.checked = settings.darkMode;
  El.settingFontsize.value = settings.fontSize;
  El.settingDelay.value = String(settings.reviewDelay);
}

export function renderLessonSelect(lessons, totalCount) {
  const allItem = `
    <div class="lesson-item all-lessons">
      <div class="lesson-info">
        <strong>🔀 Tất cả các bài</strong>
        <span>${totalCount} từ · ${lessons.length} bài</span>
      </div>
      <button class="lesson-select-btn" type="button" data-lesson-id="ALL">Học</button>
    </div>
  `;
  const items = lessons.map((l) => `
    <div class="lesson-item">
      <div class="lesson-info">
        <strong>${escapeHtml(l.name)}</strong>
        <span>${l.count} từ</span>
      </div>
      <button class="lesson-select-btn" type="button" data-lesson-id="${l.id}">Học</button>
    </div>
  `).join('');
  El.lessonSelectList.innerHTML = allItem + items;
}

export function showLessonSelect() {
  El.lessonSelectPanel.hidden = false;
  El.modeSelectPanel.hidden = true;
}

export function showModeSelectFor(lessonLabel, hasMultipleLessons) {
  El.lessonSelectPanel.hidden = true;
  El.modeSelectPanel.hidden = false;
  El.modeSelectHeading.textContent = lessonLabel
    ? `Chọn chế độ học — ${lessonLabel}`
    : 'Chọn chế độ học';
  El.btnChangeLesson.hidden = !hasMultipleLessons;
}

export function renderUploadCounts({ all, wrong, starred }) {
  El.countAll.textContent = `${all} từ`;
  El.countWrong.textContent = `${wrong} từ`;
  El.countStarred.textContent = `${starred} từ`;

  const wrongCard = document.querySelector('[data-start="wrong"]');
  const starredCard = document.querySelector('[data-start="starred"]');
  wrongCard.disabled = wrong === 0;
  wrongCard.style.opacity = wrong === 0 ? 0.45 : 1;
  starredCard.disabled = starred === 0;
  starredCard.style.opacity = starred === 0 ? 0.45 : 1;
}

export function renderProgress(session, mode, shuffle) {
  const { done, total } = session.progressCount();
  El.progressText.textContent = `Câu ${Math.min(done + 1, total)} / ${total}`;
  El.modeIndicator.textContent = mode === 'cn-vi' ? 'Hán → Việt' : 'Việt → Hán';
  El.shuffleIndicator.textContent = `Xáo trộn: ${shuffle ? 'Bật' : 'Tắt'}`;
  const pct = total === 0 ? 0 : Math.round((done / total) * 100);
  El.progressFill.style.width = pct + '%';
  El.progressTrack.setAttribute('aria-valuenow', String(pct));
}

export function renderDeckHistory(decks, activeId) {
  El.deckHistoryPanel.hidden = decks.length === 0;
  if (decks.length === 0) return;

  const sorted = [...decks].sort((a, b) => (b.lastStudiedAt || b.createdAt) - (a.lastStudiedAt || a.createdAt));

  El.deckHistoryList.innerHTML = sorted.map((d) => {
    const date = new Date(d.createdAt).toLocaleDateString('vi-VN');
    const isActive = d.id === activeId;
    const lessonNote = d.lessonCount > 1 ? ` · ${d.lessonCount} bài` : '';
    return `
      <div class="deck-item ${isActive ? 'active' : ''}">
        <div class="deck-info">
          <strong>${escapeHtml(d.name)}</strong>
          <span>${d.wordCount} từ${lessonNote} · ${date}</span>
        </div>
        <div class="deck-actions">
          <button class="deck-select-btn" type="button" data-action="select" data-deck-id="${d.id}">Học</button>
          <button class="deck-delete-btn" type="button" data-action="delete" data-deck-id="${d.id}" aria-label="Xóa bộ từ ${escapeHtml(d.name)}">✕</button>
        </div>
      </div>
    `;
  }).join('');
}

function escapeHtml(str) {
  const div = document.createElement('div');
  div.textContent = str;
  return div.innerHTML;
}

export function togglePinyinPanel(show) {
  El.pinyinPanel.hidden = !show;
  El.btnTogglePinyin.setAttribute('aria-pressed', String(show));
  if (show) {
    El.handwritePanel.hidden = true;
    El.btnToggleHandwrite.setAttribute('aria-pressed', 'false');
    El.pinyinSearch.value = '';
    El.pinyinCandidates.innerHTML = '';
    El.pinyinEmpty.hidden = true;
    El.pinyinSearch.focus();
  }
}

export function toggleHandwritePanel(show) {
  El.handwritePanel.hidden = !show;
  El.btnToggleHandwrite.setAttribute('aria-pressed', String(show));
  if (show) {
    El.pinyinPanel.hidden = true;
    El.btnTogglePinyin.setAttribute('aria-pressed', 'false');
  }
}

export function renderPinyinCandidates(candidates) {
  El.pinyinEmpty.hidden = candidates.length !== 0;
  El.pinyinCandidates.innerHTML = candidates.map((c) => `
    <button type="button" class="pinyin-candidate-btn" data-hanzi="${escapeHtml(c.hanzi)}">
      <span class="cand-hanzi" lang="zh">${escapeHtml(c.hanzi)}</span>
      <span class="cand-pinyin">${escapeHtml(c.pinyin)}</span>
    </button>
  `).join('');
}

export function renderCard(word, mode, isStarred) {
  const prompt = mode === 'cn-vi' ? word.hanzi : word.vi;
  El.cardPrompt.textContent = prompt;
  El.cardPrompt.classList.toggle('is-latin', mode !== 'cn-vi');
  El.cardPrompt.lang = mode === 'cn-vi' ? 'zh' : 'vi';

  El.answerInput.value = '';
  El.answerInput.className = 'answer-input';
  El.answerInput.placeholder = mode === 'cn-vi' ? 'Nhập nghĩa tiếng Việt...' : 'Nhập chữ Hán...';
  El.answerInput.lang = mode === 'cn-vi' ? 'vi' : 'zh';

  El.btnStar.setAttribute('aria-pressed', String(isStarred));

  El.cardFeedback.hidden = true;
  El.btnCheck.hidden = false;
  El.btnNext.hidden = true;
  El.btnCheck.disabled = false;

  // Input-assist tools (Pinyin keyboard / handwriting pad) only make sense
  // when the user has to produce Chinese characters as the answer.
  El.inputTools.hidden = mode !== 'vi-cn';
  togglePinyinPanel(false);
  toggleHandwritePanel(false);

  El.answerInput.focus();
}

export function renderFeedback(isCorrect, word) {
  El.answerInput.classList.add(isCorrect ? 'correct' : 'wrong');
  El.cardFeedback.hidden = false;
  El.feedbackBadge.textContent = isCorrect ? '✓ Chính xác' : '✗ Chưa đúng';
  El.feedbackBadge.className = 'feedback-badge ' + (isCorrect ? 'correct' : 'wrong');
  El.fdHanzi.textContent = word.hanzi;
  El.fdPinyin.textContent = word.pinyin;
  El.fdVi.textContent = word.vi;

  El.btnCheck.hidden = true;
  El.btnNext.hidden = false;
  El.btnNext.focus();

  if (isCorrect) fireSealStamp();
}

export function fireSealStamp() {
  El.sealStamp.classList.remove('stamping');
  // force reflow to restart animation
  void El.sealStamp.offsetWidth;
  El.sealStamp.classList.add('stamping');
}

export function renderTimer(seconds) {
  const m = String(Math.floor(seconds / 60)).padStart(2, '0');
  const s = String(seconds % 60).padStart(2, '0');
  El.timer.textContent = `${m}:${s}`;
}

export function renderSummary(summary) {
  const stats = [
    { label: 'Tổng số từ', value: summary.totalWords },
    { label: 'Đúng ngay lần đầu', value: summary.correctFirstTry },
    { label: 'Số lần trả lời sai', value: summary.wrongAnswers },
    { label: 'Độ chính xác', value: summary.accuracy + '%' },
    { label: 'Thời gian học', value: formatDuration(summary.studyTimeSec) },
    { label: 'Thời gian TB / câu', value: summary.avgResponseSec + 's' },
    { label: 'Tổng số lượt ôn', value: summary.totalReviews },
  ];
  El.summaryGrid.innerHTML = stats.map((s) => `
    <div class="summary-stat">
      <div class="stat-value">${s.value}</div>
      <div class="stat-label">${s.label}</div>
    </div>
  `).join('');
}

function formatDuration(sec) {
  const m = Math.floor(sec / 60);
  const s = sec % 60;
  return m > 0 ? `${m}p ${s}s` : `${s}s`;
}
