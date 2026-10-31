/**
 * Dados iniciais do mock. Determinísticos (sem Math.random) para que
 * screenshots e asserções sejam estáveis entre execuções.
 */
const crypto = require('node:crypto');

const NOMES = {
  'BVMF:PETR4': 'Petrobras PN',
  'BVMF:VALE3': 'Vale ON',
  'BVMF:WEGE3': 'WEG ON',
  'BVMF:ITUB4': 'Itaú Unibanco PN',
  'BVMF:MGLU3': 'Magazine Luiza ON',
  'BVMF:BBAS3': 'Banco do Brasil ON',
  'BVMF:BBDC3': 'Banco Bradesco SA',
  'BVMF:ALOS3': 'Allos ON',
  'NASDAQ:AAPL': 'Apple Inc',
};

/** [precoAtual, variacaoDia (decimal), moeda] */
const PRECOS = {
  'BVMF:PETR4': [52.71, -0.0085, 'BRL'],
  'BVMF:VALE3': [58.88, 0.0142, 'BRL'],
  'BVMF:WEGE3': [32.88, 0.0142, 'BRL'],
  'BVMF:ITUB4': [36.1, 0.0072, 'BRL'],
  'BVMF:MGLU3': [9.77, 0.0072, 'BRL'],
  'BVMF:BBAS3': [21.51, 0.0113, 'BRL'],
  'BVMF:BBDC3': [14.2, -0.004, 'BRL'],
  'BVMF:ALOS3': [21.37, 0.0121, 'BRL'],
  'NASDAQ:AAPL': [227.5, 0.0051, 'USD'],
};

function lancamentos() {
  return [
    { data: '2026-02-01', ticker: 'BVMF:MGLU3', tipo: 'C', quantidade: 10, preco: 10, taxas: 0 },
    { data: '2026-02-20', ticker: 'BVMF:MGLU3', tipo: 'V', quantidade: 10, preco: 12, taxas: 0 },
    { data: '2026-03-10', ticker: 'BVMF:PETR4', tipo: 'C', quantidade: 100, preco: 36.2, taxas: 4.9 },
    { data: '2026-04-02', ticker: 'BVMF:ITUB4', tipo: 'C', quantidade: 80, preco: 33.5, taxas: 4.9 },
    { data: '2026-05-15', ticker: 'BVMF:WEGE3', tipo: 'C', quantidade: 40, preco: 41.8, taxas: 4.9 },
    { data: '2026-06-20', ticker: 'BVMF:VALE3', tipo: 'C', quantidade: 50, preco: 62.1, taxas: 4.9 },
    { data: '2026-08-12', ticker: 'BVMF:PETR4', tipo: 'V', quantidade: 30, preco: 39.4, taxas: 4.9 },
  ].map((l) => ({ id: crypto.randomUUID(), ...l }));
}

function acompanhamento() {
  return [
    { ticker: 'BVMF:BBAS3', adicionadoEm: '2026-10-01', precoAlvo: 26 }, // atingido (preço ≤ alvo)
    { ticker: 'BVMF:MGLU3', adicionadoEm: '2026-10-02', precoAlvo: 9.6 }, // próximo (< 2%)
    { ticker: 'BVMF:BBDC3', adicionadoEm: '2026-10-03', precoAlvo: 12 }, // longe; sem série
  ];
}

function createState() {
  return {
    lancamentos: lancamentos(),
    acompanhamento: acompanhamento(),
    precos: structuredClone(PRECOS),
    nomes: { ...NOMES },
    // Tickers cuja próxima resposta de `carteira` vem com cotação null
    // (simula a planilha recalculando logo após uma escrita — seção 7 da spec)
    cotacaoPendente: new Set(),
  };
}

module.exports = { createState };
