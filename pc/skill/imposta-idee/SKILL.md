---
name: imposta-idee
description: Legge la cassetta delle idee (repo GitHub privato cassetta-idee) e, sul PC di casa, imposta i progetti delle idee pronte oppure applica le migliorie in attesa ai progetti esistenti. Usala quando l'utente dice "imposta le idee pronte", "applica le migliorie", "cosa c'è nella cassetta" o simili.
hooks:
  PreToolUse:
    - matcher: "Write|Edit|MultiEdit"
      hooks:
        - type: command
          command: node "$HOME/.claude/skills/imposta-idee/verifica_cartelle.mjs"
---

# Imposta idee

Porti sul PC di casa ciò che il telefono ha preparato nella cassetta.
**Il telefono raccoglie, tu completi.**

## Configurazione

- **Clone della cassetta:** `C:\Users\Mauro\Claude projects\cassetta-idee`
- **Dove creare i progetti:** `C:\Users\Mauro\Claude projects\`

Se il clone non esiste, chiedi all'utente l'URL del repo e se vuoi clonarlo lì. Non clonarlo senza conferma.

## Regole non negoziabili

1. Crei cartelle **solo** dentro `C:\Users\Mauro\Claude projects\`.
2. **Non sovrascrivi mai** una cartella esistente. Se il nome è già usato, proponi un nome alternativo e aspetti la conferma.
3. Per le migliorie **proponi** le modifiche al progetto esistente e le applichi **solo dopo conferma esplicita**, file per file se l'utente lo chiede.
4. Archivio e cestino riguardano solo la cassetta: **non tocchi mai** la cartella di un progetto per un'idea archiviata o nel cestino.
5. Il push sulla cassetta avviene solo dopo aver mostrato all'utente cosa cambia.

## Procedura

### 1. Aggiorna la cassetta
```bash
git -C "C:/Users/Mauro/Claude projects/cassetta-idee" pull --ff-only
```
Se il pull non è fast-forward, fermati e mostra la situazione all'utente.

### 2. Fai l'inventario
Leggi ogni `*/stato.json` e raggruppa per `stato`:
- `pronta` → da impostare
- `miglioria_in_attesa` → migliorie da applicare

Mostra all'utente un elenco breve (titolo, versione, cosa c'è da fare) e chiedi su quali procedere.

### 3. Imposta un'idea pronta
1. Leggi `scheda.md`, `conversazione.md`, `CLAUDE.md` (bozza) ed eventuale `ispirazione.md`.
2. Proponi il nome della cartella: lo slug dell'idea senza data (es. `spesa-condivisa`). Verifica che non esista.
3. Crea la cartella con:
   - `PROGETTO.md`: la scheda, più le decisioni emerse dalla conversazione;
   - `CLAUDE.md`: partendo dalla bozza, con regole non negoziabili e definizione di fatto;
   - `PROMPT-SETUP.md`: prompt pronto per la skill genera-ambiente.
4. Nella cassetta aggiorna `stato.json`: `stato` diventa `impostata` e `aggiornata` diventa l'ora attuale. Poi fai commit `Impostata sul PC: <titolo> (v<versione>)`.

### 4. Applica una miglioria
1. Trova il progetto dell'idea: cerca in `C:\Users\Mauro\Claude projects\` la cartella il cui `PROGETTO.md` cita l'id dell'idea. In caso di dubbio chiedi.
2. Leggi le migliorie con `applicata: null` (`migliorie/vN-*.md`) e lo stato attuale del progetto.
3. **Proponi** le modifiche concrete (CLAUDE.md, PROGETTO.md, codice) e mostra cosa cambierebbe.
4. Applica solo dopo il sì dell'utente.
5. Nella cassetta: in `stato.json` segna `applicata` con l'ora attuale per ogni miglioria applicata, `stato` diventa `impostata`. Poi fai commit `Miglioria applicata: <titolo> (v<versione>)`.

### 5. Chiudi
Mostra il riepilogo dei commit nella cassetta e chiedi conferma prima del `git push`.
