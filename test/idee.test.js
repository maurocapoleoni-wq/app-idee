import { test } from 'node:test';
import assert from 'node:assert/strict';
import {
  STATI, SCHEDE, slugify, creaIdea, cambiaStato, puoPassareA, archivia, cestina,
  ripristina, aggiungiMiglioria, inScheda, ordinaPerRecenti, pagina,
} from '../docs/js/idee.js';

const ORA = new Date(2026, 10, 16, 12, 40);
const DOPO = new Date(2026, 10, 17, 9, 0);

function impostata() {
  let i = creaIdea({ titolo: 'Promemoria scadenze auto', ora: ORA });
  i = cambiaStato(i, STATI.PRONTA, ORA);
  return cambiaStato(i, STATI.IMPOSTATA, ORA);
}

test('slugify toglie accenti, simboli e spazi', () => {
  assert.equal(slugify('Città più bella!'), 'citta-piu-bella');
  assert.equal(slugify('  App  per la   spesa  '), 'app-per-la-spesa');
  assert.equal(slugify('!!!'), 'idea');
  assert.ok(slugify('a'.repeat(80)).length <= 50);
  assert.ok(!slugify('parola '.repeat(20)).endsWith('-'));
});

test("creaIdea parte in discussione con id data-slug", () => {
  const i = creaIdea({ titolo: 'App per la spesa', ora: ORA });
  assert.equal(i.id, '2026-11-16-app-per-la-spesa');
  assert.equal(i.stato, STATI.IN_DISCUSSIONE);
  assert.equal(i.versione, 1);
  assert.deepEqual(i.migliorie, []);
  assert.throws(() => creaIdea({ titolo: '   ' }), /obbligatorio/);
});

test('le transizioni non ammesse vengono rifiutate', () => {
  const i = creaIdea({ titolo: 'x', ora: ORA });
  assert.equal(puoPassareA(i, STATI.IMPOSTATA), false);
  assert.throws(() => cambiaStato(i, STATI.IMPOSTATA), /non ammessa/);
  assert.throws(() => cambiaStato(i, STATI.ARCHIVIATA), /non ammessa/);
});

test("cambiaStato non modifica l'idea originale", () => {
  const i = creaIdea({ titolo: 'x', ora: ORA });
  const j = cambiaStato(i, STATI.PRONTA, DOPO);
  assert.equal(i.stato, STATI.IN_DISCUSSIONE);
  assert.equal(j.stato, STATI.PRONTA);
  assert.equal(j.aggiornata, DOPO.toISOString());
});

test('archivia e ripristina tornano allo stato precedente', () => {
  const i = impostata();
  const a = archivia(i, DOPO);
  assert.equal(a.stato, STATI.ARCHIVIATA);
  assert.equal(a.statoPrecedente, STATI.IMPOSTATA);
  const r = ripristina(a, DOPO);
  assert.equal(r.stato, STATI.IMPOSTATA);
  assert.equal(r.statoPrecedente, null);
});

test("dall'archivio al cestino si conserva lo stato vivo originale", () => {
  const c = cestina(archivia(impostata(), DOPO), DOPO);
  assert.equal(c.stato, STATI.NEL_CESTINO);
  assert.equal(c.statoPrecedente, STATI.IMPOSTATA);
  assert.equal(ripristina(c).stato, STATI.IMPOSTATA);
});

test('ripristina rifiuta idee non messe da parte', () => {
  assert.throws(() => ripristina(impostata()), /Si possono ripristinare/);
});

test('aggiungiMiglioria incrementa la versione e mette in attesa', () => {
  const m = aggiungiMiglioria(impostata(), { titolo: 'Notifiche 7 giorni prima', ora: DOPO });
  assert.equal(m.versione, 2);
  assert.equal(m.stato, STATI.MIGLIORIA_IN_ATTESA);
  assert.deepEqual(m.migliorie[0], {
    versione: 2, slug: 'notifiche-7-giorni-prima', titolo: 'Notifiche 7 giorni prima',
    creata: DOPO.toISOString(), applicata: null,
  });
  const m2 = aggiungiMiglioria(m, { titolo: 'Tagliando', ora: DOPO });
  assert.equal(m2.versione, 3);
  assert.equal(m2.migliorie.length, 2);
});

test('una miglioria riapre un’idea archiviata ma non una nel cestino', () => {
  const riaperta = aggiungiMiglioria(archivia(impostata()), { titolo: 'Tagliando', ora: DOPO });
  assert.equal(riaperta.stato, STATI.MIGLIORIA_IN_ATTESA);
  assert.equal(riaperta.statoPrecedente, null);
  assert.throws(() => aggiungiMiglioria(cestina(impostata()), { titolo: 'x' }), /già impostate/);
  assert.throws(() => aggiungiMiglioria(creaIdea({ titolo: 'x' }), { titolo: 'y' }), /già impostate/);
});

test('applicare le migliorie le segna come applicate', () => {
  const m = aggiungiMiglioria(impostata(), { titolo: 'Tagliando', ora: ORA });
  const applicata = cambiaStato(m, STATI.IMPOSTATA, DOPO);
  assert.equal(applicata.migliorie[0].applicata, DOPO.toISOString());
});

test('inScheda separa attive, archivio e cestino', () => {
  const i = impostata();
  assert.ok(inScheda(i, SCHEDE.ATTIVE));
  assert.ok(inScheda(archivia(i), SCHEDE.ARCHIVIO));
  assert.ok(!inScheda(archivia(i), SCHEDE.ATTIVE));
  assert.ok(inScheda(cestina(i), SCHEDE.CESTINO));
});

test('ordinaPerRecenti mette prima le più recenti', () => {
  const a = creaIdea({ titolo: 'a', ora: ORA });
  const b = creaIdea({ titolo: 'b', ora: DOPO });
  assert.deepEqual(ordinaPerRecenti([a, b]).map((i) => i.titolo), ['b', 'a']);
});

test('pagina mostra 3 idee alla volta e limita il numero di pagina', () => {
  const lista = Array.from({ length: 10 }, (_, i) => i);
  assert.deepEqual(pagina(lista, 1), { elementi: [0, 1, 2], numero: 1, totalePagine: 4 });
  assert.deepEqual(pagina(lista, 4).elementi, [9]);
  assert.equal(pagina(lista, 99).numero, 4);
  assert.deepEqual(pagina(lista, 1, 4).elementi, [0, 1, 2, 3]);
  assert.equal(pagina(lista, 0).numero, 1);
  assert.deepEqual(pagina([], 1), { elementi: [], numero: 1, totalePagine: 1 });
});
