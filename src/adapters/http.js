'use strict';

// Shared helpers for the optional provider adapters.

// "X-Api-Key: abc" -> { 'X-Api-Key': 'abc' }
function headerFromEnv(value) {
  if (!value) return {};
  const i = value.indexOf(':');
  return i > 0 ? { [value.slice(0, i).trim()]: value.slice(i + 1).trim() } : {};
}

// Reads "a.b.c" out of a JSON response.
function pick(obj, path) {
  return String(path || '').split('.').filter(Boolean).reduce((o, k) => (o == null ? undefined : o[k]), obj);
}

async function getJson(url, { headers = {}, method = 'GET', body, timeoutMs = 15000 } = {}) {
  const res = await fetch(url, {
    method,
    headers: { Accept: 'application/json', ...(body ? { 'Content-Type': 'application/json' } : {}), ...headers },
    body: body ? JSON.stringify(body) : undefined,
    signal: AbortSignal.timeout(timeoutMs),
  });
  if (!res.ok) throw new Error(`HTTP ${res.status}`);
  return res.json();
}

const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

module.exports = { headerFromEnv, pick, getJson, sleep };
