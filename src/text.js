'use strict';

// Lowercase, no accents, only a-z0-9. Used for every comparison so
// "São Paulo", "SAO PAULO" and "sao-paulo" are the same key.
function key(value) {
  return String(value || '')
    .normalize('NFD')
    .replace(/[̀-ͯ]/g, '')
    .toLowerCase()
    .replace(/[^a-z0-9]/g, '');
}

// Same as key() but keeps spaces between words, for whole-word matching.
function words(value) {
  return String(value || '')
    .normalize('NFD')
    .replace(/[̀-ͯ]/g, '')
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, ' ')
    .trim();
}

function isBlank(value) {
  return value === undefined || value === null || String(value).trim() === '';
}

module.exports = { key, words, isBlank };
