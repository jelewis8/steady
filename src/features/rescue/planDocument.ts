import type { EmergencyContact, Medication, RescueProtocol, UserProfile } from '../../core/types';

const esc = (s: string | null | undefined) =>
  (s ?? '').replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' })[c] as string);
const para = (s: string | null | undefined) => esc(s).replace(/\n/g, '<br>');

/**
 * Standalone seizure action plan (Workflow 5). Generated entirely on the device,
 * with inline styles so it prints and opens anywhere, offline.
 */
export function buildPlanDocument(opts: {
  profile: UserProfile | undefined;
  plan: RescueProtocol | undefined;
  meds: Medication[];
  contacts: EmergencyContact[];
  emergencyNumber: string;
}) {
  const { profile, plan, meds, contacts, emergencyNumber } = opts;
  const name = profile?.displayName?.trim() || 'Me';
  const active = meds.filter((m) => m.isActive);
  const medRows = active
    .map(
      (m) =>
        `<tr><td>${esc(m.name)}${m.isRescue ? ' <strong>(rescue)</strong>' : ''}</td><td>${esc(`${m.dosage} ${m.unit}`)}</td><td>${esc(
          m.isRescue ? 'As in plan' : m.scheduledTimes.join(', '),
        )}</td></tr>`,
    )
    .join('');
  const people = contacts
    .filter((c) => c.canViewRescueProtocol)
    .map((c) => `<li><strong>${esc(c.name)}</strong>${c.relationship ? ` (${esc(c.relationship)})` : ''} — <a href="tel:${esc(c.phone)}">${esc(c.phone)}</a></li>`)
    .join('');

  const section = (title: string, body: string) => (body ? `<section><h2>${title}</h2>${body}</section>` : '');

  const body = `
<header class="plan-head">
  <h1>Seizure action plan — ${esc(name)}</h1>
  <p class="plan-sub">${esc(profile?.epilepsyType === 'focal' ? 'Focal epilepsy' : 'Epilepsy')}${profile?.seizureFocus ? ` · ${esc(profile.seizureFocus)}` : ''}</p>
</header>
<div class="plan-call">In an emergency call <strong>${esc(emergencyNumber)}</strong>. ${para(plan?.whenToCall911)}</div>
${section('What my seizures look like', plan?.seizureDescription ? `<p>${para(plan.seizureDescription)}</p>` : '')}
${section('How to help me', plan?.howToHelp ? `<p>${para(plan.howToHelp)}</p>` : '')}
${section('Rescue medication', plan?.rescueMedicationInstructions ? `<p>${para(plan.rescueMedicationInstructions)}</p>` : '')}
${section('Allergies', `<p>${plan?.allergies?.length ? esc(plan.allergies.join(', ')) : 'None known'}</p>`)}
${section(
  'Current medications',
  medRows
    ? `<table><thead><tr><th>Medication</th><th>Dose</th><th>When</th></tr></thead><tbody>${medRows}</tbody></table>`
    : plan?.currentMedications
      ? `<p>${para(plan.currentMedications)}</p>`
      : '',
)}
${section('Emergency contacts', people ? `<ul>${people}</ul>` : '')}
${section(
  'Neurologist',
  plan?.neurologistName || plan?.neurologistPhone
    ? `<p>${esc(plan?.neurologistName)}${plan?.neurologistPhone ? ` — <a href="tel:${esc(plan.neurologistPhone)}">${esc(plan.neurologistPhone)}</a>` : ''}</p>`
    : '',
)}
${section('Other notes', plan?.additionalNotes ? `<p>${para(plan.additionalNotes)}</p>` : '')}
<footer class="plan-foot">Made with Steady on ${esc(new Date().toLocaleDateString())}${
    plan?.lastReviewedAt ? ` · plan last reviewed ${esc(new Date(plan.lastReviewedAt).toLocaleDateString())}` : ''
  }. This plan was written by the person above and their care team.</footer>`;

  const css = `
body{font-family:Atkinson Hyperlegible,Verdana,system-ui,sans-serif;color:#111;background:#fff;max-width:760px;margin:0 auto;padding:24px;line-height:1.5;font-size:17px}
h1{font-size:28px;margin:0}h2{font-size:19px;margin:18px 0 6px;border-bottom:2px solid #1a5a85;padding-bottom:2px}
.plan-sub{margin:4px 0 0;color:#444}.plan-call{margin-top:16px;padding:12px 14px;border:3px solid #a3261f;border-radius:10px;font-size:18px}
table{border-collapse:collapse;width:100%}th,td{border:1px solid #999;padding:6px 8px;text-align:left}ul{padding-left:20px}
a{color:#164c71;text-decoration:underline}.plan-foot{margin-top:24px;font-size:13px;color:#555}@media print{body{padding:0}}`;

  const full = `<!doctype html><html lang="en"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><title>Seizure action plan — ${esc(
    name,
  )}</title><style>${css}</style></head><body>${body}</body></html>`;
  return { body, css, full, fileName: `seizure-action-plan-${name.toLowerCase().replace(/[^a-z0-9]+/g, '-')}.html` };
}
