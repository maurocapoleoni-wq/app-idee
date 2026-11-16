# Decisioni

Le decisioni iniziali vengono da `PROGETTO.md` (sessione di ideazione del 2026-11-16).

## 2026-11-16 · setup — GitHub come ponte invece di Supabase
Il proprietario usa già GitHub per le altre app. Lo storico dei commit fa da cronologia delle idee e i file Markdown sono leggibili sia da lui sia da Claude. Contro: non è un database. Per un solo utente va bene. Per la versione universale andrà rivalutato.

## 2026-11-16 · setup — Telefono e PC non si parlano mai
Il telefono scrive nella cassetta, il PC la legge con `git pull`. In questo modo non ci sono porte aperte sul PC e il telefono funziona anche quando il PC è spento.

## 2026-11-16 · setup — Token fine-grained limitato a `cassetta-idee`
Il token sta nel browser del telefono: se il telefono viene perso, il danno resta limitato a un solo repo e il token si revoca in un clic. Scartato OAuth: per un solo utente è troppo complesso.

## 2026-11-16 · setup — Chiamate ad Anthropic dirette dal browser
Header `anthropic-dangerous-direct-browser-access: true`, chiave dalle Impostazioni, limite di spesa sulla console. Va bene per uso personale. Per la versione universale servirà un proxy.

## 2026-11-16 · setup — HTML, CSS e JavaScript puri, app in `docs/`
È lo stesso approccio della prima app: nessuna build. GitHub Pages pubblica solo la radice o `/docs`, quindi l'app sta in `docs/` e la radice resta per documentazione e test.

## 2026-11-16 · setup — Test con il test runner di Node
Node 24 è già installato e `node --test` non richiede dipendenze. La logica pura (`idee.js`, `cassetta.js`, `coda.js`) non tocca il DOM per poter essere testata in Node.

## 2026-11-16 · setup — Archivio e cestino come stati, non come cartelle
Cambia solo `stato.json`, quindi lo storico dell'idea non si spezza. `statoPrecedente` permette di ripristinare l'idea esattamente com'era.

## 2026-11-16 · setup — Coda offline: si ferma al primo errore
Inviare in ordine evita che una versione vecchia di un file arrivi dopo una nuova. Lo stesso file in attesa viene aggiornato, non duplicato.

## 2026-11-16 · passo 1 — L'idea nasce dopo la prima risposta di Claude
Il dialogo ha una chiave locale da subito, ma l'idea (e quindi la cartella nella cassetta) si crea dopo il primo tentativo di chiamare Claude. Così il nome della cartella usa il titolo di Claude e non le prime parole dettate. Se Claude non risponde, si usa un titolo provvisorio: la risposta non resta mai fuori dalla cassetta. Il titolo può cambiare dopo, l'id no.

## 2026-11-16 · passo 1 — Telefono prima di tutto
Ogni risposta va prima nell'archivio locale (IndexedDB, chiave `dialoghi`), poi nella coda, poi su GitHub. Anche il testo dettato ma non inviato resta come bozza in `localStorage`. Un `TypeError` da `fetch` vale come "niente rete", anche quando `navigator.onLine` dice il contrario.

## 2026-11-16 · passo 3 — Un commit per salvataggio (Git Data API)
Con la Contents API ogni file era un commit: 8 commit per una conversazione di 4 risposte. Ora un salvataggio è un elemento di coda con tutti i file dell'idea e diventa un solo commit (ref → commit → tree con `base_tree` → commit → PATCH del ref senza force). Se il ramo è cambiato nel frattempo (push dal PC) si riparte dall'ultimo commit, fino a 3 volte: nulla viene sovrascritto alla cieca. In coda, due salvataggi della stessa idea si uniscono per file, così un file di miglioria non si perde.

## 2026-11-16 · passo 3 — Il telefono rilegge la cassetta
All'avvio, al ritorno della rete e dopo "Verifica GitHub", il telefono legge ogni `stato.json` e, solo per idee nuove o più recenti, `scheda.md` e `conversazione.md` (riletti da `leggiSchedaMd` / `leggiConversazioneMd`). Vince la data `aggiornata` più recente, tranne per le idee con salvataggi ancora in coda sul telefono: quelle non si toccano. Prima si invia la coda, poi si legge.

## 2026-11-16 · passo 3 — Migliorie: bozza sul telefono, commit al salvataggio
La conversazione sulla miglioria resta sul telefono (`bozzaMiglioria`) finché non si preme "Salva miglioria": solo allora nascono la versione nuova e il file `migliorie/vN-slug.md`, con descrizione e conversazione. Le migliorie arrivate dalla cassetta non vengono riscritte dal telefono.

## 2026-11-16 · interfaccia — Pagine ferme, 4 idee per pagina
Richiesta dell'utente dopo le prove sul telefono. La home non scorre mai e i pulsanti "Più recenti / Meno recenti" restano sempre in fondo; con le schede compatte le 4 idee di PROGETTO.md entrano (per un momento si era passati a 3, poi l'utente ha verificato che 4 ci stanno). Se non entrano, scorre solo l'area della lista. In conversazione e miglioria il microfono resta fisso in alto e i messaggi scorrono sotto, il più recente in cima: un microfono che si sposta mentre si parla confonde. Data e stato stanno sulla stessa riga della scheda; sotto 780 px d'altezza microfono più piccolo e niente sottotitolo.

## 2026-11-16 · passo 4 — Archivio e cestino senza conferma, con Annulla
Si sposta con un tocco dalla pagina dell'idea; in home compare per 6 secondi un avviso con "Annulla". Nessuna finestra di conferma perché nulla si perde: il cestino è per sempre e "Ripristina" riporta lo stato precedente. Ogni mossa è un commit che cambia solo `stato.json` (`salvataggioDelDialogo(…, { soloStato: true })`), regola 4. Dalla home ogni idea apre la sua pagina (anche quelle in discussione, con "Continua la conversazione"), così le azioni stanno in un posto solo. Le idee d'esempio non si spostano.

## 2026-11-16 · passo 5 — Condividi usa solo la parte pubblica della scheda
`schedaPerCondividere` prende titolo, problema, utenti, funzioni e piattaforma: le **Note** restano fuori perché possono contenere dubbi o appunti interni (regola 8), come conversazioni, stato e migliorie. Una modifica ("più corto") manda a Haiku scheda pubblica + messaggio attuale + richiesta. L'ultimo messaggio resta in `localStorage` per idea. Senza menu di condivisione (browser del PC) il testo va negli appunti.

## 2026-11-16 · passo 6 — Ispirazione YouTube: un filtro alla volta
Risolta la domanda aperta di PROGETTO.md: tutti e tre i tipi (esiste già? / come si costruisce / idee per l'interfaccia) come filtri, ma ognuno si cerca solo toccando il suo pulsante (100 unità ciascuno), così una visita costa 100 e non 300. Haiku prepara le tre query una volta sola per idea, dalla parte pubblica della scheda. I risultati restano nel dialogo e in `ispirazione.md`: riaprirli non consuma quota. Il contatore di quota conta per giorno del Pacifico (quando YouTube azzera) ed è solo di questo telefono: la chiave è condivisa con la prima app, quindi il consumo reale può essere più alto. Rimandato: il riassunto in italiano dei video da parte di Haiku.

## 2026-11-16 · hook — Guardrail in Node, registrati solo in locale
Gli script sono in Node perché girano allo stesso modo su Windows e Node c'è già. La registrazione sta in `settings.local.json`, quindi non finisce nel repo pubblico. L'hook della regola 6 sta invece nell'intestazione della skill `imposta-idee`: la skill gira da cartelle diverse da questo progetto e un hook di progetto non la coprirebbe. Dettagli in `.claude/HOOKS_DECISIONS.md`.
