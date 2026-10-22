# pipedrive-lead-qa

![tests](https://github.com/felipe-sore/pipedrive-lead-qa/actions/workflows/test.yml/badge.svg)

A [Claude Code](https://docs.claude.com/en/docs/claude-code) skill plus a Node.js CLI that checks Pipedrive leads **before the first outreach**, so no prospect gets a broken message.

Outbound templates are filled from CRM fields. When the data is wrong, the message is wrong in public:

- *"Hi RH, ..."* because the first name field holds a department.
- The right person, the **wrong company**: the lead points to the current employer, the person record to the previous one, and the template uses the person's.
- `GLOBEX INDUSTRIAL` in the middle of a friendly sentence.
- Two messages to the same person, because they sit in two leads.
- A Brazilian number saved with a `+1` in front, so it is never reached.

Each check in this tool exists because one of these happened in a real outbound operation.

## How it works

```
audit (read-only)  ->  report.md + plan.json  ->  human approves  ->  apply (dry run)  ->  apply --execute
```

- **Audit** reads the leads in scope, runs every check and writes a report and a plan. It never writes to Pipedrive.
- **One report, one approval.** Items that need judgment are listed first; mechanical fixes after.
- **Apply** runs the approved plan. Dry run by default. Open activities are fetched again right before execution, because the team works them live.
- **It never completes an activity and never sends anything.** In many setups, completing the first-touch activity is what fires the automated message. The client refuses any write with a `done` field, and a test checks it.

## Checks

| check | flags | what happens |
|---|---|---|
| Identity | lead title and person name differ | review only, no actions on that lead |
| Company | lead organization differs from the person's | review only |
| First name | empty, an email, no letters, or a department ("RH", "Sales") | review |
| Casing | all-caps or all-lowercase names and companies | fixed, except short all-caps company tokens: `TGA` is an acronym, `VEJA` is a word, so a human decides |
| Duplicates | same person or same phone twice in the batch | review, no actions on either lead |
| Phone | missing, invalid, foreign, or not on WhatsApp | a "Get Phone Number" task replaces the open activities |
| Wrong country code (Brazil module) | foreign or invalid number | rebuilds Brazilian candidates (with and without the 9th digit) and accepts one only if it is on WhatsApp **and** its area code matches the person's state |

## Quick start

```bash
git clone https://github.com/felipe-sore/pipedrive-lead-qa.git
cd pipedrive-lead-qa && npm install
npm run demo   # runs the audit against a fictional CRM, no account needed
```

Against your account:

```bash
export PIPEDRIVE_API_TOKEN=...
node bin/pipedrive-lead-qa.js audit --label "Outbound Q4" \
  --first-touch-subject "WhatsApp Message" --activity-type whatsapp_message \
  --country BR --location-field <person custom field key>
node bin/pipedrive-lead-qa.js apply qa-output/plan.json            # dry run
node bin/pipedrive-lead-qa.js apply qa-output/plan.json --execute  # after you approve
```

See [`examples/sample_report.md`](examples/sample_report.md) for a full report.

### As a Claude Code skill

Clone into `~/.claude/skills/pipedrive-lead-qa/`, run `npm install`, and ask *"check the leads labeled Outbound Q4 before we send"*. The agent follows [`SKILL.md`](SKILL.md): asks for the scope, runs the audit, shows you one report, and applies only what you approve.

## Configuration

| | |
|---|---|
| `PIPEDRIVE_API_TOKEN` | required |
| `PIPEDRIVE_WRITE_BASE_URL`, `PIPEDRIVE_WRITE_HEADERS`, `PIPEDRIVE_WRITE_SKIP_TOKEN=1` | send writes through an audit proxy (who changed what), reads stay direct |
| `WHATSAPP_CHECK_URL` (`{phone}`), `WHATSAPP_CHECK_HEADER`, `WHATSAPP_CHECK_FIELD`, `WHATSAPP_CHECK_DELAY_MS` | WhatsApp lookup through your own gateway, read-only |
| `config/generic_names.txt` | values that are not first names |
| `config/company_acronyms.txt` | tokens always upper case in company names |
| `config/br_area_codes.json` | Brazilian area codes, states and cities for the repair module |

Another country can get its own repair module with the same shape as `src/repair-br.js`.

## Pipedrive API lessons

Learned the hard way, handled in the code:

- **Leads take `PATCH`.** `PUT /v1/leads/{id}` answers 404, easy to miss in a batch of writes.
- **No label filter on leads.** Load them and filter in memory.
- **Activity filters like `person_id` are ignored.** Filter by `lead_id` in memory.
- **Leads have no changelog**, so "added this week" cannot be read reliably. An open first-touch activity is the reliable "not contacted yet" signal.
- **429s happen** in batches; the client backs off and retries.
- **`/v1/activities` returns only the token owner's activities** unless you pass `user_id=0`. Leads owned by other reps would silently drop out of scope.
- **Create before you delete.** The replacement task is created first; if that fails, the lead keeps its old activities instead of ending up with none (and being archived by a "no pending activity" rule).
- **A WhatsApp lookup that is not a clear yes or no is inconclusive**, never "no WhatsApp": the lead goes to review and its activities are left alone.

## Tests

`npm test` runs against an in-memory fake of the Pipedrive API: scope, every check, the report, the dry run, execution, the "never completes an activity" rail, the write proxy and the 429 retry. Node 18, 20 and 22 on every push.

## About

Built by [Felipe Sore](https://linkedin.com/in/felipesore) with Claude Code, from the checks I run before outbound campaigns.

## License

MIT. See [LICENSE](LICENSE).
