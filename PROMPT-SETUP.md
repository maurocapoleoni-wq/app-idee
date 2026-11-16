# Prompt di setup — Terza app (raccoglitore vocale di idee)

Generato con la skill genera-ambiente il 16 novembre 2026. Le decisioni di prodotto complete sono in `PROGETTO.md`: leggilo prima di iniziare e consideralo la fonte originale.

---

## OBIETTIVO

Web app per telefono che cattura a voce idee di nuove app, le chiarisce con domande interattive (Claude Haiku), ne costruisce una scheda e la salva in un repository GitHub privato (`cassetta-idee`). A casa, una skill di Claude Code legge la cassetta e imposta i progetti nella directory di lavoro, oppure applica le migliorie a progetti già esistenti.

**Principio guida:** il mondo telefono è autonomo e funziona da solo; la versione di casa completa tutto il resto.

## INPUT

- **Voce** dal microfono del telefono, tramite Web Speech API (`SpeechRecognition`, lingua `it-IT`), con trascrizione dal vivo.
- **Testo** digitato ("…oppure scrivi qui") come alternativa equivalente alla voce.
- **Configurazione** inserita una volta dall'utente nella schermata Impostazioni e salvata solo nel browser del telefono: token GitHub fine-grained, chiave API Anthropic, chiave YouTube Data API, nome utente e repo della cassetta.
- **Lato PC:** il contenuto del clone locale di `cassetta-idee` dopo `git pull`.

## ELABORAZIONE

### Telefono (`docs/`, servito da GitHub Pages)
- **Conversazione:** ogni risposta dell'utente va a Claude Haiku (`claude-haiku-5-5`) insieme alla scheda corrente. Haiku restituisce la prossima domanda e la scheda aggiornata in JSON. Le chiamate partono dal browser con l'header `anthropic-dangerous-direct-browser-access: true`. Il modello è configurabile in Impostazioni, così si può usare un modello più potente per la generazione finale (scheda definitiva, CLAUDE.md, prompt di setup).
- **Stati di un'idea** (modulo puro e testato): `in_discussione → pronta → impostata`, più `miglioria_in_attesa`, `archiviata`, `nel_cestino`. Archivio e cestino cambiano solo `stato.json` e non spostano mai cartelle.
- **Migliorie:** su un'idea impostata, la nuova conversazione parte dalla scheda esistente. Alla conferma la scheda passa a `vN+1`, si crea `migliorie/vN+1-<slug>.md` e lo stato diventa `miglioria_in_attesa`.
- **Scrittura su GitHub:** via REST API Contents (`PUT /repos/{owner}/cassetta-idee/contents/{path}`), con un commit per ogni salvataggio significativo e messaggi leggibili.
- **Coda offline:** ogni salvataggio va prima in IndexedDB, poi viene inviato a GitHub. Se fallisce resta in coda e si riprova quando torna la rete. Indicatore sempre visibile: "salvato su GitHub" / "in attesa di rete (N)".
- **Salvataggio continuo:** la conversazione in corso è salvata localmente a ogni scambio.
- **Condividi:** destinatario amico o cliente. Haiku compone il messaggio usando **solo** `scheda.md`, l'anteprima è modificabile (anche a voce) e l'invio usa `navigator.share`.
- **Cerca e idee simili:** ricerca testuale o vocale su tutte le idee, archivio e cestino compresi. Haiku segnala le idee simili.
- **Ispirazione:** solo su richiesta. Haiku genera 2 o 3 query dalla scheda, la YouTube Data API v3 `search.list` restituisce i video (100 unità di quota a ricerca), che si vedono 4 alla volta e vengono salvati in `ispirazione.md`. Filtri: "esiste già?", "come si costruisce", "idee per l'interfaccia". GitHub e App Store sono rimandati alla versione 2.
- **Ascolta la scheda:** `speechSynthesis` in italiano (versione 2).

### PC (skill di Claude Code `imposta-idee`)
- Esegue `git pull` della cassetta.
- **Idee `pronta`:** crea `C:\Users\Mauro\Claude projects\<slug>\` con `CLAUDE.md`, `PROGETTO.md` (dalla scheda) e un prompt di setup, poi aggiorna `stato.json` a `impostata`, fa commit e push nella cassetta.
- **Idee `miglioria_in_attesa`:** legge la miglioria e il progetto esistente, **propone** le modifiche e le applica solo dopo conferma esplicita, poi aggiorna lo stato.
- Non crea mai una cartella che esiste già e non tocca mai progetti per azioni di archivio o cestino.

## OUTPUT

- **Repo privato `cassetta-idee`**, una cartella per idea:
  ```
  AAAA-MM-GG-<slug>/
    conversazione.md
    scheda.md
    CLAUDE.md
    migliorie/vN-<slug>.md
    ispirazione.md
    stato.json        { stato, versione, etichette, creata, aggiornata }
  ```
- **Messaggi di condivisione** passati al menu nativo del telefono.
- **Progetti impostati** in `C:\Users\Mauro\Claude projects\<slug>\`.

## STRUTTURA CARTELLE

Questa cartella (`terza app`) diventa il repository **pubblico** `app-idee`. GitHub Pages pubblica la cartella `docs/` (Pages accetta solo la radice o `/docs`).

```
terza app/
  CLAUDE.md
  PROGETTO.md                 fonte originale delle decisioni
  PROMPT-SETUP.md             questo file
  README.md                   come pubblicare, configurare, testare
  package.json                solo script ("test": "node --test"), nessuna dipendenza
  .gitignore
  docs/                       ← l'app, pubblicata su GitHub Pages
    index.html
    manifest.webmanifest      installabile sulla home del telefono
    sw.js                     service worker: app disponibile anche offline
    css/style.css             stile della prima app: scuro, pulsanti a "occhio"
    js/
      main.js                 avvio e navigazione tra schermate
      config.js               lettura/scrittura impostazioni (localStorage)
      idee.js                 modello idea, stati e transizioni (puro)
      cassetta.js             composizione di file e percorsi della cassetta (puro)
      coda.js                 coda offline su IndexedDB
      github.js               client API Contents
      claude.js               client Messages API e prompt di sistema
      voce.js                 riconoscimento vocale e sintesi
      youtube.js              ricerca ispirazione
      condividi.js            messaggio + navigator.share
      ui/home.js  ui/conversazione.js  ui/idea.js  ui/impostazioni.js
  test/
    idee.test.js  cassetta.test.js  coda.test.js  github.test.js  (fetch finto)
  pc/
    skill/imposta-idee/SKILL.md   sorgente della skill; il README spiega come installarla in ~/.claude/skills/
  esempi/
    cassetta/2026-11-16-esempio/  idea d'esempio con tutti i file
  wiki/
    README.md  decisioni.md  bug-noti.md  convenzioni.md
```

## STACK TECNICO

- **HTML, CSS e JavaScript puri** (moduli ES), nessun framework e nessuna build, come la prima app.
- **Test:** test runner integrato di Node 24 (`node --test`), nessuna dipendenza npm. La logica pura (`idee.js`, `cassetta.js`, `coda.js`) non tocca il DOM, così è testabile in Node.
- **API del browser:** Web Speech API, `speechSynthesis`, IndexedDB, Service Worker, Web Share API.
- **Servizi esterni:** Anthropic Messages API (Haiku), GitHub REST API (Contents), YouTube Data API v3.
- **Hosting:** GitHub Pages dal repo pubblico `app-idee`, cartella `docs/`.
- **PC:** git e Claude Code con la skill `imposta-idee`.

## CONFIGURAZIONE

Nessun file `.env`: l'app è statica e pubblica, quindi i segreti **non** possono stare nel codice. Si inseriscono nella schermata **Impostazioni** del telefono e restano in `localStorage`:

| Chiave | Contenuto |
|---|---|
| `github_token` | token fine-grained, solo repo `cassetta-idee`, permesso Contents read/write |
| `github_owner` / `github_repo` | proprietario e nome della cassetta |
| `anthropic_key` | nuova chiave API, con limite di spesa impostato sulla console |
| `modello_domande` / `modello_finale` | default `claude-haiku-5-5` per entrambi |
| `youtube_key` | la chiave della prima app |

Il README spiega passo passo come creare il token fine-grained e la chiave Anthropic.

## REGOLE NON NEGOZIABILI

0. **Il mondo telefono è autonomo; la versione di casa completa tutto.** L'app del telefono non dipende mai dal PC e non lo contatta mai.
1. **Nessun segreto nel codice o nei repository.** Token e chiavi si leggono solo dalle Impostazioni (`localStorage`). Prima di ogni commit, verificare che non ci siano stringhe tipo `sk-ant-`, `github_pat_`, `AIza`.
2. **Mai perdere una registrazione.** Ogni salvataggio passa prima dalla coda locale; un errore di rete o di GitHub lascia l'elemento in coda e lo mostra nell'indicatore. Nessun dato viene scartato in silenzio.
3. **L'app del telefono scrive solo nel repo configurato come cassetta**, mai in altri repository.
4. **Archivio e cestino cambiano solo `stato.json`.** Non spostano né cancellano cartelle e non toccano mai i progetti sul PC.
5. **Il cestino è per sempre.** Nessuna cancellazione automatica; quella definitiva è solo manuale, con conferma esplicita.
6. **La skill sul PC crea cartelle solo dentro `C:\Users\Mauro\Claude projects\`** e non sovrascrive mai una cartella esistente.
7. **Le migliorie non sovrascrivono mai i file** di un progetto: la skill propone le modifiche e le applica solo dopo conferma.
8. **La condivisione usa solo `scheda.md`**, mai conversazioni, note interne o impostazioni.
9. **Le ricerche YouTube partono solo su richiesta esplicita** e i risultati si salvano per non consumare di nuovo la quota.
10. **Nessun push verso GitHub senza conferma dell'utente** durante lo sviluppo.

Nessuna di queste regole è ancora coperta da un guardrail automatico: oggi valgono solo come istruzioni. Le regole 1, 6 e 10 sono le prime candidate per gli hook di `genera_hooks_policy`.

## SKILL DISPONIBILI

- **`imposta-idee`** (di progetto, in `pc/skill/`): impostare le idee pronte e applicare le migliorie. Va installata in `~/.claude/skills/` per poterla usare da qualsiasi cartella.
- **`genera_hooks_policy`**: per trasformare le regole non negoziabili in guardrail automatici.
- **`genera-observability`**: per il logging collegato ai guardrail, dopo gli hook.
- **`run`**: per avviare e verificare l'app nel browser durante lo sviluppo.

## DEFINIZIONE DI FATTO

Un componente è completo solo quando:
1. **funziona sul telefono reale**, dal browser, pubblicato su GitHub Pages, non solo sul PC;
2. **regge l'assenza di rete**: provato in modalità aereo, nessuna idea persa, invio automatico al ritorno della rete;
3. **la logica ha test automatici che passano** (`npm test`), almeno per stati, coda offline e composizione dei file della cassetta;
4. **nessuna regola non negoziabile è violata**;
5. **la wiki è aggiornata** se sono emerse decisioni, bug o convenzioni nuove.

## MEMORIA DI PROGETTO

- **Fonti:** `PROGETTO.md` è la fonte originale e non si modifica (le decisioni nuove vanno in `wiki/decisioni.md`), insieme alla cronologia dei commit e alle sessioni di sviluppo.
- **Pagine iniziali:**
  - `wiki/decisioni.md`: decisioni architetturali e il loro perché, a partire da quelle già in PROGETTO.md (GitHub come ponte, token fine-grained, niente framework, `docs/` per Pages);
  - `wiki/bug-noti.md`: problema, causa, soluzione (es. differenze del riconoscimento vocale tra browser);
  - `wiki/convenzioni.md`: struttura della cassetta, nomi degli slug, formato di `stato.json`, messaggi di commit;
  - `wiki/README.md`: le regole di aggiornamento qui sotto.
- **Regola di aggiornamento:** ogni voce riporta la data e, se esiste, l'hash del commit di origine. Si scrive *perché* e *cosa non è ovvio*, non si duplica ciò che si legge già nel codice.
- **Lint:** ogni 5 sessioni di sviluppo, o su richiesta. Controlla voci in contraddizione, voci superate dal codice e link rotti.

## ISTRUZIONI FINALI

1. Inizializza git in questa cartella e crea `.gitignore`.
2. Crea tutta la struttura indicata sopra. Implementa subito, con test che passano: `idee.js` (stati e transizioni), `cassetta.js` (percorsi e file di un'idea, incluse le migliorie), `coda.js` (coda con interfaccia di memoria sostituibile nei test).
3. Crea l'interfaccia di base nello stile della prima app (vedi PROGETTO.md, sezione Interfaccia): home con microfono, lista 4 per pagina con dati d'esempio e schermata Impostazioni. Le altre schermate restano come segnaposto navigabili.
4. Crea `pc/skill/imposta-idee/SKILL.md` con il flusso descritto in ELABORAZIONE e le regole 4, 6 e 7.
5. Crea l'idea d'esempio in `esempi/cassetta/`.
6. Crea `CLAUDE.md` nella radice con, per intero, le sezioni **REGOLE NON NEGOZIABILI**, **SKILL DISPONIBILI**, **DEFINIZIONE DI FATTO**, la regola di aggiornamento e la cadenza del lint della wiki, e un rimando a PROGETTO.md.
7. Crea la cartella `wiki/` con le pagine iniziali già compilate.
8. Esegui `npm test` e verifica che passi.
9. Fai il primo commit.
10. Mostra all'utente i passi manuali che restano: creare su github.com il repo pubblico `app-idee` e quello privato `cassetta-idee`, collegare il remote e fare il push (solo dopo sua conferma), attivare GitHub Pages su `docs/`, creare token e chiave e inserirli nelle Impostazioni dal telefono.

**Ordine di sviluppo dopo il setup** (un pezzo alla volta, ciascuno "fatto" secondo la definizione):
voce + conversazione con Haiku → scrittura nella cassetta + coda offline → pagina idea e migliorie → archivio e cestino → condividi → cerca e idee simili → ispirazione YouTube → skill `imposta-idee` provata su un'idea reale → funzioni della versione 2.
