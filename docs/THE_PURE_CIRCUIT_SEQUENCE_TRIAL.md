# The Pure — Circuit Sequence Trial

**Recorded:** October 18, 2026

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
