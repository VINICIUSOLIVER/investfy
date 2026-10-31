module.exports = {
  setup: 'logged-in',
  description: 'KPIs, gráfico de evolução (hover e período), alocação, tabela e encerradas',
  async run({ d, mock, step, assert, until, login }) {
    await step('login', login);

    await step('KPIs e tabela de posições carregadas', async () => {
      for (const t of ['Patrimônio', 'Valor investido', 'Resultado', 'Variação hoje']) await d.waitForText(t);
      await d.waitFor(() => document.querySelectorAll('tbody tr').length >= 4, [], { message: '4 posições' });
      for (const t of ['PETR4', 'VALE3', 'WEGE3', 'ITUB4']) await d.waitForText(t);
      await d.waitForText('Atualizado às');
      await d.shot('carteira');
    });

    await step('posição zerada aparece em "Posições encerradas"', async () => {
      await d.waitForText('Posições encerradas');
      await d.waitForText('MGLU3');
    });

    await step('hover no gráfico de evolução mostra tooltip', async () => {
      await d.hover('svg[aria-label="Evolução do patrimônio"]', 0.6, 0.4);
      await d.waitForText('Investido'); // só existe no tooltip ("Valor investido" na legenda)
      await d.shot('evolucao-hover');
    });

    await step('trocar período consulta evolucao com novos dias', async () => {
      await d.clickText('30d');
      await until(() => mock.requests.some((r) => r.acao === 'evolucao' && r.params.dias === '30'), 'evolucao dias=30');
    });

    await step('alocação lista os ativos abertos', async () => {
      const legenda = await d.page(() =>
        [...document.querySelectorAll('ul li')].map((li) => li.innerText.split('\n')[0].trim()),
      );
      for (const t of ['PETR4', 'VALE3', 'WEGE3', 'ITUB4']) assert(legenda.includes(t), `legenda sem ${t}: ${legenda}`);
    });

    await step('clicar numa posição abre a busca da ação', async () => {
      await d.realClick('tbody tr');
      await d.waitForSelector('dialog[open]');
      await d.waitForText('Sua posição', { timeout: 15_000 });
      await d.shot('posicao-na-busca');
      await d.press('Escape');
      await d.waitFor(() => !document.querySelector('dialog[open]'), [], { message: 'modal fechada' });
    });
  },
};
