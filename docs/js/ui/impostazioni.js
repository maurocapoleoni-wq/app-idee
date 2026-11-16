// Impostazioni: chiavi e token restano solo in questo browser.

import { CAMPI, leggiConfig, salvaConfig, campiMancanti } from '../config.js';
import { creaGithub } from '../github.js';
import { esc, ICONE } from './dom.js';

export function mostra(radice, { stato, vai }) {
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
          <input name="${c.chiave}" type="${c.tipo}" value="${esc(config[c.chiave])}" autocomplete="off" spellcheck="false">
        </label>`).join('')}
      <div class="azioni">
        <button class="pillola viola" type="submit">Salva</button>
        <button class="pillola grigia" type="button" id="verifica">Verifica GitHub</button>
      </div>
    </form>
    <p class="esito" id="esito" role="status"></p>
  `;

  const esito = radice.querySelector('#esito');
  const mostraEsito = (testo, tipo) => {
    esito.textContent = testo;
    esito.className = `esito ${tipo}`;
  };

  radice.querySelector('[data-azione="indietro"]').onclick = () => vai('home');

  radice.querySelector('#form-config').onsubmit = (e) => {
    e.preventDefault();
    salvaConfig(Object.fromEntries(new FormData(e.target)));
    stato.config = leggiConfig();
    const mancanti = campiMancanti(stato.config);
    if (mancanti.length) mostraEsito(`Salvato. Mancano ancora: ${mancanti.join(', ')}.`, 'errore');
    else mostraEsito('Salvato.', 'ok');
  };

  radice.querySelector('#verifica').onclick = async () => {
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
      }
    } catch (err) {
      mostraEsito(err.message, 'errore');
    }
  };
}
