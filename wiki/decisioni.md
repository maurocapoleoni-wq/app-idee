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

## 2026-11-16 · hook — Guardrail in Node, registrati solo in locale
Gli script sono in Node perché girano allo stesso modo su Windows e Node c'è già. La registrazione sta in `settings.local.json`, quindi non finisce nel repo pubblico. L'hook della regola 6 sta invece nell'intestazione della skill `imposta-idee`: la skill gira da cartelle diverse da questo progetto e un hook di progetto non la coprirebbe. Dettagli in `.claude/HOOKS_DECISIONS.md`.
