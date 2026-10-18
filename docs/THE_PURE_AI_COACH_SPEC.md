# The Pure — AI Coach Personalities & Event-Driven Motivation

**Decision captured:** October 18, 2026
**Status:** Product concept approved for preservation; implementation, pricing and launch not approved.
**Project:** The Pure workout application (distinct from the Life Pilot operating system and Prime Life Recovery business).

## Vision

Make the workout experience feel coached rather than merely tracked. Let each user select from multiple clearly differentiated AI Coach personalities and **switch coaches whenever they wish**, including during an active workout. The coaching style changes; the user's exercise data, workout protocol, and safety controls do not.

A **potential paid / premium feature** if The Pure is commercialized: expanded AI voices, personas, and adaptive live coaching. Pricing, tier boundaries, provider costs, privacy arrangements, and commercialization remain decisions for later. A user should be able to exercise and view their own data without needing the premium coach.

## Personalities — initial concepts

- **Drill Sergeant:** Loud, intense, rough language / profanity if explicitly chosen, direct action cues. Example at recovery: "110! REST IS OVER! GET OFF YOUR ASS AND MOVE!"
- **Zen Hippie:** Calm, reassuring, playful yoga-instructor persona. Example at recovery: "You've found your rhythm. Gently return to your next movement, and enjoy the flow."
- Future: build a growing, extensible coach library (e.g. sports trainer, straightforward minimal coach, playful coach), allow choice and instant switching, with optional separate intensity/profanity and voice controls. These are additional concepts, not a fixed approved lineup.

## Coaching opportunities / event triggers

1. **Workout / exercise start:** A short get-ready cue; respects user-selected audio settings.
2. **During each exercise:** Optional short encouragement when the recorded heart-rate trace indicates increasing effort / an individually high observed HR, without equating HR alone with effort, form, fitness, or safe exertion.
3. **End of movement / start of rest:** When the user actively marks a set/exercise as completed (or future trustworthy auto-rep/movement detection confirms it), coach tells user they can rest. Heart rate by itself must not infer that exercise is finished.
4. **Recovery checkpoint:** After a complete circuit, when the connected HW401 supplies a **credible** heart-rate reading at or below the trial threshold **110 BPM**, issue the chosen coach's **immediate** round-ready cue. Current experiment: zero added 30-second minimum and zero added 10-second delay; handle spurious readings with minimal confirmation and log that logic, not an arbitrary long pause.
5. **Resuming exercise:** Capture both checkpoint-reached time and actual movement-start time / BPM, to quantify real delay after the alert. Alert does not automatically begin an exercise.
6. **Future automated rep counting:** Enable context-aware prompts during reps, near a genuine prior record, after completion, on a measured unlock, and at exercise transitions. **Not implemented; accuracy and permission required.**

## The Pure workout context

- The October 15, 2026 baseline test date is known. No assumed numeric maximums or fictional completed sessions.
- Trial protocol: each round consists of the maximum number of **clean, technically acceptable** repetitions; log each round's reps and variation separately.
- Recovery 110 BPM is a **user-selected experimental checkpoint**, not a universal physiological readiness or safety threshold.
- Store heart-rate readings and timing (where consented/available), exercise name, round index, round completion, current coach and cue type. Keep historical rule/settings snapshots when changed.
- Exercise ladder and unlock criteria are provisional and data-driven; no silent promotion to a harder rung.
- Stop or skip coaching when safety / technique / user intent warrants it; a coach must never insist the user ignore warning symptoms or push beyond safe form.

## Coach engine implementation guidance

- Separate a **deterministic, auditable trigger engine** from the personality content layer. One recovery event triggers one cue independent of coach.
- Start with an offline library of voice/text scripts and browser speech synthesis. Later evaluate paid AI-generated adaptive messages and more natural voice; no paid APIs without specific approval.
- Throttle and prioritize cues to prevent overlapping speeches, spam, and distraction; respect audio focus and Bluetooth/headset route.
- User controls: select/switch coach anytime, preview voice, volume, mute/quiet mode, opt into coarse or profane language, disable in-exercise cues, and choose visual-only alerts.
- In-session personality switching affects **future** cues and does not alter workout results or thresholds.
- The heart rate monitor measures cardiovascular response, not exercise technique, readiness, perceived effort, or safety; prompts should reflect this limitation.
- Mobile browsers may block speech/vibration without user interaction or in the background; always provide visible cues and manual recovery/round controls.
- Protect workout history and privacy. Do not transmit health/heart-rate data to third-party AI providers without separate consent and approved integration.

## Test-pilot and research opportunities

The first user's real-world tests provide initial usability / behavior data, not evidence that a style is universally more effective.

Log coach persona, cue event/time, heart rate (when available), time until the next exercise starts, actual reps/quality, missed / skipped rounds, and self-reported usefulness if opted in. This can support later comparison of prompt styles and evidence-based iteration, distinguishing correlations from causal effects.

## Scope & delivery

This is a saved **future product feature** and commercialization hypothesis. It does not assert live AI voice generation, automated rep counting, or automatic exertion recognition in the current prototype. Priority next: verify immediate 110 BPM round-ready audio reliably on the actual HW401 and headset; then test coach switching with deterministic scripts in an isolated build. Do not alter the user's live version or existing workout records without review.
