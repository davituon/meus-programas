// Página Aposentadoria: quanto preciso, quanto terei e quanto falta. A conta está em calculo-aposentadoria.js.
(function () {
  "use strict";

  var P = window.Plano, A = P.aposentadoria, dados = P.estado.dados;
  var moeda = P.moeda, moedaInteira = P.moedaInteira, lerNumero = P.lerNumero, el = P.el, texto = P.texto, salvar = P.salvar, limpar = P.limpar, campoNumero = P.campoNumero;
  var NS = "http://www.w3.org/2000/svg";

  function ap() { return dados.aposentadoria; }
  function svg(tag, attrs, filhos) {
    var e = document.createElementNS(NS, tag);
    Object.keys(attrs || {}).forEach(function (k) { e.setAttribute(k, attrs[k]); });
    (filhos || []).forEach(function (f) { e.appendChild(f); });
    return e;
  }
  function linhaLista(nome, valor, classe) {
    var li = el("li", { className: classe || "" });
    li.appendChild(el("span", { textContent: nome }));
    li.appendChild(el("b", { textContent: valor }));
    return li;
  }
  function comSinal(v) { return v < 0 ? "− " + moeda(-v) : moeda(v); }
  function dataTexto(d) { return P.MESES_LONGOS[d.mes - 1].toLowerCase() + " de " + d.ano; }

  // ---------------------------------------------------------------- premissas (campos editáveis, criados uma vez)
  function campo(rotulo, chave, opcoes) {
    var bloco = el("label", { className: "campo-reajuste" });
    bloco.appendChild(el("span", { textContent: rotulo }));
    var c = campoNumero(Object.assign({ valor: ap()[chave], rotulo: rotulo }, opcoes));
    var ler = opcoes.moeda ? function () { return lerNumero(c.campo.value); } : function () { return parseFloat(c.campo.value); };
    c.campo.addEventListener("input", function () {
      var v = ler();
      ap()[chave] = isNaN(v) ? "" : (opcoes.inteiro ? Math.round(v) : v);
      salvar(); atualizar();
    });
    bloco.appendChild(c.caixa);
    return bloco;
  }

  function desenharCampos() {
    var caixa = limpar("campos-aposentadoria");
    caixa.append(
      campo("Idade atual", "idade", { passo: "1", sufixo: "anos", inteiro: true }),
      campo("Aposentar aos", "aposentar", { passo: "1", sufixo: "anos", inteiro: true }),
      campo("INSS começa aos", "inss_idade", { passo: "1", sufixo: "anos", inteiro: true }),
      campo("Planejar até os", "ate_idade", { passo: "1", sufixo: "anos", inteiro: true }),
      campo("Gasto mensal na aposentadoria", "gasto", { moeda: true, prefixo: "R$" }),
      campo("INSS por mês", "inss", { moeda: true, prefixo: "R$" }),
      campo("Retorno real ao ano", "retorno", { passo: "0.5", sufixo: "%" }),
      campo("Imposto médio sobre o resgate", "imposto", { passo: "1", sufixo: "%" }),
      campo("Custos (taxas) ao ano", "custo", { passo: "0.1", sufixo: "% a.a." }),
      campo("Variação dos cenários", "var_cenarios", { passo: "0.5", sufixo: "pontos" })
    );
    var cb = document.getElementById("ap-consorcios");
    cb.checked = !!ap().consorcios;
  }

  // ---------------------------------------------------------------- gráfico da vida
  function grafico(c, r) {
    var W = 720, H = 320, M = { l: 70, r: 18, t: 22, b: 40 }, caixa = limpar("grafico"), leg = limpar("legenda-vida");
    var pts = c.pontos, idades = pts.map(function (p) { return p.idade; });
    var minX = ap().idade, maxX = ap().ate_idade;
    var maxY = Math.max.apply(null, pts.map(function (p) { return p.saldo; }).concat([r.necessario, 1])) * 1.1;
    var x = function (id) { return M.l + (id - minX) / (maxX - minX) * (W - M.l - M.r); };
    var y = function (v) { return H - M.b - v / maxY * (H - M.t - M.b); };
    var raiz = svg("svg", { viewBox: "0 0 " + W + " " + H, role: "img", "aria-label": "" });
    var escondido = P.estado.oculto, i;

    for (i = 0; i <= 4; i++) {
      var v = maxY / 4 * i;
      raiz.appendChild(svg("line", { x1: M.l, x2: W - M.r, y1: y(v), y2: y(v), class: "gv-grade" }));
      if (!escondido) raiz.appendChild(svg("text", { x: M.l - 8, y: y(v) + 4, "text-anchor": "end", class: "gv-tick" }, [document.createTextNode(moedaInteira(v))]));
    }
    for (i = minX; i <= maxX; i += 5) raiz.appendChild(svg("text", { x: x(i), y: H - 16, "text-anchor": "middle", class: "gv-tick" }, [document.createTextNode(String(i))]));
    raiz.appendChild(svg("text", { x: W - M.r, y: H - 2, "text-anchor": "end", class: "gv-tick" }, [document.createTextNode("idade")]));

    // capital necessário
    raiz.appendChild(svg("line", { x1: M.l, x2: W - M.r, y1: y(r.necessario), y2: y(r.necessario), class: "gv-necessario" }));
    raiz.appendChild(svg("text", { x: W - M.r, y: y(r.necessario) - 6, "text-anchor": "end", class: "gv-rotulo-nec" }, [document.createTextNode(escondido ? "Capital necessário para aposentar" : "Necessário para aposentar: " + moeda(r.necessario))]));

    // marcadores de aposentadoria e INSS
    [[ap().aposentar, "Aposenta aos " + ap().aposentar, 20], [ap().inss_idade, "INSS aos " + ap().inss_idade, 36]].forEach(function (m) {
      if (m[0] <= minX || m[0] >= maxX) return;
      raiz.appendChild(svg("line", { x1: x(m[0]), x2: x(m[0]), y1: M.t, y2: H - M.b, class: "gv-marca" }));
      raiz.appendChild(svg("text", { x: x(m[0]) + 5, y: y(r.necessario) + m[2], class: "gv-rotulo" }, [document.createTextNode(m[1])]));
    });

    // linhas: acumulando (cheia) e consumindo (tracejada)
    var acum = pts.filter(function (p) { return p.fase === "acumulando"; });
    var cons = pts.filter(function (p) { return p.fase === "consumindo"; });
    var caminho = function (lista) { return lista.map(function (p, k) { return (k ? "L" : "M") + x(p.idade).toFixed(1) + "," + y(p.saldo).toFixed(1); }).join(" "); };
    if (acum.length) {
      var ligacao = cons.length ? acum.concat([cons[0]]) : acum;
      raiz.appendChild(svg("path", { d: caminho(ligacao), class: "gv-acumulando" }));
    }
    if (cons.length) raiz.appendChild(svg("path", { d: caminho(cons), class: "gv-consumindo" }));

    // pontos com dica (passe o mouse)
    pts.forEach(function (p) {
      var ponto = svg("circle", { cx: x(p.idade), cy: y(p.saldo), r: 8, class: "gv-ponto" });
      ponto.appendChild(svg("title", {}, [document.createTextNode(p.idade + " anos · " + (p.fase === "acumulando" ? "acumulando" : "consumindo") + " · " + moeda(p.saldo))]));
      raiz.appendChild(ponto);
    });
    if (c.acabaAos !== null) raiz.appendChild(svg("text", { x: W - M.r, y: H - M.b - 8, "text-anchor": "end", class: "gv-acaba" }, [document.createTextNode("O patrimônio acaba aos " + c.acabaAos + " anos")]));

    var antes = pts[0], noApos = cons[0] || pts[pts.length - 1];
    raiz.setAttribute("aria-label", "Patrimônio por idade em reais de hoje: " + moeda(antes.saldo) + " aos " + antes.idade + " anos, " + moeda(noApos.saldo) + " aos " + noApos.idade + " (aposentadoria), contra " + moeda(r.necessario) + " necessários; " + (c.acabaAos !== null ? "o patrimônio acaba aos " + c.acabaAos + " anos." : "o patrimônio dura até os " + ap().ate_idade + " anos."));
    caixa.appendChild(raiz);

    [["acum", "Acumulando (linha cheia)"], ["cons", "Consumindo na aposentadoria (tracejada)"], ["nec", "Capital necessário (pontilhada vermelha)"]].forEach(function (it) {
      var li = el("li");
      li.appendChild(el("span", { className: "amostra-linha " + it[0] }));
      li.appendChild(el("span", { textContent: it[1] }));
      leg.appendChild(li);
    });
  }

  // ---------------------------------------------------------------- tabelas e textos
  function tabelaIdades(r) {
    var idades = [], i;
    for (i = Number(ap().idade) + 1; i <= 70; i++) idades.push(i);
    if (idades.indexOf(Number(ap().aposentar)) < 0 && ap().aposentar <= 70) idades.push(Number(ap().aposentar));
    idades.sort(function (a, b) { return a - b; });
    var linhas = A.porIdade(ap(), idades), t = limpar("tabela-idades"), cab = el("tr");
    ["Idade", "Capital necessário", "Patrimônio projetado", "Falta", "Aporte extra/mês"].forEach(function (h) { cab.appendChild(el("th", { textContent: h, scope: "col" })); });
    t.appendChild(el("thead")).appendChild(cab);
    var corpo = el("tbody");
    linhas.forEach(function (l) {
      var tr = el("tr", { className: l.idade === Number(ap().aposentar) ? "destaque-linha" : "" });
      tr.appendChild(el("th", { textContent: l.idade + " anos", scope: "row" }));
      tr.appendChild(el("td", { textContent: moeda(l.necessario) }));
      tr.appendChild(el("td", { textContent: comSinal(l.patrimonio) }));
      tr.appendChild(el("td", { textContent: l.falta > 0 ? moeda(l.falta) : "–", className: l.falta > 0 ? "negativo" : "positivo" }));
      tr.appendChild(el("td", { textContent: l.extra > 0 ? moeda(l.extra) : "ok", className: l.extra > 0 ? "negativo" : "positivo" }));
      corpo.appendChild(tr);
    });
    t.appendChild(corpo);
    return linhas;
  }

  function desenharSugestoes(r, gasto) {
    var caixa = limpar("sugestoes"), itens = A.alavancas(ap(), r);
    if (r.falta <= 0 && gasto !== null) {
      var folga = el("div", { className: "advice bom" });
      folga.append(el("strong", { textContent: "Folga no plano" }), el("p", { textContent: "O patrimônio projetado sustenta até " + moeda(gasto) + " por mês (hoje o gasto planejado é " + moeda(ap().gasto) + ")." }));
      caixa.appendChild(folga);
    }
    itens.forEach(function (a) {
      var bloco = el("div", { className: "advice" + (a.ganhoFalta > 0.5 ? "" : " apagada") });
      bloco.appendChild(el("strong", { textContent: a.titulo }));
      bloco.appendChild(el("p", { textContent: a.detalhe }));
      bloco.appendChild(el("p", { className: "efeito", textContent: a.ganhoFalta > 0.5
        ? "A falta cai de " + moeda(Math.max(0, r.falta)) + " para " + moeda(Math.max(0, a.falta)) + (r.extra > 0 ? " e o aporte extra de " + moeda(r.extra) + " para " + moeda(a.extra) + " por mês." : ".")
        : "Sem efeito relevante: a meta já está coberta." }));
      caixa.appendChild(bloco);
    });
  }

  function pctTexto(v) { return Math.round(v * 100) + "%"; }
  function retornoTexto(v) { return (Math.round(v * 10) / 10).toString().replace(".", ",") + "%"; }

  var temporizadorCenarios = null;

  function desenharCenarios() {
    var cs = A.cenarios(ap()), t = limpar("tabela-cenarios");
    if (cs.erros.length) return;
    var cols = [["Pessimista", cs.pessimista, "−" + String(cs.variacao).replace(".", ",") + " pontos"], ["Base", cs.base, "premissas atuais"], ["Otimista", cs.otimista, "+" + String(cs.variacao).replace(".", ",") + " pontos"]];
    var cab = el("tr");
    cab.appendChild(el("th", { textContent: "", scope: "col" }));
    cols.forEach(function (c) { var th = el("th", { scope: "col" }); th.appendChild(document.createTextNode(c[0])); th.appendChild(el("small", { textContent: c[2] })); cab.appendChild(th); });
    t.appendChild(el("thead")).appendChild(cab);
    var corpo = el("tbody");
    function linha(rotulo, fn, forte) {
      var tr = el("tr", { className: forte ? "destaque-linha" : "" });
      tr.appendChild(el("th", { textContent: rotulo, scope: "row" }));
      cols.forEach(function (c) { tr.appendChild(el("td", { textContent: fn(c[1]) })); });
      corpo.appendChild(tr);
    }
    linha("Retorno da corretora (nominal/ano)", function (c) { return retornoTexto(c.retornoXP); });
    linha("Retorno da previdência (nominal/ano)", function (c) { return retornoTexto(c.retornoPrev); });
    linha("Retorno real na aposentadoria", function (c) { return retornoTexto(c.retornoReal); });
    linha("Patrimônio projetado", function (c) { return comSinal(c.patrimonio); });
    linha("Capital necessário", function (c) { return moeda(c.necessario); });
    linha("Meta atingida", function (c) { return pctTexto(c.pctMeta); }, true);
    linha("Falta", function (c) { return c.falta > 0 ? moeda(c.falta) : "–"; });
    linha("Aporte extra por mês", function (c) { return c.extra > 0 ? moeda(c.extra) : "ok"; });
    linha("O patrimônio dura", function (c) { return c.acabaAos === null ? "até os " + ap().ate_idade + " anos" : "até os " + c.acabaAos + " anos"; });
    t.appendChild(corpo);

    var p = cs.pessimista, o = cs.otimista;
    var inicio = "No cenário pessimista a meta cobre " + pctTexto(p.pctMeta) + " e o aporte extra sobe para " + (p.extra > 0 ? moeda(p.extra) : "nada") + " por mês; no otimista cobre " + pctTexto(o.pctMeta) + ".";
    texto("texto-cenarios", inicio);
    // a busca do retorno que fecha o plano é mais pesada: espera a pessoa parar de digitar
    clearTimeout(temporizadorCenarios);
    temporizadorCenarios = setTimeout(function () {
      var fechar = A.retornoParaFechar(ap());
      texto("texto-cenarios", inicio
      + (fechar === null ? " Nem 15 pontos a mais de retorno fecham o plano sem aporte extra." : fechar === 0 ? " Com as premissas atuais o plano já fecha sem aporte extra." : " Para fechar o plano sem aporte extra seria preciso cerca de " + (Math.round(fechar * 10) / 10).toString().replace(".", ",") + " pontos a mais de retorno em todas as contas, o que costuma exigir mais risco."));
    }, 400);
  }

  function atualizar() {
    var erros = A.validar(ap()), area = document.getElementById("resultado"), alerta = document.getElementById("erros");
    var r = erros.length ? { erros: erros } : A.calcular(ap());
    if (r.erros && r.erros.length) {
      alerta.hidden = false; alerta.textContent = r.erros.join(" "); area.hidden = true;
      ["k-necessario", "k-patrimonio", "k-meta", "k-extra"].forEach(function (id) { texto(id, "–"); });
      ["k-necessario-det", "k-patrimonio-det", "k-meta-det", "k-extra-det"].forEach(function (id) { texto(id, ""); });
      return;
    }
    alerta.hidden = true; area.hidden = false;
    var c = A.ciclo(ap(), r), data = dataTexto(r.dataAposentar), ok = r.falta <= 0;

    texto("rot-necessario", "Capital necessário aos " + ap().aposentar);
    texto("k-necessario", moeda(r.necessario));
    texto("k-necessario-det", "para gastar " + moeda(ap().gasto) + "/mês até os " + ap().ate_idade);
    texto("k-patrimonio", comSinal(r.patrimonio));
    texto("k-patrimonio-det", "em " + data + ", em reais de hoje");
    texto("k-meta", Math.round(r.pctMeta * 100) + "%");
    texto("k-meta-det", ok ? "meta coberta" : "faltam " + moeda(r.falta));
    texto("k-extra", ok ? "nenhum" : moeda(r.extra));
    texto("k-extra-det", ok ? "o ritmo atual já basta" : "por mês, até " + data);
    document.getElementById("caixa-extra").className = "kpi resultado " + (ok ? "positivo" : "negativo");
    document.getElementById("caixa-meta").className = "kpi" + (ok ? " bom" : "");

    var gasto = A.gastoMaximo(ap());
    texto("texto-veredito", "Aposentando aos " + ap().aposentar + " anos (" + data + ") com " + moeda(ap().gasto) + " por mês, o patrimônio projetado cobre " + Math.round(r.pctMeta * 100) + "% do capital necessário"
      + (c.acabaAos !== null ? " e acaba aos " + c.acabaAos + " anos." : " e dura até os " + ap().ate_idade + " anos.")
      + (ok ? " A meta está coberta." : " Faltam " + moeda(r.falta) + ", o que equivale a " + moeda(r.extra) + " por mês de aporte extra até lá."));
    var semCustos = !(Number(ap().imposto) > 0) && !(Number(ap().custo) > 0);
    document.getElementById("aviso-bruto").hidden = !semCustos;
    texto("nota-veredito", gasto === null ? "Nem sem gastar nada o patrimônio projetado cobre as retiradas desse período." : "Com esse patrimônio, o gasto mensal máximo que fecha a conta é de " + moeda(gasto) + " (hoje o planejado é " + moeda(ap().gasto) + ").");
    var barra = document.getElementById("barra-meta");
    document.getElementById("barra-meta-preenche").style.width = Math.max(0, Math.min(100, r.pctMeta * 100)) + "%";
    barra.className = "barra-meta" + (ok ? " bom" : "");
    barra.setAttribute("aria-label", Math.round(r.pctMeta * 100) + "% do capital necessário já está projetado");

    grafico(c, r);
    texto("sub-necessario", "Capital necessário aos " + ap().aposentar);
    var cn = limpar("comp-necessario");
    cn.append(
      linhaLista("Ponte até o INSS (" + Math.max(0, ap().inss_idade - ap().aposentar) + " anos de gasto cheio)", moeda(r.ponte)),
      linhaLista("Complemento (gasto − INSS) depois do INSS", moeda(r.pos)),
      linhaLista("Parcelas de consórcio ainda a pagar", moeda(r.consorcios)),
      linhaLista("Total necessário", moeda(r.necessario), "total")
    );
    var cp = limpar("comp-patrimonio");
    cp.append(
      linhaLista("Corretora XP", moeda(r.xp)),
      linhaLista("Previdência privada", moeda(r.prev)),
      linhaLista("(−) Imposto estimado no resgate (" + (Number(ap().imposto) || 0) + "%)", r.imposto > 0 ? "− " + moeda(r.imposto) : moeda(0)),
      linhaLista("(−) Déficit do orçamento até lá", r.deficit > 0 ? "− " + moeda(r.deficit) : moeda(0)),
      linhaLista("Patrimônio projetado", comSinal(r.patrimonio), "total")
    );
    tabelaIdades(r);
    desenharCenarios();
    desenharSugestoes(r, gasto);
  }

  function desenhar() {
    P.desenharCabecalho();
    desenharCampos();
    atualizar();
  }

  P.iniciarCabecalho(desenhar);
  document.getElementById("ap-consorcios").addEventListener("change", function (e) { ap().consorcios = e.target.checked; salvar(); atualizar(); });
  desenhar();
})();
