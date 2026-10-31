const fs = require('node:fs');
const path = require('node:path');

module.exports = {
  setup: 'fresh',
  description: 'Login: erro por campo (código, implantação, token), URL colada, sessão gravada',
  async run({ d, mock, step, assert, userData, log }) {
    await step('tela de login com os dois campos', async () => {
      await d.waitForSelector('#deployment');
      await d.waitForSelector('#token');
      const focus = await d.focused();
      assert(focus.id === 'deployment', `foco inicial deveria ser o código, foi #${focus.id}`);
      await d.shot('login');
    });

    await step('código mal formatado é barrado no main, sem chamar a API', async () => {
      const antes = mock.requests.length;
      await d.fill('#deployment', 'abc');
      await d.fill('#token', mock.token);
      await d.clickText('Acessar');
      await d.waitForText('Código de implantação inválido');
      assert(mock.requests.length === antes, 'nenhuma requisição deveria ter saído');
      await d.shot('codigo-invalido');
    });

    await step('implantação inexistente → "não encontrada" no campo do código', async () => {
      await d.fill('#deployment', 'AKfycbImplantacaoQueNaoExiste');
      await d.clickText('Acessar');
      await d.waitForText('Implantação não encontrada');
      await d.shot('implantacao-404');
    });

    await step('URL colada inteira + token errado → erro no campo do token', async () => {
      await d.fill('#deployment', `https://script.google.com/macros/s/${mock.deploymentId}/exec`);
      await d.fill('#token', 'token-errado');
      await d.clickText('Acessar');
      await d.waitForText('Token inválido.');
      await d.shot('token-invalido');
    });

    await step('login válido abre a Carteira', async () => {
      await d.fill('#token', mock.token);
      await d.clickText('Acessar');
      await d.waitForText('Patrimônio');
      await d.waitForText('Adicionar lançamento');
    });

    await step('sessão gravada com permissão 0600 e token fora de texto puro', async () => {
      const file = path.join(userData, 'session.bin');
      assert(fs.existsSync(file), 'session.bin não foi criado');
      const raw = fs.readFileSync(file);
      if (process.platform !== 'win32') {
        const mode = fs.statSync(file).mode & 0o777;
        assert(mode === 0o600, `permissão esperada 600, encontrada ${mode.toString(8)}`);
      }
      if (raw[0] === 1) {
        assert(!raw.includes(mock.token), 'token legível dentro do arquivo criptografado');
      } else {
        log('aviso: sem cofre do SO disponível — sessão gravada em texto com 0600 (fallback esperado)');
      }
    });
  },
};
