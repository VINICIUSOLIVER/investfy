// Flow interno (prefixo _): só cria uma sessão salva para flows com setup 'saved-session'.
module.exports = {
  setup: 'fresh',
  description: 'Pré-condição: login pela UI',
  async run({ step, login }) {
    await step('login', login);
  },
};
