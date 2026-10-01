# Support page: summary for clinical or peer-support review (F-002)

For a clinician, or a peer-support or suicide-prevention organisation, to read and comment on. About 5 minutes.

## What Steady is

A free, private app that helps one adult with focal epilepsy keep daily routines, track seizures and take medication. Everything stays on her phone. There is no account, no server and no analytics. People with epilepsy have higher rates of depression and of suicidality than the general population (our clinical knowledge base cites depression in 20–55% and a 2–5× increased suicide risk; please correct us if those figures are out of date), so the app has a Support page. It is reachable from the Rescue screen, Calm & grounding, the More menu and the lock screen.

## What the Support page does

1. **Opens with warmth, not a form.** "You're not alone. Thank you for reaching out. You don't have to go through this alone."
2. **Emergency call first.** A large button: "If you might act on these thoughts, or you're in danger. Call emergency services now." It uses the emergency number for the country she chose.
3. **Talk to someone now.** Crisis lines for the country she chose (14 countries), each with Call and, where one exists, Text. A link to an international directory for anyone elsewhere. She can add her own number, such as a counsellor.
4. **Reach someone you trust.** People she picked in advance, with Call and Text buttons. The text opens her own messaging app with a message she wrote earlier ("I’m not feeling safe right now. Can you call me or come be with me?" by default). She presses send. Steady never sends anything.
5. **My safety plan.** Her own words in the standard sections (warning signs, things she can do alone, people and places that help, people to ask, professionals, making her space safer, what matters most). Steady supplies only the prompts. It is hidden on the lock screen unless she turns that on.
6. **Calm & grounding.** A link to a breathing and grounding screen.
7. **Disclaimer.** "Steady is not a crisis or emergency service… not medical advice or treatment… numbers can change; if one doesn't connect, try another or call emergency services."

## What it deliberately does not do

- It does not ask about suicidal thoughts, score anything, or decide when to show support. The Support link is always there (for example in the daily mood check-in) and never appears because of a low score.
- It does not record visits to the page, notify anyone, or call or text by itself.
- It gives no advice on treatment, and it does not interpret what she writes.

## Questions for the reviewer

1. Is the wording safe, non-judgemental and appropriate? Is anything in it likely to make a person in crisis feel worse or dismissed?
2. "If you might act on these thoughts, or you're in danger" is the wording of the red emergency box. Is it clear and not alarming?
3. The safety-plan sections follow the usual structure of a written safety plan (Stanley-Brown style). Is any section worded in a way that could cause harm? The "Making my space safer" prompt says only "what would make my surroundings safer during a hard time, in my own words. My care team can help me think this through." Is that the right level?
4. Is the default text message suitable?
5. Is there something missing that you would expect, or something present that should be removed?
6. We only link to the crisis lines of the countries listed (see `docs/CRISIS-LINES.md`). Are there lines you would add or remove?
7. Does the order (emergency, crisis line, trusted person, plan) seem right?

Everything is in `src/features/support/` and `src/core/crisisLines.ts`. A reviewer can read the same text in the live app at https://steady.example.com/support (the app needs a one-minute setup first), or ask for a screenshot set.

## Status

Not yet reviewed by a clinician or peer-support organisation. Until it is, the wording is Steady's best effort and the page says it is not medical advice.
