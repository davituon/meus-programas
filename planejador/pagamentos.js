// Página Pagamentos: marca o que já foi pago no mês (com a data) e o que está pendente.
(function () {
  "use strict";

  var P = window.Plano, moeda = P.moeda, el = P.el, texto = P.texto, limpar = P.limpar;
  var filtro = "todas";
  var NOMES_GRUPO = { despesa: "Despesa", consorcio: "Consórcio", cartao: "Cartão" };

  function dataBr(iso) { var p = iso.split("-"); return p[2] + "/" + p[1] + "/" + p[0]; }
  function ref() { return P.estado.dados.ref; }

  function comSinal(v) { return (v < 0 ? "− " : "+ ") + moeda(Math.abs(v)); }

  function textoEstado(c) {
    if (c.pago) return "✓ Pago em " + dataBr(c.pago) + (Math.abs(c.diferenca) >= 0.005 ? " (" + comSinal(c.diferenca) + ")" : "");
    if (c.situacao === "atrasada") return "⚠ Atrasada há " + (-c.dias) + (c.dias === -1 ? " dia" : " dias");
    if (c.situacao === "hoje") return "! Vence hoje";
    if (c.situacao === "proxima") return "! Vence em " + c.dias + (c.dias === 1 ? " dia" : " dias") + " (" + dataBr(c.venc).slice(0, 5) + ")";
    return c.venc ? "○ Vence em " + dataBr(c.venc).slice(0, 5) : "○ Pendente";
  }

  function linha(c) {
    var r = ref(), li = el("li", { className: "pg-item " + (c.pago ? "paga" : "pendente") + (c.situacao === "atrasada" ? " atrasada" : c.situacao === "hoje" || c.situacao === "proxima" ? " alerta" : "") });
    var marca = el("label", { className: "pg-marca" });
    var caixa = el("input", { type: "checkbox", checked: !!c.pago });
    caixa.setAttribute("aria-label", "Pago: " + c.nome);
    caixa.addEventListener("change", function () { P.pagamentos.marcar(r.ano, r.mes, c.chave, caixa.checked ? P.pagamentos.hoje() : null); desenhar(); });
    marca.appendChild(caixa);
    li.appendChild(marca);
    var corpo = el("div", { className: "pg-corpo" });
    corpo.appendChild(el("strong", { textContent: c.nome }));
    corpo.appendChild(el("small", { textContent: NOMES_GRUPO[c.grupo] }));
    li.appendChild(corpo);
    li.appendChild(el("b", { className: "pg-valor", textContent: moeda(c.valor) }));
    var dia = el("input", { type: "number", className: "pg-dia", min: 1, max: 31, step: 1, value: c.dia || "", placeholder: "dia" });
    dia.setAttribute("aria-label", "Dia do vencimento: " + c.nome);
    dia.title = "Dia do mês em que vence (1 a 31). Vazio = sem vencimento.";
    dia.addEventListener("change", function () { if (P.pagamentos.definirDia(c, dia.value)) desenhar(); else dia.value = c.dia || ""; });
    li.appendChild(dia);
    li.appendChild(el("span", { className: "pg-estado", textContent: textoEstado(c) }));
    var data = el("input", { type: "date", className: "pg-data", value: c.pago || "", disabled: !c.pago });
    data.setAttribute("aria-label", "Data do pagamento: " + c.nome);
    data.addEventListener("change", function () {
      if (data.value && P.pagamentos.marcar(r.ano, r.mes, c.chave, data.value)) desenhar();
      else data.value = c.pago || "";
    });
    li.appendChild(data);
    if (c.pago) {
      var real = P.campoNumero({ moeda: true, prefixo: "R$", valor: c.real, rotulo: "Valor realmente pago: " + c.nome });
      real.caixa.classList.add("pg-real");
      real.caixa.title = "Quanto foi realmente pago. Se for igual ao previsto, deixe como está.";
      real.campo.addEventListener("change", function () {
        var v = P.lerNumero(real.campo.value);
        if (v > 0 && P.pagamentos.definirReal(r.ano, r.mes, c.chave, v)) desenhar(); else { real.campo.value = P.formatoNumero.format(c.real); }
      });
      li.appendChild(real.caixa);
    } else {
      li.appendChild(el("span", { className: "pg-real vazio-real" }));
    }
    return li;
  }

  function desenhar() {
    P.desenharCabecalho();
    var r = ref(), todas = P.pagamentos.contas(r.ano, r.mes), s = P.pagamentos.resumo(todas);
    texto("k-total", moeda(s.total));
    texto("k-total-det", s.qtd + (s.qtd === 1 ? " conta" : " contas") + " em " + P.MESES_LONGOS[r.mes - 1].toLowerCase() + "/" + r.ano);
    texto("k-pago", moeda(s.pagoReal));
    texto("k-pago-det", s.qtdPagas + (s.qtdPagas === 1 ? " conta paga" : " contas pagas") + (s.qtdPagas === 0 ? "" : Math.abs(s.desvio) < 0.005 ? ", igual ao previsto" : ", " + moeda(Math.abs(s.desvio)) + (s.desvio > 0 ? " acima do previsto" : " abaixo do previsto")));
    texto("k-pendente", moeda(s.pendente));
    texto("k-pendente-det", s.qtdPendentes === 0 ? "tudo pago" : s.qtdAtrasadas ? s.qtdAtrasadas + " atrasada(s) · " + s.qtdPendentes + " a pagar" : s.qtdPendentes + (s.qtdPendentes === 1 ? " conta a pagar" : " contas a pagar"));
    var aviso = document.getElementById("pg-aviso");
    aviso.hidden = !(s.qtdAtrasadas || s.qtdProximas);
    var partes = [];
    if (s.qtdAtrasadas) partes.push("⚠ " + s.qtdAtrasadas + (s.qtdAtrasadas === 1 ? " conta atrasada" : " contas atrasadas") + " (" + moeda(s.atrasado) + ")");
    if (s.qtdProximas) partes.push("! " + s.qtdProximas + (s.qtdProximas === 1 ? " vence" : " vencem") + " hoje ou nos próximos 7 dias");
    aviso.textContent = partes.join(" · ");
    aviso.className = "pg-aviso" + (s.qtdAtrasadas ? " critico" : "");
    document.getElementById("caixa-pendente").className = "kpi resultado " + (s.qtd > 0 && s.qtdPendentes === 0 ? "positivo" : s.pendente > 0 ? "negativo" : "");
    var pct = s.total > 0 ? s.pago / s.total : 0;
    texto("k-pct", Math.round(pct * 100) + "%");
    document.getElementById("pg-barra-pago").style.width = (pct * 100) + "%";
    document.getElementById("marcar-todas").disabled = s.qtdPendentes === 0;

    Array.prototype.forEach.call(document.querySelectorAll(".pg-filtros button"), function (b) { b.setAttribute("aria-pressed", b.getAttribute("data-filtro") === filtro ? "true" : "false"); });
    var ul = limpar("contas"), vis = todas.filter(function (c) { return filtro === "todas" || (filtro === "pagas" ? !!c.pago : !c.pago); });
    vis.forEach(function (c) { ul.appendChild(linha(c)); });
    gastos();
    historico();
    if (!vis.length) ul.appendChild(el("li", { className: "vazio", textContent: !todas.length ? "Nenhuma conta neste mês." : filtro === "pagas" ? "Nenhuma conta paga ainda." : "Nenhuma conta pendente." }));
  }

  // ---------------------------------------------------------------- gastos do dia a dia
  var G = P.gastos, lembrar = { linha: "outros", via: "avulso" };
  var SITUACAO = { dentro: "✓ dentro do orçado", perto: "! perto do limite", estourou: "⚠ estourou" };

  function dataPadrao() {
    var r = ref(), hojeIso = P.pagamentos.hoje();
    return hojeIso.slice(0, 7) === P.pagamentos.chaveMes(r.ano, r.mes) ? hojeIso : P.pagamentos.chaveMes(r.ano, r.mes) + "-01";
  }

  function gastos() {
    var r = ref(), caixa = limpar("gasto-form"), d = P.estado.dados, linhas = G.linhasDoMes(r.ano, r.mes);
    var rot = function (t, filho) { var l = el("label"); l.appendChild(document.createTextNode(t)); l.appendChild(filho); return l; };
    var data = el("input", { type: "date", value: dataPadrao() });
    var valor = el("input", { type: "text", className: "mini", inputMode: "decimal", placeholder: "0,00" });
    valor.setAttribute("aria-label", "Valor do gasto");
    var linha = el("select", { className: "mini" });
    linha.setAttribute("aria-label", "Linha do orçamento");
    linhas.forEach(function (l) { linha.appendChild(el("option", { value: l.chave, textContent: l.nome, selected: l.chave === lembrar.linha })); });
    linha.appendChild(el("option", { value: "outros", textContent: "Outros (sem linha)", selected: lembrar.linha === "outros" }));
    var via = el("select", { className: "mini" });
    via.setAttribute("aria-label", "Como foi pago");
    via.appendChild(el("option", { value: "avulso", textContent: "Pix, débito ou dinheiro", selected: lembrar.via === "avulso" }));
    d.cartao.cartoes.forEach(function (c) { via.appendChild(el("option", { value: c.id, textContent: "Cartão: " + c.nome, selected: c.id === lembrar.via })); });
    var nota = el("input", { type: "text", className: "mini", maxLength: 60, placeholder: "opcional" });
    nota.setAttribute("aria-label", "Observação do gasto");
    var ok = el("button", { type: "button", id: "gasto-lancar", textContent: "Lançar gasto" });
    ok.addEventListener("click", function () {
      lembrar.linha = linha.value; lembrar.via = via.value;
      var erro = G.lancar({ data: data.value, valor: valor.value, linha: linha.value, via: via.value, nota: nota.value });
      if (erro) { texto("gasto-erro", erro); return; }
      desenhar();
    });
    caixa.append(rot("Data", data), rot("Valor (R$)", valor), rot("Linha do orçamento", linha), rot("Pago com", via), rot("Observação", nota), ok);
    texto("gasto-erro", "");

    var c = G.comparar(r.ano, r.mes), tab = limpar("gasto-tabela"), lista = limpar("gasto-lista");
    if (!c.qtd) { texto("gasto-resumo", "Nenhum gasto lançado em " + P.MESES_LONGOS[r.mes - 1].toLowerCase() + ". Lance o primeiro acima."); return; }
    texto("gasto-resumo", "Em " + P.MESES_LONGOS[r.mes - 1].toLowerCase() + ": " + moeda(c.total) + " em " + c.qtd + (c.qtd === 1 ? " gasto" : " gastos") + (c.noCartao > 0 ? " (" + moeda(c.noCartao) + " no cartão)" : "") + (c.estouros ? ". ⚠ " + c.estouros + (c.estouros === 1 ? " linha estourou" : " linhas estouraram") + " o orçado." : ". Nenhuma linha estourou."));
    var cab = el("tr");
    ["Linha", "Orçado", "Gasto", "% do orçado", "Saldo", "Situação"].forEach(function (h) { cab.appendChild(el("th", { textContent: h, scope: "col" })); });
    tab.appendChild(el("thead")).appendChild(cab);
    var corpo = el("tbody");
    c.itens.forEach(function (i) {
      var tr = el("tr", { className: i.situacao === "estourou" ? "alerta-linha" : "" });
      tr.appendChild(el("th", { scope: "row", textContent: i.nome }));
      tr.appendChild(el("td", { textContent: moeda(i.orcado) }));
      tr.appendChild(el("td", { textContent: moeda(i.gasto) }));
      tr.appendChild(el("td", { textContent: Math.round(i.pct * 100) + "%" }));
      tr.appendChild(el("td", { textContent: (i.saldo < 0 ? "− " : "") + moeda(Math.abs(i.saldo)) }));
      tr.appendChild(el("td", { textContent: SITUACAO[i.situacao] }));
      corpo.appendChild(tr);
    });
    if (c.outros > 0) {
      var tro = el("tr"); tro.appendChild(el("th", { scope: "row", textContent: "Outros (sem linha)" }));
      tro.appendChild(el("td", { textContent: "–" })); tro.appendChild(el("td", { textContent: moeda(c.outros) })); tro.appendChild(el("td", { textContent: "–" })); tro.appendChild(el("td", { textContent: "–" })); tro.appendChild(el("td", { textContent: "–" }));
      corpo.appendChild(tro);
    }
    tab.appendChild(corpo);

    var nomes = {}; G.linhasDoMes(r.ano, r.mes).forEach(function (l) { nomes[l.chave] = l.nome; });
    var cartoes = {}; d.cartao.cartoes.forEach(function (k) { cartoes[k.id] = k.nome; });
    G.doMes(r.ano, r.mes).forEach(function (g) {
      var li = el("li", { className: "mi-item" });
      li.appendChild(el("span", { className: "mi-data", textContent: dataBr(g.data) }));
      li.appendChild(el("span", { textContent: (nomes[g.linha] || "Outros") + (g.nota ? " · " + (P.estado.oculto ? "••••" : g.nota) : "") + " · " + (g.via === "avulso" ? "Pix, débito ou dinheiro" : "cartão " + (cartoes[g.via] || "")) }));
      li.appendChild(el("b", { className: "mi-valor", textContent: moeda(g.valor) }));
      var rm = el("button", { type: "button", className: "remover", textContent: "✕" });
      rm.setAttribute("aria-label", "Remover o gasto de " + dataBr(g.data)); rm.title = "Remover";
      rm.addEventListener("click", function () { if (window.confirm("Remover este gasto" + (g.via === "avulso" ? "" : " e a compra correspondente no cartão") + "?")) { G.remover(g.id); desenhar(); } });
      li.appendChild(rm);
      lista.appendChild(li);
    });
  }

  function historico() {
    var r = ref(), linhas = P.pagamentos.historico({ ano: r.ano, mes: r.mes }, 12), corpo = limpar("historico");
    linhas.forEach(function (l) {
      var tr = el("tr", { className: l.ano === r.ano && l.mes === r.mes ? "destaque-linha" : "" });
      tr.appendChild(el("th", { scope: "row", textContent: P.MESES[l.mes - 1] + "/" + l.ano }));
      tr.appendChild(el("td", { textContent: l.qtd ? moeda(l.previsto) : "–" }));
      tr.appendChild(el("td", { textContent: l.qtdPagas ? moeda(l.pagoReal) : "–" }));
      var desvio = el("td", { textContent: !l.qtdPagas ? "–" : Math.abs(l.desvio) < 0.005 ? "igual" : comSinal(l.desvio) });
      if (l.qtdPagas && Math.abs(l.desvio) >= 0.005) desvio.className = l.desvio > 0 ? "negativo" : "positivo";
      tr.appendChild(desvio);
      tr.appendChild(el("td", { textContent: l.qtd ? (l.pendente > 0.005 ? moeda(l.pendente) : "0") : "–" }));
      tr.appendChild(el("td", { textContent: l.qtd ? l.qtdPagas + " de " + l.qtd + (l.qtdAtrasadas ? " · " + l.qtdAtrasadas + " atrasada(s)" : "") : "–" }));
      corpo.appendChild(tr);
    });
    if (!linhas.length) { var tr0 = el("tr"); tr0.appendChild(el("td", { colSpan: 6, className: "vazio", textContent: "Sem meses a mostrar." })); corpo.appendChild(tr0); }
  }

  Array.prototype.forEach.call(document.querySelectorAll(".pg-filtros button"), function (b) {
    b.addEventListener("click", function () { filtro = b.getAttribute("data-filtro"); desenhar(); });
  });
  document.getElementById("marcar-todas").addEventListener("click", function () { var r = ref(); P.pagamentos.marcarTodas(r.ano, r.mes); desenhar(); });

  P.iniciarCabecalho(desenhar);
  desenhar();
})();
