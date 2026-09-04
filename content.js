// Two jobs, both of which have to happen inside the page:
//
//   1. Alt-click a link to send it to the chosen window, no menu.
//   2. Optionally put this window's Segue name into document.title, so that the
//      name reaches the OS window title.
//
// (2) is the only way a window name can leave the browser at all. There is no
// API for a window's title: it is derived from the active tab's document.title,
// and a content script is the one thing allowed to touch that. With it on, AHK
// and PowerShell can find a window by the name given here.

// ── Alt-click ────────────────────────────────────────────────────────────────
// One delegated listener on the document in the CAPTURE phase, rather than a
// listener bound to each <a> at load. Binding per link is how the extension
// this borrows the idea from does it, and it misses every link a page adds
// afterwards - which on anything built with a framework is most of them.
// Capture also puts us ahead of handlers that call stopPropagation.
document.addEventListener('click', (e) => {
  if (!e.altKey || e.button !== 0) return;
  const a = e.target && e.target.closest ? e.target.closest('a[href]') : null;
  if (!a) return;
  const url = a.href;
  if (!/^https?:/i.test(url)) return;     // leave javascript: and mailto: alone
  e.preventDefault();
  e.stopPropagation();
  try {
    // Only failures are logged. A line per click would go in the PAGE's
    // console, which belongs to the site, not to us.
    chrome.runtime.sendMessage({ action: 'quickOpen', url, invert: e.shiftKey },
      () => {
        // reading lastError also stops "Unchecked runtime.lastError" noise
        if (chrome.runtime.lastError)
          console.warn('[Segue] no reply:', chrome.runtime.lastError.message);
      });
  } catch (err) {
    console.warn('[Segue] send failed:', err);
  }
}, true);

// ── Mirroring the window name into the title ────────────────────────────────
// Everything Segue adds goes at the END of the title, as
//
//     <the page's own title>  <url>  [Window name]
//
// In front reads better in a taskbar, which truncates from the right - but it
// ruins a vertical tab list, where every tab is cut short and so every one of
// them starts with the same text, with the part that tells them apart chopped
// off. At the end, it is our additions that get truncated away in the strip,
// leaving the page title legible; the window title bar shows the whole thing
// and stays matchable from outside.
//
// The name goes last of the two so that the URL, which is reference rather than
// identity, is the first thing to survive truncation.
let name = '';          // window name, "" when not mirroring
let urlMode = 'off';    // "off" | "host" | "full"
let applied = '';       // exactly what we appended last time
let observer = null;

// What we want on the end right now. Recomputed rather than remembered because
// the URL changes under us on sites that navigate without reloading.
function suffix() {
  const parts = [];
  if (urlMode === 'host') parts.push(location.host);
  else if (urlMode === 'full') parts.push(location.href);
  if (name) parts.push('[' + name + ']');
  return parts.length ? '  ' + parts.join('  ') : '';
}

// The page's own title, with everything we added taken out - both what we
// appended last time and any copy of the name tag, wherever it sits.
//
// Stripping only a suffix is not enough. Anything else that appends to the
// title - "Add URL To Window Title" does, and some sites do it themselves -
// pushes our text away from the end, so a suffix-only strip finds nothing,
// treats the whole string as a fresh title and appends a second copy. Its
// change then wakes the other writer, which appends again, and the title grows
// by one copy of each per pass without bound.
//
// Deriving the base rather than remembering it is still what lets a page that
// legitimately rewrites its title - a mail client counting unread, a player
// naming the track - be followed correctly.
function bare(t) {
  let out = t;
  if (applied) out = out.split(applied).join('');
  if (name) out = out.split('[' + name + ']').join('');
  return out.replace(/\s{2,}/g, ' ').trim();
}

// A title this long is not a title. If something else is still appending on
// every change, stop rather than take part in the growth - one warning, then
// leave the title alone until it shortens again.
const MAX = 300;
let warned = false;

function apply() {
  const base = bare(document.title);
  if (base.length > MAX) {
    if (!warned) {
      warned = true;
      console.warn('[Segue] title over ' + MAX + ' characters; leaving it alone.'
        + ' Something else is probably appending to it too.');
    }
    return;
  }
  warned = false;
  const suf = suffix();
  // a page with no title of its own must not end up called "  [Name]"
  const want = suf ? (base ? base + suf : suf.trim()) : base;
  applied = suf;
  // idempotent, so the mutation this causes does not loop
  if (document.title !== want) document.title = want;
}

function watch() {
  if (observer) return;
  const root = document.head || document.documentElement;
  if (!root) return;
  // A <title> element can be replaced wholesale, not only edited, so the
  // subtree is watched rather than the element itself.
  observer = new MutationObserver(apply);
  observer.observe(root, { subtree: true, childList: true, characterData: true });
  // A page can change its URL without touching its title. The title then holds
  // a stale address, and nothing in the DOM says so.
  addEventListener('popstate', apply);
  addEventListener('hashchange', apply);
}

function configure(nextName, nextUrlMode) {
  const changed = (nextName !== name) || (nextUrlMode !== urlMode);
  if (!changed) return;
  const plain = bare(document.title);   // strip the OLD additions first
  name = nextName;
  urlMode = nextUrlMode;
  warned = false;
  const suf = suffix();
  applied = suf;
  document.title = suf ? (plain ? plain + suf : suf.trim()) : plain;
  if (suf) watch();
  else if (observer) { observer.disconnect(); observer = null; }
}

// Only the OUTERMOST document has a title the window shows. This script runs in
// every frame so that Alt-click works on links inside iframes, but a frame
// setting its own document.title changes nothing anyone sees - and with the URL
// shown it would be the FRAME's address, not the page's. So the title half
// stops here for anything nested.
const TOP = (() => { try { return window.top === window; } catch { return false; } })();

chrome.runtime.onMessage.addListener((msg) => {
  if (!TOP) return;
  if (msg && msg.action === 'setTag')
    configure(msg.name || '', msg.urlMode || 'off');
});

// The service worker is asked on load: a tab that opens later has missed
// whatever was broadcast before it existed.
function askForName() {
  if (!TOP) return;
  try {
    chrome.runtime.sendMessage({ action: 'whatIsMyName' }, (reply) => {
      if (chrome.runtime.lastError) return;
      if (reply) configure(reply.name || '', reply.urlMode || 'off');
    });
  } catch { /* service worker starting; the next broadcast will reach us */ }
}

if (document.readyState === 'loading')
  document.addEventListener('DOMContentLoaded', askForName, { once: true });
else
  askForName();
