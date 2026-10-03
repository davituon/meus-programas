// Exemplo GENÉRICO do planejador para a versão publicada na internet. Todos os valores são inventados.
// Carregado antes de comum.js (só na versão publicada); sem este arquivo, o planejador usa o exemplo registrado em comum.js.
window.PLANO_EXEMPLO = {
  receitas: [
    { nome: "Salário Bruto", valor: 5000 },
    { nome: "Adicional", valor: 500 }
  ],
  extras: [
    { nome: "Hora Extra", valor: 300 },
    { nome: "Sobreaviso", valor: 200 }
  ],
  unicas: [
    { nome: "13º Salário", mes: 2, valor: 2500 },
    { nome: "Bônus", mes: 3, valor: 3000 },
    { nome: "Bônus", mes: 7, valor: 3000 },
    { nome: "13º Salário", mes: 12, valor: 2500 }
  ],
  folha: [
    { nome: "INSS", valor: 550 },
    { nome: "Imposto de Renda", valor: 400 },
    { nome: "Contribuição Sindical", valor: 25 },
    { nome: "Previdência (básica)", valor: 150, prev: true },
    { nome: "Previdência (adicional)", valor: 100, prev: true },
    { nome: "Plano Odontológico", valor: 30 },
    { nome: "Vale Refeição", valor: 20 }
  ],
  reservas: [
    { nome: "Dízimo", pct: 10, aporte: false },
    { nome: "Oferta", pct: 3, aporte: true },
    { nome: "Poupança", pct: 3, aporte: true },
    { nome: "Investimento", pct: 3, aporte: true },
    { nome: "Meu", pct: 1, aporte: true }
  ],
  despesas: [
    { nome: "Energia", valor: 200, ate: "" },
    { nome: "Condomínio", valor: 400, ate: "" },
    { nome: "Garagem", valor: 100, ate: "" },
    { nome: "Plano de Saúde", valor: 350, ate: "" },
    { nome: "Internet / Telefone", valor: 150, ate: "" },
    { nome: "Celulares (linhas)", valor: 120, ate: "" },
    { nome: "Academia", valor: 90, ate: "" },
    { nome: "Consórcio 1", valor: 500, ate: "2041-02", reaj: 5, cota: { carta: 100000, pago: 0, contemplacao: "" } },
    { nome: "Consórcio 2", valor: 400, ate: "2041-02", reaj: 5, cota: { carta: 80000, pago: 0, contemplacao: "" } },
    { nome: "Consórcio 3", valor: 300, ate: "2038-06", reaj: 5, cota: { carta: 60000, pago: 0, contemplacao: "" } },
    { nome: "Consórcio 4", valor: 250, ate: "2038-06", reaj: 5, cota: { carta: 50000, pago: 0, contemplacao: "" } },
    { nome: "Seguro do Carro", valor: 150, ate: "", reaj: 5 },
    { nome: "IPVA (parcela)", valor: 250, ate: "2050-03", reaj: 5 },
    { nome: "Combustível", valor: 400, ate: "" },
    { nome: "Mercado / Alimentação", valor: 1200, ate: "" },
    { nome: "Farmácia / Saúde", valor: 100, ate: "" },
    { nome: "Compras Pessoais / Lazer", valor: 300, ate: "" },
    { nome: "Filhos (mesada / educação)", valor: 200, ate: "" }
  ],
  reembolsos: [
    { nome: "Reembolso 1", valor: 500, ate: "2026-11" },
    { nome: "Reembolso 2", valor: 300, ate: "2027-02" },
    { nome: "Reembolso 3", valor: 200, ate: "2027-03" },
    { nome: "Reembolso 4", valor: 100, ate: "2027-07" }
  ],
  reajuste: { inflacao: 5, receitas: 5, folha: 5, despesas: 8, reembolsos: 5, modo: "real" },
  aportes: {
    xp: { saldo: 10000, retorno: 10 },
    prev: { saldo: 5000, retorno: 10, empresa: 0 }
  },
  aposentadoria: { idade: 40, aposentar: 62, inss_idade: 65, ate_idade: 90, gasto: 5000, inss: 3500, retorno: 5, consorcios: true },
  patrimonio: {
    bens: [
      { nome: "Imóvel", tipo: "imovel", valor: 150000 },
      { nome: "Carro", tipo: "veiculo", valor: 40000 }
    ],
    dividas: []
  },
  carteira: null,
  cartao: {
    cartoes: [
      { id: "cartao1", nome: "Cartão 1", banco: "Banco A" },
      { id: "cartao2", nome: "Cartão 2", banco: "Banco A" },
      { id: "cartao3", nome: "Cartão 3", banco: "Banco A" },
      { id: "cartao4", nome: "Cartão 4", banco: "Banco B" }
    ],
    filtro: "todos",
    somar: true,
    compras: []
  },
  ref: { ano: 2026, mes: 10 }
};
