'use strict';

// Executes an approved plan. Dry run unless execute = true.
// Open activities are fetched fresh at execution time, once per run: the team
// works them live, so a list from the audit may already be stale.

// Swaps the wrong number for the confirmed one and keeps every other number
// the person has (work line, secondary mobile).
function replacePhone(phones, from, to) {
  const digits = (v) => String(v || '').replace(/\D/g, '');
  const others = (phones || []).filter((p) => p.value && digits(p.value) !== digits(from) && digits(p.value) !== digits(to));
  return [{ value: to, primary: true }, ...others.map((p) => ({ value: p.value, label: p.label, primary: false }))];
}

async function apply(pd, plan, { execute = false } = {}) {
  const results = [];
  let openActivities;
  const openFor = async (leadId) => {
    if (!openActivities) openActivities = await pd.openActivities();
    return openActivities.filter((o) => o.lead_id === leadId);
  };
  for (const a of plan.actions) {
    const res = { type: a.type, lead: a.label, status: execute ? 'done' : 'dry_run', detail: '' };
    try {
      if (a.type === 'fix_person_name') {
        res.detail = `${a.from} -> ${a.set.name || ''}`;
        if (execute) await pd.updatePerson(a.personId, a.set);
      } else if (a.type === 'fix_org_name') {
        res.detail = `${a.from} -> ${a.set.name}`;
        if (execute) await pd.updateOrganization(a.orgId, a.set);
      } else if (a.type === 'fix_phone') {
        res.detail = `${a.from} -> ${a.set.phone}`;
        if (execute) {
          const person = await pd.person(a.personId);
          await pd.updatePerson(a.personId, { phone: replacePhone(person && person.phone, a.from, a.set.phone) });
        }
      } else if (a.type === 'replace_open_activities_with_task') {
        const open = await openFor(a.leadId);
        res.detail = `delete ${open.length} open activit${open.length === 1 ? 'y' : 'ies'} (${open.map((o) => o.subject).join(', ') || 'none'}), create "${a.task.subject}" due ${a.task.due_date}`;
        if (execute) {
          // Create first: if it fails, the lead keeps its old activities instead of
          // ending up with none (and being archived by a "no pending activity" rule).
          await pd.createActivity({ ...a.task, lead_id: a.leadId, person_id: a.personId });
          for (const o of open) await pd.deleteActivity(o.id);
        }
      } else {
        res.status = 'skipped';
        res.detail = 'unknown action type';
      }
    } catch (err) {
      res.status = 'error';
      res.detail += ` (${err.message})`;
    }
    results.push(res);
  }
  return results;
}

module.exports = { apply, replacePhone };
