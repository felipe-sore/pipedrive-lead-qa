'use strict';

const checks = require('./checks');
const { primaryPhone, categorize } = require('./phone');
const { tryRepair } = require('./repair-br');

function nextMonday(now = new Date()) {
  const d = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), now.getUTCDate()));
  const ahead = ((8 - d.getUTCDay()) % 7) || 7; // today is Monday -> next week's Monday
  d.setUTCDate(d.getUTCDate() + ahead);
  return d.toISOString().slice(0, 10);
}

/**
 * Read-only. Returns one record per lead (what was found) and a plan
 * (what would be written). Nothing is written here.
 *
 * opts: { homeCountry, locationField, checkWhatsapp, taskSubject, taskType, now }
 * adapters: { hasWhatsApp(e164) -> 'on_whatsapp' | 'not_on_whatsapp' | 'unknown' }
 */
async function audit(pd, leads, cfg, opts = {}, adapters = {}) {
  const home = (opts.homeCountry || 'BR').toUpperCase();
  const canCheckWa = Boolean(opts.checkWhatsapp && adapters.hasWhatsApp);
  const persons = new Map();
  for (const id of new Set(leads.map((l) => l.person_id).filter(Boolean))) persons.set(id, await pd.person(id));

  const records = leads.map((lead) => {
    const person = lead.person_id ? persons.get(lead.person_id) : null;
    return { lead, person, phoneRaw: person ? primaryPhone(person) : '', review: [], findings: {}, actions: [] };
  });
  const duplicates = checks.findDuplicates(records);
  const orgNames = new Map();
  const orgsPlanned = new Set(); // several leads can share one organization

  for (const r of records) {
    const { lead, person, review, findings } = r;
    const label = lead.title;
    if (!person) { review.push('lead has no person'); findings.identity = 'no person'; continue; }

    findings.identity = checks.identityMatches(lead.title, person.name) ? 'ok' : 'mismatch';
    if (findings.identity === 'mismatch') review.push(`lead title "${lead.title}" vs person "${person.name}"`);

    const org = checks.organizationCheck(lead, person);
    findings.company = org.status;
    if (org.status === 'mismatch') {
      if (!orgNames.has(org.leadOrg)) orgNames.set(org.leadOrg, (await pd.organization(org.leadOrg).catch(() => ({}))).name || `#${org.leadOrg}`);
      review.push(`lead company "${orgNames.get(org.leadOrg)}" vs person company "${person.org_id.name || org.personOrg}"`);
    } else if (org.status === 'person_missing_org') {
      review.push('person has no company; the lead has one (link it?)');
    }

    const name = checks.nameLooksReal(person.first_name, cfg);
    findings.name = name.ok ? 'ok' : name.why;
    if (!name.ok) review.push(name.why);

    findings.duplicate = duplicates.get(lead.id) || 'no';
    if (duplicates.has(lead.id)) review.push(duplicates.get(lead.id));

    // Leads with an identity problem or a duplicate get no actions until a human decides.
    const blocked = findings.identity !== 'ok' || duplicates.has(lead.id);

    if (!blocked && name.ok) {
      const fixed = {
        name: checks.personNameCase(person.name, cfg),
        first_name: checks.personNameCase(person.first_name, cfg),
        last_name: checks.personNameCase(person.last_name, cfg, { lastName: true }),
      };
      const changes = Object.fromEntries(Object.entries(fixed).filter(([, v]) => v));
      if (Object.keys(changes).length) {
        r.actions.push({ type: 'fix_person_name', leadId: lead.id, personId: person.id, label, from: person.name, set: changes });
      }
    }
    if (!blocked) {
      if (person.org_id && org.status === 'ok') {
        const orgName = person.org_id.name || '';
        const oc = checks.orgNameCase(orgName, cfg);
        if (oc.ambiguous) review.push(`company "${orgName}": ${oc.ambiguous.join(', ')} may be an acronym, decide the casing`);
        else if (oc.change && !orgsPlanned.has(person.org_id.value)) orgsPlanned.add(person.org_id.value), r.actions.push({ type: 'fix_org_name', leadId: lead.id, orgId: person.org_id.value, label, from: orgName, set: { name: oc.change } });
      }
    }

    const ph = categorize(r.phoneRaw, home);
    findings.phone = ph.category;
    findings.whatsapp = 'not_checked';
    let reliable = false;

    if (ph.category === 'home' && canCheckWa) {
      findings.whatsapp = await adapters.hasWhatsApp(ph.e164);
      reliable = findings.whatsapp === 'on_whatsapp';
    } else if (ph.category === 'home') {
      reliable = true; // no WhatsApp check configured: a valid number is the best we know
    } else if ((ph.category === 'foreign' || ph.category === 'invalid') && home === 'BR' && canCheckWa) {
      const location = opts.locationField ? person[opts.locationField] : '';
      const rep = await tryRepair(r.phoneRaw, location, cfg.brAreaCodes, adapters.hasWhatsApp);
      findings.repair = rep.status;
      if (rep.status === 'confirmed' && !blocked) {
        reliable = true;
        findings.whatsapp = 'on_whatsapp';
        r.actions.push({ type: 'fix_phone', leadId: lead.id, personId: person.id, label, from: r.phoneRaw, set: { phone: rep.e164 }, why: `area code ${rep.ddd} matches ${rep.state}` });
      } else if (rep.status.startsWith('found_')) {
        review.push(`phone ${rep.e164} exists on WhatsApp but location does not confirm it (${rep.status})`);
      }
    }

    if (!reliable && !blocked) {
      r.actions.push({
        type: 'replace_open_activities_with_task', leadId: lead.id, personId: person.id, label,
        why: `no reliable phone (${findings.phone}${findings.repair ? ', repair ' + findings.repair : ''}${findings.whatsapp !== 'not_checked' ? ', WhatsApp ' + findings.whatsapp : ''})`,
        task: { subject: opts.taskSubject || 'Get Phone Number', type: opts.taskType || 'call', due_date: nextMonday(opts.now) },
      });
    }
  }

  const plan = {
    generatedAt: (opts.now || new Date()).toISOString(),
    note: 'Review this plan. Delete any action you do not approve, then run: apply <plan.json> --execute',
    actions: records.flatMap((r) => r.actions),
  };
  return { records, plan, apiCalls: pd.calls };
}

module.exports = { audit, nextMonday };
