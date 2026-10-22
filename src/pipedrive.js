'use strict';

// Thin Pipedrive v1 client. Two safety rails live here, not in the callers:
//   1. Read-only by default. Writes need { readOnly: false }, which only `apply --execute` sets.
//   2. It refuses any body that completes an activity ("done"). In many setups,
//      completing the first-touch activity is what triggers the automated message,
//      so this tool must never do it.

class Pipedrive {
  constructor({
    token, baseUrl = 'https://api.pipedrive.com', writeBaseUrl, writeHeaders = {},
    tokenOnWrites = true, readOnly = true, fetchImpl = (...a) => fetch(...a),
    sleep = (ms) => new Promise((r) => setTimeout(r, ms)),
  }) {
    if (!token) throw new Error('PIPEDRIVE_API_TOKEN is not set');
    Object.assign(this, { token, baseUrl, writeBaseUrl: writeBaseUrl || baseUrl, writeHeaders, tokenOnWrites, readOnly, fetchImpl, sleep });
    this.calls = 0;
  }

  async request(method, path, { params = {}, body } = {}) {
    const write = method !== 'GET';
    if (write && this.readOnly) throw new Error(`Refusing ${method} ${path}: client is read-only`);
    if (body && Object.prototype.hasOwnProperty.call(body, 'done')) {
      throw new Error('Refusing to change an activity\'s "done" flag: this tool never completes activities');
    }
    const url = new URL(path, write ? this.writeBaseUrl : this.baseUrl);
    for (const [k, v] of Object.entries(params)) if (v !== undefined) url.searchParams.set(k, String(v));
    if (!write || this.tokenOnWrites) url.searchParams.set('api_token', this.token);
    const headers = { Accept: 'application/json', ...(body ? { 'Content-Type': 'application/json' } : {}), ...(write ? this.writeHeaders : {}) };

    for (let attempt = 0; ; attempt++) {
      this.calls++;
      const res = await this.fetchImpl(url.toString(), { method, headers, body: body ? JSON.stringify(body) : undefined });
      if (res.status === 429 && attempt < 4) { await this.sleep(1000 * 2 ** attempt); continue; }
      const data = await res.json().catch(() => ({}));
      if (!res.ok || data.success === false) {
        throw new Error(`${method} ${path} failed: HTTP ${res.status} ${data.error || ''}`.trim());
      }
      return data;
    }
  }

  async paginate(path, params = {}, limit = 100) {
    const out = [];
    let start = 0;
    for (;;) {
      const d = await this.request('GET', path, { params: { ...params, limit, start } });
      out.push(...(d.data || []));
      const p = (d.additional_data && d.additional_data.pagination) || {};
      if (!p.more_items_in_collection) return out;
      // A missing or non-advancing cursor would refetch the same page forever.
      if (!(Number(p.next_start) > start)) throw new Error(`GET ${path}: pagination says more items but next_start is ${p.next_start}`);
      start = Number(p.next_start);
    }
  }

  leadLabels() { return this.request('GET', '/v1/leadLabels').then((d) => d.data || []); }
  // The leads endpoint cannot filter by label: load once, filter in memory.
  leads() { return this._leads || (this._leads = this.paginate('/v1/leads', {}, 100)); }
  // Same for activities: filters like person_id are ignored by the API, so we
  // always filter by lead_id in memory. user_id=0 means every user's activities;
  // without it the API returns only the token owner's, and leads owned by other
  // reps would silently fall out of scope.
  openActivities(type) { return this.paginate('/v1/activities', { done: 0, type, user_id: 0 }, 500); }
  person(id) { return this.request('GET', `/v1/persons/${id}`).then((d) => d.data); }
  organization(id) { return this.request('GET', `/v1/organizations/${id}`).then((d) => d.data); }
  search(entity, term, fields) {
    return this.request('GET', `/v1/${entity}/search`, { params: { term, fields, exact_match: true } })
      .then((d) => ((d.data && d.data.items) || []).map((i) => i.item));
  }

  updatePerson(id, body) { return this.request('PUT', `/v1/persons/${id}`, { body }); }
  updateOrganization(id, body) { return this.request('PUT', `/v1/organizations/${id}`, { body }); }
  // Leads take PATCH. PUT on a lead answers 404, which is easy to miss in a batch.
  updateLead(id, body) { return this.request('PATCH', `/v1/leads/${id}`, { body }); }
  deleteActivity(id) { return this.request('DELETE', `/v1/activities/${id}`); }
  createActivity(body) { return this.request('POST', '/v1/activities', { body }); }
}

// "X-Proxy-Key: abc; X-Actor: me" -> headers object
function parseHeaders(value) {
  const out = {};
  for (const part of String(value || '').split(';')) {
    const i = part.indexOf(':');
    if (i > 0) out[part.slice(0, i).trim()] = part.slice(i + 1).trim();
  }
  return out;
}

function fromEnv(env = process.env, overrides = {}) {
  return new Pipedrive({
    token: env.PIPEDRIVE_API_TOKEN,
    baseUrl: env.PIPEDRIVE_BASE_URL || undefined,
    writeBaseUrl: env.PIPEDRIVE_WRITE_BASE_URL || undefined,
    writeHeaders: parseHeaders(env.PIPEDRIVE_WRITE_HEADERS),
    tokenOnWrites: env.PIPEDRIVE_WRITE_SKIP_TOKEN !== '1',
    ...overrides,
  });
}

module.exports = { Pipedrive, fromEnv, parseHeaders };
