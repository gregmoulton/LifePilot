# THE PURE — OWNER-LOCKED VISUAL DESIGN CONTRACT
Approved by owner November 9, 2026. Applies to ALL AI agents (ChatGPT, Work, Claude, Codex) modifying The Pure. Do not reinterpret or replace the design without owner approval.

## Canonical image — exact visual source of truth
The owner-approved render is the **Workout Complete** screen, generated asset named `a_high_contrast_dark_navy_black_fitness_app_summar.png` in the owner's ChatGPT conversation. It depicts a near-black/navy mobile screen with a small centered *italic rainbow-gradient PURE* wordmark (pink/yellow/green/blue, cyan E bars), left back arrow, green Workout Complete check, three short electric-blue progress bars, compact side-by-side Round 1 / Round 2 / Σ Total cards, Exercise Performance rows, AI Performance Grade, Heart Rate & Recovery with red heart and cyan line chart, Estimated Energy with orange flame and blue kcal badge, compact disclaimer, bright blue Start New Workout CTA, and cyan Export Results. All displayed figures are illustrative, not real workout data.

**Important:** An older file `The_Pure_Approved_Design_Reference.jpg` depicts a DIFFERENT older three-round UI with a giant voice button; it is NOT the canonical render. Likewise the screenshot of the current functional prototype with large HRM control panel and white THE PURE logo is NOT the approved visual. Do not use either as design authority.

The original PNG must be placed where implementing agents can inspect it; this markdown alone is NOT an adequate visual substitute. If you cannot see the canonical image, explicitly report BLOCKED ON REFERENCE IMAGE instead of guessing or generating another logo.

## Immutable visual rules
- Premium, extremely compact, elegant dark/navy mobile-native presentation. Not generic web forms or stacked large accordions.
- The **exact** small italic rainbow PURE wordmark shown in the canonical render is the identity. No separate logo required. Prior generic SVG recreation was rejected.
- Purposeful vivid icons: red heart for HR, green for readiness/positive recovery, blue/cyan for progress/controls, orange flame for energy, blue sparkle for grade.
- Small polished dark cards, tight spacing, high contrast, clear type hierarchy, blue segmented progress indicators, one obvious bright-blue primary CTA per state.
- Use this SAME design language in Workout Ready, Round 1, HR recovery, 2:00 no-HRM timed recovery, Round 2, Pause/Resume, Reconnect, Workout Complete, History and Export. Layout may adapt to real functions; the design language may not be changed without owner approval.
- Display real values only; never hardcode the render's 32/24/56 reps, A−, 148/112 BPM or 284 kcal as actual data.

## Functional invariants
- Current protocol: **two rounds only**; Round 1 max effort, recovery, Round 2 conditioning; first 3 workouts calibrate. Push-ups, jump squats, inverted rows.
- Workout Ready is the first screen, with Connect HRM and Start Workout, compact weight status (recent synced scale if verified, else saved weight, else optional manual entry). Weight absence never blocks workout; calories not estimated without weight.
- Live HRM is preferred, NOT mandatory. No-HRM exception offers explicit 120-second adjustable timed recovery with READY + user-controlled Start Conditioning; never mislabel estimated/manual HR as measured.
- Live HR recovery preserves existing <=110 arm, <=112 for five seconds, >=113/stale/disconnect reset, latched READY, explicit Start Conditioning.
- Preserve BLE HRM connection/reconnection, live reading freshness, app-switch resume, durable session/rep/timer state, music-safe voice/chimes, pause/resume/end and workout history.
- Do not rewrite working functionality to restyle it. Regression-test every previously fixed behavior.

## Release acceptance
Require explicit agent acknowledgement of THIS document AND visual access to canonical image. Deliver current-commit Android Chrome preview, exact deployed SHA, regression test results, and screenshots of each phase for owner review. No spending, merge, or production deployment without owner approval.