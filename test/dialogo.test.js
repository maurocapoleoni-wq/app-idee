import { test } from 'node:test';
import assert from 'node:assert/strict';
import {
  nuovoDialogo, aggiungiMessaggio, attendeDomanda, normalizzaRisposta, unisciScheda,
  titoloProvvisorio, idUnico, assicuraIdea, applicaRisposta, salvataggiDelDialogo, schedaVuota,
} from '../docs/js/dialogo.js';
import { cambiaStato, STATI } from '../docs/js/idee.js';
import { creaArchivio } from '../docs/js/archivio.js';
import { memoriaInRam } from '../docs/js/coda.js';

const ORA = new Date(2026, 10, 16, 10, 30);
const DOPO = new Date(2026, 10, 16, 10, 35);

const risposta = (extra = {}) => normalizzaRisposta({
  domanda: 'Chi la userebbe?',
  completa: false,
  titolo: 'Promemoria spesa',
  scheda: { problema: 'Dimentico cosa comprare', utenti: '', funzioni: ['lista condivisa'], piattaforma: '', note: '' },
  ...extra,
});

test('un dialogo nuovo non ha ancora idea né messaggi', () => {
  const d = nuovoDialogo('k1');
  assert.equal(d.idea, null);
  assert.deepEqual(d.messaggi, []);
  assert.deepEqual(d.scheda, schedaVuota());
  assert.throws(() => nuovoDialogo(''));
});

test('i messaggi vuoti o con ruolo sconosciuto sono rifiutati', () => {
  const d = nuovoDialogo('k1');
  assert.throws(() => aggiungiMessaggio(d, 'utente', '   '));
  assert.throws(() => aggiungiMessaggio(d, 'sistema', 'ciao'));
});

test("dopo un messaggio dell'utente il dialogo attende la domanda", () => {
  let d = aggiungiMessaggio(nuovoDialogo('k1'), 'utente', '  Una app per la spesa ', ORA);
  assert.equal(d.messaggi[0].testo, 'Una app per la spesa');
  assert.equal(d.messaggi[0].ora, ORA.toISOString());
  assert.equal(attendeDomanda(d), true);
  d = aggiungiMessaggio(d, 'app', 'Per chi?', ORA);
  assert.equal(attendeDomanda(d), false);
});

test('normalizzaRisposta rende robusti tipi sbagliati', () => {
  const r = normalizzaRisposta({
    domanda: ' Per chi? ',
    completa: 'sì',
    titolo: 'x'.repeat(100),
    scheda: { problema: ['a', 'b'], utenti: 42, funzioni: 'una sola', piattaforma: null },
  });
  assert.equal(r.domanda, 'Per chi?');
  assert.equal(r.completa, false);
  assert.equal(r.titolo.length, 80);
  assert.equal(r.scheda.problema, 'a, b');
  assert.equal(r.scheda.utenti, '');
  assert.deepEqual(r.scheda.funzioni, ['una sola']);
  assert.equal(r.scheda.note, '');
  assert.throws(() => normalizzaRisposta({ domanda: '' }));
  assert.throws(() => normalizzaRisposta(null));
});

test('unisciScheda non cancella ciò che era già noto', () => {
  const vecchia = { ...schedaVuota(), problema: 'noto', funzioni: ['a'] };
  const r = unisciScheda(vecchia, { ...schedaVuota(), utenti: 'famiglie' });
  assert.equal(r.problema, 'noto');
  assert.equal(r.utenti, 'famiglie');
  assert.deepEqual(r.funzioni, ['a']);
  assert.deepEqual(unisciScheda(vecchia, { ...schedaVuota(), funzioni: ['b', 'c'] }).funzioni, ['b', 'c']);
});

test('titoloProvvisorio prende le prime parole', () => {
  assert.equal(titoloProvvisorio('vorrei una app che mi ricordi le scadenze della macchina.'), 'Vorrei una app che mi ricordi');
  assert.equal(titoloProvvisorio('   '), 'Nuova idea');
  assert.equal(titoloProvvisorio('ciao!'), 'Ciao');
});

test('idUnico evita due cartelle uguali', () => {
  assert.equal(idUnico('2026-11-16-spesa', []), '2026-11-16-spesa');
  assert.equal(idUnico('2026-11-16-spesa', ['2026-11-16-spesa']), '2026-11-16-spesa-2');
  assert.equal(idUnico('2026-11-16-spesa', ['2026-11-16-spesa', '2026-11-16-spesa-2']), '2026-11-16-spesa-3');
});

test("assicuraIdea crea l'idea una volta sola, col titolo di Claude o provvisorio", () => {
  const base = aggiungiMessaggio(nuovoDialogo('k1'), 'utente', 'una app per la spesa', ORA);
  const conClaude = assicuraIdea(base, { titolo: 'Lista spesa', ora: ORA, idEsistenti: ['2026-11-16-lista-spesa'] });
  assert.equal(conClaude.idea.titolo, 'Lista spesa');
  assert.equal(conClaude.idea.id, '2026-11-16-lista-spesa-2');
  assert.equal(conClaude.idea.stato, STATI.IN_DISCUSSIONE);
  assert.equal(assicuraIdea(conClaude, { titolo: 'Altro' }), conClaude);

  const senza = assicuraIdea(base, { titolo: '', ora: ORA });
  assert.equal(senza.idea.titolo, 'Una app per la spesa');
});

test('applicaRisposta aggiunge la domanda, aggiorna scheda e titolo ma non l\'id', () => {
  let d = aggiungiMessaggio(nuovoDialogo('k1'), 'utente', 'una app per la spesa', ORA);
  d = assicuraIdea(d, { titolo: 'Spesa', ora: ORA });
  const id = d.idea.id;
  d = applicaRisposta(d, risposta(), DOPO);
  assert.equal(d.messaggi.at(-1).ruolo, 'app');
  assert.equal(d.messaggi.at(-1).testo, 'Chi la userebbe?');
  assert.equal(d.idea.titolo, 'Promemoria spesa');
  assert.equal(d.idea.id, id);
  assert.equal(d.idea.aggiornata, DOPO.toISOString());
  assert.equal(d.scheda.problema, 'Dimentico cosa comprare');
  assert.equal(d.completa, false);
  assert.equal(applicaRisposta(d, risposta({ completa: true, titolo: '' }), DOPO).idea.titolo, 'Promemoria spesa');
});

test('salvataggiDelDialogo: niente file senza idea, poi stato, scheda e conversazione', () => {
  const vuoto = aggiungiMessaggio(nuovoDialogo('k1'), 'utente', 'ciao', ORA);
  assert.deepEqual(salvataggiDelDialogo(vuoto), []);

  let d = applicaRisposta(assicuraIdea(vuoto, { titolo: 'Spesa', ora: ORA }), risposta(), DOPO);
  const file = salvataggiDelDialogo(d);
  assert.deepEqual(file.map((f) => f.percorso), [
    '2026-11-16-spesa/stato.json', '2026-11-16-spesa/scheda.md', '2026-11-16-spesa/conversazione.md',
  ]);
  assert.match(file[0].messaggio, /^Idea in discussione: Promemoria spesa \(v1\)$/);
  assert.match(file[1].contenuto, /Dimentico cosa comprare/);
  assert.match(file[2].contenuto, /### Tu · 2026-11-16 10:30\n\nciao/);

  d = { ...d, idea: cambiaStato(d.idea, STATI.PRONTA, DOPO) };
  assert.equal(JSON.parse(salvataggiDelDialogo(d)[0].contenuto).stato, 'pronta');
  assert.match(salvataggiDelDialogo(d)[0].messaggio, /^Idea pronta:/);
});

test("l'archivio locale salva, sostituisce e ritrova i dialoghi", async () => {
  const archivio = creaArchivio(memoriaInRam());
  const d = aggiungiMessaggio(nuovoDialogo('k1'), 'utente', 'prima', ORA);
  await archivio.salva(d);
  await archivio.salva(nuovoDialogo('k2'));
  await archivio.salva(aggiungiMessaggio(d, 'utente', 'seconda', DOPO));
  const tutti = await archivio.tutti();
  assert.equal(tutti.length, 2);
  assert.equal((await archivio.trova('k1')).messaggi.length, 2);
  assert.equal(await archivio.trova('nessuno'), null);
  await assert.rejects(() => archivio.salva({}));
});
