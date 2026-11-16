// Regola 10 del CLAUDE.md: nessun push verso GitHub senza conferma dell'utente.
let dati = '';
for await (const pezzo of process.stdin) dati += pezzo;
const { tool_input = {} } = JSON.parse(dati || '{}');
const comando = tool_input.command ?? '';

if (!/\bgit\b[^|;&]*\bpush\b/.test(comando)) process.exit(0);

if (/\s(--force(-with-lease)?|-f)\b|\s\+\S+/.test(comando)) {
  console.error('Bloccato dalla regola 10: il push forzato può cancellare la storia su GitHub. ' +
    "Se serve davvero, lo esegue l'utente a mano.");
  process.exit(2);
}

console.log(JSON.stringify({
  hookSpecificOutput: {
    hookEventName: 'PreToolUse',
    permissionDecision: 'ask',
    permissionDecisionReason: 'Regola 10 del CLAUDE.md: ogni push verso GitHub richiede la tua conferma.',
  },
}));
process.exit(0);
