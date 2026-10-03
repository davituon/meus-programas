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

  function desenhar() {
    P.desenharCabecalho();
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

  P.iniciarCabecalho(desenhar);
  desenhar();
})();
