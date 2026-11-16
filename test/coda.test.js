import { test } from 'node:test';
import assert from 'node:assert/strict';
import { creaCoda, memoriaInRam } from '../docs/js/coda.js';

const el = (percorso, contenuto = 'x') => ({ percorso, contenuto, messaggio: `salva ${percorso}` });

test('un invio riuscito svuota la coda in ordine', async () => {
  const coda = creaCoda(memoriaInRam());
  await coda.aggiungi(el('a'));
  await coda.aggiungi(el('b'));
  const inviati = [];
  const esito = await coda.invia(async (e) => inviati.push(e.percorso));
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
    tentati.push(e.percorso);
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

test('lo stesso file in attesa viene aggiornato, non duplicato', async () => {
  const coda = creaCoda(memoriaInRam());
  await coda.aggiungi(el('a', 'v1'));
  await coda.aggiungi(el('b'));
  await coda.aggiungi(el('a', 'v2'));
  const lista = await coda.elementi();
  assert.deepEqual(lista.map((e) => [e.percorso, e.contenuto]), [['a', 'v2'], ['b', 'x']]);
});

test('una versione arrivata durante l’invio resta in coda e viene inviata', async () => {
  const coda = creaCoda(memoriaInRam());
  await coda.aggiungi(el('a', 'v1'));
  const inviati = [];
  await coda.invia(async (e) => {
    inviati.push(e.contenuto);
    if (e.contenuto === 'v1') await coda.aggiungi(el('a', 'v2'));
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

test('elementi non validi vengono rifiutati', async () => {
  const coda = creaCoda(memoriaInRam());
  await assert.rejects(coda.aggiungi({ percorso: '', contenuto: 'x' }), /non valido/);
  await assert.rejects(coda.aggiungi({ percorso: 'a', contenuto: null }), /non valido/);
});
