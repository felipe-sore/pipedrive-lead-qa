'use strict';

const { parsePhoneNumberFromString } = require('libphonenumber-js');

function primaryPhone(person) {
  const list = (person && person.phone) || [];
  const p = list.find((x) => x.primary && x.value) || list.find((x) => x.value);
  return p ? String(p.value).trim() : '';
}

// missing | home (valid, home country) | foreign (valid, other country) | invalid
function categorize(raw, homeCountry) {
  if (!raw) return { category: 'missing' };
  const text = raw.replace(/^00/, '+');
  const parsed = parsePhoneNumberFromString(text, homeCountry);
  if (!parsed || !parsed.isValid()) return { category: 'invalid' };
  return { category: parsed.country === homeCountry ? 'home' : 'foreign', e164: parsed.number, country: parsed.country };
}

module.exports = { primaryPhone, categorize };
