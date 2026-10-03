// Fundo de Missões: tela. As regras ficam em calculo.js (window.Missoes).
(function () {
  "use strict";

  var M = window.Missoes;
  var CHAVE = "missoes.dados.v1", CHAVE_OCULTO = "missoes.oculto.v1";
  var MASCARA = "R$ ••••", NOME_OCULTO = "••••";
  var reais = new Intl.NumberFormat("pt-BR", { style: "currency", currency: "BRL" });
  var MESES = ["jan", "fev", "mar", "abr", "mai", "jun", "jul", "ago", "set", "out", "nov", "dez"];

  var oculto = lerOculto(), dados = carregar();

  function lerOculto() { try { return localStorage.getItem(CHAVE_OCULTO) === "1"; } catch (e) { return false; } }
  function carregar() { try { return M.normalizar(JSON.parse(localStorage.getItem(CHAVE))); } catch (e) { return M.vazio(); } }
  function salvar() { try { localStorage.setItem(CHAVE, JSON.stringify(dados)); } catch (e) { aviso("Não foi possível salvar neste navegador. Baixe um backup.", true); } }

  function moeda(n) { return oculto ? MASCARA : reais.format(n); }
  function nome(t) { return oculto ? NOME_OCULTO : t; }
  function el(tag, props) { var e = document.createElement(tag); Object.keys(props || {}).forEach(function (k) { e[k] = props[k]; }); return e; }
  function limpar(id) { var e = document.getElementById(id); e.textContent = ""; return e; }
  function texto(id, t) { document.getElementById(id).textContent = t; }
  function valorDe(id) { return document.getElementById(id).value; }
  function limparCampos(ids) { ids.forEach(function (id) { document.getElementById(id).value = ""; }); }
  function dataBr(iso) { var p = iso.split("-"); return p[2] + "/" + p[1] + "/" + p[0]; }
  function mesBr(k) { var p = k.split("-"); return MESES[Number(p[1]) - 1] + "/" + p[0]; }
  function pctTxt(n) { return String(n).replace(".", ",") + "%"; }
  function porData(a, b) { return a.data < b.data ? 1 : a.data > b.data ? -1 : 0; }

  var temporizador = null;
  function aviso(t, erro) {
    var m = document.getElementById("msg");
    m.textContent = t; m.hidden = false; m.className = "mensagem" + (erro ? " erro" : "");
    clearTimeout(temporizador);
    temporizador = setTimeout(function () { m.hidden = true; }, erro ? 9000 : 4000);
  }

  /** Aplica a operação (devolve null ou o erro), salva e redesenha. */
  function aplicar(resultado, sucesso) {
    if (resultado) { aviso(resultado, true); return false; }
    salvar(); desenhar(); if (sucesso) aviso(sucesso, false);
    return true;
  }

  function botaoRemover(rotulo, aoClicar) {
    var b = el("button", { type: "button", className: "remover", textContent: "✕" });
    b.setAttribute("aria-label", "Remover " + rotulo);
    b.title = "Remover";
    b.addEventListener("click", function () { if (window.confirm("Remover " + rotulo + "?")) aoClicar(); });
    return b;
  }

  /** Linha de lista: data, descrição, valor (com sinal) e botão de remover. */
  function item(data, descricao, valor, sinal, rotulo, aoRemover) {
    var li = el("li", { className: "mi-item" });
    li.appendChild(el("span", { className: "mi-data", textContent: dataBr(data) }));
    li.appendChild(el("span", { textContent: descricao }));
    li.appendChild(el("b", { className: "mi-valor", textContent: sinal + " " + moeda(valor) }));
    li.appendChild(botaoRemover(rotulo, aoRemover));
    return li;
  }
  function vazioNaLista(ul, t) { if (!ul.children.length) ul.appendChild(el("li", { className: "vazio", textContent: t })); }

  function opcoes(sel, lista, vazioTxt) {
    var atual = sel.value;
    sel.textContent = "";
    if (vazioTxt !== null) sel.appendChild(el("option", { value: "", textContent: vazioTxt }));
    lista.forEach(function (o) { sel.appendChild(el("option", { value: o[0], textContent: o[1], selected: o[0] === atual })); });
  }

  function desenhar() {
    document.body.classList.toggle("oculto", oculto);
    var b = document.getElementById("btn-ocultar");
    b.textContent = oculto ? "Mostrar valores" : "Ocultar valores";
    b.setAttribute("aria-pressed", oculto ? "true" : "false");

    var r = M.resumo(dados), nomesRes = {}, nomesMis = {};
    dados.reservas.forEach(function (x) { nomesRes[x.id] = x.nome; });
    dados.missoes.forEach(function (x) { nomesMis[x.id] = x.nome; });

    texto("k-vendido", moeda(r.vendido));
    texto("k-vendido-det", moeda(r.vendidoMes) + " neste mês · " + r.qtdEntradas + (r.qtdEntradas === 1 ? " venda" : " vendas"));
    texto("k-reservas", moeda(r.separadoSaldo));
    texto("k-reservas-det", "seu: " + moeda(r.saldoPessoal) + " · da missão: " + moeda(r.saldoMissao));
    texto("k-livre", moeda(r.livre));
    texto("k-livre-det", r.giro > 0 ? "disponível para doar: " + moeda(r.disponivel) + " (giro " + moeda(r.giro) + ")" : "para doar e comprar suprimentos");
    texto("k-enviado", moeda(r.enviado));
    texto("k-enviado-det", dados.missoes.length ? "para " + dados.missoes.length + (dados.missoes.length === 1 ? " missão" : " missões") + " · " + moeda(r.suprimentos) + " em suprimentos" : "nenhuma missão cadastrada ainda");

    // vendas
    var ul = limpar("entradas");
    dados.entradas.slice().sort(porData).forEach(function (e) {
      var reservado = Object.keys(e.partes).reduce(function (t, k) { return t + e.partes[k]; }, 0);
      var custoTxt = typeof e.custo === "number" ? " · custo " + moeda(e.custo) + " (margem " + (e.valor > 0 ? Math.round((e.valor - e.custo) / e.valor * 100) + "%" : "–") + ")" : "";
      ul.appendChild(item(e.data, (e.origem ? nome(e.origem) : "(sem descrição)") + " · " + "ficou na conta " + moeda(Math.round((e.valor - reservado) * 100) / 100) + custoTxt, e.valor, "+", "a venda de " + dataBr(e.data),
        function () { aplicar(M.removerEntrada(dados, e.id), "Venda removida."); }));
    });
    vazioNaLista(ul, "Nenhuma venda ainda. Registre a primeira acima.");

    // reservas
    var tb = limpar("reservas");
    r.reservas.forEach(function (x) {
      var tr = el("tr"), th = el("th", { scope: "row", textContent: x.nome });
      th.appendChild(el("small", { className: "mi-tag " + (x.pessoal ? "seu" : "missao"), textContent: x.pessoal ? "seu dinheiro" : "da missão" }));
      var td = el("td"), campo = el("input", { type: "text", value: String(x.pct).replace(".", ","), className: "mi-pct", inputMode: "decimal", maxLength: 6 });
      campo.setAttribute("aria-label", "Percentual de " + x.nome + " sobre cada venda");
      campo.addEventListener("change", function () { if (!aplicar(M.definirPercentual(dados, x.id, campo.value), "Percentual de " + x.nome + " alterado para as próximas vendas.")) desenhar(); });
      td.appendChild(campo); td.appendChild(document.createTextNode(" %"));
      tr.appendChild(th); tr.appendChild(td);
      [x.acumulado, x.retirado, x.saldo].forEach(function (v) { tr.appendChild(el("td", { textContent: moeda(v) })); });
      tb.appendChild(tr);
    });
    texto("res-total", "Total separado de cada venda: " + pctTxt(r.pctReservas));
    opcoes(document.getElementById("r-reserva"), dados.reservas.map(function (x) { return [x.id, x.nome]; }), "Escolha…");
    var lr = limpar("retiradas");
    dados.retiradas.slice().sort(porData).forEach(function (e) {
      lr.appendChild(item(e.data, nomesRes[e.reservaId] + (e.nota ? " · " + nome(e.nota) : ""), e.valor, "−", "a retirada de " + dataBr(e.data), function () { aplicar(M.removerRetirada(dados, e.id), "Retirada removida."); }));
    });
    vazioNaLista(lr, "Nenhuma retirada ainda.");

    // saldos iniciais e rendimentos lançados
    var todasChaves = [["conta", "Conta (saldo livre)"]].concat(dados.reservas.map(function (x) { return [x.id, "Reserva: " + x.nome]; })), rotChave = {};
    todasChaves.forEach(function (c) { rotChave[c[0]] = c[1]; });
    opcoes(document.getElementById("a-chave"), todasChaves, "Escolha…");
    var la = limpar("ajustes");
    dados.ajustes.slice().sort(porData).forEach(function (e) {
      la.appendChild(item(e.data, rotChave[e.chave] + " · " + (e.tipo === "inicial" ? "saldo inicial" : "rendimento") + (e.nota ? " · " + nome(e.nota) : ""), e.valor, "+", "o lançamento de " + dataBr(e.data), function () { aplicar(M.removerAjuste(dados, e.id), "Lançamento removido."); }));
    });
    vazioNaLista(la, "Nenhum saldo inicial ou rendimento lançado.");
    rendimento();

    // suprimentos
    var ls = limpar("suprimentos");
    dados.suprimentos.slice().sort(porData).forEach(function (e) {
      ls.appendChild(item(e.data, e.descricao ? nome(e.descricao) : "(sem descrição)", e.valor, "−", "a compra de " + dataBr(e.data), function () { aplicar(M.removerSuprimento(dados, e.id), "Compra removida."); }));
    });
    vazioNaLista(ls, "Nenhuma compra de suprimentos ainda.");

    // missões
    var lm = limpar("missoes");
    r.missoes.forEach(function (m) {
      var li = el("li", { className: "mi-missao" }), topo = el("div", { className: "mi-missao-topo" });
      topo.appendChild(el("strong", { textContent: nome(m.nome) }));
      topo.appendChild(el("span", { textContent: m.meta > 0 ? moeda(m.enviado) + " de " + moeda(m.meta) + " (" + Math.round(m.pct * 100) + "%)" : moeda(m.enviado) + " doados (sem meta)" }));
      li.appendChild(topo);
      li.appendChild(botaoRemover("a missão " + nome(m.nome), function () { aplicar(M.removerMissao(dados, m.id), "Missão removida."); }));
      if (m.meta > 0) {
        var barra = el("div", { className: "mi-barra" }), parte = el("span");
        parte.style.width = Math.round(m.pct * 100) + "%";
        barra.appendChild(parte); li.appendChild(barra);
        li.appendChild(el("small", { textContent: m.falta > 0 ? "Faltam " + moeda(m.falta) + " para a meta." : "✓ Meta atingida." }));
      }
      lm.appendChild(li);
    });
    vazioNaLista(lm, "Cadastre as missões que vão receber as doações.");
    opcoes(document.getElementById("v-missao"), dados.missoes.map(function (m) { return [m.id, nome(m.nome)]; }), dados.missoes.length ? "Escolha…" : "Cadastre uma missão primeiro");
    var le = limpar("envios");
    dados.envios.slice().sort(porData).forEach(function (e) {
      le.appendChild(item(e.data, "Para " + nome(nomesMis[e.missaoId] || "(missão removida)"), e.valor, "−", "a doação de " + dataBr(e.data), function () { aplicar(M.removerEnvio(dados, e.id), "Doação removida."); }));
    });
    vazioNaLista(le, "Nenhuma doação ainda.");

    // conferência
    opcoes(document.getElementById("c-chave"), [["conta", "Conta (saldo livre)"]].concat(dados.reservas.map(function (x) { return [x.id, "Reserva: " + x.nome]; })), "Escolha…");
    var lc = limpar("conferencias"), rotulos = { conta: "Conta (saldo livre)" };
    dados.reservas.forEach(function (x) { rotulos[x.id] = "Reserva: " + x.nome; });
    Object.keys(r.conferencias).forEach(function (k) {
      var c = r.conferencias[k], igual = Math.abs(c.diferenca) < 0.005, li = el("li", { className: "mi-conf " + (igual ? "confere" : "diverge") });
      li.appendChild(el("strong", { textContent: rotulos[k] }));
      li.appendChild(el("span", { textContent: igual ? "✓ Confere em " + dataBr(c.data) + ": " + moeda(c.informado)
        : "⚠ Em " + dataBr(c.data) + " o app mostrava " + moeda(c.informado) + " e o calculado é " + moeda(c.calculado) + " (diferença " + (c.diferenca < 0 ? "− " : "+ ") + moeda(Math.abs(c.diferenca)) + "). Pode faltar registrar algo ou o porquinho rendeu juros." }));
      if (!igual && c.diferenca > 0) {
        var bt = el("button", { type: "button", className: "secundario", textContent: "Lançar a diferença como saldo inicial" });
        bt.addEventListener("click", function () { aplicar(M.adicionarAjuste(dados, { chave: k, tipo: "inicial", data: c.data, valor: String(c.diferenca).replace(".", ","), nota: "Conferência" }), "Diferença lançada como saldo inicial."); });
        li.appendChild(bt);
      }
      lc.appendChild(li);
    });
    vazioNaLista(lc, "Nenhuma conferência salva ainda.");

    // mês a mês
    var tm = limpar("meses");
    r.porMes.forEach(function (m) {
      var tr = el("tr");
      tr.appendChild(el("th", { scope: "row", textContent: mesBr(m.mes) }));
      [m.vendido, m.enviado, m.suprimentos].forEach(function (v) { tr.appendChild(el("td", { textContent: moeda(v) })); });
      tr.appendChild(el("td", { textContent: String(m.qtd) }));
      tm.appendChild(tr);
    });
    if (!r.porMes.length) { var tr0 = el("tr"); tr0.appendChild(el("td", { colSpan: 5, className: "vazio", textContent: "Sem movimento ainda." })); tm.appendChild(tr0); }
    giroEMargem(r);
    previa();
    prestacao();
  }

  /** Capital de giro, aviso da doação e margem das vendas. */
  function giroEMargem(r) {
    var campoGiro = document.getElementById("g-valor");
    if (document.activeElement !== campoGiro) campoGiro.value = r.giro > 0 ? String(r.giro).replace(".", ",") : "";
    texto("giro-texto", "Livre na conta: " + moeda(r.livre) + " · capital de giro: " + moeda(r.giro) + " · disponível para doar: " + moeda(r.disponivel) + ".");
    texto("doar-aviso", r.giro > 0 ? "Disponível para doar sem mexer no capital de giro: " + moeda(r.disponivel) + "." : "Sem capital de giro definido: qualquer valor do saldo livre pode ser doado.");

    var m = r.margem, ul = limpar("margem");
    var linha = function (nomeL, valor, cl) { var li = el("li", { className: cl || "" }); li.appendChild(el("span", { textContent: nomeL })); li.appendChild(el("b", { textContent: valor })); ul.appendChild(li); };
    linha("Vendas com custo informado", m.qtd + " de " + (m.qtd + m.semCusto));
    linha("Recebido nessas vendas", moeda(m.receita));
    linha("Custo", "− " + moeda(m.custo));
    linha("Lucro", (m.lucro < 0 ? "− " : "") + moeda(Math.abs(m.lucro)), "total");
    linha("Margem média", m.pct === null ? "–" : Math.round(m.pct * 100) + "%");
    var t = "";
    if (m.pct === null) t = "Informe o custo ao registrar as vendas para ver a margem.";
    else {
      t = "As reservas levam " + Math.round(m.pctReservas * 100) + "% de cada venda e a margem média é de " + Math.round(m.pct * 100) + "%. ";
      t += m.sobraPct < 0 ? "⚠ As reservas consomem mais do que o lucro: o capital de giro vai diminuindo a cada venda. Reduza os percentuais ou aumente o preço."
        : m.sobraPct < 0.1 ? "! Sobra só " + Math.round(m.sobraPct * 100) + "% da venda para repor o estoque e doar: pouca folga."
        : "✓ Sobram cerca de " + Math.round(m.sobraPct * 100) + "% da venda para repor o estoque e doar.";
      if (m.semCusto > 0) t += " " + m.semCusto + (m.semCusto === 1 ? " venda sem custo informado ficou" : " vendas sem custo informado ficaram") + " de fora.";
    }
    texto("margem-texto", t);
  }

  /** Campos do CDI, caixas "rende" e resultado da estimativa até a data escolhida. */
  function rendimento() {
    var cfg = dados.rendimento, anual = document.getElementById("cdi-anual"), pct = document.getElementById("cdi-pct");
    if (document.activeElement !== anual) anual.value = cfg.cdi === null ? "" : String(cfg.cdi).replace(".", ",");
    if (document.activeElement !== pct) pct.value = String(cfg.pctCdi).replace(".", ",");
    var marcas = limpar("rende-marcas");
    [["conta", "Conta (saldo livre)"]].concat(dados.reservas.map(function (x) { return [x.id, x.nome]; })).forEach(function (c) {
      var rot = el("label", { className: "mi-marca" }), cx = el("input", { type: "checkbox", checked: !!cfg.rende[c[0]] });
      cx.addEventListener("change", function () { aplicar(M.marcarRende(dados, c[0], cx.checked)); });
      rot.appendChild(cx); rot.appendChild(document.createTextNode(" " + c[1]));
      marcas.appendChild(rot);
    });
    var caixa = limpar("cdi-resultado"), rend = M.rendimento(dados, valorDe("cdi-ate") || M.hoje());
    if (rend.erro) { caixa.appendChild(el("p", { className: "nota", textContent: rend.erro })); return; }
    caixa.appendChild(el("p", { className: "nota", textContent: "CDI de " + String(rend.cdiAnual).replace(".", ",") + "% ao ano a " + String(rend.pctCdi).replace(".", ",") + "% do CDI: cerca de " + String(rend.efetivoAnual).replace(".", ",") + "% ao ano até " + dataBr(rend.ate) + "." }));
    if (!rend.itens.length) { caixa.appendChild(el("p", { className: "vazio", textContent: "Marque acima o que rende CDI." })); return; }
    var tab = el("table", { className: "mi-tabela" }), cab = el("tr");
    ["Onde", "Saldo registrado", "Rendimento estimado", "Já lançado", "A lançar", "Saldo estimado"].forEach(function (t) { cab.appendChild(el("th", { scope: "col", textContent: t })); });
    tab.appendChild(el("thead")).appendChild(cab);
    var corpo = el("tbody");
    rend.itens.forEach(function (i) {
      var tr = el("tr");
      tr.appendChild(el("th", { scope: "row", textContent: i.nome }));
      [i.saldo, i.estimado, i.lancado, i.aLancar, i.saldoEstimado].forEach(function (v) { tr.appendChild(el("td", { textContent: moeda(v) })); });
      corpo.appendChild(tr);
    });
    tab.appendChild(corpo);
    var rolagem = el("div", { className: "tabela-rolagem" }); rolagem.appendChild(tab); caixa.appendChild(rolagem);
    var b = el("button", { type: "button", className: "botao-lancar", textContent: "Lançar " + moeda(rend.total) + " de rendimento em " + dataBr(rend.ate), disabled: rend.total < 0.01 });
    b.addEventListener("click", function () { var x = M.lancarRendimentos(dados, rend.ate); aplicar(x.erro || null, x.erro ? null : x.lancados + (x.lancados === 1 ? " rendimento lançado." : " rendimentos lançados.")); });
    caixa.appendChild(b);
  }

  /** Prestação de contas do mês escolhido. Com "ocultar valores" ligado, não copia nem imprime (o texto sairia mascarado). */
  function prestacao() {
    var mes = valorDe("pc-mes") || M.hoje().slice(0, 7), p = M.prestacao(dados, mes), op = { reservas: document.getElementById("pc-reservas").checked };
    p.doacoes.forEach(function (x) { x.nome = nome(x.nome); }); // com "ocultar" ligado, os nomes das missões também ficam escondidos
    var t = M.textoPrestacao(p, moeda, op);
    texto("pc-texto", t);
    document.getElementById("pc-copiar").disabled = oculto; document.getElementById("pc-imprimir").disabled = oculto;
    if (oculto) texto("pc-aviso", "Valores ocultos: mostre os valores para copiar ou imprimir o resumo.");
    else if (document.getElementById("pc-aviso").textContent.indexOf("Valores ocultos") === 0) texto("pc-aviso", "");
  }
  function textoLimpo() { return M.textoPrestacao(M.prestacao(dados, valorDe("pc-mes") || M.hoje().slice(0, 7)), moeda, { reservas: document.getElementById("pc-reservas").checked }); }

  /** Mostra, enquanto digita, como a venda será dividida. */
  function previa() {
    var v = M.lerValor(valorDe("e-valor")), p = document.getElementById("previa");
    if (v === null) { p.textContent = ""; return; }
    var d = M.dividir(dados, v);
    p.textContent = "Esta venda de " + moeda(v) + " será dividida assim: " + dados.reservas.filter(function (x) { return d.partes[x.id]; }).map(function (x) { return x.nome + " " + moeda(d.partes[x.id]); }).join(", ") + (Object.keys(d.partes).length ? "; " : "") + "fica na conta " + moeda(d.conta) + ".";
  }

  // ---- formulários
  document.getElementById("e-valor").addEventListener("input", previa);
  document.getElementById("f-venda").addEventListener("submit", function (ev) {
    ev.preventDefault();
    if (aplicar(M.adicionarEntrada(dados, { data: valorDe("e-data"), origem: valorDe("e-origem"), valor: valorDe("e-valor"), custo: valorDe("e-custo") }), "Venda registrada e dividida.")) { limparCampos(["e-origem", "e-valor", "e-custo"]); document.getElementById("e-valor").focus(); }
  });
  document.getElementById("f-retirada").addEventListener("submit", function (ev) {
    ev.preventDefault();
    if (aplicar(M.adicionarRetirada(dados, { data: valorDe("r-data"), reservaId: valorDe("r-reserva"), valor: valorDe("r-valor"), nota: valorDe("r-nota") }), "Retirada registrada.")) limparCampos(["r-valor", "r-nota"]);
  });
  document.getElementById("f-suprimento").addEventListener("submit", function (ev) {
    ev.preventDefault();
    if (aplicar(M.adicionarSuprimento(dados, { data: valorDe("s-data"), descricao: valorDe("s-desc"), valor: valorDe("s-valor") }), "Compra registrada.")) limparCampos(["s-desc", "s-valor"]);
  });
  document.getElementById("f-missao").addEventListener("submit", function (ev) {
    ev.preventDefault();
    if (aplicar(M.adicionarMissao(dados, { nome: valorDe("m-nome"), meta: valorDe("m-meta") }), "Missão adicionada.")) limparCampos(["m-nome", "m-meta"]);
  });
  document.getElementById("f-envio").addEventListener("submit", function (ev) {
    ev.preventDefault();
    if (aplicar(M.adicionarEnvio(dados, { data: valorDe("v-data"), missaoId: valorDe("v-missao"), valor: valorDe("v-valor"), mesmoAssim: document.getElementById("v-mesmo").checked }), "Doação registrada.")) { limparCampos(["v-valor"]); document.getElementById("v-mesmo").checked = false; }
  });
  document.getElementById("f-ajuste").addEventListener("submit", function (ev) {
    ev.preventDefault();
    if (aplicar(M.adicionarAjuste(dados, { chave: valorDe("a-chave"), tipo: valorDe("a-tipo"), data: valorDe("a-data"), valor: valorDe("a-valor") }), "Lançamento registrado.")) limparCampos(["a-valor"]);
  });
  document.getElementById("f-cdi").addEventListener("submit", function (ev) {
    ev.preventDefault();
    aplicar(M.definirCdi(dados, valorDe("cdi-anual"), valorDe("cdi-pct")), valorDe("cdi-anual").trim() === "" ? "CDI apagado." : "CDI salvo e rendimento calculado.");
  });
  document.getElementById("cdi-ate").addEventListener("change", rendimento);
  document.getElementById("pc-mes").addEventListener("change", prestacao);
  document.getElementById("pc-reservas").addEventListener("change", prestacao);
  document.getElementById("pc-copiar").addEventListener("click", function () {
    var t = textoLimpo();
    function pronto() { texto("pc-aviso", "Texto copiado. Cole na conversa ou no documento."); }
    function alternativa() {
      var area = el("textarea", { value: t }); document.body.appendChild(area); area.select();
      var ok = false; try { ok = document.execCommand("copy"); } catch (e) { ok = false; }
      area.remove();
      if (ok) pronto(); else texto("pc-aviso", "Não foi possível copiar automaticamente. Selecione o texto abaixo e copie com Ctrl+C.");
    }
    if (navigator.clipboard && navigator.clipboard.writeText) navigator.clipboard.writeText(t).then(pronto, alternativa); else alternativa();
  });
  document.getElementById("pc-imprimir").addEventListener("click", function () { window.print(); });
  document.getElementById("f-giro").addEventListener("submit", function (ev) {
    ev.preventDefault();
    aplicar(M.definirGiro(dados, valorDe("g-valor")), "Capital de giro salvo.");
  });
  document.getElementById("f-conf").addEventListener("submit", function (ev) {
    ev.preventDefault();
    var apagar = valorDe("c-valor").trim() === "";
    if (aplicar(M.informarSaldo(dados, valorDe("c-chave"), valorDe("c-valor"), valorDe("c-data")), apagar ? "Conferência apagada." : "Conferência salva.")) limparCampos(["c-valor"]);
  });

  // ---- ocultar e backup
  document.getElementById("btn-ocultar").addEventListener("click", function () {
    oculto = !oculto;
    try { localStorage.setItem(CHAVE_OCULTO, oculto ? "1" : "0"); } catch (e) { /* vale só nesta sessão */ }
    desenhar();
  });

  document.getElementById("btn-baixar").addEventListener("click", function () {
    var conteudo = JSON.stringify({ app: "fundo-missoes", versao: 2, geradoEm: new Date().toISOString(), dados: dados }, null, 2);
    var url = URL.createObjectURL(new Blob([conteudo], { type: "application/json" })), a = el("a", { href: url, download: "fundo-missoes-backup-" + M.hoje() + ".json" });
    document.body.appendChild(a); a.click(); a.remove();
    setTimeout(function () { URL.revokeObjectURL(url); }, 1000);
    aviso("Backup baixado. Guarde o arquivo em local seguro: ele contém nomes e valores.", false);
  });

  document.getElementById("arq-backup").addEventListener("change", function (ev) {
    var arquivo = ev.target.files && ev.target.files[0];
    ev.target.value = "";
    if (!arquivo) return;
    var leitor = new FileReader();
    leitor.onload = function () {
      var o;
      try { o = JSON.parse(String(leitor.result)); } catch (e) { aviso("O arquivo não é um JSON válido.", true); return; }
      if (!o || o.app !== "fundo-missoes" || !o.dados) { aviso("Este arquivo não é um backup do Fundo de Missões.", true); return; }
      if (!window.confirm("Substituir TODOS os dados atuais pelos do backup?")) return;
      dados = M.normalizar(o.dados);
      salvar(); desenhar(); aviso("Backup restaurado.", false);
    };
    leitor.onerror = function () { aviso("Não foi possível ler o arquivo.", true); };
    leitor.readAsText(arquivo);
  });

  ["e-data", "r-data", "s-data", "v-data", "c-data", "a-data", "cdi-ate"].forEach(function (id) { document.getElementById(id).value = M.hoje(); });
  document.getElementById("pc-mes").value = M.hoje().slice(0, 7);
  desenhar();
})();
