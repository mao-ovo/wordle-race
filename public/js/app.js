// ========================================================
// WORDLE RACE — SOFTWARE DENSITY CLIENT LOGIC
// Strict adherence to Zero-Slop Rules & Neutral-first Palette
// ========================================================

const socket = io();

// ===== LUCIDE ICON SVG DEFINITIONS (16px/20px, 1.5px stroke) =====
const LUCIDE_ICONS = {
  shield: '<path d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10"/>',
  terminal: '<polyline points="4 17 10 11 4 5"/><line x1="12" x2="20" y1="19" y2="19"/>',
  cpu: '<rect width="16" height="16" x="4" y="4" rx="2"/><rect width="6" height="6" x="9" y="9" rx="1"/><path d="M15 2v2"/><path d="M15 20v2"/><path d="M2 15h2"/><path d="M2 9h2"/><path d="M20 15h2"/><path d="M20 9h2"/><path d="M9 2v2"/><path d="M9 20v2"/>',
  zap: '<polygon points="13 2 3 14 12 14 11 22 21 10 12 10 13 2"/>',
  target: '<circle cx="12" cy="12" r="10"/><circle cx="12" cy="12" r="6"/><circle cx="12" cy="12" r="2"/>',
  activity: '<path d="M22 12h-4l-3 9L9 3l-3 9H2"/>',
  layers: '<path d="m12.83 2.18a2 2 0 0 0-1.66 0L2.6 6.08a1 1 0 0 0 0 1.83l8.58 3.91a2 2 0 0 0 1.66 0l8.58-3.9a1 1 0 0 0 0-1.83Z"/><path d="m22 17.65-9.17 4.16a2 2 0 0 1-1.66 0L2 17.65"/><path d="m22 12.65-9.17 4.16a2 2 0 0 1-1.66 0L2 12.65"/>',
  box: '<path d="M21 8a2 2 0 0 0-1-1.73l-7-4a2 2 0 0 0-2 0l-7 4A2 2 0 0 0 3 8v8a2 2 0 0 0 1 1.73l7 4a2 2 0 0 0 2 0l7-4A2 2 0 0 0 21 16Z"/><path d="m3.3 7 8.7 5 8.7-5"/><path d="M12 22V12"/>',
  flame: '<path d="M8.5 14.5A2.5 2.5 0 0 0 11 12c0-1.38-.5-2-1-3-1.072-2.143-.224-4.054 2-6 .5 2.5 2 4.9 4 6.5 2 1.6 3 3.5 3 5.5a7 7 0 1 1-14 0c0-1.153.433-2.294 1-3a2.5 2.5 0 0 0 2.5 2.5z"/>',
  compass: '<circle cx="12" cy="12" r="10"/><polygon points="16.24 7.76 14.12 14.12 7.76 16.24 9.88 9.88 16.24 7.76"/>',
  crosshair: '<circle cx="12" cy="12" r="10"/><line x1="22" x2="18" y1="12" y2="12"/><line x1="6" x2="2" y1="12" y2="12"/><line x1="12" x2="12" y1="6" y2="2"/><line x1="12" x2="12" y1="22" y2="18"/>',
  user: '<circle cx="12" cy="8" r="5"/><path d="M20 21a8 8 0 0 0-16 0"/>',
  trophy: '<path d="M6 9H4.5a2.5 2.5 0 0 1 0-5H6"/><path d="M18 9h1.5a2.5 2.5 0 0 0 0-5H18"/><path d="M4 22h16"/><path d="M10 14.66V17c0 .55-.47.98-.97 1.21C7.85 18.75 7 20.24 7 22"/><path d="M14 14.66V17c0 .55.47.98.97 1.21C16.15 18.75 17 20.24 17 22"/><path d="M18 2H6v7a6 6 0 0 0 12 0V2Z"/>',
  check: '<path d="M20 6 9 17l-5-5"/>',
  x: '<path d="M18 6 6 18"/><path d="m6 6 12 12"/>',
  copy: '<rect width="14" height="14" x="8" y="8" rx="2" ry="2"/><path d="M4 16c-1.1 0-2-.9-2-2V4c0-1.1.9-2 2-2h10c1.1 0 2 .9 2 2"/>',
  clock: '<circle cx="12" cy="12" r="10"/><polyline points="12 6 12 12 16 14"/>',
  lock: '<rect width="18" height="11" x="3" y="11" rx="2" ry="2"/><path d="M7 11V7a5 5 0 0 1 10 0v4"/>',
  crown: '<path d="m2 4 3 12h14l3-12-6 7-4-7-4 7-6-7zm3 16h14"/>'
};

function renderLucideSvg(iconName, size = 16) {
  const innerPath = LUCIDE_ICONS[iconName] || LUCIDE_ICONS.user;
  return `<svg width="${size}" height="${size}" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round">${innerPath}</svg>`;
}

// 12 selectable icon insignias
const AVATAR_KEYS = [
  'shield', 'terminal', 'cpu', 'zap', 'target', 'activity',
  'layers', 'box', 'flame', 'compass', 'crosshair', 'user'
];

// ===== STATE =====
let profile = JSON.parse(localStorage.getItem('wordle-race-profile')) || {
  name: 'Spectre',
  avatar: 'terminal'
};
// Fallback if legacy avatar string
if (!AVATAR_KEYS.includes(profile.avatar)) {
  profile.avatar = 'terminal';
}

let spProgress = JSON.parse(localStorage.getItem('wordle-race-sp')) || {
  completedLevels: [],
  currentLevel: 1
};

let currentView = 'home-view';
let gameMode = null; // 'sp' or 'mp'
let currentRow = 0;
let currentCol = 0;
let board = [];
let isProcessing = false;
let animationTimeouts = [];

let roomCode = null;
let isHost = false;
let myId = null;
let timeLimit = 180;
let totalTime = 180;
let timeMinutes = 3;
let currentWordNumber = 1;
let wordsCompleted = 0;
let pendingAnswer = null;

let opponents = {};
let isReady = false;
let currentLevel = 1;
let currentTierFilter = 'all';
let players = {};
let hostId = null;

let keyStates = { sp: {}, mp: {} };

// ===== AUDIO (WEB AUDIO API) =====
class SoundManager {
  constructor() {
    this.ctx = null;
  }

  init() {
    if (!this.ctx) {
      this.ctx = new (window.AudioContext || window.webkitAudioContext)();
    }
    if (this.ctx.state === 'suspended') this.ctx.resume();
  }

  play(type) {
    try {
      this.init();
      switch (type) {
        case 'key': this._tone(700, 0.02, 0.03, 'sine'); break;
        case 'delete': this._tone(350, 0.03, 0.03, 'sine'); break;
        case 'submit': this._tone(500, 0.04, 0.05, 'sine'); break;
        case 'flip': this._tone(260, 0.03, 0.03, 'triangle'); break;
        case 'correct': this._arpeggio([523, 659, 784], 0.05, 0.08); break;
        case 'wrong': this._tone(160, 0.2, 0.06, 'sawtooth'); break;
        case 'levelUp': this._arpeggio([523, 659, 784, 1046], 0.04, 0.08); break;
        case 'countdown': this._tone(800, 0.08, 0.1, 'square'); break;
        case 'go': this._tone(1200, 0.2, 0.12, 'square'); break;
        case 'gameOver': this._arpeggio([784, 659, 587, 523], 0.06, 0.08); break;
        case 'tick': this._tone(900, 0.02, 0.02, 'sine'); break;
        case 'wordComplete': this._arpeggio([659, 784, 988, 1175], 0.04, 0.08); break;
      }
    } catch (e) {}
  }

  _tone(freq, duration, vol, type) {
    const osc = this.ctx.createOscillator();
    const gain = this.ctx.createGain();
    osc.type = type;
    osc.frequency.value = freq;
    gain.gain.setValueAtTime(vol, this.ctx.currentTime);
    gain.gain.exponentialRampToValueAtTime(0.001, this.ctx.currentTime + duration);
    osc.connect(gain);
    gain.connect(this.ctx.destination);
    osc.start();
    osc.stop(this.ctx.currentTime + duration + 0.01);
  }

  _arpeggio(freqs, interval, vol) {
    freqs.forEach((f, i) => {
      setTimeout(() => this._tone(f, interval * 1.5, vol, 'sine'), i * interval * 1000);
    });
  }
}

const sounds = new SoundManager();

// ===== VIEW NAVIGATION =====
function showView(viewId) {
  document.querySelectorAll('.view').forEach(v => v.classList.remove('active'));
  const target = document.getElementById(viewId);
  if (target) {
    target.classList.add('active');
    currentView = viewId;
  }
}

// ===== TOAST NOTIFICATIONS =====
function showToast(message, type = 'error') {
  const container = document.getElementById('toast-container');
  const toast = document.createElement('div');
  toast.className = `toast ${type}`;
  toast.textContent = message;
  container.appendChild(toast);
  setTimeout(() => {
    if (toast.parentNode) toast.remove();
  }, 3000);
}

// ===== FLOATING WORD FEEDBACK BANNER =====
function showFeedbackBanner(text, isCorrect) {
  const banner = document.getElementById('word-feedback-banner');
  const textEl = document.getElementById('feedback-text');
  if (!banner || !textEl) return;

  textEl.textContent = text;
  banner.className = `word-feedback-banner fixed top-16 left-1/2 -translate-x-1/2 z-40 px-4 py-1.5 rounded-full text-xs font-mono font-medium border shadow-md ${isCorrect ? 'correct-banner' : 'missed-banner'}`;
  banner.style.display = 'block';

  setTimeout(() => {
    banner.style.display = 'none';
  }, 1300);
}

// ===== PROFILE & AVATAR SELECTION =====
function updateHomeProfile() {
  const container = document.getElementById('home-avatar-container');
  if (container) {
    container.innerHTML = renderLucideSvg(profile.avatar, 16);
  }
  const nameEl = document.getElementById('home-name');
  if (nameEl) {
    nameEl.textContent = profile.name.toUpperCase();
  }
}

function updateProfilePreview() {
  const preview = document.getElementById('avatar-live-preview');
  if (preview) {
    preview.innerHTML = renderLucideSvg(profile.avatar, 20);
  }
  const nicknameEl = document.getElementById('nickname-preview');
  if (nicknameEl) {
    nicknameEl.textContent = (profile.name || 'PLAYER').toUpperCase();
  }
}

function buildAvatarGrid() {
  const grid = document.getElementById('avatar-grid');
  if (!grid) return;
  grid.innerHTML = '';

  AVATAR_KEYS.forEach(key => {
    const btn = document.createElement('button');
    btn.type = 'button';
    btn.className = `h-10 rounded-md border flex items-center justify-center transition-colors ${key === profile.avatar ? 'border-blue-500 bg-blue-500/10 text-blue-400' : 'border-zinc-800 bg-zinc-950 text-zinc-400 hover:text-zinc-200 hover:border-zinc-700'}`;
    btn.innerHTML = renderLucideSvg(key, 18);
    btn.title = key;
    btn.addEventListener('click', () => {
      grid.querySelectorAll('button').forEach(b => {
        b.className = 'h-10 rounded-md border border-zinc-800 bg-zinc-950 text-zinc-400 hover:text-zinc-200 hover:border-zinc-700 flex items-center justify-center transition-colors';
      });
      btn.className = 'h-10 rounded-md border border-blue-500 bg-blue-500/10 text-blue-400 flex items-center justify-center transition-colors';
      profile.avatar = key;
      updateProfilePreview();
    });
    grid.appendChild(btn);
  });
}

function saveProfile() {
  const nameInput = document.getElementById('profile-name-input');
  const name = nameInput.value.trim();
  if (name) {
    profile.name = name.slice(0, 15);
  }
  localStorage.setItem('wordle-race-profile', JSON.stringify(profile));
  updateHomeProfile();
  socket.emit('set-profile', { name: profile.name, avatar: profile.avatar });
  showView('home-view');
  showToast('Profile updated', 'success');
}

// Progression lock: Level 1 is open, Level N requires Level N-1 completed
function isLevelUnlocked(level) {
  if (level === 1) return true;
  return spProgress.completedLevels.includes(level - 1);
}

// ===== SINGLE PLAYER CAMPAIGN (PROGRESSIVE LOCKING) =====
function buildLevelsGrid(tier = 'all') {
  currentTierFilter = tier;
  const grid = document.getElementById('levels-grid');
  if (!grid) return;
  grid.innerHTML = '';

  let minLvl = 1;
  let maxLvl = 100;
  if (tier === '1') { minLvl = 1; maxLvl = 20; }
  else if (tier === '2') { minLvl = 21; maxLvl = 50; }
  else if (tier === '3') { minLvl = 51; maxLvl = 75; }
  else if (tier === '4') { minLvl = 76; maxLvl = 100; }

  const completedCount = spProgress.completedLevels.length;
  document.getElementById('sp-completed-count').textContent = `${completedCount} / 100`;
  document.getElementById('sp-progress-bar').style.width = `${completedCount}%`;

  for (let level = minLvl; level <= maxLvl; level++) {
    const card = document.createElement('div');
    card.className = 'level-card';

    const isCompleted = spProgress.completedLevels.includes(level);
    const isUnlocked = isLevelUnlocked(level);

    if (isCompleted) {
      card.classList.add('completed');
      card.textContent = String(level).padStart(2, '0');
    } else if (isUnlocked) {
      if (level === currentLevel) {
        card.classList.add('current');
      }
      card.textContent = String(level).padStart(2, '0');
    } else {
      card.classList.add('locked');
      card.innerHTML = `<span class="opacity-30">${String(level).padStart(2, '0')}</span><span class="ml-1 opacity-40">${renderLucideSvg('lock', 11)}</span>`;
    }

    card.addEventListener('click', () => {
      if (!isUnlocked) {
        showToast(`Complete Level ${level - 1} to unlock Level ${level}`, 'error');
        return;
      }
      startSinglePlayerLevel(level);
    });
    grid.appendChild(card);
  }
}

function updateSinglePlayerNav() {
  const prevBtn = document.getElementById('sp-prev-btn');
  const nextBtn = document.getElementById('sp-next-btn');
  const statusEl = document.getElementById('sp-level-status');
  const retryBtn = document.getElementById('sp-retry-btn');

  if (prevBtn) {
    prevBtn.disabled = (currentLevel <= 1);
  }

  if (nextBtn) {
    const nextUnlocked = (currentLevel < 100) && isLevelUnlocked(currentLevel + 1);
    nextBtn.disabled = !nextUnlocked;
    if (nextUnlocked && !spProgress.completedLevels.includes(currentLevel + 1)) {
      nextBtn.className = 'h-8 px-3 rounded-md bg-blue-600 hover:bg-blue-700 text-white text-xs font-medium flex items-center gap-1.5 transition-colors cursor-pointer';
    } else {
      nextBtn.className = 'h-8 px-3 rounded-md border border-zinc-800 bg-zinc-900 hover:bg-zinc-800 text-xs font-medium text-zinc-300 disabled:opacity-30 disabled:pointer-events-none flex items-center gap-1.5 transition-colors';
    }
  }

  if (statusEl) {
    if (spProgress.completedLevels.includes(currentLevel)) {
      statusEl.innerHTML = `<span class="inline-flex items-center gap-1 text-emerald-500 font-medium">${renderLucideSvg('check', 12)} Solved</span>`;
    } else {
      statusEl.textContent = '';
    }
  }

  if (retryBtn) {
    retryBtn.classList.add('hidden');
  }
}

function getDifficultyForLevel(level) {
  if (level <= 20) return 'NOVICE';
  if (level <= 50) return 'ADEPT';
  if (level <= 75) return 'EXPERT';
  return 'MASTER';
}

function startSinglePlayerLevel(level) {
  if (!isLevelUnlocked(level)) {
    showToast(`Complete Level ${level - 1} to unlock Level ${level}`, 'error');
    return;
  }

  currentLevel = level;
  gameMode = 'sp';

  document.getElementById('sp-level-label').textContent = String(level).padStart(2, '0');
  const diffTag = document.getElementById('sp-difficulty-tag');
  if (diffTag) diffTag.textContent = getDifficultyForLevel(level);

  clearAnimationTimeouts();
  resetBoard('sp');
  updateSinglePlayerNav();
  socket.emit('sp-start', { level });
  showView('sp-game-view');
}

// ===== GAME BOARD RESET & KEYBOARDS =====
function clearAnimationTimeouts() {
  animationTimeouts.forEach(t => clearTimeout(t));
  animationTimeouts = [];
}

function resetBoard(prefix) {
  clearAnimationTimeouts();
  currentRow = 0;
  currentCol = 0;
  board = Array.from({ length: 6 }, () => Array(5).fill(''));
  isProcessing = false;

  const boardEl = document.getElementById(`${prefix}-board`);
  if (!boardEl) return;
  boardEl.innerHTML = '';

  for (let r = 0; r < 6; r++) {
    const row = document.createElement('div');
    row.className = 'board-row';
    row.id = `${prefix}-row-${r}`;
    for (let c = 0; c < 5; c++) {
      const tile = document.createElement('div');
      tile.className = 'tile';
      tile.id = `${prefix}-tile-${r}-${c}`;
      row.appendChild(tile);
    }
    boardEl.appendChild(row);
  }

  resetKeyboard(prefix);
}

function resetKeyboard(prefix) {
  keyStates[prefix] = {};
  const container = document.getElementById(`${prefix}-keyboard`);
  if (!container) return;
  container.querySelectorAll('.key').forEach(key => {
    key.classList.remove('correct', 'present', 'absent');
  });
}

function buildKeyboard(prefix) {
  const rows = [
    ['Q', 'W', 'E', 'R', 'T', 'Y', 'U', 'I', 'O', 'P'],
    ['A', 'S', 'D', 'F', 'G', 'H', 'J', 'K', 'L'],
    ['ENTER', 'Z', 'X', 'C', 'V', 'B', 'N', 'M', 'DEL']
  ];
  const container = document.getElementById(`${prefix}-keyboard`);
  if (!container) return;
  container.innerHTML = '';

  rows.forEach(rowKeys => {
    const row = document.createElement('div');
    row.className = 'keyboard-row';
    rowKeys.forEach(key => {
      const btn = document.createElement('button');
      btn.type = 'button';
      btn.className = 'key' + (key === 'ENTER' || key === 'DEL' ? ' wide' : '');
      btn.textContent = key;
      btn.id = `${prefix}-key-${key}`;
      btn.setAttribute('aria-label', key);
      btn.addEventListener('click', (e) => {
        e.preventDefault();
        handleKeyPress(key);
      });
      row.appendChild(btn);
    });
    container.appendChild(row);
  });
}

function handleKeyPress(key) {
  if (isProcessing) return;
  if (gameMode === null) return;

  const prefix = gameMode === 'sp' ? 'sp' : 'mp';

  if (key === 'DEL' || key === 'Backspace' || key === '⌫') {
    if (currentCol > 0) {
      currentCol--;
      board[currentRow][currentCol] = '';
      const tile = document.getElementById(`${prefix}-tile-${currentRow}-${currentCol}`);
      if (tile) {
        tile.textContent = '';
        tile.classList.remove('filled');
      }
      sounds.play('delete');
    }
    return;
  }

  if (key === 'ENTER' || key === 'Enter') {
    if (currentCol === 5) {
      const guess = board[currentRow].join('');
      sounds.play('submit');
      if (gameMode === 'sp') {
        socket.emit('sp-guess', { guess });
      } else {
        socket.emit('submit-guess', { guess });
      }
    } else {
      const row = document.getElementById(`${prefix}-row-${currentRow}`);
      if (row) {
        row.classList.add('shake');
        setTimeout(() => row.classList.remove('shake'), 400);
      }
    }
    return;
  }

  if (/^[A-Z]$/i.test(key) && key.length === 1) {
    if (currentCol < 5) {
      const letter = key.toUpperCase();
      board[currentRow][currentCol] = letter;
      const tile = document.getElementById(`${prefix}-tile-${currentRow}-${currentCol}`);
      if (tile) {
        tile.textContent = letter;
        tile.classList.add('filled', 'pop');
        setTimeout(() => tile.classList.remove('pop'), 80);
      }
      sounds.play('key');
      currentCol++;
    }
  }
}

document.addEventListener('keydown', (e) => {
  if (currentView !== 'sp-game-view' && currentView !== 'mp-game-view') return;
  if (e.ctrlKey || e.metaKey || e.altKey) return;

  if (e.key === 'Enter') {
    e.preventDefault();
    handleKeyPress('ENTER');
  } else if (e.key === 'Backspace') {
    e.preventDefault();
    handleKeyPress('DEL');
  } else if (/^[a-zA-Z]$/.test(e.key)) {
    handleKeyPress(e.key.toUpperCase());
  }
});

// ===== SAFE TILE REVEAL (NO CONCURRENCY BUGS) =====
function revealResults(prefix, row, guess, results, onComplete) {
  isProcessing = true;
  const guessArr = guess.toUpperCase().split('');
  let revealed = 0;

  results.forEach((result, i) => {
    const tId = setTimeout(() => {
      const tile = document.getElementById(`${prefix}-tile-${row}-${i}`);
      if (tile) {
        tile.classList.add('flip');
        sounds.play('flip');

        const midTId = setTimeout(() => {
          tile.classList.add(result);
          tile.textContent = guessArr[i];
        }, 125);
        animationTimeouts.push(midTId);
      }

      updateKeyColor(prefix, guessArr[i], result);
      revealed++;

      if (revealed === 5 && onComplete) {
        const finishTId = setTimeout(onComplete, 180);
        animationTimeouts.push(finishTId);
      }
    }, i * 120);

    animationTimeouts.push(tId);
  });
}

function updateKeyColor(prefix, letter, result) {
  const priority = { correct: 3, present: 2, absent: 1 };
  const current = keyStates[prefix][letter];
  if (!current || priority[result] > priority[current]) {
    keyStates[prefix][letter] = result;
    const keyEl = document.getElementById(`${prefix}-key-${letter}`);
    if (keyEl) {
      keyEl.classList.remove('correct', 'present', 'absent');
      keyEl.classList.add(result);
    }
  }
}

// ===== TELEMETRY & OPPONENTS =====
function updateTimer(remaining) {
  const pct = Math.max(0, Math.min(100, (remaining / totalTime) * 100));
  const mins = Math.floor(remaining / 60);
  const secs = remaining % 60;

  const fillEl = document.getElementById('timer-fill');
  const textEl = document.getElementById('timer-text');
  if (fillEl) fillEl.style.width = `${pct}%`;
  if (textEl) textEl.textContent = `${String(mins).padStart(2, '0')}:${String(secs).padStart(2, '0')}`;

  if (remaining <= 10 && remaining > 0) {
    sounds.play('tick');
  }
}

function updateOpponents() {
  const panel = document.getElementById('opponents-panel');
  if (!panel) return;

  const sorted = Object.values(opponents).sort((a, b) => b.wordsCompleted - a.wordsCompleted);

  panel.innerHTML = sorted.map((p, idx) => {
    return `
      <div class="p-2 rounded-md border border-zinc-800 bg-zinc-950 flex items-center justify-between text-xs">
        <div class="flex items-center gap-2">
          <span class="font-mono text-zinc-500 w-4">${idx + 1}</span>
          <div class="w-6 h-6 rounded bg-zinc-900 border border-zinc-800 flex items-center justify-center text-zinc-400">
            ${renderLucideSvg(p.avatar, 14)}
          </div>
          <div>
            <div class="flex items-center gap-1">
              <span class="font-medium text-zinc-200 block truncate max-w-[90px]">${escapeHtml(p.name)}</span>
              ${idx === 0 && p.wordsCompleted > 0 ? `<span class="text-amber-400 inline-flex items-center flex-shrink-0" title="Leader">${renderLucideSvg('crown', 12)}</span>` : ''}
            </div>
            <span class="text-[10px] text-zinc-500 font-mono">Row ${p.currentRow + 1}/6</span>
          </div>
        </div>
        <div class="text-right">
          <span class="font-mono font-semibold text-zinc-200 text-sm">${p.wordsCompleted}</span>
          <span class="text-[10px] text-zinc-500 block">words</span>
        </div>
      </div>
    `;
  }).join('');
}

function renderPlayerList() {
  const list = document.getElementById('player-list');
  if (!list) return;

  const countEl = document.getElementById('lobby-player-count');
  if (countEl) countEl.textContent = Object.keys(players).length;

  list.innerHTML = Object.values(players).map(p => {
    const isPReady = !!p.isReady;
    const isPHost = p.playerId === hostId;
    return `
      <div class="h-10 px-3 rounded-md border border-zinc-800 bg-zinc-950 flex items-center justify-between">
        <div class="flex items-center gap-2.5">
          <div class="w-6 h-6 rounded bg-zinc-900 border border-zinc-800 flex items-center justify-center text-zinc-400">
            ${renderLucideSvg(p.avatar, 14)}
          </div>
          <span class="text-xs font-medium text-zinc-200">${escapeHtml(p.name)}</span>
          ${isPHost ? '<span class="text-[10px] px-1.5 py-0.2 rounded bg-zinc-900 border border-zinc-800 text-zinc-400 font-mono">HOST</span>' : ''}
        </div>
        <span class="text-xs font-mono font-medium ${isPReady ? 'text-green-500' : 'text-zinc-500'}">${isPReady ? 'Ready' : 'Standby'}</span>
      </div>
    `;
  }).join('');

  const startBtn = document.getElementById('start-btn');
  if (startBtn) {
    startBtn.style.display = isHost ? 'inline-flex' : 'none';
    const others = Object.values(players).filter(p => p.playerId !== hostId);
    const allOthersReady = others.length === 0 || others.every(p => p.isReady);
    const canStart = Object.keys(players).length >= 1 && allOthersReady;
    startBtn.disabled = !canStart;
  }
}

function showCountdown(count) {
  const overlay = document.getElementById('countdown-overlay');
  const numberEl = document.getElementById('countdown-number');
  overlay.style.display = 'flex';

  if (count > 0) {
    numberEl.textContent = count;
    sounds.play('countdown');
  } else {
    numberEl.textContent = 'GO!';
    sounds.play('go');
    setTimeout(() => {
      overlay.style.display = 'none';
    }, 600);
  }
}

function escapeHtml(text) {
  const div = document.createElement('div');
  div.textContent = text || '';
  return div.innerHTML;
}

function formatTime(seconds) {
  const mins = Math.floor(seconds / 60);
  const secs = seconds % 60;
  return `${String(mins).padStart(2, '0')}:${String(secs).padStart(2, '0')}`;
}

function updateTimeDisplay() {
  const display = document.getElementById('time-display');
  if (display) display.textContent = `${String(timeMinutes).padStart(2, '0')}:00`;
}

// ===== SOCKET NETWORKING =====
socket.on('connect', () => {
  myId = socket.id;
  socket.emit('set-profile', { name: profile.name, avatar: profile.avatar });
});

socket.on('disconnect', () => {
  showToast('Network disconnected', 'error');
});

socket.on('error', (data) => {
  showToast(data.message, 'error');
});

socket.on('room-created', (data) => {
  roomCode = data.roomCode;
  isHost = true;
  hostId = myId;
  players = {};
  players[data.player.playerId] = data.player;

  document.getElementById('lobby-code').textContent = roomCode;
  document.getElementById('lobby-time').textContent = formatTime(timeLimit);
  renderPlayerList();
  showView('lobby-view');
});

socket.on('room-joined', (data) => {
  roomCode = data.roomCode;
  timeLimit = data.timeLimit;
  totalTime = data.timeLimit;
  hostId = data.hostId;
  isHost = (myId === data.hostId);
  players = {};
  data.players.forEach(p => {
    players[p.playerId] = p;
  });

  document.getElementById('lobby-code').textContent = roomCode;
  document.getElementById('lobby-time').textContent = formatTime(timeLimit);
  renderPlayerList();
  showView('lobby-view');
});

socket.on('player-joined', (data) => {
  players[data.player.playerId] = data.player;
  renderPlayerList();
  showToast(`${data.player.name} joined`, 'info');
});

socket.on('player-left', (data) => {
  if (data.playerId && players[data.playerId]) {
    showToast(`${players[data.playerId].name} left`, 'info');
    delete players[data.playerId];
  }
  if (data.newHostId) {
    hostId = data.newHostId;
    isHost = (myId === data.newHostId);
  }
  if (data.players) {
    players = {};
    data.players.forEach(p => {
      players[p.playerId] = p;
    });
  }
  renderPlayerList();
});

socket.on('players-update', (data) => {
  players = {};
  data.players.forEach(p => {
    players[p.playerId] = p;
  });
  if (data.hostId) {
    hostId = data.hostId;
    isHost = (myId === data.hostId);
  }
  renderPlayerList();
});

socket.on('ready-update', (data) => {
  if (players[data.playerId]) {
    players[data.playerId].isReady = data.isReady;
  }
  renderPlayerList();
});

socket.on('game-countdown', (data) => {
  showCountdown(data.count);
});

socket.on('game-started', (data) => {
  gameMode = 'mp';
  timeLimit = data.timeLimit;
  totalTime = data.timeLimit;
  currentWordNumber = 1;
  wordsCompleted = 0;
  pendingAnswer = null;

  document.getElementById('word-number').textContent = '1';
  clearAnimationTimeouts();
  resetBoard('mp');
  updateTimer(timeLimit);

  opponents = {};
  Object.values(players).forEach(p => {
    opponents[p.playerId] = {
      playerId: p.playerId,
      name: p.name,
      avatar: p.avatar,
      wordsCompleted: 0,
      currentRow: 0
    };
  });
  updateOpponents();

  showView('mp-game-view');
});

// Multiplayer Guess Result — Fixed race condition
socket.on('guess-result', (data) => {
  const prefix = 'mp';
  revealResults(prefix, data.row, data.guess, data.results, () => {
    if (data.isCorrect) {
      sounds.play('correct');
      showFeedbackBanner('+1 Word Solved', true);

      setTimeout(() => {
        resetBoard('mp');
        document.getElementById('word-number').textContent = currentWordNumber;
        isProcessing = false;
      }, 450);

    } else if (data.row >= 5) {
      sounds.play('wrong');
      showFeedbackBanner(`Answer: ${pendingAnswer || data.guess}`, false);

      setTimeout(() => {
        resetBoard('mp');
        document.getElementById('word-number').textContent = currentWordNumber;
        isProcessing = false;
      }, 650);

    } else {
      currentRow = data.row + 1;
      currentCol = 0;
      isProcessing = false;
    }
  });
});

socket.on('word-complete', (data) => {
  wordsCompleted = data.wordsCompleted;
  pendingAnswer = data.answer ? data.answer.toUpperCase() : null;
  if (data.wasCorrect) {
    sounds.play('wordComplete');
  }
});

socket.on('next-word', (data) => {
  currentWordNumber = data.wordNumber;
});

socket.on('opponent-update', (data) => {
  opponents[data.playerId] = {
    playerId: data.playerId,
    name: data.name,
    avatar: data.avatar,
    wordsCompleted: data.wordsCompleted,
    currentRow: data.currentRow
  };
  updateOpponents();
});

socket.on('timer-update', (data) => {
  updateTimer(data.remaining);
});

// Leaderboard Results (Neutral Software Table)
socket.on('game-over', (data) => {
  clearAnimationTimeouts();
  isProcessing = false;
  gameMode = null;

  const lb = document.getElementById('leaderboard');
  if (!lb) return;

  let list = (data && Array.isArray(data.leaderboard) && data.leaderboard.length > 0)
    ? data.leaderboard
    : [];

  // Defensive fallback: ensure scoreboard is NEVER empty
  if (list.length === 0) {
    const fallbackList = [{
      playerId: myId,
      name: myName || 'Player',
      avatar: myAvatar || 'terminal',
      wordsCompleted: wordsCompleted || 0,
      currentRow: currentRow || 0,
      bestLettersRight: 0,
      totalLettersRight: 0,
      rank: 1
    }];
    Object.values(opponents).forEach((op, i) => {
      fallbackList.push({
        playerId: op.playerId,
        name: op.name || 'Player',
        avatar: op.avatar || 'terminal',
        wordsCompleted: op.wordsCompleted || 0,
        currentRow: op.currentRow || 0,
        bestLettersRight: 0,
        totalLettersRight: 0,
        rank: i + 2
      });
    });
    list = fallbackList;
  }

  const hasWinner = (data && data.hasWinner !== undefined)
    ? data.hasWinner
    : list.some(p => p.wordsCompleted > 0);

  lb.innerHTML = list.map((p, idx) => {
    const isMe = p.playerId === myId;
    const isFirst = (idx === 0);
    const rowCount = typeof p.currentRow === 'number' ? p.currentRow : 0;
    const lettersRight = typeof p.bestLettersRight === 'number' ? p.bestLettersRight : 0;

    let statPrimary = '';
    let statSecondary = '';

    if (hasWinner) {
      if (p.wordsCompleted > 0) {
        statPrimary = `<span class="font-semibold text-sm text-zinc-100">${p.wordsCompleted}</span> <span class="text-zinc-400 text-[10px] uppercase font-mono">${p.wordsCompleted === 1 ? 'word' : 'words'}</span>`;
        statSecondary = `<span class="text-zinc-500 font-mono text-[10px]">Row ${rowCount}/6</span>`;
      } else {
        statPrimary = `<span class="font-semibold text-sm text-zinc-400">0</span> <span class="text-zinc-500 text-[10px] uppercase font-mono">words</span>`;
        statSecondary = `<span class="text-zinc-500 font-mono text-[10px]">${lettersRight > 0 ? `${lettersRight}/5 letters • ` : ''}Row ${rowCount}/6</span>`;
      }
    } else {
      // Nobody completed any words: winner decided by letters guessed right
      statPrimary = `<span class="font-semibold text-sm ${lettersRight > 0 ? 'text-emerald-400' : 'text-zinc-400'}">${lettersRight}/5</span> <span class="text-zinc-400 text-[10px] uppercase font-mono">letters</span>`;
      statSecondary = `<span class="text-zinc-500 font-mono text-[10px]">Row ${rowCount}/6</span>`;
    }

    return `
      <div class="h-12 px-3 rounded-md border ${isMe ? 'border-blue-600/80 bg-blue-950/20' : 'border-zinc-800 bg-zinc-950'} flex items-center justify-between text-xs">
        <div class="flex items-center gap-2.5 min-w-0">
          <span class="font-mono font-semibold w-5 flex-shrink-0 ${isFirst ? 'text-amber-500' : 'text-zinc-500'}">#${p.rank || idx + 1}</span>
          <div class="w-7 h-7 rounded bg-zinc-900 border border-zinc-800 flex items-center justify-center text-zinc-400 flex-shrink-0">
            ${renderLucideSvg(p.avatar, 14)}
          </div>
          <div class="flex items-center gap-1.5 min-w-0">
            <span class="font-medium text-zinc-200 truncate max-w-[110px] sm:max-w-[150px]">${escapeHtml(p.name)}</span>
            ${isFirst ? `<span class="text-amber-400 inline-flex items-center flex-shrink-0" title="1st Place Champion">${renderLucideSvg('crown', 14)}</span>` : ''}
          </div>
        </div>
        <div class="text-right flex-shrink-0 pl-2">
          <div>${statPrimary}</div>
          <div>${statSecondary}</div>
        </div>
      </div>
    `;
  }).join('');

  sounds.play('gameOver');
  showView('results-view');
});

// Single Player
socket.on('sp-ready', () => {});

socket.on('sp-guess-result', (data) => {
  const prefix = 'sp';
  revealResults(prefix, data.row, data.guess, data.results, () => {
    if (data.isCorrect) {
      sounds.play('correct');
    } else if (data.row >= 5) {
      sounds.play('wrong');
    } else {
      currentRow = data.row + 1;
      currentCol = 0;
      isProcessing = false;
    }
  });
});

socket.on('sp-level-complete', (data) => {
  const level = data.level;
  if (!spProgress.completedLevels.includes(level)) {
    spProgress.completedLevels.push(level);
  }
  localStorage.setItem('wordle-race-sp', JSON.stringify(spProgress));
  sounds.play('levelUp');

  showFeedbackBanner(`Level ${level} Solved!`, true);
  updateSinglePlayerNav();

  const statusEl = document.getElementById('sp-level-status');
  if (statusEl) {
    statusEl.innerHTML = `<span class="inline-flex items-center gap-1 text-emerald-500 font-semibold">${renderLucideSvg('check', 12)} Solved</span>`;
  }

  // Auto-advance to next level after 1.2s if available
  if (level < 100) {
    const nextBtn = document.getElementById('sp-next-btn');
    if (nextBtn) {
      nextBtn.disabled = false;
      nextBtn.className = 'h-8 px-3 rounded-md bg-blue-600 hover:bg-blue-700 text-white text-xs font-medium flex items-center gap-1.5 transition-colors cursor-pointer';
    }
    setTimeout(() => {
      if (currentView === 'sp-game-view' && currentLevel === level) {
        startSinglePlayerLevel(level + 1);
      }
    }, 1200);
  }
});

socket.on('sp-level-failed', (data) => {
  sounds.play('wrong');

  showFeedbackBanner(`The word was ${data.answer.toUpperCase()}`, false);

  const statusEl = document.getElementById('sp-level-status');
  if (statusEl) {
    statusEl.innerHTML = '<span class="text-red-400 font-medium">Failed</span>';
  }

  const retryBtn = document.getElementById('sp-retry-btn');
  if (retryBtn) {
    retryBtn.classList.remove('hidden');
    retryBtn.onclick = () => {
      startSinglePlayerLevel(data.level);
    };
  }

  // Auto-restart with fresh word after 2.0s
  setTimeout(() => {
    if (currentView === 'sp-game-view' && currentLevel === data.level) {
      startSinglePlayerLevel(data.level);
    }
  }, 2000);
});

// ===== INITIALIZATION =====
document.addEventListener('DOMContentLoaded', () => {
  updateHomeProfile();
  buildKeyboard('sp');
  buildKeyboard('mp');
  buildAvatarGrid();
  buildLevelsGrid('all');

  document.querySelectorAll('.back-btn').forEach(btn => {
    btn.addEventListener('click', () => {
      const target = btn.getAttribute('data-target');
      if (target) {
        if (currentView === 'sp-game-view' || currentView === 'mp-game-view') {
          gameMode = null;
          clearAnimationTimeouts();
        }
        if (target === 'sp-levels-view') {
          buildLevelsGrid(currentTierFilter);
        }
        showView(target);
      }
    });
  });

  document.getElementById('sp-btn').addEventListener('click', () => {
    buildLevelsGrid(currentTierFilter);
    showView('sp-levels-view');
  });

  document.getElementById('mp-btn').addEventListener('click', () => {
    showView('mp-menu-view');
  });

  document.getElementById('home-profile').addEventListener('click', () => {
    document.getElementById('profile-name-input').value = profile.name;
    updateProfilePreview();
    buildAvatarGrid();
    showView('profile-view');
  });

  document.getElementById('save-profile-btn').addEventListener('click', saveProfile);

  document.querySelectorAll('.tier-filter-btn').forEach(btn => {
    btn.addEventListener('click', () => {
      document.querySelectorAll('.tier-filter-btn').forEach(b => {
        b.className = 'tier-filter-btn text-xs font-medium px-2.5 py-1 rounded-md border border-zinc-800 bg-zinc-950 text-zinc-400 hover:text-zinc-200 transition-colors';
      });
      btn.className = 'tier-filter-btn active text-xs font-medium px-2.5 py-1 rounded-md border border-zinc-800 bg-zinc-800 text-zinc-100 transition-colors';
      buildLevelsGrid(btn.getAttribute('data-tier'));
    });
  });

  document.querySelectorAll('.time-adjust-btn').forEach(btn => {
    btn.addEventListener('click', () => {
      const delta = parseInt(btn.getAttribute('data-minutes'));
      timeMinutes = Math.max(1, Math.min(30, timeMinutes + delta));
      updateTimeDisplay();
    });
  });

  document.getElementById('create-room-btn').addEventListener('click', () => {
    timeLimit = timeMinutes * 60;
    totalTime = timeLimit;
    socket.emit('create-room', { timeLimit });
  });

  document.getElementById('join-room-btn').addEventListener('click', () => {
    const codeInput = document.getElementById('room-code-input');
    const code = codeInput.value.trim().toUpperCase();
    if (!code) {
      showToast('Enter a 6-character room code', 'error');
      return;
    }
    socket.emit('join-room', { roomCode: code });
  });

  document.getElementById('copy-code-btn').addEventListener('click', () => {
    if (roomCode) {
      navigator.clipboard.writeText(roomCode).then(() => {
        showToast('Room code copied', 'success');
      }).catch(() => {
        showToast('Failed to copy', 'error');
      });
    }
  });

  const readyBtn = document.getElementById('ready-btn');
  readyBtn.addEventListener('click', () => {
    isReady = !isReady;
    readyBtn.textContent = isReady ? 'Cancel Ready' : 'Mark Ready';
    readyBtn.className = `h-9 px-4 rounded-md border text-xs font-medium transition-colors ${isReady ? 'border-red-900/60 bg-red-950/30 text-red-400 hover:bg-red-950/50' : 'border-zinc-800 bg-zinc-950 hover:bg-zinc-800 text-zinc-200'}`;
    socket.emit('toggle-ready', {});
  });

  document.getElementById('start-btn').addEventListener('click', () => {
    socket.emit('start-game', {});
  });

  document.getElementById('leave-btn').addEventListener('click', () => {
    socket.emit('leave-room', {});
    roomCode = null;
    isHost = false;
    isReady = false;
    players = {};
    readyBtn.textContent = 'Mark Ready';
    readyBtn.className = 'h-9 px-4 rounded-md border border-zinc-800 bg-zinc-950 hover:bg-zinc-800 text-xs font-medium text-zinc-200 transition-colors';
    showView('mp-menu-view');
  });

  document.getElementById('play-again-btn').addEventListener('click', () => {
    if (roomCode) {
      isReady = false;
      readyBtn.textContent = 'Mark Ready';
      readyBtn.className = 'h-9 px-4 rounded-md border border-zinc-800 bg-zinc-950 hover:bg-zinc-800 text-xs font-medium text-zinc-200 transition-colors';
      showView('lobby-view');
    } else {
      showView('mp-menu-view');
    }
  });

  document.getElementById('results-home-btn').addEventListener('click', () => {
    roomCode = null;
    isHost = false;
    isReady = false;
    players = {};
    gameMode = null;
    showView('home-view');
  });

  document.getElementById('sp-prev-btn')?.addEventListener('click', () => {
    if (currentLevel > 1) {
      startSinglePlayerLevel(currentLevel - 1);
    }
  });

  document.getElementById('sp-next-btn')?.addEventListener('click', () => {
    if (currentLevel < 100 && isLevelUnlocked(currentLevel + 1)) {
      startSinglePlayerLevel(currentLevel + 1);
    }
  });

  updateTimeDisplay();

  // Prevent browser double-click zoom or selection on rapid mobile taps (e.g. DEL key)
  document.addEventListener('dblclick', (e) => {
    e.preventDefault();
  }, { passive: false });

  document.addEventListener('click', () => {
    sounds.init();
  }, { once: true });
});
