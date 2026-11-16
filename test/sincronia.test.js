import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { schedaMd, conversazioneMd, leggiSchedaMd, leggiConversazioneMd } from '../docs/js/cassetta.js';
import { creaIdea, STATI } from '../docs/js/idee.js';
import { serveDettaglio, unisciDaCassetta } from '../docs/js/sincronia.js';

const ORA = new Date(2026, 10, 16, 10, 30);
const idea = creaIdea({ titolo: 'Spesa', ora: ORA });

test('scheda.md si rilegge uguale a come è stata scritta', () => {
  const scheda = { problema: 'Dimentico cosa comprare', utenti: 'La famiglia', funzioni: ['lista condivisa', 'notifiche'], piattaforma: '', note: 'Città: più righe\nseconda riga' };
  assert.deepEqual(leggiSchedaMd(schedaMd(idea, scheda)), scheda);
  assert.deepEqual(leggiSchedaMd(''), { problema: '', utenti: '', funzioni: [], piattaforma: '', note: '' });
});

test('conversazione.md si rilegge con ruoli, testo e ora al minuto', () => {
  const messaggi = [
    { ruolo: 'utente', testo: 'una app per la spesa', ora: new Date(2026, 10, 16, 10, 30).toISOString() },
    { ruolo: 'app', testo: 'Chi la userebbe?\nPiù righe.', ora: new Date(2026, 10, 16, 10, 31).toISOString() },
  ];
  assert.deepEqual(leggiConversazioneMd(conversazioneMd(idea, messaggi)), messaggi);
  assert.deepEqual(leggiConversazioneMd('# vuota\n'), []);
});

test("legge anche i file d'esempio della cassetta, anche con a capo Windows", () => {
  const base = new URL('../esempi/cassetta/2026-11-13-promemoria-scadenze-auto/', import.meta.url);
  const scheda = leggiSchedaMd(readFileSync(new URL('scheda.md', base), 'utf8').replace(/\n/g, '\r\n'));
  assert.ok(scheda.problema.length > 0);
  assert.ok(scheda.funzioni.length > 0);
  assert.ok(leggiConversazioneMd(readFileSync(new URL('conversazione.md', base), 'utf8')).length > 0);
});

const locale = (extra = {}) => ({
  chiave: 'k1', idea, scheda: { problema: 'locale', utenti: '', funzioni: [], piattaforma: '', note: '' },
  messaggi: [{ ruolo: 'utente', testo: 'ciao', ora: ORA.toISOString() }], migliorie: { 2: { descrizione: 'mia' } },
  ...extra,
});
const impostataDopo = { ...idea, stato: STATI.IMPOSTATA, aggiornata: new Date(2026, 10, 16, 11).toISOString() };

test("un'idea sconosciuta al telefono entra nell'archivio", () => {
  assert.equal(serveDettaglio([], idea), true);
  const nuovo = unisciDaCassetta([], { idea, scheda: { problema: 'p' }, messaggi: [] });
  assert.equal(nuovo.chiave, `cassetta:${idea.id}`);
  assert.equal(nuovo.idea, idea);
  assert.equal(unisciDaCassetta([], { idea }).scheda.problema, '');
});

test("lo stato cambiato dal PC aggiorna l'idea locale e conserva i dati del telefono", () => {
  const dialoghi = [locale()];
  assert.equal(serveDettaglio(dialoghi, idea), false);
  assert.equal(serveDettaglio(dialoghi, impostataDopo), true);
  const agg = unisciDaCassetta(dialoghi, { idea: impostataDopo, scheda: { problema: 'remoto' }, messaggi: [] });
  assert.equal(agg.idea.stato, STATI.IMPOSTATA);
  assert.equal(agg.chiave, 'k1');
  assert.equal(agg.scheda.problema, 'remoto');
  assert.equal(agg.messaggi.length, 1); // la conversazione remota più corta non sostituisce quella locale
  assert.equal(agg.migliorie[2].descrizione, 'mia');
});

test('niente cambia se la cassetta non è più recente o se il telefono ha salvataggi in coda', () => {
  assert.equal(unisciDaCassetta([locale()], { idea }), null);
  assert.equal(unisciDaCassetta([locale()], { idea: impostataDopo }, { inCoda: new Set([idea.id]) }), null);
});
