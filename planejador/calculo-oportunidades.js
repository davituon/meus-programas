// Oportunidades: simula mudanças nos SEUS dados (sobre uma cópia, sem alterar nada) para achar onde vale mais a pena
// reduzir gastos ou aumentar ganhos. Carregue depois de comum.js e calculo-aposentadoria.js; fica em Plano.oportunidades.
//
// Tudo em reais de hoje. Cada alavanca é medida sozinha por dois efeitos:
//   ganhoMensal : quanto melhora o resultado médio por mês (próximos 12 meses a partir do mês analisado);
//   ganhoFalta  : quanto diminui o que falta para a aposentadoria (capital necessário − patrimônio projetado).
// Impostos sobre renda extra e resgates não são modelados.
(function (P) {
  "use strict";

  var num = function (v) { return Number(v) || 0; };
  var PCT_REDUCAO = 0.2;     // corte testado em cada despesa
  var RENDA_EXTRA = 500;     // renda extra mensal testada
  var CORTE_CARTAO = 0.3;    // corte testado nos gastos recorrentes do cartão

  /** Resultado médio, meses no vermelho, zeragem da XP e aposentadoria dos dados que estiverem em P.estado.dados agora. */
  function medir() {
    var d = P.estado.dados, ref = d.ref, base = ref.ano * 12 + ref.mes - 1;
    return P.emReais(function () {
      var soma = 0, vermelho = 0, i, c;
      for (i = 0; i < 12; i++) { c = P.calcMes(Math.floor((base + i) / 12), (base + i) % 12 + 1); soma += c.sobra; if (c.sobra < 0) vermelho++; }
      var S = P.serieAportes(), ap = P.aposentadoria.calcular(d.aposentadoria), ok = !(ap.erros && ap.erros.length);
      return {
        sobra12: soma / 12, vermelho: vermelho, zera: S.primeiroZero || null,
        falta: ok ? ap.falta : null, pctMeta: ok ? ap.pctMeta : null, extra: ok ? ap.extra : null, necessario: ok ? ap.necessario : null
      };
    });
  }

  /** Mede um cenário: aplica `edicao` a uma cópia dos dados, mede e devolve os dados originais ao lugar (mesmo se der erro). */
  function cenario(edicoes) {
    var copia = P.copiar(P.estado.dados), original = P.estado.dados;
    (Array.isArray(edicoes) ? edicoes : [edicoes]).forEach(function (e) { e(copia); });
    P.estado.dados = copia;
    try { return medir(); } finally { P.estado.dados = original; }
  }

  function comparar(base, cen) {
    return {
      ganhoMensal: cen.sobra12 - base.sobra12,
      ganhoFalta: base.falta === null || cen.falta === null ? 0 : base.falta - cen.falta,
      pctMeta: cen.pctMeta, zera: cen.zera, vermelho: cen.vermelho, sobra12: cen.sobra12, falta: cen.falta
    };
  }

  function alavancasDeGasto(d) {
    var out = [], fmt = P.moeda;
    d.despesas.map(function (x, i) { return { x: x, i: i }; })
      .filter(function (o) { return !o.x.cota && num(o.x.valor) > 0; })
      .sort(function (a, b) { return num(b.x.valor) - num(a.x.valor); }).slice(0, 6)
      .forEach(function (o) {
        var edit = function (c) { c.despesas[o.i].valor = num(c.despesas[o.i].valor) * (1 - PCT_REDUCAO); };
        out.push({ id: "reduzir-" + o.i, grupo: "gastos", titulo: "Reduzir \"" + (o.x.nome || "despesa") + "\" em " + Math.round(PCT_REDUCAO * 100) + "%",
          detalhe: "Economiza " + fmt(num(o.x.valor) * PCT_REDUCAO) + " por mês, em valores de hoje (e mais com o passar dos anos, pelo reajuste).", edit: edit });
      });
    if (num(d.reajuste.despesas) > num(d.reajuste.inflacao)) {
      out.push({ id: "despesas-inflacao", grupo: "gastos", risco: false,
        titulo: "Fazer as despesas subirem só pela inflação (" + d.reajuste.inflacao + "% em vez de " + d.reajuste.despesas + "%)",
        detalhe: "Hoje o grupo Despesas é reajustado " + (num(d.reajuste.despesas) - num(d.reajuste.inflacao)) + " ponto(s) acima da inflação por ano: o custo de vida cresce em termos reais. Manter o padrão de consumo é a meta.",
        edit: function (c) { c.reajuste.despesas = num(c.reajuste.inflacao); } });
    }
    var rec = d.cartao.compras.filter(function (c) { return c.tipo === "recorrente" && num(c.valor) > 0; });
    if (rec.length) {
      var soma = rec.reduce(function (t, c) { return t + num(c.valor); }, 0);
      out.push({ id: "cartao-recorrentes", grupo: "gastos",
        titulo: "Cortar " + Math.round(CORTE_CARTAO * 100) + "% dos gastos que se repetem todo mês no cartão",
        detalhe: "São " + rec.length + " lançamento(s) somando " + fmt(soma) + " por mês (assinaturas, mercado…). Revise o que realmente é usado.",
        edit: function (c) { c.cartao.compras.forEach(function (x) { if (x.tipo === "recorrente") x.valor = num(x.valor) * (1 - CORTE_CARTAO); }); } });
    }
    return out;
  }

  function alavancasDeGanho(d) {
    var out = [], fmt = P.moeda, extras = d.extras.reduce(function (t, x) { return t + num(x.valor); }, 0);
    out.push({ id: "renda-extra", grupo: "ganhos", titulo: "Gerar " + fmt(RENDA_EXTRA) + " por mês de renda extra",
      detalhe: "Entra na receita total, que paga as reservas (cerca de " + Math.round(P.pctReservas()) + "%) e vira resultado. Impostos sobre essa renda não estão modelados.",
      edit: function (c) { c.extras.push({ nome: "Renda extra simulada", valor: RENDA_EXTRA }); } });
    if (num(d.reajuste.receitas) <= num(d.reajuste.inflacao) + 0.001) {
      out.push({ id: "reajuste-receitas", grupo: "ganhos", titulo: "Conseguir reajustes 2 pontos acima da inflação nas receitas",
        detalhe: "Hoje as receitas sobem " + d.reajuste.receitas + "% ao ano, o mesmo da inflação: o poder de compra do salário não cresce. Promoção, mudança de cargo ou negociação mudam isso.",
        edit: function (c) { c.reajuste.receitas = num(c.reajuste.receitas) + 2; } });
    }
    if (extras > 0) {
      out.push({ id: "extras-mais", grupo: "ganhos", titulo: "Aumentar em 20% as receitas extras (sobreaviso, horas extras…)",
        detalhe: "Hoje as receitas extras recorrentes somam " + fmt(extras) + " por mês; 20% a mais são " + fmt(extras * 0.2) + ".",
        edit: function (c) { c.extras.forEach(function (x) { x.valor = num(x.valor) * 1.2; }); } });
    }
    out.push({ id: "retorno-xp", grupo: "ganhos", risco: true, titulo: "Retorno da corretora 1 ponto maior",
      detalhe: "Só é alavanca se a carteira realmente comportar mais risco; não é garantido e pode ir no sentido oposto.",
      edit: function (c) { c.aportes.xp.retorno = num(c.aportes.xp.retorno) + 1; } });
    return out;
  }

  function alavancasDeAposentadoria(d) {
    var fmt = P.moeda, a = d.aposentadoria;
    return [
      { id: "adiar", grupo: "aposentadoria", titulo: "Adiar a aposentadoria em 1 ano (aos " + (num(a.aposentar) + 1) + ")", detalhe: "Mais um ano de aportes e um ano a menos de gasto.", edit: function (c) { c.aposentadoria.aposentar = num(c.aposentadoria.aposentar) + 1; } },
      { id: "gasto-apos", grupo: "aposentadoria", titulo: "Planejar gastar " + fmt(500) + " a menos por mês na aposentadoria", detalhe: "Um padrão de vida menor reduz o capital necessário.", edit: function (c) { c.aposentadoria.gasto = Math.max(0, num(c.aposentadoria.gasto) - 500); } },
      { id: "inss", grupo: "aposentadoria", titulo: "INSS " + fmt(500) + " maior por mês", detalhe: "Confira o valor no Meu INSS; contribuir mais pode aumentá-lo.", edit: function (c) { c.aposentadoria.inss = num(c.aposentadoria.inss) + 500; } }
    ];
  }

  /** Fatos sobre a estrutura do plano que ajudam a decidir (não são simulações). */
  function estruturais(d) {
    var out = [], fmt = P.moeda, ref = d.ref;
    P.emReais(function () {
      // 1. o reembolso acaba
      var agora = P.somaMes("reembolsos", ref.ano, ref.mes), idx = ref.ano * 12 + ref.mes - 1, ultimo = null, i;
      for (i = 0; i < 120; i++) { var t = idx + i; if (P.somaMes("reembolsos", Math.floor(t / 12), t % 12 + 1) > 0) ultimo = t; }
      if (agora > 0 && ultimo !== null) {
        out.push({ id: "reembolso", titulo: "O reembolso de " + fmt(agora) + " por mês só vai até " + P.MESES[ultimo % 12].toLowerCase() + "/" + Math.floor(ultimo / 12),
          detalhe: "Depois disso o resultado do mês piora esse mesmo valor (parte dele já cai em degraus antes). Se esse dinheiro está sustentando o orçamento, planeje o que o substituirá." });
      }
      // 2. peso do consórcio
      var cotas = d.despesas.filter(function (x) { return x.cota; });
      var parcelas = cotas.reduce(function (t, x) { return t + (P.ativo(x, ref.ano, ref.mes) ? num(x.valor) * P.fator(P.taxaDoItem("despesas", x), ref.ano) : 0); }, 0);
      var brutas = P.somaMes("despesas", ref.ano, ref.mes);
      if (parcelas > 0 && brutas > 0) {
        var fins = cotas.map(function (x) { return x.ate; }).filter(Boolean).sort();
        out.push({ id: "consorcio", titulo: "As parcelas de consórcio pesam " + P.pctDe(parcelas, brutas) + " das despesas da lista",
          detalhe: "Somam " + fmt(parcelas) + " por mês" + (fins.length ? ", até " + P.formatarAte(fins[fins.length - 1]) : "") + ". Vale ver, cota a cota, se compensa manter, ceder ou antecipar a contemplação." });
      }
      // 3. despesas crescem acima da inflação
      var longe = ref.ano + 9, hoje = P.somaMes("despesas", ref.ano, ref.mes), depois = P.somaMes("despesas", longe, ref.mes);
      if (hoje > 0 && depois / hoje > 1.1) {
        out.push({ id: "despesas-crescem", titulo: "As despesas da lista crescem " + Math.round((depois / hoje - 1) * 100) + "% em termos reais até " + longe,
          detalhe: "Vão de " + fmt(hoje) + " para " + fmt(depois) + " por mês (em reais de hoje) porque o reajuste do grupo é maior que a inflação, enquanto a renda fixa só acompanha a inflação." });
      }
      // 4. renda fixa sem ganho real
      if (num(d.reajuste.receitas) <= num(d.reajuste.inflacao) + 0.001) {
        out.push({ id: "renda-parada", titulo: "A renda fixa não cresce acima da inflação", detalhe: "Reajuste de " + d.reajuste.receitas + "% ao ano contra inflação de " + d.reajuste.inflacao + "%: em reais de hoje, o salário fica parado pelo resto do plano." });
      }
    });
    return out;
  }

  function analisar() {
    var d = P.estado.dados, base = medir();
    var todas = alavancasDeGasto(d).concat(alavancasDeGanho(d), alavancasDeAposentadoria(d));
    todas.forEach(function (a) { Object.assign(a, comparar(base, cenario(a.edit))); });
    var por = function (g) {
      return todas.filter(function (a) { return a.grupo === g; })
        .sort(function (x, y) { return (y.ganhoFalta - x.ganhoFalta) || (y.ganhoMensal - x.ganhoMensal); });
    };
    var grupos = { gastos: por("gastos"), ganhos: por("ganhos"), aposentadoria: por("aposentadoria") };

    // pacote: as melhores medidas de gasto e de ganho que não dependem de mercado, aplicadas juntas
    var escolhidas = grupos.gastos.filter(function (a) { return a.ganhoMensal > 0.5 || a.ganhoFalta > 0.5; }).slice(0, 3)
      .concat(grupos.ganhos.filter(function (a) { return !a.risco && (a.ganhoMensal > 0.5 || a.ganhoFalta > 0.5); }).slice(0, 2));
    var pacote = escolhidas.length ? Object.assign({ itens: escolhidas.map(function (a) { return a.titulo; }) }, comparar(base, cenario(escolhidas.map(function (a) { return a.edit; })))) : null;
    return { base: base, grupos: grupos, estruturais: estruturais(d), pacote: pacote };
  }

  P.oportunidades = { analisar: analisar, medir: medir, cenario: cenario };
})(window.Plano);
