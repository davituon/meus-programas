// Conferência do plano com o contracheque. Carregue depois de comum.js; fica em Plano.contracheque.
//
// Compara, para um mês, o que o plano espera (proventos, descontos em folha e líquido) com o que veio no contracheque, no total e item a item.
// O contracheque mostra dinheiro daquele mês, então a comparação usa sempre valores nominais (com o reajuste), qualquer que seja a escolha
// de "reais de hoje" na tela. Para os meses de 2026 (ano-base) o plano e o contracheque devem bater, a menos de itens que variam todo mês
// (horas extras, sobreaviso, imposto de renda). O que o usuário digita fica em dados.contracheques:
//   { "2026-09": { bruto: 7000, descontos: 2000, liquido: 5000, itens: { "receitas:Salário": 1234.56 } } }
(function (P) {
  "use strict";

  var num = function (v) { return Number(v) || 0; };
  var arred = function (v) { return Math.round(v * 100) / 100; };
  var GRUPOS = [["receitas", "Receitas fixas", "provento"], ["extras", "Receitas extras", "provento"], ["unicas", "Receitas de um mês só", "provento"], ["folha", "Descontos em folha", "desconto"]];
  var TOLERANCIA_ABS = 1, TOLERANCIA_PROXIMO = 0.03;

  function chaveMes(ano, mes) { return ano + "-" + (mes < 10 ? "0" : "") + mes; }

  /** Roda `fn` com os valores nominais (com reajuste) e devolve a escolha anterior da tela. */
  function emNominal(fn) {
    var r = P.estado.dados.reajuste, antes = r.modo;
    r.modo = "nominal";
    try { return fn(); } finally { r.modo = antes; }
  }

  /** Itens que o plano espera no mês, com o valor previsto: [{ chave, grupo, rotuloGrupo, tipo, nome, previsto }]. */
  function itensDoMes(ano, mes) {
    var d = P.estado.dados, out = [];
    emNominal(function () {
      GRUPOS.forEach(function (g) {
        var vistos = {};
        d[g[0]].forEach(function (x) {
          if (!P.ativo(x, ano, mes)) return;
          var previsto = num(x.valor) * P.fator(P.taxaDoItem(g[0], x), ano);
          if (previsto <= 0) return;
          var base = g[0] + ":" + (x.nome || "item"), n = (vistos[base] = (vistos[base] || 0) + 1);
          out.push({ chave: n > 1 ? base + "#" + n : base, grupo: g[0], rotuloGrupo: g[1], tipo: g[2], nome: x.nome || "item", previsto: arred(previsto) });
        });
      });
    });
    return out;
  }

  /** Totais do plano no mês: proventos, descontos em folha e líquido da folha (sem as reservas pessoais). */
  function totaisDoPlano(ano, mes) {
    return emNominal(function () {
      var c = P.calcMes(ano, mes);
      return { bruto: arred(c.r), descontos: arred(c.folha), liquido: arred(c.r - c.folha) };
    });
  }

  function ler(ano, mes) {
    var e = (P.estado.dados.contracheques || {})[chaveMes(ano, mes)];
    return e && typeof e === "object" ? e : { bruto: null, descontos: null, liquido: null, itens: {} };
  }

  function valido(v) { return v === null || v === undefined || v === "" ? null : (isFinite(Number(v)) && Number(v) >= 0 ? arred(Number(v)) : undefined); }

  /**
   * Guarda um campo do contracheque do mês. `campo`: "bruto", "descontos", "liquido" ou a chave de um item. Vazio apaga.
   * Devolve false se o valor for inválido ou o item não existir naquele mês.
   */
  function definir(ano, mes, campo, valor) {
    var d = P.estado.dados, k = chaveMes(ano, mes), v = valido(valor);
    if (v === undefined) return false;
    var principal = campo === "bruto" || campo === "descontos" || campo === "liquido";
    if (!principal && !itensDoMes(ano, mes).some(function (i) { return i.chave === campo; })) return false;
    if (!d.contracheques) d.contracheques = {};
    var e = d.contracheques[k] || (d.contracheques[k] = { bruto: null, descontos: null, liquido: null, itens: {} });
    if (principal) e[campo] = v;
    else if (v === null) delete e.itens[campo]; else e.itens[campo] = v;
    if (e.bruto === null && e.descontos === null && e.liquido === null && !Object.keys(e.itens).length) delete d.contracheques[k];
    P.salvar();
    return true;
  }

  function situacao(plano, real) {
    if (real === null) return "vazio";
    var dif = Math.abs(real - plano), rel = plano > 0 ? dif / plano : (dif > 0 ? 1 : 0);
    return dif <= Math.max(TOLERANCIA_ABS, plano * 0.005) ? "confere" : rel <= TOLERANCIA_PROXIMO ? "proximo" : "diferente";
  }

  /** Compara o plano com o que foi digitado para o mês. */
  function comparar(ano, mes) {
    var e = ler(ano, mes), plano = totaisDoPlano(ano, mes), itens = itensDoMes(ano, mes);
    var linha = function (planoV, real) { return { plano: planoV, real: real, diferenca: real === null ? null : arred(real - planoV), situacao: situacao(planoV, real) }; };
    var totais = { bruto: linha(plano.bruto, e.bruto === undefined ? null : e.bruto), descontos: linha(plano.descontos, e.descontos === undefined ? null : e.descontos), liquido: linha(plano.liquido, e.liquido === undefined ? null : e.liquido) };

    // o que foi digitado precisa fechar: proventos − descontos = líquido
    var coerencia = null;
    if (e.bruto !== null && e.descontos !== null && e.liquido !== null) {
      var dif = arred(e.bruto - e.descontos - e.liquido);
      coerencia = { diferenca: dif, ok: Math.abs(dif) <= 0.05 };
    }

    var linhasItens = itens.map(function (i) {
      var real = typeof e.itens[i.chave] === "number" ? e.itens[i.chave] : null;
      return { chave: i.chave, grupo: i.grupo, rotuloGrupo: i.rotuloGrupo, tipo: i.tipo, nome: i.nome, previsto: i.previsto, real: real, diferenca: real === null ? null : arred(real - i.previsto), situacao: situacao(i.previsto, real) };
    });
    var preenchidos = linhasItens.filter(function (i) { return i.real !== null; });
    var maior = preenchidos.slice().sort(function (a, b) { return Math.abs(b.diferenca) - Math.abs(a.diferenca); })[0] || null;
    if (maior && Math.abs(maior.diferenca) <= TOLERANCIA_ABS) maior = null;
    var somaProv = arred(preenchidos.filter(function (i) { return i.tipo === "provento"; }).reduce(function (t, i) { return t + i.real; }, 0));
    var somaDesc = arred(preenchidos.filter(function (i) { return i.tipo === "desconto"; }).reduce(function (t, i) { return t + i.real; }, 0));
    // itens do plano que o contracheque não trouxe (deixados em branco) quando os totais foram informados
    var faltando = [];
    if (preenchidos.length) faltando = linhasItens.filter(function (i) { return i.real === null; }).map(function (i) { return i.nome; });

    var informados = ["bruto", "descontos", "liquido"].filter(function (k) { return totais[k].real !== null; });
    var piores = informados.map(function (k) { return totais[k].situacao; });
    var veredito = !informados.length ? "vazio" : piores.indexOf("diferente") >= 0 ? "diferente" : piores.indexOf("proximo") >= 0 ? "proximo" : informados.length < 3 ? "parcial" : "confere";
    return { chave: chaveMes(ano, mes), totais: totais, coerencia: coerencia, itens: linhasItens, maior: maior, somaItens: { proventos: somaProv, descontos: somaDesc, qtd: preenchidos.length }, faltando: faltando, veredito: veredito };
  }

  P.contracheque = { itensDoMes: itensDoMes, totaisDoPlano: totaisDoPlano, ler: ler, definir: definir, comparar: comparar, chaveMes: chaveMes, GRUPOS: GRUPOS };
})(window.Plano);
