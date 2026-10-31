const { contextBridge, ipcRenderer } = require('electron');

/**
 * Superfície mínima exposta ao React (window.api).
 * Cada função mapeia para um canal fixo — o renderer não escolhe canais
 * nem tem acesso ao token, que vive apenas no processo main.
 */
const call = (channel) => (arg) => ipcRenderer.invoke(channel, arg);

contextBridge.exposeInMainWorld('api', {
  auth: {
    status: call('auth:status'),
    login: call('auth:login'),
    logout: call('auth:logout'),
  },
  carteira: call('api:carteira'),
  lancamentos: call('api:lancamentos'),
  evolucao: call('api:evolucao'),
  acompanhamento: call('api:acompanhamento'),
  cotacao: call('api:cotacao'),
  adicionar: call('api:adicionar'),
  excluir: call('api:excluir'),
  acompanhar: call('api:acompanhar'),
  alterarAlvo: call('api:alterarAlvo'),
  desacompanhar: call('api:desacompanhar'),
  updates: {
    /** Recebe { state: 'downloading' | 'restarting', version, inMs? }. Retorna a função de cancelar. */
    onStatus: (callback) => {
      const listener = (_event, status) => callback(status);
      ipcRenderer.on('update:status', listener);
      return () => ipcRenderer.removeListener('update:status', listener);
    },
  },
});
