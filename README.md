# Raccoglitore vocale di idee

Web app per telefono: racconti a voce l'idea di una nuova app, lei ti fa domande per chiarirla e la salva in un repository GitHub privato. A casa Claude Code imposta il progetto.

Dettagli in [PROGETTO.md](PROGETTO.md). Regole di sviluppo in [CLAUDE.md](CLAUDE.md).

## Provare in locale

```bash
npm test
```

```bash
npx serve docs
```

Poi apri l'indirizzo mostrato (di solito http://localhost:3000). Il microfono funziona solo su `localhost` o `https`.

## Pubblicare (una volta sola)

1. Su github.com crea il repository **pubblico** `app-idee`, vuoto.
2. Collega questa cartella e pubblica:
   ```bash
   git remote add origin https://github.com/<tuo-utente>/app-idee.git
   ```
   ```bash
   git push -u origin main
   ```
3. Nel repo: **Settings → Pages → Branch `main`, cartella `/docs`** → Save. Dopo un minuto l'app è su `https://<tuo-utente>.github.io/app-idee/`.

## La cassetta (una volta sola)

1. Su github.com crea il repository **privato** `cassetta-idee`, con un README, così non è vuoto.
2. Clonalo sul PC accanto agli altri progetti:
   ```bash
   git clone https://github.com/<tuo-utente>/cassetta-idee.git "C:/Users/Mauro/Claude projects/cassetta-idee"
   ```

## Token e chiavi (da inserire nelle Impostazioni dell'app sul telefono)

**Token GitHub fine-grained**
1. github.com → Settings → Developer settings → Personal access tokens → **Fine-grained tokens** → Generate new token.
2. *Repository access*: **Only select repositories** → `cassetta-idee`.
3. *Permissions → Repository permissions → Contents*: **Read and write**. Nient'altro.
4. Scegli una scadenza (es. 1 anno). Copia il token e incollalo nelle Impostazioni dell'app.

**Chiave API Anthropic**
1. console.anthropic.com → API Keys → Create key (es. `app-idee-telefono`).
2. In *Limits* imposta un limite di spesa mensile basso.
3. Se la vecchia chiave della prima app risulta ancora attiva e non la usi, revocala.

**Chiave YouTube**: la stessa della prima app.

Usa il pulsante **Verifica GitHub** nelle Impostazioni: controlla che la cassetta sia raggiungibile, privata e scrivibile.

## Skill per il PC di casa

Copia `pc/skill/imposta-idee/` in `C:\Users\Mauro\.claude\skills\imposta-idee\`. Poi, in Claude Code, scrivi: *"imposta le idee pronte"*.
