// Página Início: painel com o resumo de todas as páginas. Só lê os dados; a simulação "E se...?" usa cópias.
(function () {
  "use strict";

  var P = window.Plano, moeda = P.moeda, el = P.el, texto = P.texto, limpar = P.limpar;
  var sel = { ano: P.estado.dados.ref.ano, mes: P.estado.dados.ref.mes };
  var resumo = null; // calculado uma vez por desenho: { base, oportunidades, conferencia }

  function comSinal(v) { return (v < 0 ? "− " : "") + moeda(Math.abs(v)); }
  function mesTxt(z) { return P.MESES[z.mes - 1].toLowerCase() + "/" + z.ano; }
  function linha(nome, valor, classe) {
    var li = el("li", { className: classe || "" });
    li.appendChild(el("span", { textContent: nome }));
    li.appendChild(el("b", { textContent: valor }));
    return li;
  }
  function efeito(rotulo, valor, bom) {
    var s = el("span", { className: "opo-efeito" + (bom === true ? " bom" : bom === false ? " ruim" : "") });
    s.appendChild(el("small", { textContent: rotulo }));
    s.appendChild(el("b", { textContent: valor }));
    return s;
  }

  // ------------------------------------------------------------ resumo (quadros do topo)
  function quadros() {
    var p = P.patrimonioAtual(), conf = resumo.conferencia, b = resumo.base;
    texto("k-patrimonio", comSinal(p.liquido));
    texto("k-patrimonio-det", "financeiro " + moeda(p.financeiro) + " · bens e consórcios " + moeda(p.bens + p.consorcio));
    texto("k-meta", b.pctMeta === null ? "–" : Math.round(b.pctMeta * 100) + "%");
    texto("k-meta-det", b.falta === null ? "confira a página Aposentadoria" : b.falta > 0 ? "faltam " + moeda(b.falta) : "meta atingida");
    texto("k-atencao", String(conf.resumo.atencao));
    texto("k-atencao-det", conf.resumo.confirme + " a confirmar");
    document.getElementById("caixa-atencao").className = "kpi resultado " + (conf.resumo.atencao > 0 ? "negativo" : "positivo");
  }

  // ------------------------------------------------------------ primeiros passos
  var NOMES_PAGINA = { "index.html": "Orçamento", "aportes.html": "Aportes", "carteira.html": "Carteira", "cartao.html": "Cartão de crédito", "patrimonio.html": "Patrimônio", "aposentadoria.html": "Aposentadoria" };

  function passos() {
    var a = resumo.conferencia.areas, pend = a.lista.filter(function (x) { return !x.feita; }), atrasado = P.backupAtrasado();
    var bloco = document.getElementById("bloco-passos");
    bloco.hidden = !pend.length && !atrasado;
    if (bloco.hidden) return;
    texto("passos-progresso", a.feitas + " de " + a.total + " áreas preenchidas");
    document.getElementById("passos-barra-preenche").style.width = Math.round(a.feitas / a.total * 100) + "%";
    document.getElementById("passos-barra").setAttribute("aria-label", a.feitas + " de " + a.total + " áreas preenchidas");
    var ul = limpar("passos");
    pend.slice(0, 5).forEach(function (x) {
      var li = el("li", { className: "passo" });
      li.appendChild(el("span", { className: "passo-marca", textContent: "○" }));
      var corpo = el("span", { className: "passo-nome" });
      corpo.appendChild(el("strong", { textContent: x.nome }));
      corpo.appendChild(el("small", { textContent: " · " + (NOMES_PAGINA[x.pagina] || "") }));
      li.appendChild(corpo);
      li.appendChild(el("a", { href: x.pagina, className: "conf-ir", textContent: "Preencher →" }));
      var ok = el("button", { type: "button", className: "secundario", textContent: "Já está certo" });
      ok.setAttribute("aria-label", "Marcar " + x.nome + " como já está certo");
      ok.addEventListener("click", function () { P.conferencia.conferir(x.nome, true); desenhar(); });
      li.appendChild(ok);
      ul.appendChild(li);
    });
    if (pend.length > 5) ul.appendChild(el("li", { className: "passo-mais", textContent: "E mais " + (pend.length - 5) + " áreas na página Conferência." }));
    if (atrasado) {
      var li2 = el("li", { className: "passo" });
      li2.appendChild(el("span", { className: "passo-marca", textContent: "!" }));
      var c2 = el("span", { className: "passo-nome" });
      c2.appendChild(el("strong", { textContent: "Baixar um backup" }));
      c2.appendChild(el("small", { textContent: " · nenhum backup recente: os dados ficam só neste navegador" }));
      li2.appendChild(c2);
      var b2 = el("button", { type: "button", textContent: "Abrir o backup" });
      b2.addEventListener("click", function () { var botao = document.getElementById("btn-backup"); if (botao) botao.click(); });
      li2.appendChild(b2);
      ul.appendChild(li2);
    }
  }

  // ------------------------------------------------------------ evolução real × plano
  var NS = "http://www.w3.org/2000/svg", E = P.evolucao;
  function svg(tag, attrs, filhos) {
    var e = document.createElementNS(NS, tag);
    Object.keys(attrs || {}).forEach(function (k) { e.setAttribute(k, attrs[k]); });
    (filhos || []).forEach(function (f) { e.appendChild(f); });
    return e;
  }
  function dataBr(iso) { var p = iso.split("-"); return p[2] + "/" + p[1] + "/" + p[0]; }
  function pctSinal(v) { return (v < 0 ? "− " : "+ ") + (Math.abs(v) * 100).toFixed(1).replace(".", ",") + "%"; }

  function formEvolucao() {
    var caixa = limpar("evo-form"), sug = E.sugestao();
    var rotulo = function (texto, filho) { var l = el("label"); l.appendChild(document.createTextNode(texto)); l.appendChild(filho); return l; };
    var data = el("input", { type: "date", id: "evo-data", value: E.hoje() });
    var xp = P.campoNumero({ moeda: true, prefixo: "R$", valor: sug.xp, rotulo: "Saldo da corretora" });
    var prev = P.campoNumero({ moeda: true, prefixo: "R$", valor: sug.prev, rotulo: "Saldo da previdência" });
    var ok = el("button", { type: "button", id: "evo-registrar", textContent: "Registrar saldos" });
    ok.addEventListener("click", function () {
      if (P.estado.oculto) { texto("evo-resumo", "Mostre os valores para registrar os saldos."); return; }
      var erro = E.registrar(data.value, P.lerNumero(xp.campo.value), P.lerNumero(prev.campo.value));
      if (erro) { texto("evo-resumo", erro); return; }
      desenhar();
    });
    var redef = el("button", { type: "button", id: "evo-redefinir", className: "secundario", textContent: "Atualizar o ponto de partida" });
    redef.addEventListener("click", function () {
      if (!window.confirm("Usar os saldos atuais da página Aportes como novo ponto de partida do plano?")) return;
      E.redefinirBase(); desenhar();
    });
    caixa.append(rotulo("Data", data), rotulo("Corretora", xp.caixa), rotulo("Previdência", prev.caixa), ok);
    if (P.estado.dados.historico.base) caixa.appendChild(redef);
  }

  function graficoEvolucao(c, proj) {
    var W = 720, H = 300, M = { l: 78, r: 18, t: 20, b: 36 }, caixa = limpar("evo-grafico"), leg = limpar("evo-legenda"), escondido = P.estado.oculto;
    var ini = P.INICIO.ano * 12 + P.INICIO.mes - 1, ultimaFoto = c.pontos.length ? c.pontos[c.pontos.length - 1].data : E.inicioIso();
    var up = ultimaFoto.split("-").map(Number), fimIdx = Math.max(ini + 12, up[0] * 12 + up[1] - 1 + 6);
    var xv = function (idx) { return M.l + (idx - ini) / (fimIdx - ini) * (W - M.l - M.r); };
    var base = c.base.xp + c.base.prev, plano = [{ idx: ini - 1, v: base }].concat(proj.filter(function (l) { return l.ano * 12 + l.mes - 1 <= fimIdx; }).map(function (l) { return { idx: l.ano * 12 + l.mes - 1, v: l.plano }; }));
    var reais = c.pontos.map(function (p) { var q = p.data.split("-").map(Number); return { idx: q[0] * 12 + q[1] - 1 + (q[2] - 0.5) / new Date(q[0], q[1], 0).getDate(), v: p.real, p: p }; });
    var maxY = Math.max.apply(null, plano.map(function (p) { return p.v; }).concat(reais.map(function (p) { return p.v; }), [1])) * 1.08;
    var y = function (v) { return H - M.b - v / maxY * (H - M.t - M.b); };
    var raiz = svg("svg", { viewBox: "0 0 " + W + " " + H, role: "img" }), i;
    for (i = 0; i <= 4; i++) {
      var v = maxY / 4 * i;
      raiz.appendChild(svg("line", { x1: M.l, x2: W - M.r, y1: y(v), y2: y(v), class: "gv-grade" }));
      if (!escondido) raiz.appendChild(svg("text", { x: M.l - 8, y: y(v) + 4, "text-anchor": "end", class: "gv-tick" }, [document.createTextNode(P.moedaInteira(v))]));
    }
    for (i = ini; i <= fimIdx; i += 2) {
      var ano = Math.floor(i / 12), mes = i % 12;
      raiz.appendChild(svg("text", { x: xv(i), y: H - 14, "text-anchor": "middle", class: "gv-tick" }, [document.createTextNode(P.MESES[mes].toLowerCase() + (mes === 0 || i === ini ? "/" + String(ano).slice(2) : ""))]));
    }
    raiz.appendChild(svg("path", { d: plano.map(function (p, k) { return (k ? "L" : "M") + (k === 0 ? xv(ini) : xv(p.idx + 1)).toFixed(1) + "," + y(p.v).toFixed(1); }).join(" "), class: "gv-consumindo" }));
    if (reais.length) raiz.appendChild(svg("path", { d: reais.map(function (p, k) { return (k ? "L" : "M") + xv(p.idx).toFixed(1) + "," + y(p.v).toFixed(1); }).join(" "), class: "gv-acumulando" }));
    reais.forEach(function (p) {
      var ponto = svg("circle", { cx: xv(p.idx), cy: y(p.v), r: 7, class: "gv-ponto" });
      ponto.appendChild(svg("title", {}, [document.createTextNode(dataBr(p.p.data) + " · real " + moeda(p.p.real) + " · plano " + (p.p.plano === null ? "–" : moeda(p.p.plano)))]));
      raiz.appendChild(ponto);
    });
    var ult = c.ultimo;
    raiz.setAttribute("aria-label", "Patrimônio financeiro real contra o plano, em valores nominais. " + (ult ? "Em " + dataBr(ult.data) + ": real " + moeda(ult.real) + (ult.plano === null ? "" : ", plano " + moeda(ult.plano)) + "." : "Sem registros ainda."));
    caixa.appendChild(raiz);
    [["cons", "Plano (tracejada)"], ["acum", "Real, nos seus registros (linha cheia com pontos)"]].forEach(function (it) {
      var li = el("li"); li.appendChild(el("span", { className: "amostra-linha " + it[0] })); li.appendChild(el("span", { textContent: it[1] })); leg.appendChild(li);
    });
  }

  function evolucao() {
    var c = E.comparar(), h = P.estado.dados.historico;
    texto("evo-partida", h.base ? P.MESES[P.INICIO.mes - 1].toLowerCase() + "/" + P.INICIO.ano : P.rotuloInicio() + " (será congelado no primeiro registro)");
    formEvolucao();
    var t = limpar("evo-tabela"), graf = limpar("evo-grafico"); limpar("evo-legenda");
    if (!c.pontos.length) {
      texto("evo-resumo", "Nenhum registro ainda. Registre os saldos de hoje para começar a acompanhar.");
      return;
    }
    var u = c.ultimo, resumo;
    if (u.plano === null) resumo = "Em " + dataBr(u.data) + " você tinha " + moeda(u.real) + ".";
    else if (Math.abs(u.pct) < 0.005) resumo = "Em " + dataBr(u.data) + " você tinha " + moeda(u.real) + ": exatamente no plano.";
    else resumo = "Em " + dataBr(u.data) + " você tinha " + moeda(u.real) + ", " + moeda(Math.abs(u.diferenca)) + " (" + pctSinal(u.pct) + ") " + (u.diferenca > 0 ? "acima" : "abaixo") + " dos " + moeda(u.plano) + " que o plano projetava.";
    texto("evo-resumo", (u.diferenca < 0 ? "⚠ " : "✓ ") + resumo);
    graficoEvolucao(c, E.projecao());

    var cab = el("tr");
    ["Data", "Corretora", "Previdência", "Total real", "Plano", "Diferença", ""].forEach(function (x) { cab.appendChild(el("th", { textContent: x, scope: "col" })); });
    t.appendChild(el("thead")).appendChild(cab);
    var corpo = el("tbody");
    c.pontos.slice().reverse().forEach(function (p) {
      var tr = el("tr");
      tr.appendChild(el("th", { scope: "row", textContent: dataBr(p.data) }));
      [p.xp, p.prev, p.real].forEach(function (v) { tr.appendChild(el("td", { textContent: moeda(v) })); });
      tr.appendChild(el("td", { textContent: p.plano === null ? "–" : moeda(p.plano) }));
      var td = el("td", { textContent: p.diferenca === null ? "–" : (p.diferenca < 0 ? "− " : "+ ") + moeda(Math.abs(p.diferenca)) + " (" + pctSinal(p.pct) + ")" });
      if (p.diferenca !== null) td.className = p.diferenca < 0 ? "negativo" : "positivo";
      tr.appendChild(td);
      var rm = el("button", { type: "button", className: "remover", textContent: "✕" });
      rm.setAttribute("aria-label", "Remover o registro de " + dataBr(p.data)); rm.title = "Remover";
      rm.addEventListener("click", function () { if (window.confirm("Remover o registro de " + dataBr(p.data) + "?")) { E.remover(p.data); desenhar(); } });
      var tdr = el("td"); tdr.appendChild(rm); tr.appendChild(tdr);
      corpo.appendChild(tr);
    });
    t.appendChild(corpo);
  }

  // ------------------------------------------------------------ saúde financeira
  var ROTULO_NIVEL = { bom: "✓ Bom", atencao: "! Atenção", alerta: "⚠ Alerta", sem: "– Sem dados", info: "i Informação" };

  function cartaoSaude(titulo, valor, nivel, texto) {
    var c = el("article", { className: "saude-item nivel-" + nivel });
    var topo = el("div", { className: "saude-topo" });
    topo.appendChild(el("span", { className: "saude-titulo", textContent: titulo }));
    topo.appendChild(el("span", { className: "saude-nivel", textContent: ROTULO_NIVEL[nivel] }));
    c.appendChild(topo);
    c.appendChild(el("strong", { textContent: valor }));
    c.appendChild(el("p", { textContent: texto }));
    return c;
  }
  function pct(v) { return Math.round(v * 100) + "%"; }
  function mesesTxt(v) { return (Math.round(v * 10) / 10).toString().replace(".", ",") + (Math.round(v * 10) / 10 === 1 ? " mês" : " meses"); }

  function saude() {
    var i = P.indicadores.calcular(), caixa = limpar("saude"), p = i.poupanca, r = i.reserva, c = i.comprometimento, l = i.liquidez;

    caixa.appendChild(cartaoSaude("Quanto você poupa", p.valor === null ? "–" : pct(p.valor), p.nivel,
      p.valor === null ? "Cadastre as receitas para calcular." :
      p.valor < 0 ? "O orçamento gasta mais do que entra: em média faltam " + moeda(Math.abs(p.porMes)) + " por mês. Veja a página Oportunidades." :
      "Cerca de " + moeda(p.porMes) + " por mês viram patrimônio (reservas no aporte, sobra e previdência da folha). Referência: " + pct(P.indicadores.BOA_POUPANCA) + " ou mais da renda."));

    caixa.appendChild(cartaoSaude("Reserva de emergência", r.meses === null ? "–" : mesesTxt(r.meses), r.nivel,
      r.meses === null ? "Cadastre as despesas para calcular." :
      "Dinheiro na corretora (" + moeda(r.liquido) + ") ÷ despesas de " + moeda(r.despesaMensal) + " por mês. Meta: " + P.indicadores.META_RESERVA_MESES + " meses" + (r.falta > 0 ? "; faltam " + moeda(r.falta) + ". Conta toda a corretora como dinheiro disponível." : ". Meta atingida.")));

    caixa.appendChild(cartaoSaude("Parcelas fixas na renda", c.valor === null ? "–" : pct(c.valor), c.nivel,
      c.valor === null ? "Sem receita líquida para comparar." :
      "Consórcios (" + moeda(c.consorcioMensal) + ") e parcelas do cartão (" + moeda(c.parceladoMensal) + ") por mês, sobre " + moeda(c.receitaLiquidaMensal) + " de receita líquida. Referência: até " + pct(P.indicadores.BOM_COMPROMETIMENTO) + "."));

    caixa.appendChild(cartaoSaude("Patrimônio em dinheiro", l.pctLiquido === null ? "–" : pct(l.pctLiquido), l.pctLiquido === null ? "sem" : "info",
      l.pctLiquido === null ? "Sem patrimônio cadastrado." :
      "Disponível: " + moeda(l.liquido) + ". Preso: " + moeda(l.travado) + " (previdência " + moeda(l.prev) + ", bens " + moeda(l.bens) + ", consórcios pagos " + moeda(l.consorcio) + ")."));
  }

  // ------------------------------------------------------------ meses do ano
  function desenharMeses() {
    var caixa = limpar("meses"), dados = [], max = 0, k;
    for (k = 1; k <= 12; k++) {
      var fora = P.antesDoInicio(sel.ano, k), c = fora ? null : P.calcMes(sel.ano, k);
      dados.push(c);
      if (c) max = Math.max(max, Math.abs(c.sobra));
    }
    texto("ano-rotulo", String(sel.ano));
    document.getElementById("ano-ant").disabled = sel.ano <= P.ANO_INICIAL;
    document.getElementById("ano-prox").disabled = sel.ano >= P.ANO_INICIAL + P.ANOS - 1;
    dados.forEach(function (c, i) {
      var mes = i + 1, atual = mes === sel.mes;
      var b = el("button", { type: "button", className: "ini-mes" + (atual ? " atual" : "") + (c && c.sobra < 0 ? " falta" : "") });
      b.disabled = !c;
      b.setAttribute("aria-pressed", atual ? "true" : "false");
      b.setAttribute("aria-label", P.MESES_LONGOS[i] + " de " + sel.ano + (c ? ": " + (c.sobra < 0 ? "falta " : "sobra ") + moeda(Math.abs(c.sobra)) : ": antes do início do plano"));
      b.appendChild(el("span", { className: "ini-mes-nome", textContent: P.MESES[i] }));
      var trilho = el("span", { className: "ini-trilho" });
      var barra = el("span", { className: "ini-barra" });
      barra.style.width = (c && max > 0 ? Math.round(Math.abs(c.sobra) / max * 100) : 0) + "%";
      trilho.appendChild(barra);
      b.appendChild(trilho);
      b.appendChild(el("span", { className: "ini-mes-valor", textContent: c ? comSinal(c.sobra) : "–" }));
      b.addEventListener("click", function () { sel.mes = mes; desenharMeses(); });
      caixa.appendChild(b);
    });
    detalhe();
  }

  function detalhe() {
    var ul = limpar("detalhe");
    if (P.antesDoInicio(sel.ano, sel.mes)) { texto("detalhe-titulo", "Escolha um mês a partir de " + P.rotuloInicio()); return; }
    var c = P.calcMes(sel.ano, sel.mes);
    texto("detalhe-titulo", P.MESES_LONGOS[sel.mes - 1] + " de " + sel.ano);
    ul.appendChild(linha("Receita total", moeda(c.r)));
    ul.appendChild(linha("Folha (impostos e descontos)", "− " + moeda(c.folha)));
    ul.appendChild(linha("Reservas (dízimo, oferta, poupança…)", "− " + moeda(c.reservas)));
    ul.appendChild(linha("Receita líquida", moeda(c.liquida), "total"));
    ul.appendChild(linha("Despesas da lista", "− " + moeda(c.brutas)));
    if (c.cartao > 0) ul.appendChild(linha("Faturas dos cartões", "− " + moeda(c.cartao)));
    if (c.reemb > 0) ul.appendChild(linha("Reembolsos", "+ " + moeda(c.reemb)));
    ul.appendChild(linha("Resultado do mês", comSinal(c.sobra), "total"));
    ul.appendChild(linha("Vai para a corretora XP", moeda(c.aporteXP)));
    ul.appendChild(linha("Vai para a previdência", moeda(c.aportePrev)));
    texto("k-mes-rotulo", "Resultado de " + P.MESES[sel.mes - 1].toLowerCase() + "/" + sel.ano);
    texto("k-mes", comSinal(c.sobra));
    texto("k-mes-det", c.sobra < 0 ? "o mês fecha no vermelho" : "o mês fecha no azul");
    document.getElementById("caixa-mes").className = "kpi resultado " + (c.sobra < 0 ? "negativo" : "positivo");
  }

  // ------------------------------------------------------------ simulação "E se...?"
  function simular() {
    var renda = Number(document.getElementById("sim-renda").value) || 0, corte = Number(document.getElementById("sim-corte").value) || 0;
    texto("sim-renda-v", moeda(renda) + " por mês");
    texto("sim-corte-v", corte + "%");
    var b = resumo.base, caixa = limpar("sim-resultado");
    if (!renda && !corte) { caixa.appendChild(el("span", { className: "nota", textContent: "Mexa nos controles para ver o efeito no resultado, na aposentadoria e na corretora." })); return; }
    var m = P.oportunidades.cenario(function (c) {
      if (renda > 0) c.extras.push({ nome: "Simulação", valor: renda });
      if (corte > 0) c.despesas.forEach(function (x) { if (!x.cota) x.valor = (Number(x.valor) || 0) * (1 - corte / 100); });
    });
    var dm = m.sobra12 - b.sobra12;
    caixa.appendChild(efeito("Resultado médio por mês", comSinal(m.sobra12), m.sobra12 >= 0 ? true : false));
    caixa.appendChild(efeito("Mudança no mês", (dm < 0 ? "− " : "+ ") + moeda(Math.abs(dm)), dm > 0.5 ? true : dm < -0.5 ? false : null));
    caixa.appendChild(efeito("Meses no vermelho", b.vermelho + " → " + m.vermelho + " de 12", m.vermelho < b.vermelho ? true : null));
    if (m.pctMeta !== null && b.pctMeta !== null) caixa.appendChild(efeito("Meta da aposentadoria", Math.round(b.pctMeta * 100) + "% → " + Math.round(m.pctMeta * 100) + "%", m.pctMeta > b.pctMeta + 0.004 ? true : null));
    caixa.appendChild(efeito("Corretora XP", m.zera ? "zera em " + mesTxt(m.zera) : "não zera até 2050", m.zera ? false : true));
  }

  // ------------------------------------------------------------ oportunidades e conferência
  function oportunidades() {
    var o = resumo.oportunidades, ul = limpar("opo"), b = resumo.base;
    var todas = o.grupos.gastos.concat(o.grupos.ganhos, o.grupos.aposentadoria).filter(function (a) { return !a.risco; })
      .sort(function (x, y) { return y.ganhoFalta - x.ganhoFalta; }).slice(0, 3);
    todas.forEach(function (a) {
      var li = el("li", { className: "opo-item" }), corpo = el("div", { className: "opo-corpo" }), ef = el("div", { className: "opo-efeitos" });
      corpo.appendChild(el("strong", { textContent: a.titulo }));
      li.appendChild(corpo);
      ef.appendChild(efeito("Falta para aposentar", a.ganhoFalta > 0.5 ? "− " + moeda(a.ganhoFalta) : "sem mudança", a.ganhoFalta > 0.5 ? true : null));
      if (a.pctMeta !== null && a.pctMeta !== undefined) ef.appendChild(efeito("Meta atingida", Math.round(b.pctMeta * 100) + "% → " + Math.round(a.pctMeta * 100) + "%", a.pctMeta > b.pctMeta + 0.004 ? true : null));
      li.appendChild(ef);
      ul.appendChild(li);
    });
    if (!todas.length) ul.appendChild(el("li", { className: "nota", textContent: "Sem sugestões: preencha o orçamento e a aposentadoria." }));
  }

  function atencao() {
    var ul = limpar("atencao"), itens = resumo.conferencia.itens.filter(function (i) { return i.nivel === "atencao"; });
    if (!itens.length) itens = resumo.conferencia.itens.filter(function (i) { return i.nivel === "confirme"; });
    itens.slice(0, 3).forEach(function (i) {
      var li = el("li", { className: "conf-item sem-etiqueta nivel-" + i.nivel }), corpo = el("div", { className: "conf-corpo" });
      corpo.appendChild(el("strong", { textContent: i.titulo }));
      if (i.detalhe) corpo.appendChild(el("p", { textContent: i.detalhe }));
      li.appendChild(corpo);
      ul.appendChild(li);
    });
    if (!itens.length) ul.appendChild(el("li", { className: "conf-item sem-etiqueta nivel-ok" })).appendChild(el("div", { className: "conf-corpo" })).appendChild(el("strong", { textContent: "Nada para conferir agora" }));
  }

  // ------------------------------------------------------------ atalhos
  function atalhos() {
    var caixa = limpar("atalhos"), p = P.patrimonioAtual(), S = P.serieAportes(), c = P.calcMes(P.estado.dados.ref.ano, P.estado.dados.ref.mes);
    var cartoes = P.estado.dados.cartao.cartoes.length, b = resumo.base, rf = P.estado.dados.ref, pag = P.pagamentos.resumo(P.pagamentos.contas(rf.ano, rf.mes));
    [
      ["index.html", "Orçamento", "resultado do mês " + comSinal(c.sobra)],
      ["aportes.html", "Aportes e consórcios", "corretora " + moeda(p.xp) + " · previdência " + moeda(p.prev)],
      ["carteira.html", "Carteira", P.estado.dados.carteira ? "posição da XP importada" : "importe a posição da XP"],
      ["cartao.html", "Cartão de crédito", cartoes + " cartões · fatura do mês " + moeda(c.cartaoFatura)],
      ["patrimonio.html", "Patrimônio", "líquido " + comSinal(p.liquido)],
      ["aposentadoria.html", "Aposentadoria", b.pctMeta === null ? "confira as premissas" : Math.round(b.pctMeta * 100) + "% da meta"],
      ["conferencia.html", "Conferência", resumo.conferencia.resumo.atencao + " pontos de atenção"],
      ["pagamentos.html", "Pagamentos", (pag.qtdAtrasadas ? pag.qtdAtrasadas + " atrasadas · " : "") + pag.qtdPendentes + " pendentes · " + pag.qtdPagas + " pagas no mês"],
      ["oportunidades.html", "Oportunidades", S.primeiroZero ? "corretora zera em " + mesTxt(S.primeiroZero) : "veja onde ganhar mais"]
    ].forEach(function (a) {
      var link = el("a", { href: a[0], className: "ini-atalho" });
      link.appendChild(el("strong", { textContent: a[1] }));
      link.appendChild(el("span", { textContent: a[2] }));
      caixa.appendChild(link);
    });
  }

  function desenhar() {
    P.desenharCabecalho();
    resumo = { base: P.oportunidades.medir(), oportunidades: P.oportunidades.analisar(), conferencia: P.conferencia.verificar() };
    quadros(); passos(); saude(); evolucao(); desenharMeses(); simular(); oportunidades(); atencao(); atalhos();
  }

  document.getElementById("ano-ant").addEventListener("click", function () { sel.ano--; desenharMeses(); });
  document.getElementById("ano-prox").addEventListener("click", function () { sel.ano++; desenharMeses(); });
  document.getElementById("sim-renda").addEventListener("input", simular);
  document.getElementById("sim-corte").addEventListener("input", simular);

  P.iniciarCabecalho(desenhar);
  desenhar();
})();
