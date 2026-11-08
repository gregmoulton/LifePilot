# The Pure — finish-line sprint / owner acceptance

Status: **working plan, not a release certificate**. Branch `design/the-pure-polish-preview-20261106` is an isolated visual overlay on HIT 1.6. Do not merge into main, replace v0.4, publish to the live origin, or use real workout data until owner accepts.

## Scope lock
1. Visual polish using earlier THE PURE wordmark and HIT 1.6 workout focus screen.
2. Verified-save and reload, partial save, practice isolation, and safe offline fallback.
3. Voice and MOOFIT HRM physical Android acceptance.
4. Instant deterministic workout report; asynchronous optional AI commentary; never block report or falsely say cloud-synced.
5. Recovery cooldown: capture until first <=110 BPM, five qualifying seconds (up to 113 tolerated), then finalize; >113 resets during qualification, stale data never qualifies. If not reached, report honestly.
6. Native share/copy report, optional and user-initiated; no paid SMS or email service.

## Evidence currently available
- Parent HIT 1.6 PR #74: 95 Node tests passing and managed Chromium viewport smoke, as reported in its Android readiness notes; real Android Bluetooth, mic and background behavior **not verified**.
- Visual overlay PR #98: CSS-only appearance changes plus stylesheet link; no claim of browser acceptance or deployment.
- No verified isolated HTTPS URL for PR #98 yet. A code or source proxy URL is not proof of deployment.

## Owner demo checklist (Android Chrome, isolated HTTPS preview)
- [ ] Link loads the correct build; clearly labeled TEST / practice; no redirects to live v0.4.
- [ ] Screen looks polished at phone width; no clipped controls, awkward scroll, or hidden primary action.
- [ ] Start and countdown; 3 synthetic rep counts by voice; manual fallback.
- [ ] MOOFIT BLE connects, updates live BPM, and reconnects after interruption.
- [ ] Inter-round recovery respects threshold, tolerance, freshness and five-second latch.
- [ ] Conditioning voice input resumes without repeatedly enabling the microphone.
- [ ] Finish shows immediate local report; cooldown keeps recording; final recovery displayed.
- [ ] Turn network off: local report still available; AI failure cannot block results.
- [ ] Save and reload: session persists with verified readback; practice data not in real history.
- [ ] Optional native share or copy does not send automatically.
- [ ] Confirm Android foreground/background constraints explicitly rather than assuming desktop simulations apply.
- [ ] Owner approves visuals and behavior before any external tester.

## Coordination
Claude's actual current branch, commits, and check scope must be inspected before cherry-picking or merging. Do not overwrite its work or claim its safety checks passed without artifacts. Keep independent review branches isolated and record evidence with timestamps.

## Deferred
20-workout T-shirt incentive and filmed verification; AI coach personalities; automatic email/SMS. No purchases or collection of tester videos authorized.
