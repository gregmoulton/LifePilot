# The Pure phone V2 — verified save

Live reference: https://cozy-pixie-686e61.netlify.app/

This is the live approved phone page with verified local saves. It is a different file from `prototypes/the-pure-mobile` and from Life Pilot v0.4 on GitHub Pages.

- Storage key: `the-pure-phone-approved-v2`
- Schema: `version: 2`
- Rollback copy: `rollback/index.html`
- Rollback SHA-256: `1e84270e7a9550eb4c2298e3ea643eaa036ddc15ecca35387173cd4cdacd76d1`
- That rollback file is the byte copy of the live page fetched October 31, 2026, 6:45 PM Arizona.

The phone screen, storage key, and version 2 record shape are unchanged. Saves now read back, failed writes restore the last verified snapshot, unreadable existing data is left in place, and End session early archives one partial history entry. A second archive of the same session is ignored. History entries already on the phone stay in the array (the existing 25-session cap is unchanged).

## Tests

From the repository root:

```
node --test prototypes/the-pure-phone-v2/save-v2.test.cjs
```

The suite drives this page's buttons (`#action`, `#pause`, `#endEarly`, `#newWorkout`, and the rep plus control). It covers reload, a thrown write, a read-back mismatch, malformed storage, a broken history value, and duplicate early-end clicks.

## Deploy to the live Netlify site

Do not publish this whole directory. Publishing it would let `rollback/index.html` or the test file compete with the patched page.

1. Confirm the site hostname is `cozy-pixie-686e61.netlify.app` and the current production HTML contains `the-pure-phone-approved-v2`.
2. In Netlify, confirm the current production deploy can be republished. Keep `rollback/index.html` as a second copy.
3. Copy only `index.html` into an empty folder. Deploy that folder to the existing site (Netlify → Deploys → deploy manually, or `netlify link` to this site and `netlify deploy --prod --dir <that-folder>`).
4. Reload https://cozy-pixie-686e61.netlify.app/ and confirm the source contains `pure-phone-v2 verified-save` and `Stored workout did not verify on read-back`. The footer should still say `V3.1 test`.
5. To undo it, use Netlify's Publish deploy on the previous production deploy, or publish `rollback/index.html` as the site `index.html`. Do not clear the phone's site data.

GitHub Pages (`https://gregmoulton.github.io/LifePilot/`) and Render (`https://lifepilot-wbcf.onrender.com/`) are different origins. Deploying there does not change the phone app and does not share its saved workouts.

This environment has no Netlify login. The site API returns 401, and the live site was not modified.
