// Regola 6 del CLAUDE.md: la skill scrive solo dentro C:\Users\Mauro\Claude projects\
// e non sostituisce file esistenti senza conferma.
import { existsSync } from 'node:fs';
import path from 'node:path';

const RADICE = path.resolve('C:/Users/Mauro/Claude projects');

let dati = '';
for await (const pezzo of process.stdin) dati += pezzo;
const { tool_name, tool_input = {}, cwd } = JSON.parse(dati || '{}');
const file = tool_input.file_path;
if (!file) process.exit(0);

const assoluto = path.resolve(cwd ?? '.', file);
const relativo = path.relative(RADICE, assoluto);
if (!relativo || relativo.startsWith('..') || path.isAbsolute(relativo)) {
  console.error(`Bloccato dalla regola 6: imposta-idee scrive solo dentro ${RADICE}\\, non in ${assoluto}.`);
  process.exit(2);
}

if (tool_name === 'Write' && existsSync(assoluto)) {
  console.log(JSON.stringify({
    hookSpecificOutput: {
      hookEventName: 'PreToolUse',
      permissionDecision: 'ask',
      permissionDecisionReason: `Regola 6: ${assoluto} esiste già e verrebbe sostituito per intero.`,
    },
  }));
}
process.exit(0);
