'use strict';

const fs = require('fs');
const path = require('path');

function configDir() {
  return process.env.LEAD_QA_CONFIG_DIR || path.join(__dirname, '..', 'config');
}

function readList(file) {
  const full = path.join(configDir(), file);
  if (!fs.existsSync(full)) return new Set();
  return new Set(fs.readFileSync(full, 'utf8').split(/\r?\n/)
    .map((l) => l.trim().toLowerCase()).filter((l) => l && !l.startsWith('#')));
}

function loadConfig() {
  return {
    genericNames: readList('generic_names.txt'),
    particles: readList('name_particles.txt'),
    acronyms: readList('company_acronyms.txt'),
    brAreaCodes: JSON.parse(fs.readFileSync(path.join(configDir(), 'br_area_codes.json'), 'utf8')),
  };
}

module.exports = { loadConfig };
