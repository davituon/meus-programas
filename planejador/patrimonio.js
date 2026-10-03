// Página Patrimônio: soma o que você tem hoje (investimentos, consórcio pago e bens) e subtrai as dívidas.
// A conta está em comum.js (patrimonioAtual). Investimentos e consórcio são os mesmos campos da página Aportes.
(function () {
  "use strict";

  var P = window.Plano, dados = P.estado.dados;
  var moeda = P.moeda, lerNumero = P.lerNumero, el = P.el, texto = P.texto, salvar = P.salvar, limpar = P.limpar, campoNumero = P.campoNumero;
  var TIPOS = [["imovel", "Imóvel"], ["veiculo", "Veículo"], ["outro", "Outro"]];

  function pct(parte, total) { return total > 0 ? Math.round(parte / total * 1000) / 10 : 0; }
  function pctTexto(parte, total) { return pct(parte, total).toFixed(1).replace(".", ",") + "%"; }
  function linhaLista(nome, valor, classe) {
    var li = el("li", { className: classe || "" });
    li.appendChild(el("span", { textContent: nome }));
    li.appendChild(el("b", { textContent: valor }));
    return li;
  }
  function comSinal(v) { return v < 0 ? "− " + moeda(-v) : moeda(v); }

  // ---------------------------------------------------------------- campos (criados uma vez)
  function campoValor(rotulo, valor, aoMudar) {
    var bloco = el("label", { className: "campo-reajuste" });
    bloco.appendChild(el("span", { textContent: rotulo }));
    var c = campoNumero({ moeda: true, valor: valor, prefixo: "R$", rotulo: rotulo });
    c.campo.addEventListener("input", function () { aoMudar(lerNumero(c.campo.value)); salvar(); atualizar(); });
    bloco.appendChild(c.caixa);
    return bloco;
  }

  function desenharInvestimentos() {
    var inv = limpar("campos-invest"), cotas = limpar("campos-cotas");
    inv.append(
      campoValor("Corretora XP (saldo)", dados.aportes.xp.saldo, function (v) { dados.aportes.xp.saldo = v; }),
      campoValor("Previdência privada (saldo)", dados.aportes.prev.saldo, function (v) { dados.aportes.prev.saldo = v; })
    );
    var temCota = false;
    dados.despesas.forEach(function (d) {
      if (!d.cota) return;
      temCota = true;
      cotas.appendChild(campoValor((d.nome || "Cota") + " · já pago", d.cota.pago, function (v) { d.cota.pago = v; }));
    });
    if (!temCota) cotas.appendChild(el("p", { className: "vazio", textContent: "Nenhuma cota de consórcio marcada. Marque as cotas na página Aportes e consórcios." }));
  }

  function linhaBem(item, i) {
    var linha = el("div", { className: "linha bem" });
    var nome = el("input", { type: "text", value: item.nome, maxLength: 60 });
    nome.setAttribute("aria-label", "Nome do bem " + (i + 1));
    var tipo = el("select", { className: "mini" });
    tipo.setAttribute("aria-label", "Tipo de " + (item.nome || "bem"));
    TIPOS.forEach(function (t) { tipo.appendChild(el("option", { value: t[0], textContent: t[1], selected: item.tipo === t[0] })); });
    tipo.addEventListener("change", function () { item.tipo = tipo.value; salvar(); atualizar(); });
    var valor = campoNumero({ moeda: true, valor: item.valor, prefixo: "R$", rotulo: "Valor de " + (item.nome || "bem") });
    valor.campo.addEventListener("input", function () { item.valor = lerNumero(valor.campo.value); salvar(); atualizar(); });
    var rm = el("button", { type: "button", className: "remover", textContent: "✕" });
    rm.setAttribute("aria-label", "Remover " + (item.nome || "bem"));
    rm.addEventListener("click", function () { dados.patrimonio.bens.splice(i, 1); salvar(); desenhar(); });
    // os rótulos lidos por leitores de tela acompanham o nome que a pessoa digita
    nome.addEventListener("input", function () {
      item.nome = nome.value; salvar();
      tipo.setAttribute("aria-label", "Tipo de " + (item.nome || "bem"));
      valor.campo.setAttribute("aria-label", "Valor de " + (item.nome || "bem"));
      rm.setAttribute("aria-label", "Remover " + (item.nome || "bem"));
    });
    linha.append(nome, tipo, valor.caixa, rm);
    return linha;
  }

  function linhaDivida(item, i) {
    var linha = el("div", { className: "linha" });
    var nome = el("input", { type: "text", value: item.nome, maxLength: 60 });
    nome.setAttribute("aria-label", "Nome da dívida " + (i + 1));
    var valor = campoNumero({ moeda: true, valor: item.valor, prefixo: "R$", rotulo: "Saldo devedor de " + (item.nome || "dívida") });
    valor.campo.addEventListener("input", function () { item.valor = lerNumero(valor.campo.value); salvar(); atualizar(); });
    var rm = el("button", { type: "button", className: "remover", textContent: "✕" });
    rm.setAttribute("aria-label", "Remover " + (item.nome || "dívida"));
    rm.addEventListener("click", function () { dados.patrimonio.dividas.splice(i, 1); salvar(); desenhar(); });
    nome.addEventListener("input", function () {
      item.nome = nome.value; salvar();
      valor.campo.setAttribute("aria-label", "Saldo devedor de " + (item.nome || "dívida"));
      rm.setAttribute("aria-label", "Remover " + (item.nome || "dívida"));
    });
    linha.append(nome, valor.caixa, rm);
    return linha;
  }

  function desenharListas() {
    var cb = document.querySelector('[data-lista="bens"]'), cd = document.querySelector('[data-lista="dividas"]');
    cb.textContent = ""; cd.textContent = "";
    if (!dados.patrimonio.bens.length) cb.appendChild(el("p", { className: "vazio", textContent: "Nenhum bem cadastrado." }));
    dados.patrimonio.bens.forEach(function (b, i) { cb.appendChild(linhaBem(b, i)); });
    if (!dados.patrimonio.dividas.length) cd.appendChild(el("p", { className: "vazio", textContent: "Nenhuma dívida cadastrada." }));
    dados.patrimonio.dividas.forEach(function (x, i) { cd.appendChild(linhaDivida(x, i)); });
  }

  // ---------------------------------------------------------------- partes dinâmicas
  function atualizar() {
    var p = P.patrimonioAtual(), c = dados.carteira;
    texto("k-liquido", comSinal(p.liquido));
    texto("k-liquido-det", "bens e direitos " + moeda(p.ativos) + " − dívidas " + moeda(p.dividas));
    texto("k-financeiro", moeda(p.financeiro));
    texto("k-financeiro-det", pctTexto(p.financeiro, p.ativos) + " dos bens e direitos · XP + previdência");
    texto("k-bens", moeda(p.bens + p.consorcio));
    texto("k-bens-det", "bens " + moeda(p.bens) + " · consórcios pagos " + moeda(p.consorcio));
    texto("k-dividas", moeda(p.dividas));
    texto("k-dividas-det", p.dividas > 0 ? pctTexto(p.dividas, p.ativos) + " dos bens e direitos" : "nenhuma dívida cadastrada");
    texto("selo-bens", moeda(p.bens));
    texto("selo-dividas", "− " + moeda(p.dividas));

    // divisão numerada (cor + número + legenda com valor e %)
    var itens = [
      ["Corretora XP", p.xp], ["Previdência privada", p.prev], ["Consórcios (já pago)", p.consorcio],
      ["Imóveis", p.porTipo.imovel], ["Veículos", p.porTipo.veiculo], ["Outros bens", p.porTipo.outro]
    ].filter(function (x) { return x[1] > 0; }).sort(function (a, b) { return b[1] - a[1]; });
    var barra = limpar("barra-patrimonio"), leg = limpar("legenda-patrimonio");
    itens.forEach(function (x, i) {
      var parte = p.ativos > 0 ? x[1] / p.ativos : 0, k = "k" + ((i % 7) + 1);
      var seg = el("span", { className: "seg-classe " + k });
      seg.style.width = (parte * 100) + "%";
      seg.title = x[0] + ": " + moeda(x[1]) + " (" + pctTexto(x[1], p.ativos) + ")";
      if (parte > 0.035) seg.textContent = String(i + 1);
      barra.appendChild(seg);
      var li = el("li");
      li.appendChild(el("span", { className: "num-classe " + k, textContent: String(i + 1) }));
      li.appendChild(el("span", { textContent: x[0] }));
      li.appendChild(el("b", { textContent: moeda(x[1]) }));
      li.appendChild(el("i", { textContent: pctTexto(x[1], p.ativos) }));
      leg.appendChild(li);
    });
    if (!itens.length) leg.appendChild(el("li", { textContent: "Preencha os valores abaixo para ver a divisão." }));
    barra.setAttribute("aria-label", itens.length ? "Divisão dos bens e direitos: " + itens.map(function (x) { return x[0] + " " + pctTexto(x[1], p.ativos); }).join("; ") + "." : "Sem valores informados.");
    texto("nota-composicao", p.ativos > 0 && p.financeiro / p.ativos < 0.5
      ? "Mais da metade do seu patrimônio está em bens e consórcios, que não geram renda para a aposentadoria: só " + pctTexto(p.financeiro, p.ativos) + " são investimentos financeiros."
      : "As dívidas, se houver, são descontadas do total e não aparecem na barra.");

    // carteira importada: avisa se o saldo da XP está diferente
    var nota = "";
    if (c && c.patrimonio !== null && c.patrimonio !== undefined) {
      var dif = Math.abs((Number(c.patrimonio) || 0) - p.xp);
      nota = dif < 0.01
        ? "O saldo da corretora XP é o mesmo da carteira importada em " + (c.geradoEm || "data desconhecida") + "."
        : "A carteira importada em " + (c.geradoEm || "data desconhecida") + " mostra " + moeda(c.patrimonio) + " na XP, valor diferente do saldo acima. Na página Carteira, o botão \"Usar … como saldo da corretora XP\" atualiza o saldo.";
    } else nota = "Importe a posição da XP na página Carteira para atualizar o saldo da corretora com um clique.";
    texto("nota-carteira", nota);

    var conta = limpar("conta");
    conta.append(
      linhaLista("Corretora XP", moeda(p.xp)),
      linhaLista("Previdência privada", moeda(p.prev)),
      linhaLista("Consórcios: valor já pago", moeda(p.consorcio)),
      linhaLista("Imóveis", moeda(p.porTipo.imovel)),
      linhaLista("Veículos", moeda(p.porTipo.veiculo)),
      linhaLista("Outros bens", moeda(p.porTipo.outro)),
      linhaLista("Total de bens e direitos", moeda(p.ativos), "total"),
      linhaLista("(−) Dívidas", p.dividas > 0 ? "− " + moeda(p.dividas) : moeda(0)),
      linhaLista("Patrimônio líquido", comSinal(p.liquido), "total")
    );
  }

  function desenhar() {
    P.desenharCabecalho();
    desenharInvestimentos();
    desenharListas();
    atualizar();
  }

  P.iniciarCabecalho(desenhar);
  document.getElementById("add-bem").addEventListener("click", function () {
    dados.patrimonio.bens.push({ nome: "", tipo: "outro", valor: 0 });
    salvar(); desenhar();
    var campos = document.querySelectorAll('[data-lista="bens"] .linha > input[type="text"]');
    if (campos.length) campos[campos.length - 1].focus();
  });
  document.getElementById("add-divida").addEventListener("click", function () {
    dados.patrimonio.dividas.push({ nome: "", valor: 0 });
    salvar(); desenhar();
    var campos = document.querySelectorAll('[data-lista="dividas"] .linha > input[type="text"]');
    if (campos.length) campos[campos.length - 1].focus();
  });
  desenhar();
})();
