// Ricerca video per la sezione Ispirazione (YouTube Data API v3).
// Ogni chiamata costa 100 unità di quota: si usa SOLO su richiesta esplicita.

const URL_RICERCA = 'https://www.googleapis.com/youtube/v3/search';

function decodificaEntita(testo) {
  return String(testo ?? '')
    .replace(/&#(\d+);/g, (_, n) => String.fromCodePoint(Number(n)))
    .replace(/&quot;/g, '"')
    .replace(/&apos;/g, "'")
    .replace(/&lt;/g, '<')
    .replace(/&gt;/g, '>')
    .replace(/&amp;/g, '&');
}

export async function cercaVideo({ chiave, query, massimo = 8, fetch: f = globalThis.fetch?.bind(globalThis) }) {
  if (!chiave) throw new Error('Manca la chiave YouTube nelle Impostazioni');
  const url = new URL(URL_RICERCA);
  url.search = new URLSearchParams({
    part: 'snippet',
    type: 'video',
    maxResults: String(massimo),
    q: query,
    key: chiave,
  }).toString();
  const r = await f(url.toString());
  if (!r.ok) {
    let motivo = '';
    try {
      motivo = (await r.json()).error?.errors?.[0]?.reason ?? '';
    } catch {
      /* nessun dettaglio */
    }
    const spiegazioni = {
      quotaExceeded: 'la quota YouTube di oggi è finita: riprova domani',
      keyInvalid: 'la chiave YouTube non è valida: controllala nelle Impostazioni',
      ipRefererBlocked: 'la chiave YouTube non accetta richieste da questo sito: controlla le restrizioni della chiave',
      forbidden: 'la chiave YouTube non ha accesso alla YouTube Data API',
    };
    const e = new Error(spiegazioni[motivo] ?? `YouTube ha risposto ${r.status}${motivo ? ` (${motivo})` : ''}`);
    e.motivo = motivo;
    throw e;
  }
  const dati = await r.json();
  return (dati.items ?? []).map((v) => ({
    id: v.id.videoId,
    titolo: decodificaEntita(v.snippet.title),
    canale: decodificaEntita(v.snippet.channelTitle),
    miniatura: v.snippet.thumbnails?.medium?.url ?? v.snippet.thumbnails?.default?.url ?? '',
    url: `https://www.youtube.com/watch?v=${encodeURIComponent(v.id.videoId)}`,
  }));
}
