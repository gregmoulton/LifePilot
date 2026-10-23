/* Transaction boundary around the existing v0.4 handlers. */
'use strict';
const profileStore = LifePilotStorage.open({
  storage: { getItem: key => localStorage.getItem(key), setItem: (key, value) => localStorage.setItem(key, value), removeItem: key => localStorage.removeItem(key) },
  key: KEY,
  locks: globalThis.navigator?.locks
});
profile = profileStore.value;
let writeRequested = false, transactionDepth = 0, transactionRunning = false;
let transactionQueue = Promise.resolve(), deferredNotices = [], unsavedProfile = null;
const originalRender = render, originalNotify = notify;
function storageWarning(message) {
  const box = $('storageWarning');
  box.hidden = !message;
  $('storageMessage').textContent = message;
  $('unsavedExport').hidden = unsavedProfile === null;
}
function downloadLocalData(text, filename) {
  if (text === null) { originalNotify('No backup is available.'); return; }
  const url = URL.createObjectURL(new Blob([text], { type: 'application/json' }));
  const link = document.createElement('a');
  link.href = url; link.download = filename; link.click();
  setTimeout(() => URL.revokeObjectURL(url), 1000);
}
function exportRecovery(kind) {
  try {
    const text = kind === 'unsaved' ? JSON.stringify(unsavedProfile, null, 2) : kind === 'backup' ? profileStore.backup() : kind === 'original' ? profileStore.recoveryOriginal() : profileStore.raw();
    downloadLocalData(text, 'LifePilot_' + kind + '_Recovery.json');
  } catch (_) { storageWarning('Browser storage is unavailable. Keep this page open and allow browser storage before trying again.'); }
}
render = function () { if (!transactionRunning) originalRender(); };
notify = function (message) { if (transactionRunning) deferredNotices.push(message); else originalNotify(message); };
save = function () {
  if (!transactionRunning) throw Error('Profile changes must use a save transaction.');
  writeRequested = true;
};
switchProfile = function () {
  if (!confirm('Export a backup before switching. Remove this profile from this browser and return to Start Fresh / Import?')) return;
  profile = null; tab = 'dashboard'; save(); render();
};
function transactional(handler) {
  return function (...args) {
    // Keep nested calls synchronous: existing approval/log helpers return records.
    if (transactionDepth) return handler.apply(this, args);
    args[0]?.preventDefault?.();
    const run = async () => {
      if (!profileStore.writable) { storageWarning(profileStore.reason); return; }
      if (unsavedProfile !== null) { storageWarning('Unsaved changes are waiting for download. Download them, then reload before making more changes.'); return; }
      const before = profileStore.value;
      transactionRunning = true; writeRequested = false; deferredNotices = [];
      document.querySelectorAll('#app button, #app input, #app select, #app textarea').forEach(el => { el.disabled = true; });
      try {
        transactionDepth++;
        let result;
        try { result = handler.apply(this, args); } finally { transactionDepth--; }
        result = await result;
        if (writeRequested) await profileStore.commit(profile);
        else profile = before; // A caught legacy error must not leak a partial mutation.
        unsavedProfile = null;
        storageWarning('');
        if (writeRequested) deferredNotices.forEach(originalNotify);
        return result;
      } catch (error) {
        // Preserve the attempted version for local download; never claim it saved.
        unsavedProfile = profile === null ? before : JSON.parse(JSON.stringify(profile));
        profile = before;
        storageWarning(error.name === 'LifePilotStorageError' ? error.message : 'Save failed. The last saved profile is shown. Download unsaved changes before reloading. Check browser storage and close other editing tabs.');
        return undefined;
      } finally {
        transactionRunning = false;
        originalRender();
      }
    };
    const operation = transactionQueue.then(run);
    transactionQueue = operation.catch(() => {});
    return operation;
  };
}
for (const name of ['fresh', 'setStatus', 'submitGoal', 'addDecision', 'saveLabel', 'importFile', 'switchProfile', 'createStructure', 'createTask', 'completeTask', 'taskResult', 'recordObservation', 'proposeReview', 'explainMisses', 'approveAdjustment', 'approveReview', 'rejectReview', 'finishExperiment', 'recordImprovement', 'submitImprovement']) {
  if (typeof globalThis[name] === 'function') globalThis[name] = transactional(globalThis[name]);
}
render();
if (!profileStore.writable) storageWarning(profileStore.reason);

function restoreLocalBackup(file) {
  const run = async () => {
    if (unsavedProfile !== null) { storageWarning('Download unsaved changes and reload before restoring a backup.'); return; }
    try {
      const raw = file ? await file.text() : profileStore.backup();
      if (raw === null) { storageWarning('No previous backup is available. Choose a profile backup file instead.'); return; }
      const candidate = JSON.parse(raw);
      if (!LifePilotStorage.validProfile(candidate)) { storageWarning('This backup is invalid. No stored data was changed.'); return; }
      if (!confirm('Restore this backup and replace the displayed profile? The original stored bytes will be retained as a separate recovery copy.')) return;
      profile = await profileStore.restore(candidate, file ? undefined : raw);
      tab = 'dashboard';
      originalRender(); storageWarning('Backup restored on this device. The replaced data remains available under Download pre-recovery data.');
      originalNotify('Backup restored successfully');
    } catch (error) {
      storageWarning(error.name === 'LifePilotStorageError' ? error.message : 'Restore failed. No success was recorded. Keep this page open and download the stored data and previous backup.');
    }
  };
  const operation = transactionQueue.then(run);
  transactionQueue = operation.catch(() => {});
  return operation;
}
