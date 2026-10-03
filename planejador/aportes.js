// Página Aportes e consórcios: corretora XP, previdência e cotas de consórcio, mês a mês.
// Os dados e os cálculos ficam em comum.js (compartilhado com a página Orçamento).
(function () {
  "use strict";

  var P = window.Plano, dados = P.estado.dados;
  var MESES = P.MESES, MESES_LONGOS = P.MESES_LONGOS, INICIO = P.INICIO;
  var moeda = P.moeda, moedaInteira = P.moedaInteira, lerAte = P.lerAte, formatarAte = P.formatarAte, indiceDe = P.indiceDe;
  var el = P.el, texto = P.texto, nomeMes = P.nomeMes, campoNumero = P.campoNumero, salvar = P.salvar, antesDoInicio = P.antesDoInicio;

  var limpar = P.limpar, soma = P.soma;
  var serie = null;

  function comSinal(v, f) { return v < 0 ? "− " + f(-v) : f(v); }
  function linhaLista(nome, valor, classe) {
    var li = el("li", { className: classe || "" });
    li.appendChild(el("span", { textContent: nome }));
    li.appendChild(el("b", { textContent: valor }));
    return li;
  }

  // ---------------------------------------------------------------- contas (campos editáveis)
  function campoRotulado(rotulo, campo) {
    var bloco = el("label", { className: "campo-reajuste" });
    bloco.appendChild(el("span", { textContent: rotulo }));
    bloco.appendChild(campo.caixa);
    return bloco;
  }

  function campoValor(rotulo, valor, aoMudar) {
    var c = campoNumero({ moeda: true, valor: valor, prefixo: "R$", rotulo: rotulo });
    c.campo.addEventListener("input", function () { aoMudar(P.lerNumero(c.campo.value)); salvar(); atualizar(); });
    return campoRotulado(rotulo, c);
  }

  function campoPct(rotulo, valor, aoMudar) {
    var c = campoNumero({ passo: "0.5", valor: valor, sufixo: "%", rotulo: rotulo + " ao ano" });
    c.campo.min = "-20"; c.campo.max = "60";
    c.campo.addEventListener("input", function () { aoMudar(parseFloat(c.campo.value) || 0); salvar(); atualizar(); });
    return campoRotulado(rotulo, c);
  }

  function desenharContas() {
    var A = dados.aportes, xp = limpar("campos-xp"), pv = limpar("campos-prev");
    xp.append(
      campoValor("Saldo hoje (out/2026)", A.xp.saldo, function (v) { A.xp.saldo = v; }),
      campoPct("Retorno nominal ao ano", A.xp.retorno, function (v) { A.xp.retorno = v; })
    );
    pv.append(
      campoValor("Saldo hoje (out/2026)", A.prev.saldo, function (v) { A.prev.saldo = v; }),
      campoPct("Retorno nominal ao ano", A.prev.retorno, function (v) { A.prev.retorno = v; }),
      campoValor("Contrapartida da empresa por mês", A.prev.empresa, function (v) { A.prev.empresa = v; })
    );
  }

  // ---------------------------------------------------------------- formação do aporte do mês
  function desenharFormacao(c) {
    var xp = limpar("form-xp"), pv = limpar("form-prev"), d = dados, ref = d.ref;
    d.reservas.forEach(function (r) {
      if (r.aporte) xp.appendChild(linhaLista(r.nome + " (" + r.pct + "% da receita total)", moeda(c.r * (Number(r.pct) || 0) / 100)));
    });
    xp.appendChild(linhaLista(c.sobra < 0 ? "Falta do mês (despesas acima da receita líquida)" : "Sobra do mês", comSinal(c.sobra, moeda)));
    xp.appendChild(linhaLista("Aporte para a XP", comSinal(c.aporteXP, moeda), "total"));

    d.folha.forEach(function (f) {
      if (f.prev && P.ativo(f, ref.ano, ref.mes)) pv.appendChild(linhaLista(f.nome + " (desconto em folha)", moeda((Number(f.valor) || 0) * P.fator(P.taxaDoItem("folha", f), ref.ano))));
    });
    pv.appendChild(linhaLista("Contrapartida da empresa", moeda(c.prevEmpresa)));
    pv.appendChild(linhaLista("Aporte para a previdência", moeda(c.aportePrev), "total"));

    texto("nota-formacao", c.sobra < 0
      ? "O mês fechou no vermelho: a falta reduz o aporte para a XP (na prática, é dinheiro que sai da conta para cobrir as despesas)."
      : "As reservas marcadas \"No aporte\" na página Orçamento e a sobra do mês vão para a corretora. Os descontos de previdência da folha vão para a previdência.");
  }

  // ---------------------------------------------------------------- gráfico de evolução
  function desenharEvolucao() {
    var caixa = limpar("evolucao"), leg = limpar("legenda-evolucao");
    var fimAno = {};
    serie.linhas.forEach(function (l) { fimAno[l.ano] = l; });
    var anos = Object.keys(fimAno).map(Number).sort();
    var maximo = Math.max.apply(null, anos.map(function (a) { return fimAno[a].saldoXP + fimAno[a].saldoPrev; }).concat([1]));
    anos.forEach(function (a) {
      var l = fimAno[a], total = l.saldoXP + l.saldoPrev;
      var col = el("div", { className: "col-ano" + (a === dados.ref.ano ? " atual" : "") });
      col.title = a + " · XP " + moeda(l.saldoXP) + " · Previdência " + moeda(l.saldoPrev) + " · Total " + moeda(total);
      var pilha = el("div", { className: "pilha" });
      var sx = el("span", { className: "seg-xp" }), sp = el("span", { className: "seg-prev" });
      sx.style.height = (Math.max(0, l.saldoXP) / maximo * 100) + "%";
      sp.style.height = (Math.max(0, l.saldoPrev) / maximo * 100) + "%";
      pilha.append(sx, sp);
      col.append(pilha, el("small", { textContent: String(a).slice(2) }));
      caixa.appendChild(col);
    });
    var primeiro = fimAno[anos[0]], ultimo = fimAno[anos[anos.length - 1]];
    caixa.setAttribute("aria-label", "Patrimônio investido no fim de cada ano, de " + moeda(primeiro.saldoXP + primeiro.saldoPrev) + " em " + anos[0] + " a " + moeda(ultimo.saldoXP + ultimo.saldoPrev) + " em " + anos[anos.length - 1] + ".");
    [["xp", "Corretora XP"], ["prev", "Previdência"]].forEach(function (it) {
      var li = el("li");
      li.appendChild(el("span", { className: "amostra " + it[0] }));
      li.appendChild(el("span", { textContent: it[1] }));
      leg.appendChild(li);
    });
    var anoMax = anos.filter(function (a) { return fimAno[a].saldoXP + fimAno[a].saldoPrev === maximo; })[0];
    leg.appendChild(el("li", { className: "escala", textContent: "A coluna mais alta" + (anoMax ? " (" + anoMax + ")" : "") + " vale " + moeda(maximo) }));
  }

  // ---------------------------------------------------------------- tabelas mês a mês
  /** def: [rótulo, função(linha) -> valor, "fluxo"|"saldo", classe]. Ano: soma (fluxo) ou valor do último mês (saldo). */
  function desenharTabela(idTabela, defs) {
    var ano = dados.ref.ano, tabela = limpar(idTabela), meses = [], i;
    for (i = 1; i <= 12; i++) meses.push(P.linhaDoMes(serie, ano, i));
    P.cabecalhoMeses(tabela, ano, desenhar);
    var corpo = el("tbody");
    defs.forEach(function (def) {
      var tr = el("tr", { className: def[3] || "" });
      tr.appendChild(el("th", { textContent: def[0], scope: "row" }));
      var totalAno = 0, ultimo = null;
      meses.forEach(function (l, k) {
        if (l === null) { tr.appendChild(el("td", { className: "antes", textContent: "–", title: "Antes do início do plano (" + P.rotuloInicio() + ")" })); return; }
        var v = def[1](l);
        totalAno += v; ultimo = v;
        var td = el("td", { textContent: comSinal(v, moedaInteira), title: moeda(v) });
        if (k + 1 === dados.ref.mes) td.className = "atual";
        tr.appendChild(td);
      });
      var anual = def[2] === "saldo" ? (ultimo === null ? 0 : ultimo) : totalAno;
      tr.appendChild(el("td", { className: "ano", textContent: comSinal(anual, moedaInteira), title: moeda(anual) }));
      corpo.appendChild(tr);
    });
    tabela.appendChild(corpo);
    P.centrarTabela(tabela);
  }

  function desenharTabelas() {
    desenharTabela("tabela-aportes", [
      ["Aporte para a XP", function (l) { return l.aporteXP; }, "fluxo"],
      ["Aporte para a previdência", function (l) { return l.aportePrev; }, "fluxo"],
      ["Rendimento do mês", function (l) { return l.rendimento; }, "fluxo"],
      ["Saldo na corretora XP", function (l) { return l.saldoXP; }, "saldo"],
      ["Déficit acumulado (despesas sem cobertura)", function (l) { return l.deficit; }, "saldo", "alerta-linha"],
      ["Saldo na previdência", function (l) { return l.saldoPrev; }, "saldo"],
      ["Patrimônio investido", function (l) { return l.saldoXP + l.saldoPrev; }, "saldo", "forte"],
      ["Consórcio: parcelas do mês", function (l) { return l.parcelas; }, "fluxo"],
      ["Consórcio: pago até a contemplação", function (l) { return soma(l.acumAte); }, "saldo", "forte"]
    ]);
    var defs = serie.cotas.map(function (d, i) {
      return [d.nome || "Cota " + (i + 1), function (l) { return l.acumAte[i]; }, "saldo"];
    });
    defs.push(["Total pago até a contemplação", function (l) { return soma(l.acumAte); }, "saldo", "forte"]);
    defs.push(["Total pago (inclusive depois da contemplação)", function (l) { return soma(l.acumTotal); }, "saldo"]);
    desenharTabela("tabela-cotas", defs);
  }

  // ---------------------------------------------------------------- cotas de consórcio
  function desenharCotas() {
    var caixa = limpar("cotas"), sel = limpar("sel-nova-cota");
    var cotas = dados.despesas.filter(function (d) { return d.cota; });
    if (cotas.length === 0) caixa.appendChild(el("p", { className: "vazio", textContent: "Nenhuma cota marcada ainda." }));
    cotas.forEach(function (d, i) {
      var bloco = el("article", { className: "cota" });
      var topo = el("div", { className: "cota-topo" });
      topo.appendChild(el("h3", { textContent: d.nome || "Cota " + (i + 1) }));
      topo.appendChild(el("span", { className: "chip-status", id: "cota-status-" + i }));
      var rm = el("button", { type: "button", className: "remover", textContent: "✕", title: "Remover da lista de cotas (a despesa continua na página Orçamento)" });
      rm.setAttribute("aria-label", "Remover " + d.nome + " da lista de cotas");
      rm.addEventListener("click", function () { delete d.cota; salvar(); desenhar(); });
      topo.appendChild(rm);
      bloco.appendChild(topo);
      bloco.appendChild(el("p", { className: "nota", id: "cota-info-" + i, textContent: "" }));

      var campos = el("div", { className: "campos" });
      campos.appendChild(campoValor("Carta de crédito", d.cota.carta, function (v) { d.cota.carta = v; }));
      campos.appendChild(campoValor("Já pago antes de " + P.rotuloInicio(), d.cota.pago, function (v) { d.cota.pago = v; }));
      var contemp = el("input", { type: "text", className: "mini", value: formatarAte(d.cota.contemplacao), placeholder: "mm/aaaa", maxLength: 7, title: "Mês da contemplação (ex.: 06/2030). Vazio = ainda sem previsão." });
      contemp.setAttribute("aria-label", "Contemplação de " + d.nome);
      contemp.addEventListener("change", function () {
        var novo = lerAte(contemp.value);
        if (novo === null) { contemp.setAttribute("aria-invalid", "true"); return; }
        contemp.removeAttribute("aria-invalid");
        d.cota.contemplacao = novo; salvar(); atualizar();
      });
      var bc = el("label", { className: "campo-reajuste" });
      bc.append(el("span", { textContent: "Contemplação (mm/aaaa)" }), contemp);
      campos.appendChild(bc);
      bloco.appendChild(campos);

      var numeros = el("div", { className: "cota-numeros" });
      [["ate", "Pago até a contemplação"], ["total", "Pago no total"], ["pct", "Da carta já paga"]].forEach(function (n) {
        var cx = el("div");
        cx.append(el("span", { textContent: n[1] }), el("strong", { id: "cota-" + n[0] + "-" + i }));
        numeros.appendChild(cx);
      });
      bloco.appendChild(numeros);
      var prog = el("div", { className: "progresso", role: "img" });
      prog.appendChild(el("span", { id: "cota-barra-" + i }));
      prog.id = "cota-prog-" + i;
      bloco.appendChild(prog);
      caixa.appendChild(bloco);
    });

    var candidatas = dados.despesas.filter(function (d) { return !d.cota; });
    candidatas.forEach(function (d) { sel.appendChild(el("option", { value: dados.despesas.indexOf(d), textContent: d.nome || "(sem nome)" })); });
    document.getElementById("btn-nova-cota").disabled = candidatas.length === 0;
  }

  function atualizarCotas(l) {
    var cotas = serie.cotas, ref = dados.ref, idxRef = ref.ano * 12 + ref.mes - 1;
    var totAte = 0, totTotal = 0, totCarta = 0;
    cotas.forEach(function (d, i) {
      var ate = l.acumAte[i], total = l.acumTotal[i], carta = Number(d.cota.carta) || 0;
      var contemp = indiceDe(d.cota.contemplacao);
      var pct = carta > 0 ? ate / carta : null;
      totAte += ate; totTotal += total; totCarta += carta;
      var status = contemp === null ? "Aguardando contemplação" : contemp <= idxRef ? "Contemplada em " + formatarAte(d.cota.contemplacao) : "Contemplação prevista para " + formatarAte(d.cota.contemplacao);
      var st = document.getElementById("cota-status-" + i);
      st.textContent = status;
      st.className = "chip-status" + (contemp !== null && contemp <= idxRef ? " ok" : "");
      var nota = "Parcela de hoje: " + moeda(Number(d.valor) || 0) + "/mês" + (d.ate ? " · última parcela em " + formatarAte(d.ate) : "") + (d.reaj !== null && d.reaj !== undefined ? " · reajuste de " + d.reaj + "% ao ano" : "");
      texto("cota-info-" + i, nota);
      texto("cota-ate-" + i, moeda(ate));
      texto("cota-total-" + i, moeda(total));
      texto("cota-pct-" + i, pct === null ? "–" : Math.round(pct * 100) + "%");
      var barra = document.getElementById("cota-barra-" + i);
      barra.style.width = (pct === null ? 0 : Math.min(100, pct * 100)) + "%";
      document.getElementById("cota-prog-" + i).setAttribute("aria-label", pct === null ? "Sem carta informada" : Math.round(pct * 100) + "% da carta já pago até a contemplação");
    });
    texto("selo-cotas", moeda(totAte));
    var r = limpar("resumo-cotas");
    if (cotas.length) {
      var linhas = [["Cartas somam", moeda(totCarta)], ["Pago até a contemplação (soma das cotas)", moeda(totAte)], ["Pago no total", moeda(totTotal)], ["Parcelas deste mês", moeda(l.parcelas)]];
      var ul = el("ul", { className: "composicao" });
      linhas.forEach(function (x) { ul.appendChild(linhaLista(x[0], x[1], x[0].indexOf("Pago até") === 0 ? "total" : "")); });
      r.appendChild(ul);
    }
  }

  // ---------------------------------------------------------------- atualização
  function atualizar() {
    var ref = dados.ref, r = dados.reajuste;
    serie = P.serieAportes();
    var l = P.linhaDoMes(serie, ref.ano, ref.mes), c = l.c;
    var rotuloMes = nomeMes(ref.mes) + "/" + ref.ano;
    var rotuloModo = r.modo === "real" ? "reais de hoje" : "valores nominais";
    document.getElementById("sel-modo").value = r.modo;
    texto("nota-modo", r.modo === "real" ? "Inflação de " + r.inflacao + "% ao ano descontada: o retorno é mostrado como retorno real." : "Valores com reajuste e retorno nominal, sem descontar a inflação.");

    texto("rot-aporte", "Aporte em " + rotuloMes);
    texto("k-aporte", comSinal(l.aporteXP + l.aportePrev, moeda));
    texto("k-aporte-det", "XP " + comSinal(l.aporteXP, moeda) + " · Previdência " + moeda(l.aportePrev));
    texto("k-xp", moeda(l.saldoXP));
    texto("k-xp-det", l.deficit > 0 ? "zerada · déficit acumulado de " + moeda(l.deficit) : "fim de " + rotuloMes + " · rendeu " + moeda(l.rendXP) + " no mês");
    texto("k-prev", moeda(l.saldoPrev));
    texto("k-prev-det", "fim de " + rotuloMes + " · rendeu " + moeda(l.rendPrev) + " no mês");
    texto("k-cons", moeda(soma(l.acumAte)));
    texto("k-cons-det", "até a contemplação · pago no total " + moeda(soma(l.acumTotal)));

    var A = dados.aportes, infl = Number(r.inflacao) || 0;
    var real = function (x) { return ((1 + (Number(x) || 0) / 100) / (1 + infl / 100) - 1) * 100; };
    texto("nota-retorno", "Retorno nominal de " + A.xp.retorno + "% (XP) e " + A.prev.retorno + "% (previdência) ao ano. Descontada a inflação de " + infl + "%, equivale a " + real(A.xp.retorno).toFixed(2).replace(".", ",") + "% e " + real(A.prev.retorno).toFixed(2).replace(".", ",") + "% reais. Saldos de hoje: dados da sua corretora e do extrato da previdência.");

    var alerta = document.getElementById("alerta"), z = serie.primeiroZero, ultima = serie.linhas[serie.linhas.length - 1];
    alerta.hidden = !z;
    if (z) {
      alerta.textContent = "Atenção: com as premissas atuais, o saldo da corretora zera em " + nomeMes(z.mes) + "/" + z.ano +
        ". As despesas passam da receita e o dinheiro investido é consumido; em " + nomeMes(ultima.mes) + "/" + ultima.ano +
        " ainda faltariam " + moeda(ultima.deficit) + " para cobrir o orçamento. Revise despesas, reajustes ou receitas na página Orçamento.";
    }

    desenharFormacao(c);
    desenharEvolucao();
    desenharTabelas();
    atualizarCotas(l);
  }

  function desenhar() {
    P.desenharCabecalho();
    desenharContas();
    desenharCotas();
    atualizar();
  }

  // ---------------------------------------------------------------- eventos
  P.iniciarCabecalho(desenhar);
  document.getElementById("sel-modo").addEventListener("change", function (e) { dados.reajuste.modo = e.target.value; salvar(); atualizar(); });
  document.getElementById("btn-nova-cota").addEventListener("click", function () {
    var item = dados.despesas[Number(document.getElementById("sel-nova-cota").value)];
    if (!item) return;
    item.cota = { carta: 0, pago: 0, contemplacao: "" };
    salvar();
    desenhar();
  });

  desenhar();
})();
