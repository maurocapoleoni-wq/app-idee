# Convenzioni

## 2026-11-16 · setup — Cassetta
- Una cartella per idea: `AAAA-MM-GG-<slug>`, con la data di creazione in ora locale e lo slug senza accenti, al massimo 50 caratteri (`slugify` in `idee.js`).
- File: `stato.json`, `scheda.md`, `conversazione.md`, `CLAUDE.md`, `ispirazione.md`, `migliorie/vN-<slug>.md`.
- `stato.json` contiene l'oggetto idea completo. Il nome della cartella è la fonte di verità per l'id.
- Date in ISO 8601 UTC (`toISOString()`), che si ordinano alfabeticamente.
- Messaggi di commit: `<Azione>: <titolo> (v<versione>)`, ad esempio `Nuova idea: App per la spesa (v1)`.

## 2026-11-16 · setup — Codice
- Nomi di variabili e funzioni in italiano, coerenti con il dominio (`idea`, `scheda`, `cassetta`, `miglioria`).
- Moduli ES nativi, nessuna dipendenza. La logica pura sta in moduli senza DOM; le schermate in `docs/js/ui/` espongono `mostra(radice, contesto)`.
- Tutto il testo inserito nell'HTML passa da `esc()`.
- Quando si aggiunge un file in `docs/`, va aggiunto a `FILE_APP` in `sw.js` e va aumentata `VERSIONE`.
