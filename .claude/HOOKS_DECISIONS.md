# Decisioni sugli hook

Guardrail automatici per le regole non negoziabili del [CLAUDE.md](../CLAUDE.md). Generati con la skill `genera_hooks_policy` il 2026-11-16.

**Scope:** solo per Mauro. Gli hook 1, 2 e 4 sono registrati in `.claude/settings.local.json`, che è escluso da git. Gli script in `.claude/hooks/` sono versionati, ma senza quella registrazione non fanno nulla. L'hook 3 vive nella skill `imposta-idee` e quindi è versionato con lei.

Tutti gli script sono in Node (stesso comportamento su Windows) e girano con i permessi dell'utente, senza sandbox. Se uno script va in errore, Claude Code non blocca l'azione: gli hook non sono un muro in caso di guasto.

Per vedere cosa è attivo: `/hooks` in Claude Code da terminale. Gli hook si caricano all'avvio della sessione: dopo una modifica serve una sessione nuova.

---

## 1. Blocca segreti (regola 1)

- **Installato:** 2026-11-16
- **Evento:** `PreToolUse` · **matcher:** `Write|Edit|MultiEdit|Bash|PowerShell`
- **Script:** `.claude/hooks/blocca_segreti.mjs`
- **Cosa fa:** blocca (exit 2) se il testo da scrivere, il comando o le righe aggiunte di un `git commit` contengono una chiave Anthropic, un token GitHub (fine-grained o classico) o una chiave Google/YouTube. Riconosce il prefisso seguito da almeno 20-30 caratteri, quindi citare il solo prefisso nella documentazione è permesso.
- **Perché:** la regola 1 vieta segreti nel codice e nei repository; il repo `app-idee` è pubblico.
- **Limiti:** riconosce solo questi quattro formati. Non controlla i commit fatti a mano dall'utente.
- **Disattivare:** in `.claude/settings.local.json` togliere il primo blocco di `PreToolUse` (quello con `blocca_segreti.mjs`).

## 2. Conferma push (regola 10)

- **Installato:** 2026-11-16
- **Evento:** `PreToolUse` · **matcher:** `Bash|PowerShell`
- **Script:** `.claude/hooks/conferma_push.mjs`
- **Cosa fa:** su ogni comando con `git push` chiede il permesso all'utente (`permissionDecision: "ask"`), anche se le altre azioni sono approvate in automatico. Blocca sempre il push forzato (`--force`, `--force-with-lease`, `-f`, `+branch`).
- **Perché:** la regola 10 vieta push senza conferma; il push forzato può cancellare la storia remota.
- **Limiti:** falso allarme innocuo se la parola "push" compare dopo `git` nello stesso comando (es. `git commit -m "prepara il push"`): chiede un clic in più. Non vede un push nascosto dentro uno script.
- **Disattivare:** in `.claude/settings.local.json` togliere il secondo blocco di `PreToolUse` (quello con `conferma_push.mjs`).

## 3. Cartelle della skill imposta-idee (regola 6)

- **Installato:** 2026-11-16
- **Evento:** `PreToolUse` · **matcher:** `Write|Edit|MultiEdit` · definito nell'intestazione di `pc/skill/imposta-idee/SKILL.md`, attivo solo mentre la skill lavora.
- **Script:** `pc/skill/imposta-idee/verifica_cartelle.mjs`, richiamato da `$HOME/.claude/skills/imposta-idee/`.
- **Cosa fa:** blocca le scritture fuori da `C:\Users\Mauro\Claude projects\` (e sulla cartella stessa); chiede conferma se un `Write` sostituirebbe per intero un file esistente.
- **Perché:** la skill gira da cartelle diverse da questo progetto, quindi un hook di progetto non la proteggerebbe. Nell'intestazione della skill vale ovunque, ma solo per lei.
- **Limiti:** si attiva solo dopo aver copiato la skill in `~/.claude/skills/imposta-idee/`. Non controlla cartelle create da comandi (`mkdir`, `git clone`): per quelli vale l'istruzione scritta nella skill.
- **Disattivare:** togliere il blocco `hooks:` dall'intestazione di `SKILL.md` (anche nella copia installata).

## 4. Test dopo ogni modifica (definizione di fatto, punto 3)

- **Installato:** 2026-11-16
- **Evento:** `PostToolUse` · **matcher:** `Write|Edit|MultiEdit`
- **Script:** `.claude/hooks/test_dopo_modifica.mjs`
- **Cosa fa:** se il file modificato è un `.js`/`.mjs` in `docs/js/` o `test/`, lancia `npm test`. Se fallisce (o supera 60 secondi) passa a Claude le ultime righe dell'output con exit 2, così la correzione avviene subito. La modifica resta fatta.
- **Perché:** nessuna modifica alla logica deve restare con test rotti.
- **Limiti:** circa 1,3 secondi in più per ogni modifica oggi; cresce con i test.
- **Disattivare:** in `.claude/settings.local.json` togliere la sezione `PostToolUse`.

---

## Verifica

- 2026-11-16: prove a vuoto di tutti e quattro gli script con input finti, tutte come previsto (5/5, 6/6, 8/8, 3/3). Comando dell'hook 1 provato anche in bash con `$CLAUDE_PROJECT_DIR`: blocca correttamente.
- **Da fare:** prova dal vivo in una sessione nuova (gli hook si caricano all'avvio). Ad esempio chiedere a Claude di eseguire un `echo` con una chiave finta e controllare che venga bloccato.
