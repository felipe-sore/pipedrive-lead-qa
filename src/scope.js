'use strict';

// Who gets checked this run.
//
// By label: leads that carry ALL the given labels AND still have the first-touch
// activity open (subject match, done = 0). An open first-touch activity is the
// signal "nobody has contacted this lead yet". Pipedrive has no changelog for
// leads, so "added this week" cannot be read reliably; this signal can.
//
// By list: lead ids, emails or names pasted by the user. Anything that does not
// resolve to exactly one lead is returned as unresolved, never guessed.

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

async function byLabels(pd, { labels, firstTouchSubject, activityTypes = [] }) {
  const all = await pd.leadLabels();
  const ids = labels.map((name) => {
    const hit = all.find((l) => l.name.toLowerCase() === name.toLowerCase());
    if (!hit) throw new Error(`Label "${name}" not found. Available: ${all.map((l) => l.name).join(', ')}`);
    return hit.id;
  });
  const labeled = (await pd.leads()).filter((l) => ids.every((id) => (l.label_ids || []).includes(id)));
  if (!firstTouchSubject) return { leads: labeled, unresolved: [], labeledCount: labeled.length };

  const open = new Set();
  for (const type of activityTypes) {
    for (const a of await pd.openActivities(type)) {
      if (a.lead_id && a.subject === firstTouchSubject) open.add(a.lead_id);
    }
  }
  return { leads: labeled.filter((l) => open.has(l.id)), unresolved: [], labeledCount: labeled.length };
}

async function byList(pd, items) {
  const leads = await pd.leads();
  const found = new Map();
  const unresolved = [];
  for (const raw of items.map((s) => String(s).trim()).filter(Boolean)) {
    let matches = [];
    if (UUID.test(raw)) matches = leads.filter((l) => l.id === raw);
    else if (raw.includes('@')) {
      const persons = await pd.search('persons', raw, 'email');
      const pids = new Set(persons.map((p) => p.id));
      matches = leads.filter((l) => pids.has(l.person_id));
    } else {
      const hits = await pd.search('leads', raw, 'title');
      const lids = new Set(hits.map((h) => h.id));
      matches = leads.filter((l) => lids.has(l.id));
    }
    if (matches.length === 1) found.set(matches[0].id, matches[0]);
    else unresolved.push({ input: raw, reason: matches.length ? `${matches.length} leads match` : 'no lead found' });
  }
  return { leads: [...found.values()], unresolved, labeledCount: null };
}

module.exports = { byLabels, byList };
