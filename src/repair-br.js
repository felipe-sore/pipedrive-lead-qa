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
const { key } = require('./text');

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
function stateFromLocation(location, table) {
  const text = String(location || '');
  if (!text.trim()) return null;
  for (const m of text.matchAll(/\b([A-Z]{2})\b/g)) if (table.states[m[1]]) return m[1];
  const k = key(text);
  // Longest names first, so "Mato Grosso do Sul" is not read as "Mato Grosso".
  const names = [];
  for (const [uf, s] of Object.entries(table.states)) {
    names.push([key(s.name), uf, 0]);
    for (const c of s.cities) names.push([key(c), uf, 1]);
  }
  names.sort((a, b) => a[2] - b[2] || b[0].length - a[0].length);
  const hit = names.find(([n]) => k.includes(n));
  return hit ? hit[1] : null;
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
