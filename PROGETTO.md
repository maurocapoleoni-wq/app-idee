# Terza app: raccoglitore vocale di idee

Documento delle decisioni prese il 16 novembre 2026. È il punto di partenza per generare l'ambiente del progetto con la skill **genera-ambiente**.

## Cos'è

Una web app da usare sul telefono per catturare a voce le idee di nuove app. L'app fa domande interattive per chiarire l'idea, ne costruisce una scheda e prepara l'impostazione del progetto. Quando si rientra a casa, il PC imposta il progetto nella directory di lavoro.

È un meta-progetto: un'app che aiuta a far nascere le prossime app.

- **Utente:** per ora solo il proprietario. In futuro potrà diventare universale, quindi conviene non chiudere questa porta.
- **Contesto d'uso:** al lavoro o in giro, spesso con poco tempo e connessione incerta.

## Architettura: "cattura fuori, costruisci a casa"

Le due metà non devono mai essere accese nello stesso momento.

```
Telefono (web app)  ──scrive──▶  GitHub: repo privato "cassetta-idee"  ◀──git pull──  PC di casa
voce + domande Haiku              una cartella per idea                               skill di Claude Code
```

### 1. Telefono
- Web app pubblicata con **GitHub Pages**, aperta dal browser (come prima e seconda app).
- **Voce:** riconoscimento vocale del browser (Web Speech API, italiano), gratuito.
- **Intelligenza:** Claude **Haiku** via API per le domande interattive, con la stessa gestione della chiave usata nella prima app. Per la generazione finale (scheda, CLAUDE.md, prompt di setup) si può valutare un modello più potente.
- Scrive nel repo privato tramite le API di GitHub, senza git sul telefono.

### 2. Ponte: repo GitHub privato `cassetta-idee`
Una cartella per idea:

```
2026-11-16-nome-idea/
  conversazione.md     domande e risposte
  scheda.md            l'idea strutturata (versione corrente)
  CLAUDE.md            bozza per il progetto
  migliorie/v2-*.md    una per ogni miglioria
  ispirazione.md       risultati delle ricerche salvati
  stato.json           stato, versione, etichette
```

Lo storico dei commit fa da cronologia completa dell'idea.

### 3. PC di casa
- `git pull` della cassetta.
- Una **skill di Claude Code** ("imposta le idee pronte") crea le cartelle in `C:\Users\Mauro\Claude projects\` con CLAUDE.md e prompt di setup, poi segna l'idea come impostata.
- Non serve nessun programma sempre acceso e non ci sono porte aperte sul PC.

### Repository
- `app-idee`: codice dell'app, **pubblico** (non contiene segreti), servito da GitHub Pages.
- `cassetta-idee`: **privato**, i dati.

## Chiavi e sicurezza

- **Token GitHub fine-grained**, valido solo per `cassetta-idee`, con lettura e scrittura dei contenuti. Va inserito una volta nell'app e salvato solo nel browser del telefono. È revocabile in qualsiasi momento.
- **Chiave API Anthropic:** va **rigenerata**, perché la vecchia è persa. Va inserita nell'app, mai nel codice o nel repo. Impostare un limite di spesa mensile sulla console. Verificare che la vecchia chiave sia revocata.
- **Chiave YouTube Data API:** si riusa quella della prima app.
- Per la versione universale servirà un intermediario (proxy) per le chiavi.

## Stati di un'idea

| Stato | Colore | Significato |
|---|---|---|
| In discussione | arancione | conversazione in corso |
| Pronta | verde | pronta per essere impostata sul PC |
| Impostata sul PC | blu | progetto creato |
| Miglioria in attesa | arancione (badge) | ci sono migliorie da applicare al progetto |
| Archiviata | — | realizzata, fuori dalla lista principale, riapribile |
| Nel cestino | — | scartata, ripristinabile |

Archivio e cestino si gestiscono **cambiando lo stato in `stato.json`**, senza spostare cartelle.

## Interfaccia

Stile della **prima app**: sfondo scuro, grande pulsante a forma di "occhio" colorato con icona, campo "oppure scrivi qui" con pulsante a pillola, schede con riquadro a sinistra.

### Home
- Grande pulsante **microfono** (viola), "tieni premuto per parlare".
- "…oppure scrivi qui" con pulsante Invia.
- Lente **Cerca**, a testo o a voce, su tutte le idee compresi archivio e cestino.
- Schede **Attive · Archivio · Cestino**.
- Lista delle idee **4 alla volta**, dalle più recenti, con pulsanti "Più recenti" / "Meno recenti". Ogni scheda mostra un riquadro colorato secondo lo stato, il titolo, la data e un badge.

### Conversazione
- Chat con le domande dell'app e le risposte.
- **Trascrizione dal vivo** mentre si parla.
- **Scheda in costruzione** che si riempie man mano.
- Microfono per rispondere; pulsanti "Riprendi dopo" e "Segna pronta".

### Pagina di approfondimento (tocco su un'idea)
- Scheda attuale con numero di versione e **barra di maturità** (es. "70% definita").
- **Storico** delle versioni e delle migliorie.
- Microfono **"Migliora questa idea"**.
- Pulsanti **Condividi**, **Archivia**, **Sposta nel cestino**.
- **Ascolta la scheda** (lettura vocale).
- Etichette (lavoro, casa, clienti...).
- Sezione **Ispirazione**.

### Sempre presenti
- **Indicatore di salvataggio:** "salvato su GitHub" oppure "in attesa di rete", con coda offline.
- **Salvataggio continuo:** una conversazione interrotta non si perde.

## Migliorie

Un'idea già impostata si può migliorare in qualsiasi momento:
1. Microfono nella pagina di approfondimento. Le domande partono dalla scheda esistente e chiedono solo cosa cambia.
2. Su GitHub: la scheda passa alla nuova versione, si aggiunge `migliorie/vN-*.md` e lo stato diventa "miglioria in attesa".
3. Sul PC la skill legge la miglioria e il progetto com'è oggi, **propone** le modifiche e le applica **solo dopo conferma**. Poi segna la miglioria come applicata.

## Condividi

- Si sceglie il destinatario: **amico** (tono informale) o **cliente** (tono professionale: problema, soluzione, vantaggi).
- Haiku compone il messaggio; l'anteprima è modificabile, anche a voce ("più corto", "togli la parte tecnica").
- L'invio usa il **menu di condivisione nativo del telefono** (Web Share API): WhatsApp, email, ecc.
- Il messaggio usa **solo la scheda**, mai le conversazioni o le note interne.

## Idee simili e ispirazione

1. **Tra le proprie idee**, compresi archivio e cestino: avvisa dei doppioni o delle idee da unire.
2. **Sezione Ispirazione**, solo su richiesta. Haiku crea le ricerche dalla scheda, i risultati si vedono 4 alla volta con la grafica a schede della prima app e vengono salvati in `ispirazione.md`. Haiku riassume in italiano.
   - Tipi di ricerca: *esiste già?*, *come si costruisce*, *idee per l'interfaccia* (da decidere se tutti come filtri).
   - **Fonti:** YouTube Data API (10.000 unità al giorno, 100 per ricerca), poi GitHub (progetti simili) e App Store di Apple (iTunes Search API, gratuita senza chiave). Opzionali: Product Hunt, Hacker News. Google Play escluso (nessuna API di ricerca).

## Regole non negoziabili

- Il telefono **non tocca mai** direttamente il PC.
- Archiviare, cestinare o cancellare un'idea agisce **solo sulla cassetta**, **mai** sulla cartella del progetto sul PC.
- Le migliorie sul PC **non sovrascrivono mai** i file: si propongono e si applicano dopo conferma.
- Il cestino è **per sempre**: nessuna cancellazione automatica. La cancellazione definitiva è solo manuale e con conferma.
- Nessuna chiave o token nel codice o nei repository.

## Piano delle versioni

**Versione 1**
- Home, conversazione, pagina di approfondimento.
- Voce, trascrizione dal vivo, domande con Haiku.
- Scrittura nella cassetta su GitHub, indicatore di salvataggio e coda offline, salvataggio continuo.
- Stati, archivio, cestino.
- Migliorie.
- Condividi.
- Ricerca tra le idee e idee simili interne.
- Ispirazione con YouTube.
- Skill di Claude Code sul PC per impostare progetti e applicare migliorie.

**Versione 2**
- Ascolta la scheda, barra di maturità, etichette.
- Ispirazione da GitHub e App Store.

**In futuro**
- Versione universale: login, più utenti, proxy per le chiavi API.

## Questioni aperte

- Tipi di ricerca della sezione Ispirazione: tutti e tre come filtri?
- Modello per la generazione finale: Haiku o uno più potente.
- Come la prima app gestisce oggi chiave API e chiamata a Haiku, da replicare.

## Prossimo passo

Lanciare **genera-ambiente** partendo da questo documento per ottenere il prompt di setup e il CLAUDE.md del progetto.
