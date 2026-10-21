'use strict';

const { headerFromEnv, pick, getJson } = require('./http');

// Checks whether a phone number has WhatsApp, through whatever gateway you run
// (an unofficial WhatsApp HTTP API, a BSP, an internal service). Read-only lookups only.
//
//   WHATSAPP_CHECK_URL     URL with {phone} (digits only, with country code)
//   WHATSAPP_CHECK_HEADER  optional auth header, "Name: value"
//   WHATSAPP_CHECK_FIELD   dotted path to a boolean in the JSON (default: exists)
//   WHATSAPP_CHECK_DELAY_MS  pause between lookups (default 2000). Bursts of lookups
//                          can get a number flagged, keep it slow.

function configured(env = process.env) {
  return Boolean(env.WHATSAPP_CHECK_URL);
}

function delayMs(env = process.env) {
  return Number(env.WHATSAPP_CHECK_DELAY_MS || 2000);
}

async function hasWhatsApp(e164, env = process.env) {
  const digits = String(e164).replace(/\D/g, '');
  const url = env.WHATSAPP_CHECK_URL.replace('{phone}', digits);
  const data = await getJson(url, { headers: headerFromEnv(env.WHATSAPP_CHECK_HEADER) });
  const value = pick(data, env.WHATSAPP_CHECK_FIELD || 'exists');
  if (value === true) return 'on_whatsapp';
  if (value === false) return 'not_on_whatsapp';
  return 'unknown';
}

module.exports = { configured, hasWhatsApp, delayMs };
