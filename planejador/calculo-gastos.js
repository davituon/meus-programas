// Gastos do dia a dia. Carregue depois de comum.js; fica em Plano.gastos.
//
// Lançamento rápido de um gasto ("gastei R$ 80 em mercado"), ligado a uma linha da lista de despesas do orçamento. Serve para comparar, mês a
// mês, o que foi gasto de verdade com o que foi orçado em cada linha. Cada gasto pode ser:
//   - "avulso": pago em Pix, débito ou dinheiro. Só fica registrado aqui;
//   - de um cartão: além de aqui, vira uma compra à vista na página Cartão de crédito (entra na fatura do mês), ligada ao gasto (gastoId);
//     remover o gasto remove a compra.
// A comparação usa valores nominais do mês (o que de fato se gasta), qualquer que seja a escolha de "reais de hoje" na tela.
// dados.gastos = [ { id, data, valor, linha: "d:Nome da despesa" | "outros", nota, via: "avulso" | id do cartão } ]
(function (P) {
  "use strict";

  var num = function (v) { return Number(v) || 0; };
  var arred = function (v) { return Math.round(v * 100) / 100; };
  var seq = 0;

  function novoId() { seq++; return "g" + Date.now().toString(36) + seq; }
  function dataValida(iso) {
    if (typeof iso !== "string" || !/^\d{4}-\d{2}-\d{2}$/.test(iso)) return false;
    var p = iso.split("-").map(Number), d = new Date(p[0], p[1] - 1, p[2]);
    return d.getFullYear() === p[0] && d.getMonth() === p[1] - 1 && d.getDate() === p[2];
  }
  function emNominal(fn) {
    var r = P.estado.dados.reajuste, antes = r.modo;
    r.modo = "nominal";
    try { return fn(); } finally { r.modo = antes; }
  }

  /** Linhas do orçamento que aceitam gastos no mês: despesas ativas (menos cotas de consórcio) com o valor orçado nominal. */
  function linhasDoMes(ano, mes) {
    var d = P.estado.dados, vistos = {}, out = [];
    emNominal(function () {
      d.despesas.forEach(function (x) {
        var base = "d:" + (x.nome || "despesa"), n = (vistos[base] = (vistos[base] || 0) + 1), chave = n > 1 ? base + "#" + n : base;
        if (x.cota || !P.ativo(x, ano, mes)) return;
        var orcado = num(x.valor) * P.fator(P.taxaDoItem("despesas", x), ano);
        if (orcado <= 0) return;
        out.push({ chave: chave, nome: x.nome || "despesa", orcado: arred(orcado) });
      });
    });
    return out;
  }

  function lista() {
    var d = P.estado.dados;
    if (!Array.isArray(d.gastos)) d.gastos = [];
    return d.gastos;
  }

  function nomeDoMes(g) { return g.data.slice(0, 7); }
  function chaveMes(ano, mes) { return ano + "-" + (mes < 10 ? "0" : "") + mes; }

  /** Gastos de um mês, do mais recente ao mais antigo. */
  function doMes(ano, mes) {
    var k = chaveMes(ano, mes);
    return lista().filter(function (g) { return nomeDoMes(g) === k; }).sort(function (a, b) { return a.data < b.data ? 1 : a.data > b.data ? -1 : 0; });
  }

  /** Lança um gasto. `via`: "avulso" ou o id de um cartão. Devolve null ou o texto do erro. */
  function lancar(x) {
    var d = P.estado.dados, valor = typeof x.valor === "number" ? x.valor : P.lerNumero(x.valor === undefined ? "" : x.valor);
    if (!isFinite(valor) || valor <= 0) return "Informe um valor maior que zero.";
    if (!dataValida(x.data)) return "Informe uma data válida.";
    var via = x.via || "avulso", ano = Number(x.data.slice(0, 4)), mes = Number(x.data.slice(5, 7));
    if (via !== "avulso" && !d.cartao.cartoes.some(function (c) { return c.id === via; })) return "Escolha como foi pago.";
    var linhas = linhasDoMes(ano, mes), linha = x.linha || "outros";
    if (linha !== "outros" && !linhas.some(function (l) { return l.chave === linha; })) return "Escolha a linha do orçamento (ou \"Outros\").";
    var nomeLinha = linha === "outros" ? "Outros" : linhas.filter(function (l) { return l.chave === linha; })[0].nome;
    var g = { id: novoId(), data: x.data, valor: arred(valor), linha: linha, nota: String(x.nota || "").trim().slice(0, 60), via: via };
    lista().push(g);
    if (via !== "avulso") d.cartao.compras.push({ nome: g.nota || nomeLinha, categoria: nomeLinha, valor: g.valor, tipo: "vista", inicio: x.data.slice(0, 7), cartao: via, gastoId: g.id });
    P.salvar();
    return null;
  }

  /** Remove o gasto (e a compra do cartão ligada a ele, se houver). */
  function remover(id) {
    var l = lista(), i = l.findIndex(function (g) { return g.id === id; });
    if (i < 0) return false;
    l.splice(i, 1);
    var compras = P.estado.dados.cartao.compras, j = compras.findIndex(function (c) { return c.gastoId === id; });
    if (j >= 0) compras.splice(j, 1);
    P.salvar();
    return true;
  }

  /** Orçado × gasto por linha no mês, mais "Outros" e o total. situacao: "dentro" | "perto" (90% ou mais) | "estourou" | "sem-orcado". */
  function comparar(ano, mes) {
    var linhas = linhasDoMes(ano, mes), gastos = doMes(ano, mes), porChave = {}, outros = 0;
    gastos.forEach(function (g) {
      if (linhas.some(function (l) { return l.chave === g.linha; })) porChave[g.linha] = arred((porChave[g.linha] || 0) + g.valor);
      else outros = arred(outros + g.valor);
    });
    var itens = linhas.map(function (l) {
      var gasto = porChave[l.chave] || 0, pct = gasto / l.orcado;
      return { chave: l.chave, nome: l.nome, orcado: l.orcado, gasto: gasto, saldo: arred(l.orcado - gasto), pct: pct, situacao: gasto === 0 ? "sem-gasto" : pct > 1 ? "estourou" : pct >= 0.9 ? "perto" : "dentro" };
    });
    var comGasto = itens.filter(function (i) { return i.gasto > 0; });
    var total = arred(gastos.reduce(function (t, g) { return t + g.valor; }, 0));
    return {
      itens: comGasto, semGasto: itens.filter(function (i) { return i.gasto === 0; }), outros: outros, total: total, qtd: gastos.length,
      noCartao: arred(gastos.filter(function (g) { return g.via !== "avulso"; }).reduce(function (t, g) { return t + g.valor; }, 0)),
      orcadoDasLinhasComGasto: arred(comGasto.reduce(function (t, i) { return t + i.orcado; }, 0)), estouros: comGasto.filter(function (i) { return i.situacao === "estourou"; }).length
    };
  }

  P.gastos = { linhasDoMes: linhasDoMes, doMes: doMes, lancar: lancar, remover: remover, comparar: comparar, dataValida: dataValida };
})(window.Plano);
