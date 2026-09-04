const KEY = 'names';
const el = id => document.getElementById(id);

async function loadNames() {
  const got = await chrome.storage.session.get(KEY);
  return got[KEY] || {};
}

const esc = t => t.replace(/[<&]/g, c => ({ '<': '&lt;', '&': '&amp;' }[c]));

(async () => {
  const win = await chrome.windows.getCurrent();
  const id = String(win.id);
  const input = el('name');
  const box = el('isTarget');

  const names = await loadNames();
  const saved = names[id] || '';
  const opts = await chrome.storage.sync.get({ quickTarget: '' });

  input.value = saved;
  box.checked = !!saved && opts.quickTarget === saved;

  // The checkbox follows what is TYPED, not what is saved. Requiring a save
  // first meant naming a window and pointing Alt-click at it took two trips
  // through the popup; both are one Save now.
  const refresh = () => {
    const typed = input.value.trim();
    box.disabled = !typed;
    if (!typed) box.checked = false;

    const held = Object.entries(names).some(([k, v]) =>
      v === opts.quickTarget && k !== id);
    if (box.checked) {
      el('target').innerHTML = 'Alt-click will use <b>' + esc(typed) + '</b>';
    } else if (opts.quickTarget) {
      el('target').innerHTML = 'Currently: <b>' + esc(opts.quickTarget) + '</b>'
        + (held ? '' : ' &mdash; no window has this name yet');
    } else {
      el('target').textContent = typed
        ? 'No target set.' : 'Type a name to use this window as the target.';
    }
  };

  input.addEventListener('input', refresh);
  box.addEventListener('change', refresh);
  refresh();
  input.focus();
  input.select();

  // Name and target are written together, so the checkbox cannot refer to a
  // name that was never saved.
  const commit = async (name) => {
    const names = await loadNames();
    const old = names[id];
    if (name) names[id] = name;
    else delete names[id];          // an empty name falls back to the tab title
    await chrome.storage.session.set({ [KEY]: names });

    const o = await chrome.storage.sync.get({ quickTarget: '' });
    let target = o.quickTarget;
    if (box.checked && name) {
      target = name;                // also carries a rename across
    } else if (old && o.quickTarget === old) {
      target = '';                  // this window was the target and no longer is
    }
    if (target !== o.quickTarget) await chrome.storage.sync.set({ quickTarget: target });
    window.close();
  };

  el('save').addEventListener('click', () => commit(input.value.trim()));
  el('clear').addEventListener('click', () => { box.checked = false; commit(''); });
  input.addEventListener('keydown', e => {
    if (e.key === 'Enter') commit(input.value.trim());
  });

  el('opts').addEventListener('click', (e) => {
    e.preventDefault();
    chrome.runtime.openOptionsPage();
  });
})();
