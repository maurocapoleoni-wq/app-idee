// Definizione di fatto, punto 3: dopo ogni modifica alla logica o ai test, npm test deve passare.
import { spawnSync } from 'node:child_process';
import path from 'node:path';

let dati = '';
for await (const pezzo of process.stdin) dati += pezzo;
const { tool_input = {}, cwd } = JSON.parse(dati || '{}');
if (!tool_input.file_path) process.exit(0);

const progetto = process.env.CLAUDE_PROJECT_DIR ?? cwd;
const file = path.resolve(cwd ?? '.', tool_input.file_path);
const relativo = path.relative(progetto, file).replaceAll('\\', '/');
if (!/^(docs\/js|test)\/.*\.m?js$/.test(relativo)) process.exit(0);

const r = spawnSync('npm', ['test'], { cwd: progetto, encoding: 'utf8', shell: true, timeout: 60000 });
if (r.status !== 0) {
  console.error(`npm test fallisce dopo la modifica a ${relativo}. Correggi prima di andare avanti:\n` +
    `${(r.stdout + r.stderr).slice(-3000)}`);
  process.exit(2);
}
process.exit(0);
