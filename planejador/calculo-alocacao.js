// Alocação da carteira: classes de ativos, alvo, rebalanceamento, concentração e retorno esperado.
// Carregue depois de comum.js; fica em Plano.alocacao. Lê a carteira importada da XP (dados.carteira) e as escolhas em dados.alocacao:
//   { alvo: { classe: % }, retorno: { classe: % ao ano }, mapa: { "nome normalizado do ativo": classe } }
//
// As classes são deduzidas pelo nome do ativo e do grupo (por exemplo "HGLG11" é fundo imobiliário, "Tesouro IPCA+" é inflação).
// É uma estimativa: o que cair em "Outros" pode ser reclassificado à mão (mapa). A custódia remunerada não entra: já está dentro de Ações.
(function (P) {
  "use strict";

  var num = function (v) { return Number(v) || 0; };
  var CLASSES = [
    { id: "pos", nome: "Renda fixa pós-fixada (CDI, Selic)" },
    { id: "infl", nome: "Renda fixa inflação e prefixada" },
    { id: "acoes", nome: "Ações" },
    { id: "fii", nome: "Fundos imobiliários" },
    { id: "exterior", nome: "Exterior" },
    { id: "fundos", nome: "Fundos e outros multimercados" },
    { id: "outros", nome: "Outros" }
  ];
  var IDS = CLASSES.map(function (c) { return c.id; });

  // ETFs com final 11 que não são fundos imobiliários
  var ETFS = { ivvb11: "exterior", bova11: "acoes", smal11: "acoes", divo11: "acoes", bovv11: "acoes", bbsd11: "acoes", ecoo11: "acoes", hash11: "outros", gold11: "outros", ntnb11: "infl" };

  var norm = function (s) { return String(s || "").normalize("NFD").replace(/[̀-ͯ]/g, "").toLowerCase().replace(/\s+/g, " ").trim(); };

  /** Classe de um ativo, a partir da seção, do grupo e do nome (nessa ordem de prioridade: nome do ativo, depois grupo). */
  function classificar(secao, grupo, nome, mapa) {
    var n = norm(nome), g = norm(secao + " " + grupo);
    if (mapa && IDS.indexOf(mapa[n]) >= 0) return mapa[n];
    var codigo = n.split(" ")[0];
    if (ETFS[codigo]) return ETFS[codigo];
    if (/\b[a-z]{4}11\b/.test(n)) return "fii";
    if (/\b(exterior|internacional|internacionais|global|eua|estados unidos|nasdaq|s&p)\b/.test(n + " " + g)) return "exterior";
    if (/tesouro selic|\bselic\b/.test(n)) return "pos";
    if (/tesouro (ipca|prefixado|pre)|ipca|prefixad|pre-fixad|pre fixad|inflac/.test(n + " " + g)) return "infl";
    if (/fundos imobiliarios|\bfii\b|imobiliari/.test(g)) return "fii";
    if (/\b[a-z]{4}[3-9]\b|\b[a-z]{4}1[0-9]\b/.test(n) || /acoes|renda variavel brasil/.test(g)) return "acoes";
    if (/pos-fixad|pos fixad|\bcdi\b|liquidez|selic|renda fixa/.test(n + " " + g)) return "pos";
    if (/fundo|multimercado|previdencia|cambial/.test(n + " " + g)) return "fundos";
    return "outros";
  }

  /** Ativos da carteira com a classe e o saldo (só saldos positivos; a custódia remunerada fica de fora). */
  function ativos(carteira, mapa) {
    var out = [];
    if (!carteira || !carteira.secoes) return out;
    carteira.secoes.forEach(function (s) {
      s.grupos.forEach(function (g) {
        g.itens.forEach(function (it) {
          var saldo = num(it.saldo);
          if (saldo > 0) out.push({ nome: it.nome, chave: norm(it.nome), secao: s.nome, grupo: g.nome, saldo: saldo, classe: classificar(s.nome, g.nome, it.nome, mapa) });
        });
      });
    });
    return out;
  }

  function padrao() { return { alvo: {}, retorno: {}, mapa: {} }; }

  /** Percentual válido (0 a 100) ou null. */
  function pct(v) {
    if (v === "" || v === null || v === undefined) return null;
    var n = Number(String(v).replace(",", "."));
    return isFinite(n) && n >= 0 && n <= 100 ? n : null;
  }
  /** Retorno anual válido (−20 a 60) ou null. */
  function ret(v) {
    if (v === "" || v === null || v === undefined) return null;
    var n = Number(String(v).replace(",", "."));
    return isFinite(n) && n >= -20 && n <= 60 ? n : null;
  }

  function definirAlvo(al, classe, valor) {
    if (IDS.indexOf(classe) < 0) return false;
    if (valor === "" || valor === null || valor === undefined) { delete al.alvo[classe]; return true; }
    var v = pct(valor);
    if (v === null) return false;
    al.alvo[classe] = v;
    return true;
  }
  function definirRetorno(al, classe, valor) {
    if (IDS.indexOf(classe) < 0) return false;
    if (valor === "" || valor === null || valor === undefined) { delete al.retorno[classe]; return true; }
    var v = ret(valor);
    if (v === null) return false;
    al.retorno[classe] = v;
    return true;
  }
  /** Muda a classe de um ativo (pelo nome). `classe` null/"" volta ao automático. */
  function definirClasse(al, nomeAtivo, classe) {
    var k = norm(nomeAtivo);
    if (!k) return false;
    if (classe === null || classe === "" || classe === undefined) { delete al.mapa[k]; return true; }
    if (IDS.indexOf(classe) < 0) return false;
    al.mapa[k] = classe;
    return true;
  }

  /**
   * Situação da carteira: por classe (valor, %, alvo, desvio, ajuste para chegar ao alvo, compra para chegar ao alvo só aportando),
   * concentração (maiores posições) e retorno esperado ponderado (só se todas as classes com dinheiro tiverem retorno informado).
   */
  function analisar(carteira, al) {
    al = al || padrao();
    var lista = ativos(carteira, al.mapa), total = lista.reduce(function (t, a) { return t + a.saldo; }, 0);
    if (!lista.length) return null;

    var classes = CLASSES.map(function (c) {
      var valor = lista.filter(function (a) { return a.classe === c.id; }).reduce(function (t, a) { return t + a.saldo; }, 0);
      var alvo = pct(al.alvo[c.id]), r = ret(al.retorno[c.id]);
      return {
        id: c.id, nome: c.nome, valor: valor, pct: valor / total, alvo: alvo, retorno: r,
        desvio: alvo === null ? null : valor / total * 100 - alvo, ajuste: alvo === null ? null : alvo / 100 * total - valor, compra: null,
        qtd: lista.filter(function (a) { return a.classe === c.id; }).length
      };
    });
    var somaAlvo = classes.reduce(function (t, c) { return t + (c.alvo || 0); }, 0), temAlvo = classes.some(function (c) { return c.alvo !== null; });
    var fechado = temAlvo && Math.abs(somaAlvo - 100) < 0.01;

    // aportar sem vender: quanto a carteira precisa crescer para a classe mais acima do alvo chegar ao alvo
    var rebalanceamento = null;
    if (fechado) {
      var comAlvo = classes.filter(function (c) { return c.alvo > 0; }), foraDoAlvo = classes.filter(function (c) { return !(c.alvo > 0) && c.valor > 0; });
      var novoTotal = Math.max.apply(null, comAlvo.map(function (c) { return c.valor / (c.alvo / 100); }).concat([total]));
      if (!foraDoAlvo.length) {
        classes.forEach(function (c) { c.compra = c.alvo > 0 ? Math.max(0, c.alvo / 100 * novoTotal - c.valor) : 0; });
        rebalanceamento = { aporte: novoTotal - total, novoTotal: novoTotal, possivel: true, venda: 0 };
      } else {
        rebalanceamento = { aporte: null, novoTotal: null, possivel: false, venda: foraDoAlvo.reduce(function (t, c) { return t + c.valor; }, 0), foraDoAlvo: foraDoAlvo.map(function (c) { return c.nome; }) };
      }
    }

    // concentração
    var ordem = lista.slice().sort(function (a, b) { return b.saldo - a.saldo; });
    var maiores = ordem.slice(0, 5).map(function (a) { return { nome: a.nome, classe: a.classe, saldo: a.saldo, pct: a.saldo / total }; });
    var maior = maiores[0].pct, top5 = maiores.reduce(function (t, a) { return t + a.pct; }, 0);
    var concentracao = { maiores: maiores, maior: maior, top5: top5, qtd: lista.length, nivel: maior > 0.20 ? "alerta" : maior > 0.10 ? "atencao" : "bom" };

    // retorno esperado ponderado pelo que existe hoje
    var comDinheiro = classes.filter(function (c) { return c.valor > 0; }), faltando = comDinheiro.filter(function (c) { return c.retorno === null; });
    var retornoEsperado = faltando.length ? null : comDinheiro.reduce(function (t, c) { return t + c.pct * c.retorno; }, 0);

    return {
      total: total, classes: classes, somaAlvo: somaAlvo, temAlvo: temAlvo, fechado: fechado, rebalanceamento: rebalanceamento, concentracao: concentracao,
      retornoEsperado: retornoEsperado, faltandoRetorno: faltando.map(function (c) { return c.nome; }),
      outros: lista.filter(function (a) { return a.classe === "outros"; }).sort(function (a, b) { return b.saldo - a.saldo; })
    };
  }

  P.alocacao = { CLASSES: CLASSES, classificar: classificar, ativos: ativos, padrao: padrao, analisar: analisar, definirAlvo: definirAlvo, definirRetorno: definirRetorno, definirClasse: definirClasse, norm: norm };
})(window.Plano);
