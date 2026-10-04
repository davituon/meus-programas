// Evolução real × plano. Carregue depois de comum.js; fica em Plano.evolucao.
//
// Você registra de tempos em tempos quanto tem na corretora e na previdência (um "retrato"). O programa compara cada retrato com o que o plano
// projetava para aquela data, em valores nominais (o que aparece nos extratos). O plano é projetado a partir de um PONTO DE PARTIDA
// congelado (os saldos de out/2026, no primeiro retrato), e não dos saldos atuais da página Aportes: assim, atualizar um saldo não "perdoa"
// um desvio. dados.historico = { base: { data, xp, prev } | null, fotos: [ { data, xp, prev } ] } (fotos em ordem de data).
(function (P) {
  "use strict";

  var num = function (v) { return Number(v) || 0; };
  var arred = function (v) { return Math.round(v * 100) / 100; };
  var MAX_FOTOS = 400;

  function dataValida(iso) {
    if (typeof iso !== "string" || !/^\d{4}-\d{2}-\d{2}$/.test(iso)) return false;
    var p = iso.split("-").map(Number), d = new Date(p[0], p[1] - 1, p[2]);
    return d.getFullYear() === p[0] && d.getMonth() === p[1] - 1 && d.getDate() === p[2];
  }
  function hoje() {
    var d = new Date();
    return d.getFullYear() + "-" + ("0" + (d.getMonth() + 1)).slice(-2) + "-" + ("0" + (d.getDate())).slice(-2);
  }
  function inicioIso() { return P.INICIO.ano + "-" + ("0" + P.INICIO.mes).slice(-2) + "-01"; }
  function partes(iso) { var p = iso.split("-").map(Number); return { ano: p[0], mes: p[1], dia: p[2] }; }
  function diasNoMes(ano, mes) { return new Date(ano, mes, 0).getDate(); }

  function H() {
    var d = P.estado.dados;
    if (!d.historico || typeof d.historico !== "object") d.historico = { base: null, fotos: [] };
    if (!Array.isArray(d.historico.fotos)) d.historico.fotos = [];
    return d.historico;
  }

  /** Valor numérico (≥ 0) ou null. */
  function valor(v) {
    if (v === "" || v === null || v === undefined) return null;
    var n = Number(v);
    return isFinite(n) && n >= 0 ? arred(n) : null;
  }

  /** O que se sugere registrar hoje: a posição importada da XP, se houver, ou os saldos da página Aportes. */
  function sugestao() {
    var d = P.estado.dados, c = d.carteira;
    return { xp: c && c.patrimonio !== null && c.patrimonio !== undefined ? arred(num(c.patrimonio)) : arred(num(d.aportes.xp.saldo)), prev: arred(num(d.aportes.prev.saldo)) };
  }

  /** Guarda o retrato. Na primeira vez, congela o ponto de partida com os saldos da página Aportes. Devolve null ou o texto do erro. */
  function registrar(data, xp, prev) {
    var h = H(), x = valor(xp), p = valor(prev);
    if (!dataValida(data)) return "Informe uma data válida.";
    if (data < inicioIso()) return "A data precisa ser a partir de " + P.rotuloInicio() + ", quando o plano começa.";
    if (data > hoje()) return "A data não pode ser no futuro.";
    if (x === null || p === null) return "Informe os dois saldos (zero ou mais).";
    if (!h.base) h.base = { data: inicioIso(), xp: arred(num(P.estado.dados.aportes.xp.saldo)), prev: arred(num(P.estado.dados.aportes.prev.saldo)) };
    var i = h.fotos.findIndex(function (f) { return f.data === data; });
    if (i >= 0) h.fotos[i] = { data: data, xp: x, prev: p }; else h.fotos.push({ data: data, xp: x, prev: p });
    h.fotos.sort(function (a, b) { return a.data < b.data ? -1 : a.data > b.data ? 1 : 0; });
    if (h.fotos.length > MAX_FOTOS) h.fotos = h.fotos.slice(h.fotos.length - MAX_FOTOS);
    P.salvar();
    return null;
  }

  function remover(data) {
    var h = H(), i = h.fotos.findIndex(function (f) { return f.data === data; });
    if (i < 0) return false;
    h.fotos.splice(i, 1);
    P.salvar();
    return true;
  }

  /** Congela de novo o ponto de partida com os saldos atuais da página Aportes (use se corrigiu o saldo de partida). */
  function redefinirBase() {
    var h = H();
    h.base = { data: inicioIso(), xp: arred(num(P.estado.dados.aportes.xp.saldo)), prev: arred(num(P.estado.dados.aportes.prev.saldo)) };
    P.salvar();
  }

  /** Projeção do plano a partir do ponto de partida: [{ ano, mes, plano }] com o saldo no fim de cada mês, em valores nominais. */
  function projecao() {
    var h = H();
    if (!h.base) return null;
    var original = P.estado.dados, copia = P.copiar(original);
    copia.aportes.xp.saldo = h.base.xp; copia.aportes.prev.saldo = h.base.prev; copia.reajuste.modo = "nominal";
    P.estado.dados = copia;
    try {
      return P.serieAportes().linhas.map(function (l) { return { ano: l.ano, mes: l.mes, plano: l.saldoXP + l.saldoPrev }; });
    } finally { P.estado.dados = original; }
  }

  /** Valor do plano numa data (aaaa-mm-dd): interpola entre o fim do mês anterior e o fim do mês da data. */
  function planoEm(proj, iso) {
    var p = partes(iso), idx = p.ano * 12 + p.mes - 1, base = P.estado.dados.historico && P.estado.dados.historico.base;
    var linha = function (i) { return proj.filter(function (l) { return l.ano * 12 + l.mes - 1 === i; })[0] || null; };
    var fim = linha(idx), antes = linha(idx - 1), ini = antes ? antes.plano : (base ? base.xp + base.prev : null);
    if (!fim || ini === null) return null;
    return ini + (fim.plano - ini) * Math.min(1, p.dia / diasNoMes(p.ano, p.mes));
  }

  /** Cada retrato com o plano da mesma data, a diferença e um resumo do último. */
  function comparar() {
    var h = H(), proj = projecao();
    if (!proj || !h.fotos.length) return { temBase: !!h.base, pontos: [], ultimo: null };
    var pontos = h.fotos.map(function (f) {
      var real = f.xp + f.prev, plano = planoEm(proj, f.data);
      return { data: f.data, xp: f.xp, prev: f.prev, real: real, plano: plano, diferenca: plano === null ? null : arred(real - plano), pct: plano ? (real - plano) / plano : null };
    });
    var ultimo = pontos[pontos.length - 1];
    return { temBase: true, base: h.base, pontos: pontos, ultimo: ultimo };
  }

  P.evolucao = { registrar: registrar, remover: remover, redefinirBase: redefinirBase, projecao: projecao, planoEm: planoEm, comparar: comparar, sugestao: sugestao, hoje: hoje, dataValida: dataValida, inicioIso: inicioIso };
})(window.Plano);
