// Página Pagamentos: marca o que já foi pago no mês (com a data) e o que está pendente.
(function () {
  "use strict";

  var P = window.Plano, moeda = P.moeda, el = P.el, texto = P.texto, limpar = P.limpar;
  var filtro = "todas";
  var NOMES_GRUPO = { despesa: "Despesa", consorcio: "Consórcio", cartao: "Cartão" };

  function dataBr(iso) { var p = iso.split("-"); return p[2] + "/" + p[1] + "/" + p[0]; }
  function ref() { return P.estado.dados.ref; }

  function textoEstado(c) {
    if (c.pago) return "✓ Pago em " + dataBr(c.pago);
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
    return li;
  }

  function desenhar() {
    P.desenharCabecalho();
    var r = ref(), todas = P.pagamentos.contas(r.ano, r.mes), s = P.pagamentos.resumo(todas);
    texto("k-total", moeda(s.total));
    texto("k-total-det", s.qtd + (s.qtd === 1 ? " conta" : " contas") + " em " + P.MESES_LONGOS[r.mes - 1].toLowerCase() + "/" + r.ano);
    texto("k-pago", moeda(s.pago));
    texto("k-pago-det", s.qtdPagas + (s.qtdPagas === 1 ? " conta paga" : " contas pagas"));
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
    if (!vis.length) ul.appendChild(el("li", { className: "vazio", textContent: !todas.length ? "Nenhuma conta neste mês." : filtro === "pagas" ? "Nenhuma conta paga ainda." : "Nenhuma conta pendente." }));
  }

  Array.prototype.forEach.call(document.querySelectorAll(".pg-filtros button"), function (b) {
    b.addEventListener("click", function () { filtro = b.getAttribute("data-filtro"); desenhar(); });
  });
  document.getElementById("marcar-todas").addEventListener("click", function () { var r = ref(); P.pagamentos.marcarTodas(r.ano, r.mes); desenhar(); });

  P.iniciarCabecalho(desenhar);
  desenhar();
})();
