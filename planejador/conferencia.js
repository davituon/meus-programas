// Página Conferência: mostra o que calculo-conferencia.js encontrou nos dados preenchidos.
(function () {
  "use strict";

  var P = window.Plano, moeda = P.moeda, el = P.el, texto = P.texto, limpar = P.limpar;
  var PAGINAS = { "index.html": "Orçamento", "aportes.html": "Aportes", "carteira.html": "Carteira", "cartao.html": "Cartão de crédito", "patrimonio.html": "Patrimônio", "aposentadoria.html": "Aposentadoria" };
  var NIVEIS = [
    ["atencao", "⚠ Atenção", "Atenção: provável erro ou risco real"],
    ["confirme", "? Confirme", "Confirme: valor de partida ou palpite que só você pode conferir"],
    ["info", "i Informação", "Informação"],
    ["ok", "✓ Tudo certo", "Conferido"]
  ];

  function linhaLista(nome, valor, classe) {
    var li = el("li", { className: classe || "" });
    li.appendChild(el("span", { textContent: nome }));
    li.appendChild(el("b", { textContent: valor }));
    return li;
  }

  function item(i, etiqueta) {
    var li = el("li", { className: "conf-item nivel-" + i.nivel });
    li.appendChild(el("span", { className: "conf-etiqueta", textContent: etiqueta }));
    var corpo = el("div", { className: "conf-corpo" });
    corpo.appendChild(el("strong", { textContent: i.titulo }));
    if (i.detalhe) corpo.appendChild(el("p", { textContent: i.detalhe }));
    li.appendChild(corpo);
    if (i.pagina && PAGINAS[i.pagina]) li.appendChild(el("a", { href: i.pagina, className: "conf-ir", textContent: "Abrir " + PAGINAS[i.pagina] + " →" }));
    return li;
  }

  // ---------------------------------------------------------------- conferir com o contracheque
  var CC = P.contracheque, ccSel = null;
  var ROTULO_SIT = { confere: "✓ Confere", proximo: "! Próximo", diferente: "⚠ Diferente", vazio: "–" };

  function comSinal(v) { return v === null ? "–" : (v < 0 ? "− " : "+ ") + moeda(Math.abs(v)); }

  /** Campo de valor opcional: vazio apaga, nada é preenchido sozinho. Com os valores ocultos, fica só leitura. */
  function campoOpcional(valor, rotulo, aoMudar) {
    var oculto = P.estado.oculto;
    var i = el("input", { type: "text", className: "mini", inputMode: "decimal", placeholder: "0,00", value: oculto ? (valor === null ? "" : "••••") : (valor === null ? "" : P.formatoNumero.format(valor)), readOnly: oculto });
    i.setAttribute("aria-label", rotulo);
    if (oculto) i.title = "Valores ocultos. Clique em \"Mostrar valores\" para editar.";
    i.addEventListener("change", function () {
      var vazio = i.value.trim() === "";
      if (aoMudar(vazio ? "" : P.lerNumero(i.value))) { i.removeAttribute("aria-invalid"); if (!vazio) i.value = P.formatoNumero.format(P.lerNumero(i.value)); atualizarContracheque(); }
      else i.setAttribute("aria-invalid", "true");
    });
    return i;
  }

  function mesEscolhido() {
    if (!ccSel) {
      var h = new Date(), idx = h.getFullYear() * 12 + h.getMonth() - 1; // por padrão, o último mês fechado
      if (idx < P.ANO_INICIAL * 12) idx = P.ANO_INICIAL * 12;
      ccSel = { ano: Math.floor(idx / 12), mes: idx % 12 + 1 };
    }
    return ccSel;
  }

  function montarContracheque() {
    var sel = mesEscolhido(), e = CC.ler(sel.ano, sel.mes);
    var m = document.getElementById("cc-mes"), a = document.getElementById("cc-ano");
    m.textContent = ""; a.textContent = "";
    P.MESES_LONGOS.forEach(function (n, i) { m.appendChild(el("option", { value: i + 1, textContent: n, selected: i + 1 === sel.mes })); });
    for (var y = P.ANO_INICIAL; y < P.ANO_INICIAL + 10; y++) a.appendChild(el("option", { value: y, textContent: y, selected: y === sel.ano }));

    var t = limpar("cc-resumo"), cab = el("tr");
    ["", "No plano", "No contracheque", "Diferença", "Situação"].forEach(function (h) { cab.appendChild(el("th", { textContent: h, scope: "col" })); });
    t.appendChild(el("thead")).appendChild(cab);
    var corpo = el("tbody");
    [["bruto", "Proventos (total de receitas)"], ["descontos", "Descontos em folha"], ["liquido", "Líquido a receber"]].forEach(function (c) {
      var tr = el("tr", { id: "cc-linha-" + c[0] });
      tr.appendChild(el("th", { scope: "row", textContent: c[1] }));
      tr.appendChild(el("td", { id: "cc-plano-" + c[0] }));
      var td = el("td"); td.appendChild(campoOpcional(e[c[0]] === undefined ? null : e[c[0]], c[1] + " no contracheque", function (v) { return CC.definir(sel.ano, sel.mes, c[0], v); })); tr.appendChild(td);
      tr.appendChild(el("td", { id: "cc-dif-" + c[0] }));
      tr.appendChild(el("td", { id: "cc-sit-" + c[0] }));
      corpo.appendChild(tr);
    });
    t.appendChild(corpo);

    var ti = limpar("cc-itens"), cab2 = el("tr");
    ["Item", "No plano", "No contracheque", "Diferença"].forEach(function (h) { cab2.appendChild(el("th", { textContent: h, scope: "col" })); });
    ti.appendChild(el("thead")).appendChild(cab2);
    var corpo2 = el("tbody"), grupoAtual = "";
    CC.itensDoMes(sel.ano, sel.mes).forEach(function (it) {
      if (it.rotuloGrupo !== grupoAtual) {
        grupoAtual = it.rotuloGrupo;
        var g = el("tr", { className: "cc-grupo" }); g.appendChild(el("th", { colSpan: 4, scope: "colgroup", textContent: grupoAtual })); corpo2.appendChild(g);
      }
      var tr = el("tr", { id: "cc-item-" + it.chave.replace(/[^A-Za-z0-9]/g, "_") });
      tr.setAttribute("data-chave", it.chave);
      tr.appendChild(el("th", { scope: "row", textContent: it.nome }));
      tr.appendChild(el("td", { textContent: moeda(it.previsto) }));
      var td = el("td"); td.appendChild(campoOpcional(typeof e.itens[it.chave] === "number" ? e.itens[it.chave] : null, it.nome + " no contracheque", function (v) { return CC.definir(sel.ano, sel.mes, it.chave, v); })); tr.appendChild(td);
      tr.appendChild(el("td", { className: "cc-dif-item" }));
      corpo2.appendChild(tr);
    });
    if (!corpo2.children.length) { var vz = el("tr"); vz.appendChild(el("td", { colSpan: 4, className: "vazio", textContent: "Nenhum item previsto neste mês." })); corpo2.appendChild(vz); }
    ti.appendChild(corpo2);
    atualizarContracheque();
  }

  /** Atualiza só os resultados (sem refazer os campos, para não tirar o cursor de quem está digitando). */
  function atualizarContracheque() {
    var sel = mesEscolhido(), r = CC.comparar(sel.ano, sel.mes), nomeMes = P.MESES_LONGOS[sel.mes - 1].toLowerCase() + " de " + sel.ano;
    ["bruto", "descontos", "liquido"].forEach(function (k) {
      var l = r.totais[k];
      texto("cc-plano-" + k, moeda(l.plano)); texto("cc-dif-" + k, comSinal(l.diferenca)); texto("cc-sit-" + k, ROTULO_SIT[l.situacao]);
      document.getElementById("cc-linha-" + k).className = l.situacao === "diferente" ? "alerta-linha" : "";
    });
    Array.prototype.forEach.call(document.querySelectorAll("#cc-itens tr[data-chave]"), function (tr) {
      var it = r.itens.filter(function (x) { return x.chave === tr.getAttribute("data-chave"); })[0];
      var td = tr.querySelector(".cc-dif-item");
      td.textContent = it && it.real !== null ? comSinal(it.diferenca) + (it.situacao === "diferente" ? " ⚠" : it.situacao === "proximo" ? " !" : " ✓") : "–";
      tr.className = it && it.situacao === "diferente" ? "alerta-linha" : "";
    });
    var v;
    if (r.veredito === "vazio") v = "Digite os totais do contracheque de " + nomeMes + " para comparar com o plano.";
    else if (r.veredito === "parcial") v = "Comparação parcial: informe também os outros totais para fechar a conferência de " + nomeMes + ".";
    else if (r.veredito === "confere") v = "✓ Os totais do contracheque de " + nomeMes + " batem com o plano.";
    else if (r.veredito === "proximo") v = "! Os totais de " + nomeMes + " estão próximos do plano (dentro de 3%). Horas extras, sobreaviso e imposto de renda mudam todo mês, então pequenas diferenças são normais.";
    else {
      var causas = [];
      if (r.totais.bruto.situacao === "diferente") causas.push("proventos " + comSinal(r.totais.bruto.diferenca) + " (confira se falta ou sobra alguma receita, ou se os extras do mês foram diferentes)");
      if (r.totais.descontos.situacao === "diferente") causas.push("descontos " + comSinal(r.totais.descontos.diferenca) + " (confira INSS, imposto de renda, previdência e outros itens da folha)");
      if (r.totais.liquido.situacao === "diferente") causas.push("líquido " + comSinal(r.totais.liquido.diferenca));
      v = "⚠ Há diferença relevante em " + nomeMes + ": " + causas.join("; ") + ". Use a comparação item a item para achar a linha diferente.";
    }
    texto("cc-veredito", v);

    var d = [];
    if (r.coerencia && !r.coerencia.ok) d.push("Atenção: proventos − descontos não dá o líquido que você digitou (diferença de " + comSinal(r.coerencia.diferenca) + "). Confira a digitação.");
    if (r.maior) d.push("Maior diferença item a item: " + r.maior.nome + " (" + comSinal(r.maior.diferenca) + ": plano " + moeda(r.maior.previsto) + ", contracheque " + moeda(r.maior.real) + ").");
    if (r.somaItens.qtd && r.faltando.length) d.push("Itens do plano sem valor no contracheque: " + r.faltando.join(", ") + ". Se o contracheque não tem essa linha, ela pode estar sobrando no plano.");
    texto("cc-detalhes", d.join(" "));
  }

  function desenhar() {
    P.desenharCabecalho();
    montarContracheque();
    var r = P.conferencia.verificar(), caixa = limpar("grupos"), ind = r.indicadores;

    texto("k-areas", r.areas.feitas + " de " + r.areas.total);
    texto("k-areas-det", r.areas.feitas === r.areas.total ? "tudo personalizado" : (r.areas.total - r.areas.feitas) + " ainda com valores de exemplo");
    texto("k-atencao", String(r.resumo.atencao));
    texto("k-confirme", String(r.resumo.confirme));
    document.getElementById("caixa-atencao").className = "kpi resultado " + (r.resumo.atencao > 0 ? "negativo" : "positivo");
    texto("k-vermelho", ind.mesesVermelho + " de 12");
    texto("k-vermelho-det", "resultado médio " + (ind.mediaSobra < 0 ? "− " : "") + moeda(Math.abs(ind.mediaSobra)) + " por mês");

    NIVEIS.forEach(function (n) {
      var lista = r.itens.filter(function (i) { return i.nivel === n[0]; });
      if (!lista.length) return;
      var cartao = el(n[0] === "ok" ? "details" : "section", { className: "cartao conf-grupo nivel-" + n[0] });
      if (n[0] === "ok") cartao.appendChild(el("summary", { textContent: n[1] + " (" + lista.length + ")" }));
      else cartao.appendChild(el("div", { className: "cartao-topo" })).appendChild(el("h2", { textContent: n[1] + " (" + lista.length + ")" }));
      var ul = el("ul", { className: "conf-lista" });
      ul.setAttribute("aria-label", n[2]);
      lista.forEach(function (i) { ul.appendChild(item(i, n[1])); });
      cartao.appendChild(ul);
      caixa.appendChild(cartao);
    });

    var areas = limpar("areas");
    r.areas.lista.forEach(function (a) {
      var li = el("li", { className: a.feita ? "feita" : "pendente" });
      li.appendChild(el("span", { className: "area-marca", textContent: a.feita ? "✓" : "○" }));
      li.appendChild(el("span", { className: "area-nome", textContent: a.nome }));
      li.appendChild(el("span", { className: "area-estado", textContent: a.feita ? (a.conferida ? "confirmada: já está certo" : "preenchida") : "ainda é o exemplo" }));
      li.appendChild(el("a", { href: a.pagina, textContent: PAGINAS[a.pagina] }));
      areas.appendChild(li);
    });

    var diag = limpar("diagnostico");
    diag.appendChild(linhaLista("Patrimônio líquido hoje", ind.patrimonioLiquido === null ? "–" : (ind.patrimonioLiquido < 0 ? "− " : "") + moeda(Math.abs(ind.patrimonioLiquido))));
    diag.appendChild(linhaLista("Resultado médio mensal (próximos 12 meses)", (ind.mediaSobra < 0 ? "− " : "") + moeda(Math.abs(ind.mediaSobra))));
    diag.appendChild(linhaLista("Meses no vermelho (próximos 12)", ind.mesesVermelho + " de 12"));
    diag.appendChild(linhaLista("Saldo da corretora zera em", ind.zeraXP ? P.MESES[ind.zeraXP.mes - 1].toLowerCase() + "/" + ind.zeraXP.ano : "não zera até 2050"));
    diag.appendChild(linhaLista("Aposentadoria" + (ind.aposentadoria ? " aos " + ind.aposentadoria.aposentar : ""), ind.aposentadoria ? Math.round(ind.aposentadoria.pctMeta * 100) + "% da meta" : "–"));
    if (ind.aposentadoria && ind.aposentadoria.falta > 0) diag.appendChild(linhaLista("Aporte extra mensal para fechar a aposentadoria", moeda(ind.aposentadoria.extra), "total"));
  }

  document.getElementById("cc-mes").addEventListener("change", function (ev) { ccSel = { ano: mesEscolhido().ano, mes: Number(ev.target.value) }; montarContracheque(); });
  document.getElementById("cc-ano").addEventListener("change", function (ev) { ccSel = { ano: Number(ev.target.value), mes: mesEscolhido().mes }; montarContracheque(); });
  P.iniciarCabecalho(desenhar);
  desenhar();
})();
