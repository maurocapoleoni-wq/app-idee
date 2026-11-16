// Idee d'esempio per vedere l'interfaccia prima del collegamento alla cassetta.
// Verranno sostituite dalla lettura reale di GitHub (passo 2 dell'ordine di sviluppo).

import { creaIdea, cambiaStato, aggiungiMiglioria, archivia, cestina, STATI } from './idee.js';

function giorniFa(n, ore = 12) {
  const d = new Date();
  d.setDate(d.getDate() - n);
  d.setHours(ore, 0, 0, 0);
  return d;
}

function porta(idea, stati, ora) {
  return stati.reduce((i, s) => cambiaStato(i, s, ora), idea);
}

export function ideeEsempio() {
  const fino = (titolo, giorni, stati = []) => porta(creaIdea({ titolo, ora: giorniFa(giorni) }), stati, giorniFa(giorni));
  const impostata = [STATI.PRONTA, STATI.IMPOSTATA];

  const auto = aggiungiMiglioria(fino('Promemoria scadenze auto', 3, impostata), {
    titolo: 'Notifiche 7 giorni prima',
    ora: giorniFa(0, 9),
  });

  return [
    fino('App per la spesa condivisa', 0),
    auto,
    fino('Diario allenamenti vocale', 1, [STATI.PRONTA]),
    fino('Archivio ricette di nonna', 2),
    fino('Quiz per i bambini', 4, [STATI.PRONTA]),
    fino('Mappa dei ristoranti provati', 6),
    fino('Tracker bollette', 8, impostata),
    fino('Lista libri da leggere', 11),
    fino('Gestione turni calcetto', 15, [STATI.PRONTA]),
    archivia(fino('Timer per la pizza', 20, impostata), giorniFa(5)),
    cestina(fino('Social per piante', 30), giorniFa(25)),
  ];
}
