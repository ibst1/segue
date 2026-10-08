const DEFAULTS = {
  activateTab: false, focusWindow: false, showDetails: false, quickTarget: '',
  mirrorTitle: false, catchExternal: false, urlMode: 'off',
  markPopup: false, sameSite: false
};

const el = id => document.getElementById(id);

function flash(text) {
  el('saved').textContent = text;
  setTimeout(() => { el('saved').textContent = ''; }, 1400);
}

(async () => {
  const o = Object.assign({}, DEFAULTS, await chrome.storage.sync.get(DEFAULTS));
  el('activateTab').checked = !!o.activateTab;
  el('focusWindow').checked = !!o.focusWindow;
  el('showDetails').checked = !!o.showDetails;
  el('mirrorTitle').checked = !!o.mirrorTitle;
  el('catchExternal').checked = !!o.catchExternal;
  el('sameSite').checked = !!o.sameSite;
  el('urlMode').value = o.urlMode || 'off';
  el('markPopup').checked = !!o.markPopup;
  el('quickTarget').value = o.quickTarget || '';

  // Saved as they change: an options page with four fields and a Save button
  // is a button you will forget to press.
  const save = async () => {
    await chrome.storage.sync.set({
      activateTab: el('activateTab').checked,
      focusWindow: el('focusWindow').checked,
      showDetails: el('showDetails').checked,
      mirrorTitle: el('mirrorTitle').checked,
      catchExternal: el('catchExternal').checked,
      sameSite: el('sameSite').checked,
      urlMode: el('urlMode').value,
      markPopup: el('markPopup').checked,
      quickTarget: el('quickTarget').value.trim()
    });
    flash('Saved');
  };

  for (const id of ['activateTab', 'focusWindow', 'showDetails', 'mirrorTitle',
                    'catchExternal', 'sameSite', 'urlMode', 'markPopup',
                    'quickTarget'])
    el(id).addEventListener('change', save);
  el('quickTarget').addEventListener('blur', save);
})();
