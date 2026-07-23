# Constellore 3.0 novice test protocol

Use this protocol with people who have never been taught Constellore. The facilitator must not explain the controls or win condition before the participant acts; the point is to test whether the product explains itself.

## Consent and privacy

- Ask permission before observing or recording anything.
- Record a random participant number, not a name, email, account ID, voice, face, or device identifier.
- Do not collect Recovery Kits, bearer tokens, precise location, or free-form personal information.
- Stop immediately if the participant asks.

## Session script

1. Open a fresh private/incognito window at the deployed build.
2. Say only: “Please try this game as if you found it yourself. Think aloud if you are comfortable.”
3. Before the first action, ask: “What do you think the goal is?” Record the answer without correcting it.
4. Let the participant proceed through First Orbit and one real mission without help.
5. If they are stuck for two minutes, record the exact surface and misunderstanding before offering one neutral prompt: “What would you try next?”
6. At the result, ask: “What happened, how did you win, and what would you do next?”

## One row per participant

| Field | Allowed value |
| --- | --- |
| Participant | Random code such as N014 |
| Device class | Phone / tablet / desktop |
| Understood target before acting | Yes / partly / no |
| First valid fusion | Seconds or abandoned |
| First Orbit | Completed / skipped / abandoned |
| First real mission | Completed / abandoned |
| First mission time | Seconds |
| Guidance used | None / Signal / Compass / Gift / Reveal |
| Incorrect interactions | Count plus short UI description |
| Expected combinations that failed | Ingredient pair only; no personal text |
| Understood result/next action | Yes / partly / no |
| Critical confusion | Short product observation |

## Go/no-go review

Run at least thirty valid novice sessions and evaluate the thresholds in `docs/V3_RELEASE_GATES.md`. Group repeated problems by surface—home, briefing, inventory, board, Guidance, pause, or result—and fix the most common misunderstanding before adding features. Re-run a fresh cohort after a major first-session change; do not combine taught participants with true novices.
