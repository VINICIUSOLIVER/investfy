# API Carteira de Ações — Especificação

API em Google Apps Script (Web App) que usa uma Planilha Google como banco de dados.
O app cliente é **Electron + React**.

---

## 1. Base URL

```
https://script.google.com/macros/s/{DEPLOYMENT_ID}/exec
```

- Existe **uma única URL**. A rota é escolhida pelo parâmetro `acao`.
- `{DEPLOYMENT_ID}` vem da implantação do Apps Script. Guardar em variável de ambiente (`API_URL`), nunca fixo no código.

## 2. Autenticação

- Todas as requisições exigem o campo `token`.
  - **GET**: vai na query string (`?token=...`).
  - **POST**: vai no corpo JSON (`{ "token": "..." }`).
- Guardar em variável de ambiente (`API_TOKEN`).
- **No Electron, as chamadas devem ser feitas no processo main** e expostas ao React via `preload` + `contextBridge` / `ipcRenderer.invoke`. O token **não pode** ir para o bundle do renderer.

## 3. Formato de resposta (todas as rotas)

O Apps Script **sempre responde HTTP 200**, inclusive em erro. O sucesso deve ser verificado pelo campo `ok`.

```ts
type Resposta<T> =
  | { ok: true;  dados: T }
  | { ok: false; erro: string };   // mensagem em português, pode ser exibida ao usuário
```

---

## 4. Rotas

### 4.1 `GET ?acao=carteira` — Posições consolidadas

```
GET {BASE_URL}?token={TOKEN}&acao=carteira
```

**Resposta `dados`:** `Posicao[]`, ordenado por `ticker` (A→Z).

```ts
type Posicao = {
  ticker: string;                  // "BVMF:PETR4"
  quantidade: number;              // ações em carteira (0 se a posição foi zerada)
  precoMedio: number;              // preço médio com taxas (0 se zerada)
  totalInvestido: number;          // quantidade × precoMedio
  lucroRealizado: number;          // lucro/prejuízo acumulado das vendas
  precoAtual: number | null;       // cotação (GOOGLEFINANCE)
  valorAtual: number | null;       // quantidade × precoAtual
  rentabilidade: number | null;    // valorAtual − totalInvestido (R$)
  rentabilidadePct: number | null; // DECIMAL: 0.125 = 12,5%
  variacaoDia: number | null;      // DECIMAL: -0.0132 = -1,32%
};
```

Exemplo:

```json
{
  "ok": true,
  "dados": [
    {
      "ticker": "BVMF:PETR4",
      "quantidade": 70,
      "precoMedio": 36.19866666666666,
      "totalInvestido": 2533.9066666666663,
      "lucroRealizado": 419.20666666666693,
      "precoAtual": 52.71,
      "valorAtual": 3689.7,
      "rentabilidade": 1155.7933333333337,
      "rentabilidadePct": 0.4561,
      "variacaoDia": -0.0085
    }
  ]
}
```

Regras de exibição:
- Campos `null` = cotação ainda carregando ou indisponível → mostrar "—" ou skeleton.
- Percentuais vêm em **decimal**: multiplicar por 100 para exibir.
- Valores sem arredondamento: formatar no cliente (`Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' })`).
- Posições com `quantidade = 0` **continuam na lista** (mostram o `lucroRealizado`). Sugestão: exibir em seção/estilo separado ("Encerradas").

---

### 4.2 `GET ?acao=lancamentos` — Histórico de compras e vendas

```
GET {BASE_URL}?token={TOKEN}&acao=lancamentos
```

**Resposta `dados`:** `Lancamento[]`, ordenado por `data` **decrescente** (mais recente primeiro).

```ts
type Lancamento = {
  id: string;          // UUID
  data: string;        // "AAAA-MM-DD"
  ticker: string;      // "BVMF:PETR4"
  tipo: 'C' | 'V';     // C = compra, V = venda
  quantidade: number;
  preco: number;       // preço unitário
  taxas: number;       // corretagem/emolumentos totais da operação
};
```

---

### 4.3 `GET ?acao=cotacao` — Informações de uma ação

```
GET {BASE_URL}?token={TOKEN}&acao=cotacao&ticker=BBDC3
```

| Parâmetro | Obrigatório | Regra |
|---|---|---|
| `ticker` | sim | sem prefixo vira `BVMF:` (`BBDC3` → `BVMF:BBDC3`). Para EUA: `NASDAQ:AAPL`. Aceita só letras, números, `.`, `-` e `:` |

Funciona para **qualquer ação**, esteja ou não na carteira.

**Resposta `dados`:** `Cotacao`

```ts
type Cotacao = {
  ticker: string;                    // "BVMF:BBDC3"
  nome: string | null;               // "Banco Bradesco SA"
  precoAtual: number;                // sempre presente (senão a rota retorna erro)
  variacao: number | null;           // variação do dia em R$
  variacaoPct: number | null;        // DECIMAL: 0.0127 = 1,27%
  abertura: number | null;
  maxDia: number | null;
  minDia: number | null;
  fechamentoAnterior: number | null;
  volume: number | null;
  max52: number | null;              // máxima 52 semanas
  min52: number | null;              // mínima 52 semanas
  valorMercado: number | null;       // geralmente null para ações da B3
  pl: number | null;                 // P/L — geralmente null para ações da B3
  lpa: number | null;                // LPA — geralmente null para ações da B3
  moeda: string | null;              // "BRL", "USD"
  ultimaNegociacao: string | null;   // ISO 8601
  posicao: Posicao | null;           // mesmo formato da rota carteira; null se não tem a ação
};
```

Comportamento:
- **Rota mais lenta: 2–8 s.** Mostrar loading; não disparar a cada tecla digitada (usar botão "Buscar" ou debounce ≥ 800 ms).
- Qualquer campo exceto `ticker` e `precoAtual` pode vir `null` → exibir "—".
- Consultas são processadas uma por vez no servidor; evitar disparar várias em paralelo.

---

### 4.4 `POST acao=adicionar` — Novo lançamento

```
POST {BASE_URL}
Content-Type: text/plain;charset=utf-8
```

Corpo:

```json
{
  "token": "...",
  "acao": "adicionar",
  "data": "2026-10-31",
  "ticker": "PETR4",
  "tipo": "C",
  "quantidade": 100,
  "preco": 35.20,
  "taxas": 4.90
}
```

| Campo | Tipo | Obrigatório | Regra |
|---|---|---|---|
| `data` | string | sim | formato `AAAA-MM-DD` |
| `ticker` | string | sim | sem prefixo vira `BVMF:` (ex.: `PETR4` → `BVMF:PETR4`). Para EUA enviar com prefixo (`NASDAQ:AAPL`) |
| `tipo` | `"C"` \| `"V"` | sim | |
| `quantidade` | number | sim | > 0 |
| `preco` | number | sim | > 0 |
| `taxas` | number | não | ≥ 0, padrão 0 |

**Resposta `dados`:** `{ "id": "uuid-gerado" }`

---

### 4.5 `POST acao=editar` — Alterar lançamento

Mesmo corpo do `adicionar` + `id`. **Substituição completa:** enviar todos os campos, não só os alterados.

```json
{
  "token": "...",
  "acao": "editar",
  "id": "uuid-do-lancamento",
  "data": "2026-10-31",
  "ticker": "BVMF:PETR4",
  "tipo": "C",
  "quantidade": 120,
  "preco": 35.20,
  "taxas": 4.90
}
```

**Resposta `dados`:** `{ "id": "uuid-do-lancamento" }`

---

### 4.6 `POST acao=excluir` — Remover lançamento

```json
{
  "token": "...",
  "acao": "excluir",
  "id": "uuid-do-lancamento"
}
```

**Resposta `dados`:** `{ "id": "uuid-do-lancamento" }`

---

## 4.7 `GET ?acao=evolucao` — Evolução do patrimônio

```
GET {BASE_URL}?token={TOKEN}&acao=evolucao&dias=90
```

| Parâmetro | Obrigatório | Regra |
|---|---|---|
| `dias` | não | janela em dias corridos; padrão 90, entre 1 e 3650 |

**Resposta `dados`:** `Snapshot[]`, ordem cronológica crescente.

```ts
type Snapshot = {
  data: string;            // "AAAA-MM-DD"
  patrimonio: number;      // soma do valor atual das posições no fechamento do dia
  valorInvestido: number;  // soma do total investido (custo) no dia
  lucroRealizado: number;  // lucro realizado acumulado até o dia
};
```

Comportamento:
- Uma **foto por dia de pregão**, tirada automaticamente às ~19h. Sem pontos em fins de semana e feriados.
- **O histórico começa no dia em que os gatilhos foram ativados**: no início a lista terá poucos pontos (ou nenhum). Exibir estado "Coletando dados — o gráfico se completa com o tempo" quando houver menos de 2 pontos.
- Lançamentos retroativos **não alteram** fotos já tiradas.
- O protótipo mostra só `patrimonio`; `valorInvestido` permite uma segunda linha opcional (a distância entre as duas é o resultado acumulado).

---

## 4.8 Acompanhamento (watchlist)

Lista de ações que o usuário acompanha **sem ter comprado**. Independente da carteira: uma ação pode estar nas duas.

### 4.8.1 `GET ?acao=acompanhamento` — Lista com cotações

```
GET {BASE_URL}?token={TOKEN}&acao=acompanhamento
```

**Resposta `dados`:** `Acompanhada[]`, na ordem em que foram adicionadas.

```ts
type Acompanhada = {
  ticker: string;               // "BVMF:BBDC3"
  adicionadoEm: string;         // "AAAA-MM-DD"
  nome: string | null;
  precoAtual: number | null;
  variacao: number | null;      // R$ no dia
  variacaoPct: number | null;   // DECIMAL: 0.0127 = 1,27%
  abertura: number | null;
  maxDia: number | null;
  minDia: number | null;
  max52: number | null;
  min52: number | null;
  volume: number | null;
  precoAlvo: number | null;        // definido pelo usuário (null só em registros antigos)
  distanciaAlvoPct: number | null; // DECIMAL: precoAlvo / precoAtual − 1
                                   //  > 0 → alvo ACIMA do preço atual (falta subir)
                                   //  < 0 → alvo ABAIXO do preço atual (falta cair)
  serie: PontoPreco[];             // minigráfico: preços do pregão atual ou do último pregão
};

type PontoPreco = {
  momento: string;   // ISO 8601 com fuso, ex.: "2026-11-03T10:05:00-03:00"
  preco: number;
};
```

Sobre `serie` (minigráfico):
- Gravada no servidor **a cada 5 min durante o pregão** (dias úteis, 10h–18h30, só se houve negociação no dia).
- Durante o pregão: pontos do dia até agora. Fora do pregão (noite, fim de semana, feriado): **último pregão completo**.
- Ordem cronológica crescente. Pode vir **vazia** (ação recém-adicionada, antes do primeiro registro) → mostrar card sem gráfico.
- Os valores vêm da GOOGLEFINANCE (atraso de até ~20 min); o traçado pode ter "degraus" (preço repetido em pontos seguidos).
- Sugestão: mostrar a data do pregão quando `serie[0].momento` não for de hoje (ex.: "Pregão de 31/10").

Sugestão de exibição: mostrar `precoAlvo` ao lado do `precoAtual` e a distância como "faltam +12,4%" / "faltam −3,1%"; destacar quando `|distanciaAlvoPct| <= 0.02` (a menos de 2% do alvo).

### 4.8.2 `POST acao=acompanhar` — Adicionar à lista

```json
{ "token": "...", "acao": "acompanhar", "ticker": "BBDC3", "precoAlvo": 18.00 }
```

| Campo | Tipo | Obrigatório | Regra |
|---|---|---|---|
| `ticker` | string | sim | mesma regra da rota `cotacao` (sem prefixo vira `BVMF:`) |
| `precoAlvo` | number | sim | > 0 |

- O servidor confirma que o ticker existe antes de salvar → **demora 2–8 s**.

**Resposta `dados`:** `{ "ticker": "BVMF:BBDC3" }`

### 4.8.3 `POST acao=alterarAlvo` — Alterar preço alvo

```json
{ "token": "...", "acao": "alterarAlvo", "ticker": "BVMF:BBDC3", "precoAlvo": 17.50 }
```

Mesmas regras de `ticker` e `precoAlvo` do `acompanhar`. Resposta rápida (não consulta cotação).

**Resposta `dados`:** `{ "ticker": "BVMF:BBDC3" }`

### 4.8.4 `POST acao=desacompanhar` — Remover da lista

```json
{ "token": "...", "acao": "desacompanhar", "ticker": "BVMF:BBDC3" }
```

**Resposta `dados`:** `{ "ticker": "BVMF:BBDC3" }`

### Atualização "em tempo real" no app

- **Não é tempo real**: cotações têm atraso de até ~20 min e a planilha recalcula no máximo a cada 1 min.
- Fazer **polling de `acompanhamento` a cada 60 s** enquanto a tela estiver visível (pausar quando a janela estiver minimizada/oculta). Intervalo menor não traz dados mais novos.
- Exibir "Atualizado às HH:MM" com o horário da última resposta.
- Após `acompanhar`/`alterarAlvo`/`desacompanhar` com sucesso, recarregar a lista imediatamente.

---

## 5. Erros possíveis (`ok: false`)

| `erro` | Causa |
|---|---|
| `não autorizado` | token ausente ou errado |
| `ação inválida` | `acao` desconhecida |
| `ticker obrigatório` | |
| `ticker inválido` | caracteres fora de letras, números, `.`, `-`, `:` |
| `ação {TICKER} não encontrada` | rotas `cotacao` e `acompanhar`: ticker inexistente ou cotação indisponível no momento |
| `{TICKER} já está em acompanhamento` | `acompanhar` com ticker já na lista |
| `{TICKER} não está em acompanhamento` | `desacompanhar` / `alterarAlvo` com ticker fora da lista |
| `preço alvo deve ser maior que zero` | `acompanhar` / `alterarAlvo` sem `precoAlvo` ou com valor ≤ 0 |
| `tipo deve ser C ou V` | |
| `data deve estar no formato AAAA-MM-DD` | |
| `quantidade deve ser maior que zero` | |
| `preço deve ser maior que zero` | |
| `taxas não podem ser negativas` | |
| `venda maior que a quantidade em carteira de {TICKER}` | venda a descoberto em algum ponto da linha do tempo — inclui editar/excluir uma compra antiga que deixaria uma venda posterior sem saldo |
| `lançamento não encontrado` | `id` inexistente em editar/excluir |

Além desses, tratar falha de rede/timeout como erro genérico.

---

## 6. Regras de negócio (já aplicadas no servidor)

- **Preço médio** segue a regra da Receita Federal:
  - Compra: `novoPM = (qtd × PM + qtdCompra × preço + taxas) / (qtd + qtdCompra)`
  - Venda: **não altera o PM**; `lucroRealizado += qtdVenda × preço − taxas − qtdVenda × PM`
  - Posição zerada: PM volta a 0; próxima compra recomeça a média.
- Lançamentos são processados em **ordem de data** (mesma data → ordem de inserção). Lançar uma operação retroativa é permitido.
- Toda escrita (adicionar/editar/excluir) recalcula a carteira automaticamente.
- O cliente **não deve recalcular** preço médio nem rentabilidade: sempre usar o que vem da rota `carteira`.

## 7. Comportamento e limites

- **Latência:** 1–3 s por chamada (normal no Apps Script). Mostrar estado de carregamento.
- **Cotação após escrita:** logo depois de um POST as fórmulas são regravadas e `precoAtual` (e derivados) pode vir `null` por alguns segundos. Fluxo recomendado: após POST com sucesso, recarregar `carteira` e, se houver `null`, tentar de novo após ~3 s (máx. 3 tentativas).
- **Cotações** têm atraso de até ~20 min (GOOGLEFINANCE). Atualização automática sugerida: a cada 60 s, sem necessidade de intervalo menor.
- **POST e redirect:** o Apps Script responde o POST com um redirect 302 para `script.googleusercontent.com`. O `fetch` do Node/Electron (main) segue automaticamente — manter `redirect: 'follow'` (padrão). O JSON final vem da URL redirecionada.
- **Content-Type `text/plain`** no POST: obrigatório se a chamada partir do renderer (evita preflight CORS, que o Apps Script não suporta). No processo main não há CORS, mas manter igual não atrapalha.
- Sem paginação: as rotas retornam tudo.

## 8. Exemplo de cliente (processo main do Electron)

```ts
const API_URL = process.env.API_URL!;
const API_TOKEN = process.env.API_TOKEN!;

async function chamar<T>(res: Response): Promise<T> {
  const json = await res.json();
  if (!json.ok) throw new Error(json.erro);
  return json.dados as T;
}

export const api = {
  carteira: () =>
    fetch(`${API_URL}?token=${encodeURIComponent(API_TOKEN)}&acao=carteira`)
      .then(r => chamar<Posicao[]>(r)),

  lancamentos: () =>
    fetch(`${API_URL}?token=${encodeURIComponent(API_TOKEN)}&acao=lancamentos`)
      .then(r => chamar<Lancamento[]>(r)),

  cotacao: (ticker: string) =>
    fetch(`${API_URL}?token=${encodeURIComponent(API_TOKEN)}&acao=cotacao&ticker=${encodeURIComponent(ticker)}`)
      .then(r => chamar<Cotacao>(r)),

  evolucao: (dias = 90) =>
    fetch(`${API_URL}?token=${encodeURIComponent(API_TOKEN)}&acao=evolucao&dias=${dias}`)
      .then(r => chamar<Snapshot[]>(r)),

  acompanhamento: () =>
    fetch(`${API_URL}?token=${encodeURIComponent(API_TOKEN)}&acao=acompanhamento`)
      .then(r => chamar<Acompanhada[]>(r)),

  enviar: (acao: 'adicionar' | 'editar' | 'excluir' | 'acompanhar' | 'alterarAlvo' | 'desacompanhar', dados: object) =>
    fetch(API_URL, {
      method: 'POST',
      headers: { 'Content-Type': 'text/plain;charset=utf-8' },
      body: JSON.stringify({ token: API_TOKEN, acao, ...dados }),
    }).then(r => chamar<{ id?: string; ticker?: string }>(r)),
};
```

Expor ao React via `ipcMain.handle('api:carteira', ...)` etc. e `contextBridge.exposeInMainWorld('api', {...})` no preload.
