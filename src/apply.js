'use strict';

// Executes an approved plan. Dry run unless execute = true.
// Open activities are fetched fresh at execution time: the team works them live,
// so a list from the audit may already be stale.

async function freshOpenActivities(pd, leadId) {
  const all = await pd.paginate('/v1/activities', { done: 0 }, 500);
  return all.filter((a) => a.lead_id === leadId);
}

async function apply(pd, plan, { execute = false } = {}) {
  const results = [];
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
        if (execute) await pd.updatePerson(a.personId, { phone: [{ value: a.set.phone, primary: true }] });
      } else if (a.type === 'replace_open_activities_with_task') {
        const open = await freshOpenActivities(pd, a.leadId);
        res.detail = `delete ${open.length} open activit${open.length === 1 ? 'y' : 'ies'} (${open.map((o) => o.subject).join(', ') || 'none'}), create "${a.task.subject}" due ${a.task.due_date}`;
        if (execute) {
          for (const o of open) await pd.deleteActivity(o.id);
          await pd.createActivity({ ...a.task, lead_id: a.leadId, person_id: a.personId });
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

module.exports = { apply };
