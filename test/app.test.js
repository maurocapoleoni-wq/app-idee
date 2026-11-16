import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync, readdirSync } from 'node:fs';
import { join, relative } from 'node:path';
import { fileURLToPath } from 'node:url';
import { spiegaErrore } from '../docs/js/ui/impostazioni.js';
import { ErroreGithub } from '../docs/js/github.js';

const DOCS = fileURLToPath(new URL('../docs/', import.meta.url));

function fileJs(cartella) {
  return readdirSync(cartella, { withFileTypes: true }).flatMap((v) =>
    v.isDirectory() ? fileJs(join(cartella, v.name)) : v.name.endsWith('.js') && v.name !== 'sw.js' ? [join(cartella, v.name)] : []);
}

test('ogni file JavaScript di docs/ è nella cache del service worker', () => {
  const sw = readFileSync(join(DOCS, 'sw.js'), 'utf8');
  const mancanti = fileJs(DOCS)
    .map((f) => `./${relative(DOCS, f).replaceAll('\\', '/')}`)
    .filter((f) => !sw.includes(`'${f}'`));
  assert.deepEqual(mancanti, [], 'aggiungili a FILE_APP in docs/sw.js e aumenta VERSIONE');
});

test('gli errori di GitHub diventano messaggi chiari', () => {
  const config = { github_owner: 'utente', github_repo: 'cassetta-idee' };
  assert.match(spiegaErrore(new ErroreGithub('x', 404), config), /non trova utente\/cassetta-idee/);
  assert.match(spiegaErrore(new ErroreGithub('x', 401), config), /rifiuta il token/);
  assert.match(spiegaErrore(new ErroreGithub('x', 403), config), /permessi/);
  assert.match(spiegaErrore(new TypeError('Failed to fetch'), config), /connessione/);
  assert.equal(spiegaErrore(new Error('altro'), config), 'altro');
});
