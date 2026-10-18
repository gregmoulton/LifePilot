# The Pure — Circuit Sequence Trial

**Recorded:** October 18, 2026

## Current approved pilot rules — updated October 18, 2026

The following supersedes earlier proposed numeric leg thresholds in this working design history. **These are agreed experimental design parameters, not validated minimum-effective strength rules and not yet implemented in the lab UI.**

| Movement family | Eligible fresh clean maximum | Unlock fresh clean maximum | 70%-of-max workout Floor from owner's October 15 baseline |
| --- | --- | --- | --- |
| Push | 10–14 reps | 15+ reps | 10 max → 7 reps per round |
| Pull | 10–14 reps | 15+ reps | 10 max → 7 reps per round |
| Squat / Legs | 20–29 reps | 30+ reps | 27 max → 19 reps per round |

**Algorithm:** A tested clean fresh maximum below the lower bound means try an easier variation; within range retain current rung; at/above Unlock, **test** a more challenging movement or fine mechanical adjustment. Ideally new fresh maximum returns near lower bound (~10 Push/Pull, ~20 Legs); validate with actual testing. A 70% **workout Floor** is distinct from the **fresh-max rung minimum** and **fresh-max Unlock**. If a fatigued training set cannot meet its Floor with good technique, offer a safer easier variation or recovery/stop, without presuming unwillingness. Support bodyweight strength with modest progression increments and cardio through three-movement continuous circuits and inter-circuit HR recovery. For unilateral leg movements, determine explicit **per-leg** counting and appropriate calibrated variant/range before using a common leg threshold.

## Candidate sequence: Pull → Squat → Push (P–S–P)

**Status:** User-proposed trial ordering, not yet a locked rule or a production change.

The original Pure sequence emphasized pull-ups, squats, and push-ups. Planks were subsequently added because the workout felt too short. Following real workouts, the user proposes **Pull → Squat → Push** for each circuit/round, starting with Pull because it has historically been the hardest movement. Squats in the middle offer arms and shoulders a relative break between upper-body movements, despite different primary muscle groups for pushing and pulling.

### Trial workflow
1. **Pull** — max clean reps, record count and optional live heart rate.
2. **Squat** — max clean reps, record count and heart rate.
3. **Push** — max clean reps, record count and heart rate.
4. **Circuit recovery** — record elapsed time from end of circuit to first credible live HW401 reading at or below user-selected trial **110 BPM**; alert promptly without arbitrary additional waiting. User confirms when next circuit starts.
5. Repeat for later circuits.

**Planks:** Historically added because session seemed short. Preserve as a possible *optional* fourth movement or finisher rather than automatically including them; final decision awaits user testing.

### What to measure
- Per-exercise clean maximums, set sequence, rep drop-off by round, completed circuits, the peak and recovery heart rates, time spent in recovery and BPM at actual restart.
- Compare any future alternate order under like-for-like conditions; avoid declaring this ordering objectively optimal before testing.
- Maintain uninterrupted live workout testing; first perform the headset/Bluetooth-to-speech preflight separately. Do not introduce untested sequence changes to the user's live exercise session without explicit review.

**Safety and interpretation:** Heart rate is not proof of musculoskeletal readiness, and the recovery alert is an experimental prompt, not a mandate to override pain, dizziness or technique failure.

This file is a development decision note only; it does not claim that the app sequence has already changed.


## Possible fourth movement: hip hinge (on hold)

**Owner clarification, October 18, 2026:** A hip-hinge movement was previously discussed as a possible **fourth exercise** for The Pure, instead of or alongside the historically added plank. It could complement the squat by training a different lower-body movement pattern, particularly posterior-chain/hip-extension involvement.

**Status:** Consider for a later test, **not** included in the current P–S–P three-movement protocol. No final movement, apparatus, load or progression ladder has been chosen. The two unresolved implementation issues are:
- **Equipment:** Find a repeatable hinge movement feasible with available/basic home equipment and scalable across the ladder.
- **Movement selection:** Choose a technique-safe, clearly measurable progression that can be tested for clean maximum reps without turning fatigue into unreliable form.

Potential categories to **evaluate later, not approve now**: banded or weighted Romanian deadlift variants, unweighted good mornings, or hip-thrust/bridge alternatives (not identical hinge mechanics). Test feasibility, joint comfort, load adequacy, rep-count reliability, and session duration before adding a fourth movement. Preserve the simple existing three-exercise workout while collecting the first real-world data.


## Origin of The Pure: user's corrected Push / Squat / Pull training model

**Correction supplied October 18, 2026:** In *powerlifting*, the conventional **Big Three** are squat, bench press, and deadlift. The owner and Robert used a related but **different three-movement-category routine: Push, Pull, and Legs (squat or deadlift)**. Their personal three-slot training model should not be described as the powerlifting Big Three or as performing all three powerlifts in each workout. The actual exercise options were:

| Slot | Exercises used in prior weight-training routine |
|---|---|
| **Pull** | Pull-ups, typically **weighted** |
| **Legs / "Squat"** | **Squats or deadlifts**, as alternatives for the leg slot |
| **Push** | **Bench press or weighted dips**, as alternatives for the push slot |

This corrected account **supersedes** the previous shorthand that portrayed the prior routine as simply "deadlifts, squats, and bench press." In the owner's structure, the three **categories** (Pull, Squat/legs, Push) are what define the Big Three model, with substitutions within slots. In particular, *deadlifts were classified in the leg/"Squat" slot in that routine*, even though a deadlift is biomechanically a hip-hinge movement rather than a squat.

The Pure adapted that compact structure into bodyweight **pull-ups, squats, and push-ups**. Planks were later added because the original bodyweight session felt too short. A progressive difficulty ladder was added collaboratively later; the owner had not included a ladder in the original model. Pull → Squat → Push is the current **proposed trial order**, not yet a fixed production rule.

### Biomechanical and fourth-movement considerations
- A weighted pull-up supplies a vertical upper-body pull and was **already part of the original lifting routine**, rather than a substitute for deadlift.
- Squat and deadlift can fill one *programming* slot as the owner historically grouped them, but they have substantially different biomechanics: squat is knee-dominant; deadlift emphasizes hip hinging and posterior-chain loading.
- Bench press and weighted dips are both pushing exercises; current bodyweight push-up approximates a horizontal push.
- A dedicated hinge movement remains a future optional fourth candidate for The Pure, subject to workable equipment and technique-sound progression testing, not a mandatory correction to the owner's historical categories.

### Design principles
- Preserve three fundamental workout slots, high-effort clean reps, individual round measurements and exercise difficulty progression.
- Keep the three-movement protocol simple during initial live tests; avoid prematurely expanding to a fourth exercise.
- Do not describe the historically used exercise combinations as all occurring within the same session unless supported by actual workout records.


## Core workout signposts: Floor, Unlock, and separate conditioning

**October 18, 2026 — User reconfirmed:** Despite shifting the experiment to **maximum clean reps in every round**, the user wants a **minimum acceptable Floor standard** to support effort and accountability, with a possible **separate conditioning round for voluntarily falling short of genuine effort**. This does not eliminate the other core signpost, the future **Unlock** that qualifies the next ladder rung for testing.

- Preserve the **two signposts**: (1) Floor / minimum performance standard, (2) Unlock / qualify to test harder variation. Optional last-session / personal-best feedback is not a third required standard.
- **Max-round test protocol**: each movement in each circuit is an honest maximum of technically sound reps. Preserve actual reps and HR/timing, and do not force poor-quality reps to meet an arbitrary number.
- Floor should be based on comparable observed workouts / test data, ideally as an **aggregate total per exercise across the session** when specifying a three-round Floor, and calibrated with actual observed later-round drop-off. This interpretation is a candidate implementation, not a newly user-approved numerical formula. Numeric floors, rounding, and unlock math remain unresolved.
- **Floor miss is not proof of insufficient effort.** Show the comparison and allow the user to indicate genuinely underexerted, fatigue-limited, technique-limited, symptomatic, equipment-related, or other reasons. Do not independently accuse or claim to measure motivation from missed reps/heart rate alone.
- **Conditioning round**: Preserve the user's preferred accountability/reinforcement concept. Trigger only for an agreed and acknowledged under-effort case, after clarifying safe conditioning type/volume, and always leave a safety-aware skip option. Log reps/time separately from the original exercise totals, and do not revise the result retrospectively.
- **Immediate test tonight:** collect maximum-round reps and monitor readings without changing a running session, introducing untested rules, or fabricating a Floor. Use observed rep totals/drop-offs to propose later personalized Floor values for explicit owner approval.
- Keep the 110-BPM checkpoint as an adjustable experimental transition alert; it is not a clearance to continue exercise in spite of pain, dizziness, compromised form or other warning signs.

**Implementation status:** A restored automatic Floor/conditioning flow is a **next version task**. Do not imply this is currently enforced in the experimental max-round build.


## Confirmed design direction: strength-first, cardio integrated (October 18, 2026)

- The Pure's main purpose is a credible progressive **strength routine**, with a barbell-like set-and-rep philosophy and added cardio through three exercises per circuit and recovery management. Avoid turning it into high-repetition endurance or a contest of pain tolerance.
- Advance to harder variations rather than requiring progressively longer sets of easy reps.
- Keep Floor (the sustainable minimum training target) distinct from Ceiling/Unlock (the clean-rep milestone for trying the next ladder rung).
- **Approved for trial: Push and Pull Ceiling/Unlock = 15 clean reps** in a fresh benchmark set. The 12- and 20-rep alternatives are not selected. This is not a requirement to perform 15 in each of three rounds.
- **Next workout 70% Floor:** Push 7, Pull 7, Squat 19 in each of three circuits, subject to good movement quality. The 60% version can be evaluated later. These are test settings, not proven physiological growth thresholds.
- **Squat Ceiling remains to be decided.**
- The 80% test was completed but the second and third circuits approached maximal effort, with slowing explosive squats and poor perceived day-to-day sustainability. Prescribe productive, recoverable strength work instead of routine maximal repetitions.
- Maintain zero software-imposed rest between three exercises, and use an experimental 110-BPM recovery cue between circuits while allowing the participant to choose when ready.
- Keep in-workout controls minimal. Ceiling qualification and updated workout flows are **planned**, not already implemented.


## LOCKED: adaptive Push/Pull rung selection — 10 to 15 clean reps (October 18, 2026)

**Latest owner decision — supersedes the earlier experimental 6–15 range.** Following the hypothetical test of 7 push-ups / 60 squats / 14 inverted rows, the owner determined seven maximum push-ups is too few for a sustainably productive three-circuit program and explicitly approved **10 as the Push/Pull rung minimum** while retaining **15 as the Ceiling/Unlock**. A conventional full pull-up is particularly hard; the ladder must contain suitable easier Pull variations (e.g., assisted pull-ups and adjustable inverted rows), so *ten clean reps* is a requirement of the **selected variation**, not an assumption that a beginner must do ten unassisted pull-ups.

### Three thresholds — do not conflate

1. **Rung minimum / entry eligibility:** fresh technically clean benchmark maximum of **10 reps** on the currently selected Push or Pull variation. **Below 10**: the variation is too hard for the program's present range; recommend an easier version, test a fresh clean maximum, and select one that fits. An exercise's ladder minimum is an *eligibility benchmark*, not the rep minimum in every training set.
2. **Workout Floor:** prescribed per-circuit minimum, for the next experimental workout **70% of the fresh benchmark maximum**, rounded to the nearest whole clean repetition. For max **10**, the Floor is **7 reps per round**. For max **14**, the Floor is **10 reps per round**. If the athlete genuinely cannot complete the Floor with good form, offer an easier variation or stop and recover; **never compel bad reps, interpret inability as laziness, or require a punishment round for honest fatigue**. Document and validate any substitution, and do not permanently downgrade the person's baseline due to one fatigued set.
3. **Ceiling / Unlock:** fresh technically clean maximum of **15 or more reps** on the selected Push/Pull exercise. Qualifies the athlete to **test the next harder variation**, not automatically impose it without verifying they can do **at least 10 clean reps** on the harder variation. If not, preserve a suitable current rung or introduce an intermediate adjustment (incline, body angle, assistance, resistance).

### Push/Pull exercise-selection algorithm

- **Max 0–9:** offer and benchmark an easier exercise in the same movement family.
- **Max 10–14:** exercise rung accepted; calculate the 70%-of-max Floor.
- **Max 15+:** unlock harder-rung trial; keep that rung only when the harder variation can itself meet the **10-rep minimum**.
- The **70% rule is a workout Floor trial** and must be assessed for effort, recovery, technique and adherence. It is **not a validated universal hypertrophy threshold**, and never demands knowingly unsafe repetitions.
- These rules are initially for **Push and Pull**. **Leg/Squat minimum and Ceiling remain undecided**; do not apply 10–15 by default to all leg variations. A case of 60 regular squats plainly needs a harder strength-oriented variation, but the cutoff and progression step still need testing.
- **Next real workout** remains Push **7**, Pull **7**, Squat **19** per round from recorded fresh baseline maxima 10/10/27; three circuits, no forced rest between movements, and the experimental 110-BPM ready cue between circuits.
- Distinguish **self-admitted insufficient effort** from genuine strength exhaustion, poor technique or recovery needs. The future optional conditioning consequence for deliberately failing effort is separate, and must not override safety.
- Keep adaptation prompt **brief and user-confirmed**; automatic rep counting, auto-exercise choice and floor enforcement are **not yet implemented** in the lab prototype.

### Test cases

- Fresh maximum **7 standard push-ups**: do **not** prescribe 5 standard push-ups; try a more accessible incline/knee-assisted Push rung, for example 12 clean max -> 8-rep Floor (12 x 0.7 = 8.4, rounded to 8). The 12 is illustrative, not a measured performance.
- Fresh maximum **14 inverted rows**: current rung fits; Floor = 10; not unlocked until 15 clean fresh reps.
- Fresh maximum **15 inverted rows**, but next harder row variation yields **8 clean max**: do not select this too-difficult rung; adjust the angle/difficulty to find an intermediate rung with >=10 clean reps.
- User's earlier exercise maximum **10 push-ups**: accepted rung; next test Floor = 7. A session set of 6 genuine clean reps would warrant a temporary easier variation or stopping appropriately, not a definitive reassessment of maximum.
- A fresh maximum of **9** on a *harder* Pull exercise should not imply that the user is unfit for Pull training: choose an easier Pull rung capable of >=10.

### Historical design record

The earlier **6–15** suggestion was deliberately explored and subsequently **replaced by 10–15** following the 7-push-up hypothetical scenario. It is not the active rule. The user's original design invariant still stands: “If you can't do the minimum we require for each exercise in the workout, then we must find you an easier exercise.”


## Movement-family-agnostic Big 3 and calibrated progression steps

**October 18, 2026 — owner confirmed design direction:** The Pure began as three specific exercises ("the Big 3" in the owner's informal terminology) but is now **exercise-agnostic within three movement families: Push, Pull, and Squat/Legs**. "Big 3" is a structural identity referring to these three slots, not a fixed inventory of bodyweight movements and not the conventional powerlifting Big Three (squat, bench, deadlift).

The engine selects an appropriate exercise variation in each family based on the athlete's clean benchmark capacity, rather than assuming standard push-ups, inverted rows and bodyweight squats forever. This enables beginner through advanced use and preserves the strength-first objective.

**Approved provisional Push/Pull transition goal:**
- The athlete demonstrates **15+ technically sound clean reps** on their current exercise in a fresh benchmark and therefore earns an opportunity to **test** the next harder variation.
- Ideally, the harder variation's new fresh clean maximum is **approximately 10 reps**, fitting within the agreed 10–14 acceptable current-rung range.
- The **15 → approximately 10** transition is the intended *observed rep performance*, NOT a mathematical conversion or guarantee, and NOT a prescription of 10 workout reps (the current 70% Floor on new tested max 10 is 7 reps in each of three circuits).
- If the proposed harder variation yields **fewer than 10 clean max reps**, it is too abrupt a leap: remain on a suitable current variation and/or introduce an *intermediate adjustment*, then retest (e.g., less steep incline for Push, body angle / assistance for Pull).
- If the proposed new variation yields **15+**, it may be too small an intensity step: consider the next reasonable harder variation while preserving technical quality.
- Never automatically replace the exercise, claim a rep estimate as a measured baseline, or assume a universal ratio of difficulty across different users/equipment. User controls and confirms the substitution.
- Progression libraries should be **calibratable and optionally finely adjustable** (angle, leverage, range, assistance, external resistance) rather than a brittle static ordered catalog. Benchmark clean reps to validate suitability; exact physical relationships and degree of change require empirical trials.
- Leg/Squat difficulty progression also follows the family-agnostic principle, but **numerical rung minimum and ceiling for leg exercises are not yet approved**. A fresh maximum of 60 plain squats should lead to evaluating harder leg work rather than prescribing 42 easy-rep squats per circuit.

This concept must stay separate from the **Workout Floor** (current experiment 70% of tested variation-specific maximum, a sustainable per-round target) and from heart-rate readiness (experimental between-circuit 110 BPM).


## Unlock performance is not Round 3 fatigue performance

**October 18, 2026, Test Pilot observation:** Reaching 15 clean reps in circuit Round 3 is markedly more demanding than reaching 15 in a fresh set, due to accumulated fatigue across movements and circuits. Do not treat those achievements as interchangeable.

- For the current **Push/Pull 15-rep Ceiling/Unlock**, use a **standardized fresh benchmark maximum** after sufficient recovery, *not* a requirement to hit 15 in Round 3 or in every circuit.
- **10-rep Push/Pull minimum eligibility** also refers to fresh clean maximum on the selected movement variation, not an expectation of ten reps in every fatigued training set.
- **70% workout Floor** refers to a training prescription for each circuit, derived from an appropriate tested maximum. Fatigue, form and safe recovery can override it; inability to complete clean reps triggers safe adaptation rather than grinding or a punitive workout.
- A person who achieves 15 in a controlled fresh push-up benchmark can qualify to test a harder push variation even if their ordinary workout would yield lower reps in Rounds 2–3.
- **Standardize baseline / progression tests** as a separate test condition (well recovered, recorded selected variation, consistent technique and setup). The exact schedule, whether a test can be incorporated into Round 1, and how to minimize test fatigue without disrupting the usual strength session remain to be decided. Round 1 is NOT automatically equivalent to truly fresh if preceded by other circuit exercises.
- Preserve exercise-agnostic and strength-first principles: do not force fatigue-endurance performance just to earn unlocks; avoid conflating 15 repetitions in a last circuit with 15 fresh maximum repetitions.


## Design invariant: fixed performance rules, flexible movement mechanics

**Owner agreement, October 18, 2026.** Do not treat a fixed ladder of named exercises as more important than the training rules. The Pure aims to reproduce the consistency of a barbell-like *rep-range plus adjustable resistance* prescription through variable bodyweight exercise mechanics.

- **Preserve a reasonably tight rep-performance band as a design constraint.** For the current Push and Pull pilot, benchmark-tested max of **10–14 clean reps** = appropriate rung, **<10** = make the exercise easier, **>=15** = qualify to test a harder variant. Ideally, upgrading a ~15-rep movement yields **~10 clean fresh maximum reps** on the next variant.
- The **exercise implementation is flexible:** angle, leverage, assistance, range of motion (subject to technique intent), external loading, hand/foot position, or other carefully specified adjustments can provide intermediate increments. Some variations change muscle recruitment/skill and are not proportional “weight increments”; **empirical testing decides**.
- **Do not rigidly force preset transitions.** If harder variation produces <10, adjust to a smaller increment or retain the prior variation until a suitable change is identified; if 15+ after transition, seek a more meaningful increment.
- **Workout Floor** is a separate intensity prescription currently being tested at **70% of the verified current exercise's fresh maximum**, not an established universal minimum-effective growth dose. Keep technique, safety, perceived effort and recovery in view.
- Strength is the purpose of the program; the consistent rep band should prevent long, low-value endurance sets. The integrated cardio stimulus comes from the three-exercise circuit and HR-guided inter-circuit recovery.
- The numerical thresholds for **Squat/Legs** are *not finalized*; consider whether a single common rep band is appropriate as part of controlled testing rather than presuming the Push/Pull 10–15 band applies mechanically to every leg movement.
- In software, separate a configurable **rule engine** (range eligibility, Floor, Unlock, qualification and test logs) from an extensible **movement library** with individualized progression variants and equipment constraints. Every proposed adjustment requires safe, user-confirmed selection and a measured rebenchmark; no automatic rep-count inference from leverage.


## Legs use a higher rep band than Push/Pull

**October 18, 2026 owner decision:** Keep the **Squat/Legs** progression band higher than Push/Pull. User finds higher-rep leg training subjectively effective; imposing the Push/Pull 10–15 clean-max band on lower-body exercise might lead prematurely to demanding movements like full pistol squats. The Pure remains a strength-first program, so avoid endless endurance-only repetitions and use safely scalable leg variations.

- **Locked principle:** The three movement families may use **different appropriate clean fresh-max rep bands**, rather than rigidly imposing universal 10–15 on the legs.
- **APPROVED FOR EXPERIMENTAL TESTING numeric Squat/Leg pilot (October 18, 2026):** **20–29 clean fresh-max reps** as the appropriate rung; **below 20** => seek easier, **30+** => test harder. Aim for next harder variation to yield **approximately 20 fresh clean reps**, calibrating difficulty through stance, range, support, height, leverage, resistance, or equipment. Do not assume exact equivalence between movements.
- The owner's current standard squat fresh maximum **27** fits the approved-for-trial 20–29 eligibility band; current experimental 70% Floor is **19 per round** (which can be lower than the rung's 20-rep *fresh maximum eligibility*; these must not be confused).
- Hypothetical max of **60** ordinary squats would be outside proposed upper limit, so select and benchmark an appropriately harder leg variation rather than prescribe **42 ordinary squats per round** and let the routine become endurance-focused.
- **Unilateral edge case:** For split squats, lunges, step-ups and pistols, define whether test maximums and training Floors are **per leg or total**, and calibrate rep counts accordingly; 20 reps per leg differs markedly from 20 bilateral squats. Don't silently treat them as equivalent or imply a direct transfer of thresholds before testing. Consider adjacent progression adjustments before attempting unsupported pistols.
- The claim that higher repetitions are generally more effective for every lifter's leg growth is **not established here**; treat user's bodybuilder/weightlifting observation as a design preference to evaluate, not conclusive comparative evidence.
- Squat/Legs 20–30 numbers were **explicitly accepted by the owner for testing on October 18, 2026**; not yet validated or implemented. Push/Pull 10-to-15 eligibility and 70% workout-floor trial remain as previously agreed.


## Floor-led voluntary rep progression — October 18, 2026

**User's observation and evolving protocol:** With the workout Floor set experimentally at **70% of the tested fresh maximum**, the athlete is likely to attempt extra repetitions only when they feel noticeably stronger, because excess effort early in the three-exercise circuit risks fatigue and a Floor miss in a later circuit. Treat that interaction as a possible **natural self-regulation mechanism**, to be validated from testing rather than guaranteed.

- **Floor = guaranteed target when physically able, not a demand to max out** each circuit. Clean controlled form and sustainable effort take priority over bonus reps.
- After completing the Floor, **additional clean reps are voluntary and conservatively chosen** when the athlete has capacity for the remainder of the workout. Do not automatically escalate targets every workout or pressure users to perform to failure for an Unlock.
- Example for a Push variation with tested fresh max 10 and trial 70% floor 7/round: regular session 7/7/7 = **21 total**; a stronger day might produce **8/7/7 = 22**, later **8/8/7 = 23**, or **8/8/8 = 24**, without scheduled forced increments.
- Record **per-round reps, floor met, voluntary surplus vs. floor, movement quality**, and whether later rounds retain their Floors. Optional effort/RIR report may help distinguish a safe performance improvement from a forced grind.
- The workout score concept should **not reward an all-out early set that leads to later Floor failure**. Extra early reps are not automatically superior to preserving repeatable circuit quality.
- **110 BPM** remains an experimental between-circuit *cardiovascular* alert; it is **not proof of muscular recovery**. The user can wait, modify, or stop when muscles/form/respiration have not recovered adequately.
- **Total-rep Unlock** (earlier illustrative 30 push/pull or 75 squat totals) is only a candidate; not approved as a fixed formula. Requiring too high a total can recreate the 80% near-failure experience. Avoid presenting those figures as deployed / agreed progression thresholds until tested.
- Preserve the separately approved **fresh maximum eligibility bands** (Push/Pull 10–14, unlock fresh 15+; Legs 20–29, unlock fresh 30+), while comparing whether the **voluntary session total-rep method** can safely replace or supplement fresh max tests. No unilateral replacement without owner decision.


## LOCKED: barbell-inspired ANY-SET Unlock — October 18, 2026

**Owner explicitly approved:** Reproduce the motivational reward from their favorite heavy barbell double-progression routine. In that prior program, they used the powerlifting Big Three and weighted pull-ups, performed roughly 3 or 4 through 6 reps per set, and added 10% weight when they achieved **7 clean reps in ANY one set**; the heavier load brought reps back to ~3–4. The exact remembered lower bound (3 or 4) remains uncertain.

### The Pure's approved unlock rule

- **Push:** **15+ clean reps in ANY ONE set** of the normal three-circuit workout earns the chance to **test** a harder pushing variation.
- **Pull:** **15+ clean reps in ANY ONE set** earns the chance to **test** a harder pulling variation.
- **Squat/Legs:** **30+ clean reps in ANY ONE set** earns the chance to **test** a harder leg variation.
- **This replaces the proposed workout-total Unlock and the requirement that Unlock must be demonstrated in a separately scheduled fresh max benchmark.** An optional fresh benchmark can still establish or recalibrate exercise eligibility; a qualifying in-workout set is itself enough to trigger *the invitation to test* a harder rung. Do not require the threshold in all three rounds, or in fatigued Round 3.
- **Why owner approved:** The athlete can occasionally go all-out **when feeling strong**, especially in a fresh **first set**, and get a tangible reward for exceptional performance. This is **optional**, not an instruction to max out all sets or all workouts. Prior trial at 80% of fresh max on every set was unsustainably difficult, especially Rounds 2–3.
- **Daily workout Floor** remains a separate experimental prescription of **70% of the verified maximum** on the current exercise (nearest clean whole rep); stable regular sessions should be possible without chasing Unlock.
- **Fresh maximum eligibility** on any new variant remains **10–14 Push/Pull** and **20–29 Legs**, with a new variant ideally delivering an observed fresh maximum near **10 Push/Pull** or **20 Legs**. Any-set Unlock *does not automatically impose* an untested next variation; user tests its performance and confirms the selection. Adjust leverage/angle/assistance or use intermediate levels if progression is too abrupt. Do not pretend a bodyweight difficulty jump is a calculable +10% weight increment.
- A **clean** qualifying set with correct movement technique matters more than whether the athlete can grind out lower-quality repetitions. If chasing an optional Unlock in Round 1 creates unacceptable fatigue or Floor failure later, log the achievement and the later quality/fatigue separately; don't accuse the athlete of insufficient effort or apply automatic conditioning for genuine fatigue. Examine effort sustainability in testing.
- **Current status:** Owner-approved design rule saved in GitHub; it is **not yet implemented** in the active experimental app. We still need to design the visual reward, notification, how to schedule the newly earned rung test, and safe session-continuation behavior.

**Core idea: a sustained, attainable Floor; discretionary high-effort first-set opportunity; immediate ANY-SET Unlock reward.**
