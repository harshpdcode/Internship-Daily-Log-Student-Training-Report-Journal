/**
 * INTERNSHIP DAILY LOG — APPLICATION CORE (ES MODULE)
 * 
 * An offline-first, client-side journal and report generator for MSc IT
 * training subjects. Pure vanilla JavaScript with no external dependencies.
 *
 * Authentication & Profiles:
 * - Harsh123 (password: 123)
 * - nishtha123 (password: 123)
 * - Each profile maintains its own isolated logbook, profile, and draft in localStorage.
 */

// Authorized Accounts
const AUTHORIZED_ACCOUNTS = {
  'Harsh123': '123',
  'nishtha123': '123'
};

const SESSION_USER_KEY = 'internship_active_user';
const STORAGE_PREFIX = 'internship_log_user_';

// DOM Selectors
const $ = (id) => document.getElementById(id);
const on = (id, event, handler) => {
  const el = $(id);
  if (el) el.addEventListener(event, handler);
};

// Current Session State
let activeUser = getPersistedUser();
let state = activeUser ? loadUserState(activeUser) : null;
let currentEditingId = null;
let lastDeletedEntry = null;
let undoTimeoutId = null;

// Mini Calendar View State
let calViewDate = new Date();

/**
 * Creates default state for a specific user profile.
 */
function createInitialState(username) {
  const defaultName = username === 'Harsh123' ? 'Harsh' : (username === 'nishtha123' ? 'Nishtha' : '');
  return {
    profile: {
      studentName: defaultName,
      college: '',
      companyName: '',
      department: '',
      supervisorName: '',
      startDate: '',
      endDate: ''
    },
    entries: [],
    draft: null,
    meta: {
      theme: 'system',
      lastBackupDate: null
    }
  };
}

// ============================================================================
// 1. Authentication & Session Management
// ============================================================================

function getPersistedUser() {
  try {
    const user = localStorage.getItem(SESSION_USER_KEY);
    if (user && AUTHORIZED_ACCOUNTS[user]) return user;
    return null;
  } catch {
    return null;
  }
}

function loadUserState(username) {
  try {
    const key = STORAGE_PREFIX + username;
    const raw = localStorage.getItem(key);
    if (!raw) return createInitialState(username);
    const parsed = JSON.parse(raw);
    return {
      profile: { ...createInitialState(username).profile, ...(parsed.profile || {}) },
      entries: Array.isArray(parsed.entries) ? parsed.entries : [],
      draft: parsed.draft || null,
      meta: { ...createInitialState(username).meta, ...(parsed.meta || {}) }
    };
  } catch (error) {
    console.error('Error loading user state:', error);
    return createInitialState(username);
  }
}

function saveState() {
  if (!activeUser || !state) return false;
  try {
    const key = STORAGE_PREFIX + activeUser;
    localStorage.setItem(key, JSON.stringify(state));
    return true;
  } catch (error) {
    // Handle storage quota exceeded or private-mode restrictions
    if (error && (error.name === 'QuotaExceededError' || error.name === 'NS_ERROR_DOM_QUOTA_REACHED')) {
      showToast('Storage is full. Please export a backup and clear some data to continue.', 'error', 8000);
    } else {
      showToast('Could not save to browser storage. Changes may be lost if you close the tab.', 'warning', 7000);
    }
    console.error('Error writing state to localStorage:', error);
    updateStatusIndicator('Storage error', true);
    return false;
  }
}

function handleLoginSubmit(e) {
  e.preventDefault();
  const form = e.target;
  const username = form.username.value.trim();
  const password = form.password.value;
  const errorBanner = $('login-error-banner');
  const submitBtn = form.querySelector('button[type="submit"]');

  // Friendly empty-field hints
  if (!username) {
    if (errorBanner) {
      errorBanner.textContent = 'Please enter your username.';
      errorBanner.classList.remove('hidden');
    }
    form.username.focus();
    return;
  }
  if (!password) {
    if (errorBanner) {
      errorBanner.textContent = 'Please enter your password.';
      errorBanner.classList.remove('hidden');
    }
    form.password.focus();
    return;
  }

  if (AUTHORIZED_ACCOUNTS[username] && AUTHORIZED_ACCOUNTS[username] === password) {
    if (errorBanner) errorBanner.classList.add('hidden');
    if (submitBtn) submitBtn.textContent = 'Opening\u2026';
    activeUser = username;
    try {
      localStorage.setItem(SESSION_USER_KEY, username);
    } catch {}

    state = loadUserState(username);
    form.reset();
    document.querySelectorAll('.profile-card-btn').forEach(b => b.classList.remove('selected'));
    showAppInterface();
  } else {
    if (errorBanner) {
      if (AUTHORIZED_ACCOUNTS[username]) {
        errorBanner.textContent = 'Incorrect password. The password is 123.';
      } else {
        errorBanner.textContent = 'Username not recognised. Use Harsh123 or nishtha123.';
      }
      errorBanner.classList.remove('hidden');
    }
    if (submitBtn) submitBtn.textContent = 'Open Logbook \u2192';
    // Shake the password field for a wrong password attempt
    const passwordInput = form.password;
    passwordInput.select();
    passwordInput.classList.add('field-error-pulse');
    setTimeout(() => passwordInput.classList.remove('field-error-pulse'), 400);
  }
}

function handleLogout() {
  activeUser = null;
  state = null;
  currentEditingId = null;
  try {
    localStorage.removeItem(SESSION_USER_KEY);
  } catch {}
  showLoginScreen();
}

function showLoginScreen() {
  const loginScreen = $('login-screen');
  const appRoot = $('app-root');
  if (loginScreen) loginScreen.classList.remove('hidden');
  if (appRoot) appRoot.classList.add('hidden');

  const errorBanner = $('login-error-banner');
  if (errorBanner) errorBanner.classList.add('hidden');
}

function showAppInterface() {
  const loginScreen = $('login-screen');
  const appRoot = $('app-root');
  if (loginScreen) loginScreen.classList.add('hidden');
  if (appRoot) appRoot.classList.remove('hidden');

  // Update header student badge
  const studentPill = $('header-student-pill');
  if (studentPill) {
    const displayName = (state.profile && state.profile.studentName) ? state.profile.studentName : activeUser;
    studentPill.textContent = displayName;
  }

  const companySub = $('header-company-sub');
  if (companySub) {
    companySub.textContent = (state.profile && state.profile.companyName) ? state.profile.companyName : 'MSc IT Training';
  }

  // Apply theme
  applyTheme(state.meta.theme || 'system');

  // Setup initial editor state (draft or today)
  const todayStr = getTodayIsoDate();
  const existingToday = state.entries.find(e => e.date === todayStr);

  if (state.draft) {
    populateEditor(state.draft, true);
    updateStatusIndicator('Restored unsaved draft', true);
  } else if (existingToday) {
    populateEditor(existingToday, false);
  } else {
    prepareNewEntry(todayStr);
  }

  // Render components
  renderSummaryMetrics();
  renderLedgerList();
  renderMiniCalendar();
  updateLiveWordCounts();
}

// ============================================================================
// 2. Date & Calendar Calculation Helpers
// ============================================================================

function parseLocalDate(dateStr) {
  if (!dateStr || typeof dateStr !== 'string') return null;
  const parts = dateStr.split('-').map(Number);
  if (parts.length !== 3 || isNaN(parts[0]) || isNaN(parts[1]) || isNaN(parts[2])) return null;
  return new Date(parts[0], parts[1] - 1, parts[2]);
}

function formatToIsoDate(date) {
  const y = date.getFullYear();
  const m = String(date.getMonth() + 1).padStart(2, '0');
  const d = String(date.getDate()).padStart(2, '0');
  return `${y}-${m}-${d}`;
}

function getTodayIsoDate() {
  return formatToIsoDate(new Date());
}

function formatDisplayDate(dateStr) {
  const d = parseLocalDate(dateStr);
  if (!d) return dateStr || '';
  const weekdays = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];
  const months = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];
  return `${weekdays[d.getDay()]}, ${String(d.getDate()).padStart(2, '0')} ${months[d.getMonth()]} ${d.getFullYear()}`;
}

function formatShortDate(dateStr) {
  const d = parseLocalDate(dateStr);
  if (!d) return dateStr || '';
  const months = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];
  return `${d.getDate()} ${months[d.getMonth()]}`;
}

function calculateDayNumber(entryDateStr, startDateStr) {
  if (!startDateStr || !entryDateStr) return null;
  const start = parseLocalDate(startDateStr);
  const curr = parseLocalDate(entryDateStr);
  if (!start || !curr) return null;
  const utcStart = Date.UTC(start.getFullYear(), start.getMonth(), start.getDate());
  const utcCurr = Date.UTC(curr.getFullYear(), curr.getMonth(), curr.getDate());
  const diffDays = Math.round((utcCurr - utcStart) / (1000 * 60 * 60 * 24));
  return diffDays + 1; // Start date = Day 1
}

function calculateWeekNumber(dayNum) {
  if (dayNum === null || dayNum === undefined || isNaN(dayNum)) return 1;
  if (dayNum <= 0) return 0;
  return Math.floor((dayNum - 1) / 7) + 1;
}

function calculateMissingDates(startDateStr, entries) {
  if (!startDateStr) return [];
  const start = parseLocalDate(startDateStr);
  const today = parseLocalDate(getTodayIsoDate());
  if (!start || !today || start > today) return [];

  const loggedDates = new Set(entries.map(e => e.date));
  const missing = [];
  let cursor = new Date(start);
  while (cursor <= today) {
    const iso = formatToIsoDate(cursor);
    if (!loggedDates.has(iso)) missing.push(iso);
    cursor.setDate(cursor.getDate() + 1);
  }
  return missing;
}

function calculateCurrentStreak(entries) {
  if (!entries || entries.length === 0) return 0;
  const loggedDates = new Set(entries.filter(e => e.status !== 'No work').map(e => e.date));
  const todayStr = getTodayIsoDate();

  let checkDate = parseLocalDate(todayStr);
  if (!loggedDates.has(todayStr)) {
    const yesterday = new Date(checkDate);
    yesterday.setDate(yesterday.getDate() - 1);
    const yesterdayStr = formatToIsoDate(yesterday);
    if (loggedDates.has(yesterdayStr)) {
      checkDate = yesterday;
    } else {
      return 0;
    }
  }

  let streak = 0;
  while (checkDate) {
    const iso = formatToIsoDate(checkDate);
    if (loggedDates.has(iso)) {
      streak++;
      checkDate.setDate(checkDate.getDate() - 1);
    } else {
      break;
    }
  }
  return streak;
}

// ============================================================================
// 3. UI State & Status Indicators
// ============================================================================

function updateStatusIndicator(message, isAlert = false) {
  const container = $('save-status-indicator');
  const label = $('status-text');
  if (!container || !label) return;
  label.textContent = message;
  container.className = 'save-status-indicator ' + (isAlert ? 'saving' : 'saved');
}

function updateDraftVisibility(hasDraft) {
  const badge = $('draft-indicator');
  const note = $('bottom-draft-note');
  if (badge) badge.classList.toggle('visible', !!hasDraft);
  if (note) {
    note.textContent = hasDraft 
      ? 'Unsaved changes are currently preserved in local draft.'
      : 'All changes saved to logbook.';
  }
}

function countWords(str) {
  if (!str) return 0;
  const matches = str.trim().match(/\S+/g);
  return matches ? matches.length : 0;
}

function updateLiveWordCounts() {
  const workArea = $('entry-work');
  const workCounter = $('work-done-counter');
  const totalCounter = $('entry-total-words');
  const form = $('entry-editor-form');

  if (workArea && workCounter) {
    const words = countWords(workArea.value);
    workCounter.textContent = `${words} ${words === 1 ? 'word' : 'words'}`;
  }

  if (form && totalCounter) {
    const allText = `${form.title.value} ${form.workDone.value} ${form.toolsUsed.value} ${form.problemsSolved.value} ${form.whatLearned.value}`;
    const totalWords = countWords(allText);
    totalCounter.textContent = `${totalWords} words total`;
  }
}

// ============================================================================
// 4. Form & Editor Operations
// ============================================================================

function updateEditorMetaDisplays(dateStr) {
  const dayBadge = $('editor-day-badge');
  const weekBadge = $('editor-week-badge');
  const weekdayHelper = $('date-weekday-helper');
  const startDate = state.profile.startDate;

  if (dateStr) {
    const d = parseLocalDate(dateStr);
    if (d && weekdayHelper) {
      const weekdays = ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday'];
      weekdayHelper.textContent = weekdays[d.getDay()];
    }

    const dayNum = calculateDayNumber(dateStr, startDate);
    if (dayNum !== null) {
      if (dayNum > 0) {
        if (dayBadge) dayBadge.textContent = String(dayNum).padStart(2, '0');
        const weekNum = calculateWeekNumber(dayNum);
        if (weekBadge) weekBadge.textContent = String(weekNum).padStart(2, '0');
      } else {
        if (dayBadge) dayBadge.textContent = `P${Math.abs(dayNum)}`;
        if (weekBadge) weekBadge.textContent = '00';
      }
    } else {
      if (dayBadge) dayBadge.textContent = '—';
      if (weekBadge) weekBadge.textContent = '—';
    }
  }
}

function populateEditor(entry, isDraft = false) {
  const form = $('entry-editor-form');
  if (!form) return;

  currentEditingId = entry.id || null;
  form.date.value = entry.date || getTodayIsoDate();
  form.hoursWorked.value = entry.hoursWorked !== undefined && entry.hoursWorked !== null ? entry.hoursWorked : '8.0';
  form.status.value = entry.status || 'Completed';
  form.title.value = entry.title || '';
  form.workDone.value = entry.workDone || '';
  form.toolsUsed.value = entry.toolsUsed || '';
  form.problemsSolved.value = entry.problemsSolved || '';
  form.whatLearned.value = entry.whatLearned || '';

  updateEditorMetaDisplays(form.date.value);
  updateDraftVisibility(isDraft);
  updateLiveWordCounts();

  const statusHelper = $('status-helper');
  if (statusHelper) {
    statusHelper.textContent = form.status.value === 'No work' 
      ? 'Recorded as non-working day / holiday' 
      : 'Working day logged';
  }

  const saveBtn = $('save-entry-btn');
  if (saveBtn) {
    const isExisting = state.entries.some(e => e.date === form.date.value);
    saveBtn.innerHTML = (isExisting ? 'Update Entry' : 'Save Entry') + ' <kbd class="btn-kbd">Ctrl+S</kbd>';
  }

  highlightActiveLedgerRow(form.date.value);
  highlightCalendarDate(form.date.value);
}

function captureFormAsDraft() {
  const form = $('entry-editor-form');
  if (!form) return;

  const draftData = {
    id: currentEditingId,
    date: form.date.value,
    hoursWorked: form.hoursWorked.value,
    status: form.status.value,
    title: form.title.value,
    workDone: form.workDone.value,
    toolsUsed: form.toolsUsed.value,
    problemsSolved: form.problemsSolved.value,
    whatLearned: form.whatLearned.value,
    updatedAt: Date.now()
  };

  const hasText = Boolean(
    draftData.title.trim() ||
    draftData.workDone.trim() ||
    draftData.toolsUsed.trim() ||
    draftData.problemsSolved.trim() ||
    draftData.whatLearned.trim()
  );

  if (hasText) {
    state.draft = draftData;
    updateDraftVisibility(true);
    updateStatusIndicator('Draft saved locally', true);
  } else {
    state.draft = null;
    updateDraftVisibility(false);
  }

  updateLiveWordCounts();
  saveState();
}

function handleDateChange(newDateStr) {
  if (!newDateStr) return;

  const existingEntry = state.entries.find(e => e.date === newDateStr);
  if (existingEntry) {
    populateEditor(existingEntry, false);
    updateStatusIndicator(`Loaded entry for ${formatShortDate(newDateStr)}`);
  } else {
    currentEditingId = null;
    const form = $('entry-editor-form');
    if (form) {
      form.date.value = newDateStr;
      form.title.value = '';
      form.workDone.value = '';
      form.toolsUsed.value = '';
      form.problemsSolved.value = '';
      form.whatLearned.value = '';
      form.hoursWorked.value = '8.0';
      form.status.value = 'Completed';
    }
    updateEditorMetaDisplays(newDateStr);
    updateDraftVisibility(false);
    updateLiveWordCounts();
    updateStatusIndicator(`New entry: ${formatShortDate(newDateStr)}`);

    const saveBtn = $('save-entry-btn');
    if (saveBtn) {
      saveBtn.innerHTML = 'Save Entry <kbd class="btn-kbd">Ctrl+S</kbd>';
    }
    highlightActiveLedgerRow(newDateStr);
    highlightCalendarDate(newDateStr);
  }
}

function saveCurrentEntry() {
  const form = $('entry-editor-form');
  if (!form) return;

  const dateValue = form.date.value;
  if (!dateValue) {
    fieldError(form.date, 'Please choose a date for this log entry before saving.');
    return;
  }

  let hoursValue = parseFloat(form.hoursWorked.value);
  if (form.status.value === 'No work') {
    if (isNaN(hoursValue) || form.hoursWorked.value === '') hoursValue = 0;
  } else {
    if (isNaN(hoursValue) || hoursValue < 0 || hoursValue > 24) {
      fieldError(form.hoursWorked, 'Hours worked must be a number between 0 and 24 (decimals like 7.5 are fine).');
      return;
    }
  }

  const titleValue = form.title.value.trim();
  if (!titleValue) {
    fieldError(form.title, 'Please add a short title or focus summary for this day before saving.');
    return;
  }

  const entryData = {
    id: currentEditingId || `entry-${dateValue}`,
    date: dateValue,
    hoursWorked: hoursValue,
    status: form.status.value || 'Completed',
    title: titleValue,
    workDone: form.workDone.value.trim(),
    toolsUsed: form.toolsUsed.value.trim(),
    problemsSolved: form.problemsSolved.value.trim(),
    whatLearned: form.whatLearned.value.trim(),
    updatedAt: new Date().toISOString()
  };

  const existingIndex = state.entries.findIndex(e => e.date === dateValue);
  if (existingIndex >= 0) {
    state.entries[existingIndex] = entryData;
  } else {
    state.entries.push(entryData);
  }

  state.entries.sort((a, b) => a.date.localeCompare(b.date));
  state.draft = null;
  currentEditingId = entryData.id;
  saveState();

  const now = new Date();
  const timeStr = `${String(now.getHours()).padStart(2, '0')}:${String(now.getMinutes()).padStart(2, '0')}:${String(now.getSeconds()).padStart(2, '0')}`;
  updateStatusIndicator(`Saved at ${timeStr}`);
  updateDraftVisibility(false);

  // Show a brief success toast on each save
  showToast(`Entry saved \u2014 ${formatShortDate(dateValue)} at ${timeStr}`, 'success', 3000);

  renderLedgerList();
  renderSummaryMetrics();
  renderMiniCalendar();
  highlightActiveLedgerRow(dateValue);
  closeMobileDrawer();
}

function promptDeleteCurrentEntry() {
  const form = $('entry-editor-form');
  const dateValue = form ? form.date.value : null;

  const entry = state.entries.find(e => e.date === dateValue);
  if (!entry) {
    // No saved entry exists for this date — just clear the draft editor
    if (form) {
      form.title.value = '';
      form.workDone.value = '';
      form.toolsUsed.value = '';
      form.problemsSolved.value = '';
      form.whatLearned.value = '';
    }
    state.draft = null;
    saveState();
    updateDraftVisibility(false);
    updateLiveWordCounts();
    updateStatusIndicator('Form cleared');
    showToast('Draft cleared. No saved entry existed for this date.', 'info', 3000);
    return;
  }

  const modal = $('delete-modal');
  const msg = $('delete-modal-message');
  if (msg) {
    msg.textContent = `Are you sure you want to delete the daily log for ${formatDisplayDate(entry.date)} (${entry.title})?`;
  }
  if (modal) modal.classList.remove('hidden');
}

function confirmDeleteEntry() {
  const form = $('entry-editor-form');
  const dateValue = form ? form.date.value : null;

  const index = state.entries.findIndex(e => e.date === dateValue);
  if (index >= 0) {
    const deleted = state.entries.splice(index, 1)[0];
    lastDeletedEntry = { entry: deleted, index };
    state.draft = null;
    saveState();

    $('delete-modal').classList.add('hidden');
    showUndoToast(`Entry for ${formatDisplayDate(deleted.date)} deleted.`);
    renderLedgerList();
    renderSummaryMetrics();
    renderMiniCalendar();
    prepareNewEntry(getTodayIsoDate());
  }
}

function restoreDeletedEntry() {
  if (!lastDeletedEntry || !lastDeletedEntry.entry) return;
  const { entry } = lastDeletedEntry;
  state.entries.push(entry);
  state.entries.sort((a, b) => a.date.localeCompare(b.date));
  saveState();

  lastDeletedEntry = null;
  hideUndoToast();

  renderLedgerList();
  renderSummaryMetrics();
  renderMiniCalendar();
  populateEditor(entry, false);
  updateStatusIndicator(`Restored entry for ${formatShortDate(entry.date)}`);
}

// ============================================================================
// 4b. Friendly Toast Notification System (replaces all browser alert() calls)
// ============================================================================
let _toastQueue = [];
let _toastTimer = null;

/**
 * Show a non-blocking friendly toast notification.
 * @param {string} message  - Text to display
 * @param {'info'|'success'|'warning'|'error'|'undo'} type - Visual style
 * @param {number} duration - Auto-dismiss ms (0 = manual only)
 * @param {string|null} undoLabel - If provided, renders an Undo button
 * @param {Function|null} onUndo - Callback for undo action
 */
function showToast(message, type = 'info', duration = 4500, undoLabel = null, onUndo = null) {
  const shelf = $('toast-shelf');
  if (!shelf) return;

  // Reuse the existing undo-toast element for undo type, create a new one otherwise
  let toast;
  if (type === 'undo') {
    toast = $('undo-toast');
    if (!toast) return;
    const msgElem = $('toast-message');
    if (msgElem) msgElem.textContent = message;
    toast.className = 'toast-item toast-undo';
    toast.classList.remove('hidden');

    if (undoTimeoutId) clearTimeout(undoTimeoutId);
    if (duration > 0) {
      undoTimeoutId = setTimeout(hideUndoToast, duration);
    }
    return;
  }

  // Create a dynamic toast
  toast = document.createElement('div');
  toast.className = `toast-item toast-${type}`;
  toast.setAttribute('role', 'status');
  toast.setAttribute('aria-live', 'polite');

  const msgSpan = document.createElement('span');
  msgSpan.className = 'toast-message';
  msgSpan.textContent = message;
  toast.appendChild(msgSpan);

  const actionsDiv = document.createElement('div');
  actionsDiv.className = 'toast-actions';

  if (undoLabel && typeof onUndo === 'function') {
    const undoBtn = document.createElement('button');
    undoBtn.type = 'button';
    undoBtn.className = 'btn-toast-undo';
    undoBtn.textContent = undoLabel;
    undoBtn.addEventListener('click', () => {
      onUndo();
      toast.remove();
    });
    actionsDiv.appendChild(undoBtn);
  }

  const dismissBtn = document.createElement('button');
  dismissBtn.type = 'button';
  dismissBtn.className = 'btn-toast-dismiss';
  dismissBtn.setAttribute('aria-label', 'Dismiss notification');
  dismissBtn.textContent = '\u00d7';
  dismissBtn.addEventListener('click', () => toast.remove());
  actionsDiv.appendChild(dismissBtn);

  toast.appendChild(actionsDiv);
  shelf.appendChild(toast);

  if (duration > 0) {
    setTimeout(() => {
      if (toast.parentNode) toast.remove();
    }, duration);
  }
}

function showUndoToast(message) {
  showToast(message, 'undo', 10000);
}

function hideUndoToast() {
  const toast = $('undo-toast');
  if (toast) toast.classList.add('hidden');
  if (undoTimeoutId) {
    clearTimeout(undoTimeoutId);
    undoTimeoutId = null;
  }
}

/**
 * Shake a form field and show a toast instead of a browser alert.
 */
function fieldError(fieldEl, message) {
  showToast(message, 'warning', 5000);
  if (fieldEl) {
    fieldEl.focus();
    fieldEl.classList.add('field-error-pulse');
    setTimeout(() => fieldEl.classList.remove('field-error-pulse'), 400);
  }
}

function prepareNewEntry(targetDate = getTodayIsoDate()) {
  const existing = state.entries.find(e => e.date === targetDate);
  if (existing) {
    populateEditor(existing, false);
  } else {
    currentEditingId = null;
    const form = $('entry-editor-form');
    if (form) {
      form.date.value = targetDate;
      form.hoursWorked.value = '8.0';
      form.status.value = 'Completed';
      form.title.value = '';
      form.workDone.value = '';
      form.toolsUsed.value = '';
      form.problemsSolved.value = '';
      form.whatLearned.value = '';
      updateEditorMetaDisplays(targetDate);
      updateDraftVisibility(false);
      updateLiveWordCounts();
      form.title.focus();
    }
    highlightActiveLedgerRow(targetDate);
    highlightCalendarDate(targetDate);
  }
  closeMobileDrawer();
}

// ============================================================================
// 5. Monthly Calendar Implementation & Quick Stats
// ============================================================================

function renderMiniCalendar() {
  const container = $('cal-days-container');
  const monthLabel = $('cal-month-label');
  const quickStats = $('cal-quick-stats');
  if (!container || !monthLabel) return;

  const months = ['January', 'February', 'March', 'April', 'May', 'June', 'July', 'August', 'September', 'October', 'November', 'December'];
  const viewYear = calViewDate.getFullYear();
  const viewMonth = calViewDate.getMonth();

  monthLabel.textContent = `${months[viewMonth]} ${viewYear}`;

  const firstDayIndex = new Date(viewYear, viewMonth, 1).getDay();
  const totalDays = new Date(viewYear, viewMonth + 1, 0).getDate();
  const prevMonthTotalDays = new Date(viewYear, viewMonth, 0).getDate();

  const entryDateMap = new Map();
  let monthLoggedCount = 0;
  let monthHoursCount = 0;

  if (state && state.entries) {
    for (const e of state.entries) {
      entryDateMap.set(e.date, e);
      const eDate = parseLocalDate(e.date);
      if (eDate && eDate.getFullYear() === viewYear && eDate.getMonth() === viewMonth) {
        if (e.status !== 'No work') monthLoggedCount++;
        monthHoursCount += (parseFloat(e.hoursWorked) || 0);
      }
    }
  }

  if (quickStats) {
    quickStats.innerHTML = `<span class="cal-stats-text">${months[viewMonth]}: <strong>${monthLoggedCount} days</strong> worked (${monthHoursCount} hrs)</span>`;
  }

  const todayStr = getTodayIsoDate();
  const activeEditorDate = $('entry-date') ? $('entry-date').value : todayStr;

  let html = '';

  // 1. Prev month trailing days
  for (let i = firstDayIndex - 1; i >= 0; i--) {
    const dayNum = prevMonthTotalDays - i;
    const prevDate = new Date(viewYear, viewMonth - 1, dayNum);
    const dateStr = formatToIsoDate(prevDate);
    html += renderCalDayCell(dateStr, dayNum, true, entryDateMap, todayStr, activeEditorDate);
  }

  // 2. Current month days
  for (let day = 1; day <= totalDays; day++) {
    const curDate = new Date(viewYear, viewMonth, day);
    const dateStr = formatToIsoDate(curDate);
    html += renderCalDayCell(dateStr, day, false, entryDateMap, todayStr, activeEditorDate);
  }

  // 3. Next month leading days
  const totalRendered = firstDayIndex + totalDays;
  const remainingCells = (totalRendered % 7 === 0) ? 0 : 7 - (totalRendered % 7);
  for (let day = 1; day <= remainingCells; day++) {
    const nextDate = new Date(viewYear, viewMonth + 1, day);
    const dateStr = formatToIsoDate(nextDate);
    html += renderCalDayCell(dateStr, day, true, entryDateMap, todayStr, activeEditorDate);
  }

  container.innerHTML = html;

  container.querySelectorAll('.cal-day-btn').forEach(btn => {
    btn.addEventListener('click', () => {
      const dateStr = btn.getAttribute('data-date');
      handleDateChange(dateStr);
    });
  });
}

function renderCalDayCell(dateStr, dayNum, isOtherMonth, entryMap, todayStr, activeEditorDate) {
  const hasEntry = entryMap.has(dateStr);
  const entry = hasEntry ? entryMap.get(dateStr) : null;
  const isToday = (dateStr === todayStr);
  const isSelected = (dateStr === activeEditorDate);

  let classes = ['cal-day-btn'];
  if (isOtherMonth) classes.push('cal-other-month');
  if (isToday) classes.push('cal-is-today');
  if (isSelected) classes.push('cal-is-selected');

  let dotHtml = '';
  if (hasEntry) {
    const status = entry.status || 'Completed';
    const statusDotClass = status === 'No work' ? 'cal-dot-nowork' : (status === 'In progress' ? 'cal-dot-inprogress' : (status === 'Blocked' ? 'cal-dot-blocked' : 'cal-dot-completed'));
    dotHtml = `<span class="cal-day-dot ${statusDotClass}" title="Status: ${escapeHtml(status)}"></span>`;
  }

  return `
    <button type="button" class="${classes.join(' ')}" data-date="${dateStr}" title="${formatDisplayDate(dateStr)}${hasEntry ? ` - ${escapeHtml(entry.title)}` : ''}">
      <span>${dayNum}</span>
      ${dotHtml}
    </button>
  `;
}

function highlightCalendarDate(dateStr) {
  const container = $('cal-days-container');
  if (!container) return;

  container.querySelectorAll('.cal-day-btn').forEach(btn => {
    const match = (btn.getAttribute('data-date') === dateStr);
    btn.classList.toggle('cal-is-selected', match);
  });
}

// ============================================================================
// 6. Sidebar Tabs & Ledger List
// ============================================================================

function switchSidebarTab(tabName) {
  const tabLedgerBtn = $('tab-ledger-btn');
  const tabCalendarBtn = $('tab-calendar-btn');
  const panelLedger = $('panel-ledger-view');
  const panelCalendar = $('panel-calendar-view');

  if (tabName === 'calendar') {
    if (tabLedgerBtn) tabLedgerBtn.classList.remove('active');
    if (tabCalendarBtn) tabCalendarBtn.classList.add('active');
    if (panelLedger) panelLedger.classList.add('hidden');
    if (panelCalendar) panelCalendar.classList.remove('hidden');
    renderMiniCalendar();
  } else {
    if (tabLedgerBtn) tabLedgerBtn.classList.add('active');
    if (tabCalendarBtn) tabCalendarBtn.classList.remove('active');
    if (panelLedger) panelLedger.classList.remove('hidden');
    if (panelCalendar) panelCalendar.classList.add('hidden');
    renderLedgerList();
  }
}

function populateWeekFilterOptions() {
  const select = $('filter-week');
  if (!select) return;

  const currentValue = select.value;
  select.innerHTML = '<option value="all">All Weeks</option>';

  const weeksSet = new Set();
  const startDate = state.profile.startDate;

  for (const entry of state.entries) {
    const dayNum = calculateDayNumber(entry.date, startDate);
    const weekNum = calculateWeekNumber(dayNum);
    if (weekNum !== null) weeksSet.add(weekNum);
  }

  const sortedWeeks = Array.from(weeksSet).sort((a, b) => a - b);
  for (const w of sortedWeeks) {
    const opt = document.createElement('option');
    opt.value = String(w);
    opt.textContent = `Week ${w}`;
    select.appendChild(opt);
  }

  if (weeksSet.has(Number(currentValue))) select.value = currentValue;
}

function renderLedgerList() {
  const stream = $('ledger-entries-stream');
  const searchInput = $('ledger-search');
  const weekFilter = $('filter-week');
  const statusFilter = $('filter-status');
  if (!stream) return;

  populateWeekFilterOptions();

  const searchQuery = (searchInput ? searchInput.value : '').toLowerCase().trim();
  const selectedWeek = weekFilter ? weekFilter.value : 'all';
  const selectedStatus = statusFilter ? statusFilter.value : 'all';
  const startDate = state.profile.startDate;

  const filtered = state.entries.filter(entry => {
    if (searchQuery) {
      const match = (
        (entry.title || '').toLowerCase().includes(searchQuery) ||
        (entry.workDone || '').toLowerCase().includes(searchQuery) ||
        (entry.toolsUsed || '').toLowerCase().includes(searchQuery) ||
        (entry.problemsSolved || '').toLowerCase().includes(searchQuery) ||
        (entry.whatLearned || '').toLowerCase().includes(searchQuery) ||
        (entry.date || '').includes(searchQuery)
      );
      if (!match) return false;
    }

    if (selectedStatus !== 'all' && entry.status !== selectedStatus) return false;

    if (selectedWeek !== 'all') {
      const dayNum = calculateDayNumber(entry.date, startDate);
      const weekNum = calculateWeekNumber(dayNum);
      if (String(weekNum) !== selectedWeek) return false;
    }

    return true;
  });

  if (filtered.length === 0) {
    stream.innerHTML = `
      <div class="ledger-empty-state">
        <p class="empty-title">No entries match filters</p>
        <p class="empty-sub">Adjust your search keyword or add a new daily entry.</p>
      </div>
    `;
    return;
  }

  const groupedByWeek = new Map();
  for (const entry of filtered) {
    const dayNum = calculateDayNumber(entry.date, startDate);
    const weekNum = calculateWeekNumber(dayNum);
    if (!groupedByWeek.has(weekNum)) groupedByWeek.set(weekNum, []);
    groupedByWeek.get(weekNum).push({ ...entry, dayNum });
  }

  const sortedWeekKeys = Array.from(groupedByWeek.keys()).sort((a, b) => b - a);

  let html = '';
  for (const weekNum of sortedWeekKeys) {
    const weekEntries = groupedByWeek.get(weekNum);
    weekEntries.sort((a, b) => b.date.localeCompare(a.date));

    const totalHoursInWeek = weekEntries.reduce((sum, e) => sum + (parseFloat(e.hoursWorked) || 0), 0);
    const weekLabel = weekNum > 0 ? `Week ${weekNum}` : 'Pre-internship';

    html += `
      <div class="week-group" data-week="${weekNum}">
        <div class="week-group-header">
          <span class="week-group-title">${weekLabel}</span>
          <span class="week-group-meta">${weekEntries.length} ${weekEntries.length === 1 ? 'entry' : 'entries'} &bull; ${totalHoursInWeek} hrs</span>
        </div>
        <div class="week-rows">
    `;

    for (const entry of weekEntries) {
      const dayDisplay = entry.dayNum !== null ? `Day ${entry.dayNum}` : 'Day —';
      const dateDisplay = formatShortDate(entry.date);
      const excerpt = entry.workDone || entry.problemsSolved || entry.whatLearned || 'No detailed log written.';
      const statusClass = 'status-' + (entry.status || 'Completed').replace(/\s+/g, '');

      html += `
        <button type="button" class="ledger-row" data-date="${entry.date}" role="option" aria-selected="false">
          <div class="ledger-margin">
            <span class="ledger-day">${dayDisplay}</span>
            <span class="ledger-date">${dateDisplay}</span>
          </div>
          <div class="ledger-body">
            <div class="ledger-header-line">
              <h4 class="ledger-title">${escapeHtml(entry.title || '(Untitled)')}</h4>
              <span class="status-pill ${statusClass}">${escapeHtml(entry.status || 'Completed')}</span>
            </div>
            <p class="ledger-excerpt">${escapeHtml(excerpt)}</p>
            <div class="ledger-meta">
              <span class="ledger-hours">${entry.hoursWorked || 0} hrs</span>
              ${entry.toolsUsed ? `<span class="ledger-tools">&bull; ${escapeHtml(entry.toolsUsed)}</span>` : ''}
            </div>
          </div>
        </button>
      `;
    }

    html += `
        </div>
      </div>
    `;
  }

  stream.innerHTML = html;

  stream.querySelectorAll('.ledger-row').forEach(row => {
    row.addEventListener('click', () => {
      const date = row.getAttribute('data-date');
      const entry = state.entries.find(e => e.date === date);
      if (entry) {
        populateEditor(entry, false);
        closeMobileDrawer();
      }
    });
  });

  const form = $('entry-editor-form');
  if (form && form.date.value) {
    highlightActiveLedgerRow(form.date.value);
  }
}

function highlightActiveLedgerRow(dateStr) {
  const rows = document.querySelectorAll('.ledger-row');
  rows.forEach(r => {
    const isSelected = r.getAttribute('data-date') === dateStr;
    r.classList.toggle('selected', isSelected);
    r.setAttribute('aria-selected', isSelected ? 'true' : 'false');
  });
}

// ============================================================================
// 7. Summary Metrics & Missing Days
// ============================================================================

function renderSummaryMetrics() {
  const daysElem = $('metric-days');
  const hoursElem = $('metric-hours');
  const streakElem = $('metric-streak');
  const missingValElem = $('metric-missing');

  const workedEntries = state.entries.filter(e => e.status !== 'No work');
  const totalDays = workedEntries.length;
  const totalHours = state.entries.reduce((sum, e) => sum + (parseFloat(e.hoursWorked) || 0), 0);
  const streak = calculateCurrentStreak(state.entries);
  const missingDates = calculateMissingDates(state.profile.startDate, state.entries);

  if (daysElem) daysElem.textContent = String(totalDays);
  if (hoursElem) hoursElem.textContent = `${Number(totalHours.toFixed(1))}h`;
  if (streakElem) streakElem.textContent = `${streak}d`;

  if (missingValElem) {
    missingValElem.textContent = String(missingDates.length);
    missingValElem.classList.toggle('metric-missing-alert', missingDates.length > 0);
  }

  const studentPill = $('header-student-pill');
  if (studentPill) {
    const name = (state.profile && state.profile.studentName) ? state.profile.studentName : activeUser;
    studentPill.textContent = name;
  }

  const companySub = $('header-company-sub');
  if (companySub) {
    companySub.textContent = (state.profile && state.profile.companyName) ? state.profile.companyName : 'MSc IT Training';
  }

  const profileBanner = $('profile-reminder-banner');
  if (profileBanner) {
    profileBanner.classList.toggle('hidden', !!state.profile.startDate);
  }

  checkBackupReminder();
}

function openMissingDaysModal() {
  const modal = $('missing-days-modal');
  const list = $('missing-days-list');
  if (!modal || !list) return;

  const missingDates = calculateMissingDates(state.profile.startDate, state.entries);
  if (missingDates.length === 0) {
    list.innerHTML = `
      <div style="padding: 1.5rem; text-align: center; color: var(--text-secondary);">
        No missing log days! You have documented every calendar date since your internship started.
      </div>
    `;
  } else {
    let html = '';
    missingDates.sort().reverse();
    for (const date of missingDates) {
      const dayNum = calculateDayNumber(date, state.profile.startDate);
      const display = formatDisplayDate(date);
      html += `
        <div class="missing-day-item">
          <div>
            <span class="missing-day-date">${display}</span>
            <span class="missing-day-daynum">(Day ${dayNum})</span>
          </div>
          <button type="button" class="btn-log-missing" data-date="${date}">Log this day</button>
        </div>
      `;
    }
    list.innerHTML = html;

    list.querySelectorAll('.btn-log-missing').forEach(btn => {
      btn.addEventListener('click', () => {
        const date = btn.getAttribute('data-date');
        prepareNewEntry(date);
        modal.classList.add('hidden');
      });
    });
  }

  modal.classList.remove('hidden');
}

// ============================================================================
// 8. Profile Configuration Modal
// ============================================================================

function openProfileModal() {
  const modal = $('profile-modal');
  const form = $('profile-form');
  if (!modal || !form) return;

  const p = state.profile;
  form.studentName.value = p.studentName || '';
  form.college.value = p.college || '';
  form.companyName.value = p.companyName || '';
  form.department.value = p.department || '';
  form.supervisorName.value = p.supervisorName || '';
  form.startDate.value = p.startDate || '';
  form.endDate.value = p.endDate || '';

  modal.classList.remove('hidden');
  form.studentName.focus();
}

function closeProfileModal() {
  const modal = $('profile-modal');
  if (modal) modal.classList.add('hidden');
}

function handleProfileSubmit(e) {
  e.preventDefault();
  const form = e.target;

  state.profile = {
    studentName: form.studentName.value.trim(),
    college: form.college.value.trim(),
    companyName: form.companyName.value.trim(),
    department: form.department.value.trim(),
    supervisorName: form.supervisorName.value.trim(),
    startDate: form.startDate.value,
    endDate: form.endDate.value
  };

  saveState();
  closeProfileModal();

  const currentForm = $('entry-editor-form');
  if (currentForm) updateEditorMetaDisplays(currentForm.date.value);

  renderSummaryMetrics();
  renderLedgerList();
  renderMiniCalendar();
  updateStatusIndicator('Profile saved');
}

// ============================================================================
// 9. Backup, Reminder, and Import
// ============================================================================

function checkBackupReminder() {
  const banner = $('backup-reminder-banner');
  if (!banner) return;

  if (state.entries.length === 0) {
    banner.classList.add('hidden');
    return;
  }

  const lastBackup = state.meta.lastBackupDate;
  if (!lastBackup) {
    banner.classList.remove('hidden');
    return;
  }

  const lastDate = new Date(lastBackup).getTime();
  const now = Date.now();
  const sevenDaysMs = 7 * 24 * 60 * 60 * 1000;
  banner.classList.toggle('hidden', (now - lastDate <= sevenDaysMs));
}

function exportBackupJson() {
  state.meta.lastBackupDate = new Date().toISOString();
  saveState();

  const dataStr = JSON.stringify(state, null, 2);
  const blob = new Blob([dataStr], { type: 'application/json' });
  downloadBlob(blob, `internship-log-backup-${activeUser}-${getTodayIsoDate()}.json`);
  checkBackupReminder();
  updateStatusIndicator('Backup exported');
  showToast('Backup downloaded \u2014 keep this file safe. Import it here if you ever switch browsers or devices.', 'success', 5500);
}

let pendingImportData = null;

function handleImportFileSelect(e) {
  const file = e.target.files[0];
  if (!file) return;

  const reader = new FileReader();
  reader.onload = (event) => {
    try {
      const parsed = JSON.parse(event.target.result);
      if (!parsed || (typeof parsed !== 'object')) throw new Error('Not a valid JSON object');

      const entriesCount = Array.isArray(parsed.entries) ? parsed.entries.length : 0;
      const profile = parsed.profile || {};
      pendingImportData = parsed;

      const modal = $('import-modal');
      const summary = $('import-modal-summary');
      if (summary) {
        summary.innerHTML = `
          <div style="background: var(--bg-surface-subtle); padding: 0.75rem 1rem; border: 1px solid var(--border-rule); border-radius: var(--radius-xs); margin-bottom: 0.75rem; font-family: var(--font-mono); font-size: 0.85rem;">
            <div><strong>File:</strong> ${escapeHtml(file.name)}</div>
            <div><strong>Entries found:</strong> ${entriesCount}</div>
            <div><strong>Student:</strong> ${escapeHtml(profile.studentName || 'Not specified')}</div>
            <div><strong>Company:</strong> ${escapeHtml(profile.companyName || 'Not specified')}</div>
          </div>
        `;
      }
      if (modal) modal.classList.remove('hidden');
    } catch (err) {
      showToast('Could not read that backup file. Make sure it is a valid .json backup exported from this app. (' + err.message + ')', 'error', 8000);
    }
  };
  reader.readAsText(file);
  e.target.value = '';
}

function executeImportMerge() {
  if (!pendingImportData) return;
  const importedEntries = Array.isArray(pendingImportData.entries) ? pendingImportData.entries : [];
  const entriesMap = new Map();

  for (const e of state.entries) entriesMap.set(e.date, e);
  for (const e of importedEntries) {
    if (e.date) entriesMap.set(e.date, { ...(entriesMap.get(e.date) || {}), ...e });
  }

  state.entries = Array.from(entriesMap.values()).sort((a, b) => a.date.localeCompare(b.date));

  if (pendingImportData.profile) {
    state.profile = {
      studentName: state.profile.studentName || pendingImportData.profile.studentName || '',
      college: state.profile.college || pendingImportData.profile.college || '',
      companyName: state.profile.companyName || pendingImportData.profile.companyName || '',
      department: state.profile.department || pendingImportData.profile.department || '',
      supervisorName: state.profile.supervisorName || pendingImportData.profile.supervisorName || '',
      startDate: state.profile.startDate || pendingImportData.profile.startDate || '',
      endDate: state.profile.endDate || pendingImportData.profile.endDate || ''
    };
  }

  saveState();
  pendingImportData = null;
  $('import-modal').classList.add('hidden');
  renderSummaryMetrics();
  renderLedgerList();
  renderMiniCalendar();
  prepareNewEntry(getTodayIsoDate());
  updateStatusIndicator('Logs merged successfully');
  showToast(`Backup merged \u2014 ${importedEntries.length} entries imported.`, 'success', 4000);
}

function executeImportReplace() {
  if (!pendingImportData) return;
  const entriesCount = Array.isArray(pendingImportData.entries) ? pendingImportData.entries.length : 0;
  state.entries = Array.isArray(pendingImportData.entries) ? pendingImportData.entries : [];
  state.entries.sort((a, b) => a.date.localeCompare(b.date));

  if (pendingImportData.profile) {
    state.profile = { ...createInitialState(activeUser).profile, ...pendingImportData.profile };
  }

  state.draft = null;
  saveState();
  pendingImportData = null;
  $('import-modal').classList.add('hidden');
  renderSummaryMetrics();
  renderLedgerList();
  renderMiniCalendar();
  prepareNewEntry(getTodayIsoDate());
  updateStatusIndicator('Logbook replaced completely');
  showToast(`Logbook replaced \u2014 ${entriesCount} entries loaded from backup.`, 'success', 4500);
}

// ============================================================================
// 10. Text Report Generation (.txt format matching Section 6)
// ============================================================================

function buildTextReport() {
  const p = state.profile;
  const entries = [...state.entries].sort((a, b) => a.date.localeCompare(b.date));

  const lines = [];
  lines.push('INTERNSHIP DAILY REPORT');
  lines.push(`Name: ${p.studentName || '...'}  | College: ${p.college || '...'}`);
  lines.push(`Company: ${p.companyName || '...'} | Department: ${p.department || '...'} | Supervisor: ${p.supervisorName || '...'}`);
  lines.push(`Duration: ${p.startDate || 'start date'} to ${p.endDate || 'end date'}\n`);

  if (entries.length === 0) {
    lines.push('(No daily entries have been recorded yet.)\n');
  } else {
    const weeksMap = new Map();
    for (const entry of entries) {
      const dayNum = calculateDayNumber(entry.date, p.startDate);
      const weekNum = dayNum !== null && dayNum > 0 ? calculateWeekNumber(dayNum) : 1;
      if (!weeksMap.has(weekNum)) weeksMap.set(weekNum, []);
      weeksMap.get(weekNum).push({ ...entry, dayNum });
    }

    const sortedWeeks = Array.from(weeksMap.keys()).sort((a, b) => a - b);
    for (const weekNum of sortedWeeks) {
      lines.push(`WEEK ${weekNum}`);
      lines.push('-------------------------------');
      const weekEntries = weeksMap.get(weekNum);
      for (const entry of weekEntries) {
        const dayLabel = entry.dayNum !== null ? `Day ${entry.dayNum}` : 'Day —';
        const dateFormatted = formatDisplayDate(entry.date);
        const hoursFormatted = `${entry.hoursWorked || 0} hours`;

        lines.push(`${dayLabel} | ${dateFormatted} | ${hoursFormatted}`);
        lines.push(`Title: ${entry.title || '...'}`);
        lines.push('Work done:');
        lines.push(entry.workDone || '...');
        lines.push(`Tools used: ${entry.toolsUsed || 'None'}`);
        lines.push(`Problems and solutions: ${entry.problemsSolved || 'None'}`);
        lines.push(`What I learned: ${entry.whatLearned || 'None'}`);
        lines.push(`Status: ${entry.status || 'Completed'}`);
        lines.push('-------------------------------');
      }
      lines.push('');
    }
  }

  const totalDays = entries.filter(e => e.status !== 'No work').length;
  const totalHours = entries.reduce((sum, e) => sum + (parseFloat(e.hoursWorked) || 0), 0);

  lines.push('===============================');
  lines.push('SUMMARY');
  lines.push(`Total days logged: ${totalDays}`);
  lines.push(`Total hours: ${totalHours} hours`);
  lines.push(`Report generated: ${formatDisplayDate(getTodayIsoDate())}`);
  lines.push('===============================');

  return lines.join('\n');
}

function exportTextReport() {
  if (!state.entries || state.entries.length === 0) {
    showToast('No entries to export yet. Add at least one daily log first.', 'warning', 4500);
    return;
  }
  const text = buildTextReport();
  const blob = new Blob([text], { type: 'text/plain;charset=utf-8' });
  downloadBlob(blob, `internship-daily-report-${activeUser}-${getTodayIsoDate()}.txt`);
  updateStatusIndicator('Report exported (.txt)');
  showToast('Report downloaded as .txt \u2014 open it in any text editor or submit as-is.', 'success', 5000);
}

// ============================================================================
// 11. Printable Formal Report Setup (window.print)
// ============================================================================

function buildPrintReportHtml() {
  const p = state.profile;
  const entries = [...state.entries].sort((a, b) => a.date.localeCompare(b.date));
  const container = $('print-report-container');
  if (!container) return;

  const totalDays = entries.filter(e => e.status !== 'No work').length;
  const totalHours = entries.reduce((sum, e) => sum + (parseFloat(e.hoursWorked) || 0), 0);

  let html = `
    <div class="print-title-page">
      <div class="print-title-header">
        <div class="print-institution">${escapeHtml(p.college || 'ACADEMIC INSTITUTION / COLLEGE')}</div>
        <h1 class="print-doc-title">INTERNSHIP DAILY LOG &amp; TRAINING REPORT</h1>
        <div class="print-doc-subtitle">Official Daily Record of Practical Industry Experience</div>
      </div>

      <table class="print-profile-grid">
        <tr><td class="print-profile-label">Student Name</td><td><strong>${escapeHtml(p.studentName || '—')}</strong></td></tr>
        <tr><td class="print-profile-label">College / University</td><td>${escapeHtml(p.college || '—')}</td></tr>
        <tr><td class="print-profile-label">Host Organization</td><td><strong>${escapeHtml(p.companyName || '—')}</strong></td></tr>
        <tr><td class="print-profile-label">Department / Team</td><td>${escapeHtml(p.department || '—')}</td></tr>
        <tr><td class="print-profile-label">Industry Supervisor</td><td>${escapeHtml(p.supervisorName || '—')}</td></tr>
        <tr><td class="print-profile-label">Training Period</td><td>${p.startDate ? formatDisplayDate(p.startDate) : '—'} &nbsp;to&nbsp; ${p.endDate ? formatDisplayDate(p.endDate) : '—'}</td></tr>
        <tr><td class="print-profile-label">Total Days Logged</td><td>${totalDays} working days</td></tr>
        <tr><td class="print-profile-label">Total Hours Completed</td><td>${totalHours} hours</td></tr>
      </table>

      <div class="print-signatures-block">
        <div class="print-sign-col"><strong>Student Signature</strong><br>Date:</div>
        <div class="print-sign-col"><strong>Supervisor Signature &amp; Stamp</strong><br>Industry Mentor</div>
        <div class="print-sign-col"><strong>Faculty Guide Signature</strong><br>Department of IT</div>
      </div>
    </div>

    <div class="print-entries-body">
  `;

  if (entries.length === 0) {
    html += '<p>No daily entries recorded in the logbook.</p>';
  } else {
    const weeksMap = new Map();
    for (const entry of entries) {
      const dayNum = calculateDayNumber(entry.date, p.startDate);
      const weekNum = dayNum !== null && dayNum > 0 ? calculateWeekNumber(dayNum) : 1;
      if (!weeksMap.has(weekNum)) weeksMap.set(weekNum, []);
      weeksMap.get(weekNum).push({ ...entry, dayNum });
    }

    const sortedWeeks = Array.from(weeksMap.keys()).sort((a, b) => a - b);
    for (const weekNum of sortedWeeks) {
      html += `<div class="print-week-heading">Week ${weekNum}</div>`;
      for (const entry of weeksMap.get(weekNum)) {
        html += `
          <div class="print-day-entry">
            <div class="print-day-meta-bar">
              <span>Day ${entry.dayNum !== null ? entry.dayNum : '—'} | ${formatDisplayDate(entry.date)}</span>
              <span>${entry.hoursWorked || 0} Hours | Status: ${escapeHtml(entry.status || 'Completed')}</span>
            </div>
            <div class="print-day-title">${escapeHtml(entry.title || '(No Title)')}</div>
            <div class="print-entry-field"><span class="print-entry-label">Work Done</span><div class="print-entry-text">${escapeHtml(entry.workDone || '—')}</div></div>
            ${entry.toolsUsed ? `<div class="print-entry-field"><span class="print-entry-label">Tools &amp; Technologies</span><div class="print-entry-text">${escapeHtml(entry.toolsUsed)}</div></div>` : ''}
            ${entry.problemsSolved ? `<div class="print-entry-field"><span class="print-entry-label">Problems &amp; Solutions</span><div class="print-entry-text">${escapeHtml(entry.problemsSolved)}</div></div>` : ''}
            ${entry.whatLearned ? `<div class="print-entry-field"><span class="print-entry-label">Learnings &amp; Takeaways</span><div class="print-entry-text">${escapeHtml(entry.whatLearned)}</div></div>` : ''}
          </div>
        `;
      }
    }
  }

  html += `
      <div class="print-final-summary">
        <div><strong>FINAL LOG SUMMARY:</strong> ${totalDays} working days logged | ${totalHours} total hours recorded.</div>
        <div style="font-size: 9pt; margin-top: 4px;">Verified report generated on ${formatDisplayDate(getTodayIsoDate())}.</div>
      </div>
    </div>
  `;

  container.innerHTML = html;
}

function handlePrintReport() {
  buildPrintReportHtml();
  window.print();
}

// ============================================================================
// 12. Theme & Visual Preferences
// ============================================================================

function applyTheme(theme) {
  if (state && state.meta) state.meta.theme = theme;
  document.body.setAttribute('data-theme', theme);

  const label = $('theme-label');
  const symbol = $('theme-symbol');
  if (label) {
    if (theme === 'system') {
      const isDark = window.matchMedia('(prefers-color-scheme: dark)').matches;
      label.textContent = `Auto (${isDark ? 'Dark' : 'Light'})`;
      if (symbol) symbol.innerHTML = isDark ? '&#9790;' : '&#9788;';
    } else if (theme === 'dark') {
      label.textContent = 'Dark';
      if (symbol) symbol.innerHTML = '&#9790;';
    } else {
      label.textContent = 'Light';
      if (symbol) symbol.innerHTML = '&#9788;';
    }
  }
  saveState();
}

function cycleTheme() {
  const current = (state && state.meta && state.meta.theme) ? state.meta.theme : 'system';
  applyTheme(current === 'system' ? 'light' : current === 'light' ? 'dark' : 'system');
}

// ============================================================================
// 13. Helpers & DOM Binding
// ============================================================================

function escapeHtml(str) {
  if (!str) return '';
  return String(str).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;').replace(/'/g, '&#39;');
}

function downloadBlob(blob, filename) {
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = filename;
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
  URL.revokeObjectURL(url);
}

function toggleMobileDrawer() {
  const sidebar = $('ledger-sidebar');
  const overlay = $('drawer-overlay');
  const btn = $('menu-toggle-btn');
  if (!sidebar) return;

  const isOpen = sidebar.classList.contains('open');
  sidebar.classList.toggle('open', !isOpen);
  if (overlay) overlay.classList.toggle('active', !isOpen);
  if (btn) btn.setAttribute('aria-expanded', !isOpen ? 'true' : 'false');
}

function closeMobileDrawer() {
  const sidebar = $('ledger-sidebar');
  const overlay = $('drawer-overlay');
  const btn = $('menu-toggle-btn');
  if (sidebar) sidebar.classList.remove('open');
  if (overlay) overlay.classList.remove('active');
  if (btn) btn.setAttribute('aria-expanded', 'false');
}

function handleGlobalKeydown(e) {
  const isMac = navigator.platform.toUpperCase().indexOf('MAC') >= 0;
  const modifier = isMac ? e.metaKey : e.ctrlKey;

  if (modifier && e.key.toLowerCase() === 's') {
    e.preventDefault();
    if (activeUser) saveCurrentEntry();
    return;
  }

  if (modifier && e.key.toLowerCase() === 'k') {
    e.preventDefault();
    const search = $('ledger-search');
    if (search) {
      switchSidebarTab('ledger');
      search.focus();
      search.select();
    }
    return;
  }

  if (e.key === 'Escape') {
    document.querySelectorAll('.modal-backdrop').forEach(m => m.classList.add('hidden'));
    const dropdown = document.querySelector('.dropdown-wrapper');
    if (dropdown) dropdown.classList.remove('open');
    closeMobileDrawer();
    hideUndoToast();
  }
}

// ============================================================================
// 14. Application Initialization
// ============================================================================

function init() {
  window.matchMedia('(prefers-color-scheme: dark)').addEventListener('change', () => {
    if (state && state.meta && state.meta.theme === 'system') applyTheme('system');
  });

  // Login Form
  const loginForm = $('login-form');
  if (loginForm) loginForm.addEventListener('submit', handleLoginSubmit);

  // Quick Account Cards
  const pickHarsh = $('pick-harsh-btn');
  const pickNishtha = $('pick-nishtha-btn');

  function selectProfile(u, p, btn) {
    $('login-username').value = u;
    $('login-password').value = p;
    document.querySelectorAll('.profile-card-btn').forEach(b => b.classList.remove('selected'));
    if (btn) btn.classList.add('selected');
    $('login-password').focus();
  }

  if (pickHarsh) pickHarsh.addEventListener('click', () => selectProfile('Harsh123', '123', pickHarsh));
  if (pickNishtha) pickNishtha.addEventListener('click', () => selectProfile('nishtha123', '123', pickNishtha));

  // Toggle Password Visibility
  const togglePassBtn = $('toggle-password-btn');
  if (togglePassBtn) {
    togglePassBtn.addEventListener('click', () => {
      const passInput = $('login-password');
      if (passInput) {
        const isPass = passInput.type === 'password';
        passInput.type = isPass ? 'text' : 'password';
        togglePassBtn.textContent = isPass ? 'Hide' : 'Show';
      }
    });
  }

  // Logout Handler
  on('logout-btn', 'click', handleLogout);

  // Editor Form Handlers
  const editorForm = $('entry-editor-form');
  if (editorForm) {
    editorForm.addEventListener('input', captureFormAsDraft);
    editorForm.date.addEventListener('change', (e) => handleDateChange(e.target.value));
    editorForm.status.addEventListener('change', (e) => {
      const statusHelper = $('status-helper');
      if (e.target.value === 'No work') {
        if (!editorForm.hoursWorked.value || editorForm.hoursWorked.value === '8.0' || editorForm.hoursWorked.value === '8') {
          editorForm.hoursWorked.value = '0';
        }
        if (!editorForm.title.value) editorForm.title.value = 'Weekend / Holiday / Leave';
        if (statusHelper) statusHelper.textContent = 'Recorded as non-working day / holiday';
      } else {
        if (editorForm.hoursWorked.value === '0') editorForm.hoursWorked.value = '8.0';
        if (statusHelper) statusHelper.textContent = 'Working day logged';
      }
      captureFormAsDraft();
    });
    editorForm.addEventListener('submit', (e) => {
      e.preventDefault();
      saveCurrentEntry();
    });
  }

  // Quick Hours Preset Pills
  document.querySelectorAll('.pill-hour').forEach(pill => {
    pill.addEventListener('click', () => {
      const hours = pill.getAttribute('data-hours');
      const hoursInput = $('entry-hours');
      if (hoursInput) {
        hoursInput.value = hours;
        captureFormAsDraft();
      }
    });
  });

  // Sidebar Tabs (Ledger List vs. Monthly Calendar)
  on('tab-ledger-btn', 'click', () => switchSidebarTab('ledger'));
  on('tab-calendar-btn', 'click', () => switchSidebarTab('calendar'));

  // Mobile Bottom Bar Navigation
  on('mobile-ledger-btn', 'click', () => {
    switchSidebarTab('ledger');
    toggleMobileDrawer();
  });
  on('mobile-calendar-btn', 'click', () => {
    switchSidebarTab('calendar');
    toggleMobileDrawer();
  });
  on('mobile-new-entry-btn', 'click', () => prepareNewEntry(getTodayIsoDate()));
  on('mobile-save-btn', 'click', saveCurrentEntry);

  // Mini Calendar Navigation
  on('cal-prev-btn', 'click', () => {
    calViewDate.setMonth(calViewDate.getMonth() - 1);
    renderMiniCalendar();
  });
  on('cal-next-btn', 'click', () => {
    calViewDate.setMonth(calViewDate.getMonth() + 1);
    renderMiniCalendar();
  });
  on('cal-today-btn', 'click', () => {
    calViewDate = new Date();
    renderMiniCalendar();
    handleDateChange(getTodayIsoDate());
  });

  // Action Buttons
  on('delete-entry-btn', 'click', promptDeleteCurrentEntry);
  on('new-entry-btn', 'click', () => prepareNewEntry(getTodayIsoDate()));
  on('ledger-search', 'input', renderLedgerList);
  on('filter-week', 'change', renderLedgerList);
  on('filter-status', 'change', renderLedgerList);
  on('menu-toggle-btn', 'click', toggleMobileDrawer);
  on('drawer-overlay', 'click', closeMobileDrawer);
  // Sidebar close button (mobile — appears inside sidebar header)
  on('sidebar-close-btn', 'click', closeMobileDrawer);
  on('theme-toggle-btn', 'click', cycleTheme);
  on('open-profile-btn', 'click', openProfileModal);

  // Export Dropdown
  const exportMenuBtn = $('export-menu-btn');
  const dropdownWrapper = document.querySelector('.dropdown-wrapper');
  if (exportMenuBtn && dropdownWrapper) {
    exportMenuBtn.addEventListener('click', (e) => {
      e.stopPropagation();
      dropdownWrapper.classList.toggle('open');
    });
    document.addEventListener('click', () => dropdownWrapper.classList.remove('open'));
  }

  function closeDropdown() {
    if (dropdownWrapper) dropdownWrapper.classList.remove('open');
  }

  on('export-txt-btn', 'click', () => { closeDropdown(); exportTextReport(); });
  on('print-pdf-btn', 'click', () => { closeDropdown(); handlePrintReport(); });
  on('export-json-btn', 'click', () => { closeDropdown(); exportBackupJson(); });
  on('import-json-input', 'change', (e) => { closeDropdown(); handleImportFileSelect(e); });

  // Profile Form
  const profileForm = $('profile-form');
  if (profileForm) profileForm.addEventListener('submit', handleProfileSubmit);
  on('close-profile-modal-btn', 'click', closeProfileModal);
  on('cancel-profile-btn', 'click', closeProfileModal);

  // Modals
  on('metric-missing-btn', 'click', openMissingDaysModal);
  on('close-missing-btn', 'click', () => $('missing-days-modal').classList.add('hidden'));
  on('close-missing-modal-btn', 'click', () => $('missing-days-modal').classList.add('hidden'));
  on('confirm-delete-btn', 'click', confirmDeleteEntry);
  on('cancel-delete-btn', 'click', () => $('delete-modal').classList.add('hidden'));
  on('close-delete-modal-btn', 'click', () => $('delete-modal').classList.add('hidden'));
  on('confirm-import-merge-btn', 'click', executeImportMerge);
  on('confirm-import-replace-btn', 'click', executeImportReplace);
  on('cancel-import-btn', 'click', () => {
    $('import-modal').classList.add('hidden');
    pendingImportData = null;
  });
  on('close-import-modal-btn', 'click', () => {
    $('import-modal').classList.add('hidden');
    pendingImportData = null;
  });

  // Undo Toast
  on('toast-undo-btn', 'click', restoreDeletedEntry);
  on('toast-dismiss-btn', 'click', hideUndoToast);

  // Banners
  on('backup-now-btn', 'click', exportBackupJson);
  on('dismiss-backup-btn', 'click', () => $('backup-reminder-banner').classList.add('hidden'));
  on('setup-profile-btn', 'click', openProfileModal);
  on('dismiss-profile-banner-btn', 'click', () => $('profile-reminder-banner').classList.add('hidden'));

  // Global Keys
  document.addEventListener('keydown', handleGlobalKeydown);

  // Check initial authentication state
  if (activeUser && state) {
    showAppInterface();
  } else {
    showLoginScreen();
  }
}

if (document.readyState === 'loading') {
  document.addEventListener('DOMContentLoaded', init);
} else {
  init();
}
