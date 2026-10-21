# Pipedrive lead QA

- Scope: labels Outbound Q4, "WhatsApp Message" still open (9 of 10 labeled)
- Leads checked: **9**
- Need your decision: **6**
- Proposed writes: **5** (phone fixes 1, name fixes 1, company fixes 1, "Get Phone Number" tasks 2)

Nothing has been written. Approve the plan, then run `apply` with `--execute`.

## Needs your decision

| lead | issue |
|---|---|
| Bruno Lima lead | lead company "Fabrikam" vs person company "Northwind Labs" |
| Diego Rocha lead | lead title "Diego Rocha lead" vs person "Someone Else" |
| Elisa Prado lead | company "TGA SOLUCOES": TGA may be an acronym, decide the casing |
| Fabio Reis lead | same person (106) in 2 leads |
| Fabio Reis lead (2) | same person (106) in 2 leads |
| Gil Matos lead | "RH" is a department, not a name |

## Proposed writes

| lead | action | detail |
|---|---|---|
| Bruno Lima lead | fix_person_name | BRUNO LIMA DOS SANTOS -> Bruno Lima dos Santos / Bruno / Lima dos Santos |
| Carla Dias lead | fix_org_name | GLOBEX INDUSTRIAL -> Globex Industrial |
| Carla Dias lead | fix_phone | +1 31 98765-4321 -> +5531987654321; area code 31 matches MG |
| Elisa Prado lead | replace_open_activities_with_task | delete open activities, create "Get Phone Number" due 2026-10-26; no reliable phone (missing) |
| Hana Kato lead | replace_open_activities_with_task | delete open activities, create "Get Phone Number" due 2026-10-26; no reliable phone (home, WhatsApp not_on_whatsapp) |

## All leads

| lead | identity | company | name | duplicate | phone | WhatsApp |
|---|---|---|---|---|---|---|
| Ana Souza lead | ok | ok | ok | no | home | on_whatsapp |
| Bruno Lima lead | ok | mismatch | ok | no | home | on_whatsapp |
| Carla Dias lead | ok | ok | ok | no | invalid (repair: confirmed) | on_whatsapp |
| Diego Rocha lead | mismatch | ok | ok | no | home | not_on_whatsapp |
| Elisa Prado lead | ok | ok | ok | no | missing | not_checked |
| Fabio Reis lead | ok | ok | ok | same person (106) in 2 leads | home | on_whatsapp |
| Fabio Reis lead (2) | ok | ok | ok | same person (106) in 2 leads | home | on_whatsapp |
| Gil Matos lead | ok | ok | "RH" is a department, not a name | no | home | on_whatsapp |
| Hana Kato lead | ok | ok | ok | no | home | not_on_whatsapp |
