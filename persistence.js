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
    const text = kind === 'unsaved' ? JSON.stringify(unsavedProfile, null, 2) : kind === 'backup' ? profileStore.backup() : profileStore.raw();
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
      if (profileStore.blocked) { storageWarning(profileStore.reason); return; }
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
        unsavedProfile = null;
        storageWarning('');
        deferredNotices.forEach(originalNotify);
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
if (profileStore.blocked) storageWarning(profileStore.reason);
