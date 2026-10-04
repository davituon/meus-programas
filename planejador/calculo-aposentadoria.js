// Cálculo da aposentadoria. Carregue depois de comum.js; as funções ficam em Plano.aposentadoria.
//
// Tudo em REAIS DE HOJE (a série de aportes é calculada nesse modo, qualquer que seja a escolha na tela).
//  - capital necessário na data da aposentadoria = valor presente, nessa data, de:
//      ponte  : gasto mensal da aposentadoria até o INSS começar;
//      pós-INSS: (gasto − INSS) mensal do INSS até a idade final;
//      consórcio: parcelas de cotas que ainda estiverem sendo pagas depois de aposentar (opcional);
//    com retirada no início de cada mês e o retorno real da fase de aposentadoria;
//  - patrimônio projetado = saldo da corretora XP + previdência no mês anterior à aposentadoria, menos o imposto estimado,
//    menos o déficit acumulado do orçamento (dinheiro que faltou para fechar as contas);
//  - aporte extra = pagamento mensal constante (fim do mês), rendendo como a corretora XP, que cobre o que falta.
//
// Cenários: a mesma conta com os retornos da corretora, da previdência e da aposentadoria 'variacao' pontos abaixo (pessimista) e acima
// (otimista). Os retornos são constantes ano a ano: é um teste de estresse, não uma previsão (não mostra o risco de uma queda perto da data).
//
// Impostos e custos são OPCIONAIS (padrão 0, que repete a conta bruta de antes):
//  - imposto: alíquota efetiva média (%) sobre o saldo da corretora e da previdência, descontada quando o dinheiro é resgatado;
//  - custo: taxas de administração e custódia, em pontos percentuais ao ano tirados do retorno de todo o acúmulo.
(function (P) {
  "use strict";

  function taxaMensal(realAnualPct) { return Math.pow(1 + (Number(realAnualPct) || 0) / 100, 1 / 12) - 1; }

  /** Valor presente de `n` retiradas de `pmt`, feitas no início de cada mês. */
  function vpInicio(taxa, n, pmt) {
    if (n <= 0 || pmt <= 0) return 0;
    if (taxa === 0) return pmt * n;
    return pmt * (1 - Math.pow(1 + taxa, -n)) / taxa * (1 + taxa);
  }

  /** Pagamento mensal constante (no fim do mês) que forma `alvo` em `n` meses. */
  function pagamentoPara(taxa, n, alvo) {
    if (alvo <= 0 || n <= 0) return 0;
    if (taxa === 0) return alvo / n;
    return alvo * taxa / (Math.pow(1 + taxa, n) - 1);
  }

  var indiceBase = function () { return P.INICIO.ano * 12 + P.INICIO.mes - 1; }; // primeiro mês do plano (out/2026): a idade atual vale nesse mês
  var mesDe = function (idx) { return { ano: Math.floor(idx / 12), mes: idx % 12 + 1 }; };

  function padrao() { return P.copiar(P.EXEMPLO.aposentadoria); }

  var num = function (v) { return Number(v) || 0; };
  /** Série de aportes com os custos das premissas, sempre em reais de hoje. */
  function serieDe(ap) { return P.emReais(function () { return P.serieAportes({ custo: num(ap.custo) }); }); }
  /** Fração do saldo que sobra depois do imposto estimado. */
  function liquidoDe(ap) { return 1 - num(ap.imposto) / 100; }

  /** Devolve uma lista de problemas das premissas (vazia se estiver tudo certo). */
  function validar(ap) {
    var e = [], n = function (v) { return Number(v); };
    [["idade", "Idade atual"], ["aposentar", "Idade de aposentadoria"], ["inss_idade", "Idade do INSS"], ["ate_idade", "Planejar até a idade"]].forEach(function (c) {
      if (!isFinite(n(ap[c[0]])) || n(ap[c[0]]) < 18 || n(ap[c[0]]) > 110) e.push(c[1] + " deve estar entre 18 e 110 anos.");
    });
    if (n(ap.aposentar) <= n(ap.idade)) e.push("A idade de aposentadoria precisa ser maior que a idade atual.");
    if (n(ap.ate_idade) <= n(ap.aposentar)) e.push("O plano precisa ir até uma idade maior que a de aposentadoria.");
    if (!(n(ap.gasto) >= 0) || !(n(ap.inss) >= 0)) e.push("Gasto e INSS não podem ser negativos.");
    if (!isFinite(n(ap.retorno)) || n(ap.retorno) < -5 || n(ap.retorno) > 30) e.push("O retorno real deve estar entre −5% e 30% ao ano.");
    if (ap.var_cenarios !== undefined && ap.var_cenarios !== "" && (!isFinite(n(ap.var_cenarios)) || n(ap.var_cenarios) < 0 || n(ap.var_cenarios) > 10)) e.push("A variação dos cenários deve estar entre 0 e 10 pontos.");
    if (ap.imposto !== undefined && ap.imposto !== "" && (!isFinite(n(ap.imposto)) || n(ap.imposto) < 0 || n(ap.imposto) > 60)) e.push("O imposto médio deve estar entre 0% e 60%.");
    if (ap.custo !== undefined && ap.custo !== "" && (!isFinite(n(ap.custo)) || n(ap.custo) < 0 || n(ap.custo) > 5)) e.push("Os custos devem estar entre 0 e 5 pontos percentuais ao ano.");
    return e;
  }

  /** Parcelas de cotas de consórcio ainda a pagar depois da aposentadoria, em valor presente na data de aposentar. */
  function vpConsorcios(retIdx, taxa, horizonteIdx) {
    var cotas = P.estado.dados.despesas.filter(function (d) { return d.cota; }), total = 0, m;
    cotas.forEach(function (d) {
      for (m = retIdx; m <= horizonteIdx; m++) {
        var t = mesDe(m);
        if (!P.ativo(d, t.ano, t.mes)) { if (d.ate && m > P.indiceDe(d.ate)) break; continue; }
        total += (Number(d.valor) || 0) * P.fator(P.taxaDoItem("despesas", d), t.ano) / Math.pow(1 + taxa, m - retIdx);
      }
    });
    return total;
  }

  /** Calcula tudo para as premissas `ap` (padrão: as salvas). `serie` evita recalcular a série quando se testam vários cenários. */
  function calcular(ap, serie) {
    ap = ap || P.estado.dados.aposentadoria;
    var erros = validar(ap);
    if (erros.length) return { erros: erros };
    return P.emReais(function () {
      var S = serie || serieDe(ap), d0 = P.estado.dados;
      var n = (ap.aposentar - ap.idade) * 12, retIdx = indiceBase() + n, antes = mesDe(retIdx - 1);
      var linha = P.linhaDoMes(S, antes.ano, antes.mes);
      if (!linha) return { erros: ["A projeção de aportes só vai até dez/" + (P.ANO_INICIAL + P.ANOS - 1) + " e nesta idade de aposentadoria ela não alcança. Escolha uma idade menor."] };

      var rm = taxaMensal(ap.retorno);
      var ponteM = Math.max(0, (ap.inss_idade - ap.aposentar) * 12);
      var posM = (ap.ate_idade - Math.max(ap.aposentar, ap.inss_idade)) * 12;
      var ponte = vpInicio(rm, ponteM, Number(ap.gasto) || 0);
      var pos = vpInicio(rm, posM, Math.max(0, (Number(ap.gasto) || 0) - (Number(ap.inss) || 0))) / Math.pow(1 + rm, ponteM);
      var horizonteIdx = indiceBase() + (ap.ate_idade - ap.idade) * 12;
      var consorcios = ap.consorcios ? vpConsorcios(retIdx, rm, horizonteIdx) : 0;
      var necessario = ponte + pos + consorcios;

      var contas = linha.saldoXP + linha.saldoPrev, deficit = linha.deficit, liquido = liquidoDe(ap);
      var imposto = Math.max(0, contas) * (1 - liquido), patrimonio = contas - imposto - deficit;
      var falta = necessario - patrimonio;
      var realXP = (Math.pow((1 + P.pctSeguro(P.pctSeguro(d0.aportes.xp.retorno) - num(ap.custo)) / 100) / (1 + P.pctSeguro(d0.reajuste.inflacao) / 100), 1 / 12) - 1);
      // o aporte extra também paga imposto no resgate: para sobrar `falta` depois do imposto, precisa acumular falta / (1 - imposto)
      var extra = falta > 0 && liquido > 0 ? pagamentoPara(realXP, n, falta / liquido) : 0;
      return {
        erros: [], ap: ap, meses: n, dataAposentar: mesDe(retIdx), linha: linha,
        ponte: ponte, pos: pos, consorcios: consorcios, necessario: necessario,
        xp: linha.saldoXP, prev: linha.saldoPrev, deficit: deficit, contas: contas, imposto: imposto, patrimonioBruto: contas - deficit, patrimonio: patrimonio,
        falta: falta, pctMeta: necessario > 0 ? patrimonio / necessario : 1, extra: extra
      };
    });
  }

  /** O que acontece com o patrimônio ao longo da vida: pontos anuais (idade, saldo) e a idade em que ele acaba, se acabar. */
  function ciclo(ap, r, serie) {
    if (!r || (r.erros && r.erros.length)) return null;
    return P.emReais(function () {
      var S = serie || serieDe(ap), pontos = [], rm = taxaMensal(ap.retorno), base = indiceBase(), liq = liquidoDe(ap);
      var retIdx = base + r.meses, fimIdx = base + (ap.ate_idade - ap.idade) * 12, inssIdx = base + (ap.inss_idade - ap.idade) * 12;
      pontos.push({ idade: ap.idade, saldo: Math.max(0, S.linhas[0] ? (S.linhas[0].saldoXP + S.linhas[0].saldoPrev) * liq - S.linhas[0].deficit : 0), fase: "acumulando" });
      S.linhas.forEach(function (l) {
        var idx = l.ano * 12 + l.mes - 1;
        if (idx < retIdx && l.mes === 12) pontos.push({ idade: ap.idade + Math.floor((idx + 1 - base) / 12), saldo: (l.saldoXP + l.saldoPrev) * liq - l.deficit, fase: "acumulando" });
      });
      pontos.push({ idade: ap.aposentar, saldo: r.patrimonio, fase: "consumindo" });
      var saldo = r.patrimonio, acaba = null, m;
      for (m = retIdx; m < fimIdx; m++) {
        var t = mesDe(m), inss = m >= inssIdx ? Number(ap.inss) || 0 : 0, parcelas = 0;
        if (ap.consorcios) P.estado.dados.despesas.forEach(function (d) { if (d.cota && P.ativo(d, t.ano, t.mes)) parcelas += (Number(d.valor) || 0) * P.fator(P.taxaDoItem("despesas", d), t.ano); });
        saldo = (saldo - Math.max(0, (Number(ap.gasto) || 0) - inss) - parcelas) * (1 + rm);
        if (saldo < 0 && acaba === null) { acaba = ap.idade + Math.floor((m - base) / 12); saldo = 0; }
        if (acaba !== null) saldo = 0;
        if (m % 12 === 11 || m === fimIdx - 1) pontos.push({ idade: ap.idade + Math.floor((m + 1 - base) / 12), saldo: Math.max(0, saldo), fase: "consumindo" });
      }
      return { pontos: pontos, acabaAos: acaba };
    });
  }

  /** Mesma conta para outras idades de aposentadoria (uma linha por idade possível). */
  function porIdade(ap, idades) {
    var S = serieDe(ap), linhas = [];
    idades.forEach(function (idade) {
      if (idade <= ap.idade || idade >= ap.ate_idade) return;
      var copia = P.copiar(ap); copia.aposentar = idade;
      var r = calcular(copia, S);
      if (!r.erros.length) linhas.push({ idade: idade, necessario: r.necessario, patrimonio: r.patrimonio, falta: r.falta, extra: r.extra });
    });
    return linhas;
  }

  /** Maior gasto mensal que o patrimônio projetado sustenta (busca binária); null se nem R$ 0 fecha. */
  function gastoMaximo(ap, serie) {
    var S = serie || serieDe(ap), lo = 0, hi = 100000, i;
    var cabe = function (g) { var c = P.copiar(ap); c.gasto = g; var r = calcular(c, S); return !r.erros.length && r.falta <= 0.005; };
    if (!cabe(0)) return null;
    for (i = 0; i < 40; i++) { var mid = (lo + hi) / 2; if (cabe(mid)) lo = mid; else hi = mid; }
    return lo;
  }

  /** Alavancas: o efeito de mudanças simples sobre o aporte extra mensal necessário. */
  function alavancas(ap, atual) {
    var S = serieDe(ap), out = [];
    function testa(id, titulo, detalhe, edita) {
      var c = P.copiar(ap); edita(c);
      var r = calcular(c, S);
      if (!r.erros.length) out.push({ id: id, titulo: titulo, detalhe: detalhe, extra: r.extra, falta: r.falta, ganho: atual.extra - r.extra, ganhoFalta: atual.falta - r.falta });
    }
    testa("adiar", "Adiar a aposentadoria em 1 ano", "Mais um ano de aportes e um ano a menos de gasto: aposentar aos " + (Number(ap.aposentar) + 1) + ".", function (c) { c.aposentar = Number(c.aposentar) + 1; });
    testa("gasto", "Gastar " + P.moeda(500) + " a menos por mês", "Um padrão de vida menor reduz o capital necessário.", function (c) { c.gasto = Math.max(0, Number(c.gasto) - 500); });
    testa("retorno", "Retorno real 1 ponto maior na aposentadoria", "Só ajuda se a carteira realmente comportar o risco.", function (c) { c.retorno = Number(c.retorno) + 1; });
    testa("inss", "INSS " + P.moeda(500) + " maior por mês", "Confirme o valor no Meu INSS; contribuir mais pode aumentá-lo.", function (c) { c.inss = Number(c.inss) + 500; });
    return out.sort(function (a, b) { return b.ganhoFalta - a.ganhoFalta; });
  }

  // ---------------------------------------------------------------- cenários de retorno
  var VARIACAO_PADRAO = 2;
  function variacaoDe(ap) { var v = ap.var_cenarios; return v === undefined || v === null || v === "" ? VARIACAO_PADRAO : num(v); }

  /** Roda `fn(copia)` com os retornos da corretora e da previdência `delta` pontos diferentes, sobre uma cópia; os dados originais voltam ao lugar. */
  function comRetornos(delta, fn) {
    var original = P.estado.dados, copia = P.copiar(original);
    copia.aportes.xp.retorno = num(copia.aportes.xp.retorno) + delta;
    copia.aportes.prev.retorno = num(copia.aportes.prev.retorno) + delta;
    P.estado.dados = copia;
    try { return fn(copia); } finally { P.estado.dados = original; }
  }

  /** O plano com todos os retornos `delta` pontos acima (ou abaixo, se negativo) do informado. */
  function cenario(ap, delta) {
    return comRetornos(delta, function (copia) {
      var ap2 = P.copiar(ap);
      ap2.retorno = Math.max(-5, Math.min(30, num(ap.retorno) + delta));
      var r = calcular(ap2);
      if (r.erros.length) return { erros: r.erros };
      var c = ciclo(ap2, r);
      return {
        erros: [], delta: delta, retornoXP: copia.aportes.xp.retorno, retornoPrev: copia.aportes.prev.retorno, retornoReal: ap2.retorno,
        necessario: r.necessario, patrimonio: r.patrimonio, falta: r.falta, pctMeta: r.pctMeta, extra: r.extra, acabaAos: c ? c.acabaAos : null
      };
    });
  }

  /** Pessimista (−variação), base e otimista (+variação). */
  function cenarios(ap) {
    ap = ap || P.estado.dados.aposentadoria;
    var erros = validar(ap);
    if (erros.length) return { erros: erros };
    var v = variacaoDe(ap);
    return { erros: [], variacao: v, pessimista: cenario(ap, -v), base: cenario(ap, 0), otimista: cenario(ap, v) };
  }

  /** Quantos pontos de retorno a mais (em todas as contas) fecham o plano sem aporte extra; 0 se já fecha; null se nem +15 pontos bastam. */
  function retornoParaFechar(ap) {
    ap = ap || P.estado.dados.aposentadoria;
    if (validar(ap).length) return null;
    var cabe = function (d) { return cenario(ap, d).falta <= 0.005; };
    if (cabe(0)) return 0;
    if (!cabe(15)) return null;
    var lo = 0, hi = 15, i;
    for (i = 0; i < 12; i++) { var mid = (lo + hi) / 2; if (cabe(mid)) hi = mid; else lo = mid; }
    return hi;
  }

  P.aposentadoria = {
    cenario: cenario, cenarios: cenarios, retornoParaFechar: retornoParaFechar, variacaoDe: variacaoDe,
    padrao: padrao, validar: validar, calcular: calcular, ciclo: ciclo, porIdade: porIdade, gastoMaximo: gastoMaximo, alavancas: alavancas,
    vpInicio: vpInicio, pagamentoPara: pagamentoPara, taxaMensal: taxaMensal, serieDe: serieDe
  };
})(window.Plano);
