# Support page: wording audit and proposed changes

A self-audit of every piece of Support wording, done by Claude on 2026-10-01 **before** any clinician or peer-support review (see [SUPPORT-REVIEW.md](SUPPORT-REVIEW.md)). Nothing in the app has been changed yet. Each proposal below is for the project owner to approve, and the reviewer to confirm.

**What this is not.** It is not a clinical review. The principles below are general safe-messaging practice as Claude knows it. They were **not** checked against the current published guidelines (for example from suicide-prevention organisations, the WHO, or crisis-line services), so the reviewer should check them.

## The principles used

1. **Lead with action, in short plain sentences.** The reader may be distressed or post-seizure.
2. **Direct and non-judgemental.** No blame, no "you should", no pressure.
3. **No false promises and no claims the data can't back.** Every statement about a line (free, 24 hours) must be true for that line.
4. **Neutral language about suicide.** Nothing that sensationalises it, makes it sound like a solution, or describes methods.
5. **Immediate danger is covered**, including someone who has already harmed themselves.
6. **Consistent wording** across every entry point.
7. **Private by default.** Nothing sensitive is visible on the lock screen unless the user chose that.
8. **Inclusive.** Doesn't assume who the trusted people are, or the user's gender, relationships or country.

## What is already good (keep)

- The first thing on the page is the emergency call, and it names the number being called.
- "You don't need to be sure what to say" lowers the barrier to calling.
- The Support entry on the lock screen is worded neutrally ("I need support right now") and doesn't reveal why.
- The safety plan is the user's own words. Steady supplies only the prompts, and the plan stays off the lock screen unless the user turns it on, with a plain warning about who could read it.
- "What matters most to me" is used instead of "reasons for living".
- Nothing is scored, recorded or sent, and the Support link in the daily check-in is always there, never triggered by a score.
- The disclaimer says it isn't a crisis service and isn't medical advice.

## Findings and proposed changes

Severity: **High** = wrong or missing in a way that matters; **Medium** = clearer or safer wording; **Low** = polish.

### S-1 · High · A claim the data doesn't support ("Free")

- **Where:** `SupportPanel.tsx`, "Talk to someone now".
- **Now:** "Free, private support from trained people in {country}. You don't need to be sure what to say."
- **Problem:** "Free" is said about every line in the country, but it isn't true of every listed line. Italy's Telefono Amico, the Philippine mobile numbers and the two hospital lines have no "free" statement in their source. A person with little credit or a prepaid phone may hold back from calling. Two Philippine entries (the Emergency Section and the trunk line) are hospital lines, not crisis lines. Each line already carries its own "Free" or "Toll-free" note where its source says so.
- **Proposed:** "Trained people you can talk to in {country}. You don't need to be sure what to say." Keep each line's own note. For the two hospital lines, change the note to "A hospital line, not a crisis line."
- **Also:** Philippines line names read "NCMH Crisis Hotline (Globe / TM mobile)" three times. That is accurate but noisy. It could be one entry with the mobile numbers listed in its note. Optional.

### S-2 · High · Someone who has already harmed themselves

- **Where:** the red emergency box.
- **Now:** "If you might act on these thoughts, or you're in danger. Call emergency services now."
- **Problem:** it covers future danger but not "I have already done something".
- **Proposed:**
  - Heading: "If you think you might act on these thoughts, or you're in danger right now"
  - Body: "Call emergency services now. If you have already hurt yourself, or taken something to harm yourself, call now too. If you can, tell someone near you."
- **Reviewer to decide:** whether "taken something" should say medication explicitly (it is a medication app, so an overdose is a realistic case), and whether "tell someone near you" is the right advice.

### S-3 · Medium · Inconsistent entry points

| Place | Now | Issue |
|---|---|---|
| Rescue button | "I'm having thoughts of hurting myself" | Doesn't say suicide. Someone with suicidal thoughts and no urge to self-harm may not see themselves in it. |
| Calm & grounding | "Having thoughts of hurting yourself? Get support" | Second person and a question, unlike the Rescue button; can read as presuming. |
| Check-in | "Feeling very low, or not safe? Support is here any time" | "any time" over-promises (see S-6). |
| Lock screen | "I need support right now" | Good. |
| More | "Support & safety plan" | Good. |

- **Proposed:**
  - Rescue: "I'm having thoughts of suicide or of hurting myself" *(reviewer decision: direct wording is generally considered helpful, but it is on a screen a bystander might see; the lock-screen wording stays neutral)*.
  - Calm: "Struggling, or having thoughts of hurting yourself? Get support".
  - Check-in: see S-6.

### S-4 · Medium · The opening says "alone" twice

- **Now:** "You're not alone." and "Thank you for reaching out. You don't have to go through this alone. Here are people you can contact right now."
- **Proposed:** "You're not alone. Thank you for reaching out. Here are people you can contact right now."

### S-5 · Medium · What happens when emergency services are called

- **Question for the reviewer, not a wording change.** Some people avoid calling emergency services because they fear a police response, and the page's order (emergency call first) is right for imminent danger. Should the page say when a crisis line is the better first call (not in immediate danger), and should it describe what to expect? Whatever is said must be true for each country and is a data question as well as a wording one.

### S-6 · Low · "Support is here any time"

- **Where:** the check-in sheet.
- **Problem:** the page is always available, but some lines have hours (CALM is 5pm to midnight). "Any time" could be read as a promise that a person is always there.
- **Proposed:** "Feeling very low, or not safe? You can open Support any time."

### S-7 · Low · The disclaimer is dense

- **Now:** four sentences in one block at the end of the page.
- **Proposed:** "Steady is not a crisis or emergency service, and it never contacts anyone for you. This page lists ways to reach people. It is not medical advice or treatment. Steady keeps no record of visits to this page and sends nothing anywhere. Numbers were last checked in {Month Year} and can change. If one doesn't connect, try another or call emergency services."
- **Note:** "keeps no record of this page" is changed to "of visits to this page", which is precise. The browser's own history is outside Steady's control.

### S-8 · Low · Voice mixes "I" and "you" in the safety plan

- **Where:** `SafetyPlanPage.tsx`. Headings are first person ("My warning signs"), but one prompt says "People you choose above also appear on the Support page".
- **Proposed:** "People I choose above also appear on the Support page."

### S-9 · Low · "Making my space safer" prompt

- **Now:** "What would make my surroundings safer during a hard time, in my own words. My care team can help me think this through."
- **Assessment:** keep. It is gentle, doesn't name methods, and points to the care team. It is the only place restricting access to means is addressed, so the reviewer may want it more explicit. That is a clinical decision.

## Questions only a reviewer can answer

1. Is the safe-messaging basis above right for an app page (as opposed to media reporting)?
2. S-2: how explicit about medication, and is "tell someone near you" right?
3. S-3: "suicide" on the Rescue button or not?
4. S-5: should the page say when a crisis line, not emergency services, is the better first call, and describe what to expect?
5. Is the default text message right? ("I'm not feeling safe right now. Can you call me or come be with me?")
6. Is anything missing: for example a line for someone worried about another person, or guidance after a crisis passes?
7. Is a safety plan appropriate to offer inside a seizure-tracking app without a clinician's involvement? It currently says it works best made with someone trusted or a professional.

## How to apply

S-1, S-4, S-6, S-7 and S-8 are plain text changes in `src/features/support/` and `src/features/today/CheckInSheet.tsx`, with the Philippines notes in `src/core/crisisLines.ts`. S-2 and S-3 change the safety wording and should wait for the reviewer. Update the tests that look for exact text (`e2e/critical.spec.ts`, F-002 tests) and the wording-review note in `FEATURES.md` (F-002).
