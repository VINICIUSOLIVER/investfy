module.exports = {
  setup: 'saved-session',
  description: 'Reabertura entra direto; Sair apaga o token e mantém o código de implantação',
  async run({ d, mock, step, assert }) {
    await step('reabrir o app entra direto na Carteira', async () => {
      await d.waitForText('Patrimônio');
      assert(!(await d.page(() => !!document.querySelector('#deployment'))), 'não deveria mostrar o login');
      await d.shot('reabertura');
    });

    await step('Sair volta ao login com o código pré-preenchido e foco no token', async () => {
      await d.clickText('Sair');
      await d.waitForSelector('#deployment');
      const valor = await d.page(() => document.querySelector('#deployment').value);
      assert(valor === mock.deploymentId, `código esperado ${mock.deploymentId}, veio "${valor}"`);
      const token = await d.page(() => document.querySelector('#token').value);
      assert(token === '', 'o campo de token deveria estar vazio');
      await d.waitFor(() => document.activeElement?.id === 'token', [], { message: 'foco no token' });
      await d.shot('apos-sair');
    });
  },
};
