'use strict';

// In-memory Pipedrive v1 for tests. Records every request.

function makeFake(seed) {
  const db = JSON.parse(JSON.stringify(seed));
  db.activities = db.activities || [];
  const calls = [];
  let nextActivityId = 9000;

  const page = (items, url) => {
    const start = Number(url.searchParams.get('start') || 0);
    const limit = Number(url.searchParams.get('limit') || 100);
    const slice = items.slice(start, start + limit);
    const more = start + limit < items.length;
    return { success: true, data: slice, additional_data: { pagination: { more_items_in_collection: more, next_start: more ? start + limit : undefined } } };
  };

  async function fetchImpl(href, init = {}) {
    const url = new URL(href);
    const method = init.method || 'GET';
    const body = init.body ? JSON.parse(init.body) : undefined;
    calls.push({ method, path: url.pathname, query: Object.fromEntries(url.searchParams), body, headers: init.headers });
    const json = (status, data) => ({ ok: status < 400, status, json: async () => data });
    const p = url.pathname;
    let m;

    if (method === 'GET' && p === '/v1/leadLabels') return json(200, { success: true, data: db.labels });
    if (method === 'GET' && p === '/v1/leads') return json(200, page(db.leads, url));
    if (method === 'GET' && p === '/v1/activities') {
      const type = url.searchParams.get('type');
      const done = url.searchParams.get('done');
      // Like the real API: without user_id=0 only the token owner's (user 1) activities come back.
      const allUsers = url.searchParams.get('user_id') === '0';
      const items = db.activities.filter((a) => (!type || a.type === type) && (done === null || String(Number(a.done)) === done)
        && (allUsers || (a.user_id || 1) === 1));
      return json(200, page(items, url));
    }
    if (method === 'GET' && (m = p.match(/^\/v1\/persons\/(\d+)$/))) {
      const person = db.persons.find((x) => x.id === Number(m[1]));
      return person ? json(200, { success: true, data: person }) : json(404, { success: false, error: 'not found' });
    }
    if (method === 'GET' && (m = p.match(/^\/v1\/organizations\/(\d+)$/))) {
      return json(200, { success: true, data: db.orgs.find((x) => x.id === Number(m[1])) });
    }
    if (method === 'GET' && p === '/v1/persons/search') {
      const term = url.searchParams.get('term');
      const items = db.persons.filter((x) => (x.email || []).some((e) => e.value === term)).map((item) => ({ item }));
      return json(200, { success: true, data: { items } });
    }
    if (method === 'GET' && p === '/v1/leads/search') {
      const term = url.searchParams.get('term').toLowerCase();
      const items = db.leads.filter((l) => l.title.toLowerCase().includes(term)).map((item) => ({ item }));
      return json(200, { success: true, data: { items } });
    }
    if (method === 'PUT' && (m = p.match(/^\/v1\/persons\/(\d+)$/))) {
      Object.assign(db.persons.find((x) => x.id === Number(m[1])), body);
      return json(200, { success: true, data: {} });
    }
    if (method === 'PUT' && (m = p.match(/^\/v1\/organizations\/(\d+)$/))) {
      Object.assign(db.orgs.find((x) => x.id === Number(m[1])), body);
      return json(200, { success: true, data: {} });
    }
    if (method === 'PUT' && p.startsWith('/v1/leads/')) return json(404, { success: false, error: 'Unknown method .' });
    if (method === 'DELETE' && (m = p.match(/^\/v1\/activities\/(\d+)$/))) {
      db.activities = db.activities.filter((a) => a.id !== Number(m[1]));
      return json(200, { success: true, data: { id: Number(m[1]) } });
    }
    if (method === 'POST' && p === '/v1/activities') {
      const a = { id: nextActivityId++, done: false, ...body };
      db.activities.push(a);
      return json(201, { success: true, data: a });
    }
    return json(404, { success: false, error: `no route ${method} ${p}` });
  }

  return { db, calls, fetchImpl };
}

module.exports = { makeFake };
