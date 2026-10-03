// Página Orçamento: receitas, descontos, reservas, despesas e reajustes, mês a mês.
// Os dados e os cálculos ficam em comum.js (compartilhado com a página Aportes).
(function () {
  "use strict";

  var P = window.Plano, dados = P.estado.dados;
  var MESES = P.MESES, MESES_LONGOS = P.MESES_LONGOS, INICIO = P.INICIO, EXEMPLO = P.EXEMPLO;
  var moeda = P.moeda, moedaInteira = P.moedaInteira, lerNumero = P.lerNumero, formatarAte = P.formatarAte, lerAte = P.lerAte;
  var pctDe = P.pctDe, ativo = P.ativo, calcMes = P.calcMes, salvar = P.salvar, copiar = P.copiar, antesDoInicio = P.antesDoInicio;
  var el = P.el, texto = P.texto, nomeMes = P.nomeMes, campoNumero = P.campoNumero, limpar = P.limpar;

  // Como cada lista se comporta. modo "mes": ocorre só no mês escolhido. modo "prazo": termina em "Até".
  var LISTAS = {
    receitas: { rotulo: "receita" },
    extras: { rotulo: "receita extra" },
    unicas: { rotulo: "receita de um mês só", modo: "mes" },
    folha: { rotulo: "desconto" },
    despesas: { rotulo: "despesa", modo: "prazo", reaj: true },
    reembolsos: { rotulo: "reembolso", modo: "prazo" }
  };

  function cabecalho(modo, reaj) {
    var cols = modo === "mes" ? ["Item", "Mês", "Valor", ""] : reaj ? ["Item", "Valor", "Até", "Reajuste", ""] : ["Item", "Valor", "Até", ""];
    var linha = el("div", { className: "linha cab " + modo + (reaj ? " reaj" : "") });
    cols.forEach(function (c) { linha.appendChild(el("span", { textContent: c })); });
    return linha;
  }

  function desenharLista(nome) {
    var cfg = LISTAS[nome], modo = cfg.modo || "simples";
    var caixa = document.querySelector('[data-lista="' + nome + '"]');
    caixa.textContent = "";
    if (dados[nome].length === 0) {
      caixa.appendChild(el("p", { className: "vazio", textContent: "Nenhuma " + cfg.rotulo + " ainda." }));
      return;
    }
    if (modo !== "simples") caixa.appendChild(cabecalho(modo, cfg.reaj));
    dados[nome].forEach(function (item, i) {
      var linha = el("div", { className: "linha " + modo + (cfg.reaj ? " reaj" : "") });
      if (!ativo(item, dados.ref.ano, dados.ref.mes)) linha.classList.add("inativa");

      var campoNome = el("input", { type: "text", value: item.nome, maxLength: 60 });
      campoNome.setAttribute("aria-label", "Nome da " + cfg.rotulo);
      campoNome.addEventListener("input", function () { item.nome = campoNome.value; salvar(); });

      var valor = campoNumero({ moeda: true, valor: item.valor, prefixo: "R$", rotulo: "Valor mensal de " + (item.nome || cfg.rotulo) });
      valor.campo.addEventListener("input", function () { item.valor = lerNumero(valor.campo.value); salvar(); atualizarTotais(); });

      var remover = el("button", { type: "button", className: "remover", textContent: "✕" });
      remover.setAttribute("aria-label", "Remover " + (item.nome || cfg.rotulo));
      remover.addEventListener("click", function () { dados[nome].splice(i, 1); salvar(); desenhar(); });

      linha.appendChild(campoNome);
      if (modo === "mes") {
        var seletor = el("select", { className: "mini" });
        seletor.setAttribute("aria-label", "Mês de " + (item.nome || cfg.rotulo));
        MESES.forEach(function (m, k) { seletor.appendChild(el("option", { value: k + 1, textContent: m, selected: Number(item.mes) === k + 1 })); });
        seletor.addEventListener("change", function () { item.mes = Number(seletor.value); salvar(); desenhar(); });
        linha.append(seletor, valor.caixa);
      } else if (modo === "prazo") {
        var ate = el("input", { type: "text", value: formatarAte(item.ate), className: "mini", placeholder: "mm/aaaa", maxLength: 7, title: "Último mês com este valor (ex.: 02/2041). Vazio = sem fim." });
        ate.setAttribute("aria-label", "Até (último mês) de " + (item.nome || cfg.rotulo));
        ate.addEventListener("change", function () {
          var novo = lerAte(ate.value);
          if (novo === null) { ate.setAttribute("aria-invalid", "true"); ate.title = "Use o formato mm/aaaa, por exemplo 02/2041."; return; }
          item.ate = novo; salvar(); desenhar();
        });
        linha.append(valor.caixa, ate);
        if (cfg.reaj) {
          var taxa = campoNumero({ passo: "0.5", valor: item.reaj === null || item.reaj === undefined ? "" : item.reaj, sufixo: "%", rotulo: "Reajuste anual de " + (item.nome || cfg.rotulo) + " (vazio = padrão do grupo)" });
          taxa.campo.min = "-50"; taxa.campo.max = "100"; taxa.campo.placeholder = "padrão";
          taxa.campo.addEventListener("input", function () { item.reaj = taxa.campo.value === "" ? null : (parseFloat(taxa.campo.value) || 0); salvar(); atualizarTotais(); });
          linha.appendChild(taxa.caixa);
        }
      } else {
        linha.appendChild(valor.caixa);
      }
      linha.appendChild(remover);
      caixa.appendChild(linha);
    });
  }

  var CAMPOS_REAJUSTE = [
    { chave: "inflacao", nome: "Inflação (para reais de hoje)" },
    { chave: "receitas", nome: "Receitas (todas)" },
    { chave: "folha", nome: "Descontos em folha" },
    { chave: "despesas", nome: "Despesas (padrão do grupo)" },
    { chave: "reembolsos", nome: "Reembolsos" }
  ];

  function desenharReajustes() {
    var caixa = document.getElementById("campos-reajuste");
    caixa.textContent = "";
    CAMPOS_REAJUSTE.forEach(function (def) {
      var bloco = el("label", { className: "campo-reajuste" });
      bloco.appendChild(el("span", { textContent: def.nome }));
      var campo = campoNumero({ passo: "0.5", valor: dados.reajuste[def.chave], sufixo: "%", rotulo: def.nome + " ao ano" });
      campo.campo.min = "-50"; campo.campo.max = "100";
      campo.campo.addEventListener("input", function () { dados.reajuste[def.chave] = parseFloat(campo.campo.value) || 0; salvar(); atualizarTotais(); });
      bloco.appendChild(campo.caixa);
      caixa.appendChild(bloco);
    });
    document.getElementById("sel-modo").value = dados.reajuste.modo;
  }

  function desenharReservas() {
    var caixa = document.querySelector('[data-lista="reservas"]');
    caixa.textContent = "";
    dados.reservas.forEach(function (item) {
      var linha = el("div", { className: "linha reserva" });
      var nome = el("input", { type: "text", value: item.nome, maxLength: 40 });
      nome.setAttribute("aria-label", "Nome da reserva");
      nome.addEventListener("input", function () { item.nome = nome.value; salvar(); });
      var pct = campoNumero({ passo: "0.5", valor: item.pct, sufixo: "%", rotulo: "Percentual de " + item.nome });
      pct.campo.max = "100";
      pct.campo.addEventListener("input", function () { item.pct = parseFloat(pct.campo.value) || 0; salvar(); atualizarTotais(); });
      var valor = el("span", { className: "valor" });
      valor.setAttribute("data-valor-reserva", "1");
      var marca = el("label", { className: "no-aporte", title: "Conta como dinheiro investido no mês (vai para a corretora)" });
      var caixaMarca = el("input", { type: "checkbox", checked: !!item.aporte });
      caixaMarca.setAttribute("aria-label", item.nome + " conta no aporte");
      caixaMarca.addEventListener("change", function () { item.aporte = caixaMarca.checked; salvar(); atualizarTotais(); });
      marca.append(caixaMarca, el("span", { textContent: "No aporte" }));
      linha.append(nome, pct.caixa, valor, marca);
      caixa.appendChild(linha);
    });
  }

  /** Barra: como a receita total do mês se divide entre folha, reservas, despesas e sobra. */
  function desenharFluxo(c) {
    var r = c.r, saidas = c.folha + c.reservas + c.d, sobra = r - saidas, total = Math.max(r, saidas, 1);
    var partes = [
      { chave: "folha", nome: "Descontos em folha", valor: c.folha },
      { chave: "reservas", nome: "Reservas", valor: c.reservas },
      { chave: "despesas", nome: "Despesas (com cartões, após reembolsos)", valor: c.d }
    ];
    if (sobra > 0) partes.push({ chave: "sobra", nome: "Sobra", valor: sobra });

    var barra = document.getElementById("barra");
    barra.textContent = "";
    partes.forEach(function (p) {
      if (p.valor <= 0) return;
      var seg = el("span", { className: "seg " + p.chave });
      seg.style.width = (p.valor / total * 100) + "%";
      seg.title = p.nome + ": " + moeda(p.valor);
      barra.appendChild(seg);
    });
    if (saidas > r && r > 0) {
      var marca = el("span", { className: "marca-receita", title: "Receita total: " + moeda(r) });
      marca.style.left = "calc(" + (r / total * 100) + "% - 1px)";
      barra.appendChild(marca);
    }

    var legenda = document.getElementById("legenda");
    legenda.textContent = "";
    partes.forEach(function (p) {
      var li = el("li");
      li.appendChild(el("span", { className: "amostra " + p.chave }));
      li.appendChild(el("span", { textContent: p.nome }));
      li.appendChild(el("b", { textContent: moeda(p.valor) }));
      li.appendChild(el("i", { textContent: pctDe(p.valor, r) }));
      legenda.appendChild(li);
    });

    barra.setAttribute("aria-label", "Da receita total de " + moeda(r) + ": " + partes.map(function (p) {
      return p.nome.toLowerCase() + " " + moeda(p.valor);
    }).join(", ") + ".");
    texto("barra-nota", saidas > r
      ? "As saídas passam da receita em " + moeda(saidas - r) + " (a linha escura marca onde termina a receita total)."
      : "Percentuais calculados sobre a receita total do mês.");
  }

  /** Tabela dos 12 meses do ano analisado. */
  function desenharTabela() {
    var ano = dados.ref.ano, tabela = document.getElementById("tabela-mensal");
    var meses = [], i;
    for (i = 1; i <= 12; i++) meses.push(antesDoInicio(ano, i) ? null : calcMes(ano, i));
    var linhas = [
      ["Receitas", function (c) { return c.fixas; }, ""],
      ["Receitas extras", function (c) { return c.extras; }, ""],
      ["Receitas de um mês só", function (c) { return c.unicas; }, ""],
      ["Receita total", function (c) { return c.r; }, "forte"],
      ["(−) Descontos em folha", function (c) { return -c.folha; }, ""],
      ["(−) Reservas", function (c) { return -c.reservas; }, ""],
      ["Receita líquida", function (c) { return c.liquida; }, "forte"],
      ["(−) Despesas (lista)", function (c) { return -c.brutas; }, ""],
      ["(−) Cartões de crédito", function (c) { return -c.cartao; }, ""],
      ["(+) Reembolsos", function (c) { return c.reemb; }, ""],
      ["Resultado do mês", function (c) { return c.sobra; }, "forte resultado"]
    ];
    tabela.textContent = "";
    var topo = el("tr");
    topo.appendChild(el("th", { textContent: ano, scope: "col" }));
    MESES.forEach(function (nome, k) {
      var th = el("th", { scope: "col" });
      var b = el("button", { type: "button", textContent: nome, className: "mes" + (k + 1 === dados.ref.mes ? " atual" : "") });
      b.disabled = antesDoInicio(ano, k + 1);
      b.setAttribute("aria-label", "Analisar " + MESES_LONGOS[k] + " de " + ano);
      b.setAttribute("aria-pressed", k + 1 === dados.ref.mes ? "true" : "false");
      b.addEventListener("click", function () { dados.ref.mes = k + 1; salvar(); desenhar(); });
      th.appendChild(b);
      topo.appendChild(th);
    });
    topo.appendChild(el("th", { textContent: "Ano", scope: "col" }));
    tabela.appendChild(el("thead")).appendChild(topo);
    var corpo = el("tbody");
    linhas.forEach(function (def) {
      var tr = el("tr", { className: def[2] });
      tr.appendChild(el("th", { textContent: def[0], scope: "row" }));
      var totalAno = 0;
      meses.forEach(function (c, k) {
        if (c === null) { tr.appendChild(el("td", { className: "antes", textContent: "–", title: "Antes do início do plano (" + P.rotuloInicio() + ")" })); return; }
        var v = def[1](c);
        totalAno += v;
        var td = el("td", { textContent: v < 0 ? "− " + moedaInteira(-v) : moedaInteira(v), title: moeda(v) });
        if (k + 1 === dados.ref.mes) td.className = "atual";
        if (def[2].indexOf("resultado") >= 0) td.classList.add(v < 0 ? "negativo" : "positivo");
        tr.appendChild(td);
      });
      var tdAno = el("td", { className: "ano", textContent: totalAno < 0 ? "− " + moedaInteira(-totalAno) : moedaInteira(totalAno), title: moeda(totalAno) });
      if (def[2].indexOf("resultado") >= 0) tdAno.classList.add(totalAno < 0 ? "negativo" : "positivo");
      tr.appendChild(tdAno);
      corpo.appendChild(tr);
    });
    tabela.appendChild(corpo);
    var atual = tabela.querySelector("button.mes.atual"), rolagem = tabela.parentNode;
    if (atual && rolagem.scrollWidth > rolagem.clientWidth) rolagem.scrollLeft = Math.max(0, atual.parentNode.offsetLeft - rolagem.clientWidth / 2);
    return meses;
  }

  /** Bloco dos cartões dentro do card Despesas: fatura do mês por cartão e o total somado à lista. */
  function desenharCartoes(c, rotuloMes) {
    var cx = dados.cartao.cartoes, lista = limpar("cr-lista"), somar = dados.cartao.somar !== false, algum = false;
    document.getElementById("cr-somar").checked = somar;
    cx.forEach(function (cartao) {
      var v = c.cartaoPorCartao[cartao.id] || 0;
      if (v <= 0) return;
      algum = true;
      var li = el("li");
      li.appendChild(el("span", { textContent: cartao.nome + (cartao.banco ? " · " + cartao.banco : "") }));
      li.appendChild(el("b", { textContent: moeda(v) }));
      lista.appendChild(li);
    });
    if (!algum) lista.appendChild(el("li", { className: "vazio-li", textContent: dados.cartao.compras.length ? "Nenhuma fatura em " + rotuloMes + "." : "Nenhuma compra cadastrada nos cartões ainda." }));
    texto("cr-titulo", "Cartões de crédito · faturas de " + rotuloMes);
    texto("cr-selo", (somar ? "− " : "fora do total: ") + moeda(c.cartaoFatura));
    texto("cr-nota", somar
      ? "As faturas já estão somadas ao total de despesas. Se mercado, combustível, farmácia etc. também são pagos no cartão, retire esses itens da lista acima (ou das compras do cartão) para não contar o mesmo gasto duas vezes."
      : "As faturas aparecem aqui, mas estão fora do total de despesas. Marque a opção acima para somá-las.");
    texto("cr-total", moeda(c.brutas + c.cartao));
  }

  function atualizarTotais() {
    var ref = dados.ref, c = calcMes(ref.ano, ref.mes);
    var rotuloMes = nomeMes(ref.mes) + "/" + ref.ano;
    var rotuloModo = dados.reajuste.modo === "real" ? "reais de hoje" : "valores nominais";
    var valores = document.querySelectorAll("[data-valor-reserva]");
    dados.reservas.forEach(function (item, i) {
      if (valores[i]) valores[i].textContent = "− " + moeda(c.r * (Number(item.pct) || 0) / 100);
    });

    texto("titulo-fluxo", "Para onde vai a receita em " + rotuloMes);
    texto("total-receitas", moeda(c.r));
    texto("detalhe-receitas", "em " + rotuloMes + " · " + rotuloModo);
    texto("total-liquida", moeda(c.liquida));
    texto("detalhe-liquida", "folha − " + moeda(c.folha) + " · reservas − " + moeda(c.reservas));
    texto("total-despesas", moeda(c.d));
    texto("detalhe-despesas", "lista " + moeda(c.brutas) + (c.cartao ? " + cartões " + moeda(c.cartao) : "") + " − reembolsos " + moeda(c.reemb));
    desenharCartoes(c, rotuloMes);
    texto("total-sobra", moeda(Math.abs(c.sobra)));
    texto("rotulo-sobra", c.sobra < 0 ? "Falta em " + rotuloMes : "Sobra em " + rotuloMes);
    document.getElementById("caixa-sobra").className = "kpi resultado " + (c.sobra < 0 ? "negativo" : "positivo");

    texto("selo-receitas", moeda(c.fixas));
    texto("selo-extras", moeda(c.extras));
    texto("selo-unicas", moeda(c.unicas));
    texto("selo-folha", "− " + moeda(c.folha));
    texto("selo-reservas", "− " + moeda(c.reservas));
    texto("selo-despesas", "− " + moeda(c.brutas));
    texto("selo-reembolsos", moeda(c.reemb));
    texto("liquida-card", moeda(c.liquida));
    texto("aporte-card", moeda(c.aporteReservas));

    texto("titulo-mensal", "Mês a mês · " + rotuloModo);
    desenharFluxo(c);
    var meses = desenharTabela();
    var anoTotal = meses.reduce(function (t, m) { return t + (m === null ? 0 : m.sobra); }, 0);
    texto("total-ano", (ref.ano === INICIO.ano ? "De " + P.MESES[INICIO.mes - 1].toLowerCase() + " a dez de " : "No ano de ") + ref.ano + ": " + (anoTotal < 0 ? "faltam " : "sobram ") + moeda(Math.abs(anoTotal)));
  }

  function desenhar() {
    P.desenharCabecalho();
    Object.keys(LISTAS).forEach(desenharLista);
    desenharReservas();
    desenharReajustes();
    atualizarTotais();
  }

  // ---------------------------------------------------------------- eventos
  P.iniciarCabecalho(desenhar);
  document.getElementById("cr-somar").addEventListener("change", function (e) { dados.cartao.somar = e.target.checked; salvar(); atualizarTotais(); });
  document.getElementById("sel-modo").addEventListener("change", function (e) { dados.reajuste.modo = e.target.value; salvar(); atualizarTotais(); });

  document.querySelectorAll("[data-add]").forEach(function (b) {
    b.addEventListener("click", function () {
      var nome = b.getAttribute("data-add"), modo = LISTAS[nome].modo;
      var novo = { nome: "", valor: 0 };
      if (modo === "mes") novo.mes = dados.ref.mes;
      if (modo === "prazo") novo.ate = "";
      dados[nome].push(novo);
      salvar();
      desenhar();
      var campos = document.querySelectorAll('[data-lista="' + nome + '"] .linha > input[type="text"]');
      if (campos.length) campos[campos.length - 1].focus();
    });
  });

  document.getElementById("limpar").addEventListener("click", function () {
    if (window.confirm("Apagar todas as receitas, descontos e despesas?")) {
      dados = P.definirDados({ receitas: [], extras: [], unicas: [], folha: [], despesas: [], reembolsos: [], reservas: copiar(EXEMPLO.reservas), reajuste: dados.reajuste, aportes: dados.aportes, carteira: dados.carteira, cartao: dados.cartao, ref: dados.ref });
      desenhar();
    }
  });
  document.getElementById("restaurar").addEventListener("click", function () {
    if (window.confirm("Voltar para os valores de exemplo da planilha?")) { var carteira = dados.carteira, cartao = dados.cartao; dados = P.definirDados(P.dadosPadrao()); dados.carteira = carteira; dados.cartao = cartao; salvar(); desenhar(); }
  });

  desenhar();
})();
