#!/usr/bin/env node
/**
 * Harness E2E do Investfy: roda o app Electron REAL (build de produção) contra o
 * mock da API e percorre as telas, com asserções e screenshots.
 *
 *   npm run harness                     todos os flows, na ordem padrão
 *   npm run harness -- busca carteira   só os flows citados
 *   npm run harness -- --list           lista os flows
 *   npm run harness -- --latency real   latências próximas da API real (mais lento)
 *   npm run harness -- --no-build       pula o `vite build`
 *
 * Saída: harness/output/<flow>/  (screenshots NN-*.png, result.json, electron.log)
 */
const { spawn, execSync } = require('node:child_process');
const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');

const ROOT = path.join(__dirname, '..');
const FLOWS_DIR = path.join(__dirname, 'flows');
const OUTPUT = path.join(__dirname, 'output');
const ORDER = ['auth', 'session', 'carteira', 'lancamentos', 'monitoramento', 'busca'];
const FLOW_TIMEOUT_MS = 180_000;

function parseArgs(argv) {
  const opts = { flows: [], build: true, latency: 'fast', list: false, help: false };
  for (let i = 0; i < argv.length; i++) {
    const a = argv[i];
    if (a === '--no-build') opts.build = false;
    else if (a === '--list') opts.list = true;
    else if (a === '--help' || a === '-h') opts.help = true;
    else if (a === '--latency') opts.latency = argv[++i];
    else if (a.startsWith('--latency=')) opts.latency = a.split('=')[1];
    else opts.flows.push(a);
  }
  return opts;
}

function loadFlow(name) {
  const file = path.join(FLOWS_DIR, `${name}.js`);
  if (!fs.existsSync(file)) throw new Error(`flow desconhecido: ${name} (veja --list)`);
  return require(file);
}

function availableFlows() {
  const all = fs
    .readdirSync(FLOWS_DIR)
    .filter((f) => f.endsWith('.js') && !f.startsWith('_'))
    .map((f) => f.replace(/\.js$/, ''));
  return [...ORDER.filter((f) => all.includes(f)), ...all.filter((f) => !ORDER.includes(f)).sort()];
}

function runFlow(name, { userData, latency }) {
  const out = path.join(OUTPUT, name);
  fs.rmSync(out, { recursive: true, force: true });
  fs.mkdirSync(out, { recursive: true });
  const logStream = fs.createWriteStream(path.join(out, 'electron.log'));
  const electron = require(path.join(ROOT, 'node_modules', 'electron'));

  return new Promise((resolve) => {
    const child = spawn(electron, [path.join(__dirname, 'runner.js')], {
      cwd: ROOT,
      env: {
        ...process.env,
        HARNESS_FLOW: name,
        HARNESS_OUT: out,
        HARNESS_USER_DATA: userData,
        HARNESS_LATENCY: latency,
        VITE_DEV_SERVER_URL: '', // sempre o build de produção (dist/)
      },
      stdio: ['ignore', 'pipe', 'pipe'],
    });
    const timer = setTimeout(() => child.kill('SIGKILL'), FLOW_TIMEOUT_MS);

    let buffer = '';
    child.stdout.on('data', (chunk) => {
      logStream.write(chunk);
      buffer += chunk;
      const lines = buffer.split('\n');
      buffer = lines.pop();
      for (const line of lines) if (line.startsWith('[flow] ')) console.log(`  ${line.slice(7)}`);
    });
    child.stderr.on('data', (chunk) => logStream.write(chunk));

    child.on('exit', (code, signal) => {
      clearTimeout(timer);
      logStream.end();
      const resultFile = path.join(out, 'result.json');
      const result = fs.existsSync(resultFile)
        ? JSON.parse(fs.readFileSync(resultFile, 'utf8'))
        : { flow: name, ok: false, error: `Electron saiu sem resultado (code=${code} signal=${signal}). Veja ${path.relative(ROOT, out)}/electron.log`, steps: [] };
      resolve({ ...result, out });
    });
  });
}

const freshUserData = () => fs.mkdtempSync(path.join(os.tmpdir(), 'investfy-harness-'));

async function main() {
  const opts = parseArgs(process.argv.slice(2));
  const all = availableFlows();

  if (opts.help) {
    console.log(fs.readFileSync(__filename, 'utf8').match(/\/\*\*([\s\S]*?)\*\//)[1].replace(/^ \* ?/gm, ''));
    return;
  }
  if (opts.list) {
    for (const f of all) console.log(`${f.padEnd(15)} ${loadFlow(f).description}`);
    return;
  }
  if (process.platform === 'linux' && !process.env.DISPLAY && !process.env.WAYLAND_DISPLAY) {
    console.error('Sem display gráfico. Em servidor/CI rode: xvfb-run -a npm run harness');
    process.exit(2);
  }

  const flows = opts.flows.length ? opts.flows : all;
  flows.forEach(loadFlow); // valida nomes antes de começar

  if (opts.build) {
    console.log('› vite build');
    execSync('npx vite build', { cwd: ROOT, stdio: 'ignore' });
  }

  const tempDirs = [];
  let userData = freshUserData();
  tempDirs.push(userData);
  let loggedIn = false;
  const results = [];

  for (const name of flows) {
    const { setup } = loadFlow(name);
    if (setup === 'fresh') {
      userData = freshUserData();
      tempDirs.push(userData);
      loggedIn = false;
    }
    if (setup === 'saved-session' && !loggedIn) {
      console.log(`› preparando sessão salva para ${name}`);
      const prep = await runFlow('_login', { userData, latency: opts.latency });
      if (!prep.ok) {
        results.push({ flow: name, ok: false, error: `pré-login falhou: ${prep.error}`, steps: [] });
        continue;
      }
    }
    console.log(`› ${name}`);
    const r = await runFlow(name, { userData, latency: opts.latency });
    loggedIn = Boolean(r.loggedInAtEnd);
    results.push(r);
    if (!r.ok && r.error) console.log(`  ${r.error.split('\n')[0]}`);
  }

  for (const dir of tempDirs) fs.rmSync(dir, { recursive: true, force: true });
  fs.rmSync(path.join(OUTPUT, '_login'), { recursive: true, force: true });

  const failed = results.filter((r) => !r.ok);
  console.log('');
  for (const r of results) {
    const steps = r.steps?.length ? `${r.steps.filter((s) => s.ok).length}/${r.steps.length} passos` : '';
    console.log(`${r.ok ? '✓' : '✗'} ${r.flow.padEnd(15)} ${steps.padEnd(12)} ${((r.ms ?? 0) / 1000).toFixed(1)}s`);
  }
  console.log(`\nScreenshots e logs: ${path.relative(process.cwd(), OUTPUT) || '.'}/<flow>/`);
  process.exit(failed.length ? 1 : 0);
}

main().catch((e) => {
  console.error(e.message);
  process.exit(2);
});
