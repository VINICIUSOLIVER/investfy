---
name: ui-patterns
description: Convenções de interface do Investfy (React + Tailwind). Use ao criar ou alterar uma tela, modal, formulário, tabela, KPI ou gráfico.
---

# Convenções de interface

Protótipos de referência: `examples/img*.png` (tema claro, sem modo escuro). São guia visual; os dados reais seguem `examples/api-carteira.md`.

## Regras do produto

- **Toda exclusão pede confirmação** com `ConfirmDialog`, inclusive remover do monitoramento. A mensagem diz o que será removido.
- **Preço-alvo é obrigatório** e o status (atingido = preço atual ≤ alvo; próximo = a ≤ 2%) é calculado no frontend (`statusAlvo` em `MonitoramentoPage.jsx`).
- **Mensagens de erro da API** (já em português) são exibidas como chegam, inline no formulário ou em toast.
- **Busca de ação** é a modal global da topbar (Ctrl+K); o filtro da página Lançamentos chama-se "Filtrar por ação", para não confundir com ela.

## Componentes

Reaproveite os primitivos de `src/components/ui/index.jsx` antes de criar outro.

- `Modal` usa `<dialog>` nativo (foco preso, Esc, backdrop). O conteúdo só monta quando aberto, então formulários começam limpos. O campo que recebe foco leva `data-autofocus`; a largura vem pela prop `width`; `busy` impede fechar durante um envio.
- Modais globais (novo lançamento, busca) abrem por `useShell()` (`openLancamento(prefill)`, `openSearch(ticker)`); a navegação também (`navigate`). Página nova entra em `PAGES` no `AppShell.jsx`, que a envolve num `ErrorBoundary`.
- Feedback de ação: `useToast()` (`success`/`error`). Carregamento: `Skeleton`. Falha de consulta: `ErrorState` com `onRetry`. Lista vazia: `EmptyState`.
- `UpdatedAt` mostra "Atualizado às HH:MM" de uma query.

## Dados e formatação

- Formate **só** com `src/lib/format.js`: `money(v, moeda)` usa a moeda do dado (`US$` para NASDAQ); `pct` recebe **decimal** (0,125 → 12,50%); `dateBR`/`dayMonth` fatiam a string sem `Date` (evita deslocar o dia pelo fuso); `todayISO` é a data local.
- Campo numérico: `type="text" inputMode="decimal"` + `parseDecimal`, que aceita `1.234,56`, `35,2` e `35.20`.
- `null` vindo da API significa cotação carregando ou indisponível: mostre `Skeleton` ou "—" (`DASH`).
- Ticker: exiba com `TickerCell`/`symbol()` (esconde `BVMF:`, mantém outras bolsas); compare com `fullTicker()`; envie normalizado (`normalizeTicker`).
- O locale do Chromium é forçado para pt-BR no main (`app.commandLine.appendSwitch('lang', 'pt-BR')`); é ele que define o formato dd/mm/aaaa do `<input type="date">`.

## Gráficos

SVG feito à mão em `src/components/charts/` (sem biblioteca: mantém o bundle leve).

- Paleta categórica em `shared.js` (`SERIES_COLORS`), validada para daltonismo. A cor segue a **entidade** (índice alfabético do ticker), nunca o ranking. Acima de 8 séries, o excedente vira "Outros". Mudou a paleta? Rode de novo o validador da skill `dataviz`.
- Todo gráfico tem tooltip no hover. Com 2 ou mais séries há legenda; o eixo é um só.
- Menos de 2 pontos na evolução: estado "Coletando dados", não um gráfico vazio.

## Acessibilidade e testes

Atributos semânticos (`aria-label`, `aria-keyshortcuts`, `role`, `id` + `label`) servem também de seletor para o harness. Prefira-os a `data-testid`. Depois de mudar uma tela, verifique com a skill `harness`.
