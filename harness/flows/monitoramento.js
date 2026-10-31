// As funções abaixo rodam no renderer (sem closures). Cada card tem um botão "Remover <TICKER>".
function cardTickers() {
  return [...document.querySelectorAll('button[aria-label^="Remover "]')].map((b) => b.getAttribute('aria-label').slice(8));
}

function clickInCard(ticker, label) {
  const card = document.querySelector(`button[aria-label="Remover ${ticker}"]`)?.closest('.rounded-2xl');
  if (!card) throw new Error(`card ${ticker} não encontrado`);
  card.querySelector(`button[aria-label="${label}"]`).click();
}

module.exports = {
  setup: 'logged-in',
  description: 'Cards com status do alvo (frontend), alvo obrigatório, filtro, editar e remover',
  async run({ d, mock, step, assert, login }) {
    await step('login', login);

    await step('cards com status calculado no frontend', async () => {
      await d.clickText('Monitoramento');
      await d.waitForText('Banco do Brasil ON');
      // BBAS3 21,51 ≤ 26 → atingido · MGLU3 9,77 vs 9,60 → próximo (<2%) · BBDC3 14,20 vs 12 → longe
      await d.waitForText('Atingido');
      await d.waitForText('Próximo');
      await d.waitForText('faltam');
      await d.waitForText('Gráfico disponível após o primeiro registro'); // BBDC3 sem série
      await d.shot('monitoramento');
    });

    await step('hover no minigráfico mostra horário e preço', async () => {
      await d.hover('svg[aria-label="Preços do pregão"]', 0.5, 0.5);
      await d.waitFor(() => /\d{2}:\d{2} · R\$/.test(document.body.innerText), [], { message: 'tooltip HH:MM · R$' });
      await d.shot('sparkline-hover');
    });

    await step('preço-alvo é obrigatório (sem chamar a API)', async () => {
      await d.fill('input[aria-label="Código da ação"]', 'PETR4');
      await d.clickText('Monitorar');
      await d.waitForText('Preço-alvo é obrigatório.');
      assert(mock.count('acompanhar') === 0, 'não deveria ter chamado acompanhar');
    });

    await step('adicionar com alvo cria o card', async () => {
      await d.fill('input[aria-label="Código da ação"]', 'PETR4');
      await d.fill('input[aria-label="Preço-alvo"]', '50,00');
      await d.clickText('Monitorar');
      await d.waitForText('PETR4 adicionada ao monitoramento.');
      await d.waitFor(() => !!document.querySelector('button[aria-label="Remover PETR4"]'), [], { message: 'card PETR4' });
    });

    await step('duplicado mostra o erro da API', async () => {
      await d.fill('input[aria-label="Código da ação"]', 'PETR4');
      await d.fill('input[aria-label="Preço-alvo"]', '40');
      await d.clickText('Monitorar');
      await d.waitForText('já está em acompanhamento');
    });

    await step('atalho "No preço-alvo" filtra só as atingidas', async () => {
      await d.clickText('No preço-alvo');
      await d.waitFor(() => document.querySelectorAll('button[aria-label^="Remover "]').length === 1, [], {
        message: 'um card após filtrar',
      });
      const visiveis = await d.page(cardTickers);
      assert(visiveis[0] === 'BBAS3', `esperado só BBAS3, veio ${visiveis}`);
      await d.shot('filtro-no-alvo');
      await d.clickText('No preço-alvo');
    });

    await step('editar alvo recalcula o status', async () => {
      await d.page(clickInCard, 'BBDC3', 'Alterar preço-alvo');
      await d.fill('input[aria-label="Novo preço-alvo"]', '15');
      await d.click('button[aria-label="Salvar"]');
      await d.waitForText('Preço-alvo de BBDC3 atualizado.');
      await d.waitFor(() => document.body.innerText.split('Atingido').length - 1 === 2, [], {
        message: 'BBDC3 passa a "Atingido" (14,20 ≤ 15)',
      });
    });

    await step('remover pede confirmação', async () => {
      await d.page(clickInCard, 'BBDC3', 'Remover BBDC3');
      await d.waitForText('Parar de monitorar?');
      await d.shot('confirmar-remocao');
      await d.clickText('Remover', { within: 'dialog' });
      await d.waitForText('BBDC3 removida do monitoramento.');
      assert(mock.count('desacompanhar') === 1, 'desacompanhar deveria ter sido chamado uma vez');
    });
  },
};
