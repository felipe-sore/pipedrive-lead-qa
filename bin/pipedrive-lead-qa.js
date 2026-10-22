#!/usr/bin/env node
'use strict';

const fs = require('fs');
const path = require('path');
const { fromEnv } = require('../src/pipedrive');
const { loadConfig } = require('../src/config');
const scope = require('../src/scope');
const { audit } = require('../src/audit');
const { buildReport } = require('../src/report');
const { apply } = require('../src/apply');
const whatsapp = require('../src/adapters/whatsapp');

const HELP = `Usage:
  pipedrive-lead-qa audit [scope] [options]     read-only: report.md + plan.json
  pipedrive-lead-qa apply <plan.json> [--execute]   dry run unless --execute

Scope (one of):
  --label <name>                 repeat for AND (leads with all labels)
  --list <file>                  one lead id, email or name per line

Audit options:
  --first-touch-subject <text>   only leads with this activity still open (e.g. "WhatsApp Message")
  --activity-type <key>          activity type(s) of that first touch, repeatable (default: call)
  --country <XX>                 home country for phones (default BR)
  --location-field <key>         person field with the city/state (custom field key)
  --check-whatsapp               WhatsApp lookup through WHATSAPP_CHECK_URL
  --task-subject <text>          task created when no reliable phone (default "Get Phone Number")
  --task-type <key>              its activity type (default call)
  --out <dir>                    output folder (default qa-output)

Environment: PIPEDRIVE_API_TOKEN (required). Optional: PIPEDRIVE_WRITE_BASE_URL,
PIPEDRIVE_WRITE_HEADERS, PIPEDRIVE_WRITE_SKIP_TOKEN=1 (write proxy), WHATSAPP_CHECK_* (see README).
`;

function parseArgs(argv) {
  const o = { _: [], label: [], activityType: [] };
  const valued = ['label', 'list', 'firstTouchSubject', 'activityType', 'country', 'locationField', 'taskSubject', 'taskType', 'out'];
  for (let i = 0; i < argv.length; i++) {
    const a = argv[i];
    if (!a.startsWith('--')) { o._.push(a); continue; }
    const name = a.slice(2).replace(/-([a-z])/g, (_, c) => c.toUpperCase());
    if (!valued.includes(name)) { o[name] = true; continue; }
    const v = argv[++i];
    if (Array.isArray(o[name])) o[name].push(v); else o[name] = v;
  }
  return o;
}

async function runAudit(o) {
  if (!o.label.length && !o.list) throw new Error('Give a scope: --label <name> or --list <file>');
  if (o.checkWhatsapp && !whatsapp.configured()) throw new Error('--check-whatsapp needs WHATSAPP_CHECK_URL');
  const pd = fromEnv();
  const cfg = loadConfig();
  const sc = o.list
    ? await scope.byList(pd, fs.readFileSync(o.list, 'utf8').split(/\r?\n/))
    : await scope.byLabels(pd, { labels: o.label, firstTouchSubject: o.firstTouchSubject, activityTypes: o.activityType.length ? o.activityType : ['call'] });
  const scopeText = o.list
    ? `list ${path.basename(o.list)}`
    : `labels ${o.label.join(' + ')}${o.firstTouchSubject ? `, "${o.firstTouchSubject}" still open (${sc.leads.length} of ${sc.labeledCount} labeled)` : ''}`;

  const result = await audit(pd, sc.leads, cfg, {
    homeCountry: o.country, locationField: o.locationField, checkWhatsapp: Boolean(o.checkWhatsapp),
    taskSubject: o.taskSubject, taskType: o.taskType, whatsappDelayMs: whatsapp.delayMs(),
  }, { hasWhatsApp: whatsapp.configured() ? (p) => whatsapp.hasWhatsApp(p) : null });

  const out = o.out || 'qa-output';
  fs.mkdirSync(out, { recursive: true });
  fs.writeFileSync(path.join(out, 'report.md'), buildReport({ ...result, unresolved: sc.unresolved, scope: scopeText }));
  fs.writeFileSync(path.join(out, 'plan.json'), JSON.stringify(result.plan, null, 2) + '\n');
  process.stdout.write(`${result.records.length} leads checked, ${result.plan.actions.length} proposed writes\n${path.join(out, 'report.md')}\n${path.join(out, 'plan.json')}\n`);
}

async function runApply(o) {
  const file = o._[1];
  if (!file) throw new Error('apply needs a plan file');
  const plan = JSON.parse(fs.readFileSync(file, 'utf8'));
  const pd = fromEnv(process.env, { readOnly: !o.execute });
  const results = await apply(pd, plan, { execute: Boolean(o.execute) });
  for (const r of results) process.stdout.write(`${r.status.padEnd(7)} ${r.type.padEnd(34)} ${r.lead}: ${r.detail}\n`);
  if (!o.execute) process.stdout.write('\nDry run. Nothing was written. Add --execute to apply.\n');
  if (results.some((r) => r.status === 'error')) process.exitCode = 1;
}

const o = parseArgs(process.argv.slice(2));
const cmd = o._[0];
const run = cmd === 'audit' ? runAudit : cmd === 'apply' ? runApply : null;
if (!run || o.help) { process.stdout.write(HELP); process.exit(run ? 0 : 1); }
run(o).catch((err) => { process.stderr.write(`Error: ${err.message}\n`); process.exit(1); });
