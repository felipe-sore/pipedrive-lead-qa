'use strict';

const cell = (s) => String(s === undefined || s === null ? '' : s).replace(/\|/g, '/').replace(/\n/g, ' ');

function buildReport({ records, plan, unresolved = [], scope }) {
  const needReview = records.filter((r) => r.review.length);
  const count = (type) => plan.actions.filter((a) => a.type === type).length;
  const lines = [
    '# Pipedrive lead QA',
    '',
    `- Scope: ${scope}`,
    `- Leads checked: **${records.length}**`,
    `- Need your decision: **${needReview.length}**`,
    `- Proposed writes: **${plan.actions.length}** (phone fixes ${count('fix_phone')}, name fixes ${count('fix_person_name')}, company fixes ${count('fix_org_name')}, "${plan.actions.find((a) => a.task) ? plan.actions.find((a) => a.task).task.subject : 'Get Phone Number'}" tasks ${count('replace_open_activities_with_task')})`,
    '',
    'Nothing has been written. Approve the plan, then run `apply` with `--execute`.',
    '',
  ];
  if (unresolved.length) {
    lines.push('## Not resolved from your list', '', '| input | why |', '|---|---|');
    for (const u of unresolved) lines.push(`| ${cell(u.input)} | ${cell(u.reason)} |`);
    lines.push('');
  }
  lines.push('## Needs your decision', '');
  if (!needReview.length) lines.push('_Nothing._', '');
  else {
    lines.push('| lead | issue |', '|---|---|');
    for (const r of needReview) for (const issue of r.review) lines.push(`| ${cell(r.lead.title)} | ${cell(issue)} |`);
    lines.push('');
  }
  lines.push('## Proposed writes', '');
  if (!plan.actions.length) lines.push('_None._', '');
  else {
    lines.push('| lead | action | detail |', '|---|---|---|');
    for (const a of plan.actions) {
      const detail = a.type === 'replace_open_activities_with_task'
        ? `delete open activities, create "${a.task.subject}" due ${a.task.due_date}; ${a.why}`
        : `${a.from} -> ${Object.values(a.set).join(' / ')}${a.why ? '; ' + a.why : ''}`;
      lines.push(`| ${cell(a.label)} | ${a.type} | ${cell(detail)} |`);
    }
    lines.push('');
  }
  lines.push('## All leads', '', '| lead | identity | company | name | duplicate | phone | WhatsApp |', '|---|---|---|---|---|---|---|');
  for (const r of records) {
    const f = r.findings;
    lines.push(`| ${cell(r.lead.title)} | ${cell(f.identity)} | ${cell(f.company)} | ${cell(f.name)} | ${cell(f.duplicate)} | ${cell(f.phone)}${f.repair ? ' (repair: ' + f.repair + ')' : ''} | ${cell(f.whatsapp)} |`);
  }
  return lines.join('\n') + '\n';
}

module.exports = { buildReport };
