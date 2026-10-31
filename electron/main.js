const { app, BrowserWindow, shell, session } = require('electron');
const path = require('node:path');
const { pathToFileURL } = require('node:url');
const { registerIpc } = require('./ipc');
const { startAutoUpdate } = require('./updater');

// Locale do Chromium em pt-BR: controla o formato nativo de <input type="date">
// (dd/mm/aaaa), o calendário e o Intl, independente do idioma do sistema.
app.commandLine.appendSwitch('lang', 'pt-BR');

// Só uma instância do app por vez. O lock é atrelado ao diretório userData, então
// o harness e o `dev:mock` (que usam userData próprio) não conflitam com o app real.
// Se já existe uma instância, esta encerra e a outra traz a janela para frente.
if (!app.requestSingleInstanceLock()) {
  app.quit();
  process.exit(0);
}

/** @type {BrowserWindow | null} */
let mainWindow = null;

app.on('second-instance', () => {
  if (!mainWindow || mainWindow.isDestroyed()) return;
  if (mainWindow.isMinimized()) mainWindow.restore();
  mainWindow.show();
  mainWindow.focus();
});

// Definida pelo script `npm run dev`; ausente no preview e no app empacotado
const DEV_SERVER_URL = process.env.VITE_DEV_SERVER_URL;
const isDev = !app.isPackaged && Boolean(DEV_SERVER_URL);

const INDEX_FILE = path.join(__dirname, '..', 'dist', 'index.html');
const INDEX_URL = pathToFileURL(INDEX_FILE).toString();
const DEV_ORIGIN = isDev ? new URL(DEV_SERVER_URL).origin : null;

/** A única página que pode falar com o main via IPC é a do próprio app. */
function isTrustedUrl(url) {
  if (isDev) {
    try {
      return new URL(url).origin === DEV_ORIGIN;
    } catch {
      return false;
    }
  }
  return url.split(/[?#]/)[0] === INDEX_URL;
}

function createWindow() {
  const win = new BrowserWindow({
    width: 1280,
    height: 820,
    minWidth: 960,
    minHeight: 640,
    show: false,
    backgroundColor: '#f8fafc',
    autoHideMenuBar: true,
    title: 'Investfy',
    webPreferences: {
      preload: path.join(__dirname, 'preload.js'),
      contextIsolation: true,
      nodeIntegration: false,
      sandbox: true,
      webviewTag: false,
      spellcheck: false,
    },
  });

  mainWindow = win;
  win.on('closed', () => {
    if (mainWindow === win) mainWindow = null;
  });

  win.once('ready-to-show', () => win.show());

  // Links externos (https) abrem no navegador padrão, nunca dentro do app
  win.webContents.setWindowOpenHandler(({ url }) => {
    if (url.startsWith('https://')) shell.openExternal(url);
    return { action: 'deny' };
  });

  // Impede que a janela navegue para fora da aplicação
  win.webContents.on('will-navigate', (event, url) => {
    if (!isTrustedUrl(url)) event.preventDefault();
  });

  if (isDev) {
    win.loadURL(DEV_SERVER_URL);
    win.webContents.openDevTools({ mode: 'detach' });
  } else {
    win.loadFile(INDEX_FILE);
  }
}

app.whenReady().then(() => {
  // O app não precisa de câmera, microfone, notificações etc.
  session.defaultSession.setPermissionRequestHandler((_wc, _perm, callback) => callback(false));
  session.defaultSession.setPermissionCheckHandler(() => false);

  registerIpc({ isTrustedUrl });
  createWindow();
  startAutoUpdate();

  app.on('activate', () => {
    if (BrowserWindow.getAllWindows().length === 0) createWindow();
  });
});

app.on('web-contents-created', (_event, contents) => {
  contents.on('will-attach-webview', (event) => event.preventDefault());
});

app.on('window-all-closed', () => {
  if (process.platform !== 'darwin') app.quit();
});
