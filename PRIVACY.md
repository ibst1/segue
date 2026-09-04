# Segue — Privacy statement

*Last updated: 2026-09-04*

Segue is a browser extension that sends links and tabs to another browser
window. It runs entirely inside your browser.

## What Segue stores

- **Your settings** (the options page: select the new tab, bring the window to
  the front, show details, address mode, catch external links) in the
  browser's synced extension storage, so they follow your browser profile.
- **Window names** you give windows with the toolbar button, in the browser's
  session storage. They are discarded when the browser closes.

That is all. Segue keeps no history of the links you send, no browsing
history, and no account or identity information.

## What Segue reads on web pages

Segue's page script listens for Alt-clicks on links and, when you have turned
on "mirror the window name into the title", appends the window's name to the
page title. It reads the address of the link you Alt-clicked and the page's
title. It reads nothing else on the page, and it does not read form fields,
page content, cookies or passwords.

## What leaves your browser

Nothing. Segue makes no network requests, contains no analytics or telemetry,
loads no remote code, and shares no data with anyone. The only place a piece
of information goes is from the page script to the extension itself, inside
the browser, to open the link you clicked in the window you chose.

## Permissions

- *contextMenus* — the right-click submenus on links.
- *tabs* — listing open windows by the title of their active tab, opening the
  link in the chosen window, moving the current tab between windows.
- *storage* — the settings and window names described above.
- Access to all sites — the page script has to run on any page where you
  might Alt-click a link or want the window name in the title.

## Contact

Questions about this statement: open an issue in the project's repository, or
use the support contact given on the store listing.
