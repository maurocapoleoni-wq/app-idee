import { test } from 'node:test';
import assert from 'node:assert/strict';
import { creaGithub, aBase64, daBase64, ErroreGithub } from '../docs/js/github.js';

// GitHub finto: tiene i file in una Map e registra le chiamate.
function githubFinto({ privato = true, fallisciPut = null } = {}) {
  const file = new Map();
  const chiamate = [];
  let sha = 0;
  const risposta = (status, corpo) => ({
    ok: status >= 200 && status < 300,
    status,
    json: async () => corpo,
  });
  const fetch = async (url, opzioni) => {
    chiamate.push({ url, ...opzioni });
    const u = new URL(url);
    const m = u.pathname.match(/^\/repos\/([^/]+)\/([^/]+)(?:\/contents\/(.*))?$/);
    if (!m) return risposta(404, { message: 'Not Found' });
    const percorso = m[3] === undefined ? null : decodeURIComponent(m[3]);
    if (percorso === null) {
      return risposta(200, { full_name: `${m[1]}/${m[2]}`, private: privato, permissions: { push: true } });
    }
    if (opzioni.method === 'GET') {
      if (percorso === '') {
        const cartelle = new Set([...file.keys()].map((p) => p.split('/')[0]));
        return risposta(200, [...cartelle].map((name) => ({ name, type: 'dir' })));
      }
      const f = file.get(percorso);
      return f ? risposta(200, { type: 'file', content: f.content, sha: f.sha }) : risposta(404, { message: 'Not Found' });
    }
    if (opzioni.method === 'PUT') {
      if (fallisciPut) return risposta(fallisciPut, { message: 'Bad credentials' });
      const corpo = JSON.parse(opzioni.body);
      const esistente = file.get(percorso);
      if (esistente && corpo.sha !== esistente.sha) return risposta(409, { message: 'sha mismatch' });
      sha += 1;
      file.set(percorso, { content: corpo.content, sha: `sha${sha}`, message: corpo.message });
      return risposta(esistente ? 200 : 201, {});
    }
    return risposta(405, {});
  };
  return { fetch, file, chiamate };
}

const crea = (finto) => creaGithub({ token: 't', owner: 'mauro', repo: 'cassetta-idee', fetch: finto.fetch });

test('base64 conserva accenti ed emoji', () => {
  const testo = 'Città più bella 🚀 — perché sì';
  assert.equal(daBase64(aBase64(testo)), testo);
  assert.equal(daBase64(aBase64('x'.repeat(100000))).length, 100000);
});

test('scrive un file nuovo e lo rilegge', async () => {
  const finto = githubFinto();
  const gh = crea(finto);
  assert.deepEqual(await gh.scriviFile('2026-11-16-x/scheda.md', '# Città', 'Nuova idea'), { invariato: false });
  assert.deepEqual(await gh.leggiFile('2026-11-16-x/scheda.md'), { contenuto: '# Città', sha: 'sha1' });
  const put = finto.chiamate.find((c) => c.method === 'PUT');
  assert.equal(JSON.parse(put.body).sha, undefined);
  assert.equal(put.headers.Authorization, 'Bearer t');
});

test('aggiorna un file esistente passando lo sha', async () => {
  const finto = githubFinto();
  const gh = crea(finto);
  await gh.scriviFile('a/b.md', 'v1', 'uno');
  await gh.scriviFile('a/b.md', 'v2', 'due');
  const puts = finto.chiamate.filter((c) => c.method === 'PUT');
  assert.equal(JSON.parse(puts[1].body).sha, 'sha1');
  assert.equal((await gh.leggiFile('a/b.md')).contenuto, 'v2');
});

test('non crea un commit se il contenuto è identico', async () => {
  const finto = githubFinto();
  const gh = crea(finto);
  await gh.scriviFile('a/b.md', 'uguale', 'uno');
  assert.deepEqual(await gh.scriviFile('a/b.md', 'uguale', 'due'), { invariato: true });
  assert.equal(finto.chiamate.filter((c) => c.method === 'PUT').length, 1);
});

test('un file mancante si legge come null', async () => {
  assert.equal(await crea(githubFinto()).leggiFile('a/nulla.md'), null);
});

test('rifiuta percorsi che escono dalla cassetta', async () => {
  const gh = crea(githubFinto());
  for (const p of ['../altro-repo', 'a/../../b', '/assoluto', 'a//b', '']) {
    await assert.rejects(gh.scriviFile(p, 'x', 'm'), /Percorso non valido/, p);
  }
});

test('scrive solo nel repository configurato', async () => {
  const finto = githubFinto();
  await crea(finto).scriviFile('a/b.md', 'x', 'm');
  for (const c of finto.chiamate) {
    assert.ok(c.url.startsWith('https://api.github.com/repos/mauro/cassetta-idee'), c.url);
  }
});

test('un errore di GitHub diventa ErroreGithub con lo stato', async () => {
  const gh = crea(githubFinto({ fallisciPut: 401 }));
  await assert.rejects(gh.scriviFile('a/b.md', 'x', 'm'), (e) => {
    assert.ok(e instanceof ErroreGithub);
    assert.equal(e.status, 401);
    assert.match(e.message, /401.*Bad credentials/);
    return true;
  });
});

test('elenca le cartelle delle idee e verifica il repository', async () => {
  const finto = githubFinto({ privato: false });
  const gh = crea(finto);
  await gh.scriviFile('2026-11-16-a/stato.json', '{}', 'm');
  await gh.scriviFile('2026-11-17-b/stato.json', '{}', 'm');
  assert.deepEqual(await gh.elencaCartelle(), ['2026-11-16-a', '2026-11-17-b']);
  assert.deepEqual(await gh.verificaAccesso(), { nome: 'mauro/cassetta-idee', privato: false, puoScrivere: true });
});

test('configurazione incompleta rifiutata', () => {
  assert.throws(() => creaGithub({ token: '', owner: 'a', repo: 'b', fetch() {} }), /incompleta/);
});
