# Wiki del progetto

Memoria viva del progetto, mantenuta da Claude Code sessione dopo sessione.

## Livelli

1. **Fonti** (non si modificano): `PROGETTO.md`, la cronologia dei commit, le sessioni di sviluppo.
2. **Pagine wiki** (si aggiornano):
   - [decisioni.md](decisioni.md): decisioni architetturali e il loro perché
   - [bug-noti.md](bug-noti.md): problema, causa, soluzione
   - [convenzioni.md](convenzioni.md): formati, nomi, stile
3. **Regole** (questa pagina).

## Regole di aggiornamento

- Ogni voce inizia con la data e, se esiste, l'hash breve del commit: `2026-11-16 · abc1234`.
- Si scrive il **perché** e ciò che **non è ovvio**. Ciò che si legge già nel codice non va duplicato.
- Una voce superata non si cancella: si segna come ~~superata~~, con un rimando alla nuova.

## Lint

Ogni 5 sessioni di sviluppo, o su richiesta: cercare contraddizioni, voci superate dal codice e link rotti.

- Ultimo lint: _mai_ (wiki creata il 2026-11-16)
