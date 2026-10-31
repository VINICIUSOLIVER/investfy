module.exports = {
  setup: 'logged-in',
  description: 'Novo lançamento (validação, data pt-BR, cache), filtros e exclusão com confirmação',
  async run({ d, mock, step, assert, until, login }) {
    await step('login', login);

    await step('modal abre com foco no ticker e data em pt-BR', async () => {
      await d.clickText('Adicionar lançamento');
      await d.waitForSelector('dialog[open] #l-ticker');
      const focus = await d.focused();
      assert(focus.id === 'l-ticker', `foco esperado em #l-ticker, foi #${focus.id}`);
      // O formato visual do <input type=date> segue o locale do Chromium (switch `lang` no main)
      const locale = await d.page(() => navigator.language);
      assert(locale === 'pt-BR', `locale do Chromium esperado pt-BR, veio ${locale}`);
    });

    await step('venda acima da posição é barrada no formulário', async () => {
      await d.clickText('Venda', { within: 'dialog' });
      await d.fill('#l-ticker', 'PETR4');
      await d.fill('#l-qtd', '999');
      await d.fill('#l-preco', '50,00');
      await d.clickText('Salvar lançamento', { within: 'dialog' });
      await d.waitForText('Você tem 70 em carteira');
      assert(mock.count('adicionar') === 0, 'não deveria ter chamado a API');
      await d.shot('venda-acima-da-posicao');
    });

    await step('total da venda desconta os custos (formato brasileiro)', async () => {
      await d.fill('#l-qtd', '10');
      await d.fill('#l-taxas', '4,90');
      await d.waitForText('R$ 495,10'); // 10 × 50,00 − 4,90
      await d.shot('lancamento-preenchido');
    });

    let salvoEm = 0;
    await step('salvar: toast, carteira recarregada e evolução intocada', async () => {
      salvoEm = Date.now();
      await d.clickText('Salvar lançamento', { within: 'dialog' });
      await d.waitForText('Venda de PETR4 registrada.');
      // 1ª leitura após escrita vem com cotação null → o app tenta de novo em ~3 s
      await until(() => mock.count('carteira', salvoEm) >= 2, 'carteira relida após cotação null', 12_000);
      await d.waitFor(
        (t) => {
          const tr = [...document.querySelectorAll('tbody tr')].find((r) => r.innerText.includes(t));
          return tr?.children[1]?.innerText.trim() === '60' && !tr.querySelector('.animate-pulse');
        },
        ['PETR4'],
        { message: 'PETR4 com 60 ações e cotação carregada', timeout: 12_000 },
      );
      assert(mock.count('evolucao', salvoEm) === 0, 'evolução não pode ser reconsultada após lançamento');
      await d.shot('carteira-apos-venda');
    });

    await step('aba Lançamentos lista a venda nova primeiro', async () => {
      await d.clickText('Lançamentos');
      // Após a escrita a lista foi resetada (skeleton): espera linhas com data
      await d.waitFor(() => /\d{2}\/\d{2}\/\d{4}/.test(document.querySelector('tbody tr')?.innerText ?? ''), [], {
        message: 'lançamentos carregados',
      });
      const primeira = await d.page(() => document.querySelector('tbody tr')?.innerText ?? '');
      assert(primeira.includes('PETR4') && primeira.includes('Venda'), `primeira linha inesperada: ${primeira}`);
      await d.shot('lancamentos');
    });

    await step('filtro por ação e por tipo', async () => {
      await d.fill('input[aria-label="Filtrar por ação"]', 'MGLU');
      await d.waitFor(() => document.querySelectorAll('tbody tr').length === 2, [], { message: '2 linhas de MGLU3' });
      await d.fill('input[aria-label="Filtrar por ação"]', '');
      await d.clickText('Vendas');
      await d.waitFor(
        () => [...document.querySelectorAll('tbody tr')].every((tr) => tr.innerText.includes('Venda')),
        [],
        { message: 'só vendas' },
      );
      await d.clickText('Todos');
    });

    await step('excluir pede confirmação e remove a linha', async () => {
      const antes = await d.page(() => document.querySelectorAll('tbody tr').length);
      await d.click('tbody tr button[aria-label="Excluir lançamento"]');
      await d.waitForText('Excluir lançamento?');
      await d.shot('confirmar-exclusao');
      await d.clickText('Excluir', { within: 'dialog' });
      await d.waitForText('Lançamento excluído.');
      await d.waitFor((n) => document.querySelectorAll('tbody tr').length === n - 1, [antes], {
        message: 'uma linha a menos',
      });
    });

    await step('erro da API (venda ficaria descoberta) aparece ao usuário', async () => {
      // Excluir a compra de 10/03 deixaria a venda de 12/08 sem saldo
      await d.page(() => {
        const tr = [...document.querySelectorAll('tbody tr')].find(
          (r) => r.innerText.includes('10/03/2026') && r.innerText.includes('PETR4'),
        );
        tr.querySelector('button[aria-label="Excluir lançamento"]').click();
      });
      await d.clickText('Excluir', { within: 'dialog' });
      await d.waitForText('venda maior que a quantidade em carteira');
      await d.shot('erro-api-exclusao');
    });
  },
};
