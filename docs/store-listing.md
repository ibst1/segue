# Segue — store listings

Everything the store submission forms ask for, ready to paste. The package
itself comes from `build.ps1`, and the same zip goes to both stores.

Segue is published on the **Chrome Web Store**. Edge installs from it once
*Allow extensions from other stores* is on (Edge asks the first time).
The Edge Add-ons route is kept below for reference; its registration form wants
a postal address shown in the developer profile, which is why it was not used.

## Chrome Web Store checklist

1. **Account**: https://chrome.google.com/webstore/devconsole with a Google
   account that has 2-step verification on. One-time registration fee of
   USD 5. Verify the contact e-mail under *Account*.
2. **Trader status** (*Account*, EU Digital Services Act): declare
   **non-trader** — a free extension published by a private person. Traders
   must show a postal address on the listing; non-traders do not.
3. **Package**: run `.\build.ps1`, then *New item* → upload
   `dist\segue-<version>.zip`.
4. **Store listing** tab:
   - Description: the *Detailed description* below (plain text; the store
     shows no Markdown, so drop the `**` and `*`).
   - Category: *Productivity → Workflow & Planning*. Language: English.
   - Store icon: `icons/segue-128.png`.
   - Screenshots: 1–5, 1280×800 or 640×400 PNG/JPEG. The context menu with the
     *Send link to window* submenu open is the one that explains the extension.
   - Small promo tile: `store/promo-440x280.png` (required).
   - Homepage / support URL: `https://github.com/ibst1/segue`.
5. **Privacy** tab:
   - Single purpose: see *Single purpose* below.
   - Permission justifications: one box per permission, plus *host
     permission* for the content script — the texts under *Permission
     justifications*, split up.
   - Remote code: **No, I am not using remote code**.
   - Data usage: tick nothing (no data collected), then tick all three
     certifications (not sold, not used for unrelated purposes, not used for
     credit).
   - Privacy policy URL: see below.
6. **Distribution** tab: *Public*, or *Unlisted* (installable through the
   link only, not searchable — enough for "install it on every machine").
   Regions: all. Free.
7. **Submit for review**. `<all_urls>` content scripts get an in-depth review,
   so expect days rather than hours. The listing then appears at
   `https://chromewebstore.google.com/detail/<id>`.

A new version: bump `version` in `manifest.json`, run `build.ps1`, *Package* →
*Upload new package*, submit. The store rejects a version that is not higher
than the published one.

### Single purpose

> Segue moves links and tabs between browser windows: right-click or Alt-click
> a link to open it in another window you choose, and move the current tab to
> another window with the keyboard.

## Edge Add-ons checklist (not used)

1. **Account**: a Microsoft Partner Center account with the *Microsoft Edge*
   program enrolled (free, no fee). Sign in at
   https://partner.microsoft.com/dashboard/microsoftedge/ and create a new
   extension.
2. **Package**: run `.\build.ps1`, upload `dist\segue-<version>.zip`.
3. **Availability**: *Public* (or *Hidden* — installable through the store link
   only, not searchable, which is enough for "install it on every machine").
   Markets: all.
4. **Properties**: category *Productivity*; privacy policy URL (see below);
   support contact e-mail; no in-app purchases, no ads.
5. **Store listing** (English): the texts in this file; the logo
   `store\logo-300.png` (300×300 PNG); at least one screenshot, 640×480 or
   1280×800 PNG — the context menu with the *Send link to window* submenu open
   is the one that explains the extension.
6. **Notes for certification**: the permission justifications below, verbatim.
7. Submit. Certification usually takes a few working days; the listing then
   appears at `https://microsoftedge.microsoft.com/addons/detail/<id>`.

A new version is the same form with a new package: bump `version` in
`manifest.json`, run `build.ps1`, upload, submit.

### Privacy policy URL

Both stores require a public URL. The repository is public, so
`PRIVACY.md` serves directly:

    https://github.com/ibst1/segue/blob/main/PRIVACY.md

The same address goes in the *Support* / *Website* fields if nothing better
exists.

## Listing texts

**Name**: Segue

**Short description** (max 132 characters):

> Right-click a link and send it to another browser window, or Alt-click to send it to a window you named once.

**Detailed description**:

> Segue moves links and tabs between browser windows without dragging.
>
> **Right-click a link** and two submenus list every open window: *Send link to window* opens the link there using your defaults, *Send link to window and switch to it* overrides them for that one click. Windows are listed by the name you gave them, or by the title of their active tab.
>
> **Alt-click a link** to send it straight to the window you chose once, no menu. Alt+Shift-click inverts the defaults for that click.
>
> **The toolbar button** names the current window and makes it the Alt-click target. The name can be mirrored into the window title, so the window can be found by name from outside the browser too.
>
> **Keyboard**: Alt+Shift+Left / Alt+Shift+Right move the current tab to the previous / next window.
>
> Options: select the new tab in its window, bring the target window to the front, show window ids and sizes in the menu, show the address next to the window name, and catch links opened from other programs so they land in the target window.
>
> Segue runs entirely inside the browser. It stores your settings and window names in the browser's own extension storage and sends nothing anywhere.

**Search terms**: window, tab, link, move tab, send link, context menu, multiple windows, multi-monitor

**Category**: Productivity

## Permission justifications (Notes for certification)

> **contextMenus** — the *Send link to window* submenus on links are the main
> feature.
>
> **tabs** — to list the open windows with the title of their active tab (the
> label in the menu when a window has no name), to open the link as a tab in
> the chosen window, and to move the current tab between windows with the
> keyboard commands.
>
> **storage** — `storage.sync` keeps the options; `storage.session` keeps the
> window names, which are only meaningful for the current browser session.
>
> **Content script on `<all_urls>`, all frames, at document_start** — two jobs
> that can only be done inside the page: (1) Alt-click on a link must be
> intercepted before the page's own handlers, so a capture-phase click listener
> is installed on every page, including frames, because links live inside
> iframes too; (2) with the "mirror name into title" option on, the window's
> name is appended to `document.title` of the top document, which is the only
> way a window name can reach the operating system's window title. The script
> reads nothing else from the page, sends only the clicked link's URL to the
> extension's own service worker, and makes no network requests.
>
> No remote code, no analytics, no data leaves the browser.
