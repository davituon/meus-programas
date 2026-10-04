// Página Cartão de crédito: quatro cartões (4 cartões, renomeáveis), com compras à vista,
// parceladas e recorrentes, e a fatura de cada mês. Só acompanha: não altera o orçamento.
// Os cálculos ficam em comum.js (faturaDoMes, parcelaDaCompra, parcelasRestantes).
(function () {
  "use strict";

  var P = window.Plano, dados = P.estado.dados;
  var moeda = P.moeda, moedaInteira = P.moedaInteira, lerNumero = P.lerNumero, lerAte = P.lerAte, formatarAte = P.formatarAte;
  var el = P.el, texto = P.texto, salvar = P.salvar, nomeMes = P.nomeMes, campoNumero = P.campoNumero;
  var limpar = P.limpar, soma = P.soma;

  var TIPOS = [["vista", "À vista"], ["parcelado", "Parcelado"], ["recorrente", "Todo mês"]];
  var SUGESTOES = ["Mercado", "Combustível", "Farmácia e saúde", "Restaurantes e lazer", "Compras", "Casa", "Assinaturas", "Viagem", "Educação", "Outros"];

  function cartoes() { return dados.cartao.cartoes; }
  function cartaoPorId(id) { return cartoes().filter(function (c) { return c.id === id; })[0] || cartoes()[0]; }
  function escopo() { return dados.cartao.filtro && dados.cartao.filtro !== "todos" && cartoes().some(function (c) { return c.id === dados.cartao.filtro; }) ? dados.cartao.filtro : "todos"; }
  function nomeEscopo() { return escopo() === "todos" ? "todos os cartões" : cartaoPorId(escopo()).nome; }
  function doEscopo(c) { return escopo() === "todos" || c.cartao === escopo(); }

  function chaveMes(idx) { return { ano: Math.floor(idx / 12), mes: idx % 12 + 1 }; }
  function rotuloCurto(idx) { var m = chaveMes(idx); return String(m.mes).padStart(2, "0") + "/" + String(m.ano).slice(2); }
  function textoYM(ano, mes) { return ano + "-" + String(mes).padStart(2, "0"); }

  // ---------------------------------------------------------------- importar fatura (CSV)
  var IF = window.ImportarFatura, imp = null;

  function mostrarImp(t, erro) { var m = document.getElementById("imp-msg"); m.textContent = t; m.hidden = !t; m.className = "alerta" + (erro ? "" : " ok"); }

  /** Lê o arquivo como UTF-8 e, se der erro (bancos costumam usar Windows-1252), tenta Windows-1252. */
  function lerTexto(arquivo) {
    return arquivo.arrayBuffer().then(function (buf) {
      try { return new TextDecoder("utf-8", { fatal: true }).decode(buf); }
      catch (e) { return new TextDecoder("windows-1252").decode(buf); }
    });
  }

  function mesesDaFatura() {
    var out = [], ini = P.INICIO.ano * 12 + P.INICIO.mes - 1 - 6, i;
    for (i = 0; i < 6 + 30; i++) { var idx = ini + i; out.push(Math.floor(idx / 12) + "-" + String(idx % 12 + 1).padStart(2, "0")); }
    return out;
  }
  function rotuloMes(ym) { var p = ym.split("-"); return P.MESES[Number(p[1]) - 1].toLowerCase() + "/" + p[0]; }

  function interpretarImp() {
    var hoje = new Date(), ref = imp.mes ? { ano: Number(imp.mes.slice(0, 4)), mes: Number(imp.mes.slice(5, 7)) } : { ano: hoje.getFullYear(), mes: hoje.getMonth() + 1 };
    imp.r = IF.interpretar(imp.grade, imp.colunas, imp.linhaCab, ref);
    imp.marcados = {};
    imp.r.lancamentos.forEach(function (l) { imp.marcados[l.n] = !l.ignorar; });
  }

  function desenharImportacao() {
    var corpo = document.getElementById("imp-corpo");
    corpo.hidden = !imp;
    document.getElementById("imp-desfazer").hidden = !dados.cartao.compras.some(function (c) { return c.origem === "fatura" && c.lote; });
    if (!imp) return;
    var selC = limpar("imp-cartao"), selM = limpar("imp-mes");
    opcoesDeCartao(imp.cartao).forEach(function (o) { selC.appendChild(o); });
    mesesDaFatura().forEach(function (ym) { selM.appendChild(el("option", { value: ym, textContent: rotuloMes(ym), selected: ym === imp.mes })); });

    // colunas
    var cx = limpar("imp-colunas"), largura = imp.grade.reduce(function (m, l) { return Math.max(m, l.length); }, 0);
    [["data", "Data", true], ["descricao", "Descrição", true], ["valor", "Valor", true], ["parcela", "Parcela (opcional)", false], ["categoria", "Categoria (opcional)", false]].forEach(function (c) {
      var rot = el("label"), sel = el("select"); rot.appendChild(document.createTextNode(c[1])); rot.appendChild(sel);
      sel.setAttribute("aria-label", "Coluna de " + c[1]);
      if (!c[2]) sel.appendChild(el("option", { value: "", textContent: "(nenhuma)" }));
      var exemplo = imp.grade[Math.min(imp.grade.length - 1, imp.linhaCab + 1)] || [];
      for (var j = 0; j < largura; j++) {
        var cab = imp.linhaCab >= 0 ? imp.grade[imp.linhaCab][j] : "";
        sel.appendChild(el("option", { value: String(j), textContent: "Coluna " + (j + 1) + (cab ? " · " + cab : "") + (exemplo[j] && !P.estado.oculto ? " (ex.: " + exemplo[j].slice(0, 18) + ")" : ""), selected: imp.colunas[c[0]] === j }));
      }
      sel.addEventListener("change", function () {
        if (sel.value === "") delete imp.colunas[c[0]]; else imp.colunas[c[0]] = Number(sel.value);
        interpretarImp(); desenharImportacao();
      });
      cx.appendChild(rot);
    });
    document.getElementById("imp-colunas-caixa").open = imp.det.confianca !== "alta" || imp.r.lancamentos.length === 0;

    // prévia
    var L = imp.r.lancamentos, t = limpar("imp-tabela"), cab2 = el("tr");
    ["", "Data", "Descrição", "Tipo", "Categoria", "Valor", "Situação"].forEach(function (h) { cab2.appendChild(el("th", { textContent: h, scope: "col" })); });
    t.appendChild(el("thead")).appendChild(cab2);
    var tb = el("tbody"), sel = 0, soma = 0, repetidas = 0;
    L.forEach(function (l) {
      var conv = IF.converter(l, imp.mes, imp.cartao), rep = !l.ignorar && IF.jaExiste(conv, dados.cartao.compras);
      var tr = el("tr", { className: l.ignorar ? "cc-ignorada" : "" });
      var cb = el("input", { type: "checkbox", checked: !!imp.marcados[l.n] });
      cb.setAttribute("aria-label", "Importar " + l.descricao);
      cb.addEventListener("change", function () { imp.marcados[l.n] = cb.checked; desenharImportacao(); });
      var td0 = el("td"); td0.appendChild(cb); tr.appendChild(td0);
      var p = l.data.split("-"); tr.appendChild(el("td", { textContent: p[2] + "/" + p[1] + "/" + p[0] }));
      tr.appendChild(el("th", { scope: "row", textContent: l.descricao }));
      tr.appendChild(el("td", { textContent: l.parcelasTotal ? "parcela " + l.parcelaAtual + " de " + l.parcelasTotal : "à vista" }));
      tr.appendChild(el("td", { textContent: l.categoria }));
      tr.appendChild(el("td", { textContent: (l.tipoLinha === "compra" ? "" : "− ") + moeda(l.valor) }));
      tr.appendChild(el("td", { textContent: l.tipoLinha === "pagamento" ? "pagamento da fatura (ignorado)" : l.tipoLinha === "credito" ? "estorno ou crédito (ignorado)" : rep ? "! já existe" : "✓ nova" }));
      tb.appendChild(tr);
      if (imp.marcados[l.n]) { sel++; soma += l.valor; if (rep) repetidas++; }
    });
    if (!L.length) { var vz = el("tr"); vz.appendChild(el("td", { colSpan: 7, className: "vazio", textContent: "Nenhum lançamento lido. Ajuste as colunas acima." })); tb.appendChild(vz); }
    t.appendChild(tb);
    texto("imp-resumo", L.length ? sel + (sel === 1 ? " lançamento selecionado" : " lançamentos selecionados") + ", somando " + moeda(soma) + " (cartão " + cartaoPorId(imp.cartao).nome + ", fatura de " + rotuloMes(imp.mes) + ")." + (repetidas ? " ! " + repetidas + (repetidas === 1 ? " já existe" : " já existem") + " e será pulada." : "") + (imp.r.invalidas ? " " + imp.r.invalidas + " linha(s) do arquivo não puderam ser lidas." : "") : "");
    document.getElementById("imp-importar").disabled = sel === 0;
  }

  function abrirImportacao(texto, nome) {
    var grade = IF.lerCSV(texto);
    if (!grade.length) { mostrarImp("O arquivo está vazio ou não parece um CSV.", true); return; }
    var det = IF.detectar(grade);
    imp = { grade: grade, det: det, colunas: Object.assign({}, det.colunas), linhaCab: det.linhaCab, cartao: escopo() === "todos" ? cartoes()[0].id : escopo(), mes: null, nome: nome };
    var primeiro = IF.interpretar(grade, imp.colunas, imp.linhaCab, { ano: new Date().getFullYear(), mes: 12 });
    imp.mes = IF.mesSugerido(primeiro.lancamentos) || new Date().toISOString().slice(0, 7);
    if (mesesDaFatura().indexOf(imp.mes) < 0) imp.mes = mesesDaFatura()[6];
    interpretarImp();
    mostrarImp(det.confianca === "nenhuma" ? "Não reconheci as colunas. Escolha abaixo qual é a data, a descrição e o valor." : det.confianca === "baixa" ? "Não achei um cabeçalho; as colunas foram adivinhadas. Confira a prévia." : "", det.confianca !== "alta");
    desenharImportacao();
  }

  P.abrirFatura = abrirImportacao; // também usado pelos testes de tela (a leitura do arquivo em si é assíncrona)
  document.getElementById("imp-arquivo").addEventListener("change", function (e) {
    var arq = e.target.files && e.target.files[0]; e.target.value = "";
    if (!arq) return;
    if (arq.size > 2 * 1024 * 1024) { mostrarImp("O arquivo é grande demais (mais de 2 MB) para ser uma fatura.", true); return; }
    if (!/\.(csv|txt)$/i.test(arq.name)) { mostrarImp("Escolha o arquivo .csv da fatura. PDF e Excel (.xlsx) não são lidos: no Excel, use Salvar como CSV.", true); return; }
    lerTexto(arq).then(function (t) { abrirImportacao(t, arq.name); }, function () { mostrarImp("Não consegui ler o arquivo.", true); });
  });
  document.getElementById("imp-cartao").addEventListener("change", function (e) { imp.cartao = e.target.value; desenharImportacao(); });
  document.getElementById("imp-mes").addEventListener("change", function (e) { imp.mes = e.target.value; desenharImportacao(); });
  document.getElementById("imp-cancelar").addEventListener("click", function () { imp = null; mostrarImp(""); desenharImportacao(); });
  document.getElementById("imp-importar").addEventListener("click", function () {
    var escolhidas = imp.r.lancamentos.filter(function (l) { return imp.marcados[l.n]; });
    var r = IF.importar(dados.cartao.compras, escolhidas, imp.cartao, imp.mes);
    salvar(); imp = null; desenhar();
    mostrarImp(r.importadas + (r.importadas === 1 ? " compra importada" : " compras importadas") + (r.repetidas ? " e " + r.repetidas + " pulada(s) por já existirem" : "") + ". Confira nos blocos de cada cartão, abaixo. Se algo saiu errado, use \"Desfazer a última importação\".", false);
  });
  document.getElementById("imp-desfazer").addEventListener("click", function () {
    var quantas = dados.cartao.compras.filter(function (c) { return c.origem === "fatura"; });
    if (!window.confirm("Remover as compras da última importação de fatura?")) return;
    var n = IF.desfazerUltima(dados.cartao.compras);
    salvar(); desenhar(); mostrarImp(n + (n === 1 ? " compra removida." : " compras removidas."), false);
  });

  // ---------------------------------------------------------------- blocos de cada cartão (estrutura)
  function campoTexto(valor, rotulo, aoMudar, classe) {
    var c = el("input", { type: "text", value: valor, maxLength: 60, className: classe || "campo-compra" });
    c.setAttribute("aria-label", rotulo);
    c.addEventListener("input", function () { aoMudar(c.value); salvar(); });
    return c;
  }

  function campoMes(valor, rotulo, aoMudar, desligado) {
    var c = el("input", { type: "text", value: formatarAte(valor), className: "mini", placeholder: "mm/aaaa", maxLength: 7, disabled: !!desligado, title: "Mês no formato mm/aaaa, por exemplo 11/2026." });
    c.setAttribute("aria-label", rotulo);
    c.addEventListener("change", function () {
      var novo = lerAte(c.value);
      if (novo === null) { c.setAttribute("aria-invalid", "true"); return; }
      c.removeAttribute("aria-invalid");
      aoMudar(novo); salvar(); desenhar();
    });
    return c;
  }

  function opcoesDeCartao(selecionado) {
    return cartoes().map(function (c) { return el("option", { value: c.id, textContent: c.nome, selected: c.id === selecionado }); });
  }

  function linhaDaCompra(c, i) {
    var bloco = el("div", { className: "compra-bloco", id: "compra-" + i });
    var linha = el("div", { className: "compra" });
    var nome = c.nome || "compra " + (i + 1);

    linha.appendChild(campoTexto(c.nome, "Descrição da compra " + (i + 1), function (v) { c.nome = v; atualizar(); }));
    var categoria = campoTexto(c.categoria, "Categoria de " + nome, function (v) { c.categoria = v; atualizar(); });
    categoria.setAttribute("list", "categorias");
    linha.appendChild(categoria);

    var tipo = el("select", { className: "mini" });
    tipo.setAttribute("aria-label", "Tipo de " + nome);
    TIPOS.forEach(function (t) { tipo.appendChild(el("option", { value: t[0], textContent: t[1], selected: c.tipo === t[0] })); });
    tipo.addEventListener("change", function () { c.tipo = tipo.value; salvar(); desenhar(); });
    linha.appendChild(tipo);

    var valor = campoNumero({ moeda: true, valor: c.valor, prefixo: "R$", rotulo: (c.tipo === "recorrente" ? "Valor por mês de " : "Valor total de ") + nome });
    valor.campo.addEventListener("input", function () { c.valor = lerNumero(valor.campo.value); salvar(); atualizar(); });
    linha.appendChild(valor.caixa);

    var parc = el("input", { type: "number", min: "1", max: "120", step: "1", value: c.tipo === "parcelado" ? c.parcelas : (c.tipo === "vista" ? 1 : ""), disabled: c.tipo !== "parcelado", className: "mini" });
    parc.setAttribute("aria-label", "Número de parcelas de " + nome);
    parc.addEventListener("input", function () { c.parcelas = Math.max(1, Math.min(120, parseInt(parc.value, 10) || 1)); salvar(); atualizar(); });
    linha.appendChild(parc);

    linha.appendChild(campoMes(c.inicio, (c.tipo === "recorrente" ? "Começa em " : "Primeira parcela de ") + nome, function (v) { c.inicio = v; }));
    linha.appendChild(campoMes(c.ate, "Termina em (opcional) " + nome, function (v) { c.ate = v; }, c.tipo !== "recorrente"));

    var rm = el("button", { type: "button", className: "remover", textContent: "✕" });
    rm.setAttribute("aria-label", "Remover " + nome);
    rm.addEventListener("click", function () { dados.cartao.compras.splice(i, 1); salvar(); desenhar(); });
    linha.appendChild(rm);
    bloco.appendChild(linha);

    var rodape = el("div", { className: "compra-rodape" });
    rodape.appendChild(el("p", { className: "nota nota-compra", id: "nota-compra-" + i }));
    var mover = el("label", { className: "mover" });
    var sel = el("select", { className: "mini mover-sel" });
    sel.setAttribute("aria-label", "Mover " + nome + " para outro cartão");
    opcoesDeCartao(c.cartao).forEach(function (o) { sel.appendChild(o); });
    sel.addEventListener("change", function () { c.cartao = sel.value; salvar(); desenhar(); });
    mover.append(el("span", { textContent: "Mover para" }), sel);
    rodape.appendChild(mover);
    bloco.appendChild(rodape);
    return bloco;
  }

  function desenharBlocos() {
    var caixa = limpar("compras"), compras = dados.cartao.compras;
    document.getElementById("btn-exemplos").hidden = compras.length > 0;
    var cats = limpar("categorias");
    SUGESTOES.concat(compras.map(function (c) { return (c.categoria || "").trim(); })).filter(function (v, i, a) { return v && a.indexOf(v) === i; })
      .forEach(function (v) { cats.appendChild(el("option", { value: v })); });

    cartoes().forEach(function (cx) {
      var bloco = el("section", { className: "cartao-bloco", id: "bloco-" + cx.id });
      bloco.setAttribute("aria-label", "Cartão " + cx.nome);
      var topo = el("div", { className: "cartao-bloco-topo" });
      topo.appendChild(campoTexto(cx.nome, "Nome do cartão", function (v) { cx.nome = v || "Cartão"; atualizar(); renomearNaTela(); }, "nome-cartao"));
      topo.appendChild(campoTexto(cx.banco, "Banco do cartão " + cx.nome, function (v) { cx.banco = v; atualizar(); }, "banco-cartao"));
      topo.appendChild(el("span", { className: "selo", id: "fat-" + cx.id }));
      bloco.appendChild(topo);

      var minhas = [];
      compras.forEach(function (c, i) { if (c.cartao === cx.id) minhas.push([c, i]); });
      if (!minhas.length) {
        bloco.appendChild(el("p", { className: "vazio", textContent: "Nenhuma compra neste cartão ainda." }));
      } else {
        var cab = el("div", { className: "compra cab" });
        ["Descrição", "Categoria", "Tipo", "Valor", "Parcelas", "1ª parcela / início", "Até (assinatura)", ""].forEach(function (h) { cab.appendChild(el("span", { textContent: h })); });
        bloco.appendChild(cab);
        minhas.forEach(function (par) { bloco.appendChild(linhaDaCompra(par[0], par[1])); });
      }
      var add = el("button", { type: "button", className: "adicionar", textContent: "+ Adicionar compra em " + cx.nome });
      add.addEventListener("click", function () {
        dados.cartao.compras.push(novaCompra({ cartao: cx.id }));
        salvar(); desenhar();
        var campos = document.querySelectorAll("#bloco-" + cx.id + " .compra:not(.cab) .campo-compra");
        if (campos.length) campos[campos.length - 2].focus();
      });
      bloco.appendChild(add);
      caixa.appendChild(bloco);
    });
  }

  /** Atualiza os nomes dos cartões onde eles aparecem como opção, sem refazer a página (para não perder o foco). */
  function renomearNaTela() {
    Array.prototype.forEach.call(document.querySelectorAll("select.mover-sel option, #sel-cartao option"), function (o) {
      var cx = cartoes().filter(function (c) { return c.id === o.value; })[0];
      if (cx) o.textContent = cx.nome;
    });
  }

  // ---------------------------------------------------------------- partes dinâmicas
  function notaDaCompra(c) {
    var ref = dados.ref, v = P.valorNaFatura(c, ref.ano, ref.mes), rest = P.parcelasRestantes(c, ref.ano, ref.mes);
    var rotulo = nomeMes(ref.mes) + "/" + ref.ano;
    if (c.inicio === "" || c.inicio === undefined) return "Informe o mês da " + (c.tipo === "recorrente" ? "primeira cobrança" : "primeira parcela") + ".";
    if (c.tipo === "recorrente") return v > 0 ? "Em " + rotulo + ": " + moeda(v) + " na fatura (todo mês)." : "Sem cobrança em " + rotulo + " (fora do período).";
    var n = c.tipo === "vista" ? 1 : Math.max(1, Math.floor(Number(c.parcelas) || 1));
    var parcela = n > 0 ? (Number(c.valor) || 0) / n : 0;
    if (v > 0) return "Em " + rotulo + ": " + moeda(v) + " na fatura" + (n > 1 ? " (parcela de " + n + ") · depois desta, restam " + rest + " parcela" + (rest === 1 ? "" : "s") + "." : ".");
    return rest > 0 ? "Começa depois de " + rotulo + " (" + n + "x de cerca de " + moeda(parcela) + ")." : "Sem parcela em " + rotulo + ": já encerrada.";
  }

  function desenharFaixa(f) {
    var caixa = limpar("faixa"), total = f.total_todos;
    cartoes().forEach(function (cx) {
      var v = f.porCartao[cx.id] || 0, ativo = escopo() === cx.id;
      var card = el("article", { className: "cartao-resumo" + (ativo ? " ativo" : "") });
      card.appendChild(el("span", { className: "banco", textContent: cx.banco || "Cartão" }));
      card.appendChild(el("h3", { textContent: cx.nome }));
      card.appendChild(el("strong", { textContent: moeda(v) }));
      card.appendChild(el("small", { textContent: total > 0 ? P.pctDe(v, total) + " da fatura total do mês" : "sem fatura neste mês" }));
      var b = el("button", { type: "button", className: "secundario ver-so", textContent: ativo ? "Ver todos os cartões" : "Ver só este cartão" });
      b.setAttribute("aria-pressed", ativo ? "true" : "false");
      b.addEventListener("click", function () { dados.cartao.filtro = ativo ? "todos" : cx.id; salvar(); desenhar(); });
      card.appendChild(b);
      caixa.appendChild(card);
    });
  }

  function desenharFiltro() {
    var sel = limpar("sel-cartao");
    sel.appendChild(el("option", { value: "todos", textContent: "Todos os cartões", selected: escopo() === "todos" }));
    opcoesDeCartao(escopo()).forEach(function (o) { sel.appendChild(o); });
  }

  function desenharEvolucao(inicio) {
    var caixa = limpar("evolucao"), leg = limpar("legenda-evolucao"), meses = [], i;
    for (i = 0; i < 24; i++) { var m = chaveMes(inicio + i); meses.push({ idx: inicio + i, f: P.faturaDoMes(m.ano, m.mes, escopo()) }); }
    var maximo = Math.max.apply(null, meses.map(function (x) { return x.f.total; }).concat([1]));
    meses.forEach(function (x, k) {
      var col = el("div", { className: "col-ano" + (k === 0 ? " atual" : "") });
      col.title = rotuloCurto(x.idx) + " · total " + moeda(x.f.total) + " · parcelas e à vista " + moeda(x.f.parcelado) + " · todo mês " + moeda(x.f.recorrente);
      var pilha = el("div", { className: "pilha" });
      var rec = el("span", { className: "seg-rec" }), par = el("span", { className: "seg-parc" });
      rec.style.height = (x.f.recorrente / maximo * 100) + "%";
      par.style.height = (x.f.parcelado / maximo * 100) + "%";
      pilha.append(rec, par);
      col.append(pilha, el("small", { textContent: rotuloCurto(x.idx) }));
      caixa.appendChild(col);
    });
    var a = meses[0], z = meses[meses.length - 1];
    caixa.setAttribute("aria-label", "Fatura prevista de " + nomeEscopo() + ", de " + moeda(a.f.total) + " em " + rotuloCurto(a.idx) + " a " + moeda(z.f.total) + " em " + rotuloCurto(z.idx) + ", separando compras recorrentes e parceladas.");
    texto("dica-evolucao", "Mostrando " + nomeEscopo() + " · próximos 24 meses a partir do mês analisado");
    [["rec", "Todo mês (assinaturas e fixos)"], ["parc", "Parcelas e compras à vista"]].forEach(function (it) {
      var li = el("li");
      li.appendChild(el("span", { className: "amostra " + it[0] }));
      li.appendChild(el("span", { textContent: it[1] }));
      leg.appendChild(li);
    });
    leg.appendChild(el("li", { className: "escala", textContent: "A coluna mais alta vale " + moeda(maximo) }));
  }

  /** Tabela mês a mês. `faturas(ano, mes)` devolve a fatura do mês; `defs` = [rótulo, função(fatura), classe]. */
  function tabelaMensal(idTabela, defs, faturas, vazio) {
    var ano = dados.ref.ano, tabela = limpar(idTabela), meses = [], i;
    for (i = 1; i <= 12; i++) meses.push(P.antesDoInicio(ano, i) ? null : faturas(ano, i));
    P.cabecalhoMeses(tabela, ano, desenhar);
    var corpo = el("tbody");
    if (!defs.length) {
      var linhaVazia = el("tr"); linhaVazia.appendChild(el("td", { colSpan: 14, className: "antes", textContent: vazio })); corpo.appendChild(linhaVazia);
    }
    defs.forEach(function (def) {
      var tr = el("tr", { className: def[2] }), totalAno = 0;
      tr.appendChild(el("th", { textContent: def[0], scope: "row" }));
      meses.forEach(function (f, k) {
        if (f === null) { tr.appendChild(el("td", { className: "antes", textContent: "–", title: "Antes do início do plano (" + P.rotuloInicio() + ")" })); return; }
        var v = def[1](f); totalAno += v;
        var td = el("td", { textContent: v > 0 ? moedaInteira(v) : "–", title: moeda(v) });
        if (k + 1 === dados.ref.mes) td.className = "atual";
        tr.appendChild(td);
      });
      tr.appendChild(el("td", { className: "ano", textContent: moedaInteira(totalAno), title: moeda(totalAno) }));
      corpo.appendChild(tr);
    });
    tabela.appendChild(corpo);
    P.centrarTabela(tabela);
  }

  function desenharTabelas() {
    var cats = [];
    dados.cartao.compras.filter(doEscopo).forEach(function (c) { var k = (c.categoria || "").trim() || "Sem categoria"; if (cats.indexOf(k) < 0) cats.push(k); });
    cats.sort();
    var defs = cats.map(function (k) { return [k, function (f) { return f.porCategoria[k] || 0; }, ""]; });
    if (cats.length) {
      defs.push(["Parcelas e compras à vista", function (f) { return f.parcelado; }, "sub"]);
      defs.push(["Todo mês (assinaturas e fixos)", function (f) { return f.recorrente; }, "sub"]);
      defs.push(["Total da fatura", function (f) { return f.total; }, "forte"]);
    }
    texto("t-mensal", "Fatura por categoria · " + nomeEscopo());
    tabelaMensal("tabela-cartao", defs, function (a, m) { return P.faturaDoMes(a, m, escopo()); }, "Cadastre compras para ver a fatura de cada mês.");

    var porCartao = cartoes().map(function (cx) { return [cx.nome + (cx.banco ? " · " + cx.banco : ""), function (f) { return f.porCartao[cx.id] || 0; }, ""]; });
    porCartao.push(["Total de todos os cartões", function (f) { return soma(Object.keys(f.porCartao).map(function (k) { return f.porCartao[k]; })); }, "forte"]);
    tabelaMensal("tabela-por-cartao", porCartao, function (a, m) { return P.faturaDoMes(a, m); }, "");
  }

  function atualizar() {
    var ref = dados.ref, compras = dados.cartao.compras, idx = ref.ano * 12 + ref.mes - 1, esc = escopo();
    var todos = P.faturaDoMes(ref.ano, ref.mes), f = P.faturaDoMes(ref.ano, ref.mes, esc), rotuloMes = nomeMes(ref.mes) + "/" + ref.ano;
    var totalTodos = soma(Object.keys(todos.porCartao).map(function (k) { return todos.porCartao[k]; }));
    todos.total_todos = totalTodos;

    texto("rot-fatura", "Fatura de " + rotuloMes + (esc === "todos" ? "" : " · " + cartaoPorId(esc).nome));
    texto("k-fatura", moeda(f.total));
    texto("k-fatura-det", "parcelas e à vista " + moeda(f.parcelado) + " · todo mês " + moeda(f.recorrente));

    var futuro = 0, ainda = 0;
    compras.filter(doEscopo).forEach(function (c) {
      if (c.tipo === "recorrente") return;
      var total = 0, k;
      for (k = 1; k <= 120; k++) { var m = chaveMes(idx + k); total += P.parcelaDaCompra(c, m.ano, m.mes); }
      if (total > 0) { futuro += total; ainda++; }
    });
    texto("k-futuro", moeda(futuro));
    texto("k-futuro-det", ainda + (ainda === 1 ? " compra ainda parcelada" : " compras ainda parceladas") + " depois de " + rotuloMes);

    var prox = [], k2;
    for (k2 = 0; k2 < 12; k2++) { var mm = chaveMes(idx + k2); prox.push(P.faturaDoMes(mm.ano, mm.mes, esc).total); }
    texto("k-media", moeda(soma(prox) / 12));

    var despesas = P.calcMes(ref.ano, ref.mes).brutas;
    texto("k-peso", despesas > 0 && f.total > 0 ? P.pctDe(f.total, despesas) : "–");
    texto("k-peso-det", despesas > 0 ? "despesas do orçamento em " + rotuloMes + ": " + moeda(despesas) + " (sem somar a fatura)" : "sem despesas no orçamento neste mês");

    var orc = P.calcMes(ref.ano, ref.mes), somar = dados.cartao.somar !== false;
    document.getElementById("somar").checked = somar;
    texto("integra-nota", somar
      ? "As faturas aparecem no card Despesas da página Orçamento e entram no total de gastos. Em " + rotuloMes + ", o orçamento recebe " + moeda(orc.cartao) + " dos cartões (" + (dados.reajuste.modo === "real" ? "em reais de hoje" : "em valores nominais") + "). Se mercado, combustível, farmácia etc. também estão na lista de despesas do orçamento, retire-os de um dos lados para não contar o mesmo gasto duas vezes."
      : "As faturas estão fora do orçamento: você só acompanha os cartões aqui. Marque a opção para somá-las às despesas.");
    texto("selo-compras", compras.length + (compras.length === 1 ? " compra" : " compras"));
    cartoes().forEach(function (cx) {
      var n = compras.filter(function (c) { return c.cartao === cx.id; }).length;
      texto("fat-" + cx.id, moeda(todos.porCartao[cx.id] || 0) + " em " + rotuloMes + " · " + n + (n === 1 ? " compra" : " compras"));
    });
    compras.forEach(function (c, i) {
      var nota = document.getElementById("nota-compra-" + i), bloco = document.getElementById("compra-" + i);
      if (nota) nota.textContent = notaDaCompra(c);
      if (bloco) bloco.classList.toggle("inativa", P.valorNaFatura(c, ref.ano, ref.mes) <= 0);
    });
    desenharFaixa(todos);
    desenharEvolucao(idx);
    desenharTabelas();
  }

  function desenhar() {
    P.desenharCabecalho();
    desenharFiltro();
    desenharBlocos();
    desenharImportacao();
    atualizar();
  }

  // ---------------------------------------------------------------- eventos
  function novaCompra(extra) {
    var ref = dados.ref;
    var c = { nome: "", categoria: "", valor: 0, tipo: "parcelado", parcelas: 1, inicio: textoYM(ref.ano, ref.mes), ate: "", cartao: cartoes()[0].id };
    Object.keys(extra || {}).forEach(function (k) { c[k] = extra[k]; });
    return c;
  }

  P.iniciarCabecalho(desenhar);
  document.getElementById("somar").addEventListener("change", function (e) { dados.cartao.somar = e.target.checked; salvar(); atualizar(); });
  document.getElementById("sel-cartao").addEventListener("change", function (e) { dados.cartao.filtro = e.target.value; salvar(); desenhar(); });
  document.getElementById("btn-exemplos").addEventListener("click", function () {
    var c = cartoes();
    dados.cartao.compras.push(
      novaCompra({ nome: "Geladeira (exemplo)", categoria: "Casa", valor: 2400, tipo: "parcelado", parcelas: 12, inicio: "2026-09", cartao: c[0].id }),
      novaCompra({ nome: "Mercado do mês (exemplo)", categoria: "Mercado", valor: 1600, tipo: "recorrente", inicio: "2026-10", cartao: c[1].id }),
      novaCompra({ nome: "Viagem (exemplo)", categoria: "Viagem", valor: 1800, tipo: "parcelado", parcelas: 6, inicio: "2026-12", cartao: c[2].id }),
      novaCompra({ nome: "Streaming (exemplo)", categoria: "Assinaturas", valor: 45, tipo: "recorrente", inicio: "2026-10", cartao: c[3].id })
    );
    salvar(); desenhar();
  });

  desenhar();
})();
