/**
 * Driver mínimo sobre webContents do Electron.
 *
 * - `page(fn, ...args)`: executa `fn` NO RENDERER (sem closures; args/retorno serializáveis).
 *   A CSP de produção bloqueia eval, mas executeJavaScript roda o código-fonte diretamente.
 * - Interações "de usuário" (realClick, type, press, hover) usam sendInputEvent: passam
 *   pelo mesmo caminho de eventos do Chromium que um humano. Prefira-as ao validar UX
 *   (foco, teclado, debounce); `fill`/`clickText` são atalhos para preparar estado.
 * - Sempre espere por uma condição (`waitFor*`) em vez de `sleep`.
 */
const fs = require('node:fs');
const path = require('node:path');

const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

// Funções auxiliares instaladas no renderer (window.__h)
function installHelpers() {
  if (window.__h) return;
  const visible = (el) => !!el && (el.offsetParent !== null || el.closest('dialog[open]'));
  window.__h = {
    scope(within) {
      if (within === 'dialog') return document.querySelector('dialog[open]') || document;
      if (within) return document.querySelector(within) || document;
      return document;
    },
    // Botão por texto exato > texto contido > aria-label
    button(text, within) {
      const all = [...this.scope(within).querySelectorAll('button')].filter(visible);
      return (
        all.find((b) => b.textContent.trim() === text) ||
        all.find((b) => b.textContent.includes(text)) ||
        all.find((b) => b.getAttribute('aria-label') === text)
      );
    },
    // Intl pt-BR usa espaço não separável (U+00A0/U+202F) em "R$ 1,00": normaliza para espaço comum
    bodyText() {
      const d = document.querySelector('dialog[open]');
      return ((d ? d.innerText + '\n' : '') + document.body.innerText).replace(/[\u00a0\u202f]/g, ' ');
    },
  };
}

class Driver {
  constructor(win, outDir) {
    this.win = win;
    this.wc = win.webContents;
    this.outDir = outDir;
    this.shots = 0;
  }

  async page(fn, ...args) {
    const src = `(${fn.toString()})(${args.map((a) => JSON.stringify(a)).join(',')})`;
    return this.wc.executeJavaScript(src);
  }

  async ready() {
    await this.page(installHelpers);
  }

  /* --------------------------------------------------------------- espera */
  async waitFor(fn, args = [], { timeout = 10_000, interval = 100, message } = {}) {
    const started = Date.now();
    let last;
    while (Date.now() - started < timeout) {
      try {
        await this.ready();
        last = await this.page(fn, ...args);
        if (last) return last;
      } catch (e) {
        last = e;
      }
      await sleep(interval);
    }
    throw new Error(`timeout (${timeout}ms): ${message || fn.toString().slice(0, 120)}`);
  }

  /** Espera um texto aparecer (na modal aberta ou na página). */
  waitForText(text, opts = {}) {
    return this.waitFor((t) => window.__h.bodyText().includes(t), [text], { message: `texto "${text}"`, ...opts });
  }

  waitForGone(text, opts = {}) {
    return this.waitFor((t) => !window.__h.bodyText().includes(t), [text], { message: `sumir "${text}"`, ...opts });
  }

  waitForSelector(selector, opts = {}) {
    return this.waitFor((s) => !!document.querySelector(s), [selector], { message: `seletor ${selector}`, ...opts });
  }

  async hasText(text) {
    await this.ready();
    return this.page((t) => window.__h.bodyText().includes(t), text);
  }

  /* ---------------------------------------------------- atalhos de estado */
  /** Define o valor de um input controlado pelo React (dispara onChange). */
  async fill(selector, value) {
    await this.waitForSelector(selector);
    await this.page(
      (s, v) => {
        const el = document.querySelector(s);
        const setter = Object.getOwnPropertyDescriptor(HTMLInputElement.prototype, 'value').set;
        setter.call(el, v);
        el.dispatchEvent(new Event('input', { bubbles: true }));
      },
      selector,
      value,
    );
  }

  /** Clica no botão por texto (ou aria-label). `within`: 'dialog' ou seletor CSS. */
  async clickText(text, { within } = {}) {
    await this.waitFor((t, w) => !!window.__h.button(t, w), [text, within], { message: `botão "${text}"` });
    await this.page((t, w) => window.__h.button(t, w).click(), text, within);
  }

  async click(selector) {
    await this.waitForSelector(selector);
    await this.page((s) => document.querySelector(s).click(), selector);
  }

  /* ---------------------------------------------------- input "humano" */
  async center(selector) {
    await this.waitForSelector(selector);
    return this.page((s) => {
      const r = document.querySelector(s).getBoundingClientRect();
      return { x: Math.round(r.x + r.width / 2), y: Math.round(r.y + r.height / 2), w: r.width, h: r.height };
    }, selector);
  }

  async realClick(selector) {
    const { x, y } = await this.center(selector);
    this.wc.sendInputEvent({ type: 'mouseDown', x, y, button: 'left', clickCount: 1 });
    this.wc.sendInputEvent({ type: 'mouseUp', x, y, button: 'left', clickCount: 1 });
  }

  /** Move o mouse para uma fração da área do elemento (0..1). */
  async hover(selector, fx = 0.5, fy = 0.5) {
    await this.waitForSelector(selector);
    const p = await this.page(
      (s, a, b) => {
        const r = document.querySelector(s).getBoundingClientRect();
        return { x: Math.round(r.x + r.width * a), y: Math.round(r.y + r.height * b) };
      },
      selector,
      fx,
      fy,
    );
    this.wc.sendInputEvent({ type: 'mouseMove', x: p.x, y: p.y });
  }

  /** Digita no elemento focado, tecla a tecla. */
  async type(text, delay = 40) {
    for (const ch of text) {
      this.wc.sendInputEvent({ type: 'char', keyCode: ch });
      await sleep(delay);
    }
  }

  /** Ex.: press('K', ['control']) · press('Enter') · press('Escape') */
  async press(keyCode, modifiers = []) {
    this.wc.sendInputEvent({ type: 'keyDown', keyCode, modifiers });
    // Submissão implícita de <form> acontece no evento `char` do Enter, não no keyDown
    if (keyCode === 'Enter' || keyCode === 'Return') this.wc.sendInputEvent({ type: 'char', keyCode: '\r', modifiers });
    this.wc.sendInputEvent({ type: 'keyUp', keyCode, modifiers });
  }

  async focused() {
    return this.page(() => {
      const el = document.activeElement;
      return { tag: el?.tagName, id: el?.id, placeholder: el?.placeholder ?? null, value: el?.value ?? null };
    });
  }

  /* ------------------------------------------------------------ evidência */
  async shot(name) {
    await sleep(150); // deixa a última pintura assentar
    const img = await this.wc.capturePage();
    const file = path.join(this.outDir, `${String(++this.shots).padStart(2, '0')}-${name}.png`);
    fs.writeFileSync(file, img.toPNG());
    return file;
  }
}

module.exports = { Driver, sleep };
