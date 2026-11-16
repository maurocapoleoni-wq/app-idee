import { test } from 'node:test';
import assert from 'node:assert/strict';
import { estraiJson, creaClaude, MODELLO_PREDEFINITO } from '../docs/js/claude.js';
import { leggiConfig, salvaConfig, campiMancanti } from '../docs/js/config.js';

function storageFinto() {
  const m = new Map();
  return {
    getItem: (k) => (m.has(k) ? m.get(k) : null),
    setItem: (k, v) => m.set(k, String(v)),
    removeItem: (k) => m.delete(k),
  };
}

test('estraiJson trova il JSON anche con testo intorno', () => {
  assert.deepEqual(estraiJson('Ecco:\n{"domanda":"Chi?","completa":false}\nFine'), { domanda: 'Chi?', completa: false });
  assert.throws(() => estraiJson('nessun json'), /non contiene JSON/);
});

test('prossimaDomanda manda la chiave solo negli header e legge la risposta', async () => {
  let richiesta;
  const fetch = async (url, opzioni) => {
    richiesta = { url, ...opzioni };
    return {
      ok: true,
      json: async () => ({ content: [{ type: 'text', text: '{"domanda":"Chi la userebbe?","completa":false,"scheda":{}}' }] }),
    };
  };
  const claude = creaClaude({ apiKey: 'chiave-di-prova', fetch });
  const esito = await claude.prossimaDomanda({ messaggi: [{ ruolo: 'utente', testo: 'Una app per la spesa' }] });
  assert.equal(esito.domanda, 'Chi la userebbe?');
  assert.equal(richiesta.headers['x-api-key'], 'chiave-di-prova');
  const corpo = JSON.parse(richiesta.body);
  assert.equal(corpo.model, MODELLO_PREDEFINITO);
  assert.ok(!richiesta.body.includes('chiave-di-prova'));
  assert.match(corpo.messages[0].content, /Utente: Una app per la spesa/);
});

test('componiMessaggio rifiuta destinatari sconosciuti', async () => {
  const claude = creaClaude({ apiKey: 'k', fetch: async () => ({ ok: true, json: async () => ({ content: [] }) }) });
  await assert.rejects(claude.componiMessaggio({ schedaMarkdown: '# x', destinatario: 'capo' }), /sconosciuto/);
});

test('senza chiave Claude non parte', () => {
  assert.throws(() => creaClaude({ apiKey: '' }), /chiave API/);
});

test('le impostazioni si salvano, si leggono e si cancellano', () => {
  const s = storageFinto();
  assert.equal(leggiConfig(s).github_repo, 'cassetta-idee');
  assert.equal(leggiConfig(s).modello_domande, MODELLO_PREDEFINITO);
  assert.equal(campiMancanti(leggiConfig(s)).length, 3);
  salvaConfig({ github_owner: ' mauro ', github_token: 't', anthropic_key: 'k' }, s);
  assert.equal(leggiConfig(s).github_owner, 'mauro');
  assert.deepEqual(campiMancanti(leggiConfig(s)), []);
  salvaConfig({ github_token: '' }, s);
  assert.equal(leggiConfig(s).github_token, '');
});
