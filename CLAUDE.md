# Raccoglitore vocale di idee (app-idee)

Web app per telefono che cattura a voce idee di nuove app, le chiarisce con Claude Haiku e le salva nel repo GitHub privato `cassetta-idee`. A casa la skill `imposta-idee` imposta i progetti.

- Decisioni di prodotto: `PROGETTO.md` (fonte originale, non si modifica).
- Prompt di setup e ordine di sviluppo: `PROMPT-SETUP.md`.
- Memoria viva del progetto: `wiki/`.

**Principio guida:** il mondo telefono è autonomo; la versione di casa completa tutto.

## Comandi

- Test: `npm test` (test runner di Node, nessuna dipendenza)
- Prova in locale: servire `docs/` con un server statico qualsiasi, ad esempio `npx serve docs` oppure `python -m http.server -d docs`.

## Struttura

- `docs/`: l'app, pubblicata su GitHub Pages. HTML, CSS e JavaScript puri, moduli ES, nessuna build.
- `docs/js/idee.js`, `cassetta.js`, `coda.js`: logica pura, senza DOM, testata in `test/`.
- `docs/js/github.js`, `claude.js`, `youtube.js`, `voce.js`, `condividi.js`: integrazioni.
- `docs/js/ui/`: schermate.
- `pc/skill/imposta-idee/`: skill per il PC di casa.
- `esempi/cassetta/`: idea d'esempio nel formato della cassetta (verificata dai test).
- Quando si aggiunge un file in `docs/`, va aggiunto anche a `FILE_APP` in `docs/sw.js` e va aumentata `VERSIONE`.

## REGOLE NON NEGOZIABILI

0. **Il mondo telefono è autonomo; la versione di casa completa tutto.** L'app del telefono non dipende mai dal PC e non lo contatta mai.
1. **Nessun segreto nel codice o nei repository.** Token e chiavi si leggono solo dalle Impostazioni (`localStorage`). Prima di ogni commit, verificare che non ci siano stringhe tipo `sk-ant-`, `github_pat_`, `ghp_`, `AIza`.
2. **Mai perdere una registrazione.** Ogni salvataggio passa prima dalla coda locale (`coda.js`). Un errore di rete o di GitHub lascia l'elemento in coda e lo mostra nell'indicatore. Nessun dato viene scartato in silenzio.
3. **L'app del telefono scrive solo nel repo configurato come cassetta**, mai in altri repository.
4. **Archivio e cestino cambiano solo `stato.json`.** Non spostano né cancellano cartelle e non toccano mai i progetti sul PC.
5. **Il cestino è per sempre.** Nessuna cancellazione automatica; quella definitiva è solo manuale, con conferma esplicita.
6. **La skill sul PC crea cartelle solo dentro `C:\Users\Mauro\Claude projects\`** e non sovrascrive mai una cartella esistente.
7. **Le migliorie non sovrascrivono mai i file** di un progetto: la skill propone le modifiche e le applica solo dopo conferma.
8. **La condivisione usa solo `scheda.md`**, mai conversazioni, note interne o impostazioni.
9. **Le ricerche YouTube partono solo su richiesta esplicita** e i risultati si salvano per non consumare di nuovo la quota.
10. **Nessun push verso GitHub senza conferma dell'utente** durante lo sviluppo.

Oggi nessuna regola è coperta da un guardrail automatico. Le prime candidate per gli hook (`genera_hooks_policy`) sono la 1, la 6 e la 10.

## SKILL DISPONIBILI

- **`imposta-idee`** (in `pc/skill/`): impostare le idee pronte e applicare le migliorie. Per usarla da qualsiasi cartella, copiarla in `~/.claude/skills/imposta-idee/`.
- **`genera_hooks_policy`**: trasformare le regole non negoziabili in guardrail automatici.
- **`genera-observability`**: logging collegato ai guardrail (dopo gli hook).
- **`run`**: avviare e verificare l'app nel browser durante lo sviluppo.

## DEFINIZIONE DI FATTO

Un componente è completo solo quando:
1. **funziona sul telefono reale**, dal browser, pubblicato su GitHub Pages, non solo sul PC;
2. **regge l'assenza di rete**: provato in modalità aereo, nessuna idea persa, invio automatico al ritorno della rete;
3. **la logica ha test automatici che passano** (`npm test`), almeno per stati, coda offline e composizione dei file della cassetta;
4. **nessuna regola non negoziabile è violata**;
5. **la wiki è aggiornata** se sono emerse decisioni, bug o convenzioni nuove.

## MEMORIA DI PROGETTO (wiki/)

- Pagine: `decisioni.md`, `bug-noti.md`, `convenzioni.md`. Le regole sono in `wiki/README.md`.
- **Regola di aggiornamento:** a fine sessione, se è emerso qualcosa di non ovvio (una decisione e il suo perché, un bug e la sua causa, una convenzione), aggiungi una voce. Ogni voce riporta la data e, se esiste, l'hash del commit di origine. Non duplicare ciò che si legge già nel codice.
- **Lint:** ogni 5 sessioni di sviluppo, o su richiesta. Cerca voci in contraddizione, voci superate dal codice e link rotti. Annota la data dell'ultimo lint in `wiki/README.md`.
