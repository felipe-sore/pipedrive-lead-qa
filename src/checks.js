'use strict';

const { key, words } = require('./text');

// Pipedrive names new leads "<Person> lead" by default.
function normalizeName(s) {
  return words(s).replace(/ lead$/, '').trim();
}

// Is the lead about the person it points to? A wrong person_id means
// every other check would validate the wrong human.
function identityMatches(leadTitle, personName) {
  const a = normalizeName(leadTitle);
  const b = normalizeName(personName);
  if (!a || !b) return false;
  return a === b || a.includes(b) || b.includes(a);
}

// The message uses the PERSON's organization. When the lead points to one company
// and the person to another (often a previous employer never updated), the message
// names the wrong company.
function organizationCheck(lead, person) {
  const leadOrg = lead.organization_id || null;
  const personOrg = person.org_id ? (person.org_id.value || person.org_id) : null;
  if (leadOrg && personOrg && leadOrg !== personOrg) return { status: 'mismatch', leadOrg, personOrg };
  if (leadOrg && !personOrg) return { status: 'person_missing_org', leadOrg };
  return { status: 'ok' };
}

// Would "Hi {{first_name}}" read like a real name?
function nameLooksReal(firstName, cfg) {
  const fn = String(firstName || '').trim().toLowerCase();
  if (!fn) return { ok: false, why: 'empty first name' };
  if (fn.includes('@')) return { ok: false, why: 'first name is an email' };
  if (!/\p{L}/u.test(fn)) return { ok: false, why: 'first name has no letters' };
  if (cfg.genericNames.has(fn) || cfg.genericNames.has(key(fn))) return { ok: false, why: `"${firstName}" is a department, not a name` };
  return { ok: true };
}

function needsCasing(s) {
  const t = String(s || '').trim();
  return Boolean(t) && /\p{L}/u.test(t) && (t === t.toUpperCase() || t === t.toLowerCase());
}

function cap(w) {
  return w.split('-').map((p) => p.split("'").map((q) => (q ? q[0].toUpperCase() + q.slice(1) : q)).join("'")).join('-');
}

// Only fields typed all upper or all lower case are touched; mixed case is kept.
function personNameCase(name, cfg, { lastName = false } = {}) {
  if (!needsCasing(name)) return null;
  const out = name.trim().toLowerCase().split(/\s+/)
    .map((w, i) => ((i > 0 || lastName) && cfg.particles.has(w) ? w : cap(w))).join(' ');
  return out === name ? null : out;
}

// Company names: known acronyms go upper case; any other short token in an
// all-caps name is ambiguous ("TGA" vs "VEJA") and goes to a human.
function orgNameCase(name, cfg) {
  if (!needsCasing(name)) return { change: null };
  const tokens = name.trim().split(/\s+/);
  const ambiguous = [];
  const out = tokens.map((t, i) => {
    const lower = t.toLowerCase();
    const bare = lower.replace(/[.,]/g, '');
    if (cfg.acronyms.has(lower) || cfg.acronyms.has(bare)) return t.toUpperCase();
    if (i > 0 && cfg.particles.has(bare)) return lower;
    if (/^\p{L}{2,4}$/u.test(t) && t === t.toUpperCase()) ambiguous.push(t);
    return cap(lower);
  }).join(' ');
  if (ambiguous.length) return { change: null, ambiguous };
  return { change: out === name ? null : out };
}

// The same person or phone twice in one batch means two messages to one human.
function findDuplicates(records) {
  const byPerson = new Map();
  const byPhone = new Map();
  for (const r of records) {
    if (r.person) {
      if (!byPerson.has(r.person.id)) byPerson.set(r.person.id, []);
      byPerson.get(r.person.id).push(r.lead.id);
    }
    const digits = String(r.phoneRaw || '').replace(/\D/g, '');
    if (digits.length >= 8) {
      if (!byPhone.has(digits)) byPhone.set(digits, []);
      byPhone.get(digits).push(r.lead.id);
    }
  }
  const dup = new Map();
  for (const [pid, ids] of byPerson) if (new Set(ids).size > 1) for (const id of ids) dup.set(id, `same person (${pid}) in ${ids.length} leads`);
  for (const [ph, ids] of byPhone) if (new Set(ids).size > 1) for (const id of ids) if (!dup.has(id)) dup.set(id, `same phone in ${ids.length} leads`);
  return dup;
}

module.exports = { identityMatches, organizationCheck, nameLooksReal, personNameCase, orgNameCase, findDuplicates, needsCasing };
