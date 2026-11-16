import { test } from 'node:test';
import assert from 'node:assert/strict';
import { creaGithub, aBase64, daBase64, ErroreGithub } from '../docs/js/github.js';

// GitHub finto: tiene i file in una Map e registra le chiamate.
function githubFinto({ privato = true, fallisciPut = null, ramoCambia = 0 } = {}) {
  const file = new Map(); // percorso → { content (base64), sha }
  const chiamate = [];
  let sha = 0;
  // Git Data API minimale: commit → istantanea dei file (percorso → testo).
  const alberi = new Map();
  const commit = new Map();
  const idAlbero = (istantanea) => {
    const id = `t:${JSON.stringify([...istantanea].sort())}`;
    alberi.set(id, istantanea);
    return id;
  };
  let testa = 'c0';
  commit.set('c0', { albero: idAlbero(new Map()), padre: null });
  let cambiamentiEsterni = ramoCambia;
  const risposta = (status, corpo) => ({
    ok: status >= 200 && status < 300,
    status,
    json: async () => corpo,
  });
  const fetch = async (url, opzioni) => {
    chiamate.push({ url, ...opzioni });
    const u = new URL(url);
    const git = u.pathname.match(/^\/repos\/[^/]+\/[^/]+\/git\/(.*)$/);
    if (git) {
      const corpo = opzioni.body ? JSON.parse(opzioni.body) : null;
      const [tipo, ...resto] = git[1].split('/');
      if (tipo === 'ref') return risposta(200, { object: { sha: testa } });
      if (tipo === 'commits' && opzioni.method === 'GET') return risposta(200, { tree: { sha: commit.get(resto[0]).albero } });
      if (tipo === 'trees') {
        const nuova = new Map(alberi.get(corpo.base_tree));
        for (const voce of corpo.tree) nuova.set(voce.path, voce.content);
        return risposta(201, { sha: idAlbero(nuova) });
      }
      if (tipo === 'commits') {
        const id = `c${commit.size}`;
        commit.set(id, { albero: corpo.tree, padre: corpo.parents[0], messaggio: corpo.message });
        return risposta(201, { sha: id });
      }
      if (tipo === 'refs') {
        if (cambiamentiEsterni > 0) {
          // Simula un push del PC arrivato nel frattempo: il ramo non è più fast-forward.
          cambiamentiEsterni -= 1;
          const id = `c${commit.size}`;
          const istantanea = new Map(alberi.get(commit.get(testa).albero));
          istantanea.set('dal-pc.md', 'push del PC');
          commit.set(id, { albero: idAlbero(istantanea), padre: testa, messaggio: 'dal PC' });
          testa = id;
          return risposta(422, { message: 'Update is not a fast forward' });
        }
        if (commit.get(corpo.sha).padre !== testa) return risposta(422, { message: 'Update is not a fast forward' });
        testa = corpo.sha;
        for (const [p, testo] of alberi.get(commit.get(testa).albero)) {
          sha += 1;
          file.set(p, { content: aBase64(testo), sha: `sha${sha}` });
        }
        return risposta(200, { object: { sha: testa } });
      }
      return risposta(404, { message: 'Not Found' });
    }
    const m = u.pathname.match(/^\/repos\/([^/]+)\/([^/]+)(?:\/contents\/(.*))?$/);
    if (!m) return risposta(404, { message: 'Not Found' });
    const percorso = m[3] === undefined ? null : decodeURIComponent(m[3]);
    if (percorso === null) {
      return risposta(200, { full_name: `${m[1]}/${m[2]}`, private: privato, permissions: { push: true }, default_branch: 'main' });
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
  return { fetch, file, chiamate, commit, testo: (p) => alberi.get(commit.get(testa).albero).get(p), testa: () => testa };
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

test('scriviCommit salva più file in un solo commit', async () => {
  const finto = githubFinto();
  const gh = crea(finto);
  const esito = await gh.scriviCommit([
    { percorso: '2026-11-16-x/stato.json', contenuto: '{"stato":"pronta"}' },
    { percorso: '2026-11-16-x/scheda.md', contenuto: '# Città' },
  ], 'Idea pronta: X (v1)');
  assert.equal(esito.invariato, false);
  assert.equal(finto.commit.get(finto.testa()).messaggio, 'Idea pronta: X (v1)');
  assert.equal(finto.testo('2026-11-16-x/scheda.md'), '# Città');
  assert.equal(finto.chiamate.filter((c) => c.method === 'PATCH').length, 1);
  assert.equal((await gh.leggiFile('2026-11-16-x/scheda.md')).contenuto, '# Città');
});

test('scriviCommit non crea commit vuoti', async () => {
  const finto = githubFinto();
  const gh = crea(finto);
  await gh.scriviCommit([{ percorso: 'a/b.md', contenuto: 'uguale' }], 'uno');
  assert.deepEqual(await gh.scriviCommit([{ percorso: 'a/b.md', contenuto: 'uguale' }], 'due'), { invariato: true });
  assert.equal(finto.chiamate.filter((c) => c.method === 'PATCH').length, 1);
});

test('scriviCommit riparte se il PC ha fatto push nel frattempo, senza perdere il suo lavoro', async () => {
  const finto = githubFinto({ ramoCambia: 1 });
  const gh = crea(finto);
  const esito = await gh.scriviCommit([{ percorso: 'a/b.md', contenuto: 'dal telefono' }], 'm');
  assert.equal(esito.invariato, false);
  assert.equal(finto.testo('a/b.md'), 'dal telefono');
  assert.equal(finto.testo('dal-pc.md'), 'push del PC');
});

test('scriviCommit rifiuta percorsi fuori dalla cassetta prima di chiamare GitHub', async () => {
  const finto = githubFinto();
  await assert.rejects(crea(finto).scriviCommit([{ percorso: '../altro', contenuto: 'x' }], 'm'), /Percorso non valido/);
  assert.equal(finto.chiamate.length, 0);
});

test('configurazione incompleta rifiutata', () => {
  assert.throws(() => creaGithub({ token: '', owner: 'a', repo: 'b', fetch() {} }), /incompleta/);
});
