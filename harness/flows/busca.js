const INPUT = 'dialog[open] input';

module.exports = {
  setup: 'logged-in',
  description: 'Buscar ação: clique+digitação reais, debounce, Enter, Ctrl+K, erros e moeda estrangeira',
  async run({ d, mock, step, assert, until, login, sleep }) {
    await step('login', login);

    await step('clique na topbar abre a modal com foco no campo', async () => {
      await d.realClick('header button[aria-keyshortcuts="Control+K"]');
      await d.waitForSelector('dialog[open]');
      await d.waitFor(() => document.activeElement?.matches('dialog[open] input'), [], { message: 'autofocus' });
    });

    await step('digitar consulta só após o debounce (uma requisição)', async () => {
      await d.type('ALOS3');
      await sleep(300);
      assert(mock.count('cotacao') === 0, 'consultou antes do debounce de 800 ms');
      await until(() => mock.count('cotacao') === 1, 'cotacao após debounce', 3_000);
      await d.waitForText('Consultando ALOS3');
      await d.waitForText('Allos ON');
      assert(mock.count('cotacao') === 1, `esperada 1 consulta, houve ${mock.count('cotacao')}`);
      await d.shot('busca-alos3');
    });

    await step('Enter consulta na hora e mostra a posição da carteira', async () => {
      await d.fill(INPUT, '');
      await d.type('PETR4');
      const t = Date.now();
      await d.press('Enter');
      await until(() => mock.count('cotacao', t) >= 1, 'cotacao imediata no Enter', 500);
      await d.waitForText('Sua posição');
      await d.shot('busca-petr4');
    });

    await step('"Novo lançamento" abre o formulário com o ticker preenchido', async () => {
      await d.clickText('Novo lançamento', { within: 'dialog' });
      await d.waitForSelector('dialog[open] #l-ticker');
      const valor = await d.page(() => document.querySelector('#l-ticker').value);
      assert(valor === 'PETR4', `ticker preenchido esperado PETR4, veio "${valor}"`);
      await d.press('Escape');
      await d.waitFor(() => !document.querySelector('dialog[open]'), [], { message: 'modal fechada' });
    });

    await step('Ctrl+K abre a busca', async () => {
      await d.press('K', ['control']);
      await d.waitForSelector('dialog[open]');
    });

    await step('ticker inexistente mostra o erro da API', async () => {
      await d.fill(INPUT, 'XPTO3');
      await d.press('Enter');
      await d.waitForText('ação BVMF:XPTO3 não encontrada');
    });

    await step('ok:true sem dados vira mensagem clara', async () => {
      await d.fill(INPUT, 'VAZIO3');
      await d.press('Enter');
      await d.waitForText('A API respondeu sem dados para VAZIO3');
      await d.shot('busca-sem-dados');
    });

    await step('ação dos EUA formata na moeda da cotação', async () => {
      await d.fill(INPUT, 'NASDAQ:AAPL');
      await d.press('Enter');
      await d.waitForText('Apple Inc');
      await d.waitForText('US$');
      await d.shot('busca-aapl');
    });
  },
};
