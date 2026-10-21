'use strict';

const test = require('node:test');
const assert = require('node:assert/strict');
const { primaryPhone, categorize } = require('../src/phone');
const { candidates, stateFromLocation, tryRepair } = require('../src/repair-br');
const { loadConfig } = require('../src/config');

const table = loadConfig().brAreaCodes;

test('primary phone wins, then the first one', () => {
  assert.equal(primaryPhone({ phone: [{ value: '1' }, { value: '2', primary: true }] }), '2');
  assert.equal(primaryPhone({ phone: [{ value: '', primary: true }, { value: '3' }] }), '3');
  assert.equal(primaryPhone({ phone: [] }), '');
});

test('categorize against the home country', () => {
  assert.equal(categorize('', 'BR').category, 'missing');
  assert.equal(categorize('(11) 98765-4321', 'BR').category, 'home');
  assert.equal(categorize('+44 20 7946 0958', 'BR').category, 'foreign');
  assert.equal(categorize('123', 'BR').category, 'invalid');
});

test('BR repair: rebuilds candidates from a wrong country code, with and without the 9th digit', () => {
  const list = candidates('+1 31 98765-4321', table).map((x) => x.e164);
  assert.ok(list.includes('+553198765432'), JSON.stringify(candidates('+1 31 98765-4321', table)));
  assert.ok(list.includes('+5531998765432'));
  assert.deepEqual(candidates('+1 20 98765-4321', table), []); // 20 is not a Brazilian area code
});

test('state from free-text location', () => {
  assert.equal(stateFromLocation('Campinas - SP', table), 'SP');
  assert.equal(stateFromLocation('Belo Horizonte, Minas Gerais', table), 'MG');
  assert.equal(stateFromLocation('Campo Grande, Mato Grosso do Sul', table), 'MS');
  assert.equal(stateFromLocation('Joinville', table), 'SC');
  assert.equal(stateFromLocation('Remote', table), null);
});

test('repair is accepted only when WhatsApp and the location agree', async () => {
  const wa = async (e) => (e === '+5531998765432' ? 'on_whatsapp' : 'not_on_whatsapp');
  assert.equal((await tryRepair('+1 31 98765-4321', 'Belo Horizonte', table, wa)).status, 'confirmed');
  assert.equal((await tryRepair('+1 31 98765-4321', 'Recife, PE', table, wa)).status, 'found_location_mismatch');
  assert.equal((await tryRepair('+1 31 98765-4321', '', table, wa)).status, 'found_location_unknown');
  assert.equal((await tryRepair('+1 31 98765-1111', 'Belo Horizonte', table, wa)).status, 'not_on_whatsapp');
});
