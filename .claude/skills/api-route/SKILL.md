---
name: api-route
description: Caminho de uma chamada da API Carteira no Investfy, do processo main até o React Query. Use ao adicionar ou alterar uma ação da API, mudar intervalo de atualização ou invalidação de cache, ou tratar um novo erro da API.
---

# Rotas da API Carteira

O contrato (rotas, campos, erros) está em `examples/api-carteira.md`, que é a fonte da verdade. Esta skill cobre como o app o consome.

## Invariantes

- **Segredo fica no main.** Token e código de implantação vivem em `electron/session-store.js` (criptografados via `safeStorage`). O renderer conhece só o estado da sessão e o código (para pré-preencher o login). A URL base é fixa em `electron/api-client.js`.
- **Renderer não é confiável.** Todo argumento que chega por IPC é validado em `electron/ipc.js` antes de virar requisição. O preload expõe um canal fixo por ação; o renderer nunca escolhe canal nem `acao`.
- **Envelope serializável.** Handlers respondem `{ ok: true, dados }` ou `{ ok: false, code, erro }`, porque erros lançados no `ipcMain.handle` perdem propriedades. `src/lib/api.js` converte em `ApiError`.
- **Sem timeout de resposta.** O `Agent` do undici zera `headersTimeout`/`bodyTimeout`; só a conexão tem limite. A API pode demorar e esperamos.
- **Cálculo é do servidor.** Preço médio e rentabilidade vêm prontos; o cliente só soma (KPIs) e compara (status do preço-alvo, feito no frontend por decisão do produto).

Códigos de erro (`code`):

| code | Origem | Efeito no app |
|---|---|---|
| `UNAUTHORIZED` | API: "não autorizado" | main apaga o token; `AuthProvider` encerra a sessão |
| `API` | `ok: false` com `erro` | mensagem do servidor exibida como está (já em português) |
| `DEPLOYMENT` | 404 ou resposta não-JSON | erro no campo do código de implantação |
| `VALIDATION` | `ipc.js` | mensagem de validação |
| `NETWORK` | falha de conexão | erro genérico; o React Query re-tenta (assim como erros sem código) |
| `CONFIG` | sem `window.api` | app aberto fora do Electron |

Erros "de negócio" ficam em `NON_RETRYABLE` (`src/lib/queryClient.js`).

## Adicionar ou alterar uma ação

1. `electron/api-client.js`: chame `get(session, acao, params)` ou `post(session, acao, body)`. O log `[api]` vem de graça.
2. `electron/ipc.js`: `handle('api:<acao>', check, async (arg) => api.get(await requireSession(), '<acao>', validado))`, com validadores no topo do arquivo.
3. `electron/preload.js`: `<acao>: call('api:<acao>')`.
4. `src/lib/api.js`: `<acao>: call('<acao>')`.
5. `src/hooks/queries.js`: chave em `keys` e hook com a política da tabela abaixo.
6. `harness/mock/server.js` (mapas `GET`/`POST`) e `fixtures.js`: implemente a ação no mock.
7. Cubra num flow do harness (skill `harness`) e rode `npm run harness`.

Concluído quando os 7 passos estão feitos, o harness está verde e, em `npm run dev:mock`, o terminal mostra a linha `[api]` da nova ação.

## Política de atualização (decisão do produto)

| Dado | Atualização | Após compra/venda |
|---|---|---|
| `carteira` | 1 min; se vier `precoAtual` null, tenta de novo a cada 3 s (máx. 3) | `resetQueries` |
| `lancamentos` | 1 min | `resetQueries` |
| `cotacao` | sob demanda, `staleTime` 1 min, sem retry (rota lenta e serializada no servidor) | `resetQueries` (traz `posicao`) |
| `evolucao` | **5 h**, `gcTime: Infinity` | **nunca** invalidada |
| `acompanhamento` | 5 min | `invalidateQueries` após acompanhar, alterar alvo ou desacompanhar |

Polling pausa com a janela oculta (`refetchIntervalInBackground: false`). O cache vive só em memória: reabrir o app consulta tudo de novo, inclusive a evolução.
