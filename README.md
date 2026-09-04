# Segue

Right-click a link in Edge and send it to another browser window.

## Install

Edge will not install this from a folder on its own, and it has to be repeated
on each machine.

1. Open `edge://extensions`
2. Turn on **Developer mode**
3. **Load unpacked**, and point it at this folder
4. Disable *Open in specific window* if it is installed — otherwise two
   near-identical rows appear in the context menu

After reloading the extension, **reload the pages you want to use it on**:
content scripts are injected at page load, so tabs that were already open keep
running the previous version. That alone explains most of "it stopped working".

## Use

**Right-click a link** for two submenus, each listing every open window:

- *Send link to window* — uses the defaults from the options
- *Send link to window and switch to it* — overrides them for that one click

Two submenus rather than a modifier on the click, because `chrome.contextMenus`
does not report which keys were held. A choice at the moment of clicking has to
be a second row.

**Alt-click a link** to send it straight to a chosen window, no menu.
**Alt+Shift-click** inverts the defaults for that click.

**The toolbar button** names the current window and marks it as the Alt-click
target. Windows you have not named are listed by the title of their active tab.

## Options

**Select the new tab in its window** / **Bring the target window to the front**
are separate because they are separate things: a tab can be the active one
inside a window that is still behind everything else.

**Show the window name in the title bar** appends `[Name]` to the title of every
tab in a named window, which is what the title bar and taskbar show. At the end
rather than the front, so a narrow or vertical tab list truncates the name away
and leaves the page title readable. This is the only way a
name set here reaches anything outside the browser — with it on, a script can
find the window by that name:

```ahk
SetTitleMatchMode 2
h := WinExist("[Reading] ahk_class Chrome_WidgetWin_1")
```

Pages where extensions cannot run (`edge://`, the new tab page, PDFs) keep their
own title.

**Move this tab to window** appears on right-clicking the page rather than a
link, and lists the same named windows — which is the difference from Edge's own
"Move tab to", where the windows are bare numbers. `Alt+Shift+Right` and
`Alt+Shift+Left` move the tab to the next and previous window, wrapping. The
order follows window ids, not focus order, so two presses take you two windows
along instead of bouncing between the same pair. Unlike a link sent elsewhere,
you follow the tab: it is activated and its window raised.

**Catch links opened from other programs** fixes links from Word or Outlook
landing in the wrong window. They reach Edge as `msedge.exe <url>` and Chromium
drops them in whichever window was focused last — nothing chooses it. The tab is
moved to the target window afterwards and brought to the front.

Such a tab cannot be identified with certainty, so it is identified by shape: no
`openerTabId`, already active, and already carrying a real http(s) address. A
bookmark opened straight into the foreground looks the same and would be moved
too.

## What it cannot do

Edge's own **Name window** is invisible to it. `chrome.windows` gives a window's
id, geometry and tabs, but neither a title nor that name; DevTools does not
expose it either. The name exists only in the OS window title — which is why the
extension keeps names of its own, and why *Show the window name in the title
bar* exists to push them back out.

The **precise** fix for external links would be to intercept before Edge sees
the URL: register a script as the https handler, have it activate the named
window (findable thanks to the title option), then hand the URL to Edge, which
adds the tab to the focused window. That is exact, because it knows the link
came from outside. It costs making a program of your own the default browser,
which on Windows 11 needs a ProgId, capabilities and a `RegisteredApplications`
entry before it even appears in Default apps. Choosy and BrowserSelector already
do this if the heuristic above proves too blunt.

## How names and settings are stored

Settings live in `chrome.storage.sync` and persist. Window names live in
`chrome.storage.session` and do not.

That split is what makes Alt-click survive a restart: the setting holds a
**name**, resolved to a window id at click time, and a window is created and
given the name if nothing carries it. Window ids mean nothing between sessions,
so anything keyed by one has to expire with the session.

After restarting Edge, no window has a name until you give one. The popup says
so — *no window has this name yet* — rather than leaving Alt-click to open a
stray window without explanation.

## Notes

`tabs.create` documents that `active` does not affect window focus. It does:
selecting a tab in another window raises that window. "Select the tab but leave
the window where it is" is therefore done by restoring focus afterwards, which
can flash briefly.

Failures are logged. The service worker's console (`edge://extensions` → Segue →
**Service worker**) shows which window a name resolved to; a page's own console
shows only whether an Alt-click failed to reach the service worker.

## Publishing

The extension is meant for the Edge Add-ons store, which is the only way to
install it without *Load unpacked* on every machine.

- `build.ps1` writes the store package to `dist\segue-<version>.zip` (the
  version is read from `manifest.json`; nothing but the extension files goes
  in).
- `tools\Make-Icons.ps1` regenerates `icons\` and `store\logo-300.png`.
- `docs\store-listing.md` holds the listing texts, the permission
  justifications for the reviewers and the submission checklist;
  `PRIVACY.md` is the privacy statement the listing links to.
