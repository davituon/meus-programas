// Página Oportunidades: mostra as alavancas calculadas por calculo-oportunidades.js sobre os dados preenchidos.
(function () {
  "use strict";

  var P = window.Plano, moeda = P.moeda, el = P.el, texto = P.texto, limpar = P.limpar;
  var GRUPOS = [
    ["gastos", "Diminuir gastos", "Do que mais reduz o que falta para a aposentadoria ao que menos reduz"],
    ["ganhos", "Aumentar ganhos", "Renda, reajuste e rendimento dos investimentos"],
    ["aposentadoria", "Ajustar a aposentadoria", "Gasto na aposentadoria, INSS e idade"]
  ];

  function comSinal(v) { return (v < 0 ? "− " : "+ ") + moeda(Math.abs(v)); }
  function mes(z) { return P.MESES[z.mes - 1].toLowerCase() + "/" + z.ano; }

  function efeito(rotulo, valor, bom) {
    var s = el("span", { className: "opo-efeito" + (bom === true ? " bom" : bom === false ? " ruim" : "") });
    s.appendChild(el("small", { textContent: rotulo }));
    s.appendChild(el("b", { textContent: valor }));
    return s;
  }

  function efeitos(a, base) {
    var caixa = el("div", { className: "opo-efeitos" });
    caixa.appendChild(efeito("Resultado do mês", comSinal(a.ganhoMensal) + " /mês", a.ganhoMensal > 0.5 ? true : a.ganhoMensal < -0.5 ? false : null));
    if (a.pctMeta !== null && a.pctMeta !== undefined) {
      caixa.appendChild(efeito("Falta para aposentar", a.ganhoFalta > 0.5 ? "− " + moeda(a.ganhoFalta) : "sem mudança", a.ganhoFalta > 0.5 ? true : null));
      caixa.appendChild(efeito("Meta atingida", Math.round(base.pctMeta * 100) + "% → " + Math.round(a.pctMeta * 100) + "%", a.pctMeta > base.pctMeta + 0.004 ? true : null));
    }
    if (base.zera && !a.zera) caixa.appendChild(efeito("Corretora", "deixa de zerar", true));
    else if (a.zera) caixa.appendChild(efeito("Corretora zera em", mes(a.zera), null));
    if (base.vermelho !== a.vermelho) caixa.appendChild(efeito("Meses no vermelho", base.vermelho + " → " + a.vermelho + " de 12", a.vermelho < base.vermelho));
    return caixa;
  }

  function alavanca(a, base) {
    var li = el("li", { className: "opo-item" });
    var corpo = el("div", { className: "opo-corpo" });
    corpo.appendChild(el("strong", { textContent: a.titulo }));
    if (a.risco) corpo.appendChild(el("span", { className: "opo-risco", textContent: "depende do mercado" }));
    if (a.detalhe) corpo.appendChild(el("p", { textContent: a.detalhe }));
    li.appendChild(corpo);
    li.appendChild(efeitos(a, base));
    return li;
  }

  function desenhar() {
    P.desenharCabecalho();
    var r = P.oportunidades.analisar(), b = r.base;

    texto("k-sobra", (b.sobra12 < 0 ? "− " : "") + moeda(Math.abs(b.sobra12)));
    document.getElementById("caixa-sobra").className = "kpi resultado " + (b.sobra12 < 0 ? "negativo" : "positivo");
    texto("k-vermelho", b.vermelho + " de 12");
    texto("k-vermelho-det", b.zera ? "corretora zera em " + mes(b.zera) : "corretora não zera até 2050");
    texto("k-meta", b.pctMeta === null ? "–" : Math.round(b.pctMeta * 100) + "%");
    texto("k-meta-det", b.falta === null ? "confira a página Aposentadoria" : b.falta > 0 ? "faltam " + moeda(b.falta) : "meta atingida");
    texto("k-extra", b.extra === null ? "–" : b.falta > 0 ? moeda(b.extra) : "nenhum");

    var pacote = document.getElementById("bloco-pacote");
    pacote.hidden = !r.pacote;
    if (r.pacote) {
      var itens = limpar("pacote-itens");
      r.pacote.itens.forEach(function (t) { itens.appendChild(el("li", { textContent: t })); });
      var ef = limpar("pacote-efeito");
      ef.appendChild(efeitos(r.pacote, b));
    }

    var caixa = limpar("grupos");
    GRUPOS.forEach(function (g) {
      var lista = r.grupos[g[0]];
      if (!lista || !lista.length) return;
      var cartao = el("section", { className: "cartao" });
      var topo = el("div", { className: "cartao-topo" });
      topo.appendChild(el("h2", { textContent: g[1] }));
      topo.appendChild(el("span", { className: "dica", textContent: g[2] }));
      cartao.appendChild(topo);
      var ul = el("ul", { className: "opo-lista" });
      ul.setAttribute("aria-label", g[1]);
      lista.forEach(function (a) { ul.appendChild(alavanca(a, b)); });
      cartao.appendChild(ul);
      caixa.appendChild(cartao);
    });

    var bloco = document.getElementById("bloco-estr");
    bloco.hidden = !r.estruturais.length;
    var est = limpar("estruturais");
    r.estruturais.forEach(function (e) {
      var li = el("li", { className: "conf-item nivel-info sem-etiqueta" });
      var corpo = el("div", { className: "conf-corpo" });
      corpo.appendChild(el("strong", { textContent: e.titulo }));
      if (e.detalhe) corpo.appendChild(el("p", { textContent: e.detalhe }));
      li.appendChild(corpo);
      est.appendChild(li);
    });
  }

  P.iniciarCabecalho(desenhar);
  desenhar();
})();
