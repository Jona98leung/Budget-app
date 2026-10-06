// ============================================================
// My Budget: a budgeting app that runs in the browser.
// All data is saved in localStorage, so it stays on this
// computer in this browser only.
// ============================================================

// ---------- Settings ----------
const STORAGE_KEY = "budget-app-data";
const THEME_KEY = "budget-app-theme";
const SCHEMA_VERSION = 3; // bump this when you change the shape of the saved data

const CURRENCIES = ["USD", "EUR", "GBP", "CAD", "AUD", "NZD", "HKD", "SGD", "JPY", "CNY", "INR", "CHF"];
// No reds or ambers here: those colours mean "over budget" and "nearly there"
const CATEGORY_COLORS = ["#6366f1", "#f97316", "#10b981", "#3b82f6", "#a855f7", "#84cc16", "#06b6d4", "#ec4899", "#64748b"];
const ICON_CHOICES = ["🏷️", "🏠", "🛒", "🚌", "💡", "🍜", "🎉", "🛍️", "💊", "🎓", "✈️", "🐾", "🎁", "📱", "👕", "💼", "💰", "📈"];

const DEFAULT_CATEGORIES = [
  { name: "Salary", kind: "income", icon: "💼" },
  { name: "Other income", kind: "income", icon: "💰" },
  { name: "Rent", kind: "expense", icon: "🏠" },
  { name: "Groceries", kind: "expense", icon: "🛒" },
  { name: "Transport", kind: "expense", icon: "🚌" },
  { name: "Bills", kind: "expense", icon: "💡" },
  { name: "Eating out", kind: "expense", icon: "🍜" },
  { name: "Fun", kind: "expense", icon: "🎉" },
  { name: "Other", kind: "expense", icon: "🏷️" },
];

// How often you can get paid
const PAY_FREQUENCIES = {
  none: "I'd rather not say (use calendar months)",
  daily: "Every day",
  weekly: "Every week",
  biweekly: "Every 2 weeks",
  semimonthly: "Twice a month (1st and 15th)",
  monthly: "Every month",
};

// How long a spending limit lasts before it starts again
const LIMIT_PERIODS = {
  pay: { label: "Each pay period", short: "pay period" },
  daily: { label: "Daily", short: "day" },
  weekly: { label: "Weekly", short: "week" },
  biweekly: { label: "Every 2 weeks", short: "2 weeks" },
  monthly: { label: "Monthly", short: "month" },
};

// A Monday, used as the starting point for weekly and 2-weekly limits
const WEEK_ANCHOR = "2024-01-01";

const THEME_ICONS = {
  auto: '<svg viewBox="0 0 24 24" width="18" height="18" fill="none" stroke="currentColor" stroke-width="2"><circle cx="12" cy="12" r="9"/><path d="M12 3a9 9 0 0 1 0 18z" fill="currentColor"/></svg>',
  light: '<svg viewBox="0 0 24 24" width="18" height="18" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round"><circle cx="12" cy="12" r="4"/><path d="M12 2v2M12 20v2M4.9 4.9l1.4 1.4M17.7 17.7l1.4 1.4M2 12h2M20 12h2M4.9 19.1l1.4-1.4M17.7 6.3l1.4-1.4"/></svg>',
  dark: '<svg viewBox="0 0 24 24" width="18" height="18" fill="none" stroke="currentColor" stroke-width="2" stroke-linejoin="round"><path d="M21 12.8A9 9 0 1 1 11.2 3a7 7 0 0 0 9.8 9.8z"/></svg>',
};

const CHEVRON = '<svg class="chevron" viewBox="0 0 24 24" width="18" height="18" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M6 9l6 6 6-6"/></svg>';

const reduceMotion = window.matchMedia("(prefers-reduced-motion: reduce)").matches;

// ---------- Small helper functions ----------

// A shortcut for document.getElementById
const $ = (id) => document.getElementById(id);

// Make a unique ID for each saved item
function newId() {
  if (window.crypto && crypto.randomUUID) return crypto.randomUUID();
  return Date.now().toString(36) + Math.random().toString(36).slice(2);
}

// Money is stored as whole cents (1999 instead of 19.99) to avoid rounding errors
function toCents(text) {
  return Math.round(parseFloat(text) * 100);
}

function centsToInput(cents) {
  return (cents / 100).toFixed(2);
}

function pad(n) {
  return String(n).padStart(2, "0");
}

// Stop typed text from being treated as HTML
function escapeHtml(text) {
  return String(text).replace(/[&<>"']/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c]));
}

// Read a colour defined in style.css, e.g. cssVar("--panel")
function cssVar(name) {
  return getComputedStyle(document.documentElement).getPropertyValue(name).trim();
}

// ---------- Dates ----------
// Dates are saved as "YYYY-MM-DD" text. Text in that format sorts in date order,
// so we can compare dates with < and >.

function dateString(d) {
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;
}

function todayString() {
  return dateString(new Date());
}

// "2026-10-06" becomes a Date (in local time, not UTC)
function parseDate(text) {
  const [year, month, day] = text.split("-").map(Number);
  return new Date(year, month - 1, day);
}

function addDays(date, n) {
  const d = parseDate(date);
  d.setDate(d.getDate() + n);
  return dateString(d);
}

function daysBetween(from, to) {
  return Math.round((parseDate(to) - parseDate(from)) / 86400000);
}

// A day in a month, moved earlier if the month is shorter (the 31st of September is the 30th)
function dayInMonth(year, monthIndex, day) {
  const lastDay = new Date(year, monthIndex + 1, 0).getDate();
  return dateString(new Date(year, monthIndex, Math.min(day, lastDay)));
}

// "6 Oct"
function shortDate(date) {
  return parseDate(date).toLocaleDateString(undefined, { day: "numeric", month: "short" });
}

// "Fri, 16 Oct"
function longDate(date) {
  return parseDate(date).toLocaleDateString(undefined, { weekday: "short", day: "numeric", month: "short" });
}

// "Today", "Yesterday" or something like "Mon, 6 Oct"
function dayLabel(date) {
  const today = todayString();
  if (date === today) return "Today";
  if (date === addDays(today, -1)) return "Yesterday";
  return longDate(date);
}

// How to say when something starts again: "tomorrow", "on Monday" or "on 3 Nov"
function resetText(date) {
  const days = daysBetween(todayString(), date);
  if (days === 1) return "tomorrow";
  if (days > 1 && days < 7) return `on ${parseDate(date).toLocaleDateString(undefined, { weekday: "long" })}`;
  return `on ${shortDate(date)}`;
}

// ---------- Periods ----------
// A period is { start, end }: start is its first day, end is the day AFTER its last day.
// A schedule says how periods repeat, e.g. { freq: "biweekly", anchor: "2026-10-02" }
// where anchor is any day a period starts on (like a pay day).

const CALENDAR_MONTH = { freq: "monthly", anchor: "2024-01-01" };

function periodContaining(date, schedule) {
  const { freq, anchor } = schedule;
  let start;
  if (freq === "daily") {
    start = date;
  } else if (freq === "weekly" || freq === "biweekly") {
    const length = freq === "weekly" ? 7 : 14;
    const periodsSinceAnchor = Math.floor(daysBetween(anchor, date) / length);
    start = addDays(anchor, periodsSinceAnchor * length);
  } else if (freq === "semimonthly") {
    start = date.slice(0, 8) + (Number(date.slice(8)) >= 15 ? "15" : "01");
  } else {
    // monthly: same day of the month as the anchor
    const d = parseDate(date);
    const anchorDay = Number(anchor.slice(8));
    start = dayInMonth(d.getFullYear(), d.getMonth(), anchorDay);
    if (start > date) start = dayInMonth(d.getFullYear(), d.getMonth() - 1, anchorDay);
  }
  return { start, end: nextPeriodStart(start, schedule) };
}

function nextPeriodStart(start, { freq, anchor }) {
  if (freq === "daily") return addDays(start, 1);
  if (freq === "weekly") return addDays(start, 7);
  if (freq === "biweekly") return addDays(start, 14);
  const d = parseDate(start);
  if (freq === "semimonthly") {
    return d.getDate() < 15 ? start.slice(0, 8) + "15" : dateString(new Date(d.getFullYear(), d.getMonth() + 1, 1));
  }
  return dayInMonth(d.getFullYear(), d.getMonth() + 1, Number(anchor.slice(8)));
}

function previousPeriod(period, schedule) {
  return periodContaining(addDays(period.start, -1), schedule);
}

function periodDays(period) {
  return daysBetween(period.start, period.end);
}

// "October 2026" for calendar months, otherwise "3 Oct – 16 Oct"
function periodLabel(period) {
  if (period.start.endsWith("-01") && period.end.endsWith("-01") && periodDays(period) >= 28) {
    return parseDate(period.start).toLocaleString(undefined, { month: "long", year: "numeric" });
  }
  const lastDay = addDays(period.end, -1);
  if (period.start === lastDay) return longDate(period.start);
  return `${shortDate(period.start)} – ${shortDate(lastDay)}`;
}

function hasPaySchedule() {
  return data.settings.pay.frequency !== "none";
}

function paySchedule() {
  return { freq: data.settings.pay.frequency, anchor: data.settings.pay.anchor };
}

// The periods the dashboard shows: pay periods, or calendar months
function viewSchedule() {
  return data.settings.cycle === "pay" && hasPaySchedule() ? paySchedule() : CALENDAR_MONTH;
}

// "pay period" or "month", for sentences like "this pay period"
function viewWord() {
  return viewSchedule() === CALENDAR_MONTH ? "month" : "pay period";
}

// How often a limit starts again
function limitSchedule(period) {
  if (period === "pay") return hasPaySchedule() ? paySchedule() : CALENDAR_MONTH;
  if (period === "daily") return { freq: "daily", anchor: WEEK_ANCHOR };
  if (period === "weekly") return { freq: "weekly", anchor: WEEK_ANCHOR };
  if (period === "biweekly") {
    // Line 2-weekly limits up with 2-weekly pay days, if that's how you're paid
    const pay = data.settings.pay;
    return { freq: "biweekly", anchor: pay.frequency === "biweekly" ? pay.anchor : WEEK_ANCHOR };
  }
  return CALENDAR_MONTH;
}

// "week", "month", "pay period"... ("pay period" means month if there's no pay schedule)
function limitPeriodWord(period) {
  if (period === "pay" && !hasPaySchedule()) return "month";
  return LIMIT_PERIODS[period]?.short ?? "month";
}

// ---------- Loading and saving ----------

function defaultPaySettings(categories) {
  return {
    frequency: "none",
    anchor: todayString(),
    amountCents: 0,
    categoryId: categories.find((c) => c.kind === "income")?.id ?? null,
    autoAdd: false,
    lastPaid: null, // the last pay day the app has dealt with
  };
}

function createDefaultData() {
  const categories = DEFAULT_CATEGORIES.map((c, i) => ({ id: newId(), color: CATEGORY_COLORS[i % CATEGORY_COLORS.length], ...c }));
  return {
    schemaVersion: SCHEMA_VERSION,
    settings: { currency: "USD", cycle: "month", pay: defaultPaySettings(categories) },
    categories,
    transactions: [],
    limits: [],
  };
}

// What a first-time visitor sees: a realistic example budget, clearly labelled,
// so the app shows what it does. "Clear examples" swaps it for an empty budget.
function createExampleData() {
  const d = createDefaultData();
  d.example = true;
  const categoryId = (name) => d.categories.find((c) => c.name === name).id;
  const today = todayString();
  const ago = (days) => addDays(today, -days);

  // Paid $1,600 every 2 weeks on Fridays. The latest pay day is the most recent Friday.
  const payday = ago((parseDate(today).getDay() + 2) % 7);
  d.settings.cycle = "pay";
  d.settings.pay = { frequency: "biweekly", anchor: payday, amountCents: 160000, categoryId: categoryId("Salary"), autoAdd: true, lastPaid: payday };
  d.limits = [
    { categoryId: categoryId("Groceries"), limitCents: 18000, period: "pay" },
    { categoryId: categoryId("Eating out"), limitCents: 4000, period: "weekly" },
    { categoryId: categoryId("Fun"), limitCents: 6000, period: "pay" },
    { categoryId: categoryId("Transport"), limitCents: 8000, period: "monthly" },
  ];

  const firstOfMonth = today.slice(0, 8) + "01";
  const firstOfLastMonth = addDays(firstOfMonth, -1).slice(0, 8) + "01";
  const rows = [
    [payday, "income", 1600, "Salary", "Pay day"],
    [addDays(payday, -14), "income", 1600, "Salary", "Pay day"],
    [addDays(payday, -28), "income", 1600, "Salary", "Pay day"],
    [firstOfMonth, "expense", 1100, "Rent", "Rent"],
    [firstOfLastMonth, "expense", 1100, "Rent", "Rent"],
    [ago(0), "expense", 4.5, "Eating out", "Coffee"],
    [ago(0), "expense", 19.8, "Eating out", "Dinner out"],
    [ago(0), "expense", 18.2, "Groceries", "Bread and fruit"],
    [ago(1), "expense", 23.9, "Eating out", "Team lunch"],
    [ago(1), "expense", 2.9, "Transport", "Bus"],
    [ago(2), "expense", 64.35, "Groceries", "Weekly shop"],
    [ago(2), "expense", 15.8, "Eating out", "Takeaway"],
    [ago(3), "expense", 42, "Fun", "Cinema"],
    [ago(4), "expense", 89.99, "Bills", "Phone and internet"],
    [ago(4), "expense", 2.9, "Transport", "Bus"],
    [ago(5), "expense", 4.5, "Eating out", "Coffee"],
    [ago(6), "expense", 71.2, "Groceries", "Weekly shop"],
    [ago(7), "expense", 24, "Fun", "Board game"],
    [ago(8), "expense", 4.5, "Eating out", "Coffee"],
    [ago(9), "expense", 58.4, "Groceries", "Weekly shop"],
    [ago(10), "expense", 120, "Bills", "Electricity"],
    [ago(11), "expense", 31, "Eating out", "Dinner out"],
    [ago(12), "expense", 35, "Transport", "Fuel"],
    [ago(13), "expense", 66.1, "Groceries", "Weekly shop"],
    [ago(15), "expense", 4.5, "Eating out", "Coffee"],
    [ago(16), "expense", 55, "Fun", "Concert tickets"],
    [ago(18), "expense", 62.75, "Groceries", "Weekly shop"],
    [ago(20), "expense", 27.5, "Eating out", "Brunch"],
    [ago(22), "expense", 35, "Transport", "Fuel"],
    [ago(25), "expense", 59.3, "Groceries", "Weekly shop"],
    [ago(27), "expense", 12, "Fun", "Museum"],
  ];
  d.transactions = rows
    .sort((a, b) => a[0].localeCompare(b[0]))
    .map(([date, type, amount, category, note]) => ({ id: newId(), type, amountCents: Math.round(amount * 100), date, categoryId: categoryId(category), note }));
  return d;
}

function isValidData(d) {
  return d && Array.isArray(d.categories) && Array.isArray(d.transactions) && (Array.isArray(d.budgets) || Array.isArray(d.limits));
}

// Upgrade data saved by older versions of the app to the newest shape
function migrate(d) {
  if (!d.schemaVersion || d.schemaVersion < 2) {
    // Version 2 added category icons and a currency setting
    for (const c of d.categories) {
      if (!c.icon) c.icon = DEFAULT_CATEGORIES.find((dc) => dc.name === c.name)?.icon ?? "🏷️";
    }
    d.settings = { currency: "USD", ...(d.settings || {}) };
    d.schemaVersion = 2;
  }

  if (d.schemaVersion < 3) {
    // Version 3: limits can reset daily, weekly, every 2 weeks, monthly or on pay day,
    // and there's a pay schedule. Old monthly budgets become monthly limits.
    const thisMonth = todayString().slice(0, 7);
    const latest = {};
    const oldBudgets = [...(d.budgets || [])].sort((a, b) => a.month.localeCompare(b.month));
    for (const b of oldBudgets) {
      if (b.month <= thisMonth) latest[b.categoryId] = b.limitCents;
    }
    d.limits = Object.entries(latest)
      .filter(([, cents]) => cents > 0)
      .map(([categoryId, limitCents]) => ({ categoryId, limitCents, period: "monthly" }));
    delete d.budgets;
    d.settings.pay = defaultPaySettings(d.categories);
    d.settings.cycle = "month";
    d.schemaVersion = 3;
  }

  if (!Array.isArray(d.limits)) d.limits = [];
  return d;
}

function loadData() {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (raw) {
      const parsed = JSON.parse(raw);
      if (isValidData(parsed)) return migrate(parsed);
    }
  } catch (err) {
    console.warn("Could not load saved data, starting fresh.", err);
  }
  return createExampleData();
}

// Save in this browser, and to your Claude account when the app runs on claude.ai
function saveData() {
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(data));
  } catch (err) {
    if (!cloud) showToast("Couldn't save. Your browser may be blocking storage.");
  }
  scheduleCloudSave();
}

// ---------- Saving to your Claude account ----------
// When this app is opened as a claude.ai page, your budget is also saved privately
// to your account (under data/users/<your id>/, which only you can read), so it
// follows you between devices. Opened as a plain file, it only uses this browser.
//
// The budget is split into documents: one for settings, categories and limits,
// and one per month of transactions. Only the documents that changed get written.

let cloud = null; // { root, months } once connected
let cloudSaved = {}; // the JSON last written for each document, to spot changes
let cloudTimer = null;
let cloudBusy = false;

function splitForCloud(d) {
  const { transactions, example, ...meta } = d;
  const byMonth = {};
  for (const t of transactions) (byMonth[t.date.slice(0, 7)] ??= []).push(t);
  const docs = { meta: JSON.stringify(meta) };
  for (const [month, list] of Object.entries(byMonth)) docs[month] = JSON.stringify({ transactions: list });
  return docs;
}

function scheduleCloudSave() {
  if (!cloud || data.example) return; // example data is never saved to your account
  clearTimeout(cloudTimer);
  cloudTimer = setTimeout(pushToCloud, 800); // wait for a pause, then save once
}

async function pushToCloud() {
  cloudTimer = null;
  if (!cloud || data.example) return;
  if (cloudBusy) {
    scheduleCloudSave();
    return;
  }
  cloudBusy = true;
  try {
    const docs = splitForCloud(data);
    for (const [key, json] of Object.entries(docs)) {
      if (cloudSaved[key] === json) continue;
      const ref = key === "meta" ? cloud.root : cloud.months.doc(key);
      await ref.set(JSON.parse(json));
      cloudSaved[key] = json;
    }
    // Months that no longer have any transactions
    for (const key of Object.keys(cloudSaved)) {
      if (key in docs) continue;
      await cloud.months.doc(key).delete();
      delete cloudSaved[key];
    }
  } catch (err) {
    if (err?.code === "invalid_argument" || err?.code === "revoked" || err?.code === "not_granted") {
      cloud = null; // this viewer can't save to an account here
      showToast("Your changes are saved in this browser only.");
    } else {
      showToast("Couldn't save to your account just now. Your changes are kept in this browser.");
    }
  } finally {
    cloudBusy = false;
    renderSyncStatus();
  }
}

async function connectCloud() {
  if (!window.claude?.use) return; // opened as a plain file
  const [db, user] = await Promise.all([claude.use("db"), claude.use("user")]);
  const uid = user ? await user.id() : null;
  if (!db || !uid) return;

  const root = db.doc(`data/users/${uid}/budget`);
  const months = root.collection("months");
  try {
    const [metaSnap, monthSnap] = await Promise.all([root.get(), months.get()]);
    cloud = { root, months };

    if (metaSnap.exists) {
      // Your account already has a budget: load it (it wins over this browser's copy)
      cloudSaved = { meta: JSON.stringify(metaSnap.data()) };
      const transactions = [];
      for (const doc of monthSnap.docs) {
        cloudSaved[doc.id] = JSON.stringify(doc.data());
        transactions.push(...(doc.data()?.transactions ?? []));
      }
      const loaded = JSON.parse(JSON.stringify({ ...metaSnap.data(), transactions })); // unfreeze
      if (isValidData(loaded)) {
        data = migrate(loaded);
        saveData();
        runPaydayCheck();
        showPeriodOf(todayString());
        render();
      }
    } else if (!data.example) {
      scheduleCloudSave(); // first visit with an account: upload this browser's budget
    }
  } catch (err) {
    cloud = null;
  }
  renderSyncStatus();
}

// If the page is closed while a save is waiting, save straight away
document.addEventListener("visibilitychange", () => {
  if (document.hidden && cloudTimer) {
    clearTimeout(cloudTimer);
    pushToCloud();
  }
});

function renderSyncStatus() {
  let text = "Your data is saved only in this browser. Export a backup every so often.";
  if (data.example) text = "This is example data and isn't saved anywhere. Clear the examples to start your own budget.";
  else if (cloud) text = "Saved privately to your Claude account, so it's there on any device where you're signed in. Only you can see it.";
  $("sync-status").textContent = text;
}

// ---------- App state ----------

let data = loadData();
let view = periodContaining(todayString(), viewSchedule()); // the period on screen
let editingId = null; // ID of the transaction being edited, or null when adding
let searchText = "";
let chart = null;
let theme = loadTheme(); // "auto", "light" or "dark"
let moneyFormatter;
let currencySymbol = "$";

// Is today inside the period on screen?
function isCurrentView() {
  const today = todayString();
  return view.start <= today && today < view.end;
}

// The day to measure limits on: today, or the nearest day of the period on screen
function referenceDate() {
  const today = todayString();
  if (isCurrentView()) return today;
  return view.end <= today ? addDays(view.end, -1) : view.start;
}

function showPeriodOf(date) {
  view = periodContaining(date, viewSchedule());
}

// ---------- Money formatting ----------

function updateCurrency() {
  moneyFormatter = new Intl.NumberFormat(undefined, { style: "currency", currency: data.settings.currency });
  currencySymbol = moneyFormatter.formatToParts(0).find((p) => p.type === "currency")?.value ?? "";
  $("amount-symbol").textContent = currencySymbol;
  $("limit-symbol").textContent = currencySymbol;
}

// Amounts are wrapped in two invisible marker characters. A watcher (see "Hide amounts"
// below) turns each marked amount into <span class="money">, so they can all be blurred.
const MONEY_START = "";
const MONEY_END = "";

function formatMoney(cents) {
  return MONEY_START + plainMoney(cents) + MONEY_END;
}

// The amount without markers, for places that aren't page text (like the chart's tooltip)
function plainMoney(cents) {
  return moneyFormatter.format(cents / 100);
}

// Smoothly count a number from its old value to its new one.
// These elements have class="money" themselves, so they use plain amounts.
function animateMoney(el, cents) {
  const from = Number(el.dataset.cents ?? 0);
  el.dataset.cents = cents;
  if (reduceMotion || from === cents) {
    el.textContent = plainMoney(cents);
    return;
  }
  const start = performance.now();
  const duration = 600;
  function step(now) {
    if (Number(el.dataset.cents) !== cents) return; // a newer animation took over
    const progress = Math.min(1, (now - start) / duration);
    const eased = 1 - Math.pow(1 - progress, 3);
    el.textContent = plainMoney(Math.round(from + (cents - from) * eased));
    if (progress < 1) requestAnimationFrame(step);
  }
  requestAnimationFrame(step);
}

// ---------- Questions we ask about the data ----------

function getCategory(id) {
  return data.categories.find((c) => c.id === id);
}

function transactionsBetween(start, end) {
  return data.transactions.filter((t) => t.date >= start && t.date < end);
}

// Total spent per category, e.g. { "<groceries id>": 12500 }
function spentByCategory(start, end) {
  const totals = {};
  for (const t of transactionsBetween(start, end)) {
    if (t.type === "expense") totals[t.categoryId] = (totals[t.categoryId] || 0) + t.amountCents;
  }
  return totals;
}

function periodTotals(period) {
  let income = 0;
  let spent = 0;
  for (const t of transactionsBetween(period.start, period.end)) {
    if (t.type === "income") income += t.amountCents;
    else spent += t.amountCents;
  }
  return { income, spent };
}

// ---------- Spending limits ----------
// Each limit looks like { categoryId, limitCents, period: "weekly" }

function getLimit(categoryId) {
  return data.limits.find((l) => l.categoryId === categoryId) ?? null;
}

function setLimit(categoryId, limitCents, period) {
  const existing = getLimit(categoryId);
  if (existing) Object.assign(existing, { limitCents, period });
  else data.limits.push({ categoryId, limitCents, period });
  saveData();
}

function removeLimit(categoryId) {
  data.limits = data.limits.filter((l) => l.categoryId !== categoryId);
  saveData();
}

// How a category is doing in the limit period that contains "date", or null if it has no limit
function budgetStatus(categoryId, date) {
  const limit = getLimit(categoryId);
  if (!limit) return null;
  const window = periodContaining(date, limitSchedule(limit.period));
  const spent = spentByCategory(window.start, window.end)[categoryId] || 0;
  const days = periodDays(window);
  const elapsed = Math.min(days, Math.max(0, daysBetween(window.start, todayString()) + 1));
  return {
    limit: limit.limitCents,
    period: limit.period,
    window,
    spent,
    left: limit.limitCents - spent,
    percent: (spent / limit.limitCents) * 100,
    over: spent > limit.limitCents,
    days,
    elapsed,
  };
}

// Every category that has gone over its limit
function overBudgetCategories(date) {
  return data.limits
    .map((l) => ({ category: getCategory(l.categoryId), status: budgetStatus(l.categoryId, date) }))
    .filter((item) => item.category && item.status && item.status.over);
}

// How much the limits add up to over a period. A $50 weekly limit is about $100 over 2 weeks.
function budgetedFor(period) {
  return data.limits.reduce((sum, l) => {
    const window = periodContaining(period.start, limitSchedule(l.period));
    return sum + Math.round((l.limitCents * periodDays(period)) / periodDays(window));
  }, 0);
}

// The message to show after saving an expense, with a warning if it went over its limit
function budgetMessage(t, normalMessage) {
  if (t.type !== "expense") return { message: normalMessage, warn: false };
  const s = budgetStatus(t.categoryId, t.date);
  const name = getCategory(t.categoryId)?.name ?? "This category";
  if (!s) return { message: normalMessage, warn: false };
  if (s.over) return { message: `⚠️ ${name} is now ${formatMoney(-s.left)} over its ${limitPeriodWord(s.period)} limit`, warn: true };
  if (s.left === 0) return { message: `You've reached your ${name} limit`, warn: false };
  if (s.percent >= 85) return { message: `Heads up: only ${formatMoney(s.left)} left for ${name}`, warn: false };
  return { message: `${normalMessage} · ${formatMoney(s.left)} left for ${name}`, warn: false };
}

// Save a new transaction, then show a message with an Undo button
function addTransaction(fields) {
  const t = { id: newId(), ...fields };
  data.transactions.push(t);
  saveData();
  showPeriodOf(t.date);
  render();

  const name = t.note || getCategory(t.categoryId)?.name || "transaction";
  const { message, warn } = budgetMessage(t, `Added ${name} · ${formatMoney(t.amountCents)}`);
  showToast(message, "Undo", () => {
    data.transactions = data.transactions.filter((x) => x.id !== t.id);
    saveData();
    render();
  }, warn);
}

// ---------- Pay day ----------

// If pay days have passed since the app last checked, start the new period
// and (if switched on) add the pay automatically. Returns the pay days found.
function checkPayday() {
  const pay = data.settings.pay;
  if (pay.frequency === "none") return [];

  const today = todayString();
  const latestPayday = periodContaining(today, paySchedule()).start;
  if (!pay.lastPaid || pay.lastPaid > latestPayday) {
    pay.lastPaid = latestPayday;
    saveData();
    return [];
  }
  if (pay.lastPaid === latestPayday) return [];

  // Every pay day after the last one we dealt with, up to today
  const paydays = [];
  let next = nextPeriodStart(periodContaining(pay.lastPaid, paySchedule()).start, paySchedule());
  while (next <= today && paydays.length < 400) {
    paydays.push(next);
    next = nextPeriodStart(next, paySchedule());
  }

  if (pay.autoAdd && pay.amountCents > 0 && getCategory(pay.categoryId)) {
    for (const date of paydays) {
      data.transactions.push({ id: newId(), type: "income", amountCents: pay.amountCents, date, categoryId: pay.categoryId, note: "Pay day" });
    }
  }
  pay.lastPaid = latestPayday;
  saveData();
  return paydays;
}

function runPaydayCheck() {
  const paydays = checkPayday();
  if (paydays.length === 0) return;
  const pay = data.settings.pay;
  const added = pay.autoAdd && pay.amountCents > 0 ? `Added ${formatMoney(pay.amountCents * paydays.length)}` : "";
  const reset = data.settings.cycle === "pay" ? "your budget has started fresh" : "";
  const details = [added, reset].filter(Boolean).join(" and ");
  showToast(`💰 It's pay day!${details ? ` ${details}.` : ""}`);
}

// Notice when the date changes while the app is open (e.g. left open overnight)
let lastSeenDay = todayString();
function checkForNewDay() {
  const today = todayString();
  if (today === lastSeenDay) return;
  const wasShowingToday = view.start <= lastSeenDay && lastSeenDay < view.end;
  lastSeenDay = today;
  runPaydayCheck();
  if (wasShowingToday) showPeriodOf(today); // move on to the new period
  render();
}
setInterval(checkForNewDay, 60 * 1000);
document.addEventListener("visibilitychange", () => {
  if (!document.hidden) checkForNewDay();
});

// ---------- Quick add: turn "12.50 groceries lunch" into a transaction ----------

function escapeRegex(text) {
  return text.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}

function capitalize(text) {
  return text ? text[0].toUpperCase() + text.slice(1) : text;
}

function parseQuickAdd(text) {
  let rest = text.trim();
  if (!rest) return null;

  // Starting with + means income, otherwise it's an expense
  let type = "expense";
  if (rest.startsWith("+")) {
    type = "income";
    rest = rest.slice(1).trim();
  }

  // 1. Find the amount: 12, 12.50 or 12,50 (a currency sign in front is fine)
  rest = rest.replace(/(\d),(\d{3})(?!\d)/g, "$1$2"); // "1,200" becomes "1200"
  let amountCents = 0;
  const amountMatch = rest.match(/(^|\s)[^\d\s]?(\d+(?:[.,]\d{1,2})?)(?=\s|$)/);
  if (amountMatch) {
    amountCents = toCents(amountMatch[2].replace(",", "."));
    rest = rest.slice(0, amountMatch.index) + " " + rest.slice(amountMatch.index + amountMatch[0].length);
  }
  rest = rest.replace(/\s+/g, " ").trim();

  // 2. Find the category. Longest names first, so "Eating out" wins over "Eat".
  const categories = data.categories
    .filter((c) => c.kind === type)
    .sort((a, b) => b.name.length - a.name.length);
  let category = null;

  // 2a. The full category name was typed, e.g. "eating out"
  for (const c of categories) {
    const pattern = new RegExp(`(^|\\s)${escapeRegex(c.name)}(?=\\s|$)`, "i");
    if (pattern.test(rest)) {
      category = c;
      rest = rest.replace(pattern, " ");
      break;
    }
  }

  // 2b. A word that starts a category name, e.g. "groc" or "eat"
  if (!category) {
    for (const word of rest.split(" ")) {
      if (word.length < 3) continue;
      const lowerWord = word.toLowerCase();
      category = categories.find((c) => c.name.toLowerCase().split(" ").some((part) => part.startsWith(lowerWord)));
      if (category) {
        rest = rest.replace(word, " ");
        break;
      }
    }
  }
  rest = rest.replace(/\s+/g, " ").trim();

  // 2c. You've used this note before, e.g. "weekly shop" was Groceries last time
  if (!category && rest) {
    const lowerRest = rest.toLowerCase();
    const past = [...data.transactions].reverse().find((t) => t.type === type && (t.note || "").toLowerCase() === lowerRest);
    if (past) category = getCategory(past.categoryId);
  }

  // 2d. Otherwise guess "Other"
  let guessed = false;
  if (!category) {
    guessed = true;
    category = categories.find((c) => c.name.toLowerCase().startsWith("other")) ?? categories[0];
  }

  return { type, amountCents, categoryId: category?.id, note: capitalize(rest), guessed };
}

// ---------- Suggestions ----------

// Extra tips for common kinds of spending, matched by category name
const CATEGORY_TIPS = [
  {
    match: /grocer|food|supermarket/i,
    tips: [
      "Plan meals for the week and shop with a list. Unplanned extras are where grocery budgets leak.",
      "Check the fridge and cupboards before you go, and plan meals around what's already there.",
      "Try store brands. They're often just as good and 20–30% cheaper.",
      "Don't shop hungry. It reliably makes the basket bigger.",
    ],
  },
  {
    match: /eat|restaurant|takeaway|takeout|dining|coffee|cafe/i,
    tips: [
      "Pick set 'treat' days for eating out instead of deciding meal by meal.",
      "Cook double portions so a ready lunch is the easy option.",
      "Delivery apps add fees and tips. Collecting or cooking saves the most.",
      "Make coffee at home on weekdays and keep cafés for the weekend.",
    ],
  },
  {
    match: /fun|entertain|hobby|game|going out/i,
    tips: [
      "Look for free things to do: parks, free museum days, community events.",
      "Agree a spending amount with friends before a night out.",
      "Wait 24 hours before buying tickets or extras you didn't plan.",
    ],
  },
  {
    match: /shop|cloth|amazon/i,
    tips: [
      "Use a 24-hour rule: leave things in the basket for a day before buying.",
      "Unsubscribe from shop emails and remove saved cards from shopping apps.",
      "Ask yourself: would I buy this at full price? If not, the sale isn't saving you money.",
    ],
  },
  {
    match: /transport|travel|fuel|petrol|gas|car|uber|taxi/i,
    tips: [
      "Check whether a weekly or monthly pass is cheaper than paying per trip.",
      "Combine errands into one trip.",
      "Compare fuel prices nearby. A few cents per litre adds up over a year.",
    ],
  },
  {
    match: /bill|utilit|electric|phone|internet|subscri/i,
    tips: [
      "List your subscriptions and cancel any you haven't used in the last month.",
      "Once a year, ask your providers for a better deal. Saying you're thinking of switching often works.",
      "Small habits (shorter showers, lights off, heating a degree lower) cut energy bills.",
    ],
  },
];

const GENERAL_TIPS = [
  "Check in on your spending once a week. Short, regular check-ins beat one big review.",
  "Use a 24-hour rule for anything you didn't plan to buy.",
  "Pay yourself first: move savings aside on pay day, before you start spending.",
  "Give every category a limit, even a rough one. You can adjust it later.",
];

function tipsFor(category) {
  return CATEGORY_TIPS.find((t) => t.match.test(category.name))?.tips ?? GENERAL_TIPS;
}

// Look at the spending and work out what's worth mentioning, most urgent first.
// Each suggestion has a short title and summary, and "details" shown when you click it.
function buildSuggestions() {
  const list = [];
  const today = todayString();
  const ref = referenceDate();
  const word = viewWord();

  // 1. Categories over their limit
  for (const { category: c, status: s } of overBudgetCategories(ref)) {
    const spare = data.limits
      .map((l) => ({ c: getCategory(l.categoryId), s: budgetStatus(l.categoryId, ref) }))
      .filter((x) => x.c && x.s && x.c.id !== c.id && x.s.left > 0)
      .sort((a, b) => b.s.left - a.s.left)[0];
    const biggest = transactionsBetween(s.window.start, s.window.end)
      .filter((t) => t.type === "expense" && t.categoryId === c.id)
      .sort((a, b) => b.amountCents - a.amountCents)
      .slice(0, 3);
    const stillRunning = s.window.end > today;

    list.push({
      id: `over-${c.id}`,
      tone: "bad",
      icon: "🚨",
      title: `${c.name} is ${formatMoney(-s.left)} over its limit`,
      summary: stillRunning ? `The limit resets ${resetText(s.window.end)}. Here's how to get back on track.` : "Here's what to change next time.",
      details: [
        stillRunning ? `Pause ${c.name.toLowerCase()} spending until ${longDate(s.window.end)} if you can.` : null,
        spare ? `${spare.c.name} still has ${formatMoney(spare.s.left)} left, so you could cover the difference from there.` : null,
        biggest.length ? `The biggest ${c.name.toLowerCase()} costs were ${biggest.map((t) => `${t.note || c.name} (${formatMoney(t.amountCents)})`).join(", ")}.` : null,
        ...tipsFor(c).slice(0, 2),
        `If you go over every ${limitPeriodWord(s.period)}, the limit may be unrealistic. Set one you can actually hit, then lower it bit by bit.`,
      ],
      action: { label: `Adjust ${c.name} limit`, run: () => openLimitEditor(c.id) },
    });
  }

  // 2. Nearly at a limit, or spending fast enough to go over
  for (const l of data.limits) {
    const c = getCategory(l.categoryId);
    const s = budgetStatus(l.categoryId, ref);
    if (!c || !s || s.over || !(s.window.start <= today && today < s.window.end)) continue;
    const daysLeft = daysBetween(today, s.window.end);
    const perDay = formatMoney(Math.floor(s.left / Math.max(1, daysLeft)));

    // Exactly used up usually means a fixed bill like rent, so there's nothing to advise
    if (s.left === 0) continue;

    if (s.percent >= 85) {
      list.push({
        id: `near-${c.id}`,
        tone: "warn",
        icon: "⏳",
        title: `Only ${formatMoney(s.left)} left for ${c.name}`,
        summary: `It resets ${resetText(s.window.end)}${s.left > 0 && daysLeft > 1 ? `. That's about ${perDay} a day until then` : ""}.`,
        details: [
          ...tipsFor(c).slice(0, 3),
          "When you add an expense, the category buttons show how much is left, so you can check before you buy.",
        ],
        action: { label: `See ${c.name} spending`, run: () => searchFor(c.name) },
      });
    } else if (s.elapsed >= 3 && s.spent > 0) {
      // Only predict from regular spending. One big payment (like a monthly pass) isn't a pace.
      const purchases = transactionsBetween(s.window.start, s.window.end).filter((t) => t.type === "expense" && t.categoryId === c.id).length;
      if (purchases < 3) continue;
      const projected = Math.round((s.spent / s.elapsed) * s.days);
      if (projected > s.limit * 1.1) {
        list.push({
          id: `pace-${c.id}`,
          tone: "warn",
          icon: "📈",
          title: `${c.name} is on track to go over`,
          summary: `At this rate you'll spend about ${formatMoney(projected)} this ${limitPeriodWord(s.period)}, against a ${formatMoney(s.limit)} limit.`,
          details: [
            `To stay under, keep ${c.name.toLowerCase()} to about ${perDay} a day for the next ${daysLeft} days.`,
            ...tipsFor(c).slice(0, 3),
          ],
          action: { label: `See ${c.name} spending`, run: () => searchFor(c.name) },
        });
      }
    }
  }

  // 3. The biggest category that has no limit
  const spentNow = spentByCategory(view.start, view.end);
  const noLimitId = Object.keys(spentNow)
    .filter((id) => !getLimit(id) && getCategory(id)?.kind === "expense")
    .sort((a, b) => spentNow[b] - spentNow[a])[0];
  if (noLimitId) {
    const c = getCategory(noLimitId);
    const before = previousPeriod(view, viewSchedule());
    const spentBefore = spentByCategory(before.start, before.end)[c.id] || 0;
    list.push({
      id: `nolimit-${c.id}`,
      tone: "info",
      icon: "🎯",
      title: `Put a limit on ${c.name}`,
      summary: `You've spent ${formatMoney(spentNow[noLimitId])} on ${c.name} this ${word} with no limit.`,
      details: [
        spentBefore
          ? `Last ${word} you spent ${formatMoney(spentBefore)}. A limit a little below that is a good place to start.`
          : `Start with roughly what you spend now, then lower it a little each ${word}.`,
        "A limit isn't a punishment. It warns you early when you're drifting, so you decide on purpose.",
        ...tipsFor(c).slice(0, 2),
      ],
      action: { label: `Set a ${c.name} limit`, run: () => openLimitEditor(c.id) },
    });
  }

  // 4. Spending up a lot compared with last period
  const now = periodTotals(view);
  const before = previousPeriod(view, viewSchedule());
  const then = periodTotals(before);
  const periodOver = view.end <= today;
  if (then.spent > 0 && now.spent > then.spent * 1.2 && (periodOver || now.spent > then.spent)) {
    const spentBefore = spentByCategory(before.start, before.end);
    const grewMost = Object.keys(spentNow)
      .map((id) => ({ id, diff: spentNow[id] - (spentBefore[id] || 0) }))
      .sort((a, b) => b.diff - a.diff)[0];
    const c = getCategory(grewMost?.id);
    const percentUp = Math.round(((now.spent - then.spent) / then.spent) * 100);
    list.push({
      id: "trend",
      tone: "warn",
      icon: "📊",
      title: `Spending is up ${percentUp}% on last ${word}`,
      summary: c ? `The biggest increase is ${c.name} (+${formatMoney(grewMost.diff)}).` : "Have a look at what changed.",
      details: [
        "One-off costs happen, like birthdays or repairs. If that's what this was, don't worry.",
        c ? `If it wasn't, look through your ${c.name} transactions and pick one thing to cut next ${word}.` : null,
        "A limit on the category that grew stops it creeping up again.",
      ],
      action: c ? { label: `See ${c.name} spending`, run: () => searchFor(c.name) } : null,
    });
  }

  // 5. Lots of small purchases in one category
  const smallLimit = 1500; // under 15.00
  const smallByCategory = {};
  for (const t of transactionsBetween(view.start, view.end)) {
    if (t.type !== "expense" || t.amountCents >= smallLimit) continue;
    smallByCategory[t.categoryId] ??= { count: 0, total: 0 };
    smallByCategory[t.categoryId].count += 1;
    smallByCategory[t.categoryId].total += t.amountCents;
  }
  const smallTop = Object.entries(smallByCategory).filter(([, v]) => v.count >= 5).sort((a, b) => b[1].total - a[1].total)[0];
  if (smallTop) {
    const c = getCategory(smallTop[0]);
    const { count, total } = smallTop[1];
    const yearly = Math.round((total / periodDays(view)) * 365);
    list.push({
      id: "small",
      tone: "info",
      icon: "☕",
      title: `Small ${c?.name ?? ""} buys are adding up`,
      summary: `${count} purchases under ${formatMoney(smallLimit)} came to ${formatMoney(total)} this ${word}.`,
      details: [
        `At this rate that's about ${formatMoney(yearly)} a year.`,
        "You don't have to cut them all. Try halving them and putting the difference into savings.",
        ...(c ? tipsFor(c).slice(0, 2) : []),
      ],
    });
  }

  // 6. How much of your income you're keeping
  if (now.income > 0) {
    const rate = Math.round(((now.income - now.spent) / now.income) * 100);
    if (rate < 10) {
      list.push({
        id: "savings-low",
        tone: rate < 0 ? "bad" : "warn",
        icon: "🏦",
        title: rate < 0 ? `You've spent more than you earned this ${word}` : `You're keeping ${rate}% of your income`,
        summary: "Aim to keep 10–20% if you can. Small steps work.",
        details: [
          "Try the 50/30/20 guide: about 50% on needs, 30% on wants, and 20% on savings or paying off debt.",
          "Pay yourself first: on pay day, move your savings out before you spend anything.",
          "Even a small automatic amount builds the habit. You can raise it later.",
          "Cutting one regular cost, like a subscription or a weekly takeaway, is often easier than lots of small changes.",
        ],
      });
    } else if (rate >= 20 && periodOver) {
      list.push({
        id: "savings-good",
        tone: "good",
        icon: "🌟",
        title: `Great work: you kept ${rate}% of your income`,
        summary: "Here's how to make the most of it.",
        details: [
          "Build an emergency fund that covers 3–6 months of essential costs.",
          "Give your savings a job (a holiday, a deposit) so it's easier to leave them alone.",
          "Keep savings somewhere separate from your everyday account, ideally earning interest.",
        ],
      });
    }
  }

  // 7. No pay schedule yet
  if (!hasPaySchedule()) {
    list.push({
      id: "payday",
      tone: "info",
      icon: "💰",
      title: "Set up your pay day",
      summary: "Your budget can start fresh every time you get paid.",
      details: [
        "If you're paid every 2 weeks, budgeting per pay period matches how your money actually arrives.",
        "You'll see how many days are left until pay day, and how much you can spend each day until then.",
        "You can have your pay added automatically, so you never forget to log it.",
        "Each limit can still be weekly or monthly if that suits a category better.",
      ],
      action: { label: "Set up pay day", run: () => openPayEditor() },
    });
  }

  // Nothing urgent? Share some good habits instead.
  if (!list.some((s) => s.tone === "bad" || s.tone === "warn")) {
    list.push({
      id: "habits",
      tone: "good",
      icon: "✅",
      title: "You're on track",
      summary: "Nothing needs attention right now. These habits help keep it that way.",
      details: GENERAL_TIPS,
    });
  }

  const order = { bad: 0, warn: 1, info: 2, good: 3 };
  return list.sort((a, b) => order[a.tone] - order[b.tone]);
}

// Filter the transactions list, e.g. to show only Groceries
function searchFor(text) {
  $("search").value = text;
  searchText = text;
  renderTransactions();
  $("transactions-panel").scrollIntoView({ behavior: reduceMotion ? "auto" : "smooth", block: "start" });
}

// ---------- Drawing the page ----------

function render() {
  $("period-label").textContent = periodLabel(view);
  $("example-banner").hidden = !data.example;
  renderSyncStatus();
  renderHero();
  renderQuickPreview();
  renderRecent();
  renderTransactions();
  renderSuggestions();
  renderChart();
  renderBudgets();
  renderInsights();
}

function renderHero() {
  const { income, spent } = periodTotals(view);
  const budgeted = budgetedFor(view);
  const word = viewWord();
  const today = todayString();
  const daysLeft = isCurrentView() ? daysBetween(today, view.end) : 0;
  const untilWhen = word === "pay period" ? "until pay day" : "left this month";
  let progress = 0;
  let over = false;

  if (budgeted > 0) {
    const left = budgeted - spent;
    over = left < 0;
    $("hero-label").textContent = over ? "Over budget by" : "Left to spend";
    animateMoney($("hero-value"), Math.abs(left));

    let sub = `${formatMoney(spent)} of ${formatMoney(budgeted)} budgeted`;
    if (daysLeft > 0 && left > 0) {
      sub += ` · ${formatMoney(Math.floor(left / daysLeft))} a day for ${daysLeft} day${daysLeft === 1 ? "" : "s"} ${untilWhen}`;
    }
    $("hero-sub").textContent = sub;
    progress = Math.min(100, (spent / budgeted) * 100);
  } else {
    $("hero-label").textContent = word === "pay period" ? "Left until pay day" : "Left over this month";
    animateMoney($("hero-value"), income - spent);
    $("hero-sub").textContent = "Set spending limits to see what's left to spend.";
  }

  // Pay day badge
  const payChip = $("hero-payday");
  payChip.classList.remove("is-payday");
  if (hasPaySchedule()) {
    const current = periodContaining(today, paySchedule());
    const daysToPay = daysBetween(today, current.end);
    if (current.start === today) {
      payChip.textContent = "💰 It's pay day!";
      payChip.classList.add("is-payday");
    } else {
      payChip.textContent = `💰 Pay day ${daysToPay === 1 ? "tomorrow" : `in ${daysToPay} days`} · ${longDate(current.end)}`;
    }
  } else {
    payChip.textContent = "💰 Set your pay day";
  }

  // Warning badge when one or more categories are over their limit
  const overList = overBudgetCategories(referenceDate());
  $("hero-alert").hidden = overList.length === 0;
  if (overList.length === 1) {
    $("hero-alert").textContent = `⚠️ ${overList[0].category.name} is over its limit`;
  } else if (overList.length > 1) {
    $("hero-alert").textContent = `⚠️ ${overList.length} over limit: ${overList.map((o) => o.category.name).join(", ")}`;
  }

  $("hero").classList.toggle("is-over", over);
  $("hero-progress").style.width = `${progress}%`;
  animateMoney($("stat-income"), income);
  animateMoney($("stat-spent"), spent);
  animateMoney($("stat-budgeted"), budgeted);
}

function renderTransactions() {
  const inView = transactionsBetween(view.start, view.end);
  const query = searchText.trim().toLowerCase();

  // Newest first. Reversing first keeps the newest entry on top within the same day.
  const list = [...inView].reverse()
    .filter((t) => {
      if (!query) return true;
      const categoryName = getCategory(t.categoryId)?.name ?? "";
      return (t.note || "").toLowerCase().includes(query) || categoryName.toLowerCase().includes(query);
    })
    .sort((a, b) => b.date.localeCompare(a.date));

  if (list.length === 0) {
    $("transaction-list").innerHTML = "";
    $("list-empty").hidden = false;
    if (inView.length === 0) {
      $("empty-title").textContent = isCurrentView() ? `Nothing yet this ${viewWord()}` : `No transactions for ${periodLabel(view)}`;
      $("empty-text").textContent = "Add your income and spending to see where your money goes.";
      $("empty-add").hidden = false;
    } else {
      $("empty-title").textContent = `No matches for "${searchText.trim()}"`;
      $("empty-text").textContent = "Try a different word.";
      $("empty-add").hidden = true;
    }
    return;
  }
  $("list-empty").hidden = true;

  // Group transactions by day
  const days = new Map();
  for (const t of list) {
    if (!days.has(t.date)) days.set(t.date, []);
    days.get(t.date).push(t);
  }

  // Over-limit categories, and the dates their limit covers, so those transactions get a red dot
  const overWindows = new Map(overBudgetCategories(referenceDate()).map((o) => [o.category.id, o.status.window]));

  $("transaction-list").innerHTML = [...days].map(([date, items]) => {
    const dayTotal = items.reduce((sum, t) => sum + (t.type === "income" ? t.amountCents : -t.amountCents), 0);
    return `
      <div class="day-group">
        <div class="day-head">
          <span>${escapeHtml(dayLabel(date))}</span>
          <span class="day-total">${dayTotal < 0 ? "−" : "+"}${formatMoney(Math.abs(dayTotal))}</span>
        </div>
        <ul class="tx-list">${items.map((t) => transactionRow(t, overWindows)).join("")}</ul>
      </div>`;
  }).join("");
}

function transactionRow(t, overWindows) {
  const category = getCategory(t.categoryId);
  const categoryName = category?.name ?? "Unknown";
  const title = t.note || categoryName;
  const subtitle = t.note ? categoryName : (t.type === "income" ? "Income" : "Expense");
  const sign = t.type === "expense" ? "−" : "+";
  const window = t.type === "expense" ? overWindows.get(t.categoryId) : null;
  const flagged = window && t.date >= window.start && t.date < window.end;
  return `
    <li>
      <button class="tx-row" data-id="${escapeHtml(t.id)}" style="--c:${escapeHtml(category?.color ?? "#64748b")}">
        <span class="icon-tile ${flagged ? "flag" : ""}" ${flagged ? `title="${escapeHtml(categoryName)} is over its limit"` : ""}>${escapeHtml(category?.icon ?? "🏷️")}</span>
        <span class="tx-text">
          <span class="tx-title">${escapeHtml(title)}</span>
          <span class="tx-sub">${escapeHtml(subtitle)}</span>
        </span>
        <span class="tx-amount ${t.type}">${sign}${formatMoney(t.amountCents)}</span>
      </button>
    </li>`;
}

// Suggestions are <details> elements: click the title to open more advice
let suggestionActions = [];
let showAllSuggestions = false;

function renderSuggestions() {
  const all = buildSuggestions();
  const visible = showAllSuggestions ? all : all.slice(0, 3);

  // Remember which ones were open, so redrawing doesn't close them
  const openIds = new Set([...document.querySelectorAll("#suggestions details[open]")].map((d) => d.dataset.id));
  suggestionActions = visible.map((s) => s.action?.run);

  $("suggestions").innerHTML = visible.map((s, i) => `
    <details class="suggestion ${s.tone}" data-id="${escapeHtml(s.id)}" ${openIds.has(s.id) ? "open" : ""}>
      <summary>
        <span class="suggestion-icon" aria-hidden="true">${s.icon}</span>
        <span>
          <span class="suggestion-title">${escapeHtml(s.title)}</span>
          <span class="suggestion-summary">${escapeHtml(s.summary)}</span>
        </span>
        ${CHEVRON}
      </summary>
      <div class="suggestion-body">
        <ul>${s.details.filter(Boolean).map((d) => `<li>${escapeHtml(d)}</li>`).join("")}</ul>
        ${s.action ? `<button type="button" class="btn primary small" data-action="${i}">${escapeHtml(s.action.label)}</button>` : ""}
      </div>
    </details>`).join("");

  $("suggestions-more").hidden = all.length <= 3;
  $("suggestions-more").textContent = showAllSuggestions ? "Show fewer" : `Show ${all.length - 3} more`;
}

function renderChart() {
  const spent = spentByCategory(view.start, view.end);
  const ids = Object.keys(spent).sort((a, b) => spent[b] - spent[a]);
  const total = ids.reduce((sum, id) => sum + spent[id], 0);
  const empty = ids.length === 0;

  $("chart-area").hidden = empty;
  $("chart-empty").hidden = !empty;
  if (empty) return;

  animateMoney($("chart-total"), total);
  $("chart-legend").innerHTML = ids.map((id) => {
    const c = getCategory(id);
    const percent = Math.round((spent[id] / total) * 100);
    return `
      <li style="--c:${escapeHtml(c?.color ?? "#64748b")}">
        <span class="dot"></span>
        <span class="legend-name">${escapeHtml(c?.icon ?? "")} ${escapeHtml(c?.name ?? "Unknown")}</span>
        <span class="legend-pct">${percent}%</span>
        <span class="legend-amount">${formatMoney(spent[id])}</span>
      </li>`;
  }).join("");

  // Chart.js loads from the internet; if it didn't load, just show the list
  if (typeof Chart === "undefined") {
    document.querySelector(".chart-wrap").hidden = true;
    return;
  }

  const labels = ids.map((id) => getCategory(id)?.name ?? "Unknown");
  const dataset = {
    data: ids.map((id) => spent[id]),
    backgroundColor: ids.map((id) => getCategory(id)?.color ?? "#64748b"),
    borderColor: cssVar("--panel"),
    borderWidth: 3,
    borderRadius: 6,
    hoverOffset: 6,
  };

  if (chart) {
    // Update the existing chart so it animates to the new numbers
    chart.data.labels = labels;
    Object.assign(chart.data.datasets[0], dataset);
    chart.update();
    return;
  }

  chart = new Chart($("spending-chart"), {
    type: "doughnut",
    data: { labels, datasets: [dataset] },
    options: {
      cutout: "74%",
      maintainAspectRatio: false,
      layout: { padding: 8 },
      animation: reduceMotion ? false : { duration: 700 },
      plugins: {
        legend: { display: false },
        tooltip: { callbacks: { label: (ctx) => (privacyOn ? " Amount hidden" : ` ${plainMoney(ctx.raw)}`) } },
      },
    },
  });
}

function renderBudgets() {
  const list = $("budget-list");
  const ref = referenceDate();
  const today = todayString();

  // Remember how wide each bar was, so the new bars can slide from there
  const oldWidths = {};
  list.querySelectorAll(".bar-fill").forEach((el) => { oldWidths[el.dataset.id] = el.style.width; });

  // Fullest first, so problems are at the top
  const rows = data.limits
    .map((l) => ({ c: getCategory(l.categoryId), s: budgetStatus(l.categoryId, ref) }))
    .filter((row) => row.c && row.s)
    .sort((a, b) => b.s.percent - a.s.percent);

  $("budget-empty").hidden = rows.length > 0;

  list.innerHTML = rows.map(({ c, s }) => {
    const near = !s.over && s.percent >= 85;
    const tone = s.over ? "over" : near ? "warn" : "";

    let badge = `<span class="pill">${formatMoney(s.left)} left</span>`;
    if (s.over) badge = `<span class="pill bad">⚠️ Over by ${formatMoney(-s.left)}</span>`;
    else if (s.left === 0) badge = `<span class="pill warn">Limit reached</span>`;
    else if (near) badge = `<span class="pill warn">Only ${formatMoney(s.left)} left</span>`;

    const when = s.window.end <= today ? `Ended ${shortDate(addDays(s.window.end, -1))}` : `Resets ${resetText(s.window.end)}`;

    return `
      <button type="button" class="budget-row ${s.over ? "is-over" : ""}" data-category-id="${escapeHtml(c.id)}"
        style="--c:${escapeHtml(c.color)}" title="Change the ${escapeHtml(c.name)} limit">
        <span class="icon-tile">${escapeHtml(c.icon)}</span>
        <span class="budget-body">
          <span class="budget-top">
            <span class="budget-name">${escapeHtml(c.name)}</span>
            ${badge}
          </span>
          <span class="bar">
            <span class="bar-fill ${tone}" data-id="${escapeHtml(c.id)}" data-width="${Math.min(100, s.percent)}%" style="width:${oldWidths[c.id] ?? "0%"}"></span>
          </span>
          <span class="budget-meta">
            <span>${formatMoney(s.spent)} of ${formatMoney(s.limit)} a ${escapeHtml(limitPeriodWord(s.period))}</span>
            <span>${escapeHtml(when)}</span>
          </span>
        </span>
      </button>`;
  }).join("");

  // Spending in categories that don't have a limit
  const spent = spentByCategory(view.start, view.end);
  const unbudgeted = data.categories
    .filter((c) => c.kind === "expense" && !getLimit(c.id))
    .reduce((sum, c) => sum + (spent[c.id] || 0), 0);
  $("unbudgeted").hidden = unbudgeted === 0 || rows.length === 0;
  $("unbudgeted").textContent = `Plus ${formatMoney(unbudgeted)} spent this ${viewWord()} in categories without a limit.`;

  void list.offsetWidth; // make the browser draw the old widths first, so the change animates
  list.querySelectorAll(".bar-fill").forEach((el) => { el.style.width = el.dataset.width; });
}

function renderInsights() {
  const now = periodTotals(view);
  const previous = previousPeriod(view, viewSchedule());
  const then = periodTotals(previous);
  const today = todayString();
  const items = [];

  // Average spending per day so far
  let daysCounted = 0;
  if (isCurrentView()) daysCounted = daysBetween(view.start, today) + 1;
  else if (view.end <= today) daysCounted = periodDays(view);
  if (now.spent > 0 && daysCounted > 0) {
    items.push({ icon: "📅", label: "Daily average", value: formatMoney(Math.round(now.spent / daysCounted)) });
  }

  // The category with the most spending
  const spent = spentByCategory(view.start, view.end);
  const topId = Object.keys(spent).sort((a, b) => spent[b] - spent[a])[0];
  if (topId) {
    const c = getCategory(topId);
    items.push({ icon: c?.icon ?? "🏷️", label: "Biggest category", value: `${c?.name ?? "Unknown"} · ${formatMoney(spent[topId])}` });
  }

  // Compared with the period before
  if (now.spent > 0 && then.spent > 0) {
    const change = Math.round(((now.spent - then.spent) / then.spent) * 100);
    items.push({
      icon: change > 0 ? "📈" : "📉",
      label: `Spending vs ${periodLabel(previous)}`,
      value: `${change > 0 ? "+" : ""}${change}%`,
      tone: change > 0 ? "bad" : "good",
    });
  }

  // How much of your income you kept
  if (now.income > 0) {
    const rate = Math.round(((now.income - now.spent) / now.income) * 100);
    items.push({ icon: "🏦", label: "Kept from income", value: `${rate}%`, tone: rate >= 0 ? "good" : "bad" });
  }

  $("insights").innerHTML = items.length
    ? items.map((i) => `
        <li>
          <span class="insight-icon">${escapeHtml(i.icon)}</span>
          <span>
            <span class="insight-label">${escapeHtml(i.label)}</span>
            <span class="insight-value ${i.tone ?? ""}">${escapeHtml(i.value)}</span>
          </span>
        </li>`).join("")
    : `<li class="hint">Add a few transactions to see insights.</li>`;
}

// ---------- Toast (little message at the bottom) ----------

let toastTimer;

// warn = true makes the toast red, for over-limit warnings
function showToast(message, actionLabel, onAction, warn = false) {
  const toast = $("toast");
  toast.classList.toggle("warn", warn);
  $("toast-text").textContent = message;
  $("toast-action").hidden = !actionLabel;
  $("toast-action").textContent = actionLabel || "";
  $("toast-action").onclick = () => {
    hideToast();
    if (onAction) onAction();
  };

  // A "popover" sits above everything, even pop-up windows
  if (toast.showPopover && !toast.matches(":popover-open")) toast.showPopover();
  void toast.offsetWidth; // let it draw once, so it can slide in
  toast.classList.add("show");

  clearTimeout(toastTimer);
  toastTimer = setTimeout(hideToast, warn ? 7000 : 5000);
}

function hideToast() {
  const toast = $("toast");
  toast.classList.remove("show");
  clearTimeout(toastTimer);
  toastTimer = setTimeout(() => {
    if (toast.hidePopover && toast.matches(":popover-open")) toast.hidePopover();
  }, 250);
}

// ---------- Add / edit transaction pop-up ----------

function selectedType() {
  return document.querySelector('input[name="tx-type"]:checked').value;
}

// Show the category chips for the chosen type (expense or income).
// Expense chips also show how much of the limit is left.
function renderCategoryChips(selectedId) {
  const type = selectedType();
  const date = $("tx-date").value || todayString();
  const categories = data.categories.filter((c) => c.kind === type);
  if (!categories.some((c) => c.id === selectedId)) selectedId = categories[0]?.id;

  $("tx-category").innerHTML = categories.map((c) => {
    const s = type === "expense" ? budgetStatus(c.id, date) : null;
    let meta = "";
    if (s && s.over) meta = `<span class="chip-meta bad">over</span>`;
    else if (s) meta = `<span class="chip-meta">${formatMoney(s.left)} left</span>`;
    return `
      <input class="visually-hidden" type="radio" name="tx-category" id="cat-${escapeHtml(c.id)}" value="${escapeHtml(c.id)}" ${c.id === selectedId ? "checked" : ""}>
      <label class="chip" for="cat-${escapeHtml(c.id)}" style="--c:${escapeHtml(c.color)}">
        <span>${escapeHtml(c.icon)}</span>${escapeHtml(c.name)}${meta}
      </label>`;
  }).join("");
}

// Open the pop-up. Pass an id to edit, or "prefill" values from quick add.
function openEditor(id = null, prefill = null) {
  const t = id ? data.transactions.find((x) => x.id === id) : prefill;
  editingId = id && t ? id : null;

  $("transaction-form").reset();
  document.querySelector(`input[name="tx-type"][value="${t ? t.type : "expense"}"]`).checked = true;
  $("tx-date").value = t?.date ?? (isCurrentView() ? todayString() : view.start);
  renderCategoryChips(t?.categoryId);
  $("tx-amount").value = t?.amountCents ? centsToInput(t.amountCents) : "";
  $("tx-note").value = t?.note ?? "";

  $("form-title").textContent = editingId ? "Edit transaction" : "New transaction";
  $("tx-submit").textContent = editingId ? "Save changes" : "Add transaction";
  $("tx-delete").hidden = !editingId;

  $("tx-dialog").showModal();
  $("tx-amount").focus();
}

$("transaction-form").addEventListener("change", (event) => {
  if (event.target.name === "tx-type") renderCategoryChips();
  // A different date can fall in a different limit period, so refresh the "left" amounts
  if (event.target.id === "tx-date") renderCategoryChips(document.querySelector('input[name="tx-category"]:checked')?.value);
});

$("transaction-form").addEventListener("submit", (event) => {
  event.preventDefault(); // stop the page from reloading

  const amountCents = toCents($("tx-amount").value);
  const categoryId = document.querySelector('input[name="tx-category"]:checked')?.value;
  if (!(amountCents > 0)) {
    showToast("Enter an amount above zero.");
    $("tx-amount").focus();
    return;
  }
  if (!categoryId) {
    showToast("Pick a category first. You can add one in Settings.");
    return;
  }

  const fields = {
    type: selectedType(),
    amountCents,
    date: $("tx-date").value,
    categoryId,
    note: $("tx-note").value.trim(),
  };

  $("tx-dialog").close();
  $("quick-input").value = ""; // in case this came from quick add's "More" button

  if (!editingId) {
    addTransaction(fields);
    return;
  }

  const t = data.transactions.find((x) => x.id === editingId);
  Object.assign(t, fields);
  saveData();
  showPeriodOf(fields.date);
  render();
  const { message, warn } = budgetMessage(t, "Changes saved");
  showToast(message, null, null, warn);
});

$("tx-delete").addEventListener("click", () => {
  const index = data.transactions.findIndex((t) => t.id === editingId);
  if (index === -1) return;
  const [removed] = data.transactions.splice(index, 1);
  saveData();
  $("tx-dialog").close();
  render();

  showToast("Transaction deleted", "Undo", () => {
    data.transactions.splice(index, 0, removed);
    saveData();
    render();
  });
});

// Clicking a transaction opens it for editing
$("transaction-list").addEventListener("click", (event) => {
  const row = event.target.closest(".tx-row");
  if (row) openEditor(row.dataset.id);
});

$("add-btn").addEventListener("click", () => openEditor());
$("empty-add").addEventListener("click", () => openEditor());

// Keyboard shortcuts: N opens the full form, / jumps to quick add
document.addEventListener("keydown", (event) => {
  if (event.ctrlKey || event.metaKey || event.altKey) return;
  if (document.querySelector("dialog[open]")) return;
  if (event.target.closest("input, textarea, select")) return;
  const key = event.key.toLowerCase();
  if (key === "n") {
    event.preventDefault();
    openEditor();
  } else if (key === "/") {
    event.preventDefault();
    $("quick-input").focus();
  } else if (key === "h") {
    event.preventDefault();
    togglePrivacy();
  }
});

// ---------- Hide amounts (the eye button) ----------

const PRIVACY_KEY = "budget-app-privacy";
const EYE_OPEN = '<svg viewBox="0 0 24 24" width="20" height="20" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M2 12s3.5-7 10-7 10 7 10 7-3.5 7-10 7S2 12 2 12z"/><circle cx="12" cy="12" r="3"/></svg>';
const EYE_CLOSED = '<svg viewBox="0 0 24 24" width="20" height="20" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M17.9 17.9A10 10 0 0 1 12 19c-6.5 0-10-7-10-7a18.5 18.5 0 0 1 5.1-5.9M9.9 4.2A9 9 0 0 1 12 4c6.5 0 10 7 10 7a18.5 18.5 0 0 1-2.2 3.2M14.1 14.1a3 3 0 1 1-4.2-4.2M1 1l22 22"/></svg>';

// The <head> script already applied the saved setting before the page drew
let privacyOn = document.documentElement.classList.contains("privacy");

function applyPrivacy() {
  document.documentElement.classList.toggle("privacy", privacyOn);
  const label = privacyOn ? "Show amounts (H)" : "Hide amounts (H)";
  $("privacy-btn").innerHTML = privacyOn ? EYE_CLOSED : EYE_OPEN;
  $("privacy-btn").title = label;
  $("privacy-btn").setAttribute("aria-label", label);
  $("privacy-btn").setAttribute("aria-pressed", String(privacyOn));
}

function togglePrivacy() {
  privacyOn = !privacyOn;
  try {
    if (privacyOn) localStorage.setItem(PRIVACY_KEY, "on");
    else localStorage.removeItem(PRIVACY_KEY);
  } catch (err) {}
  applyPrivacy();
  showToast(privacyOn ? "Amounts hidden" : "Amounts shown");
}

$("privacy-btn").addEventListener("click", togglePrivacy);

// Turn every marked amount in the page text into <span class="money">
function wrapMoney(root) {
  if (!root) return;
  const walker = document.createTreeWalker(root, NodeFilter.SHOW_TEXT);
  const found = [];
  while (walker.nextNode()) {
    if (walker.currentNode.nodeValue.includes(MONEY_START)) found.push(walker.currentNode);
  }
  for (const node of found) {
    // Splitting on the markers gives: text, amount, text, amount, text...
    const parts = node.nodeValue.split(/[]/);
    const pieces = document.createDocumentFragment();
    parts.forEach((part, i) => {
      if (i % 2 === 0) {
        if (part) pieces.append(part);
      } else {
        const span = document.createElement("span");
        span.className = "money";
        span.textContent = part;
        pieces.append(span);
      }
    });
    node.replaceWith(pieces);
  }
}

// Watch the page: whenever new text appears, wrap any amounts in it
new MutationObserver((changes) => {
  for (const change of changes) {
    wrapMoney(change.type === "characterData" ? change.target.parentNode : change.target);
  }
}).observe(document.body, { childList: true, characterData: true, subtree: true });

// Close pop-ups with their X / Cancel buttons, or by clicking the dark area around them
document.querySelectorAll("[data-close]").forEach((button) => {
  button.addEventListener("click", () => button.closest("dialog").close());
});
document.querySelectorAll("dialog").forEach((dialog) => {
  dialog.addEventListener("click", (event) => {
    if (event.target === dialog) dialog.close();
  });
});

// ---------- Quick add ----------

// Show what will be added as you type, e.g. "−$12.50 · 🛒 Groceries · Lunch"
function renderQuickPreview() {
  const box = $("quick-preview");
  const parsed = parseQuickAdd($("quick-input").value);

  if (!parsed) {
    box.innerHTML = `<span>Type an amount and a few words, then press Enter. Start with <b>+</b> for income.</span>`;
    return;
  }
  if (!parsed.amountCents) {
    box.innerHTML = `<span>Add an amount, like <b>12.50</b></span>`;
    return;
  }

  const c = getCategory(parsed.categoryId);
  const sign = parsed.type === "income" ? "+" : "−";
  let html = `
    <span class="preview-amount ${parsed.type}">${sign}${formatMoney(parsed.amountCents)}</span>
    <span class="cat-chip" style="--c:${escapeHtml(c?.color ?? "#64748b")}">${escapeHtml(c?.icon ?? "🏷️")} ${escapeHtml(c?.name ?? "No category")}</span>`;
  if (parsed.note) html += `<span class="preview-note">${escapeHtml(parsed.note)}</span>`;
  if (parsed.guessed) html += `<span>· type a category name to change it</span>`;

  // Warn before adding if this would go over the limit
  if (parsed.type === "expense") {
    const s = budgetStatus(parsed.categoryId, todayString());
    if (s) {
      const leftAfter = s.left - parsed.amountCents;
      html += leftAfter < 0
        ? `<span class="pill bad">⚠️ Puts ${escapeHtml(c.name)} ${formatMoney(-leftAfter)} over</span>`
        : `<span class="pill">${formatMoney(leftAfter)} left this ${escapeHtml(limitPeriodWord(s.period))} after this</span>`;
    }
  }
  box.innerHTML = html;
}

// One-tap buttons for things you've bought recently
function renderRecent() {
  const seen = new Set();
  const recent = [];
  const newestFirst = [...data.transactions].reverse()
    .filter((t) => t.type === "expense")
    .sort((a, b) => b.date.localeCompare(a.date));

  for (const t of newestFirst) {
    const key = `${t.categoryId}|${(t.note || "").toLowerCase()}|${t.amountCents}`;
    if (seen.has(key)) continue;
    seen.add(key);
    recent.push(t);
    if (recent.length === 6) break;
  }

  $("recent-wrap").hidden = recent.length === 0;
  $("recent-chips").innerHTML = recent.map((t) => {
    const c = getCategory(t.categoryId);
    return `
      <button type="button" class="chip" data-id="${escapeHtml(t.id)}" style="--c:${escapeHtml(c?.color ?? "#64748b")}"
        title="Add this again for today">
        <span>${escapeHtml(c?.icon ?? "🏷️")}</span>${escapeHtml(t.note || c?.name || "Expense")}
        <span class="chip-meta">${formatMoney(t.amountCents)}</span>
      </button>`;
  }).join("");
}

$("quick-input").addEventListener("input", renderQuickPreview);

$("quick-form").addEventListener("submit", (event) => {
  event.preventDefault();
  const parsed = parseQuickAdd($("quick-input").value);
  if (!parsed || !parsed.amountCents) {
    showToast("Start with an amount, like 12.50 lunch");
    return;
  }
  if (!parsed.categoryId) {
    showToast("Add a category in Settings first.");
    return;
  }
  addTransaction({
    type: parsed.type,
    amountCents: parsed.amountCents,
    date: todayString(),
    categoryId: parsed.categoryId,
    note: parsed.note,
  });
  $("quick-input").value = "";
  renderQuickPreview();
});

// "More" opens the full form with whatever you've typed so far
$("quick-details").addEventListener("click", () => {
  openEditor(null, parseQuickAdd($("quick-input").value));
});

$("recent-chips").addEventListener("click", (event) => {
  const chip = event.target.closest("[data-id]");
  const t = chip && data.transactions.find((x) => x.id === chip.dataset.id);
  if (!t) return;
  addTransaction({ type: t.type, amountCents: t.amountCents, date: todayString(), categoryId: t.categoryId, note: t.note || "" });
});

// ---------- Suggestions: buttons inside the advice ----------

$("suggestions").addEventListener("click", (event) => {
  const button = event.target.closest("[data-action]");
  if (button) suggestionActions[Number(button.dataset.action)]?.();
});

$("suggestions-more").addEventListener("click", () => {
  showAllSuggestions = !showAllSuggestions;
  renderSuggestions();
});

// ---------- Spending limits pop-up ----------

let limitCategoryId = null;

// Pass a category id to change its limit, or nothing to pick one
function openLimitEditor(categoryId = null) {
  const expenses = data.categories.filter((c) => c.kind === "expense");
  limitCategoryId = categoryId
    ?? expenses.find((c) => !getLimit(c.id))?.id // the first one without a limit
    ?? expenses[0]?.id;
  if (!limitCategoryId) {
    showToast("Add an expense category in Settings first.");
    return;
  }
  renderLimitChips();
  fillLimitForm();
  $("limit-dialog").showModal();
  $("limit-amount").focus();
}

function renderLimitChips() {
  $("limit-category").innerHTML = data.categories.filter((c) => c.kind === "expense").map((c) => {
    const limit = getLimit(c.id);
    return `
      <input class="visually-hidden" type="radio" name="limit-category" id="lim-${escapeHtml(c.id)}" value="${escapeHtml(c.id)}" ${c.id === limitCategoryId ? "checked" : ""}>
      <label class="chip" for="lim-${escapeHtml(c.id)}" style="--c:${escapeHtml(c.color)}">
        <span>${escapeHtml(c.icon)}</span>${escapeHtml(c.name)}
        ${limit ? `<span class="chip-meta">${formatMoney(limit.limitCents)}/${escapeHtml(limitPeriodWord(limit.period))}</span>` : ""}
      </label>`;
  }).join("");
}

function selectedLimitPeriod() {
  return document.querySelector('input[name="limit-period"]:checked')?.value ?? "monthly";
}

// Fill in the current limit and how often it resets
function fillLimitForm() {
  const limit = getLimit(limitCategoryId);
  const defaultPeriod = data.settings.cycle === "pay" && hasPaySchedule() ? "pay" : "monthly";
  let period = limit?.period ?? defaultPeriod;
  if (period === "pay" && !hasPaySchedule()) period = "monthly";

  // "Each pay period" is only offered once a pay schedule is set up
  const periods = Object.entries(LIMIT_PERIODS).filter(([key]) => key !== "pay" || hasPaySchedule());
  $("limit-period").innerHTML = periods.map(([key, p]) => `
    <input class="visually-hidden" type="radio" name="limit-period" id="period-${key}" value="${key}" ${key === period ? "checked" : ""}>
    <label class="chip" for="period-${key}" style="--c: var(--accent)">${p.label}</label>`).join("");

  $("limit-title").textContent = limit ? "Change spending limit" : "Set a spending limit";
  $("limit-amount").value = limit ? centsToInput(limit.limitCents) : "";
  $("limit-remove").hidden = !limit;
  updateLimitInfo();
}

// Show recent spending for the chosen reset period, to help pick a number
function updateLimitInfo() {
  const period = selectedLimitPeriod();
  const word = limitPeriodWord(period);
  const schedule = limitSchedule(period);
  const current = periodContaining(todayString(), schedule);
  const previous = previousPeriod(current, schedule);
  const spentNow = spentByCategory(current.start, current.end)[limitCategoryId] || 0;
  const spentBefore = spentByCategory(previous.start, previous.end)[limitCategoryId] || 0;

  $("limit-suffix").textContent = `/ ${word}`;
  $("limit-info").textContent =
    `Spent this ${word} so far: ${formatMoney(spentNow)} · last ${word}: ${formatMoney(spentBefore)}. ` +
    `Next reset: ${longDate(current.end)}.`;
}

$("limit-form").addEventListener("change", (event) => {
  if (event.target.name === "limit-category") {
    limitCategoryId = event.target.value;
    fillLimitForm();
  } else if (event.target.name === "limit-period") {
    updateLimitInfo();
  }
});

$("limit-form").addEventListener("submit", (event) => {
  event.preventDefault();
  const cents = toCents($("limit-amount").value);
  if (!(cents > 0)) {
    showToast("Enter a limit above zero.");
    return;
  }
  const period = selectedLimitPeriod();
  setLimit(limitCategoryId, cents, period);
  $("limit-dialog").close();
  render();

  const name = getCategory(limitCategoryId)?.name ?? "Category";
  const s = budgetStatus(limitCategoryId, todayString());
  if (s && s.over) showToast(`⚠️ ${name} is already ${formatMoney(-s.left)} over this limit`, null, null, true);
  else showToast(`${name} limit set to ${formatMoney(cents)} a ${limitPeriodWord(period)}`);
});

$("limit-remove").addEventListener("click", () => {
  const previous = { ...getLimit(limitCategoryId) };
  removeLimit(previous.categoryId);
  $("limit-dialog").close();
  render();
  showToast(`Removed the ${getCategory(previous.categoryId)?.name ?? ""} limit`, "Undo", () => {
    setLimit(previous.categoryId, previous.limitCents, previous.period);
    render();
  });
});

$("budget-list").addEventListener("click", (event) => {
  const row = event.target.closest("[data-category-id]");
  if (row) openLimitEditor(row.dataset.categoryId);
});
$("add-limit-btn").addEventListener("click", () => openLimitEditor());
$("budget-empty-btn").addEventListener("click", () => openLimitEditor());

// The red "over limit" badge in the summary card jumps to the limits
$("hero-alert").addEventListener("click", () => {
  $("budgets-panel").scrollIntoView({ behavior: reduceMotion ? "auto" : "smooth", block: "start" });
});

// ---------- Pay day pop-up ----------

function openPayEditor() {
  const pay = data.settings.pay;
  $("pay-frequency").innerHTML = Object.entries(PAY_FREQUENCIES)
    .map(([key, label]) => `<option value="${key}">${escapeHtml(label)}</option>`).join("");
  $("pay-frequency").value = pay.frequency;
  $("pay-anchor").value = pay.anchor || todayString();
  $("pay-amount").value = pay.amountCents ? centsToInput(pay.amountCents) : "";
  $("pay-category").innerHTML = data.categories.filter((c) => c.kind === "income")
    .map((c) => `<option value="${escapeHtml(c.id)}">${escapeHtml(c.icon)} ${escapeHtml(c.name)}</option>`).join("");
  if (getCategory(pay.categoryId)) $("pay-category").value = pay.categoryId;
  $("pay-auto").checked = pay.autoAdd;
  // New pay schedules default to starting the budget on pay day
  const cycle = pay.frequency === "none" ? "pay" : data.settings.cycle;
  document.querySelector(`input[name="pay-cycle"][value="${cycle}"]`).checked = true;

  updatePayForm();
  document.querySelectorAll("dialog[open]").forEach((d) => d.close());
  $("pay-dialog").showModal();
}

// Show or hide parts of the form, and preview the next pay day
function updatePayForm() {
  const frequency = $("pay-frequency").value;
  const none = frequency === "none";
  $("pay-details").hidden = none;
  // Daily and "1st and 15th" don't need a starting date
  $("pay-anchor-field").hidden = frequency === "daily" || frequency === "semimonthly";

  if (none) {
    $("pay-preview").textContent = "Your budget will follow calendar months.";
    return;
  }
  const schedule = { freq: frequency, anchor: $("pay-anchor").value || todayString() };
  const current = periodContaining(todayString(), schedule);
  const daysToPay = daysBetween(todayString(), current.end);
  const amountCents = toCents($("pay-amount").value) || 0;

  let text = `Next pay day: ${longDate(current.end)} (${daysToPay === 1 ? "tomorrow" : `in ${daysToPay} days`}).`;
  if (frequency !== "daily") text += ` This pay period runs ${periodLabel(current)}.`;
  if ($("pay-auto").checked && amountCents > 0) text += ` ${formatMoney(amountCents)} will be added on each pay day.`;
  $("pay-preview").textContent = text;
}

$("pay-form").addEventListener("input", updatePayForm);
$("pay-form").addEventListener("change", updatePayForm);

$("pay-form").addEventListener("submit", (event) => {
  event.preventDefault();
  const frequency = $("pay-frequency").value;
  const pay = data.settings.pay;
  pay.frequency = frequency;
  pay.anchor = $("pay-anchor").value || todayString();
  pay.amountCents = Math.max(0, toCents($("pay-amount").value) || 0);
  pay.categoryId = $("pay-category").value || pay.categoryId;
  pay.autoAdd = $("pay-auto").checked && pay.amountCents > 0;
  data.settings.cycle = frequency === "none" ? "month" : document.querySelector('input[name="pay-cycle"]:checked').value;

  // Treat the latest pay day as already handled. Pay is added automatically from the next one.
  pay.lastPaid = frequency === "none" ? null : periodContaining(todayString(), paySchedule()).start;
  saveData();

  $("pay-dialog").close();
  showPeriodOf(todayString());
  render();
  if (frequency === "none") showToast("Pay schedule turned off. Your budget follows calendar months.");
  else showToast(`Saved. Next pay day is ${longDate(periodContaining(todayString(), paySchedule()).end)}.`);
});

$("hero-payday").addEventListener("click", openPayEditor);

// ---------- Search and period switcher ----------

$("search").addEventListener("input", (event) => {
  searchText = event.target.value;
  renderTransactions();
});

$("prev-period").addEventListener("click", () => {
  view = previousPeriod(view, viewSchedule());
  render();
});

$("next-period").addEventListener("click", () => {
  view = periodContaining(view.end, viewSchedule());
  render();
});

$("period-label").addEventListener("click", () => {
  showPeriodOf(todayString());
  render();
});

// ---------- Theme (auto / light / dark) ----------

function loadTheme() {
  try {
    return localStorage.getItem(THEME_KEY) || "auto";
  } catch (err) {
    return "auto";
  }
}

function applyTheme() {
  // "Auto" follows the page around the app: claude.ai's theme setting if it set one,
  // otherwise the computer's light/dark setting
  const root = document.documentElement;
  const hostTheme = root.dataset.hostTheme;
  if (theme !== "auto") root.dataset.theme = theme;
  else if (hostTheme) root.dataset.theme = hostTheme;
  else delete root.dataset.theme;

  const label = `Theme: ${theme[0].toUpperCase()}${theme.slice(1)}`;
  $("theme-btn").innerHTML = THEME_ICONS[theme];
  $("theme-btn").title = label;
  $("theme-btn").setAttribute("aria-label", label);
}

$("theme-btn").addEventListener("click", () => {
  const order = ["auto", "light", "dark"];
  theme = order[(order.indexOf(theme) + 1) % order.length];
  try {
    if (theme === "auto") localStorage.removeItem(THEME_KEY);
    else localStorage.setItem(THEME_KEY, theme);
  } catch (err) {}
  applyTheme();
  render(); // the chart needs the new colours
  showToast($("theme-btn").title);
});

// If the computer switches between light and dark, redraw the chart colours
window.matchMedia("(prefers-color-scheme: dark)").addEventListener("change", render);

// ---------- Settings pop-up ----------

function currencyName(code) {
  try {
    return new Intl.DisplayNames(undefined, { type: "currency" }).of(code);
  } catch (err) {
    return code;
  }
}

function renderSettings() {
  const pay = data.settings.pay;
  $("pay-summary").textContent = hasPaySchedule()
    ? `${PAY_FREQUENCIES[pay.frequency]}${pay.autoAdd ? `, ${formatMoney(pay.amountCents)} added automatically` : ""}`
    : "Not set up. Your budget follows calendar months.";

  const current = data.settings.currency;
  const codes = CURRENCIES.includes(current) ? CURRENCIES : [current, ...CURRENCIES];
  $("currency-select").innerHTML = codes
    .map((code) => `<option value="${escapeHtml(code)}">${escapeHtml(code)} · ${escapeHtml(currencyName(code))}</option>`)
    .join("");
  $("currency-select").value = current;

  $("category-chips").innerHTML = data.categories
    .map((c) => `<span class="cat-chip" style="--c:${escapeHtml(c.color)}" title="${c.kind === "income" ? "Income" : "Expense"}">${escapeHtml(c.icon)} ${escapeHtml(c.name)}</span>`)
    .join("");
}

$("settings-btn").addEventListener("click", () => {
  renderSettings();
  $("settings-dialog").showModal();
});

$("settings-pay-btn").addEventListener("click", openPayEditor);

$("currency-select").addEventListener("change", (event) => {
  data.settings.currency = event.target.value;
  saveData();
  updateCurrency();
  render();
  renderSettings();
  showToast(`Currency set to ${event.target.value}`);
});

$("category-form").addEventListener("submit", (event) => {
  event.preventDefault();
  const name = $("cat-name").value.trim();
  const kind = $("cat-kind").value;
  if (!name) return;

  const duplicate = data.categories.some((c) => c.kind === kind && c.name.toLowerCase() === name.toLowerCase());
  if (duplicate) {
    showToast(`You already have a category called "${name}".`);
    return;
  }

  data.categories.push({
    id: newId(),
    name,
    kind,
    icon: $("cat-icon").value,
    color: CATEGORY_COLORS[data.categories.length % CATEGORY_COLORS.length],
  });
  saveData();
  $("category-form").reset();
  renderSettings();
  render();
  showToast(`Added "${name}"`);
});

$("export-btn").addEventListener("click", async () => {
  const json = JSON.stringify(data, null, 2);
  const filename = `budget-backup-${todayString()}.json`;

  // On claude.ai, pages can't download files directly: they ask the viewer first
  if (window.claude?.use) {
    const downloads = await claude.use("downloads");
    if (downloads) {
      try {
        await downloads.save({ filename, data: json });
        showToast("Backup saved");
      } catch (err) {
        if (err?.code !== "declined") showToast("Couldn't save the backup file here.");
      }
      return;
    }
    // No file saving here: copy the backup instead, to paste into a text file
    try {
      await navigator.clipboard.writeText(json);
      showToast("Backup copied. Paste it into a text file to keep it.");
    } catch (err) {
      showToast("Couldn't save or copy the backup here.");
    }
    return;
  }

  // Opened as a plain file: an ordinary download
  const url = URL.createObjectURL(new Blob([json], { type: "application/json" }));
  const link = document.createElement("a");
  link.href = url;
  link.download = filename;
  link.click();
  setTimeout(() => URL.revokeObjectURL(url), 1000);
  showToast("Backup downloaded");
});

// A yes/no question in a pop-up. Resolves true for yes, false for no.
// (Pages on claude.ai can't use the browser's own confirm() box.)
function askConfirm(title, text, yesLabel) {
  return new Promise((resolve) => {
    const dialog = $("confirm-dialog");
    $("confirm-title").textContent = title;
    $("confirm-text").textContent = text;
    $("confirm-yes").textContent = yesLabel;
    $("confirm-yes").onclick = () => {
      resolve(true);
      dialog.close();
    };
    $("confirm-no").onclick = () => dialog.close();
    dialog.onclose = () => resolve(false); // Escape or clicking outside means no
    dialog.showModal();
  });
}

// Swap the example budget for an empty one
$("clear-examples").addEventListener("click", () => {
  const currency = data.settings.currency;
  data = createDefaultData();
  data.settings.currency = currency;
  saveData();
  showPeriodOf(todayString());
  render();
  showToast("Examples cleared. Add your first expense, or set up your pay day.");
});

$("import-input").addEventListener("change", async (event) => {
  const file = event.target.files[0];
  if (!file) return;
  try {
    const imported = JSON.parse(await file.text());
    if (!isValidData(imported)) throw new Error("Not a budget backup");
    const yes = await askConfirm("Restore this backup?", "It replaces everything in the app now with what's in the backup file.", "Restore backup");
    if (yes) {
      delete imported.example; // a restored backup is your real budget
      data = migrate(imported);
      saveData();
      updateCurrency();
      showPeriodOf(todayString());
      renderSettings();
      render();
      showToast("Backup restored");
    }
  } catch (err) {
    showToast("That file doesn't look like a budget backup.");
  } finally {
    event.target.value = ""; // lets you pick the same file again later
  }
});

$("erase-btn").addEventListener("click", async () => {
  const yes = await askConfirm("Erase all data?", "This deletes every transaction, limit, category and pay setting. Export a backup first if you might want them.", "Erase everything");
  if (!yes) return;
  const currency = data.settings.currency;
  data = createDefaultData();
  data.settings.currency = currency;
  saveData();
  showPeriodOf(todayString());
  renderSettings();
  render();
  showToast("All data erased");
});

// ---------- Start the app ----------
$("cat-icon").innerHTML = ICON_CHOICES.map((icon) => `<option>${icon}</option>`).join("");
applyTheme();
applyPrivacy();
updateCurrency();
saveData(); // stores any upgrades made by migrate()
runPaydayCheck();
showPeriodOf(todayString());
render();
connectCloud(); // on claude.ai: load or save your budget in your account
