'use strict';

// Runs the audit against the fictional CRM used in the tests and writes the
// report and plan you see in this folder. No real Pipedrive account involved.

const fs = require('fs');
const path = require('path');
const { Pipedrive } = require('../src/pipedrive');
const scope = require('../src/scope');
const { audit } = require('../src/audit');
const { buildReport } = require('../src/report');
const { loadConfig } = require('../src/config');
const { makeFake } = require('../tests/fake-pipedrive');
const { seed, hasWhatsApp } = require('../tests/fixtures');

(async () => {
  const pd = new Pipedrive({ token: 'demo', fetchImpl: makeFake(seed()).fetchImpl });
  const sc = await scope.byLabels(pd, { labels: ['Outbound Q4'], firstTouchSubject: 'WhatsApp Message', activityTypes: ['whatsapp_message'] });
  const result = await audit(pd, sc.leads, loadConfig(), {
    homeCountry: 'BR', locationField: 'loc', checkWhatsapp: true, now: new Date('2026-10-21T12:00:00Z'),
  }, { hasWhatsApp });
  const scopeText = `labels Outbound Q4, "WhatsApp Message" still open (${sc.leads.length} of ${sc.labeledCount} labeled)`;
  fs.writeFileSync(path.join(__dirname, 'sample_report.md'), buildReport({ ...result, scope: scopeText }));
  fs.writeFileSync(path.join(__dirname, 'sample_plan.json'), JSON.stringify({ ...result.plan, generatedAt: '2026-10-21T12:00:00.000Z' }, null, 2) + '\n');
  process.stdout.write(fs.readFileSync(path.join(__dirname, 'sample_report.md'), 'utf8'));
})();
