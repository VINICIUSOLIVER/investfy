/**
 * Entry do Electron para `npm run dev:mock`: o app em modo dev (Vite + HMR)
 * falando com o mock em vez da API real. Usa um userData separado, então a
 * sessão real salva no seu computador não é tocada.
 */
const { app } = require('electron');
const os = require('node:os');
const path = require('node:path');
const { createMockServer } = require('./mock/server');
const { redirectApiTo } = require('./lib/redirect');

app.setPath('userData', path.join(os.tmpdir(), 'investfy-dev-mock'));

let mockUrl = null;
redirectApiTo(() => mockUrl);
createMockServer({ latency: process.env.HARNESS_LATENCY || 'real' }).then((m) => {
  mockUrl = m.url;
  console.log('\n[mock] API simulada pronta. Credenciais de login:');
  console.log(`[mock]   Código de implantação: ${m.deploymentId}`);
  console.log(`[mock]   Token:                 ${m.token}\n`);
});

require('../electron/main.js');
