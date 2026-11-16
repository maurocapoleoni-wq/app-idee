import { test } from 'node:test';
import assert from 'node:assert/strict';
import { creaCoda, memoriaInRam } from '../docs/js/coda.js';

// Un salvataggio di un'idea: più file, un solo commit.
const el = (chiave, contenuti = { 'stato.json': 'x' }) => ({
  chiave,
  files: Object.entries(contenuti).map(([nome, contenuto]) => ({ percorso: `${chiave}/${nome}`, contenuto })),
  messaggio: `salva ${chiave}`,
});

test('un invio riuscito svuota la coda in ordine', async () => {
  const coda = creaCoda(memoriaInRam());
  await coda.aggiungi(el('a'));
  await coda.aggiungi(el('b'));
  const inviati = [];
  const esito = await coda.invia(async (e) => inviati.push(e.chiave));
  assert.deepEqual(inviati, ['a', 'b']);
  assert.equal(esito.inviati, 2);
  assert.equal(esito.inAttesa, 0);
  assert.equal(esito.errore, null);
});

test("un errore non perde nulla e ferma l'invio per rispettare l'ordine", async () => {
  const coda = creaCoda(memoriaInRam());
  await coda.aggiungi(el('a'));
  await coda.aggiungi(el('b'));
  const tentati = [];
  const esito = await coda.invia(async (e) => {
    tentati.push(e.chiave);
    throw new Error('rete assente');
  });
  assert.deepEqual(tentati, ['a']);
  assert.equal(esito.inAttesa, 2);
  assert.equal(esito.errore.message, 'rete assente');
  const [primo] = await coda.elementi();
  assert.equal(primo.tentativi, 1);
  assert.equal(primo.ultimoErrore, 'rete assente');
  const dopo = await coda.invia(async () => {});
  assert.equal(dopo.inviati, 2);
  assert.equal(dopo.inAttesa, 0);
});

test("la stessa idea in attesa unisce i file invece di duplicarsi", async () => {
  const coda = creaCoda(memoriaInRam());
  await coda.aggiungi(el('a', { 'stato.json': 'v1', 'migliorie/v2-x.md': 'miglioria' }));
  await coda.aggiungi(el('b'));
  await coda.aggiungi(el('a', { 'stato.json': 'v2', 'scheda.md': 'scheda' }));
  const lista = await coda.elementi();
  assert.deepEqual(lista.map((e) => e.chiave), ['a', 'b']);
  // Il file della miglioria non va perso anche se il salvataggio dopo non lo contiene.
  assert.deepEqual(
    Object.fromEntries(lista[0].files.map((f) => [f.percorso, f.contenuto])),
    { 'a/stato.json': 'v2', 'a/migliorie/v2-x.md': 'miglioria', 'a/scheda.md': 'scheda' },
  );
});

test('una versione arrivata durante l’invio resta in coda e viene inviata', async () => {
  const coda = creaCoda(memoriaInRam());
  await coda.aggiungi(el('a', { 'stato.json': 'v1' }));
  const inviati = [];
  await coda.invia(async (e) => {
    const contenuto = e.files[0].contenuto;
    inviati.push(contenuto);
    if (contenuto === 'v1') await coda.aggiungi(el('a', { 'stato.json': 'v2' }));
  });
  assert.deepEqual(inviati, ['v1', 'v2']);
  assert.equal(await coda.inAttesa(), 0);
});

test('due invii contemporanei non mandano due volte lo stesso elemento', async () => {
  const coda = creaCoda(memoriaInRam());
  await coda.aggiungi(el('a'));
  let chiamate = 0;
  const invia = async () => {
    chiamate += 1;
    await new Promise((r) => setTimeout(r, 5));
  };
  await Promise.all([coda.invia(invia), coda.invia(invia)]);
  assert.equal(chiamate, 1);
});

test('il vecchio formato a file singolo viene ancora letto e inviato', async () => {
  const coda = creaCoda(memoriaInRam([{ id: 'x', percorso: 'a/stato.json', contenuto: 'vecchio', messaggio: 'm', tentativi: 0 }]));
  const inviati = [];
  await coda.invia(async (e) => inviati.push(e.files));
  assert.deepEqual(inviati, [[{ percorso: 'a/stato.json', contenuto: 'vecchio' }]]);
  assert.equal(await coda.inAttesa(), 0);
});

test('elementi non validi vengono rifiutati', async () => {
  const coda = creaCoda(memoriaInRam());
  await assert.rejects(coda.aggiungi({ percorso: '', contenuto: 'x' }), /non valido/);
  await assert.rejects(coda.aggiungi({ chiave: 'a', files: [] }), /non valido/);
  await assert.rejects(coda.aggiungi({ chiave: 'a', files: [{ percorso: 'a/b', contenuto: null }] }), /non valido/);
});
