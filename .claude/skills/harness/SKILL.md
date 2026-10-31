---
name: harness
description: Harness E2E do Investfy (app Electron real + mock da API). Use para verificar uma mudança de tela ou do processo main, rodar os testes E2E, criar ou corrigir um flow, ou alterar o mock da API.
---

# Harness E2E

Roda o build de produção do app no Electron real, com a API trocada por um mock, e percorre as telas com asserções e screenshots. Código em `harness/`; uso em `npm run harness -- --help`.

## Verificar uma mudança

1. Rode os flows das telas afetadas: `npm run harness -- <flow...>` (`--list` mostra os flows).
2. Para cada falha, abra `harness/output/<flow>/NN-FALHA.png` e decida: **bug do app** ou **bug do flow**. Os dois acontecem. O harness já achou uma corrida real (venda enviada antes de a carteira carregar). Corrija a causa, não afrouxe a asserção.
3. Abra os screenshots das telas que você mudou e confira o visual. As asserções não pegam layout.
4. Antes de declarar pronto, rode a suíte inteira: `npm run harness`.

Concluído quando todos os flows estão ✓ e você viu os screenshots das telas alteradas.

Sem display (CI, servidor): `xvfb-run -a npm run harness`. Para mexer no app à mão contra o mock: `npm run dev:mock` (imprime código de implantação e token; usa um userData separado, a sessão real fica intacta).

Saída de cada flow em `harness/output/<flow>/`: screenshots, `result.json` (passos e requisições feitas ao mock) e `electron.log` (inclui as linhas `[api]` do main).

## Como funciona (o que o código não confessa)

- `runner.js` executa nesta ordem obrigatória: userData temporário, depois patch do `undici.fetch` (`lib/redirect.js`), depois `require` **síncrono** de `electron/main.js`. O patch precisa existir antes de `api-client.js` desestruturar o `fetch`, e o main precisa carregar antes de o app ficar pronto (o switch `lang=pt-BR` só vale assim).
- O mock roda **dentro** do processo do Electron, em HTTP, numa porta aleatória, com estado novo a cada flow. A URL fixa do Google é reescrita para ele, sem nenhum gancho de teste no código do app.
- `setup` do flow, resolvido pelo `cli.js`: `fresh` (userData novo, deslogado), `saved-session` (exige sessão gravada por um processo anterior; o cli roda `_login` se preciso), `logged-in` (o flow chama `login()`, que só entra pela UI se cair no login).

## Escrever um flow

Crie `harness/flows/<nome>.js` e acrescente o nome em `ORDER` no `cli.js` se ele deve rodar na suíte padrão.

```js
module.exports = {
  setup: 'logged-in',
  description: 'Uma linha: o que o flow garante',
  async run({ d, mock, step, assert, until, login }) {
    await step('login', login);
    await step('comportamento observável', async () => {
      const t = Date.now();
      await d.clickText('Botão');
      await d.waitForText('Texto que prova o resultado');
      await until(() => mock.count('carteira', t) >= 1, 'carteira reconsultada');
      assert(mock.count('evolucao', t) === 0, 'evolução não pode ser reconsultada');
      await d.shot('estado-final');
    });
  },
};
```

Regras do driver (`lib/driver.js`):

- `d.page(fn, ...args)` executa `fn` **no renderer**: função autocontida (sem closures do Node), args e retorno serializáveis em JSON. Use `function` ou arrow, não método abreviado. `eval` é bloqueado pela CSP de produção.
- Sempre **espere uma condição** (`waitFor`, `waitForText`, `waitForSelector`, `until` para o lado do mock); `sleep` só para provar uma ausência (ex.: "não consultou antes do debounce").
- Valide UX com input **humano** (`realClick`, `type`, `press`): foco, teclado, debounce e submit passam pelo caminho real do Chromium. `fill` e `clickText` servem para preparar estado.
- Prove regras de cache e de rede pelo **log do mock**: `mock.count(acao, desde)` e `mock.requests`.
- Seletores: `id`, `aria-label`, `aria-keyshortcuts`, roles. Se faltar um, acrescente o atributo semântico ao app (é acessibilidade de verdade), não `data-testid`.
- Telas resetadas após uma escrita mostram skeleton: espere o dado (ex.: uma data na linha), não o rótulo.

## Mock (`harness/mock/`)

Segue `examples/api-carteira.md`; quando o contrato mudar, atualize o mock junto (veja a skill `api-route`).

| Comportamento | Como disparar |
|---|---|
| `ok: true` sem `dados` | cotação de `VAZIO3` |
| Cotação lenta (10 s) | cotação de `LENTO3` |
| "não encontrada" | qualquer ticker fora de `fixtures.js` |
| 404 HTML (implantação inexistente) | código de implantação diferente do do mock |
| `precoAtual: null` logo após escrita | automático na 1ª leitura de `carteira` após `adicionar`/`excluir` |
| Latência próxima da real | `--latency real` |

Estados do monitoramento nas fixtures: BBAS3 **atingido**, MGLU3 **próximo** (< 2%), BBDC3 **longe** e sem série. Valores são determinísticos; mudar `fixtures.js` pode exigir ajustar asserções numéricas dos flows.
