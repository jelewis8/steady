# Crisis lines and emergency numbers

The data is in `src/core/crisisLines.ts`. This page is the verification log and the checklist for keeping it true.

**These are safety numbers. A wrong number is worse than a missing one.**

## Rules

1. **Never add a number from memory, a forum or a search snippet alone.** Read it on an official page for that country (government, health service, or the organisation that runs the line).
2. **State hours only if the source states them.**
3. **Each country needs at least one `official` source.** `excerpt` means the page itself could not be opened and the number was confirmed from excerpts of official pages. Re-check those by hand.
4. If a number can't be confirmed any more, **remove it**.
5. Update `CRISIS_LINES_CHECKED` when you re-verify. The Support page tells the user when the numbers were last checked.
6. The golden-values test in `src/core/crisisLines.test.ts` fails if a primary number changes. Re-verify before changing the test.

## Verification log: 2026-09-30

Read on the pages below, by Claude, while building F-002.

| Country | What was confirmed | Source(s) |
|---|---|---|
| **United States** | 988 Suicide & Crisis Lifeline: call, text or chat, 24/7. Crisis Text Line: text HOME to 741741, 24/7. Emergency: 911. | 988lifeline.org; crisistextline.org. **911: excerpt only** (fcc.gov page blocked when checked). |
| **Canada** | 9-8-8: call or text, 24/7, English and French. Emergency: 9-1-1. | 988.ca; canada.ca (mental health: get help; 9-8-8 launch). |
| **United Kingdom** | Samaritans 116 123 (free, any time). Shout: text SHOUT to 85258 (24/7). NHS 111 (24/7). CALM 0800 58 58 58 (5pm to midnight). Emergency: 999. | samaritans.org; nhs.uk (help for suicidal thoughts; when to call 999). |
| **Ireland** | Pieta: freephone 1800 247 247 (24 hours), text HELP to 51444. Emergency: 112 or 999, both free. | pieta.ie; HSE (www2.hse.ie). |
| **Australia** | Lifeline: call 13 11 14 (24/7); text 0477 13 11 14 (24/7). Emergency: 000 ("If life is in danger, call 000"). | lifeline.org.au (call and text pages). |
| **New Zealand** | 1737: call or text, free, 24/7. Emergency: 111. | 1737.org.nz. |
| **Philippines** | NCMH Crisis Hotline 1553, plus mobile 0917 899 8727, 0966 351 4518 (Globe/TM) and 0908 639 2672 (Smart/Sun/TNT), 24/7. NCMH Emergency Section direct line (02) 8531-5275 and trunk line (02) 8531-9001 (added 2026-10-01 from the contact-page text Jeremiah supplied). Emergency: 911. | 911: ehotlines.e.gov.ph (official, read directly). **Crisis numbers: excerpt only.** ncmh.gov.ph, doh.gov.ph, pna.gov.ph and pia.gov.ph all blocked automated access (HTTP 403 or a bot check), so the numbers were confirmed from search excerpts of the DOH pages and of separate PNA/PIA articles, which agreed. **Please confirm on ncmh.gov.ph.** The contact-page text supplied on 2026-10-01 gives the trunk line and Emergency Section but **does not include the crisis hotline numbers**. Its address line ends "Mandaluyong City 1553", which is the postal code and happens to match the hotline number, so it does not confirm the hotline. Check the "Crisis Hotline" part of the NCMH site. |
| **India** | Tele-MANAS 14416, 24x7, toll-free. Emergency: 112. | PIB (Tele-MANAS launch release); mha.gov.in (ERSS-112). |
| **South Africa** | SADAG Suicide Crisis Helpline 0800 567 567, 24-hour toll-free. Emergency: 112 from a mobile; ambulance 10177; police 10111. | sadag.org; westerncape.gov.za. |
| **Germany** | TelefonSeelsorge 0800 111 0 111, 0800 111 0 222, 116 123, free. Emergency: 112. | telefonseelsorge.de; 112 across the EU: HSE. |
| **France** | 3114, national suicide prevention number, 24/7, free. Emergency: 112. | 3114.fr (run by the health ministry). |
| **Spain** | 024, free and confidential, 24/7. Emergency: 112. | sanidad.gob.es (línea 024). |
| **Netherlands** | 113 Zelfmoordpreventie: call 113 free, anonymous. Emergency: 112. | 113.nl. |
| **Italy** | Telefono Amico Italia 02 2327 2327, every day, 24 hours. Emergency: 112. | telefonoamico.it. |
| **Elsewhere** | Find A Helpline: an international directory, shown as a link for anyone outside the list. | findahelpline.com |

### 2026-10-01, Philippines re-check

Jeremiah pasted the NCMH contact-page text again (address, trunk line (02) 8531-9001, local 301/304 for PACD, Emergency Section (02) 8531-5275, two email addresses). It matches the two hospital lines already in the app. It lists **no crisis hotline**, and "1553" in it is the postal code of Mandaluyong City. ncmh.gov.ph still shows a bot check to automated browsers, which Claude did not try to bypass. **The hotline 1553 and the three mobile numbers remain "excerpt" and need a person to confirm them on the NCMH "Crisis Hotline" page.** The local numbers 301/304 and the email addresses were not added to the app (not crisis lines).

### Checked and left out (could not be verified)

Brazil, Mexico, Japan, South Korea, and Singapore's emergency number. Their official pages were unreachable, blocked, or didn't state the number. They can be added once verified. Anyone can also add their own number in the app.

## How to re-check

1. Open each source above and compare every number in `COUNTRIES`.
2. Edit `src/core/crisisLines.ts`, set `CRISIS_LINES_CHECKED`, and update this log.
3. Run `npm test`. If the golden test fails on purpose, update it with the new value.
4. Ship as a normal release.

Do this at least twice a year, and whenever a user reports a number that doesn't connect. Better still, have someone in each region confirm by looking at the official site from there.

## What the app does and doesn't do

- It shows numbers and opens the phone's own call or text app on a tap. It never calls or texts by itself.
- It records nothing about visits to the Support page, scores nothing, and sends nothing.
- It gives no clinical advice. The medical disclaimer is on the page.
- The wording should be reviewed by a clinician or a peer-support organisation (F-002).
