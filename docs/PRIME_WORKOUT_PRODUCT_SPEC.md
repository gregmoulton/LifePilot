# Prime Workout — product specification v0.1

Status: approved product direction; implementation pending. Owner: Greg. Target: operational first-user MVP quickly, then public release. Commercialization optional; user value and demonstrated outcomes are primary.

## Product goals
- Greg is User #1 and field tester. Publicly usable app is the completion goal.
- Reuse LifePilot authentication, hosting, analytics and AI infrastructure when technically appropriate, while keeping workout experience usable as its own product.
- Connect Prime Workout measurements and training milestones to LifePilot Prime 90 Goal Stack.
- Keep costs low; obtain owner approval before incurring new charges.

## MVP capture schema
- User pseudonymous ID, consent policy version/time, workout/session IDs, timezone, timestamps.
- Exercise name, variation, units, load, sets, repetitions, effort/RPE if supplied, rest, duration, planned vs completed, notes.
- Baseline/retest metrics with protocols and measurement provenance, strength estimates and conditioning metrics.
- Session adherence, missed sessions, plateaus, regressions and optional recovery/context factors; do not require irrelevant sensitive data.
- Each observation tagged as measured, self-reported, calculated or predicted. Support data export and correction.

## Prediction engine
- Start with transparent within-user calculations (e.g. estimated strength trend, weekly percentage change, projections at days 30/90/120). Do not present mathematical extrapolations as certainty.
- Store every forecast with model version, date, data window, assumptions and uncertainty; later compare with observed results (error, calibration, bias).
- Personalize with the user's data; cautiously use aggregate cohort priors only after adequate quality/quantity and with clear disclosure. One user's history is not a validated population model.
- Do not use medical diagnoses or imply medical guidance from workout trends.

## Data contribution and privacy — required before public launch
- Public/free service may require explicit, informed consent to use specified workout and performance data for aggregate model improvement, where legally permissible. Explain the condition clearly before signup; no dark patterns or bundled consent for unrelated purposes.
- Collect only necessary data. Separate identifying account data from model-training data; use pseudonymization, access controls, retention limits, deletion and export mechanisms. Pseudonymization is not anonymity.
- Never sell personal data. No use for advertising or unrelated purposes without separate permission.
- Provide plain-language explanation of data categories, purposes, retention, withdrawal/deletion consequences and applicable rights. Review relevant privacy laws and age restrictions before launch. Consent withdrawal must stop future use where required; previously trained models may have limitations that must be accurately disclosed.
- Do not train cross-user models on personal data before the consent and privacy implementation is complete.

## Delivery milestones
1. Architecture and data schema.
2. First-user workout logging and reliable persistence.
3. Analytics dashboard and 30/90/120-day forecasts.
4. LifePilot Prime 90 integration and export.
5. Field testing, prediction-vs-outcome evaluation, security and privacy review.
6. Public beta and operational release.

## Acceptance criteria for first-user MVP
- Complete a real workout end-to-end, save/reopen/edit it without data loss, show baseline and trends, create versioned projections, export records, and surface a LifePilot progress summary.
- No claims of a live app or validated predictive accuracy until tested.

## User-defined goals and adaptive milestones
- Accept natural-language goal requests, such as six-month checkup, target body-fat percentage, target strength or training frequency.
- Translate requests into editable structured goals: metric, baseline, target, date or estimated arrival date, units, measurement method, and confidence/unknowns.
- Support both date-driven assessments and outcome-driven forecasts; ask only for truly missing inputs. Never invent a target date when evidence is inadequate.
- Mix session-level wins, weekly reviews, monthly assessments and longer-term milestones; user-defined schedules override defaults.
- Reforecast after new observations and show why predictions changed. Allow users to accept/reject suggested milestone changes.

## Development autonomy
- Minimize owner busywork: make routine technical decisions, implement and test incrementally, and reuse existing LifePilot services.
- Escalate only access/security, irreversible changes, product-defining tradeoffs, and specific new paid commitments.
- No unsupervised background work is implied; development happens during active tool-enabled sessions or explicitly scheduled work.
