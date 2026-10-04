// Página Carteira: mostra a posição importada da XP (importar.js) e leva o saldo para a página Aportes.
(function () {
  "use strict";

  var P = window.Plano, dados = P.estado.dados;
  var moeda = P.moeda, el = P.el, texto = P.texto, salvar = P.salvar, limpar = P.limpar;
  var TAMANHO_MAX = 5 * 1024 * 1024;

  function oculto() { return P.estado.oculto; }
  function qtd(n) { return n === null || n === undefined ? "–" : oculto() ? "••" : String(n).replace(".", ","); }
  function dinheiro(n) { return n === null || n === undefined ? "–" : moeda(n); }
  function porcento(n, casas) { return n === null || n === undefined ? "–" : n.toFixed(casas === undefined ? 2 : casas).replace(".", ",") + "%"; }
  function chaveData(s) { var m = /^(\d{2})\/(\d{2})\/(\d{4})$/.exec(s || ""); return m ? Number(m[3]) * 10000 + Number(m[2]) * 100 + Number(m[1]) : 0; }
  function dataBonita(s) { return chaveData(s) >= 99990000 ? "sem data" : s || "–"; }

  function mostrarMensagem(texto, erro) {
    var m = document.getElementById("msg");
    m.hidden = !texto;
    m.textContent = texto || "";
    m.className = erro ? "alerta" : "alerta ok";
  }

  // ---------------------------------------------------------------- tabelas dos ativos
  var COLUNAS = [
    ["saldo", "Saldo", "dinheiro"], ["pctAloc", "% da carteira", "pct"], ["rentab", "Rentabilidade", "rentab"],
    ["precoMedio", "Preço médio", "dinheiro"], ["ultimoPreco", "Último preço", "dinheiro"], ["qtd", "Quantidade", "qtd"],
    ["aplicado", "Valor aplicado", "dinheiro"], ["saldoLiquido", "Saldo líquido", "dinheiro"], ["vencimento", "Vencimento", "texto"]
  ];

  function celula(tipo, v) {
    var td = el("td");
    if (tipo === "dinheiro") td.textContent = dinheiro(v);
    else if (tipo === "pct") td.textContent = porcento(v);
    else if (tipo === "qtd") td.textContent = qtd(v);
    else if (tipo === "rentab") {
      td.textContent = v === null || v === undefined ? "–" : (v < 0 ? "− " : "+ ") + porcento(Math.abs(v));
      if (v !== null && v !== undefined) td.className = v < 0 ? "negativo" : "positivo";
    } else td.textContent = v || "–";
    return td;
  }

  function tabelaDoGrupo(grupo) {
    var cols = COLUNAS.filter(function (c) { return grupo.itens.some(function (it) { return it[c[0]] !== null && it[c[0]] !== undefined && it[c[0]] !== ""; }); });
    var tabela = el("table", { className: "tabela tabela-simples" });
    var tr = el("tr");
    tr.appendChild(el("th", { textContent: "Ativo", scope: "col" }));
    cols.forEach(function (c) { tr.appendChild(el("th", { textContent: c[1], scope: "col" })); });
    tabela.appendChild(el("thead")).appendChild(tr);
    var corpo = el("tbody");
    grupo.itens.forEach(function (it) {
      var linha = el("tr");
      linha.appendChild(el("th", { textContent: it.nome, scope: "row" }));
      cols.forEach(function (c) { linha.appendChild(celula(c[2], it[c[0]])); });
      corpo.appendChild(linha);
    });
    tabela.appendChild(corpo);
    var envolve = el("div", { className: "tabela-rolagem" });
    envolve.appendChild(tabela);
    return envolve;
  }

  function desenharSecoes(c) {
    var caixa = limpar("secoes");
    c.secoes.forEach(function (s) {
      var cartao = el("section", { className: "cartao" });
      var topo = el("div", { className: "cartao-topo" });
      topo.appendChild(el("h2", { textContent: s.nome }));
      topo.appendChild(el("span", { className: "selo", textContent: dinheiro(s.total) }));
      cartao.appendChild(topo);
      s.grupos.forEach(function (g) {
        cartao.appendChild(el("h3", { className: "sub", textContent: porcento(g.pctGrupo, 1).replace(".", ",") + " da carteira · " + g.nome }));
        cartao.appendChild(tabelaDoGrupo(g));
      });
      caixa.appendChild(cartao);
    });
  }

  // ---------------------------------------------------------------- divisão por classe (barra numerada)
  function desenharClasses(c) {
    var cl = window.Importar.classes(c), barra = limpar("barra-classes"), leg = limpar("legenda-classes");
    cl.forEach(function (x, i) {
      var seg = el("span", { className: "seg-classe k" + ((i % 7) + 1) });
      seg.style.width = (x.pct * 100) + "%";
      seg.title = x.nome + ": " + dinheiro(x.saldo) + " (" + porcento(x.pct * 100, 1) + ")";
      if (x.pct > 0.035) seg.textContent = String(i + 1);
      barra.appendChild(seg);
      var li = el("li");
      li.appendChild(el("span", { className: "num-classe k" + ((i % 7) + 1), textContent: String(i + 1) }));
      li.appendChild(el("span", { textContent: x.nome }));
      li.appendChild(el("b", { textContent: dinheiro(x.saldo) }));
      li.appendChild(el("i", { textContent: porcento(x.pct * 100, 1) }));
      leg.appendChild(li);
    });
    barra.setAttribute("aria-label", "Divisão da carteira: " + cl.map(function (x) { return x.nome + " " + porcento(x.pct * 100, 1); }).join("; ") + ".");
  }

  // ---------------------------------------------------------------- proventos e custódia
  function desenharProventos(c) {
    var itens = [];
    c.proventos.forEach(function (g) { g.itens.forEach(function (it) { itens.push({ it: it, origem: g.secao }); }); });
    itens.sort(function (a, b) { return chaveData(a.it.pagamento) - chaveData(b.it.pagamento); });
    var t = limpar("tabela-prov"), tr = el("tr");
    ["Ativo", "Evento", "Valor bruto", "Valor líquido", "Previsão"].forEach(function (h) { tr.appendChild(el("th", { textContent: h, scope: "col" })); });
    t.appendChild(el("thead")).appendChild(tr);
    var corpo = el("tbody");
    itens.forEach(function (x) {
      var l = el("tr");
      l.appendChild(el("th", { textContent: x.it.nome, scope: "row" }));
      l.appendChild(el("td", { textContent: (x.it.evento || "–").toLowerCase().replace(/^./, function (m) { return m.toUpperCase(); }) }));
      l.appendChild(el("td", { textContent: dinheiro(x.it.bruto) }));
      l.appendChild(el("td", { textContent: dinheiro(x.it.liquido) }));
      l.appendChild(el("td", { textContent: dataBonita(x.it.pagamento) }));
      corpo.appendChild(l);
    });
    t.appendChild(corpo);
    var bruto = c.provTotais.reduce(function (s, p) { return s + (p.total || 0); }, 0);
    var liquido = itens.reduce(function (s, x) { return s + (x.it.liquido || 0); }, 0);
    texto("selo-prov", dinheiro(bruto));
    return { bruto: bruto, liquido: liquido, n: itens.length };
  }

  function desenharCustodia(c) {
    var itens = [];
    c.custodia.forEach(function (g) { g.itens.forEach(function (it) { itens.push(it); }); });
    document.getElementById("cartao-custodia").hidden = itens.length === 0;
    var t = limpar("tabela-cust"), tr = el("tr");
    ["Ativo", "Valor total", "Quantidade", "Vencimento"].forEach(function (h) { tr.appendChild(el("th", { textContent: h, scope: "col" })); });
    t.appendChild(el("thead")).appendChild(tr);
    var corpo = el("tbody"), total = 0;
    itens.forEach(function (it) {
      total += it.saldo || 0;
      var l = el("tr");
      l.appendChild(el("th", { textContent: it.nome, scope: "row" }));
      l.appendChild(el("td", { textContent: dinheiro(it.saldo) }));
      l.appendChild(el("td", { textContent: qtd(it.qtd) }));
      l.appendChild(el("td", { textContent: it.vencimento || "–" }));
      corpo.appendChild(l);
    });
    t.appendChild(corpo);
    texto("selo-cust", dinheiro(total));
  }

  // ---------------------------------------------------------------- página
  // ---------------------------------------------------------------- alocação-alvo, concentração e retorno esperado
  var Al = P.alocacao, NIVEIS = { bom: "✓ Boa", atencao: "! Atenção", alerta: "⚠ Alerta" };

  function entrada(valor, rotulo, aoMudar, largura) {
    var i = el("input", { type: "text", className: "mini", value: valor === null || valor === undefined ? "" : String(valor).replace(".", ","), inputMode: "decimal" });
    i.style.maxWidth = largura || "84px"; i.setAttribute("aria-label", rotulo);
    i.addEventListener("change", function () { if (!aoMudar(i.value)) i.setAttribute("aria-invalid", "true"); else { i.removeAttribute("aria-invalid"); salvar(); desenharAlocacao(dados.carteira); } });
    return i;
  }
  function sinal(v, casas) { return (v < 0 ? "− " : "+ ") + Math.abs(v).toFixed(casas).replace(".", ",") + " pp"; }

  function desenharAlocacao(c) {
    var a = Al.analisar(c, dados.alocacao), t = limpar("tabela-alocacao"), cab = el("tr");
    if (!a) return;
    ["Classe", "Hoje", "% hoje", "Alvo (%)", "Desvio", "Retorno esperado (% ao ano)", "Aportar para chegar ao alvo"].forEach(function (h) { cab.appendChild(el("th", { textContent: h, scope: "col" })); });
    t.appendChild(el("thead")).appendChild(cab);
    var corpo = el("tbody");
    a.classes.forEach(function (k) {
      var tr = el("tr"), th = el("th", { scope: "row", textContent: k.nome });
      tr.appendChild(th);
      tr.appendChild(el("td", { textContent: k.valor > 0 ? moeda(k.valor) : "–" }));
      tr.appendChild(el("td", { textContent: k.valor > 0 ? porcento(k.pct * 100, 1) : "–" }));
      var tdA = el("td"); tdA.appendChild(entrada(k.alvo, "Alvo de " + k.nome + " em %", function (v) { return Al.definirAlvo(dados.alocacao, k.id, v); })); tr.appendChild(tdA);
      var desvio = el("td", { textContent: k.desvio === null ? "–" : Math.abs(k.desvio) < 0.05 ? "no alvo" : sinal(k.desvio, 1) });
      if (k.desvio !== null && Math.abs(k.desvio) >= 5) desvio.className = k.desvio > 0 ? "negativo" : "positivo";
      tr.appendChild(desvio);
      var tdR = el("td"); tdR.appendChild(entrada(k.retorno, "Retorno esperado de " + k.nome + " em % ao ano", function (v) { return Al.definirRetorno(dados.alocacao, k.id, v); })); tr.appendChild(tdR);
      tr.appendChild(el("td", { textContent: k.compra === null ? "–" : k.compra > 0.005 ? moeda(k.compra) : "–" }));
      corpo.appendChild(tr);
    });
    t.appendChild(corpo);

    var r = a.rebalanceamento, texto1;
    if (!a.temAlvo) texto1 = "Preencha o alvo de cada classe para ver o desvio e quanto aportar.";
    else if (!a.fechado) texto1 = "Os alvos somam " + porcento(a.somaAlvo, 1) + ": ajuste para que somem 100%.";
    else if (r.possivel) texto1 = r.aporte < 0.005 ? "✓ A carteira já está no alvo." : "Para chegar ao alvo só aportando (sem vender), seria preciso aportar " + moeda(r.aporte) + ", distribuídos como na última coluna. Com aportes menores, comece pela classe mais abaixo do alvo.";
    else texto1 = "Há " + moeda(r.venda) + " em classes sem alvo (" + r.foraDoAlvo.join("; ") + "): só dá para chegar ao alvo vendendo parte delas.";
    texto("alocacao-texto", texto1);

    var btn = document.getElementById("btn-retorno");
    if (a.retornoEsperado === null) {
      texto("retorno-texto", "Retorno esperado da carteira: informe o retorno esperado de " + a.faltandoRetorno.join("; ") + " para calcular.");
      btn.hidden = true;
    } else {
      var re = Math.round(a.retornoEsperado * 10) / 10;
      texto("retorno-texto", "Retorno esperado ponderado pela carteira de hoje: " + porcento(re, 1) + " ao ano (nominal). A página Aportes usa hoje " + porcento(Number(dados.aportes.xp.retorno) || 0, 1) + " para a corretora.");
      btn.hidden = false; btn.textContent = "Usar " + porcento(re, 1) + " como retorno da corretora XP";
      btn.onclick = function () { dados.aportes.xp.retorno = re; salvar(); mostrarMensagem("Retorno da corretora XP atualizado para " + porcento(re, 1) + " ao ano. Veja o efeito em Aportes e Aposentadoria.", false); desenharAlocacao(c); };
    }

    // concentração
    var co = a.concentracao, tc = limpar("tabela-concentracao"), cab2 = el("tr");
    ["Posição", "Classe", "Valor", "% da carteira"].forEach(function (h) { cab2.appendChild(el("th", { textContent: h, scope: "col" })); });
    tc.appendChild(el("thead")).appendChild(cab2);
    var corpo2 = el("tbody"), nomes = {}; Al.CLASSES.forEach(function (k) { nomes[k.id] = k.nome; });
    co.maiores.forEach(function (m) {
      var tr = el("tr");
      tr.appendChild(el("th", { scope: "row", textContent: m.nome }));
      tr.appendChild(el("td", { textContent: nomes[m.classe] }));
      tr.appendChild(el("td", { textContent: moeda(m.saldo) }));
      tr.appendChild(el("td", { textContent: porcento(m.pct * 100, 1) }));
      corpo2.appendChild(tr);
    });
    tc.appendChild(corpo2);
    texto("concentracao-texto", NIVEIS[co.nivel] + ": a maior posição é " + porcento(co.maior * 100, 1) + " da carteira e as 5 maiores somam " + porcento(co.top5 * 100, 1) + " (" + co.qtd + " ativos). Referência: nenhuma posição acima de 10%; acima de 20% é concentração alta. Renda fixa bancária tem a garantia do FGC só até 250 mil reais por instituição: confira o emissor de cada título.");

    // classe de cada ativo
    var tab = limpar("tabela-ativos"), cab3 = el("tr");
    ["Ativo", "Valor", "Classe"].forEach(function (h) { cab3.appendChild(el("th", { textContent: h, scope: "col" })); });
    tab.appendChild(el("thead")).appendChild(cab3);
    var corpo3 = el("tbody");
    Al.ativos(c, dados.alocacao.mapa).sort(function (x, y) { return y.saldo - x.saldo; }).forEach(function (at) {
      var tr = el("tr"), sel = el("select", { className: "mini" });
      sel.setAttribute("aria-label", "Classe de " + at.nome);
      Al.CLASSES.forEach(function (k) { sel.appendChild(el("option", { value: k.id, textContent: k.nome, selected: k.id === at.classe })); });
      sel.addEventListener("change", function () { Al.definirClasse(dados.alocacao, at.nome, sel.value); salvar(); desenharAlocacao(c); });
      tr.appendChild(el("th", { scope: "row", textContent: at.nome }));
      tr.appendChild(el("td", { textContent: moeda(at.saldo) }));
      var td = el("td"); td.appendChild(sel); tr.appendChild(td);
      corpo3.appendChild(tr);
    });
    tab.appendChild(corpo3);
  }

  function desenhar() {
    P.desenharCabecalho();
    mostrarMensagem(""); // mensagens antigas podem conter valores em reais: somem ao redesenhar (ex.: ao ocultar valores)
    var c = dados.carteira;
    document.getElementById("conteudo").hidden = !c;
    var btnSaldo = document.getElementById("btn-saldo"), btnRem = document.getElementById("btn-remover");
    btnSaldo.hidden = !c; btnRem.hidden = !c;
    if (!c) {
      ["c-patrimonio", "c-investido", "c-disponivel", "c-proventos"].forEach(function (id) { texto(id, "–"); });
      texto("c-patrimonio-det", "importe a posição para ver");
      texto("c-investido-det", ""); texto("c-proventos-det", "");
      texto("status-import", "Nenhum arquivo importado ainda.");
      return;
    }
    texto("c-patrimonio", dinheiro(c.patrimonio));
    texto("c-patrimonio-det", "posição de " + (c.geradoEm || "data desconhecida"));
    texto("c-investido", dinheiro(c.investido));
    texto("c-investido-det", "ações, Tesouro, FIIs e fundos + proventos");
    texto("c-disponivel", dinheiro(c.disponivel));
    texto("status-import", "Importado de \"" + c.arquivo + "\" · posição de " + (c.geradoEm || "data desconhecida") + " · " + c.secoes.reduce(function (t, s) { return t + s.grupos.reduce(function (u, g) { return u + g.itens.length; }, 0); }, 0) + " ativos.");
    btnSaldo.textContent = "Usar " + dinheiro(c.patrimonio) + " como saldo da corretora XP";

    desenharClasses(c);
    desenharAlocacao(c);
    desenharSecoes(c);
    var prov = desenharProventos(c);
    desenharCustodia(c);
    texto("c-proventos", dinheiro(prov.bruto));
    texto("c-proventos-det", prov.n + " eventos · líquido " + dinheiro(prov.liquido));
    if (c.avisos && c.avisos.length) mostrarMensagem("Atenção: " + c.avisos.join(" "), true);
  }

  async function importar(arquivo) {
    mostrarMensagem("");
    if (!arquivo) return;
    if (typeof DecompressionStream === "undefined") { mostrarMensagem("Este navegador é antigo demais para ler o arquivo. Use uma versão recente do Edge, Chrome ou Firefox.", true); return; }
    if (!/\.xlsx$/i.test(arquivo.name)) { mostrarMensagem("Escolha o arquivo .xlsx exportado pela XP.", true); return; }
    if (arquivo.size > TAMANHO_MAX) { mostrarMensagem("O arquivo é grande demais (mais de 5 MB) para ser a posição detalhada.", true); return; }
    try {
      var carteira = window.Importar.interpretarCarteira(await window.Importar.lerXlsx(await arquivo.arrayBuffer()));
      carteira.arquivo = arquivo.name;
      carteira.importadoEm = new Date().toISOString();
      dados.carteira = carteira;
      salvar();
      desenhar();
      if (!carteira.avisos.length) mostrarMensagem("Posição importada com sucesso. Os totais do arquivo conferem com os ativos lidos.", false);
    } catch (e) {
      mostrarMensagem("Não consegui importar: " + (e && e.message ? e.message : "arquivo inválido"), true);
    }
  }

  P.iniciarCabecalho(desenhar);
  document.getElementById("arquivo").addEventListener("change", function (e) { importar(e.target.files[0]).then(function () { e.target.value = ""; }); });
  document.getElementById("btn-saldo").addEventListener("click", function () {
    var c = dados.carteira;
    if (!c || c.patrimonio === null) return;
    dados.aportes.xp.saldo = c.patrimonio;
    salvar();
    mostrarMensagem("Saldo da corretora XP atualizado para " + dinheiro(c.patrimonio) + ". Veja o efeito na página Aportes e consórcios.", false);
  });
  document.getElementById("btn-remover").addEventListener("click", function () {
    if (!window.confirm("Remover os dados importados da carteira? O saldo da corretora XP na página Aportes não muda.")) return;
    dados.carteira = null;
    salvar();
    mostrarMensagem("");
    desenhar();
  });

  desenhar();
})();
