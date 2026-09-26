(function (root) {
  'use strict';
  const $ = id => document.getElementById(id), esc = value => String(value ?? '').replace(/[&<>"']/g, c => ({ '&':'&amp;', '<':'&lt;', '>':'&gt;', '"':'&quot;', "'":'&#39;' }[c]));
  function summary(text) {
    const { state, savedAt } = root.WTTNFullBackup.parse(text);
    const buildings = Object.values(state.producers).reduce((n, p) => n + Number(p?.owned ?? p ?? 0), 0);
    return `<dl class="cloud-summary"><div><dt>Last played</dt><dd>${esc(new Date(savedAt).toLocaleString())}</dd></div><div><dt>Translations / Networks / Legacies</dt><dd>${state.translations} / ${state.networks} / ${state.legacies}</dd></div><div><dt>Settlement workforce / capacity</dt><dd>${buildings}</dd></div><div><dt>Pages</dt><dd>${esc(state.pages.format(2))}</dd></div></dl>`;
  }
  function init(host) {
    let sync, adapter, actionBusy = false, history = [], historyUser = null, storageError = '';
    const panel = $('accountPanel');
    const action = (id, label, primary = false) => `<button type="button" data-account="${id}" ${actionBusy || sync?.model().busy ? 'disabled' : ''} class="${primary ? 'primary' : ''}">${label}</button>`;
    function render(m = sync?.model()) {
      const labels = { checking: 'Checking account…', guest: 'Playing on this device', ready: navigator.onLine === false ? 'Saved on this device · waiting to sync' : 'Cloud saves connected', offer: 'Back up this settlement', conflict: 'Two versions of your settlement need review', deleted: 'Cloud progress deleted', expired: 'Session expired', unavailable: 'Account temporarily unavailable', 'local-error': 'Local recovery needs attention' };
      let controls = '';
      if (m?.state === 'expired') controls += action('login', 'Sign in with Google', true);
      if (m?.user) {
        if (m.state === 'offer' || m.state === 'deleted') controls += action('local', m.state === 'deleted' ? 'Enable cloud backup again' : 'Back up this settlement', true);
        if (m.state === 'conflict') controls += action('local', 'Continue this device’s settlement') + action('cloud', 'Continue the cloud settlement', true);
        if (m.enabled && ['ready','unavailable'].includes(m.state)) controls += action('sync', 'Sync now', true);
        controls += action('history', 'Recovery snapshots') + action('logout', 'Sign out on this browser');
      } else if (m?.state === 'guest') controls += action('login', 'Sign in with Google', true);
      if (['unavailable','expired','local-error'].includes(m?.state) || !m) controls += action('retry', 'Retry connection');
      const compare = m?.state === 'conflict' && m.remote?.snapshot ? `<div class="cloud-comparison"><section><h4>This device</h4>${summary(m.local)}</section><section><h4>Cloud settlement</h4>${summary(m.remote.snapshot)}</section></div><p>Choose one complete settlement. We keep a recovery copy of the other; resources and resets are never merged.</p>` : '';
      const recoveries = historyUser === m?.user?.id ? history.map((item, index) => `<li><strong>Revision ${item.revision}</strong> · ${esc(new Date(item.savedAt).toLocaleString())} ${action('recover-' + index, 'Download backup')}</li>`).join('') : '';
      root.WTTNView.patch(panel, () => `<header><p class="eyebrow">ONE THIEPN ACCOUNT</p><h3>Account &amp; cloud saves</h3></header><p class="cloud-status" role="status">${esc(labels[m?.state] || 'Account temporarily unavailable')}${m?.busy ? ' · Working…' : ''}</p>${m?.user ? `<p class="cloud-identity">${esc(m.user.email || 'Signed in to THIEPN')}</p>` : ''}<p>${m?.user ? 'Your settlement stays playable offline. Cloud backup lets you continue on another device.' : 'Play freely on this device. Sign in to back up your settlement and continue on another device.'}</p>${m?.user && m?.lastSync ? `<p class="fineprint">Last cloud sync: ${esc(new Date(m.lastSync).toLocaleString())}</p>` : ''}${compare}<div class="system-actions">${controls}</div><p role="status" class="cloud-error">${esc(storageError || m?.error || '')}</p>${recoveries ? `<details open><summary>Recoverable cloud snapshots</summary><ol class="cloud-history">${recoveries}</ol></details>` : ''}<details><summary>Save safety &amp; account options</summary><p>Cloud backups include campaign progress, purchasing plans, reading bookmarks and decoration placements. Quality, motion and audio stay on this device. Offline progress is automatic.</p><p>Signing out here also signs out the shared THIEPN session on this browser. Other devices stay signed in. Guest progress is separate.</p><div class="system-actions">${action('export', 'Export current full backup')}${action('recovery', 'Export local recovery')}${action('cloud-recovery', 'Export replaced cloud copy')}${m?.user ? action('delete', 'Delete WTTN cloud progress') : ''}</div><p class="fineprint">Deleting cloud progress also removes its cloud recovery history. Your current local settlement remains on this device. Deleting your THIEPN account removes its WTTN cloud data.</p><a href="./PRIVACY.md" target="_blank" rel="noopener">Privacy &amp; saved data</a></details>`);
    }
    function download(text, name = 'wttn-full-backup') {
      if (!text) throw new Error('No recovery snapshot is available yet.');
      root.WTTNFullBackup.parse(text);
      const url = URL.createObjectURL(new Blob([text], { type: 'application/json' })), a = document.createElement('a');
      a.href = url; a.download = `${name}-${new Date().toISOString().slice(0,10)}.json`; a.click(); setTimeout(() => URL.revokeObjectURL(url), 30000);
    }
    try {
      if (!host.tabGuardSupported) throw new Error('Cross-tab protection is unavailable.');
      sync = root.WTTNCloudSync.create({ storage: localStorage, initial: host.capture(), capture: host.capture, apply: host.apply,
        validate: text => root.WTTNFullBackup.parse(text), meaningful: host.meaningful, fresh: host.fresh, notify: render });
    } catch (_) { storageError = host.tabGuardSupported ? 'Account linking is paused because a verified local recovery copy could not be created. Export your progress and restore browser storage first.' : 'Cloud linking needs a browser with secure cross-tab protection. Guest play and export remain available; try an up-to-date browser.'; }
    adapter = root.WTTNAccount.create({ onChange: change => {
      if (!sync) return render();
      if (change.status === 'unavailable') return sync.unavailable(change.category);
      void sync.attach(change.user, change.account ? root.WTTNCloudRepository.create(change.account.client) : null);
    } });
    panel.addEventListener('click', async event => {
      const button = event.target.closest('[data-account]'); if (!button || actionBusy) return;
      const command = button.dataset.account; actionBusy = true; storageError = ''; render();
      try {
        if (command === 'export') download(host.capture());
        else if (command === 'recovery') download(sync?.recovery(), 'wttn-local-recovery');
        else if (command === 'cloud-recovery') download(sync?.cloudRecovery(), 'wttn-cloud-recovery');
        else if (!sync) throw new Error('Restore browser storage and reload before linking an account.');
        else if (command === 'login') {
          if (!host.save()) throw new Error('Save locally or export before leaving for sign-in.');
          await adapter.start(); if (!adapter.account) throw new Error('Account service unavailable. Try again when online.');
          await adapter.account.signInWithGoogle();
        } else if (command === 'retry') { await adapter.start(); await sync.retry(); }
        else if (command === 'sync') { host.save(); await sync.sync({ force: true }); }
        else if (command === 'local' || command === 'cloud') {
          if (command === 'cloud' && !await host.ask('Continue the cloud settlement? Your current settlement will be kept in local recovery.', 'Choose a settlement')) return;
          if (command === 'local' && sync.model().state === 'conflict' && !await host.ask('Replace the cloud settlement with this device’s settlement? The cloud version will remain recoverable.', 'Choose a settlement')) return;
          host.save(); await sync.choose(command);
        } else if (command === 'logout') {
          if (!host.save()) throw new Error('Keep this tab open and export before signing out.');
          const uploaded = await sync.sync({ force: true });
          if (sync.model().enabled && !uploaded && !await host.ask('Cloud saving has not completed. Your settlement is retained under this account on this device. Sign out anyway?', 'Unsynced local progress')) return;
          await adapter.account.signOut({ scope: 'local' });
        } else if (command === 'delete') {
          if (!await host.ask('Delete WTTN cloud progress and all five cloud recovery snapshots? Other devices cannot automatically upload it again. Local progress stays on this device.', 'Delete cloud progress?')) return;
          await sync.remove(); history = [];
        } else if (command === 'history') {
          const id = sync.model().user.id;
          const values = await root.WTTNCloudRepository.create(adapter.account.client).history();
          if (id !== sync.model().user?.id) return;
          values.forEach(item => root.WTTNFullBackup.parse(item.snapshot)); history = values; historyUser = id;
          if (!values.length) storageError = 'No recovery snapshots yet. Significant changes and replacements retain up to five snapshots.';
        } else if (command.startsWith('recover-')) download(history[Number(command.slice(8))]?.snapshot, 'wttn-cloud-recovery');
      } catch (error) { storageError = ['export','recovery','cloud-recovery'].includes(command) ? error.message : command === 'login' ? 'Sign-in could not start. Save or export your progress, check your connection, and retry. The THIEPN Google provider and game callback must be configured.' : 'This action could not finish. Your current local progress is retained; retry when connected.'; }
      finally { actionBusy = false; render(); }
    });
    render(); void adapter.start();
    const timer = setInterval(() => { if (navigator.onLine !== false) void sync?.sync(); }, 5000);
    root.addEventListener('online', () => { void adapter.start(); void sync?.retry(); });
    root.addEventListener('offline', () => render());
    root.addEventListener('storage', event => {
      if (event.key === sync?.ownerKey && !sync.canSave()) { sync.suspend(); storageError = 'The active account changed in another tab. Export this tab if needed, then reload to continue safely.'; render(); }
    });
    return { changed: significant => sync ? sync.localChanged(significant) : true, canSave: () => {
      try { return sync ? sync.canSave() : !localStorage.getItem(root.WTTNCloudSync.OWNER); } catch (_) { return !sync; }
    }, destroy: () => { clearInterval(timer); adapter.destroy(); }, render };
  }
  root.WTTNAccountPanel = { init };
})(globalThis);
