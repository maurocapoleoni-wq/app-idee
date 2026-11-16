import { test } from 'node:test';
import assert from 'node:assert/strict';
import { token, cerca, simili, documentoDaIdea } from '../docs/js/ricerca.js';

const doc = (id, titolo, campi = {}, extra = {}) => ({
  id, titolo, stato: 'pronta', aggiornata: '2026-11-16T10:00:00.000Z',
  campi: { titolo, problema: '', utenti: '', funzioni: '', piattaforma: '', note: '', conversazione: '', ...campi },
  ...extra,
});

const sogni = doc('2026-11-16-sogni', 'Diario dei sogni', {
  problema: 'Dimentico i sogni al risveglio', utenti: 'Io', funzioni: 'registrare a voce. cercare per parola', piattaforma: 'Telefono Android',
  note: 'forse a pagamento', conversazione: 'una app per annotare i sogni appena sveglio',
});
const diario2 = doc('2026-11-17-diario-notturno', 'Diario notturno dei sogni', {
  problema: 'Ricordare i sogni appena svegli', utenti: 'Io', funzioni: 'registrare a voce. ritrovare i sogni cercando una parola', piattaforma: 'Telefono',
});
const spesa = doc('2026-11-15-spesa', 'Lista della spesa condivisa', {
  problema: 'Si dimentica cosa comprare', utenti: 'La famiglia', funzioni: 'lista condivisa. notifica', piattaforma: 'Telefono',
}, { stato: 'archiviata' });
const auto = doc('2026-11-14-auto', 'Promemoria scadenze auto', {
  problema: 'Scadono bollo e assicurazione', utenti: 'Automobilisti', funzioni: 'avvisi sulle scadenze', piattaforma: 'Telefono',
}, { stato: 'nel_cestino' });
const tutte = [sogni, diario2, spesa, auto];

test('token toglie accenti, parole vuote e vocali finali', () => {
  assert.deepEqual(token('Città più bella'), ['citt', 'bell']);
  assert.deepEqual(token('sogni sogno'), ['sogn', 'sogn']);
  assert.deepEqual(token('diario diari'), ['diar', 'diar']);
  assert.deepEqual(token('una app per la spesa'), ['spes']);
  assert.deepEqual(token(''), []);
});

test('cerca trova anche con parole parziali, singolare e plurale, maiuscole e accenti', () => {
  assert.deepEqual(cerca(tutte, 'SOGNO').map((r) => r.id), ['2026-11-16-sogni', '2026-11-17-diario-notturno']);
  assert.equal(cerca(tutte, 'regis')[0].id, '2026-11-16-sogni'); // "registrare"
  assert.equal(cerca(tutte, 'famigl').length, 1);
  assert.equal(cerca(tutte, 'automobilista')[0].id, '2026-11-14-auto');
});

test('cerca trova anche in archivio e nel cestino', () => {
  assert.equal(cerca(tutte, 'spesa')[0].id, '2026-11-15-spesa');
  assert.equal(cerca(tutte, 'bollo')[0].id, '2026-11-14-auto');
});

test('servono tutte le parole, e il titolo vale più del resto', () => {
  assert.deepEqual(cerca(tutte, 'sogni android').map((r) => r.id), ['2026-11-16-sogni']);
  assert.deepEqual(cerca(tutte, 'sogni lista'), []);
  const r = cerca([sogni, doc('x', 'Note sui sogni', { note: 'altro' }), doc('y', 'Altro', { problema: 'i sogni' })], 'sogni');
  assert.deepEqual(r.map((x) => x.id), ['2026-11-16-sogni', 'x', 'y']); // titolo (5) prima di problema (2)
});

test("l'estratto mostra dove ha trovato la parola, e niente se è nel titolo", () => {
  const r = cerca(tutte, 'pagamento')[0];
  assert.equal(r.campo, 'Note');
  assert.match(r.estratto, /forse a pagamento/);
  assert.equal(cerca(tutte, 'spesa')[0].estratto, '');
  assert.equal(cerca(tutte, 'spesa')[0].campo, 'Titolo');
});

test('una ricerca vuota o fatta di sole parole vuote non trova nulla', () => {
  assert.deepEqual(cerca(tutte, ''), []);
  assert.deepEqual(cerca(tutte, 'di la per'), []);
});

test('simili: due diari dei sogni si somigliano, il resto no', () => {
  const trovate = simili(sogni, tutte);
  assert.deepEqual(trovate.map((t) => t.id), ['2026-11-17-diario-notturno']);
  assert.equal(trovate[0].doppione, trovate[0].punteggio >= 0.45);
  assert.deepEqual(simili(spesa, tutte), []);
  assert.deepEqual(simili(auto, tutte), []);
});

test('simili non confronta un\'idea con se stessa e non usa note né conversazioni', () => {
  assert.equal(simili(sogni, [sogni]).length, 0);
  const soloNote = doc('n', 'Altra cosa', { note: 'diario sogni registrare voce parola', conversazione: 'diario sogni registrare voce' });
  assert.deepEqual(simili(sogni, [soloNote]), []);
});

test('un doppione evidente è segnalato, e bastano poche parole in comune per non esserlo', () => {
  const copia = doc('copia', 'Diario dei sogni', { ...sogni.campi, titolo: 'Diario dei sogni' });
  const [t] = simili(sogni, [copia]);
  assert.equal(t.doppione, true);
  const corto = doc('c', 'Diario', { problema: 'altro del tutto' });
  assert.deepEqual(simili(doc('d', 'Diario di viaggio', { problema: 'cose diverse' }), [corto]), []); // una sola parola in comune
});

test('documentoDaIdea usa solo le risposte dell\'utente e regge le idee senza scheda', () => {
  const idea = { id: 'a', titolo: 'T', stato: 'pronta', aggiornata: 'x' };
  assert.equal(documentoDaIdea(idea).campi.problema, '');
  const d = documentoDaIdea(idea, {
    scheda: { problema: 'P', funzioni: ['a', 'b'] },
    messaggi: [{ ruolo: 'app', testo: 'domanda' }, { ruolo: 'utente', testo: 'risposta' }],
  });
  assert.equal(d.campi.funzioni, 'a. b');
  assert.equal(d.campi.conversazione, 'risposta');
});
