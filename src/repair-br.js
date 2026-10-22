'use strict';

// Wrong country code repair, Brazil module.
//
// Scraped and imported numbers often carry a foreign country code on a Brazilian
// number (+1, +44...). This module rebuilds Brazilian candidates and accepts one
// only when ALL of these hold:
//   - the area code (DDD) exists,
//   - the candidate exists on WhatsApp,
//   - the DDD's state matches the state in the person's location.
// A number that exists but lives in another state is NOT accepted: it may belong
// to someone else.
//
// Another country can follow the same shape with its own area code table.

const { parsePhoneNumberFromString } = require('libphonenumber-js');
const { words } = require('./text');

function candidates(raw, table) {
  const digits = String(raw || '').replace(/\D/g, '');
  const nationals = new Set();
  const parsed = parsePhoneNumberFromString('+' + digits);
  if (parsed && parsed.countryCallingCode !== '55') nationals.add(parsed.nationalNumber);
  for (let k = 0; k <= 3; k++) {
    const rest = digits.slice(k);
    if (rest.length === 10 || rest.length === 11) nationals.add(rest);
  }
  const out = [];
  for (const nat of nationals) {
    const ddd = nat.slice(0, 2);
    const state = table.codes[ddd];
    if (!state) continue;
    const local = nat.slice(2);
    const variants = local.length === 9 && local[0] === '9' ? [local]
      : local.length === 8 ? [local, '9' + local] // landline, or an old mobile missing the 9th digit
        : [];
    for (const v of variants) out.push({ e164: `+55${ddd}${v}`, ddd, state });
  }
  return [...new Map(out.map((c) => [c.e164, c])).values()];
}

// Reads a state out of free text like "Belo Horizonte, Minas Gerais" or "Campinas - SP".
// A wrong state is worse than none (it can confirm someone else's number), so:
//   - a name must match a whole part of the location ("Paraty" is not "Pará",
//     "Ceará-Mirim" is not "Ceará"); only multi-word names like "São Paulo" are
//     also found inside a longer text ("Greater São Paulo Area");
//   - a state name beats a city name ("Campo Grande, Rio de Janeiro" is RJ);
//   - two different states at the same level mean unknown, never a guess.
function stateFromLocation(location, table) {
  const text = String(location || '');
  if (!text.trim()) return null;
  for (const m of text.matchAll(/\b([A-Z]{2})\b/g)) if (table.states[m[1]]) return m[1];
  const parts = text.split(/[,;/|()]|\s-\s/).map(words).filter(Boolean);
  const whole = ` ${words(text)} `;
  for (const level of ['state', 'city']) {
    const found = new Set();
    for (const [uf, s] of Object.entries(table.states)) {
      for (const name of (level === 'state' ? [s.name] : s.cities).map(words)) {
        if (parts.includes(name) || (name.includes(' ') && whole.includes(` ${name} `))) found.add(uf);
      }
    }
    if (found.size === 1) return [...found][0];
    if (found.size > 1) return null;
  }
  return null;
}

async function tryRepair(raw, location, table, hasWhatsApp) {
  const list = candidates(raw, table);
  if (!list.length) return { status: 'no_candidate' };
  const state = stateFromLocation(location, table);
  let inconclusive = 0;
  for (const c of list) {
    const wa = await hasWhatsApp(c.e164);
    if (wa !== 'on_whatsapp' && wa !== 'not_on_whatsapp') inconclusive++;
    if (wa !== 'on_whatsapp') continue;
    if (!state) return { status: 'found_location_unknown', ...c };
    if (state !== c.state) return { status: 'found_location_mismatch', locationState: state, ...c };
    return { status: 'confirmed', ...c };
  }
  // One lookup that failed means the right candidate may be the one we could not check.
  if (inconclusive) return { status: 'inconclusive', tried: list.map((c) => c.e164) };
  return { status: 'not_on_whatsapp', tried: list.map((c) => c.e164) };
}

module.exports = { candidates, stateFromLocation, tryRepair };
