---
name: pipedrive-lead-qa
description: >
  Checks Pipedrive leads before the first outreach so no message goes out wrong: is the lead the
  right person, does the company match, is the first name a real name, is the casing right, is
  the same person in the batch twice, is there a reliable phone (and WhatsApp). Read-only audit
  first, one report and one approval for the whole batch, then a plan is applied with a dry run
  by default. Never completes an activity and never sends a message. Use when the user asks to
  validate, check or clean leads in Pipedrive before a campaign, or to check phones/WhatsApp.
---

# Pipedrive lead QA

Outbound messages are built from CRM fields: `{{first_name}}`, `{{company}}`, the phone. When
those fields are wrong, the prospect gets a message that is visibly broken ("Hi RH", the wrong
company, a number that belongs to someone else). This skill catches that before the first touch.

The checks run in `bin/pipedrive-lead-qa.js`. You choose the scope, run the audit, present the
report, and only after the user approves you apply the plan.

## Ground rules

1. **Audit is read-only.** Nothing is written until the user says yes to the plan.
2. **One report, one approval.** Do not ask for confirmation check by check. Show the whole batch:
   decisions first, mechanical fixes after. The user can approve all, or name what to drop.
3. **Never complete an activity and never send.** In many setups, marking the first-touch activity
   done triggers the automated message. The client refuses any write with a `done` field.
4. **Judgment goes to a human.** Identity mismatch, company mismatch, a first name that is not a
   name, duplicates, ambiguous acronyms and unconfirmed phone repairs are reported, never fixed
   automatically.
5. **Fresh data at execution.** The team works these leads live. `apply` fetches open activities
   again right before deleting.
6. **Ask for the scope every run.** Label combinations change from week to week. Do not reuse last
   week's labels without asking.
7. **Secrets in environment variables only.** Never print the API token or a proxy key.

## Setup (first run)

- `npm install` (one dependency: `libphonenumber-js`), Node 18+.
- `PIPEDRIVE_API_TOKEN` in the environment.
- If writes must go through an audit proxy: `PIPEDRIVE_WRITE_BASE_URL`,
  `PIPEDRIVE_WRITE_HEADERS` (`"X-Proxy-Key: ...; X-Actor: ..."`) and, if the proxy injects the
  token, `PIPEDRIVE_WRITE_SKIP_TOKEN=1`. Reads keep going to the Pipedrive API.
- Optional WhatsApp lookup: `WHATSAPP_CHECK_URL` with `{phone}`, `WHATSAPP_CHECK_HEADER`,
  `WHATSAPP_CHECK_FIELD`, `WHATSAPP_CHECK_DELAY_MS` (keep it slow).
- Ask the user for: the first-touch activity subject and type(s), the person field that holds the
  city/state (custom field key), and the task to create when there is no reliable phone.
- Review `config/` with them: `generic_names.txt`, `company_acronyms.txt`, `name_particles.txt`.

## Workflow

1. **Scope.** Ask which label(s) (AND) and whether to restrict to leads whose first-touch activity
   is still open, or take a pasted list (lead ids, emails or names; anything ambiguous comes back
   unresolved, never guessed).
2. **Audit.**
   ```
   node bin/pipedrive-lead-qa.js audit --label "<label>" \
     --first-touch-subject "<subject>" --activity-type <type> \
     --country BR --location-field <key> --check-whatsapp --out qa-output
   ```
   Large batches make one call per person: run it in the background.
3. **Present** `qa-output/report.md`: the "Needs your decision" table first, then proposed writes,
   with counts. Say clearly that nothing was written.
4. **Edit the plan** with the user's decisions: remove actions they reject from
   `qa-output/plan.json`. Decisions on review items (which person is right, which company, how to
   write an acronym) are done by hand or by adding actions they dictate.
5. **Dry run, then execute.**
   ```
   node bin/pipedrive-lead-qa.js apply qa-output/plan.json            # shows what would happen
   node bin/pipedrive-lead-qa.js apply qa-output/plan.json --execute  # only after "yes"
   ```
6. **Report back** what was done, per action, including errors.

## What each check means

| check | flags when | action |
|---|---|---|
| identity | lead title and person name differ | review only; the lead gets no actions |
| company | lead organization differs from the person's (the message uses the person's) | review only |
| name | first name empty, an email, no letters, or a department ("RH", "Sales") | review; no casing fix on it |
| casing | name or company typed all upper or all lower | mechanical fix; short all-caps company tokens go to review |
| duplicate | same person or same phone in two leads of the batch | review; both leads get no actions |
| phone | missing, invalid, foreign, or not on WhatsApp | task to find a phone, replacing open activities |
| BR repair | foreign or invalid number that rebuilds into a Brazilian one on WhatsApp whose area code matches the person's state | phone fix; if the state does not match, review |

## Pipedrive API notes

- Leads cannot be filtered by label in the API: load them and filter in memory.
- Activity filters such as `person_id` are ignored: filter by `lead_id` in memory.
- Leads have no changelog, so "added this week" cannot be read reliably. An open first-touch
  activity is the reliable "not contacted yet" signal.
- Update a lead with `PATCH`. `PUT` answers 404 and is easy to miss in a batch.
