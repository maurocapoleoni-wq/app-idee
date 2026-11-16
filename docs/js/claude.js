// Client per la Messages API di Anthropic, chiamata direttamente dal browser.
// La chiave arriva SOLO dalle Impostazioni del telefono, mai dal codice.

export const MODELLO_PREDEFINITO = 'claude-haiku-5-5';
const URL_API = 'https://api.anthropic.com/v1/messages';

export const PROMPT_DOMANDE = `Sei l'assistente di un raccoglitore di idee per nuove app.
L'utente racconta un'idea a voce, spesso in modo disordinato, mentre è al lavoro o in giro.
Il tuo compito è chiarire l'idea con UNA domanda alla volta, breve e concreta, in italiano.
Chiedi prima la sezione vuota più importante, in quest'ordine: problema, utenti, funzioni, piattaforma.
Non chiedere ciò che è già nella scheda.

Come compilare la scheda:
- Dopo ogni risposta aggiorna TUTTE le sezioni che le parole dell'utente permettono di riempire,
  riformulando in modo chiaro. Esempio: idea "andare sulla Luna", risposta "un sogno"
  → problema: "Vivere il sogno di andare sulla Luna, oggi irraggiungibile nella realtà".
- Una deduzione ragionevole va bene; un dettaglio che l'utente non ha detto né suggerito no.
- "funzioni" è un elenco di azioni concrete che l'app fa (verbi), anche brevi.
- "note" serve solo per ciò che non sta nelle altre sezioni (dubbi, vincoli, idee sparse).
- Se la trascrizione vocale è confusa, usa ciò che si capisce e chiedi conferma del resto.
- "completa" è true solo quando problema, utenti, funzioni e piattaforma sono tutti compilati:
  in quel caso "domanda" è un riepilogo di una frase che chiede se segnare l'idea come pronta.

Rispondi SOLO con un oggetto JSON, senza testo prima o dopo:
{
  "domanda": "la prossima domanda, oppure un breve riepilogo se l'idea è completa",
  "completa": false,
  "titolo": "titolo breve dell'idea",
  "scheda": {
    "problema": "...",
    "utenti": "...",
    "funzioni": ["..."],
    "piattaforma": "...",
    "note": "..."
  }
}
Lascia stringhe vuote o liste vuote solo per ciò di cui non si sa ancora niente.`;

export const PROMPT_MIGLIORIA = `Sei l'assistente di un raccoglitore di idee per nuove app.
L'idea qui sotto è già diventata un progetto sul PC dell'utente. Ora l'utente vuole migliorarla.
Chiarisci la miglioria con UNA domanda alla volta, breve e concreta, in italiano:
cosa deve cambiare, perché, e cosa deve succedere in pratica. Di solito bastano 1-3 domande.
Non riproporre ciò che la scheda dice già. Se la trascrizione vocale è confusa, usa ciò che si capisce.

Rispondi SOLO con un oggetto JSON, senza testo prima o dopo:
{
  "domanda": "la prossima domanda, oppure un riepilogo di una frase che chiede se salvare la miglioria",
  "completa": false,
  "titolo": "titolo breve della miglioria, massimo 6 parole",
  "descrizione": "cosa cambia e perché, in modo concreto: la leggerà chi applica la miglioria al progetto"
}
"completa" è true quando è chiaro cosa cambiare.`;

export const PROMPT_CONDIVIDI = {
  amico: `Trasforma la scheda di un'idea in un messaggio per un amico: tono informale ed entusiasta,
breve, adatto a WhatsApp. Niente dettagli tecnici. Scrivi solo il messaggio, in italiano.`,
  cliente: `Trasforma la scheda di un'idea in un messaggio per un cliente: tono professionale e chiaro,
struttura problema → soluzione → vantaggi, adatto a un'email breve. Scrivi solo il messaggio, in italiano.`,
};

export const PROMPT_ISPIRAZIONE = `Data la scheda di un'idea di app, proponi ricerche YouTube utili.
Rispondi SOLO con JSON: {"esiste_gia": "...", "come_si_costruisce": "...", "idee_interfaccia": "..."}
Ogni valore è una query breve (3-6 parole). Usa l'inglese se trova più risultati.`;

export function estraiJson(testo) {
  const inizio = testo.indexOf('{');
  const fine = testo.lastIndexOf('}');
  if (inizio === -1 || fine < inizio) throw new Error('La risposta di Claude non contiene JSON');
  return JSON.parse(testo.slice(inizio, fine + 1));
}

function trascrizione(messaggi) {
  return messaggi
    .map((m) => `${m.ruolo === 'app' ? 'App' : 'Utente'}: ${m.testo}`)
    .join('\n');
}

export function creaClaude({ apiKey, fetch: f = globalThis.fetch?.bind(globalThis) }) {
  if (!apiKey) throw new Error('Manca la chiave API Anthropic nelle Impostazioni');

  async function chiedi({ modello = MODELLO_PREDEFINITO, system, testo, maxToken = 1024 }) {
    const r = await f(URL_API, {
      method: 'POST',
      headers: {
        'content-type': 'application/json',
        'x-api-key': apiKey,
        'anthropic-version': '2023-06-01',
        'anthropic-dangerous-direct-browser-access': 'true',
      },
      body: JSON.stringify({
        model: modello,
        max_tokens: maxToken,
        system,
        messages: [{ role: 'user', content: testo }],
      }),
    });
    if (!r.ok) {
      let dettaglio = '';
      try {
        dettaglio = (await r.json()).error?.message ?? '';
      } catch {
        /* nessun dettaglio */
      }
      throw new Error(`Claude ha risposto ${r.status}${dettaglio ? `: ${dettaglio}` : ''}`);
    }
    const dati = await r.json();
    return dati.content.filter((b) => b.type === 'text').map((b) => b.text).join('');
  }

  async function prossimaDomanda({ modello, scheda = {}, messaggi = [] }) {
    const testo = `Scheda attuale:\n${JSON.stringify(scheda, null, 2)}\n\nConversazione finora:\n${trascrizione(messaggi)}`;
    return estraiJson(await chiedi({ modello, system: PROMPT_DOMANDE, testo }));
  }

  async function prossimaDomandaMiglioria({ modello, schedaMarkdown, migliorieFatte = [], messaggi = [] }) {
    const precedenti = migliorieFatte.length
      ? `\n\nMigliorie già chieste:\n${migliorieFatte.map((m) => `- v${m.versione}: ${m.titolo}`).join('\n')}`
      : '';
    const testo = `Scheda dell'idea:\n${schedaMarkdown}${precedenti}\n\nConversazione sulla miglioria:\n${trascrizione(messaggi)}`;
    return estraiJson(await chiedi({ modello, system: PROMPT_MIGLIORIA, testo }));
  }

  // Usa SOLO la scheda: mai conversazioni o note interne (regola non negoziabile).
  async function componiMessaggio({ modello, schedaMarkdown, destinatario, richiesta = '' }) {
    const system = PROMPT_CONDIVIDI[destinatario];
    if (!system) throw new Error(`Destinatario sconosciuto: ${destinatario}`);
    const testo = `${schedaMarkdown}${richiesta ? `\n\nRichiesta di modifica: ${richiesta}` : ''}`;
    return (await chiedi({ modello, system, testo })).trim();
  }

  async function queryIspirazione({ modello, schedaMarkdown }) {
    return estraiJson(await chiedi({ modello, system: PROMPT_ISPIRAZIONE, testo: schedaMarkdown, maxToken: 300 }));
  }

  return { chiedi, prossimaDomanda, prossimaDomandaMiglioria, componiMessaggio, queryIspirazione };
}
