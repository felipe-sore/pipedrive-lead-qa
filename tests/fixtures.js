'use strict';

// Fictional CRM. Every name, company and number here is made up.

const LABEL_A = '11111111-1111-1111-1111-111111111111';
const LABEL_B = '22222222-2222-2222-2222-222222222222';
const L = (n) => `aaaaaaaa-0000-0000-0000-${String(n).padStart(12, '0')}`;

function seed() {
  return {
    labels: [{ id: LABEL_A, name: 'Outbound Q4' }, { id: LABEL_B, name: 'Region South' }],
    orgs: [
      { id: 1, name: 'Northwind Labs' },
      { id: 2, name: 'Fabrikam' },
      { id: 3, name: 'GLOBEX INDUSTRIAL' },
      { id: 4, name: 'TGA SOLUCOES' },
      { id: 5, name: 'Contoso' },
    ],
    leads: [
      { id: L(1), title: 'Ana Souza lead', person_id: 101, organization_id: 1, label_ids: [LABEL_A] },
      { id: L(2), title: 'Bruno Lima lead', person_id: 102, organization_id: 2, label_ids: [LABEL_A] },
      { id: L(3), title: 'Carla Dias lead', person_id: 103, organization_id: 3, label_ids: [LABEL_A] },
      { id: L(4), title: 'Diego Rocha lead', person_id: 199, organization_id: 4, label_ids: [LABEL_A] },
      { id: L(5), title: 'Elisa Prado lead', person_id: 105, organization_id: 4, label_ids: [LABEL_A] },
      { id: L(6), title: 'Fabio Reis lead', person_id: 106, organization_id: 5, label_ids: [LABEL_A] },
      { id: L(7), title: 'Fabio Reis lead (2)', person_id: 106, organization_id: 5, label_ids: [LABEL_A] },
      { id: L(8), title: 'Gil Matos lead', person_id: 108, organization_id: 1, label_ids: [LABEL_A] },
      { id: L(9), title: 'Hana Kato lead', person_id: 109, organization_id: 1, label_ids: [LABEL_A, LABEL_B] },
      { id: L(10), title: 'Already Contacted lead', person_id: 110, organization_id: 1, label_ids: [LABEL_A] },
    ],
    persons: [
      { id: 101, name: 'Ana Souza', first_name: 'Ana', last_name: 'Souza', org_id: { value: 1, name: 'Northwind Labs' }, phone: [{ value: '+55 11 98765-4321', primary: true }], loc: 'São Paulo, SP' },
      { id: 102, name: 'BRUNO LIMA DOS SANTOS', first_name: 'BRUNO', last_name: 'LIMA DOS SANTOS', org_id: { value: 1, name: 'Northwind Labs' }, phone: [{ value: '+55 21 99876-5432', primary: true }], loc: 'Rio de Janeiro' },
      { id: 103, name: 'Carla Dias', first_name: 'Carla', last_name: 'Dias', org_id: { value: 3, name: 'GLOBEX INDUSTRIAL' }, phone: [{ value: '+1 31 98765-4321', primary: true }], loc: 'Belo Horizonte, Minas Gerais' },
      { id: 199, name: 'Someone Else', first_name: 'Someone', last_name: 'Else', org_id: { value: 4, name: 'TGA SOLUCOES' }, phone: [{ value: '+55 41 99999-0000', primary: true }], loc: 'Curitiba' },
      { id: 105, name: 'Elisa Prado', first_name: 'Elisa', last_name: 'Prado', org_id: { value: 4, name: 'TGA SOLUCOES' }, phone: [], loc: '' },
      { id: 106, name: 'Fabio Reis', first_name: 'Fabio', last_name: 'Reis', org_id: { value: 5, name: 'Contoso' }, phone: [{ value: '+55 51 99123-4567', primary: true }], loc: 'Porto Alegre' },
      { id: 108, name: 'Gil Matos', first_name: 'RH', last_name: '', org_id: { value: 1, name: 'Northwind Labs' }, phone: [{ value: '+55 31 98888-7777', primary: true }], loc: 'Recife, PE' },
      { id: 109, name: 'Hana Kato', first_name: 'Hana', last_name: 'Kato', org_id: { value: 1, name: 'Northwind Labs' }, phone: [{ value: '+55 11 91234-5678', primary: true }], loc: '' },
      { id: 110, name: 'Already Contacted', first_name: 'Already', last_name: 'Contacted', org_id: { value: 1, name: 'Northwind Labs' }, phone: [], loc: '' },
    ],
    activities: [
      ...[1, 2, 3, 4, 5, 6, 7, 8, 9].map((n) => ({ id: n, subject: 'WhatsApp Message', type: 'whatsapp_message', lead_id: L(n), done: false })),
      { id: 20, subject: 'WhatsApp Message Follow-up', type: 'whatsapp_message', lead_id: L(5), done: false },
      { id: 21, subject: 'Email', type: 'email', lead_id: L(5), done: false },
      { id: 30, subject: 'WhatsApp Message', type: 'whatsapp_message', lead_id: L(10), done: true },
    ],
  };
}

// WhatsApp gateway stub: numbers listed here exist.
const ON_WHATSAPP = new Set(['+5511987654321', '+5521998765432', '+5531987654321', '+5551991234567', '+5531988887777']);
const hasWhatsApp = async (e164) => (ON_WHATSAPP.has(e164) ? 'on_whatsapp' : 'not_on_whatsapp');

module.exports = { seed, L, LABEL_A, LABEL_B, hasWhatsApp };
