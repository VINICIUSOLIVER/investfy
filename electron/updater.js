const fs = require('node:fs');
const path = require('node:path');
const { app, BrowserWindow } = require('electron');
const { autoUpdater } = require('electron-updater');

/**
 * Atualização automática via GitHub Releases.
 *
 * - Verifica ao abrir e depois a cada 30 minutos.
 * - Baixa em segundo plano; quando termina, avisa o renderer e reinicia
 *   sozinho após RESTART_DELAY_MS para instalar.
 * - Só roda no app empacotado.
 * - Repositório público: não precisa de token. Se o repositório virar privado,
 *   o workflow grava um token de leitura em electron/update-token.json (nunca
 *   versionado, vem do segredo UPDATER_TOKEN) e o updater passa a usá-lo.
 */
const OWNER = 'VINICIUSOLIVER';
const REPO = 'investfy';
const CHECK_INTERVAL_MS = 30 * 60 * 1000;
const RESTART_DELAY_MS = 10 * 1000;
const TOKEN_FILE = path.join(__dirname, 'update-token.json');

function readToken() {
  try {
    const { token } = JSON.parse(fs.readFileSync(TOKEN_FILE, 'utf8'));
    return typeof token === 'string' && token.trim() ? token.trim() : null;
  } catch {
    return null;
  }
}

/** Envia o estado da atualização para todas as janelas (canal fixo). */
function broadcast(status) {
  for (const win of BrowserWindow.getAllWindows()) {
    if (!win.isDestroyed()) win.webContents.send('update:status', status);
  }
}

function startAutoUpdate() {
  if (!app.isPackaged) return;

  const token = readToken();
  autoUpdater.logger = console;
  autoUpdater.autoDownload = true;
  autoUpdater.autoInstallOnAppQuit = true;
  autoUpdater.setFeedURL(
    token
      ? { provider: 'github', owner: OWNER, repo: REPO, private: true, token }
      : { provider: 'github', owner: OWNER, repo: REPO },
  );

  let downloaded = false;
  let timer = null;

  const check = () => {
    if (downloaded) return;
    autoUpdater.checkForUpdates().catch((err) => console.error('[updater] falha ao verificar:', err?.message || err));
  };

  autoUpdater.on('update-available', (info) => broadcast({ state: 'downloading', version: info.version }));
  autoUpdater.on('error', (err) => console.error('[updater]', err?.message || err));
  autoUpdater.on('update-downloaded', (info) => {
    downloaded = true;
    clearInterval(timer);
    broadcast({ state: 'restarting', version: info.version, inMs: RESTART_DELAY_MS });
    // isSilent = true (sem assistente do NSIS), isForceRunAfter = true (reabre o app)
    setTimeout(() => autoUpdater.quitAndInstall(true, true), RESTART_DELAY_MS);
  });

  check();
  timer = setInterval(check, CHECK_INTERVAL_MS);
}

module.exports = { startAutoUpdate };
