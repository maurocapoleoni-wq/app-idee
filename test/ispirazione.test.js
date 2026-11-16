import { test } from 'node:test';
import assert from 'node:assert/strict';
import {
  FILTRI, ispirazioneVuota, normalizzaQuery, aggiungiRisultati, ispirazioneMd, giornoQuota, unitaUsateOggi, registraUnita,
} from '../docs/js/ispirazione.js';
import { cercaVideo } from '../docs/js/youtube.js';
import { creaIdea } from '../docs/js/idee.js';
import { salvataggioDelDialogo, nuovoDialogo } from '../docs/js/dialogo.js';

const ORA = new Date(2026, 10, 16, 10, 30);
const idea = creaIdea({ titolo: 'Diario dei sogni', ora: ORA });
const video = [{ id: 'a1', titolo: 'Dream journal [app] review', canale: 'Canale X', miniatura: '', url: 'https://www.youtube.com/watch?v=a1' }];

function storageFinto() {
  const m = new Map();
  return { getItem: (k) => (m.has(k) ? m.get(k) : null), setItem: (k, v) => m.set(k, String(v)) };
}

test('le query mancanti diventano il titolo dell\'idea', () => {
  const q = normalizzaQuery({ esiste_gia: ' dream journal app ', come_si_costruisce: '' }, 'Diario dei sogni');
  assert.deepEqual(q, { esiste_gia: 'dream journal app', come_si_costruisce: 'Diario dei sogni', idee_interfaccia: 'Diario dei sogni' });
  assert.deepEqual(Object.keys(q), Object.keys(FILTRI));
});

test('i risultati si salvano per filtro e finiscono in ispirazione.md', () => {
  assert.match(ispirazioneMd(idea, ispirazioneVuota()), /Nessuna ricerca ancora eseguita/);
  const isp = aggiungiRisultati(ispirazioneVuota(), 'esiste_gia', { query: 'dream journal app', video, ora: ORA });
  assert.equal(isp.risultati.esiste_gia.video.length, 1);
  const md = ispirazioneMd(idea, isp);
  assert.match(md, /^# Ispirazione — Diario dei sogni/);
  assert.match(md, /## Esiste già\?\n\n_Ricerca YouTube: «dream journal app» · 2026-11-16_/);
  assert.match(md, /- \[Dream journal app review\]\(https:\/\/www\.youtube\.com\/watch\?v=a1\) — Canale X/);
  assert.doesNotMatch(md, /Come si costruisce/); // i filtri non cercati non compaiono
  assert.throws(() => aggiungiRisultati(isp, 'altro', { query: 'x', video: [] }), /sconosciuto/);
});

test("l'ispirazione entra nel salvataggio dell'idea solo se ci sono risultati", () => {
  const d = { ...nuovoDialogo('k'), idea, ispirazione: ispirazioneVuota() };
  assert.equal(salvataggioDelDialogo(d).files.some((f) => f.percorso.endsWith('ispirazione.md')), false);
  const conRisultati = { ...d, ispirazione: aggiungiRisultati(d.ispirazione, 'idee_interfaccia', { query: 'q', video, ora: ORA }) };
  const s = salvataggioDelDialogo(conRisultati, { azione: 'Ispirazione' });
  assert.ok(s.files.some((f) => f.percorso === `${idea.id}/ispirazione.md`));
  assert.equal(s.messaggio, 'Ispirazione: Diario dei sogni (v1)');
});

test('la quota si conta per giorno del Pacifico', () => {
  const s = storageFinto();
  // 16 novembre ore 07:00 UTC = 15 novembre in California.
  const mattinaUtc = new Date(Date.UTC(2026, 10, 16, 7));
  assert.equal(giornoQuota(mattinaUtc), '2026-11-15');
  assert.equal(unitaUsateOggi(s, mattinaUtc), 0);
  assert.equal(registraUnita(100, s, mattinaUtc), 100);
  assert.equal(registraUnita(100, s, mattinaUtc), 200);
  assert.equal(unitaUsateOggi(s, new Date(Date.UTC(2026, 10, 16, 9))), 0); // a mezzanotte del Pacifico si riparte
});

test('cercaVideo spiega gli errori di YouTube', async () => {
  const risponde = (status, corpo) => async () => ({ ok: false, status, json: async () => corpo });
  await assert.rejects(
    cercaVideo({ chiave: 'k', query: 'q', fetch: risponde(403, { error: { errors: [{ reason: 'quotaExceeded' }] } }) }),
    /quota YouTube di oggi è finita/,
  );
  await assert.rejects(cercaVideo({ chiave: 'k', query: 'q', fetch: risponde(500, {}) }), /YouTube ha risposto 500/);
  await assert.rejects(cercaVideo({ chiave: '', query: 'q' }), /Manca la chiave YouTube/);
});
