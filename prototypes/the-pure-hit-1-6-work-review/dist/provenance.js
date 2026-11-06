(function () {
  'use strict';

  const shaPattern = /^[a-f0-9]{40}$/;
  const utcPattern = /^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}\.\d{3}Z$/;
  const phoenix = new Intl.DateTimeFormat('en-US', {
    timeZone: 'America/Phoenix', dateStyle: 'medium', timeStyle: 'medium'
  });

  function isUtc(value) {
    if (typeof value !== 'string' || !utcPattern.test(value)) return false;
    const time = new Date(value);
    return Number.isFinite(+time) && time.toISOString() === value;
  }

  function formatTime(value) {
    return isUtc(value) ? phoenix.format(new Date(value)) + ' MST' : 'Unknown';
  }

  function validate(build) {
    if (!build || !shaPattern.test(build.commit) || !isUtc(build.builtAt) ||
        !isUtc(build.updatedAt) || (build.createdAt !== null &&
          (!isUtc(build.createdAt) || build.createdAt > build.updatedAt)) || build.updatedAt > build.builtAt ||
        !build.project || !build.version || !build.branch || !build.repository ||
        !build.review || !build.environment || !build.status || !build.nextStep) {
      throw new Error('Build provenance is missing or invalid.');
    }
    if (build.origin !== null && new URL(build.origin).origin !== build.origin) {
      throw new Error('Build origin must be an exact origin.');
    }
    if (build.status === 'deployed' && !build.deployed) {
      throw new Error('Deployment evidence is required for deployed status.');
    }
    for (const field of ['automatedTest', 'deployed', 'androidTest', 'ownerAccepted']) {
      const evidence = build[field];
      if (evidence === null) continue;
      if (!evidence || !isUtc(evidence.at) || evidence.commit !== build.commit ||
          typeof evidence.reference !== 'string' || !evidence.reference.trim()) {
        throw new Error('Missing or conflicting evidence for ' + field + '.');
      }
      if (field !== 'automatedTest' && (evidence.origin !== build.origin ||
          !build.origin || evidence.at < build.builtAt)) {
        throw new Error('Evidence must match this origin and build time.');
      }
    }
    if (build.ownerAccepted && (!build.androidTest || build.ownerAccepted.at < build.androidTest.at)) {
      throw new Error('Owner acceptance requires matching physical test evidence.');
    }
    if (build.status === 'verified' && !build.ownerAccepted) {
      throw new Error('Verified status requires owner acceptance evidence.');
    }
    return build;
  }

  function checkLocation(build, href) {
    validate(build);
    const url = new URL(href);
    if (build.origin && url.origin !== build.origin) return 'This copy is on a different origin.';
    const expected = url.searchParams.get('build');
    if (expected !== null && expected !== build.commit) return 'This URL expects a different commit. Open the current review link.';
    return null;
  }

  if (typeof module === 'object') {
    module.exports = { formatTime, validate, checkLocation };
    return;
  }

  const packet = document.getElementById('handoffPacket');
  if (!packet) return;
  const summary = document.getElementById('buildSummary');
  const copy = document.getElementById('copyHandoff');
  const feedback = document.getElementById('buildFeedback');

  copy.addEventListener('click', async () => {
    try {
      await navigator.clipboard.writeText(packet.value);
      feedback.textContent = 'Work handoff copied.';
    } catch {
      packet.select();
      feedback.textContent = 'Select and copy the handoff text.';
    }
  });

  fetch('build-info.json', { cache: 'no-store' })
    .then(response => {
      if (!response.ok) throw new Error('Build manifest unavailable.');
      return response.json();
    })
    .then(build => {
      const conflict = checkLocation(build, location.href);
      if (conflict) throw new Error(conflict);
      summary.textContent = build.version + ' · ' + build.environment + ' · ' + build.commit.slice(0, 12);
      const evidenceTime = evidence => evidence
        ? formatTime(evidence.at) + ' (' + evidence.at + ') · ' + evidence.reference : 'Pending';
      const time = at => at === null ? 'Unknown' : formatTime(at) + ' (' + at + ')';
      packet.value = [
        build.project + ' · ' + build.version,
        'Status: ' + build.status,
        'Review: ' + build.review,
        'Issue: ' + (build.issue || 'Unknown'),
        'Branch: ' + build.branch,
        'Commit: ' + build.commit,
        'Source: https://github.com/' + build.repository + '/commit/' + build.commit,
        'Environment: ' + build.environment,
        'Origin: ' + (build.origin || 'Unknown'),
        'Created: ' + time(build.createdAt),
        'Last updated (source): ' + time(build.updatedAt),
        'Built: ' + time(build.builtAt),
        'Automated tests: ' + evidenceTime(build.automatedTest),
        'Deployed: ' + evidenceTime(build.deployed),
        'Android physical test: ' + evidenceTime(build.androidTest),
        'Owner accepted: ' + evidenceTime(build.ownerAccepted),
        'Last verified (owner): ' + evidenceTime(build.ownerAccepted),
        'Data: ' + build.storage,
        'Next: ' + build.nextStep
      ].join('\n');
      copy.disabled = false;
    })
    .catch(error => {
      summary.textContent = 'Build identity unavailable';
      packet.value = error.message;
      document.getElementById('buildDetails').open = true;
      feedback.textContent = 'Confirm the preview version before using it.';
    });
})();
