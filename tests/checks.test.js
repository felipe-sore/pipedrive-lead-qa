'use strict';

const test = require('node:test');
const assert = require('node:assert/strict');
const c = require('../src/checks');
const { loadConfig } = require('../src/config');

const cfg = loadConfig();

test('identity: tolerates the default " lead" suffix and accents', () => {
  assert.equal(c.identityMatches('João Silva lead', 'Joao Silva'), true);
  assert.equal(c.identityMatches('Ana Souza', 'Ana Souza Lima'), true);
  assert.equal(c.identityMatches('Diego Rocha lead', 'Someone Else'), false);
  assert.equal(c.identityMatches('', 'Ana'), false);
  assert.equal(c.identityMatches('Ana lead', 'Mariana Costa'), false);
});

test('organization: mismatch, missing on person, ok', () => {
  assert.equal(c.organizationCheck({ organization_id: 2 }, { org_id: { value: 1 } }).status, 'mismatch');
  assert.equal(c.organizationCheck({ organization_id: 2 }, { org_id: null }).status, 'person_missing_org');
  assert.equal(c.organizationCheck({ organization_id: 1 }, { org_id: { value: 1 } }).status, 'ok');
  assert.equal(c.organizationCheck({ organization_id: null }, { org_id: { value: 1 } }).status, 'ok');
});

test('name: departments, emails and empty values are not names', () => {
  assert.equal(c.nameLooksReal('RH', cfg).ok, false);
  assert.equal(c.nameLooksReal('Financeiro', cfg).ok, false);
  assert.equal(c.nameLooksReal('ana@x.com', cfg).ok, false);
  assert.equal(c.nameLooksReal('  ', cfg).ok, false);
  assert.equal(c.nameLooksReal('123', cfg).ok, false);
  assert.equal(c.nameLooksReal('Ana', cfg).ok, true);
});

test('person casing: only all-upper or all-lower, particles lowercase', () => {
  assert.equal(c.personNameCase('BRUNO LIMA DOS SANTOS', cfg), 'Bruno Lima dos Santos');
  assert.equal(c.personNameCase('DOS SANTOS', cfg, { lastName: true }), 'dos Santos');
  assert.equal(c.personNameCase('Ana McDonald', cfg), null);
});

test('company casing: known acronyms upper, unknown short all-caps tokens go to a human', () => {
  assert.deepEqual(c.orgNameCase('GLOBEX INDUSTRIAL LTDA', cfg), { change: 'Globex Industrial LTDA' });
  assert.deepEqual(c.orgNameCase('acme s.a.', cfg), { change: 'Acme S.A.' });
  assert.deepEqual(c.orgNameCase('TGA SOLUCOES', cfg), { change: null, ambiguous: ['TGA'] });
  assert.deepEqual(c.orgNameCase('Contoso Inc', cfg), { change: null });
});

test('duplicates: same person or same phone in one batch', () => {
  const recs = [
    { lead: { id: 'a' }, person: { id: 1 }, phoneRaw: '+55 11 90000-0001' },
    { lead: { id: 'b' }, person: { id: 1 }, phoneRaw: '' },
    { lead: { id: 'c' }, person: { id: 2 }, phoneRaw: '5511900000001' },
    { lead: { id: 'd' }, person: { id: 3 }, phoneRaw: '+55 11 90000-0009' },
  ];
  const dup = c.findDuplicates(recs);
  assert.match(dup.get('a'), /same person/);
  assert.match(dup.get('b'), /same person/);
  assert.match(dup.get('c'), /same phone/);
  assert.equal(dup.has('d'), false);
});
