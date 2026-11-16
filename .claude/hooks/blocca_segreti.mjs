// Blocca la scrittura o il commit di chiavi e token (regola 1 del CLAUDE.md).
import { execSync } from 'node:child_process';

const SEGRETI = [
  [/sk-ant-[A-Za-z0-9_-]{20,}/, 'chiave Anthropic'],
  [/github_pat_[A-Za-z0-9_]{20,}/, 'token GitHub fine-grained'],
  [/ghp_[A-Za-z0-9]{30,}/, 'token GitHub classico'],
  [/AIza[0-9A-Za-z_-]{30,}/, 'chiave Google/YouTube'],
];

const trova = (testo) => SEGRETI.find(([re]) => re.test(testo))?.[1] ?? null;

let dati = '';
for await (const pezzo of process.stdin) dati += pezzo;
const { tool_name, tool_input = {}, cwd } = JSON.parse(dati || '{}');

const testi = [];
if (tool_name === 'Write') testi.push(tool_input.content ?? '');
else if (tool_name === 'Edit') testi.push(tool_input.new_string ?? '');
else if (tool_name === 'MultiEdit') for (const e of tool_input.edits ?? []) testi.push(e.new_string ?? '');
else if (tool_name === 'Bash' || tool_name === 'PowerShell') {
  const comando = tool_input.command ?? '';
  testi.push(comando);
  if (/\bgit\b[^|;&]*\bcommit\b/.test(comando)) {
    // Righe aggiunte: sia già in stage sia non ancora (per "git commit -a").
    for (const args of ['diff --cached -U0', 'diff -U0']) {
      try {
        const diff = execSync(`git ${args}`, { cwd, encoding: 'utf8', maxBuffer: 50e6 });
        testi.push(diff.split('\n').filter((r) => r.startsWith('+')).join('\n'));
      } catch {}
    }
  }
}

for (const t of testi) {
  const nome = trova(t);
  if (nome) {
    console.error(`Bloccato dalla regola 1 del CLAUDE.md: sembra esserci una ${nome}. ` +
      `Le chiavi si leggono solo dalle Impostazioni dell'app (localStorage), mai dal codice o dai commit.`);
    process.exit(2);
  }
}
process.exit(0);
