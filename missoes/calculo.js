// Fundo de Missões: regras do dinheiro, sem tela. Fica em window.Missoes. Tudo em reais; datas em aaaa-mm-dd.
//
// Caminho do dinheiro: cada VENDA é dividida na hora. Uma parte vai para as reservas (dízimo, oferta, poupança, investimento, meu:
// percentuais sobre o valor da venda, cada reserva num porquinho/separação própria). O que sobra fica na CONTA e serve para
// doar às missões e comprar suprimentos para revender. Reservas têm retiradas (dízimo entregue, saque do "meu"...).
// Reservas pessoais (poupança, investimento, meu) ficam no fundo, mas marcadas como "seu dinheiro": não entram na prestação de contas.
// Capital de giro: quanto manter na conta para repor os suprimentos; só o que passar disso é "disponível para doar".
// Custo (opcional) de cada venda: serve para calcular a margem. Cada doce tem um custo diferente, então ele é informado por venda.
// A divisão de cada venda é gravada no momento do registro: mudar um percentual depois vale só para as próximas vendas.
// Saldos que já existiam (ou rendimentos) entram como "ajustes" datados. O rendimento dos porquinhos é uma ESTIMATIVA: CDI anual
// informado por você, capitalizado só em dias úteis (seg-sex, sem feriados, base 252), bruto de IR/IOF.
(function () {
  "use strict";

  var num = function (v) { return Number(v) || 0; };
  var arred = function (v) { return Math.round(v * 100) / 100; };
  var seq = 0;
  var PADRAO = [["dizimo", "Dízimo", 10], ["oferta", "Oferta", 3], ["poupanca", "Poupança", 3], ["investimento", "Investimento", 3], ["meu", "Meu", 1]];

  function novoId() { seq++; return "i" + Date.now().toString(36) + seq; }

  function dataValida(iso) {
    if (typeof iso !== "string" || !/^\d{4}-\d{2}-\d{2}$/.test(iso)) return false;
    var p = iso.split("-").map(Number), d = new Date(p[0], p[1] - 1, p[2]);
    return d.getFullYear() === p[0] && d.getMonth() === p[1] - 1 && d.getDate() === p[2];
  }
  function hoje() {
    var d = new Date();
    return d.getFullYear() + "-" + ("0" + (d.getMonth() + 1)).slice(-2) + "-" + ("0" + d.getDate()).slice(-2);
  }

  function lerNumeroBr(texto) {
    var s = String(texto === undefined || texto === null ? "" : texto).trim().replace(/[^\d.,]/g, "");
    if (!s) return null;
    if (s.indexOf(",") >= 0) s = s.replace(/\./g, "").replace(",", ".");
    else if (!/^\d+\.\d{1,2}$/.test(s)) s = s.replace(/\./g, "");
    var n = parseFloat(s);
    return isFinite(n) ? n : null;
  }
  /** Valor em reais digitado em formato brasileiro ("1.234,56", "50", "12,5"). Devolve número > 0 ou null. */
  function lerValor(texto) { var n = lerNumeroBr(texto); return n !== null && arred(n) > 0 ? arred(n) : null; }
  /** Percentual de 0 a 100 (aceita zero). Devolve número ou null. */
  function lerPct(texto) { var n = /-/.test(String(texto)) ? null : lerNumeroBr(texto); return n !== null && n >= 0 && n <= 100 ? Math.round(n * 100) / 100 : null; }

  var PESSOAIS = { poupanca: true, investimento: true, meu: true };
  function reservasPadrao() { return PADRAO.map(function (p) { return { id: p[0], nome: p[1], pct: p[2], pessoal: !!PESSOAIS[p[0]] }; }); }
  function rendimentoPadrao() {
    return { cdi: null, pctCdi: 100, rende: { dizimo: false, oferta: true, poupanca: true, investimento: true, meu: true, conta: false } };
  }
  function vazio() {
    return { versao: 4, reservas: reservasPadrao(), giro: 0, entradas: [], retiradas: [], suprimentos: [], missoes: [], envios: [], ajustes: [], conferencias: {}, rendimento: rendimentoPadrao() };
  }

  /** Completa e limpa dados do armazenamento ou de um backup (inclusive da versão 1). Itens inválidos são descartados. */
  function normalizar(bruto) {
    var d = vazio();
    if (!bruto || typeof bruto !== "object" || Array.isArray(bruto)) return d;
    var lista = function (x) { return Array.isArray(x) ? x.filter(function (i) { return i && typeof i === "object" && !Array.isArray(i); }) : []; };

    var res = lista(bruto.reservas).map(function (r) { return { id: String(r.id || ""), nome: String(r.nome || "").slice(0, 40), pct: lerPct(r.pct), pessoal: typeof r.pessoal === "boolean" ? r.pessoal : !!PESSOAIS[String(r.id || "")] }; })
      .filter(function (r) { return r.id && r.nome && r.pct !== null; });
    if (res.length && res.reduce(function (t, r) { return t + r.pct; }, 0) <= 100) d.reservas = res;
    var resIds = {}; d.reservas.forEach(function (r) { resIds[r.id] = true; });

    d.giro = isFinite(Number(bruto.giro)) && Number(bruto.giro) > 0 ? arred(Number(bruto.giro)) : 0;
    d.missoes = lista(bruto.missoes).map(function (m) { return { id: String(m.id || novoId()), nome: String(m.nome || "").slice(0, 60), meta: Math.max(0, num(m.meta)) }; }).filter(function (m) { return m.nome; });
    var misIds = {}; d.missoes.forEach(function (m) { misIds[m.id] = true; });

    d.entradas = lista(bruto.entradas).filter(function (e) { return dataValida(e.data) && num(e.valor) > 0; }).map(function (e) {
      var partes = {};
      if (e.partes && typeof e.partes === "object" && !Array.isArray(e.partes)) Object.keys(e.partes).forEach(function (k) { if (resIds[k] && num(e.partes[k]) > 0) partes[k] = arred(num(e.partes[k])); });
      var soma = Object.keys(partes).reduce(function (t, k) { return t + partes[k]; }, 0);
      if (soma > num(e.valor) + 0.001) partes = {};
      var venda = { id: String(e.id || novoId()), data: e.data, origem: String(e.origem || "").slice(0, 60), valor: arred(num(e.valor)), partes: partes };
      if (e.custo !== undefined && e.custo !== null && e.custo !== "" && isFinite(Number(e.custo)) && Number(e.custo) >= 0) venda.custo = arred(Number(e.custo));
      return venda;
    });
    d.retiradas = lista(bruto.retiradas).filter(function (e) { return dataValida(e.data) && num(e.valor) > 0 && resIds[e.reservaId]; })
      .map(function (e) { return { id: String(e.id || novoId()), data: e.data, reservaId: e.reservaId, valor: arred(num(e.valor)), nota: String(e.nota || "").slice(0, 60) }; });
    d.suprimentos = lista(bruto.suprimentos).filter(function (e) { return dataValida(e.data) && num(e.valor) > 0; })
      .map(function (e) { return { id: String(e.id || novoId()), data: e.data, descricao: String(e.descricao || "").slice(0, 60), valor: arred(num(e.valor)) }; });
    d.envios = lista(bruto.envios).filter(function (e) { return dataValida(e.data) && num(e.valor) > 0 && misIds[e.missaoId]; })
      .map(function (e) { return { id: String(e.id || novoId()), data: e.data, missaoId: e.missaoId, valor: arred(num(e.valor)) }; });

    d.ajustes = lista(bruto.ajustes).filter(function (e) { return dataValida(e.data) && num(e.valor) > 0 && (e.chave === "conta" || resIds[e.chave]) && (e.tipo === "inicial" || e.tipo === "rendimento"); })
      .map(function (e) { return { id: String(e.id || novoId()), data: e.data, chave: e.chave, tipo: e.tipo, valor: arred(num(e.valor)), nota: String(e.nota || "").slice(0, 60) }; });

    var rb = bruto.rendimento && typeof bruto.rendimento === "object" && !Array.isArray(bruto.rendimento) ? bruto.rendimento : {};
    var cdi = rb.cdi === null || rb.cdi === undefined || rb.cdi === "" ? null : Number(rb.cdi), pc = rb.pctCdi === undefined ? 100 : Number(rb.pctCdi);
    d.rendimento.cdi = cdi !== null && isFinite(cdi) && cdi > 0 && cdi <= 100 ? cdi : null;
    d.rendimento.pctCdi = isFinite(pc) && pc > 0 && pc <= 300 ? pc : 100;
    d.reservas.forEach(function (x) { if (!(x.id in d.rendimento.rende)) d.rendimento.rende[x.id] = false; });
    if (rb.rende && typeof rb.rende === "object") Object.keys(rb.rende).forEach(function (k) { if (k === "conta" || resIds[k]) d.rendimento.rende[k] = rb.rende[k] === true; });

    var conf = {};
    var confBruto = bruto.conferencias && typeof bruto.conferencias === "object" && !Array.isArray(bruto.conferencias) ? bruto.conferencias : {};
    if (bruto.porquinho && bruto.porquinho.saldo !== null && bruto.porquinho.saldo !== undefined && !confBruto.conta) confBruto.conta = bruto.porquinho; // versão 1: o "porquinho" único era o saldo livre
    Object.keys(confBruto).forEach(function (k) {
      var c = confBruto[k];
      if ((k === "conta" || resIds[k]) && c && typeof c === "object" && c.saldo !== null && c.saldo !== undefined && c.saldo !== "" && isFinite(Number(c.saldo)) && dataValida(c.data)) conf[k] = { saldo: arred(Number(c.saldo)), data: c.data };
    });
    d.conferencias = conf;
    return d;
  }

  function somar(lista) { return arred(lista.reduce(function (t, x) { return t + x.valor; }, 0)); }
  function parteDe(e, id) { return e.partes && e.partes[id] ? e.partes[id] : 0; }

  /** Divide uma venda pelas reservas atuais. A parte da conta é o que sobra, então os centavos sempre fecham. */
  function dividir(d, valor) {
    var partes = {}, total = 0;
    d.reservas.forEach(function (r) { var p = arred(valor * r.pct / 100); if (p > 0) { partes[r.id] = p; total += p; } });
    return { partes: partes, conta: arred(valor - total) };
  }

  /** Números da tela. `hojeIso` define o "mês atual". */
  function resumo(d, hojeIso) {
    hojeIso = hojeIso || hoje();
    var mes = hojeIso.slice(0, 7), doMes = function (l) { return l.filter(function (x) { return x.data.slice(0, 7) === mes; }); };
    var vendido = somar(d.entradas), enviado = somar(d.envios), suprimentos = somar(d.suprimentos);
    var reservas = d.reservas.map(function (r) {
      var acumulado = arred(d.entradas.reduce(function (t, e) { return t + parteDe(e, r.id); }, 0)), retirado = somar(d.retiradas.filter(function (x) { return x.reservaId === r.id; }));
      var ajustado = somar(d.ajustes.filter(function (x) { return x.chave === r.id; }));
      return { id: r.id, nome: r.nome, pct: r.pct, pessoal: !!r.pessoal, acumulado: acumulado, ajustado: ajustado, retirado: retirado, saldo: arred(acumulado + ajustado - retirado) };
    });
    var separado = arred(reservas.reduce(function (t, r) { return t + r.acumulado; }, 0));
    var ajustadoConta = somar(d.ajustes.filter(function (x) { return x.chave === "conta"; })), livre = arred(vendido - separado - enviado - suprimentos + ajustadoConta);
    var giro = Math.max(0, num(d.giro)), disponivel = Math.max(0, arred(livre - giro));
    var comCusto = d.entradas.filter(function (e) { return typeof e.custo === "number"; });
    var recCusto = somar(comCusto), custoTotal = arred(comCusto.reduce(function (t, e) { return t + e.custo; }, 0)), pctReservasTotal = d.reservas.reduce(function (t, r) { return t + r.pct; }, 0);
    var margem = {
      qtd: comCusto.length, semCusto: d.entradas.length - comCusto.length, receita: recCusto, custo: custoTotal, lucro: arred(recCusto - custoTotal),
      pct: recCusto > 0 ? (recCusto - custoTotal) / recCusto : null, pctReservas: pctReservasTotal / 100,
      sobraPct: recCusto > 0 ? (recCusto - custoTotal) / recCusto - pctReservasTotal / 100 : null
    };
    var porMes = {}, linhaMes = function (k) { return (porMes[k] = porMes[k] || { mes: k, vendido: 0, enviado: 0, suprimentos: 0, qtd: 0 }); };
    d.entradas.forEach(function (e) { var l = linhaMes(e.data.slice(0, 7)); l.vendido = arred(l.vendido + e.valor); l.qtd++; });
    d.envios.forEach(function (e) { var l = linhaMes(e.data.slice(0, 7)); l.enviado = arred(l.enviado + e.valor); });
    d.suprimentos.forEach(function (e) { var l = linhaMes(e.data.slice(0, 7)); l.suprimentos = arred(l.suprimentos + e.valor); });
    var missoes = d.missoes.map(function (m) {
      var env = somar(d.envios.filter(function (e) { return e.missaoId === m.id; }));
      return { id: m.id, nome: m.nome, meta: m.meta, enviado: env, falta: m.meta > 0 ? Math.max(0, arred(m.meta - env)) : null, pct: m.meta > 0 ? Math.min(1, env / m.meta) : null };
    });
    var calculado = { conta: livre }; reservas.forEach(function (r) { calculado[r.id] = r.saldo; });
    var conferencias = {};
    Object.keys(d.conferencias).forEach(function (k) {
      if (calculado[k] === undefined) return;
      var c = d.conferencias[k];
      conferencias[k] = { informado: c.saldo, data: c.data, calculado: calculado[k], diferenca: arred(c.saldo - calculado[k]) };
    });
    return {
      vendido: vendido, vendidoMes: somar(doMes(d.entradas)), qtdEntradas: d.entradas.length, reservas: reservas, separado: separado,
      separadoSaldo: arred(reservas.reduce(function (t, r) { return t + r.saldo; }, 0)),
      saldoPessoal: arred(reservas.filter(function (r) { return r.pessoal; }).reduce(function (t, r) { return t + r.saldo; }, 0)),
      saldoMissao: arred(reservas.filter(function (r) { return !r.pessoal; }).reduce(function (t, r) { return t + r.saldo; }, 0)),
      giro: giro, disponivel: disponivel, margem: margem,
      pctReservas: arred(d.reservas.reduce(function (t, r) { return t + r.pct; }, 0)),
      livre: livre, ajustadoConta: ajustadoConta, enviado: enviado, enviadoMes: somar(doMes(d.envios)), suprimentos: suprimentos, suprimentosMes: somar(doMes(d.suprimentos)),
      porMes: Object.keys(porMes).sort().reverse().map(function (k) { return porMes[k]; }), missoes: missoes,
      metaTotal: arred(d.missoes.reduce(function (t, m) { return t + m.meta; }, 0)), conferencias: conferencias
    };
  }

  /** Algum saldo (conta ou reserva) ficaria negativo? Usado antes de remover uma venda. */
  function negativo(d) { var r = resumo(d); return r.livre < -0.001 || r.reservas.some(function (x) { return x.saldo < -0.001; }); }

  // ---- operações: devolvem null se deu certo ou o texto do erro
  function adicionarEntrada(d, x) {
    var valor = lerValor(x.valor);
    if (valor === null) return "Informe um valor maior que zero.";
    if (!dataValida(x.data)) return "Informe uma data válida.";
    var custo = null;
    if (x.custo !== undefined && x.custo !== null && String(x.custo).trim() !== "") {
      var c = lerNumeroBr(x.custo);
      if (c === null || /-/.test(String(x.custo)) || c < 0) return "O custo deve ser um valor (zero ou mais) ou ficar em branco.";
      custo = arred(c);
    }
    var venda = { id: novoId(), data: x.data, origem: String(x.origem || "").trim().slice(0, 60), valor: valor, partes: dividir(d, valor).partes };
    if (custo !== null) venda.custo = custo;
    d.entradas.push(venda);
    return null;
  }

  /** Quanto manter na conta para repor os suprimentos (capital de giro). Vazio vale zero. */
  function definirGiro(d, texto) {
    if (String(texto === undefined || texto === null ? "" : texto).trim() === "") { d.giro = 0; return null; }
    var n = lerNumeroBr(texto);
    if (n === null || /-/.test(String(texto)) || n < 0) return "Informe o capital de giro em reais (zero ou mais).";
    d.giro = arred(n);
    return null;
  }
  function adicionarSuprimento(d, x) {
    var valor = lerValor(x.valor);
    if (valor === null) return "Informe um valor maior que zero.";
    if (!dataValida(x.data)) return "Informe uma data válida.";
    if (valor > resumo(d).livre + 0.001) return "A compra é maior que o saldo livre da conta.";
    d.suprimentos.push({ id: novoId(), data: x.data, descricao: String(x.descricao || "").trim().slice(0, 60), valor: valor });
    return null;
  }
  function adicionarRetirada(d, x) {
    var valor = lerValor(x.valor), r = resumo(d).reservas.filter(function (i) { return i.id === x.reservaId; })[0];
    if (!r) return "Escolha a reserva.";
    if (valor === null) return "Informe um valor maior que zero.";
    if (!dataValida(x.data)) return "Informe uma data válida.";
    if (valor > r.saldo + 0.001) return "A retirada é maior que o saldo de " + r.nome + ".";
    d.retiradas.push({ id: novoId(), data: x.data, reservaId: x.reservaId, valor: valor, nota: String(x.nota || "").trim().slice(0, 60) });
    return null;
  }
  function adicionarMissao(d, x) {
    var nome = String(x.nome || "").trim().slice(0, 60);
    if (!nome) return "Dê um nome à missão.";
    if (d.missoes.some(function (m) { return m.nome.toLowerCase() === nome.toLowerCase(); })) return "Já existe uma missão com esse nome.";
    var meta = x.meta === "" || x.meta === undefined || x.meta === null ? 0 : lerValor(x.meta);
    if (meta === null) return "A meta deve ser um valor maior que zero (ou deixe em branco).";
    d.missoes.push({ id: novoId(), nome: nome, meta: meta });
    return null;
  }
  function adicionarEnvio(d, x) {
    var valor = lerValor(x.valor);
    if (valor === null) return "Informe um valor maior que zero.";
    if (!dataValida(x.data)) return "Informe uma data válida.";
    if (!d.missoes.some(function (m) { return m.id === x.missaoId; })) return "Escolha a missão.";
    var atual = resumo(d);
    if (valor > atual.livre + 0.001) return "A doação é maior que o saldo livre da conta.";
    if (!x.mesmoAssim && atual.giro > 0 && valor > atual.disponivel + 0.001) return "Esta doação deixaria a conta abaixo do capital de giro (R$ " + atual.giro.toFixed(2).replace(".", ",") + "). Marque \"Doar mesmo assim\" para continuar.";
    d.envios.push({ id: novoId(), data: x.data, missaoId: x.missaoId, valor: valor });
    return null;
  }
  /** Muda o percentual de uma reserva para as próximas vendas (as já registradas não mudam). A soma não pode passar de 100%. */
  function definirPercentual(d, id, texto) {
    var r = d.reservas.filter(function (i) { return i.id === id; })[0], p = lerPct(texto);
    if (!r) return "Reserva não encontrada.";
    if (p === null) return "Informe um percentual entre 0 e 100.";
    var soma = d.reservas.reduce(function (t, i) { return t + (i.id === id ? p : i.pct); }, 0);
    if (soma > 100 + 1e-9) return "A soma dos percentuais não pode passar de 100%.";
    r.pct = p;
    return null;
  }
  function remover(lista, id, rotulo) { var i = lista.findIndex(function (e) { return e.id === id; }); if (i < 0) return rotulo + " não encontrado."; lista.splice(i, 1); return null; }
  function removerEntrada(d, id) {
    var i = d.entradas.findIndex(function (e) { return e.id === id; });
    if (i < 0) return "Venda não encontrada.";
    var tirada = d.entradas.splice(i, 1)[0], ruim = negativo(d);
    if (ruim) { d.entradas.splice(i, 0, tirada); return "Não dá para remover: algum saldo ficaria negativo, pois o dinheiro dessa venda já foi usado."; }
    return null;
  }
  function removerEnvio(d, id) { return remover(d.envios, id, "Doação"); }
  function removerSuprimento(d, id) { return remover(d.suprimentos, id, "Compra"); }
  function removerRetirada(d, id) { return remover(d.retiradas, id, "Retirada"); }
  function removerMissao(d, id) {
    if (d.envios.some(function (e) { return e.missaoId === id; })) return "Há doações para esta missão. Remova-as antes.";
    return remover(d.missoes, id, "Missão");
  }
  /** Saldo que já existia (tipo "inicial") ou rendimento recebido (tipo "rendimento") numa reserva ou na "conta". */
  function adicionarAjuste(d, x) {
    var valor = lerValor(x.valor);
    if (x.chave !== "conta" && !d.reservas.some(function (r) { return r.id === x.chave; })) return "Escolha a reserva ou a conta.";
    if (x.tipo !== "inicial" && x.tipo !== "rendimento") return "Escolha o tipo do lançamento.";
    if (valor === null) return "Informe um valor maior que zero.";
    if (!dataValida(x.data)) return "Informe uma data válida.";
    d.ajustes.push({ id: novoId(), data: x.data, chave: x.chave, tipo: x.tipo, valor: valor, nota: String(x.nota || "").trim().slice(0, 60) });
    return null;
  }
  function removerAjuste(d, id) {
    var i = d.ajustes.findIndex(function (e) { return e.id === id; });
    if (i < 0) return "Lançamento não encontrado.";
    var tirado = d.ajustes.splice(i, 1)[0];
    if (negativo(d)) { d.ajustes.splice(i, 0, tirado); return "Não dá para remover: algum saldo ficaria negativo, pois esse dinheiro já foi usado."; }
    return null;
  }

  // ---- rendimento estimado (CDI)
  /** Define o CDI anual (%) e a porcentagem do CDI que o porquinho rende (100 = 100% do CDI). CDI vazio apaga. */
  function definirCdi(d, cdiTexto, pctTexto) {
    var semCdi = String(cdiTexto).trim() === "", cdi = semCdi ? null : lerNumeroBr(cdiTexto), semPct = String(pctTexto).trim() === "", pc = semPct ? 100 : lerNumeroBr(pctTexto);
    if (!semCdi && (cdi === null || /-/.test(String(cdiTexto)) || cdi <= 0 || cdi > 100)) return "Informe o CDI anual em % (por exemplo 14,65).";
    if (pc === null || /-/.test(String(pctTexto)) || pc <= 0 || pc > 300) return "Informe a porcentagem do CDI (por exemplo 100).";
    d.rendimento.cdi = cdi; d.rendimento.pctCdi = pc;
    return null;
  }
  function marcarRende(d, chave, sim) {
    if (chave !== "conta" && !d.reservas.some(function (r) { return r.id === chave; })) return "Reserva não encontrada.";
    d.rendimento.rende[chave] = !!sim;
    return null;
  }

  function dia(iso) { var p = iso.split("-").map(Number); return Date.UTC(p[0], p[1] - 1, p[2]); }
  function isoDe(ms) { var x = new Date(ms); return x.getUTCFullYear() + "-" + ("0" + (x.getUTCMonth() + 1)).slice(-2) + "-" + ("0" + x.getUTCDate()).slice(-2); }

  /** Movimentos de dinheiro de verdade (sem os rendimentos já lançados) de uma reserva ou da conta: [{ data, valor }], entrada positiva. */
  function movimentos(d, chave) {
    var m = [];
    if (chave === "conta") {
      d.entradas.forEach(function (e) { m.push({ data: e.data, valor: e.valor - Object.keys(e.partes).reduce(function (t, k) { return t + e.partes[k]; }, 0) }); });
      d.suprimentos.forEach(function (e) { m.push({ data: e.data, valor: -e.valor }); });
      d.envios.forEach(function (e) { m.push({ data: e.data, valor: -e.valor }); });
    } else {
      d.entradas.forEach(function (e) { if (e.partes[chave]) m.push({ data: e.data, valor: e.partes[chave] }); });
      d.retiradas.forEach(function (e) { if (e.reservaId === chave) m.push({ data: e.data, valor: -e.valor }); });
    }
    d.ajustes.forEach(function (e) { if (e.chave === chave && e.tipo === "inicial") m.push({ data: e.data, valor: e.valor }); });
    return m;
  }

  /** Saldo no fim de `ate`, aplicando a taxa diária (r) só em dias úteis. O dinheiro que entra num dia só rende a partir do dia útil seguinte. */
  function simular(movs, ate, r) {
    if (!movs.length) return 0;
    var ordem = movs.slice().sort(function (a, b) { return a.data < b.data ? -1 : a.data > b.data ? 1 : 0; }), i = 0, saldo = 0, t = dia(ordem[0].data), fim = dia(ate);
    while (t <= fim) {
      var dow = new Date(t).getUTCDay();
      if (dow !== 0 && dow !== 6) saldo += saldo * r;
      var hojeIso = isoDe(t);
      while (i < ordem.length && ordem[i].data <= hojeIso) { saldo += ordem[i].valor; i++; }
      t += 86400000;
    }
    return saldo;
  }

  /**
   * Rendimento estimado desde o primeiro movimento de cada porquinho marcado até a data `ate` (padrão: hoje).
   * "aLancar" = estimado - rendimentos já lançados. Devolve { erro } se faltar o CDI.
   */
  function rendimento(d, ate) {
    ate = ate || hoje();
    var cfg = d.rendimento;
    if (cfg.cdi === null) return { erro: "Informe o CDI anual para calcular." };
    if (!dataValida(ate)) return { erro: "Informe uma data válida." };
    var diaria = (Math.pow(1 + cfg.cdi / 100, 1 / 252) - 1) * cfg.pctCdi / 100, sum = resumo(d, ate), nomes = { conta: "Conta (saldo livre)" };
    d.reservas.forEach(function (x) { nomes[x.id] = x.nome; });
    var saldos = { conta: sum.livre }; sum.reservas.forEach(function (x) { saldos[x.id] = x.saldo; });
    var itens = [], total = 0;
    ["conta"].concat(d.reservas.map(function (x) { return x.id; })).forEach(function (k) {
      if (!cfg.rende[k]) return;
      var movs = movimentos(d, k), estimado = arred(simular(movs, ate, diaria) - simular(movs, ate, 0));
      var lancado = somar(d.ajustes.filter(function (x) { return x.chave === k && x.tipo === "rendimento"; })), aLancar = Math.max(0, arred(estimado - lancado));
      itens.push({ chave: k, nome: nomes[k], saldo: saldos[k], estimado: estimado, lancado: lancado, aLancar: aLancar, saldoEstimado: arred(saldos[k] + aLancar) });
      total += aLancar;
    });
    return { ate: ate, cdiAnual: cfg.cdi, pctCdi: cfg.pctCdi, efetivoAnual: arred((Math.pow(1 + diaria, 252) - 1) * 100), taxaDiaria: diaria, itens: itens, total: arred(total) };
  }

  /** Lança como "rendimento" (na data `ate`) tudo o que a estimativa mostra a lançar. Devolve { lancados } ou { erro }. */
  function lancarRendimentos(d, ate) {
    var rend = rendimento(d, ate);
    if (rend.erro) return rend;
    var n = 0;
    rend.itens.forEach(function (i) { if (i.aLancar >= 0.01) { d.ajustes.push({ id: novoId(), data: rend.ate, chave: i.chave, tipo: "rendimento", valor: i.aLancar, nota: "Estimativa CDI" }); n++; } });
    return { lancados: n };
  }

  // ---- prestação de contas
  var MESES_LONGOS = ["janeiro", "fevereiro", "março", "abril", "maio", "junho", "julho", "agosto", "setembro", "outubro", "novembro", "dezembro"];
  function mesPorExtenso(mes) { var p = mes.split("-"); return MESES_LONGOS[Number(p[1]) - 1] + " de " + p[0]; }

  /**
   * Resumo de um mês ("aaaa-mm") para mostrar a quem contribui: quanto entrou, quanto foi doado a cada missão, o que foi
   * comprado de suprimentos e como ficaram as reservas e o saldo livre no fim do mês. Não traz nomes de clientes.
   */
  function prestacao(d, mes) {
    var fim = mes + "-31", ate = function (l) { return l.filter(function (x) { return x.data <= fim; }); }, doMes = function (l) { return l.filter(function (x) { return x.data.slice(0, 7) === mes; }); };
    var ateFim = { reservas: d.reservas, missoes: d.missoes, entradas: ate(d.entradas), retiradas: ate(d.retiradas), suprimentos: ate(d.suprimentos), envios: ate(d.envios), ajustes: ate(d.ajustes), conferencias: {}, rendimento: d.rendimento };
    var fimRes = resumo(ateFim, fim), vendasMes = doMes(d.entradas), enviosMes = doMes(d.envios), supMes = doMes(d.suprimentos), retMes = doMes(d.retiradas);
    var doacoes = d.missoes.map(function (m) {
      var valor = somar(enviosMes.filter(function (e) { return e.missaoId === m.id; })), t = fimRes.missoes.filter(function (x) { return x.id === m.id; })[0];
      return { nome: m.nome, valor: valor, meta: m.meta, acumulado: t.enviado, pct: t.pct };
    }).filter(function (x) { return x.valor > 0; });
    var reservas = d.reservas.filter(function (x) { return !x.pessoal; }).map(function (x) {
      return { nome: x.nome, pct: x.pct, separado: arred(vendasMes.reduce(function (t, e) { return t + parteDe(e, x.id); }, 0)), retirado: somar(retMes.filter(function (e) { return e.reservaId === x.id; })), saldoFinal: fimRes.reservas.filter(function (y) { return y.id === x.id; })[0].saldo };
    });
    var rendimentos = somar(doMes(d.ajustes).filter(function (a) { return a.tipo === "rendimento"; }));
    return {
      mes: mes, vendido: somar(vendasMes), qtdVendas: vendasMes.length, doado: somar(enviosMes), doacoes: doacoes, suprimentos: somar(supMes), qtdSuprimentos: supMes.length,
      reservas: reservas, rendimentos: rendimentos, saldoLivre: fimRes.livre, saldoReservas: fimRes.saldoMissao,
      semMovimento: !vendasMes.length && !enviosMes.length && !supMes.length && !retMes.length && rendimentos === 0
    };
  }

  /** Texto pronto para copiar (WhatsApp etc.). `fmt` formata dinheiro; opcoes.reservas inclui o quadro das reservas. */
  function textoPrestacao(p, fmt, opcoes) {
    opcoes = opcoes || {};
    var l = ["PRESTAÇÃO DE CONTAS — " + mesPorExtenso(p.mes).toUpperCase(), ""];
    if (p.semMovimento) { l.push("Sem movimento neste mês."); return l.join("\n"); }
    l.push("Vendas: " + fmt(p.vendido) + " (" + p.qtdVendas + (p.qtdVendas === 1 ? " venda)" : " vendas)"));
    if (p.suprimentos > 0) l.push("Suprimentos comprados para revender: " + fmt(p.suprimentos));
    l.push("Doado às missões: " + fmt(p.doado));
    p.doacoes.forEach(function (x) {
      l.push("  • " + x.nome + ": " + fmt(x.valor) + (x.meta > 0 ? " (já enviado no total: " + fmt(x.acumulado) + " de " + fmt(x.meta) + ", " + Math.round(x.pct * 100) + "%)" : ""));
    });
    if (opcoes.reservas) {
      l.push("", "Reservas separadas das vendas:");
      p.reservas.forEach(function (x) { if (x.separado > 0 || x.retirado > 0) l.push("  • " + x.nome + " (" + String(x.pct).replace(".", ",") + "%): separado " + fmt(x.separado) + (x.retirado > 0 ? ", retirado " + fmt(x.retirado) : "")); });
    }
    if (p.rendimentos > 0) l.push("", "Rendimento dos porquinhos no mês: " + fmt(p.rendimentos));
    l.push("", "Saldo livre na conta no fim do mês: " + fmt(p.saldoLivre));
    if (opcoes.reservas) l.push("Guardado nas reservas no fim do mês: " + fmt(p.saldoReservas));
    return l.join("\n");
  }

  /** Saldo que aparece no app do banco para uma reserva (ou "conta"), para conferir com o calculado. Texto vazio apaga. */
  function informarSaldo(d, chave, valorTexto, data) {
    if (chave !== "conta" && !d.reservas.some(function (r) { return r.id === chave; })) return "Escolha o que conferir.";
    if (String(valorTexto).trim() === "") { delete d.conferencias[chave]; return null; }
    var n = lerNumeroBr(valorTexto);
    if (n === null || n < 0) return "Informe o saldo atual (zero ou mais).";
    if (!dataValida(data)) return "Informe a data da conferência.";
    d.conferencias[chave] = { saldo: arred(n), data: data };
    return null;
  }

  window.Missoes = {
    novoId: novoId, dataValida: dataValida, hoje: hoje, lerValor: lerValor, lerPct: lerPct, vazio: vazio, normalizar: normalizar, resumo: resumo, dividir: dividir,
    adicionarEntrada: adicionarEntrada, adicionarSuprimento: adicionarSuprimento, adicionarRetirada: adicionarRetirada, adicionarMissao: adicionarMissao, adicionarEnvio: adicionarEnvio,
    definirPercentual: definirPercentual, removerEntrada: removerEntrada, removerEnvio: removerEnvio, removerSuprimento: removerSuprimento, removerRetirada: removerRetirada,
    removerMissao: removerMissao, informarSaldo: informarSaldo, definirGiro: definirGiro,
    prestacao: prestacao, textoPrestacao: textoPrestacao, adicionarAjuste: adicionarAjuste, removerAjuste: removerAjuste, definirCdi: definirCdi, marcarRende: marcarRende, rendimento: rendimento, lancarRendimentos: lancarRendimentos
  };
})();
