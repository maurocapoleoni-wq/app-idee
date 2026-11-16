import { test } from 'node:test';
import assert from 'node:assert/strict';
import { creaIdea, cambiaStato, aggiungiMiglioria, STATI } from '../docs/js/idee.js';
import {
  percorsiIdea, percorsoMiglioria, statoJson, leggiStatoJson, schedaMd,
  conversazioneMd, migliorieMd, messaggioCommit, fileDiSalvataggio,
} from '../docs/js/cassetta.js';

const ORA = new Date(2026, 10, 16, 12, 40);
const idea = () => creaIdea({ titolo: 'App per la spesa', ora: ORA });

test('i percorsi stanno tutti nella cartella dell’idea', () => {
  const p = percorsiIdea('2026-11-16-app-per-la-spesa');
  assert.equal(p.stato, '2026-11-16-app-per-la-spesa/stato.json');
  assert.equal(p.claudeMd, '2026-11-16-app-per-la-spesa/CLAUDE.md');
});

test('id non validi vengono rifiutati (niente uscite dalla cartella)', () => {
  for (const id of ['../segreti', '2026-11-16-a/../../x', 'spesa', '', '2026-11-16-', null]) {
    assert.throws(() => percorsiIdea(id), /non valido/, String(id));
  }
});

test('percorsoMiglioria usa versione e slug', () => {
  assert.equal(
    percorsoMiglioria('2026-11-16-auto', { versione: 2, slug: 'tagliando' }),
    '2026-11-16-auto/migliorie/v2-tagliando.md',
  );
  assert.throws(() => percorsoMiglioria('2026-11-16-auto', { versione: 1, slug: 'x' }), /Versione/);
});

test('stato.json va e torna senza perdere nulla', () => {
  let i = cambiaStato(cambiaStato(idea(), STATI.PRONTA, ORA), STATI.IMPOSTATA, ORA);
  i = aggiungiMiglioria(i, { titolo: 'Tagliando', ora: ORA });
  const testo = statoJson(i);
  assert.ok(testo.endsWith('\n'));
  assert.deepEqual(leggiStatoJson(testo, i.id), i);
});

test('leggiStatoJson rifiuta dati non validi', () => {
  const id = '2026-11-16-x';
  assert.throws(() => leggiStatoJson('{rotto', id), /JSON/);
  assert.throws(() => leggiStatoJson('{"stato":"boh","versione":1,"titolo":"x"}', id), /Stato sconosciuto/);
  assert.throws(() => leggiStatoJson('{"stato":"pronta","versione":0,"titolo":"x"}', id), /Versione/);
  assert.throws(() => leggiStatoJson('{"stato":"pronta","versione":1,"titolo":" "}', id), /Titolo/);
});

test("leggiStatoJson usa la cartella come id e completa i campi mancanti", () => {
  const i = leggiStatoJson('{"id":"altro","stato":"pronta","versione":1,"titolo":"X"}', '2026-11-16-x');
  assert.equal(i.id, '2026-11-16-x');
  assert.deepEqual(i.migliorie, []);
  assert.deepEqual(i.etichette, []);
});

test('schedaMd segna come da definire le parti mancanti', () => {
  const md = schedaMd(idea(), { problema: 'Lista sempre persa', funzioni: ['lista', 'spunta'] });
  assert.match(md, /^# App per la spesa/);
  assert.match(md, /## Problema\n\nLista sempre persa/);
  assert.match(md, /- lista\n- spunta/);
  assert.match(md, /## Utenti\n\n_da definire_/);
  assert.match(md, /Versione 1/);
});

test('conversazioneMd alterna App e Tu', () => {
  const md = conversazioneMd(idea(), [
    { ruolo: 'app', testo: 'Chi la userebbe?', ora: ORA.toISOString() },
    { ruolo: 'utente', testo: 'La famiglia', ora: ORA.toISOString() },
  ]);
  assert.match(md, /### App · 2026-11-16 12:40\n\nChi la userebbe\?/);
  assert.match(md, /### Tu · 2026-11-16 12:40\n\nLa famiglia/);
  assert.throws(() => conversazioneMd(idea(), [{ ruolo: 'boh', testo: 'x', ora: ORA }]), /Ruolo/);
});

test('migliorieMd e messaggioCommit', () => {
  const m = { versione: 2, slug: 'tagliando', titolo: 'Tagliando', creata: ORA.toISOString() };
  assert.match(migliorieMd(idea(), m, 'Aggiungere la scadenza'), /# Miglioria v2 — Tagliando/);
  assert.equal(messaggioCommit(idea(), 'Nuova idea'), 'Nuova idea: App per la spesa (v1)');
});

test("l'idea d'esempio in esempi/cassetta rispetta il formato", async () => {
  const { readFile, readdir } = await import('node:fs/promises');
  const base = new URL('../esempi/cassetta/', import.meta.url);
  for (const id of await readdir(base)) {
    const i = leggiStatoJson(await readFile(new URL(`${id}/stato.json`, base), 'utf8'), id);
    assert.equal(i.id, id);
    for (const m of i.migliorie) {
      await readFile(new URL(percorsoMiglioria(id, m), base)); // il file della miglioria esiste
    }
  }
});

test('fileDiSalvataggio include solo ciò che serve', () => {
  const i = idea();
  assert.deepEqual(fileDiSalvataggio(i).map((f) => f.percorso), [`${i.id}/stato.json`]);
  const tutti = fileDiSalvataggio(i, { scheda: {}, messaggi: [] }).map((f) => f.percorso);
  assert.deepEqual(tutti, [`${i.id}/stato.json`, `${i.id}/scheda.md`, `${i.id}/conversazione.md`]);
});
