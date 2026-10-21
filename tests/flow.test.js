'use strict';

const test = require('node:test');
const assert = require('node:assert/strict');
const { Pipedrive, parseHeaders } = require('../src/pipedrive');
const scope = require('../src/scope');
const { audit, nextMonday } = require('../src/audit');
const { apply } = require('../src/apply');
const { buildReport } = require('../src/report');
const { loadConfig } = require('../src/config');
const { makeFake } = require('./fake-pipedrive');
const { seed, L, hasWhatsApp } = require('./fixtures');

const cfg = loadConfig();
const NOW = new Date('2026-10-21T12:00:00Z'); // a Wednesday
const client = (fake, extra = {}) => new Pipedrive({ token: 't', fetchImpl: fake.fetchImpl, sleep: async () => {}, ...extra });
const opts = { homeCountry: 'BR', locationField: 'loc', checkWhatsapp: true, now: NOW };

async function runAudit(fake) {
  const pd = client(fake);
  const sc = await scope.byLabels(pd, { labels: ['Outbound Q4'], firstTouchSubject: 'WhatsApp Message', activityTypes: ['whatsapp_message'] });
  return { sc, ...(await audit(pd, sc.leads, cfg, opts, { hasWhatsApp })) };
}
const rec = (r, n) => r.records.find((x) => x.lead.id === L(n));
const actionsFor = (r, n) => r.plan.actions.filter((a) => a.leadId === L(n)).map((a) => a.type);

test('next Monday', () => {
  assert.equal(nextMonday(NOW), '2026-10-26');
  assert.equal(nextMonday(new Date('2026-10-26T09:00:00Z')), '2026-11-02');
});

test('scope: all labels AND first touch still open', async () => {
  const fake = makeFake(seed());
  const pd = client(fake);
  const a = await scope.byLabels(pd, { labels: ['outbound q4'], firstTouchSubject: 'WhatsApp Message', activityTypes: ['whatsapp_message'] });
  assert.equal(a.labeledCount, 10);
  assert.equal(a.leads.length, 9); // lead 10 was already contacted
  const b = await scope.byLabels(pd, { labels: ['Outbound Q4', 'Region South'] });
  assert.deepEqual(b.leads.map((l) => l.id), [L(9)]);
  await assert.rejects(scope.byLabels(pd, { labels: ['Nope'] }), /not found/);
});

test('scope: list resolves ids, emails and names; ambiguous stays unresolved', async () => {
  const s = seed();
  s.persons[0].email = [{ value: 'ana@northwind.example' }];
  const pd = client(makeFake(s));
  const r = await scope.byList(pd, [L(2), 'ana@northwind.example', 'Carla Dias', 'Fabio Reis', 'Nobody']);
  assert.deepEqual(r.leads.map((l) => l.id).sort(), [L(1), L(2), L(3)].sort());
  assert.deepEqual(r.unresolved.map((u) => u.input), ['Fabio Reis', 'Nobody']);
});

test('audit: every check lands where it should', async () => {
  const r = await runAudit(makeFake(seed()));

  assert.deepEqual(actionsFor(r, 1), []); // clean lead
  assert.match(rec(r, 2).review.join(), /lead company "Fabrikam" vs person company "Northwind Labs"/);
  assert.deepEqual(actionsFor(r, 2), ['fix_person_name']);
  assert.deepEqual(r.plan.actions.find((a) => a.leadId === L(2)).set, { name: 'Bruno Lima dos Santos', first_name: 'Bruno', last_name: 'Lima dos Santos' });

  assert.deepEqual(actionsFor(r, 3).sort(), ['fix_org_name', 'fix_phone']);
  assert.equal(r.plan.actions.find((a) => a.type === 'fix_phone').set.phone, '+5531987654321');

  assert.equal(rec(r, 4).findings.identity, 'mismatch');
  assert.deepEqual(actionsFor(r, 4), []); // blocked until a human decides

  assert.match(rec(r, 5).review.join(), /TGA may be an acronym/);
  assert.deepEqual(actionsFor(r, 5), ['replace_open_activities_with_task']);

  assert.match(rec(r, 6).review.join(), /same person/);
  assert.deepEqual(actionsFor(r, 6), []);
  assert.deepEqual(actionsFor(r, 7), []);

  assert.match(rec(r, 8).findings.name, /department/);
  assert.deepEqual(actionsFor(r, 8), []); // no casing fix on a name that is not a name

  assert.equal(rec(r, 9).findings.whatsapp, 'not_on_whatsapp');
  assert.deepEqual(actionsFor(r, 9), ['replace_open_activities_with_task']);
  assert.equal(r.plan.actions.find((a) => a.leadId === L(9)).task.due_date, '2026-10-26');
});

test('audit never writes', async () => {
  const fake = makeFake(seed());
  await runAudit(fake);
  assert.ok(fake.calls.every((c) => c.method === 'GET'));
});

test('report puts decisions first and says nothing was written', async () => {
  const r = await runAudit(makeFake(seed()));
  const md = buildReport({ ...r, scope: 'labels Outbound Q4' });
  assert.ok(md.indexOf('## Needs your decision') < md.indexOf('## Proposed writes'));
  assert.match(md, /Nothing has been written/);
  assert.match(md, /Leads checked: \*\*9\*\*/);
});

test('apply dry run writes nothing, even with a writable client', async () => {
  const fake = makeFake(seed());
  const r = await runAudit(fake);
  const before = fake.calls.length;
  const res = await apply(client(fake, { readOnly: false }), r.plan, { execute: false });
  assert.ok(res.every((x) => x.status === 'dry_run'));
  assert.ok(fake.calls.slice(before).every((c) => c.method === 'GET'));
});

test('apply --execute: fresh activities, deletes, task, fixes; never completes an activity', async () => {
  const fake = makeFake(seed());
  const r = await runAudit(fake);
  // The team completed the follow-up between audit and apply.
  fake.db.activities.find((a) => a.id === 20).done = true;
  const before = fake.calls.length;
  const res = await apply(client(fake, { readOnly: false }), r.plan, { execute: true });
  assert.ok(res.every((x) => x.status === 'done'), JSON.stringify(res));

  const writes = fake.calls.slice(before).filter((c) => c.method !== 'GET');
  assert.ok(writes.every((c) => !c.body || !('done' in c.body)));
  assert.ok(!writes.some((c) => c.path.startsWith('/v1/leads/')));

  const lead5 = fake.db.activities.filter((a) => a.lead_id === L(5));
  assert.deepEqual(lead5.map((a) => a.subject).sort(), ['Get Phone Number', 'WhatsApp Message Follow-up']);
  assert.equal(fake.db.persons.find((p) => p.id === 102).name, 'Bruno Lima dos Santos');
  assert.equal(fake.db.persons.find((p) => p.id === 103).phone[0].value, '+5531987654321');
  assert.equal(fake.db.orgs.find((o) => o.id === 3).name, 'Globex Industrial');
});

test('client rails: read-only by default, never sends "done", retries 429', async () => {
  const fake = makeFake(seed());
  await assert.rejects(client(fake).deleteActivity(1), /read-only/);
  await assert.rejects(client(fake, { readOnly: false }).createActivity({ subject: 'x', done: 1 }), /never completes/);

  let n = 0;
  const flaky = async (...a) => (n++ < 2 ? { ok: false, status: 429, json: async () => ({}) } : fake.fetchImpl(...a));
  const pd = new Pipedrive({ token: 't', fetchImpl: flaky, sleep: async () => {} });
  assert.equal((await pd.leadLabels()).length, 2);
});

test('write proxy: writes go to another base URL with extra headers, token optional', async () => {
  const fake = makeFake(seed());
  const pd = client(fake, {
    readOnly: false, writeBaseUrl: 'https://proxy.example', writeHeaders: parseHeaders('X-Proxy-Key: k; X-Actor: qa'), tokenOnWrites: false,
  });
  await pd.updateOrganization(1, { name: 'Northwind' });
  const call = fake.calls.at(-1);
  assert.equal(call.headers['X-Actor'], 'qa');
  assert.equal(call.query.api_token, undefined);
  await pd.person(101);
  assert.equal(fake.calls.at(-1).query.api_token, 't');
});

test('lead updates use PATCH (PUT on a lead is a silent 404)', async () => {
  const fake = makeFake(seed());
  const pd = client(fake, { readOnly: false });
  await pd.updateLead(L(1), { title: 'x' }).catch(() => {});
  assert.equal(fake.calls.at(-1).method, 'PATCH');
});
