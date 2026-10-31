/**
 * Entry do Electron para UM flow. Chamado pelo harness/cli.js; não rode direto.
 *
 * Ordem importa:
 *  1. userData isolado (antes do session-store calcular o caminho)
 *  2. patch do fetch (antes do api-client fazer `require('undici')`)
 *  3. require síncrono do main real (o switch `lang` precisa vir antes do app ficar pronto)
 */
const { app } = require('electron');
const fs = require('node:fs');
const path = require('node:path');
const { createMockServer } = require('./mock/server');
const { redirectApiTo } = require('./lib/redirect');
const { Driver, sleep } = require('./lib/driver');

const FLOW = process.env.HARNESS_FLOW;
const OUT = process.env.HARNESS_OUT;
const USER_DATA = process.env.HARNESS_USER_DATA;

app.setPath('userData', USER_DATA);
let mockUrl = null;
redirectApiTo(() => mockUrl);
const mockReady = createMockServer().then((m) => {
  mockUrl = m.url;
  return m;
});
require('../electron/main.js');

const flow = require(path.join(__dirname, 'flows', `${FLOW}.js`));
const log = (msg) => console.log(`[flow] ${msg}`);

class AssertionError extends Error {}
function assert(cond, message) {
  if (!cond) throw new AssertionError(message);
}

app.on('browser-window-created', (_e, win) => {
  win.setSize(1440, 900);
  win.webContents.once('did-finish-load', () => execute(win));
});

async function execute(win) {
  const mock = await mockReady;
  const d = new Driver(win, OUT);
  const started = Date.now();
  const result = { flow: FLOW, ok: false, steps: [], error: null, loggedInAtEnd: false, ms: 0 };

  const ctx = {
    d,
    mock,
    assert,
    userData: USER_DATA,
    log,
    sleep,
    /** Passo nomeado: aparece no relatório; falha interrompe o flow. */
    async step(name, fn) {
      const t = Date.now();
      try {
        await fn();
        result.steps.push({ name, ok: true, ms: Date.now() - t });
        log(`✓ ${name}`);
      } catch (e) {
        result.steps.push({ name, ok: false, ms: Date.now() - t, error: e.message });
        log(`✗ ${name}: ${e.message}`);
        throw e;
      }
    },
    /** Espera uma condição do lado Node (ex.: requisições no mock). */
    async until(fn, message, timeout = 10_000) {
      const t = Date.now();
      while (Date.now() - t < timeout) {
        if (await fn()) return;
        await sleep(100);
      }
      throw new Error(`timeout (${timeout}ms): ${message}`);
    },
    /** Garante sessão: faz login pela UI se a tela de login estiver aberta. */
    async login() {
      await d.waitFor(() => !!document.querySelector('#deployment') || !!document.querySelector('header'), [], {
        message: 'login ou app carregado',
      });
      if (await d.page(() => !!document.querySelector('#deployment'))) {
        await d.fill('#deployment', mock.deploymentId);
        await d.fill('#token', mock.token);
        await d.clickText('Acessar');
      }
      await d.waitForSelector('header');
      await d.waitForText('Patrimônio');
    },
  };

  try {
    await d.waitFor(() => document.querySelector('#root')?.children.length > 0, [], { message: 'React montado' });
    await flow.run(ctx);
    result.ok = true;
  } catch (e) {
    result.error = e instanceof AssertionError ? e.message : e.stack;
    await d.shot('FALHA').catch(() => {});
  }
  result.loggedInAtEnd = await d.page(() => !!document.querySelector('header')).catch(() => false);
  result.ms = Date.now() - started;
  result.requests = mock.requests.map(({ method, acao, params }) => ({ method, acao, params }));
  fs.writeFileSync(path.join(OUT, 'result.json'), JSON.stringify(result, null, 2));
  await mock.close();
  app.exit(result.ok ? 0 : 1);
}
