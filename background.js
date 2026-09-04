// Segue — right-click a link, send it to another window.
//
// Why an extension at all: Edge's own "Name window" is not readable from any
// API. chrome.windows exposes a window's id, geometry and tabs, but neither a
// title nor that name; DevTools does not expose it either. It exists only in
// the OS window title. So a script outside the browser can FIND a named window
// but cannot add a row to Edge's context menu, and an extension can add the row
// but cannot see Edge's names. This side of the line is the one worth taking:
// the menu is the whole point, and names are something we can keep ourselves.
//
// Windows are listed by a name you give them (the toolbar button) and fall back
// to the title of their active tab, which is usually enough on its own.

const NAMES_KEY = 'names';

// activateTab and focusWindow are separate because they are separate things:
// a tab can be the active one INSIDE a window that is still behind everything
// else. Selecting the tab without raising the window is the useful middle
// setting - the link is waiting, already open, when you switch over.
const DEFAULTS = {
  activateTab: false,   // make the new tab the active one in its window
  focusWindow: false,   // raise that window to the front
  showDetails: false,   // append window id and size to each menu row
  quickTarget: '',      // window name that Alt-click sends links to
  mirrorTitle: false,   // put the name into the tab title, and so the window title
  urlMode: 'off',       // also show the address there: "off" | "host" | "full"
  catchExternal: false  // move links opened from other programs to quickTarget
};

// Options persist across restarts (sync), names do not (session).
//
// That split is deliberate and is what makes Alt-click survive a restart: the
// option holds a NAME, and the name is resolved to a window id at click time,
// creating the window if nothing carries that name yet. Window ids are
// meaningless between sessions, so anything keyed by one has to expire with it.
async function getOptions() {
  try {
    return Object.assign({}, DEFAULTS, await chrome.storage.sync.get(DEFAULTS));
  } catch {
    return Object.assign({}, DEFAULTS);
  }
}

async function loadNames() {
  try {
    const got = await chrome.storage.session.get(NAMES_KEY);
    return got[NAMES_KEY] || {};
  } catch {
    return {};
  }
}

async function setName(windowId, name) {
  const names = await loadNames();
  if (name) names[String(windowId)] = name;
  else delete names[String(windowId)];
  await chrome.storage.session.set({ [NAMES_KEY]: names });
}

// A closed window's name is DELETED by key. The extension this borrows from
// used Array.splice on an array indexed by window id, which shifts every later
// entry down one - so closing a window silently renamed the others.
chrome.windows.onRemoved.addListener(async (windowId) => {
  const names = await loadNames();
  if (names[String(windowId)] !== undefined) {
    delete names[String(windowId)];
    await chrome.storage.session.set({ [NAMES_KEY]: names });
  }
  scheduleRebuild();
});

function label(win, names, showDetails) {
  const named = names[String(win.id)];
  let text = named;
  if (!text) {
    const active = (win.tabs || []).find(t => t.active) || (win.tabs || [])[0];
    text = (active && (active.title || active.url)) || 'Untitled window';
  }
  if (text.length > 60) text = text.slice(0, 59) + '…';
  return showDetails ? `${text}  ·  #${win.id} (${win.width}×${win.height})` : text;
}

let rebuildTimer = null;
function scheduleRebuild() {
  clearTimeout(rebuildTimer);
  rebuildTimer = setTimeout(rebuild, 250);   // tab titles settle as pages load
}

async function rebuild() {
  await chrome.contextMenus.removeAll();
  const [names, options] = await Promise.all([loadNames(), getOptions()]);
  let wins = [];
  try {
    wins = await chrome.windows.getAll({ populate: true, windowTypes: ['normal'] });
  } catch {
    wins = [];
  }

  // Sorted by id so the order does not shuffle as windows gain focus, which
  // would move a row out from under the pointer between two uses.
  wins.sort((a, b) => a.id - b.id);

  // Two parents rather than a modifier on the click: chrome.contextMenus does
  // NOT report which keys were held, so the only way to offer a choice at the
  // moment of clicking is to offer two rows.
  const groups = [
    { id: 'send', title: 'Send link to window', ctx: ['link'] },
    { id: 'switch', title: 'Send link to window and switch to it', ctx: ['link'] },
    // On the page, not on a link: this one moves the tab you are looking at.
    // Naming the windows is the point - Edge's own "Move tab to" offers them
    // as bare numbers.
    { id: 'move', title: 'Move this tab to window', ctx: ['page'] }
  ];

  for (const g of groups) {
    chrome.contextMenus.create({ id: g.id, title: g.title, contexts: g.ctx });
    for (const w of wins) {
      chrome.contextMenus.create({
        id: `${g.id}:${w.id}`,
        parentId: g.id,
        title: label(w, names, options.showDetails),
        contexts: g.ctx
      });
    }
    if (wins.length) {
      chrome.contextMenus.create({
        id: g.id + ':sep', parentId: g.id, type: 'separator', contexts: g.ctx
      });
    }
    chrome.contextMenus.create({
      id: g.id + ':new', parentId: g.id, title: 'New window', contexts: g.ctx
    });
  }
}

// Move a tab to another window and follow it. Unlike a link sent elsewhere,
// which is meant to wait for you, moving the tab you are reading means going
// with it - so this always activates and focuses.
async function moveTabTo(tab, windowId) {
  if (!tab || tab.windowId === windowId) return;
  await chrome.tabs.move(tab.id, { windowId, index: -1 });
  await chrome.tabs.update(tab.id, { active: true });
  await chrome.windows.update(windowId, { focused: true });
}

async function currentTab() {
  const [t] = await chrome.tabs.query({ active: true, lastFocusedWindow: true });
  return t;
}

// Next/previous in window-id order, wrapping. Id order is stable, unlike
// z-order or focus order, so the same key twice takes you two windows along
// rather than bouncing between the same pair.
async function moveTabStep(delta) {
  const tab = await currentTab();
  if (!tab) return;
  let wins = [];
  try {
    wins = await chrome.windows.getAll({ windowTypes: ['normal'] });
  } catch {
    return;
  }
  if (wins.length < 2) return;
  wins.sort((a, b) => a.id - b.id);
  const at = wins.findIndex(w => w.id === tab.windowId);
  if (at < 0) return;
  const next = wins[(at + delta + wins.length) % wins.length];
  await moveTabTo(tab, next.id);
}

chrome.commands.onCommand.addListener((cmd) => {
  if (cmd === 'move-tab-next') moveTabStep(1);
  else if (cmd === 'move-tab-prev') moveTabStep(-1);
});

// override wins over the saved defaults; undefined falls back to them.
async function openIn(windowId, url, override) {
  const o = await getOptions();
  const activate = override && override.activate !== undefined
    ? override.activate : o.activateTab;
  const focus = override && override.focus !== undefined
    ? override.focus : o.focusWindow;

  // Selecting a tab in ANOTHER window raises that window, whatever
  // tabs.create's documentation says about active not affecting focus. That
  // makes "select the tab but leave the window where it is" impossible to ask
  // for directly, so it is done by putting the focus back afterwards.
  //
  // Only for the combination that actually needs it: with activate off nothing
  // is raised, and with focus on the raise is the point.
  let restore = null;
  if (activate && !focus) {
    try {
      const cur = await chrome.windows.getLastFocused();
      if (cur && cur.id !== windowId) restore = cur.id;
    } catch { /* no focused window to return to */ }
  }

  await chrome.tabs.create({ windowId, url, active: activate });

  if (focus) {
    try { await chrome.windows.update(windowId, { focused: true }); } catch { /* gone */ }
  } else if (restore !== null) {
    try { await chrome.windows.update(restore, { focused: true }); } catch { /* gone */ }
  }
}

// Resolve a NAME to a window, creating one if nothing carries it. This is what
// lets Alt-click keep working after a restart, when every id has changed.
async function openInNamed(name, url, override) {
  const names = await loadNames();
  const hit = Object.keys(names).find(id => names[id] === name);
  console.log('[Segue] target', JSON.stringify(name), '->',
    hit ? 'window ' + hit : 'no window has this name; creating one',
    '| known names:', JSON.stringify(names));
  if (hit) {
    try {
      await openIn(Number(hit), url, override);
      return;
    } catch { /* the window closed; fall through and make a new one */ }
  }
  const win = await chrome.windows.create({ url });
  await setName(win.id, name);
  scheduleRebuild();
}

// A link clicked in Word, Outlook, a PDF - anything outside the browser -
// reaches Edge as "msedge.exe <url>", and Chromium drops it in the window that
// happened to be focused last. That is the whole of "it opens in the wrong
// window": nothing chose that window, it was simply the most recent one.
//
// Such a tab cannot be identified with certainty, so it is identified by what
// it looks like at the moment of creation:
//
//   - no openerTabId  - a link clicked inside Edge has one
//   - active          - "open in new tab" from a bookmark or a menu opens in
//                       the background, so this excludes those
//   - a real http(s) url already  - Ctrl+T then typing starts at the new tab
//                       page and navigates afterwards, so it is excluded too
//
// Together those are specific enough to be worth having, and the option is off
// until asked for. Wrongly caught: a bookmark opened straight into the
// foreground by some other route.
chrome.tabs.onCreated.addListener(async (tab) => {
  const o = await getOptions();
  if (!o.catchExternal || !o.quickTarget) return;
  if (tab.openerTabId !== undefined || !tab.active) return;
  const url = tab.pendingUrl || tab.url || '';
  if (!/^https?:/i.test(url)) return;

  const names = await loadNames();
  const target = Object.keys(names).find(id => names[id] === o.quickTarget);
  if (!target) return;                       // no window carries the name
  const targetId = Number(target);
  if (tab.windowId === targetId) return;     // already where it belongs

  try {
    await chrome.tabs.move(tab.id, { windowId: targetId, index: -1 });
    // A link opened from another program is meant to be READ, so this one path
    // always shows it - unlike the menu, where leaving it waiting is the point.
    await chrome.tabs.update(tab.id, { active: true });
    await chrome.windows.update(targetId, { focused: true });
  } catch (err) {
    console.warn('[Segue] could not move external tab:', err);
  }
});

chrome.contextMenus.onClicked.addListener(async (info, tab) => {
  const id = String(info.menuItemId);

  if (id.startsWith('move')) {
    if (id === 'move:new') {
      // a window of its own: move, do not copy, so the tab is not duplicated
      if (tab) await chrome.windows.create({ tabId: tab.id, focused: true });
      return;
    }
    const mv = /^move:(\d+)$/.exec(id);
    if (mv && tab) {
      try { await moveTabTo(tab, Number(mv[1])); }
      catch (err) { console.warn('[Segue] could not move tab:', err); }
    }
    return;
  }

  if (!info.linkUrl) return;
  const group = id.startsWith('switch') ? 'switch' : 'send';
  const override = group === 'switch' ? { activate: true, focus: true } : undefined;

  if (id.endsWith(':new')) {
    chrome.windows.create({ url: info.linkUrl, focused: group === 'switch' });
    return;
  }

  const m = /^(?:send|switch):(\d+)$/.exec(id);
  if (!m) return;

  try {
    await openIn(Number(m[1]), info.linkUrl, override);
  } catch {
    // the window closed between building the menu and clicking it
    chrome.windows.create({ url: info.linkUrl });
  }
});

chrome.runtime.onMessage.addListener((msg, sender, sendResponse) => {
  if (msg && msg.action === 'whatIsMyName') {
    (async () => {
      const [names, o] = await Promise.all([loadNames(), getOptions()]);
      const id = sender.tab && sender.tab.windowId;
      sendResponse({
        name: o.mirrorTitle && id ? (names[String(id)] || '') : '',
        urlMode: o.mirrorTitle ? o.urlMode : 'off'
      });
    })();
    return true;
  }
  if (!msg || msg.action !== 'quickOpen' || !msg.url) return;
  (async () => {
    const o = await getOptions();
    console.log('[Segue] quickOpen', msg.url, '| quickTarget:',
      JSON.stringify(o.quickTarget));
    // Alt+Shift inverts whatever the defaults say, so both behaviours are one
    // click away without a trip to the options page.
    const override = msg.invert
      ? { activate: !o.activateTab, focus: !o.focusWindow }
      : undefined;
    if (o.quickTarget) await openInNamed(o.quickTarget, msg.url, override);
    else await chrome.windows.create({ url: msg.url });   // no target chosen yet
    sendResponse({ ok: true });
  })();
  return true;   // keep the channel open for the async reply
});

// EVERY tab of each window carries the name, not only the active one.
//
// Tagging just the active tab is enough for the title bar and keeps the tab
// strip clean, and that is how this started - but it made the name depend on a
// message arriving in time for each tab you switch to. Tabs whose content
// script predates an extension reload, tabs Edge had put to sleep, and any tab
// the message simply lost the race with showed no name at all; the name would
// then appear out of nowhere on opening a new tab, whose content script asks
// for it on its own. Tagging every tab means the title is already right before
// the tab is shown, at the cost of the name appearing on each tab in the strip
// - which is why it goes at the END of the title, where a narrow or vertical
// tab list truncates it away and leaves the page title readable.
async function syncTitles() {
  const [names, o] = await Promise.all([loadNames(), getOptions()]);
  let tabs = [];
  try {
    tabs = await chrome.tabs.query({ windowType: 'normal' });
  } catch {
    return;
  }
  for (const t of tabs) {
    // The URL is shown independently of whether the window has a name, but
    // both are governed by the same master switch.
    const name = o.mirrorTitle ? (names[String(t.windowId)] || '') : '';
    try {
      // An empty name clears a prefix left behind, so turning the option off,
      // renaming a window or moving a tab out of one does not strand the old
      // text in the title.
      chrome.tabs.sendMessage(t.id, { action: 'setTag', name, urlMode: o.urlMode },
        () => void chrome.runtime.lastError);   // no content script here: fine
    } catch { /* ditto */ }
  }
}

function scheduleSync() {
  scheduleRebuild();
  syncTitles();
}

// The menu is a snapshot, so it is rebuilt whenever what it lists can change.
chrome.runtime.onInstalled.addListener(rebuild);
chrome.runtime.onStartup.addListener(rebuild);
chrome.windows.onCreated.addListener(scheduleSync);
chrome.tabs.onActivated.addListener(scheduleSync);
// a moved tab belongs to a different window now, and to a different name
chrome.tabs.onAttached.addListener(scheduleSync);
chrome.tabs.onDetached.addListener(scheduleSync);
chrome.tabs.onUpdated.addListener((id, change, tab) => {
  if (change.title) scheduleRebuild();
  // a finished navigation means a fresh content script with nothing applied yet
  if (change.status === 'complete') syncTitles();
  // and an address that changed without a reload leaves a stale URL in the title
  else if (change.url) syncTitles();
});
chrome.storage.session.onChanged.addListener(scheduleSync);
chrome.storage.sync.onChanged.addListener(scheduleSync);

rebuild();
syncTitles();
