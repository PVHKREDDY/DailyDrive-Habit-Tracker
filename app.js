/* ============================================
   DailyDrive — Monthly Habit Tracker
   Core application logic with Firebase sync
   ============================================ */

// ─── FORCE SERVICE WORKER UPDATE ──────────────────────
if ('serviceWorker' in navigator) {
  navigator.serviceWorker.getRegistration().then(reg => {
    if (reg) reg.update();
  });
}

// ─── CONFIGURATION (auto-detects current month & year) ──
const NOW = new Date();
const MONTH = NOW.getMonth(); // 0-indexed (0=Jan, 1=Feb, ...)
const YEAR = NOW.getFullYear();
const DAYS_IN_MONTH = new Date(YEAR, MONTH + 1, 0).getDate();
const MONTH_NAME = NOW.toLocaleString('en-US', { month: 'long' });
const STORAGE_KEY = `dailydrive_${YEAR}_${String(MONTH + 1).padStart(2, '0')}`;

// ─── DEFAULT HABITS ────────────────────────────────────
const DEFAULT_HABITS = [
  { id: 'h1', name: 'Wake up at 6:30 AM', icon: '⏰' },
  { id: 'h2', name: 'Morning walk — 10K steps', icon: '🚶‍♂️' },
  { id: 'h3', name: 'Drink 5 liters of water', icon: '💧' },
  { id: 'h4', name: 'Sleep hygiene 6h', icon: '🛏️' },
  { id: 'h5', name: 'Work/Planning the day 8h', icon: '📝' },
  { id: 'h6', name: 'Gym workout', icon: '🏋️‍♂️' },
  { id: 'h7', name: 'Skill development (2h)', icon: '📚' },
  { id: 'h8', name: 'Healthy eating', icon: '🥗' },
  { id: 'h9', name: 'Limit social media (≤30 min)', icon: '📱' },
  { id: 'h10', name: 'No junk food', icon: '🚫' },
];

// ─── ANGRY MOTIVATIONAL MESSAGES ───────────────────────
const ANGRY_MESSAGES = [
  "Seriously?! You skipped this AGAIN? Your future self is watching and they're NOT impressed. Get up and DO IT! 😤",
  "You think success comes from lying on the couch? This habit is the difference between you and the person you WANT to be. No more excuses!",
  "Every single time you skip this, you're voting AGAINST the person you're trying to become. Is that really who you want to be? 🔥",
  "Pain of discipline or pain of regret — pick one! That habit won't complete itself. Move. NOW!",
  "Champions don't hit snooze on their goals. You signed up for this because you KNOW it matters. Don't let yourself down! 💪",
  "You're literally ONE action away from feeling amazing. Stop scrolling and go CRUSH this habit! 😡",
  "Your excuses are getting better, but your results are getting WORSE. Enough! Time to show up for yourself!",
  "Remember why you started this? That fire in your belly? It's still there — stop burying it under laziness! 🔥",
  "If you won't do this for yourself, then who will? Nobody's coming to save you. BE YOUR OWN HERO! 💥",
  "Every missed habit is a broken promise to yourself. How many more promises are you going to break today? ZERO. Go do it!",
  "The version of you that completed ALL habits today? That person EXISTS. Stop choosing the lazy version! 😤",
  "You didn't wake up today to be mediocre. This tiny habit is the foundation of GREATNESS. Don't skip it!",
  "Discipline is doing what needs to be done, even when you don't feel like it. Feelings are TEMPORARY. Results are FOREVER. 🏆",
  "Your comfort zone is a beautiful place, but NOTHING grows there! Get uncomfortable and GET. IT. DONE! 🌱",
  "Imagine explaining to your future successful self why you couldn't do this ONE simple thing today. Embarrassing, right? FIX IT NOW! 💪",
  // Telugu roasts 🔥
  "నువ్వు ఇవ్వాళ ఎం చేసిందే లేదు గాని, రేపు అన్ని కంప్లీట్ చేయాలా, లేకపోతే పరక ఇరిగిపోద్ది. 😤",
  "ఏంట్రా ఇది! ఒక్క పని కూడా చేయలేదా? నీకు సిగ్గు లేదా? రేపట్నుంచి మారకపోతే చూడు! 🔥",
  "ఇవ్వాళ ఏం చేశావ్? ఏమీ లేదు! రేపు అన్నీ చేయకపోతే నీ ఖర్మ నువ్వే చూసుకో! 💥",
  "అసలు నీకు బాధ్యత అనేది ఉందా లేదా? ఇవ్వాళ ఒక్క habit కూడా complete చేయలేదు! 😡",
  "చూడు, ఇలా చేస్తే నీ goals అన్నీ కలలుగానే మిగిలిపోతాయి. రేపు మొదలు పెట్టు, లేకపోతే చెప్పు తీసుకొస్తా! 🩴",
  "ఏమనుకుంటున్నావ్ నువ్వు? ఫోన్ చూస్తూ కూర్చుంటే habits complete అవుతాయా? లేచి పని చేయి! 📵",
];

// ─── STATE ─────────────────────────────────────────────
let appData = null;
let currentUser = null;
let isOnlineMode = false;
let firestoreUnsubscribe = null;
let lastLocalSaveTime = 0;

// ─── AUTH & INITIALIZATION ─────────────────────────────

// Show/hide screens
function showAuthScreen() {
  document.getElementById('auth-screen').style.display = 'flex';
  document.getElementById('app-wrapper').style.display = 'none';
}

function showApp() {
  document.getElementById('auth-screen').style.display = 'none';
  document.getElementById('app-wrapper').style.display = 'block';
}

// ─── SIDEBAR (Mobile Hamburger Menu) ──────────────────
const $sidebar = document.getElementById('sidebar');
const $overlay = document.getElementById('sidebar-overlay');
const $hamburger = document.getElementById('hamburger-btn');
const $sidebarClose = document.getElementById('sidebar-close');

function openSidebar() {
  if ($sidebar) $sidebar.classList.add('open');
  if ($overlay) $overlay.classList.add('show');
  if ($hamburger) $hamburger.classList.add('open');
  document.body.style.overflow = 'hidden'; // prevent background scroll
}

function closeSidebar() {
  if ($sidebar) $sidebar.classList.remove('open');
  if ($overlay) $overlay.classList.remove('show');
  if ($hamburger) $hamburger.classList.remove('open');
  document.body.style.overflow = '';
}

if ($hamburger) {
  $hamburger.addEventListener('click', () => {
    $sidebar.classList.contains('open') ? closeSidebar() : openSidebar();
  });
}
if ($sidebarClose) $sidebarClose.addEventListener('click', closeSidebar);
if ($overlay) $overlay.addEventListener('click', closeSidebar);

// Google Sign-In
document.getElementById('google-signin-btn').addEventListener('click', async () => {
  if (!isFirebaseConfigured()) {
    showToast('warning', 'Firebase Not Configured',
      'To use Google Sign-In, you need to set up Firebase first. Check firebase-config.js for instructions.', 8000);
    return;
  }

  try {
    const provider = new firebase.auth.GoogleAuthProvider();
    await auth.signInWithPopup(provider);
    // Auth state listener will handle the rest
  } catch (error) {
    console.error('Sign-in error:', error);
    showToast('warning', 'Sign-In Failed', error.message, 6000);
  }
});

// Offline mode
document.getElementById('offline-btn').addEventListener('click', () => {
  isOnlineMode = false;
  currentUser = null;
  localStorage.setItem('dailydrive_mode', 'offline');
  appData = loadLocalData();
  document.getElementById('user-menu').style.display = 'none';
  const mobileMenuOff = document.getElementById('user-menu-mobile');
  if (mobileMenuOff) mobileMenuOff.style.display = 'none';
  showApp();
  initApp();
});

// Sign out
document.getElementById('signout-btn').addEventListener('click', async () => {
  if (firestoreUnsubscribe) {
    firestoreUnsubscribe();
    firestoreUnsubscribe = null;
  }
  localStorage.removeItem('dailydrive_mode');
  if (auth) {
    await auth.signOut();
  }
  currentUser = null;
  isOnlineMode = false;
  showAuthScreen();
});

// Firebase Auth state listener
if (isFirebaseConfigured()) {
  auth.onAuthStateChanged(async (user) => {
    if (user) {
      currentUser = user;
      isOnlineMode = true;
      localStorage.setItem('dailydrive_mode', 'online');

      // Show user info (desktop + mobile sidebar)
      document.getElementById('user-menu').style.display = 'flex';
      const avatar = document.getElementById('user-avatar');
      avatar.src = user.photoURL || '';
      avatar.alt = user.displayName || 'User';

      // Sync mobile sidebar user info
      const mobileMenu = document.getElementById('user-menu-mobile');
      if (mobileMenu) mobileMenu.style.display = 'flex';
      const mobileAvatar = document.getElementById('user-avatar-mobile');
      if (mobileAvatar) { mobileAvatar.src = user.photoURL || ''; mobileAvatar.alt = user.displayName || 'User'; }
      const mobileName = document.getElementById('user-name-mobile');
      if (mobileName) mobileName.textContent = user.displayName || 'User';

      // Load data from Firestore (merge with local if needed)
      await loadCloudData();
      showApp();
      initApp();
      listenForCloudChanges();

      // Sync complete (silent)
    } else {
      // Not signed in — check if they were in offline mode
      const savedMode = localStorage.getItem('dailydrive_mode');
      if (savedMode === 'offline') {
        // Restore offline session without showing auth screen
        isOnlineMode = false;
        currentUser = null;
        appData = loadLocalData();
        document.getElementById('user-menu').style.display = 'none';
        const mobileMenuOffline = document.getElementById('user-menu-mobile');
        if (mobileMenuOffline) mobileMenuOffline.style.display = 'none';
        showApp();
        initApp();
      } else {
        showAuthScreen();
      }
    }
  });
} else {
  // No Firebase — check for saved offline session
  const savedMode = localStorage.getItem('dailydrive_mode');
  if (savedMode === 'offline') {
    isOnlineMode = false;
    appData = loadLocalData();
    showApp();
    initApp();
  } else {
    showAuthScreen();
  }
}

// ─── DATA MANAGEMENT ───────────────────────────────────

function loadLocalData() {
  const stored = localStorage.getItem(STORAGE_KEY);
  if (stored) {
    return JSON.parse(stored);
  }
  return createFreshData();
}

function createFreshData() {
  const data = {
    habits: [...DEFAULT_HABITS],
    days: {},
  };
  for (let d = 1; d <= DAYS_IN_MONTH; d++) {
    const key = dayKey(d);
    data.days[key] = {};
    data.habits.forEach(h => {
      data.days[key][h.id] = false;
    });
  }
  return data;
}

function saveLocal(data) {
  data = data || appData;
  localStorage.setItem(STORAGE_KEY, JSON.stringify(data));
}

async function saveData(data) {
  data = data || appData;
  // Always save locally
  saveLocal(data);

  // If signed in, also push to Firestore
  if (isOnlineMode && currentUser && db) {
    try {
      lastLocalSaveTime = Date.now();
      await db.collection('users').doc(currentUser.uid).set({
        habits: data.habits,
        days: data.days,
        updatedAt: firebase.firestore.FieldValue.serverTimestamp(),
      }, { merge: true });
    } catch (err) {
      console.warn('Cloud save failed (will retry):', err.message);
    }
  }
}

async function loadCloudData() {
  if (!currentUser || !db) return;

  try {
    const doc = await db.collection('users').doc(currentUser.uid).get();
    if (doc.exists) {
      const cloudData = doc.data();
      appData = {
        habits: cloudData.habits || DEFAULT_HABITS,
        days: cloudData.days || {},
      };
    } else {
      // First time user — use local data if it exists, otherwise fresh
      const localData = loadLocalData();
      appData = localData;
      // Push local data to cloud
      await saveData(appData);
    }
  } catch (err) {
    console.warn('Cloud load failed, using local:', err.message);
    appData = loadLocalData();
  }

  saveLocal(appData);
}

function listenForCloudChanges() {
  if (!currentUser || !db) return;

  // Unsubscribe previous listener if any
  if (firestoreUnsubscribe) firestoreUnsubscribe();

  firestoreUnsubscribe = db.collection('users').doc(currentUser.uid)
    .onSnapshot((doc) => {
      if (doc.exists && doc.metadata.hasPendingWrites === false) {
        // Ignore snapshots triggered by our own saves (within last 3 seconds)
        if (Date.now() - lastLocalSaveTime < 3000) return;

        // Data changed from another device
        const cloudData = doc.data();
        appData = {
          habits: cloudData.habits || appData.habits,
          days: cloudData.days || appData.days,
        };
        saveLocal(appData);
        renderToday();
        renderCalendar();
        // Silently synced from another device
      }
    }, (err) => {
      console.warn('Snapshot listener error:', err);
    });
}


function dayKey(day) {
  return `${YEAR}-${String(MONTH + 1).padStart(2, '0')}-${String(day).padStart(2, '0')}`;
}

function getTodayDay() {
  const now = new Date();
  // Always return current day of the month (since MONTH & YEAR are set from NOW)
  return now.getDate();
}

// ─── TABS ──────────────────────────────────────────────
document.querySelectorAll('.tab').forEach(tab => {
  tab.addEventListener('click', () => {
    document.querySelectorAll('.tab').forEach(t => t.classList.remove('active'));
    document.querySelectorAll('.tab-content').forEach(tc => tc.classList.remove('active'));
    tab.classList.add('active');
    document.getElementById(`${tab.dataset.tab}-tab`).classList.add('active');

    if (tab.dataset.tab === 'analytics') {
      renderAnalytics();
    }
    if (tab.dataset.tab === 'settings') {
      renderSettings();
    }
  });
});

// ─── TODAY'S CARD ──────────────────────────────────────
function renderToday() {
  const today = getTodayDay();
  const key = dayKey(today);
  const dayData = appData.days[key] || {};

  // Date heading
  const dateObj = new Date(YEAR, MONTH, today);
  const options = { weekday: 'long', month: 'long', day: 'numeric', year: 'numeric' };
  document.getElementById('today-date').textContent =
    `Today — ${dateObj.toLocaleDateString('en-US', options)}`;

  // Render habit checkboxes
  const container = document.getElementById('today-habits');
  container.innerHTML = '';

  appData.habits.forEach(habit => {
    const done = dayData[habit.id] || false;
    const item = document.createElement('div');
    item.className = `habit-check-item${done ? ' checked' : ''}`;
    item.innerHTML = `
      <span class="habit-check-icon">${habit.icon}</span>
      <div class="habit-checkbox">${done ? '✓' : ''}</div>
      <span class="habit-check-label">${habit.name}</span>
    `;
    item.addEventListener('click', () => {
      toggleHabit(key, habit.id);
    });
    container.appendChild(item);
  });

  updateTodayRing();
  updateStreak();
}

function updateTodayRing() {
  const today = getTodayDay();
  const key = dayKey(today);
  const dayData = appData.days[key] || {};
  const total = appData.habits.length;
  const done = appData.habits.filter(h => dayData[h.id]).length;
  const percent = total > 0 ? Math.round((done / total) * 100) : 0;

  const ring = document.getElementById('today-ring');
  const circumference = 2 * Math.PI * 42;
  const offset = circumference - (percent / 100) * circumference;
  ring.style.strokeDashoffset = offset;

  if (percent === 100) {
    ring.style.stroke = 'var(--success)';
  } else if (percent >= 50) {
    ring.style.stroke = 'var(--accent)';
  } else if (percent > 0) {
    ring.style.stroke = 'var(--warning)';
  } else {
    ring.style.stroke = 'var(--danger)';
  }

  document.getElementById('today-percent').textContent = `${percent}%`;
}

const ALL_DONE_MESSAGES = [
  "Crushed it! Do it again tomorrow. 💪",
  "All done! Prove it again tomorrow. 🔥",
  "100%! Same energy tomorrow. 🎯",
  "Perfect day. Now make it a streak! ⚡",
  "Every habit — DONE. Legend. 🏆",
  "You showed up and showed out! 🚀",
  "All checked! Tomorrow's turn next. 💎",
  "Discipline on display. Keep going! 🏅",
  "Owned today. Sleep well, go again! 🌟",
];

async function toggleHabit(dayKeyStr, habitId) {
  if (!appData.days[dayKeyStr]) {
    appData.days[dayKeyStr] = {};
  }
  appData.days[dayKeyStr][habitId] = !appData.days[dayKeyStr][habitId];
  saveData();
  renderToday();
  renderCalendar();

  // If this is today's key AND the habit was just checked (not unchecked), see if all done
  if (appData.days[dayKeyStr][habitId]) {
    const dayData = appData.days[dayKeyStr];
    const total = appData.habits.length;
    const done = appData.habits.filter(h => dayData[h.id]).length;
    if (done === total && total > 0) {
      const msg = ALL_DONE_MESSAGES[Math.floor(Math.random() * ALL_DONE_MESSAGES.length)];
      showToast('success', 'All Habits Complete!', msg, 5000);
    }
  }
}

// ─── STREAK ────────────────────────────────────────────
function updateStreak() {
  const today = getTodayDay();
  let streak = 0;

  for (let d = today; d >= 1; d--) {
    const key = dayKey(d);
    const dayData = appData.days[key] || {};
    const total = appData.habits.length;
    const done = appData.habits.filter(h => dayData[h.id]).length;

    if (done === total && total > 0) {
      streak++;
    } else {
      break;
    }
  }

  document.getElementById('streak-count').textContent = streak;
  const headerStreak = document.getElementById('streak-count-header');
  if (headerStreak) headerStreak.textContent = streak;
}

// ─── CALENDAR ──────────────────────────────────────────
function renderCalendar() {
  const grid = document.getElementById('calendar-grid');
  grid.innerHTML = '';

  const today = getTodayDay();

  const dayNames = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];
  dayNames.forEach(name => {
    const header = document.createElement('div');
    header.className = 'calendar-day-header';
    header.textContent = name;
    grid.appendChild(header);
  });

  const firstDayOfWeek = new Date(YEAR, MONTH, 1).getDay();

  for (let i = 0; i < firstDayOfWeek; i++) {
    const empty = document.createElement('div');
    empty.className = 'calendar-day empty';
    grid.appendChild(empty);
  }

  for (let d = 1; d <= DAYS_IN_MONTH; d++) {
    const key = dayKey(d);
    const dayData = appData.days[key] || {};
    const total = appData.habits.length;
    const done = appData.habits.filter(h => dayData[h.id]).length;

    const cell = document.createElement('div');
    cell.className = 'calendar-day';

    if (d === today) cell.classList.add('today');

    if (d > today) {
      cell.classList.add('future');
    } else if (done === total && total > 0) {
      cell.classList.add('complete');
    } else if (done > 0) {
      cell.classList.add('partial');
    } else {
      cell.classList.add('missed');
    }

    const statusText = d > today ? '—' : `${done}/${total}`;

    cell.innerHTML = `
      <span class="day-num">${d}</span>
      <span class="day-status">${statusText}</span>
    `;

    cell.addEventListener('click', () => {
      if (d <= today) openDayModal(d);
    });

    grid.appendChild(cell);
  }
}

// ─── DAY MODAL ─────────────────────────────────────────
function openDayModal(day) {
  const modal = document.getElementById('day-modal');
  const key = dayKey(day);
  const dayData = appData.days[key] || {};
  const dateObj = new Date(YEAR, MONTH, day);
  const options = { weekday: 'long', month: 'long', day: 'numeric' };

  document.getElementById('modal-date').textContent =
    dateObj.toLocaleDateString('en-US', options);

  const body = document.getElementById('modal-body');
  body.innerHTML = '';

  appData.habits.forEach(habit => {
    const done = dayData[habit.id] || false;
    const item = document.createElement('div');
    item.className = `modal-habit-item${done ? ' checked' : ''}`;
    item.innerHTML = `
      <span class="habit-check-icon">${habit.icon}</span>
      <div class="habit-checkbox">${done ? '✓' : ''}</div>
      <span class="habit-check-label">${habit.name}</span>
    `;
    item.addEventListener('click', () => {
      toggleHabit(key, habit.id);
      openDayModal(day);
    });
    body.appendChild(item);
  });

  modal.classList.add('show');
}

document.getElementById('modal-close').addEventListener('click', () => {
  document.getElementById('day-modal').classList.remove('show');
});

document.getElementById('day-modal').addEventListener('click', (e) => {
  if (e.target === document.getElementById('day-modal')) {
    document.getElementById('day-modal').classList.remove('show');
  }
});

// ─── NOTIFICATIONS (ANGRY MOTIVATIONAL) ────────────────
function showToast(type, title, message, duration = 8000) {
  const container = document.getElementById('toast-container');
  const toast = document.createElement('div');
  toast.className = `toast toast-${type}`;

  const icons = {
    warning: '😤',
    success: '🎉',
    info: 'ℹ️',
  };

  toast.innerHTML = `
    <span class="toast-icon">${icons[type] || '🔔'}</span>
    <div class="toast-content">
      <div class="toast-title">${title}</div>
      <div class="toast-message">${message}</div>
    </div>
    <button class="toast-close">&times;</button>
    <div class="toast-progress" style="animation-duration: ${duration}ms"></div>
  `;

  const closeBtn = toast.querySelector('.toast-close');
  closeBtn.addEventListener('click', () => removeToast(toast));

  container.appendChild(toast);

  setTimeout(() => removeToast(toast), duration);
}

function removeToast(toast) {
  if (!toast || !toast.parentNode) return;
  toast.style.animation = 'slideOut 0.3s cubic-bezier(0.4, 0, 0.2, 1) forwards';
  setTimeout(() => {
    if (toast.parentNode) toast.parentNode.removeChild(toast);
  }, 300);
}

function getRandomAngryMessage() {
  return ANGRY_MESSAGES[Math.floor(Math.random() * ANGRY_MESSAGES.length)];
}

function checkTodaysProgress() {
  const today = getTodayDay();
  const key = dayKey(today);
  const dayData = appData.days[key] || {};
  const total = appData.habits.length;
  const done = appData.habits.filter(h => dayData[h.id]).length;
  const incomplete = appData.habits.filter(h => !dayData[h.id]);

  if (done === total && total > 0) {
    const msg = ALL_DONE_MESSAGES[Math.floor(Math.random() * ALL_DONE_MESSAGES.length)];
    showToast('success', 'All Habits Complete!', msg, 5000);
  } else if (incomplete.length > 0) {
    incomplete.forEach((habit, i) => {
      setTimeout(() => {
        showToast('warning',
          `${habit.icon} "${habit.name}" — NOT DONE!`,
          getRandomAngryMessage(),
          10000 + (i * 2000)
        );
      }, i * 600);
    });
  }
}

document.getElementById('check-today-btn').addEventListener('click', checkTodaysProgress);

// Mobile sidebar check-today button
const checkTodayMobile = document.getElementById('check-today-btn-mobile');
if (checkTodayMobile) {
  checkTodayMobile.addEventListener('click', () => {
    closeSidebar();
    checkTodaysProgress();
  });
}

// Mobile sidebar sign-out button
const signoutMobile = document.getElementById('signout-btn-mobile');
if (signoutMobile) {
  signoutMobile.addEventListener('click', async () => {
    closeSidebar();
    if (firestoreUnsubscribe) {
      firestoreUnsubscribe();
      firestoreUnsubscribe = null;
    }
    localStorage.removeItem('dailydrive_mode');
    if (auth) await auth.signOut();
    currentUser = null;
    isOnlineMode = false;
    showAuthScreen();
  });
}

// ─── ANALYTICS ─────────────────────────────────────────
let chartDaily = null;
let chartHabits = null;
let chartDoughnut = null;

function renderAnalytics() {
  const today = getTodayDay();
  const habits = appData.habits;
  const totalHabits = habits.length;

  document.getElementById('chart-daily-title').textContent = `Daily Completion Rate Over ${MONTH_NAME}`;

  let totalChecks = 0;
  let totalPossible = 0;
  let perfectDays = 0;
  const habitCompletions = {};

  habits.forEach(h => { habitCompletions[h.id] = 0; });

  const dailyRates = [];
  const dailyLabels = [];

  for (let d = 1; d <= today; d++) {
    const key = dayKey(d);
    const dayData = appData.days[key] || {};
    let dayDone = 0;

    habits.forEach(h => {
      if (dayData[h.id]) {
        dayDone++;
        habitCompletions[h.id]++;
      }
    });

    totalChecks += dayDone;
    totalPossible += totalHabits;

    if (dayDone === totalHabits && totalHabits > 0) perfectDays++;

    dailyRates.push(totalHabits > 0 ? Math.round((dayDone / totalHabits) * 100) : 0);
    dailyLabels.push(`${MONTH_NAME.substring(0, 3)} ${d}`);
  }

  const overallCompletion = totalPossible > 0
    ? Math.round((totalChecks / totalPossible) * 100) : 0;

  let bestHabit = '—';
  let worstHabit = '—';
  let bestCount = -1;
  let worstCount = Infinity;

  habits.forEach(h => {
    const count = habitCompletions[h.id] || 0;
    if (count > bestCount) { bestCount = count; bestHabit = h.name; }
    if (count < worstCount) { worstCount = count; worstHabit = h.name; }
  });

  document.getElementById('stat-completion').textContent = `${overallCompletion}%`;
  document.getElementById('stat-best-habit').textContent =
    bestHabit.length > 18 ? bestHabit.substring(0, 18) + '...' : bestHabit;
  document.getElementById('stat-worst-habit').textContent =
    worstHabit.length > 18 ? worstHabit.substring(0, 18) + '...' : worstHabit;
  document.getElementById('stat-perfect-days').textContent = perfectDays;

  // Chart: Daily Completion Line
  const ctxDaily = document.getElementById('chart-daily').getContext('2d');
  if (chartDaily) chartDaily.destroy();

  chartDaily = new Chart(ctxDaily, {
    type: 'line',
    data: {
      labels: dailyLabels,
      datasets: [{
        label: 'Completion %',
        data: dailyRates,
        borderColor: '#7c5cff',
        backgroundColor: 'rgba(124, 92, 255, 0.1)',
        fill: true,
        tension: 0.4,
        pointBackgroundColor: dailyRates.map(r =>
          r === 100 ? '#22c55e' : r >= 50 ? '#7c5cff' : r > 0 ? '#f59e0b' : '#ef4444'
        ),
        pointRadius: 5,
        pointHoverRadius: 7,
      }]
    },
    options: {
      responsive: true,
      plugins: {
        legend: { display: false },
        tooltip: {
          backgroundColor: '#1a1a2e',
          titleColor: '#f0f0f5',
          bodyColor: '#9898b8',
          borderColor: '#2a2a4a',
          borderWidth: 1,
          cornerRadius: 8,
        }
      },
      scales: {
        y: {
          min: 0, max: 100,
          ticks: { color: '#6868a0', callback: v => v + '%' },
          grid: { color: 'rgba(42, 42, 74, 0.5)' },
        },
        x: {
          ticks: { color: '#6868a0', maxRotation: 45 },
          grid: { display: false },
        }
      }
    }
  });

  // Chart: Per-Habit Bar
  const ctxHabits = document.getElementById('chart-habits').getContext('2d');
  if (chartHabits) chartHabits.destroy();

  const habitLabels = habits.map(h => `${h.icon} ${h.name}`);
  const habitPercentages = habits.map(h => {
    const count = habitCompletions[h.id] || 0;
    return today > 0 ? Math.round((count / today) * 100) : 0;
  });

  const barColors = habitPercentages.map(p =>
    p >= 80 ? '#22c55e' : p >= 50 ? '#7c5cff' : p >= 25 ? '#f59e0b' : '#ef4444'
  );

  chartHabits = new Chart(ctxHabits, {
    type: 'bar',
    data: {
      labels: habitLabels,
      datasets: [{
        label: 'Completion %',
        data: habitPercentages,
        backgroundColor: barColors,
        borderRadius: 6,
        barThickness: 28,
      }]
    },
    options: {
      indexAxis: 'y',
      responsive: true,
      plugins: {
        legend: { display: false },
        tooltip: {
          backgroundColor: '#1a1a2e',
          titleColor: '#f0f0f5',
          bodyColor: '#9898b8',
          borderColor: '#2a2a4a',
          borderWidth: 1,
          cornerRadius: 8,
        }
      },
      scales: {
        x: {
          min: 0, max: 100,
          ticks: { color: '#6868a0', callback: v => v + '%' },
          grid: { color: 'rgba(42, 42, 74, 0.3)' },
        },
        y: {
          ticks: { color: '#9898b8', font: { size: 11 } },
          grid: { display: false },
        }
      }
    }
  });

  // Chart: Doughnut
  const ctxDoughnut = document.getElementById('chart-doughnut').getContext('2d');
  if (chartDoughnut) chartDoughnut.destroy();

  const totalMissed = totalPossible - totalChecks;

  chartDoughnut = new Chart(ctxDoughnut, {
    type: 'doughnut',
    data: {
      labels: ['Completed', 'Missed'],
      datasets: [{
        data: [totalChecks, totalMissed],
        backgroundColor: ['#22c55e', '#ef4444'],
        borderWidth: 0,
        spacing: 4,
        borderRadius: 4,
      }]
    },
    options: {
      responsive: true,
      cutout: '65%',
      plugins: {
        legend: {
          position: 'bottom',
          labels: {
            color: '#9898b8',
            padding: 16,
            font: { size: 12 },
          }
        },
        tooltip: {
          backgroundColor: '#1a1a2e',
          titleColor: '#f0f0f5',
          bodyColor: '#9898b8',
          borderColor: '#2a2a4a',
          borderWidth: 1,
          cornerRadius: 8,
        }
      }
    }
  });

  renderHeatmap(today);
}

function renderHeatmap(today) {
  const heatmap = document.getElementById('heatmap');
  heatmap.innerHTML = '';
  const habits = appData.habits;
  const totalHabits = habits.length;

  const dayNames = ['S', 'M', 'T', 'W', 'T', 'F', 'S'];
  dayNames.forEach(name => {
    const label = document.createElement('div');
    label.style.cssText = 'text-align:center;font-size:0.6rem;color:var(--text-muted);font-weight:600;';
    label.textContent = name;
    heatmap.appendChild(label);
  });

  const firstDayOfWeek = new Date(YEAR, MONTH, 1).getDay();

  for (let i = 0; i < firstDayOfWeek; i++) {
    const empty = document.createElement('div');
    heatmap.appendChild(empty);
  }

  for (let d = 1; d <= DAYS_IN_MONTH; d++) {
    const cell = document.createElement('div');
    cell.className = 'heatmap-cell';

    if (d > today) {
      cell.style.background = 'var(--border)';
      cell.style.opacity = '0.3';
      cell.setAttribute('data-tip', `${MONTH_NAME.substring(0, 3)} ${d} — upcoming`);
    } else {
      const key = dayKey(d);
      const dayData = appData.days[key] || {};
      const done = habits.filter(h => dayData[h.id]).length;
      const pct = totalHabits > 0 ? done / totalHabits : 0;

      if (pct === 1) cell.style.background = '#22c55e';
      else if (pct >= 0.75) cell.style.background = '#16a34a';
      else if (pct >= 0.5) cell.style.background = '#ca8a04';
      else if (pct >= 0.25) cell.style.background = '#ea580c';
      else if (pct > 0) cell.style.background = '#dc2626';
      else cell.style.background = '#7f1d1d';

      cell.setAttribute('data-tip', `${MONTH_NAME.substring(0, 3)} ${d} — ${done}/${totalHabits} (${Math.round(pct * 100)}%)`);
    }

    heatmap.appendChild(cell);
  }
}

// ─── SETTINGS ──────────────────────────────────────────
function renderSettings() {
  const container = document.getElementById('habit-list-settings');
  container.innerHTML = '';

  appData.habits.forEach(habit => {
    const item = document.createElement('div');
    item.className = 'habit-setting-item';
    item.innerHTML = `
      <div class="habit-setting-left">
        <span>${habit.icon}</span>
        <span>${habit.name}</span>
      </div>
      <button class="delete-habit-btn" data-id="${habit.id}">Remove</button>
    `;
    container.appendChild(item);
  });

  container.querySelectorAll('.delete-habit-btn').forEach(btn => {
    btn.addEventListener('click', () => {
      const id = btn.dataset.id;
      if (confirm('Remove this habit? This will remove all tracked data for it.')) {
        deleteHabit(id);
      }
    });
  });
}

async function deleteHabit(id) {
  appData.habits = appData.habits.filter(h => h.id !== id);
  Object.keys(appData.days).forEach(key => {
    delete appData.days[key][id];
  });
  await saveData();
  renderSettings();
  renderToday();
  renderCalendar();
}

document.getElementById('add-habit-btn').addEventListener('click', async () => {
  const input = document.getElementById('new-habit-input');
  const iconSelect = document.getElementById('new-habit-icon');
  const name = input.value.trim();
  const icon = iconSelect.value;

  if (!name) {
    showToast('warning', 'Missing Name', 'Please enter a habit name!', 4000);
    return;
  }

  const id = 'h' + Date.now();
  appData.habits.push({ id, name, icon });

  Object.keys(appData.days).forEach(key => {
    appData.days[key][id] = false;
  });

  await saveData();
  input.value = '';
  renderSettings();
  renderToday();
  renderCalendar();
  showToast('success', 'Habit Added! 🎯', `"${name}" has been added. Time to crush it!`, 5000);
});

document.getElementById('new-habit-input').addEventListener('keydown', (e) => {
  if (e.key === 'Enter') {
    document.getElementById('add-habit-btn').click();
  }
});

document.getElementById('reset-all-btn').addEventListener('click', async () => {
  if (confirm(`Are you sure? This will delete ALL your habit tracking data for ${MONTH_NAME} ${YEAR}!`)) {
    localStorage.removeItem(STORAGE_KEY);
    appData = createFreshData();
    await saveData();
    renderToday();
    renderCalendar();
    renderSettings();
    showToast('info', 'Data Reset', 'All data has been cleared. Fresh start!', 5000);
  }
});

// ─── INITIALIZATION ────────────────────────────────────
function initApp() {
  if (!appData) {
    appData = loadLocalData();
  }

  // Set dynamic titles
  const subtitleText = `${MONTH_NAME} Habit Tracker — ${DAYS_IN_MONTH} Days to a Better You`;
  document.getElementById('header-subtitle').textContent = subtitleText;
  document.getElementById('auth-subtitle').textContent = subtitleText;
  document.getElementById('calendar-title').textContent = `${MONTH_NAME} ${YEAR} — Daily Overview`;
  document.title = 'DailyDrive';

  // Ensure all habits have entries for all days
  for (let d = 1; d <= DAYS_IN_MONTH; d++) {
    const key = dayKey(d);
    if (!appData.days[key]) appData.days[key] = {};
    appData.habits.forEach(h => {
      if (appData.days[key][h.id] === undefined) {
        appData.days[key][h.id] = false;
      }
    });
  }
  saveLocal(appData);

  renderToday();
  renderCalendar();

  // Single notification on load if habits are incomplete
  setTimeout(() => {
    const today = getTodayDay();
    const key = dayKey(today);
    const dayData = appData.days[key] || {};
    const total = appData.habits.length;
    const done = appData.habits.filter(h => dayData[h.id]).length;

    if (done < total && total > 0) {
      showToast('warning', `😤 Amma is ANGRY!`, getRandomAngryMessage(), 10000);
    }
  }, 1500);

  // Schedule the 8 PM angry Telugu voice check
  scheduleEveningRoast();
}

// ─── EVENING ROAST (toast notifications only) ─────────

function checkAndRoast() {
  const today = getTodayDay();
  const key = dayKey(today);
  const dayData = appData.days[key] || {};
  const total = appData.habits.length;
  const done = appData.habits.filter(h => dayData[h.id]).length;
  const incomplete = appData.habits.filter(h => !dayData[h.id]);

  if (incomplete.length > 0) {
    showToast('warning', `😤 ${incomplete.length} habit(s) NOT DONE!`, getRandomAngryMessage(), 12000);
  }
}

function scheduleEveningRoast() {
  const ROAST_HOUR = 20; // 8 PM
  const ROAST_MINUTE = 0;

  function msUntilRoast() {
    const now = new Date();
    const target = new Date(now);
    target.setHours(ROAST_HOUR, ROAST_MINUTE, 0, 0);
    if (now >= target) {
      target.setDate(target.getDate() + 1);
    }
    return target - now;
  }

  function triggerRoast() {
    checkAndRoast();
    setTimeout(triggerRoast, msUntilRoast());
  }

  const ms = msUntilRoast();
  console.log(`Evening roast scheduled in ${Math.round(ms / 60000)} minutes (${ROAST_HOUR}:${String(ROAST_MINUTE).padStart(2,'0')})`);
  setTimeout(triggerRoast, ms);

  // If the app loads AFTER roast time with incomplete habits, roast immediately
  const now = new Date();
  if (now.getHours() > ROAST_HOUR || (now.getHours() === ROAST_HOUR && now.getMinutes() >= ROAST_MINUTE)) {
    const today = getTodayDay();
    const key = dayKey(today);
    const dayData = appData.days[key] || {};
    const total = appData.habits.length;
    const done = appData.habits.filter(h => dayData[h.id]).length;

    if (done < total) {
      setTimeout(() => checkAndRoast(), 3000);
    }
  }
}
