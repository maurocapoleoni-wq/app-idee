// Impostazioni: chiavi e token restano solo in questo browser.

import { CAMPI, leggiConfig, salvaConfig, campiMancanti } from '../config.js';
import { creaGithub } from '../github.js';
import { esc, ICONE } from './dom.js';

// Traduce gli errori di GitHub in qualcosa di utile da leggere sul telefono.
export function spiegaErrore(err, config) {
  const repo = `${config.github_owner}/${config.github_repo}`;
  if (err.status === 401) return 'GitHub rifiuta il token: è sbagliato, incompleto o scaduto. Incollalo di nuovo.';
  if (err.status === 404) {
    return `GitHub non trova ${repo} con questo token. Controlla Utente GitHub e Repository, `
      + 'e che il token includa quel repository.';
  }
  if (err.status === 403) return 'Il token non ha i permessi necessari: serve Contents in lettura e scrittura.';
  if (err instanceof TypeError) return 'Nessuna risposta da GitHub: controlla la connessione.';
  return err.message;
}

export function mostra(radice, { stato, vai, inviaCoda }) {
  const config = stato.config;
  radice.innerHTML = `
    <header class="barra">
      <button class="icona-btn" data-azione="indietro" aria-label="Indietro">${ICONE.indietro}</button>
      <h1>Impostazioni</h1>
    </header>
    <p class="nota">Token e chiavi restano solo in questo browser. Non finiscono mai nel codice né su GitHub.</p>

    <form id="form-config">
      ${CAMPI.map((c) => `
        <label class="campo">
          <span>${esc(c.etichetta)}${c.obbligatorio ? ' *' : ''}</span>
          <input name="${c.chiave}" type="${c.tipo}" value="${esc(config[c.chiave])}" autocomplete="off"
            autocapitalize="off" autocorrect="off" spellcheck="false">
        </label>`).join('')}
      <div class="azioni">
        <button class="pillola viola" type="submit">Salva</button>
        <button class="pillola grigia" type="button" id="verifica">Verifica GitHub</button>
      </div>
    </form>
    <p class="esito" id="esito" role="status"></p>
    <div id="coda"></div>
  `;

  const esito = radice.querySelector('#esito');
  const mostraEsito = (testo, tipo) => {
    esito.textContent = testo;
    esito.className = `esito ${tipo}`;
  };

  radice.querySelector('[data-azione="indietro"]').onclick = () => vai('home');

  const form = radice.querySelector('#form-config');
  const salva = () => {
    salvaConfig(Object.fromEntries(new FormData(form)));
    stato.config = leggiConfig();
  };

  form.onsubmit = (e) => {
    e.preventDefault();
    salva();
    const mancanti = campiMancanti(stato.config);
    if (mancanti.length) mostraEsito(`Salvato. Mancano ancora: ${mancanti.join(', ')}.`, 'errore');
    else mostraEsito('Salvato.', 'ok');
    inviaCoda();
  };

  radice.querySelector('#verifica').onclick = async () => {
    salva(); // si verifica ciò che si vede, senza dover premere prima Salva
    mostraEsito('Verifica in corso…', '');
    try {
      const c = stato.config;
      const info = await creaGithub({ token: c.github_token, owner: c.github_owner, repo: c.github_repo }).verificaAccesso();
      if (!info.privato) {
        mostraEsito(`${info.nome} è PUBBLICO: la cassetta deve essere un repository privato.`, 'errore');
      } else if (info.puoScrivere === false) {
        mostraEsito(`${info.nome} è raggiungibile ma il token non ha il permesso di scrittura.`, 'errore');
      } else {
        mostraEsito(`Collegato a ${info.nome} (privato).`, 'ok');
        inviaCoda();
      }
    } catch (err) {
      mostraEsito(spiegaErrore(err, stato.config), 'errore');
    }
  };

  mostraCoda();

  async function mostraCoda() {
    let elementi = [];
    try {
      elementi = await stato.coda.elementi();
    } catch {
      return;
    }
    if (!elementi.length) return;
    const errore = elementi[0].ultimoErrore;
    radice.querySelector('#coda').innerHTML = `
      <div class="riquadro">
        <h2>In attesa di invio: ${elementi.length}</h2>
        ${errore ? `<p>Ultimo errore: ${esc(errore)}</p>` : ''}
        <p class="nota">Restano sul telefono finché GitHub non le riceve. Nulla viene scartato.</p>
      </div>`;
  }
}
