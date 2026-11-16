// Client minimo per la REST API Contents di GitHub.
// Scrive SOLO nel repository indicato alla creazione (regola: niente altri repo).

const API = 'https://api.github.com';

export class ErroreGithub extends Error {
  constructor(messaggio, status) {
    super(messaggio);
    this.name = 'ErroreGithub';
    this.status = status;
  }
}

// Base64 compatibile con UTF-8 (accenti, emoji).
export function aBase64(testo) {
  const bytes = new TextEncoder().encode(testo);
  let binario = '';
  for (let i = 0; i < bytes.length; i += 0x8000) {
    binario += String.fromCharCode(...bytes.subarray(i, i + 0x8000));
  }
  return btoa(binario);
}

export function daBase64(b64) {
  const binario = atob(String(b64).replace(/\s/g, ''));
  return new TextDecoder().decode(Uint8Array.from(binario, (c) => c.charCodeAt(0)));
}

function codificaPercorso(percorso) {
  const parti = typeof percorso === 'string' ? percorso.split('/') : [];
  if (!parti.length || parti.some((p) => p === '' || p === '.' || p === '..')) {
    throw new Error(`Percorso non valido: ${percorso}`);
  }
  return parti.map(encodeURIComponent).join('/');
}

export function creaGithub({ token, owner, repo, fetch: f = globalThis.fetch?.bind(globalThis) }) {
  if (!token || !owner || !repo) throw new Error('Configurazione GitHub incompleta');
  const base = `${API}/repos/${encodeURIComponent(owner)}/${encodeURIComponent(repo)}`;

  function chiama(metodo, url, corpo) {
    return f(url, {
      method: metodo,
      headers: {
        Authorization: `Bearer ${token}`,
        Accept: 'application/vnd.github+json',
        'X-GitHub-Api-Version': '2022-11-28',
        ...(corpo ? { 'Content-Type': 'application/json' } : {}),
      },
      body: corpo ? JSON.stringify(corpo) : undefined,
      cache: 'no-store',
    });
  }

  async function errore(risposta, cosa) {
    let dettaglio = '';
    try {
      dettaglio = (await risposta.json()).message ?? '';
    } catch {
      /* risposta senza JSON */
    }
    return new ErroreGithub(
      `GitHub ha risposto ${risposta.status} durante ${cosa}${dettaglio ? `: ${dettaglio}` : ''}`,
      risposta.status,
    );
  }

  async function leggiFile(percorso) {
    const r = await chiama('GET', `${base}/contents/${codificaPercorso(percorso)}`);
    if (r.status === 404) return null;
    if (!r.ok) throw await errore(r, `la lettura di ${percorso}`);
    const j = await r.json();
    if (Array.isArray(j) || j.type !== 'file') {
      throw new ErroreGithub(`${percorso} non è un file`, 400);
    }
    return { contenuto: daBase64(j.content ?? ''), sha: j.sha };
  }

  async function scriviFile(percorso, contenuto, messaggio) {
    const url = `${base}/contents/${codificaPercorso(percorso)}`;
    // Un secondo tentativo copre il caso in cui il file cambi tra lettura e scrittura.
    for (let tentativo = 1; tentativo <= 2; tentativo += 1) {
      const esistente = await leggiFile(percorso);
      if (esistente && esistente.contenuto === contenuto) return { invariato: true };
      const r = await chiama('PUT', url, {
        message: messaggio || `Aggiorna ${percorso}`,
        content: aBase64(contenuto),
        ...(esistente ? { sha: esistente.sha } : {}),
      });
      if (r.ok) return { invariato: false };
      if ((r.status === 409 || r.status === 422) && tentativo === 1) continue;
      throw await errore(r, `il salvataggio di ${percorso}`);
    }
    throw new ErroreGithub(`Salvataggio di ${percorso} non riuscito`, 409);
  }

  async function elencaCartelle() {
    const r = await chiama('GET', `${base}/contents/`);
    if (r.status === 404) return [];
    if (!r.ok) throw await errore(r, "l'elenco delle idee");
    const voci = await r.json();
    return voci.filter((v) => v.type === 'dir').map((v) => v.name);
  }

  async function verificaAccesso() {
    const r = await chiama('GET', base);
    if (!r.ok) throw await errore(r, 'la verifica del repository');
    const j = await r.json();
    return {
      nome: j.full_name,
      privato: j.private === true,
      puoScrivere: j.permissions ? j.permissions.push === true : null,
    };
  }

  return { leggiFile, scriviFile, elencaCartelle, verificaAccesso };
}
