// Schermata Ispirazione: video YouTube su un'idea, in tre filtri.
// Regola 9: ogni ricerca parte solo dal pulsante e i risultati restano salvati.

import {
  FILTRI, COSTO_RICERCA, QUOTA_GIORNALIERA, ispirazioneVuota, normalizzaQuery, aggiungiRisultati,
  unitaUsateOggi, registraUnita,
} from '../ispirazione.js';
import { schedaPerCondividere } from '../cassetta.js';
import { creaClaude } from '../claude.js';
import { cercaVideo } from '../youtube.js';
import { pagina } from '../idee.js';
import { esc, ICONE } from './dom.js';

function data(isoString) {
  return new Date(isoString).toLocaleDateString('it-IT', { day: 'numeric', month: 'short' });
}

function schedaVideo(v) {
  return `<li><a class="scheda-video" href="${esc(v.url)}" target="_blank" rel="noopener noreferrer">
    ${v.miniatura ? `<img src="${esc(v.miniatura)}" alt="" loading="lazy">` : '<span class="miniatura-vuota"></span>'}
    <span><span class="titolo-video">${esc(v.titolo)}</span><br><span class="canale-video">${esc(v.canale)}</span></span>
  </a></li>`;
}

export function mostra(radice, { stato, vai, parametri, salvaDialogo }) {
  let dialogo = stato.dialoghi.find((d) => d.idea?.id === parametri.id);
  if (!dialogo) {
    vai('home');
    return;
  }
  const { idea } = dialogo;
  let filtro = 'esiste_gia';
  let numeroPagina = 1;
  let occupato = false;
  let avviso = '';

  radice.innerHTML = `
    <div class="schermo-chat">
      <header class="barra">
        <button class="icona-btn" data-azione="indietro" aria-label="Indietro">${ICONE.indietro}</button>
        <h1>Ispirazione: ${esc(idea.titolo)}</h1>
      </header>
      <p class="nota" id="quota"></p>
      <nav class="schede filtri" role="tablist">
        ${Object.entries(FILTRI).map(([k, v]) => `<button role="tab" data-filtro="${k}">${esc(v)}</button>`).join('')}
      </nav>
      <div class="area-lista" id="contenuto"></div>
      <div class="comandi-basso">
        <div class="paginazione" id="pagine"></div>
      </div>
    </div>
  `;
  const $ = (sel) => radice.querySelector(sel);

  function disegna() {
    const usate = unitaUsateOggi();
    $('#quota').textContent = `Ogni ricerca usa ${COSTO_RICERCA} unità di quota YouTube. Oggi: ${usate} su ${QUOTA_GIORNALIERA.toLocaleString('it-IT')} (da questo telefono).`;
    radice.querySelectorAll('[data-filtro]').forEach((b) => {
      b.setAttribute('aria-selected', String(b.dataset.filtro === filtro));
      b.disabled = occupato;
    });

    const risultato = dialogo.ispirazione?.risultati?.[filtro];
    const avvisoHtml = avviso ? `<div class="avviso">${esc(avviso)}</div>` : '';
    if (!stato.config.youtube_key) {
      $('#contenuto').innerHTML = `${avvisoHtml}<p class="vuota">Serve la chiave YouTube Data API: la stessa della prima app.</p>
        <div class="azioni"><button class="pillola viola" id="vai-impostazioni">Apri le Impostazioni</button></div>`;
      $('#vai-impostazioni').onclick = () => vai('impostazioni');
      $('#pagine').innerHTML = '';
      return;
    }
    if (occupato) {
      $('#contenuto').innerHTML = '<p class="vuota">Cerco su YouTube…</p>';
      $('#pagine').innerHTML = '';
      return;
    }
    if (!risultato) {
      $('#contenuto').innerHTML = `${avvisoHtml}
        <p class="vuota">Nessuna ricerca per «${esc(FILTRI[filtro])}». Haiku prepara la ricerca dalla scheda.</p>
        <div class="azioni"><button class="pillola rossa" id="cerca">${ICONE.play} Cerca su YouTube (${COSTO_RICERCA} unità)</button></div>`;
      $('#cerca').onclick = cerca;
      $('#pagine').innerHTML = '';
      return;
    }
    const p = pagina(risultato.video, numeroPagina, 4);
    numeroPagina = p.numero;
    $('#contenuto').innerHTML = `${avvisoHtml}
      <p class="nota">Ricerca «${esc(risultato.query)}» del ${data(risultato.cercata)} · salvata, non consuma quota.</p>
      ${p.elementi.length ? `<ul class="lista">${p.elementi.map(schedaVideo).join('')}</ul>` : '<p class="vuota">Nessun video trovato.</p>'}
      <div class="azioni"><button class="pillola grigia" id="cerca">Rifai la ricerca (${COSTO_RICERCA} unità)</button></div>`;
    $('#cerca').onclick = cerca;
    $('#pagine').innerHTML = `
      <button class="pillola grigia" data-pagina="-1" ${p.numero === 1 ? 'disabled' : ''}>Più rilevanti</button>
      <span class="nota">${p.numero} di ${p.totalePagine}</span>
      <button class="pillola grigia" data-pagina="1" ${p.numero === p.totalePagine ? 'disabled' : ''}>Altri video</button>`;
    radice.querySelectorAll('[data-pagina]').forEach((b) => {
      b.onclick = () => {
        numeroPagina += Number(b.dataset.pagina);
        disegna();
        $('#contenuto').scrollTop = 0;
      };
    });
  }

  async function cerca() {
    if (occupato) return;
    occupato = true;
    avviso = '';
    disegna();
    try {
      let ispirazione = dialogo.ispirazione ?? ispirazioneVuota();
      if (!ispirazione.query) {
        // Le query si chiedono a Haiku una volta sola per idea, partendo dalla parte pubblica della scheda.
        const claude = creaClaude({ apiKey: stato.config.anthropic_key });
        const json = await claude.queryIspirazione({
          modello: stato.config.modello_domande,
          schedaMarkdown: schedaPerCondividere(idea, dialogo.scheda),
        });
        ispirazione = { ...ispirazione, query: normalizzaQuery(json, idea.titolo) };
      }
      const query = ispirazione.query[filtro];
      const video = await cercaVideo({ chiave: stato.config.youtube_key, query });
      registraUnita(COSTO_RICERCA);
      ispirazione = aggiungiRisultati(ispirazione, filtro, { query, video });
      dialogo = { ...dialogo, ispirazione };
      numeroPagina = 1;
      await salvaDialogo(dialogo, { azione: 'Ispirazione' }); // telefono, poi ispirazione.md nella cassetta
    } catch (e) {
      avviso = !navigator.onLine || e instanceof TypeError ? 'Niente rete: riprova quando torna il segnale.' : e.message;
    }
    occupato = false;
    disegna();
  }

  radice.querySelectorAll('[data-filtro]').forEach((b) => {
    b.onclick = () => {
      filtro = b.dataset.filtro;
      numeroPagina = 1;
      avviso = '';
      disegna();
    };
  });
  radice.querySelector('[data-azione="indietro"]').onclick = () => vai('idea', { id: idea.id });

  disegna();
}
