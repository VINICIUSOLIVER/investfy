const fs = require('node:fs/promises');
const path = require('node:path');
const { app, safeStorage } = require('electron');

/**
 * Sessão persistida no processo main: { deploymentId, token }.
 * Nada disso é enviado ao renderer (exceto o código de implantação, para
 * pré-preencher o login). Gravado criptografado pelo cofre do SO via
 * safeStorage; sem cofre disponível (ex.: Linux sem keyring), grava com 0600.
 *
 * Ao sair, o token é apagado e o código de implantação é mantido.
 */
const FILE = path.join(app.getPath('userData'), 'session.bin');
const PLAIN = 0;
const ENCRYPTED = 1;
const EMPTY = Object.freeze({ deploymentId: null, token: null });

let cached; // undefined = ainda não lido

async function canEncrypt() {
  try {
    return await safeStorage.isAsyncEncryptionAvailable();
  } catch {
    return false;
  }
}

function sanitize(data) {
  return {
    deploymentId: typeof data?.deploymentId === 'string' && data.deploymentId ? data.deploymentId : null,
    token: typeof data?.token === 'string' && data.token ? data.token : null,
  };
}

async function read() {
  if (cached !== undefined) return cached;
  try {
    const raw = await fs.readFile(FILE);
    const body = raw.subarray(1); // 1º byte = formato
    if (raw[0] === ENCRYPTED) {
      const { result, shouldReEncrypt } = await safeStorage.decryptStringAsync(body);
      cached = sanitize(JSON.parse(result));
      if (shouldReEncrypt) await write(cached);
    } else {
      cached = sanitize(JSON.parse(body.toString('utf8')));
    }
  } catch {
    cached = EMPTY;
  }
  return cached;
}

async function write(session) {
  const json = JSON.stringify(session);
  const encrypted = await canEncrypt();
  const body = encrypted ? await safeStorage.encryptStringAsync(json) : Buffer.from(json, 'utf8');
  await fs.writeFile(FILE, Buffer.concat([Buffer.from([encrypted ? ENCRYPTED : PLAIN]), body]), { mode: 0o600 });
  cached = session;
}

/** Sessão completa (código + token) ou null. */
async function get() {
  const s = await read();
  return s.deploymentId && s.token ? s : null;
}

async function save(deploymentId, token) {
  await write(sanitize({ deploymentId, token }));
}

/** Logout: apaga o token, mantém o código de implantação. */
async function clearToken() {
  const { deploymentId } = await read();
  if (deploymentId) await write({ deploymentId, token: null });
  else {
    cached = EMPTY;
    await fs.rm(FILE, { force: true });
  }
}

module.exports = { read, get, save, clearToken };
