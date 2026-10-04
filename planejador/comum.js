// Código compartilhado pelas páginas: dados salvos, cálculos por mês, formatação e cabeçalho.
// Sem servidor, sem build: cada página carrega este arquivo antes do seu próprio script.
window.Plano = (function () {
  "use strict";

  var CHAVE = "planejador.listas.v1";
  var CHAVE_OCULTO = "planejador.oculto.v1";
  var CHAVE_BACKUP = "planejador.backup.v1"; // quando foi baixado o último backup (milissegundos)
  var VERSAO_BACKUP = 1;
  var MASCARA = "R$ ••••";
  var MESES = ["Jan", "Fev", "Mar", "Abr", "Mai", "Jun", "Jul", "Ago", "Set", "Out", "Nov", "Dez"];
  var MESES_LONGOS = ["Janeiro", "Fevereiro", "Março", "Abril", "Maio", "Junho", "Julho", "Agosto", "Setembro", "Outubro", "Novembro", "Dezembro"];
  var ANO_INICIAL = 2026, ANOS = 25;
  var INICIO = { ano: 2026, mes: 10 }; // primeiro mês do plano (out/2026); meses anteriores não entram nas somas

  /** "out/2026": o primeiro mês do plano, para os textos das telas. */
  function rotuloInicio() { return MESES[INICIO.mes - 1].toLowerCase() + "/" + INICIO.ano; }

  function antesDoInicio(ano, mes) { return ano * 12 + mes < INICIO.ano * 12 + INICIO.mes; }

  // ---------------------------------------------------------------- valores registrados (planilha)
  // Na versão publicada, exemplo-publico.js define window.PLANO_EXEMPLO (valores inventados) antes deste arquivo.
  var EXEMPLO = window.PLANO_EXEMPLO; // definido por exemplo-publico.js

  // ---------------------------------------------------------------- formatação
  var reais = new Intl.NumberFormat("pt-BR", { style: "currency", currency: "BRL" });
  var reaisInteiros = new Intl.NumberFormat("pt-BR", { style: "currency", currency: "BRL", maximumFractionDigits: 0 });
  var formatoNumero = new Intl.NumberFormat("pt-BR", { minimumFractionDigits: 2, maximumFractionDigits: 2 });

  var estado = { dados: null, oculto: lerOculto() };

  function lerOculto() {
    try { return localStorage.getItem(CHAVE_OCULTO) === "1"; } catch (e) { return false; }
  }

  function salvarOculto() {
    try { localStorage.setItem(CHAVE_OCULTO, estado.oculto ? "1" : "0"); } catch (e) { /* sem armazenamento: vale só nesta sessão */ }
  }

  function moeda(n) { return estado.oculto ? MASCARA : reais.format(n); }
  function moedaInteira(n) { return estado.oculto ? MASCARA : reaisInteiros.format(n); }

  /** Lê um valor digitado em formato brasileiro: "1.234,56", "1234,56" ou "1234.56". */
  function lerNumero(texto) {
    var s = String(texto).trim().replace(/[^\d.,]/g, "");
    if (s.indexOf(",") >= 0) s = s.replace(/\./g, "").replace(",", ".");
    else if (!/^\d+\.\d{1,2}$/.test(s)) s = s.replace(/\./g, ""); // ponto sozinho com 1-2 casas é decimal; senão é milhar
    var n = parseFloat(s);
    return isNaN(n) ? 0 : n;
  }

  /** "2041-02" -> "02/2041". */
  function formatarAte(ate) {
    if (!ate) return "";
    var p = ate.split("-");
    return p[1] + "/" + p[0];
  }

  /** "02/2041" -> "2041-02"; vazio -> ""; formato inválido -> null. */
  function lerAte(texto) {
    var s = String(texto).trim();
    if (s === "") return "";
    var m = /^(\d{1,2})\s*[\/.\-]\s*(\d{4})$/.exec(s);
    if (!m || Number(m[1]) < 1 || Number(m[1]) > 12) return null;
    return m[2] + "-" + (Number(m[1]) < 10 ? "0" : "") + Number(m[1]);
  }

  /** Índice de mês de "YYYY-MM" (ano*12 + mês-1); vazio -> null. */
  function indiceDe(ate) {
    if (!ate) return null;
    var p = ate.split("-");
    return Number(p[0]) * 12 + Number(p[1]) - 1;
  }

  function pctDe(parte, total) {
    return total > 0 ? Math.round((parte / total) * 100) + "%" : "–";
  }

  // ---------------------------------------------------------------- armazenamento
  function copiar(x) { return JSON.parse(JSON.stringify(x)); }

  function padraoPorNome(lista, nome) {
    return EXEMPLO[lista].filter(function (x) { return x.nome === nome; })[0];
  }

  /** Garante em `alvo` as chaves conhecidas de `padrao`; chaves desconhecidas do arquivo são ignoradas na leitura. */
  function completar(alvo, padrao) {
    if (!alvo || typeof alvo !== "object" || Array.isArray(alvo)) return copiar(padrao);
    Object.keys(padrao).forEach(function (k) { if (alvo[k] === undefined || alvo[k] === null) alvo[k] = copiar(padrao[k]); });
    return alvo;
  }

  /** Completa dados salvos por versões anteriores. */
  function migrar(salvo) {
    ["reservas", "folha", "extras", "unicas", "reembolsos"].forEach(function (chave) {
      if (!Array.isArray(salvo[chave])) salvo[chave] = copiar(EXEMPLO[chave]);
    });
    if (!salvo.ref || !salvo.ref.ano || !salvo.ref.mes || antesDoInicio(salvo.ref.ano, salvo.ref.mes)) salvo.ref = copiar(EXEMPLO.ref);
    salvo.reajuste = completar(salvo.reajuste, EXEMPLO.reajuste);
    salvo.aportes = completar(salvo.aportes, EXEMPLO.aportes);
    salvo.aportes.xp = completar(salvo.aportes.xp, EXEMPLO.aportes.xp);
    salvo.aportes.prev = completar(salvo.aportes.prev, EXEMPLO.aportes.prev);
    salvo.aposentadoria = completar(salvo.aposentadoria, EXEMPLO.aposentadoria);
    if (!salvo.patrimonio || typeof salvo.patrimonio !== "object") salvo.patrimonio = copiar(EXEMPLO.patrimonio);
    if (!Array.isArray(salvo.patrimonio.bens)) salvo.patrimonio.bens = copiar(EXEMPLO.patrimonio.bens);
    if (!Array.isArray(salvo.patrimonio.dividas)) salvo.patrimonio.dividas = [];
    if (salvo.carteira === undefined) salvo.carteira = null;
    if (!salvo.conferidas || typeof salvo.conferidas !== "object" || Array.isArray(salvo.conferidas)) salvo.conferidas = {};
    if (!salvo.realizados || typeof salvo.realizados !== "object" || Array.isArray(salvo.realizados)) salvo.realizados = {};
    if (!salvo.contracheques || typeof salvo.contracheques !== "object" || Array.isArray(salvo.contracheques)) salvo.contracheques = {};
    if (!salvo.alocacao || typeof salvo.alocacao !== "object" || Array.isArray(salvo.alocacao)) salvo.alocacao = {};
    ["alvo", "retorno", "mapa"].forEach(function (k) { if (!salvo.alocacao[k] || typeof salvo.alocacao[k] !== "object" || Array.isArray(salvo.alocacao[k])) salvo.alocacao[k] = {}; });
    if (!salvo.pagamentos || typeof salvo.pagamentos !== "object" || Array.isArray(salvo.pagamentos)) salvo.pagamentos = {};
    if (!salvo.cartao || !Array.isArray(salvo.cartao.compras)) salvo.cartao = { compras: [] };
    if (!Array.isArray(salvo.cartao.cartoes) || !salvo.cartao.cartoes.length) salvo.cartao.cartoes = copiar(EXEMPLO.cartao.cartoes);
    if (!salvo.cartao.filtro) salvo.cartao.filtro = "todos";
    if (salvo.cartao.somar === undefined) salvo.cartao.somar = true;
    salvo.cartao.compras.forEach(function (c) {
      if (!salvo.cartao.cartoes.some(function (x) { return x.id === c.cartao; })) c.cartao = salvo.cartao.cartoes[0].id; // compras de antes dos cartões vão para o primeiro
    });
    var antigo = salvo.reembolsos;
    if (antigo.length === 1 && antigo[0].nome === "Reembolso de gastos" && antigo[0].ate === undefined) salvo.reembolsos = copiar(EXEMPLO.reembolsos);
    salvo.despesas.forEach(function (d) {
      var padrao = padraoPorNome("despesas", d.nome);
      if (d.ate === undefined) d.ate = padrao ? padrao.ate : "";
      if (d.reaj === undefined) d.reaj = padrao && padrao.reaj !== undefined ? padrao.reaj : null;
      if (d.cota === undefined && padrao && padrao.cota) d.cota = copiar(padrao.cota);
      if (d.cota && d.cota.custos === undefined) d.cota.custos = 0;
    });
    salvo.reembolsos.forEach(function (d) { if (d.ate === undefined) d.ate = ""; });
    salvo.reservas.forEach(function (r) { if (r.aporte === undefined) { var p = padraoPorNome("reservas", r.nome); r.aporte = p ? p.aporte : false; } });
    salvo.folha.forEach(function (f) { if (f.prev === undefined) { var p = padraoPorNome("folha", f.nome); f.prev = !!(p && p.prev); } });
    return salvo;
  }

  function carregar() {
    try {
      var salvo = JSON.parse(localStorage.getItem(CHAVE));
      if (salvo && Array.isArray(salvo.receitas) && Array.isArray(salvo.despesas)) return migrar(salvo);
    } catch (e) { /* armazenamento indisponível ou corrompido: usa o exemplo */ }
    return dadosPadrao();
  }

  /** Cópia dos valores de partida, já no mesmo formato dos dados que passam pelo carregamento. */
  function dadosPadrao() { return migrar(copiar(EXEMPLO)); }

  var ganchosSalvar = [];
  /** Registra uma função chamada depois de cada salvamento (usada pela cópia automática em arquivo). */
  function aoSalvar(fn) { ganchosSalvar.push(fn); }

  function salvar() {
    try { localStorage.setItem(CHAVE, JSON.stringify(estado.dados)); } catch (e) { /* sem armazenamento: segue sem salvar */ }
    ganchosSalvar.forEach(function (fn) { try { fn(); } catch (e) { /* a cópia automática nunca atrapalha o uso */ } });
  }

  estado.dados = carregar();

  function definirDados(novos) { estado.dados = novos; salvar(); return novos; }

  // ---------------------------------------------------------------- backup
  /** Tudo o que está salvo, num objeto pronto para virar arquivo .json. */
  function montarBackup() {
    return { app: "planejador", versao: VERSAO_BACKUP, geradoEm: new Date().toISOString(), dados: copiar(estado.dados) };
  }

  var LISTAS_BACKUP = ["receitas", "extras", "unicas", "folha", "despesas", "reembolsos", "reservas"];

  function itensValidos(lista) {
    return lista.every(function (i) { return i !== null && typeof i === "object" && !Array.isArray(i); });
  }

  /** Lê e valida o texto de um backup. Devolve os dados prontos para uso ou lança Error com uma mensagem clara. */
  function lerBackup(textoJson) {
    var o;
    try { o = JSON.parse(textoJson); } catch (e) { throw new Error("O arquivo não é um JSON válido."); }
    if (!o || o.app !== "planejador" || o.dados === null || typeof o.dados !== "object" || Array.isArray(o.dados)) throw new Error("Este arquivo não é um backup do Planejador.");
    if (typeof o.versao === "number" && o.versao > VERSAO_BACKUP) throw new Error("Este backup foi feito por uma versão mais nova do programa e não pode ser lido aqui.");
    var d = o.dados;
    if (!Array.isArray(d.receitas) || !Array.isArray(d.despesas)) throw new Error("O backup está incompleto: faltam as listas de receitas ou despesas.");
    LISTAS_BACKUP.forEach(function (k) {
      if (d[k] !== undefined && (!Array.isArray(d[k]) || !itensValidos(d[k]))) throw new Error("O backup tem a lista \"" + k + "\" em formato inválido.");
    });
    if (d.cartao !== undefined && d.cartao !== null && (typeof d.cartao !== "object" || (d.cartao.compras !== undefined && (!Array.isArray(d.cartao.compras) || !itensValidos(d.cartao.compras))))) throw new Error("O backup tem as compras do cartão em formato inválido.");
    if (d.patrimonio !== undefined && d.patrimonio !== null) {
      if (typeof d.patrimonio !== "object" || ["bens", "dividas"].some(function (k) { return d.patrimonio[k] !== undefined && (!Array.isArray(d.patrimonio[k]) || !itensValidos(d.patrimonio[k])); })) throw new Error("O backup tem os bens ou as dívidas em formato inválido.");
    }
    return migrar(copiar(d));
  }

  function restaurarBackup(textoJson) { return definirDados(lerBackup(textoJson)); }

  function registrarBackupFeito() { try { localStorage.setItem(CHAVE_BACKUP, String(Date.now())); } catch (e) { /* sem armazenamento */ } }
  function ultimoBackup() { try { var v = Number(localStorage.getItem(CHAVE_BACKUP)); return v > 0 ? v : null; } catch (e) { return null; } }

  // ---------------------------------------------------------------- cálculo por mês
  /** O item vale no mês? "unicas" só no seu mês; com "Até", só até esse mês (inclusive). */
  function ativo(item, ano, mes) {
    if (item.mes !== undefined) return Number(item.mes) === mes;
    if (item.ate) return ano * 12 + mes - 1 <= indiceDe(item.ate);
    return true;
  }

  var GRUPO_REAJUSTE = { receitas: "receitas", extras: "receitas", unicas: "receitas", folha: "folha", despesas: "despesas", reembolsos: "reembolsos" };

  /** Reajuste anual (%) de um item: o próprio (despesas) ou o do grupo. */
  function taxaDoItem(nome, item) {
    if (item.reaj !== undefined && item.reaj !== null) return Number(item.reaj) || 0;
    return Number(estado.dados.reajuste[GRUPO_REAJUSTE[nome]]) || 0;
  }

  /** Fator sobre o valor de hoje: reajuste acumulado desde o ano base (e, em "reais de hoje", descontada a inflação). */
  function fator(taxa, ano) {
    var n = ano - INICIO.ano, r = estado.dados.reajuste;
    var f = Math.pow(1 + taxa / 100, n);
    if (r.modo === "real") f /= Math.pow(1 + (Number(r.inflacao) || 0) / 100, n);
    return f;
  }

  function somaMes(nome, ano, mes) {
    return estado.dados[nome].reduce(function (t, i) {
      return t + (ativo(i, ano, mes) ? (Number(i.valor) || 0) * fator(taxaDoItem(nome, i), ano) : 0);
    }, 0);
  }

  function pctReservas() {
    return estado.dados.reservas.reduce(function (t, i) { return t + (Number(i.pct) || 0); }, 0);
  }

  function calcMes(ano, mes) {
    var d0 = estado.dados;
    var fixas = somaMes("receitas", ano, mes);
    var extras = somaMes("extras", ano, mes);
    var unicas = somaMes("unicas", ano, mes);
    var r = fixas + extras + unicas;
    var reservas = r * pctReservas() / 100;
    var folha = somaMes("folha", ano, mes);
    var brutas = somaMes("despesas", ano, mes);
    var reemb = somaMes("reembolsos", ano, mes);
    // Faturas dos cartões (página Cartão): entram em reais de hoje ou nominais, conforme o modo, e só se estiverem marcadas para somar.
    var fat = faturaDoMes(ano, mes), escala = fator(0, ano), cartaoPorCartao = {};
    Object.keys(fat.porCartao).forEach(function (id) { cartaoPorCartao[id] = fat.porCartao[id] * escala; });
    var cartaoFatura = fat.total * escala, cartao = d0.cartao.somar !== false ? cartaoFatura : 0;
    var d = brutas + cartao - reemb;
    var liquida = r - folha - reservas;
    var sobra = liquida - d;
    // Aporte: reservas marcadas "conta no aporte" + o que sobra do mês (vai para a corretora);
    // a previdência recebe os descontos de previdência da folha + a contrapartida da empresa.
    var aporteReservas = d0.reservas.reduce(function (t, i) { return t + (i.aporte ? r * (Number(i.pct) || 0) / 100 : 0); }, 0);
    var prevFolha = d0.folha.reduce(function (t, i) {
      return t + (i.prev && ativo(i, ano, mes) ? (Number(i.valor) || 0) * fator(taxaDoItem("folha", i), ano) : 0);
    }, 0);
    var prevEmpresa = (Number(d0.aportes.prev.empresa) || 0) * fator(Number(d0.reajuste.receitas) || 0, ano);
    return {
      fixas: fixas, extras: extras, unicas: unicas, r: r, reservas: reservas, folha: folha, brutas: brutas, reemb: reemb, d: d,
      cartao: cartao, cartaoFatura: cartaoFatura, cartaoPorCartao: cartaoPorCartao,
      liquida: liquida, sobra: sobra,
      aporteReservas: aporteReservas, aporteXP: aporteReservas + sobra, prevFolha: prevFolha, prevEmpresa: prevEmpresa, aportePrev: prevFolha + prevEmpresa
    };
  }

  // ---------------------------------------------------------------- cartão de crédito
  /**
   * Valor que a compra coloca na fatura do mês. "vista" = 1 parcela; "parcelado" = n parcelas a partir de `inicio`
   * (a última absorve o centavo que sobra); "recorrente" = todo mês a partir de `inicio`, até `ate` (se houver).
   * Valores em reais nominais, como na fatura: não recebem reajuste nem inflação.
   */
  function parcelaDaCompra(c, ano, mes) {
    var i0 = indiceDe(c.inicio);
    if (i0 === null) return 0;
    var idx = ano * 12 + mes - 1, k = idx - i0, valor = Number(c.valor) || 0;
    if (k < 0) return 0;
    if (c.tipo === "recorrente") {
      var fim = indiceDe(c.ate);
      return fim !== null && idx > fim ? 0 : valor;
    }
    var n = c.tipo === "vista" ? 1 : Math.max(1, Math.floor(Number(c.parcelas) || 1));
    if (k >= n) return 0;
    var parcela = Math.round(valor / n * 100) / 100;
    return k === n - 1 ? Math.round((valor - parcela * (n - 1)) * 100) / 100 : parcela;
  }

  /**
   * Valor da compra na fatura do mês, em reais nominais. Parcelas e compras à vista são fixas; o que se repete todo
   * mês (assinaturas, mercado…) sobe a cada janeiro pelo reajuste das despesas, como os demais gastos do orçamento
   * (o valor informado é o de hoje, 2026).
   */
  function valorNaFatura(c, ano, mes) {
    var v = parcelaDaCompra(c, ano, mes);
    if (v > 0 && c.tipo === "recorrente") v *= Math.pow(1 + (Number(estado.dados.reajuste.despesas) || 0) / 100, ano - INICIO.ano);
    return v;
  }

  /** Quantas parcelas ainda faltam depois deste mês (compras parceladas; recorrente não tem fim, devolve null). */
  function parcelasRestantes(c, ano, mes) {
    if (c.tipo === "recorrente") return null;
    var i0 = indiceDe(c.inicio);
    if (i0 === null) return 0;
    var n = c.tipo === "vista" ? 1 : Math.max(1, Math.floor(Number(c.parcelas) || 1));
    return Math.max(0, Math.min(n, n - (ano * 12 + mes - 1 - i0 + 1)));
  }

  /**
   * Fatura do mês. `cartaoId` (opcional) restringe total, parcelado, recorrente, categorias e itens a um cartão;
   * `porCartao` traz sempre o total de cada cartão.
   */
  function faturaDoMes(ano, mes, cartaoId) {
    var f = { total: 0, parcelado: 0, recorrente: 0, porCategoria: {}, porCartao: {}, itens: [] };
    estado.dados.cartao.compras.forEach(function (c, i) {
      var v = valorNaFatura(c, ano, mes);
      if (v <= 0) return;
      f.porCartao[c.cartao] = (f.porCartao[c.cartao] || 0) + v;
      if (cartaoId && cartaoId !== "todos" && c.cartao !== cartaoId) return;
      f.total += v;
      if (c.tipo === "recorrente") f.recorrente += v; else f.parcelado += v;
      var cat = (c.categoria || "").trim() || "Sem categoria";
      f.porCategoria[cat] = (f.porCategoria[cat] || 0) + v;
      f.itens.push({ indice: i, valor: v });
    });
    return f;
  }

  /** Executa `fn` com os valores em reais de hoje (a aposentadoria é sempre calculada assim) e devolve a escolha anterior. */
  function emReais(fn) {
    var r = estado.dados.reajuste, antes = r.modo;
    r.modo = "real";
    try { return fn(); } finally { r.modo = antes; }
  }

  // ---------------------------------------------------------------- patrimônio atual
  var NOMES_TIPO_BEM = { imovel: "Imóveis", veiculo: "Veículos", outro: "Outros bens" };

  /** Parte (%) de cada parcela do consórcio que é custo (taxa de administração, fundo de reserva, seguro) e não volta; 0 a 60. */
  function custosDaCota(cota) { var v = Number(cota && cota.custos); return isFinite(v) ? Math.max(0, Math.min(60, v)) : 0; }

  /**
   * Patrimônio de hoje, sem contar nada duas vezes: corretora XP (a carteira importada só atualiza esse saldo), previdência,
   * fundo comum já pago nas cotas de consórcio (o que foi pago menos os custos da parcela; a carta de crédito só vira patrimônio
   * quando é usada), bens e, subtraindo, dívidas. `consorcio` é o fundo comum; `consorcioPago` o total pago e `consorcioCustos` a diferença.
   */
  function patrimonioAtual() {
    var d0 = estado.dados, p = d0.patrimonio, num = function (v) { return Number(v) || 0; };
    var xp = num(d0.aportes.xp.saldo), prev = num(d0.aportes.prev.saldo);
    var cotas = d0.despesas.filter(function (x) { return x.cota; }).map(function (x) {
      var pago = num(x.cota.pago), custos = pago * custosDaCota(x.cota) / 100;
      return { nome: x.nome, pago: pago, custos: custos, fundoComum: pago - custos, pctCustos: custosDaCota(x.cota) };
    });
    var consorcioPago = cotas.reduce(function (t, c) { return t + c.pago; }, 0);
    var consorcioCustos = cotas.reduce(function (t, c) { return t + c.custos; }, 0);
    var consorcio = consorcioPago - consorcioCustos;
    var porTipo = { imovel: 0, veiculo: 0, outro: 0 };
    p.bens.forEach(function (b) { var t = porTipo.hasOwnProperty(b.tipo) ? b.tipo : "outro"; porTipo[t] += num(b.valor); });
    var bens = porTipo.imovel + porTipo.veiculo + porTipo.outro;
    var dividas = p.dividas.reduce(function (t, x) { return t + num(x.valor); }, 0);
    var financeiro = xp + prev, ativos = financeiro + consorcio + bens;
    return { xp: xp, prev: prev, financeiro: financeiro, cotas: cotas, consorcio: consorcio, consorcioPago: consorcioPago, consorcioCustos: consorcioCustos, porTipo: porTipo, bens: bens, dividas: dividas, ativos: ativos, liquido: ativos - dividas };
  }

  /**
   * Taxa mensal equivalente ao retorno anual nominal informado (em "reais de hoje", já descontada a inflação).
   * `custoPct` (opcional) são pontos percentuais ao ano de taxas (administração, custódia) tirados do retorno.
   */
  function taxaMensal(retornoPct, custoPct) {
    var r = estado.dados.reajuste, anual = ((Number(retornoPct) || 0) - (Number(custoPct) || 0)) / 100;
    if (r.modo === "real") anual = (1 + anual) / (1 + (Number(r.inflacao) || 0) / 100) - 1;
    return Math.pow(1 + anual, 1 / 12) - 1;
  }

  /**
   * Evolução mês a mês, do primeiro mês do plano (out/2026) até o fim do horizonte: aportes, rendimento, saldos da corretora e da
   * previdência, e o consórcio pago (somando mês a mês até a contemplação de cada cota).
   */
  function serieAportes(opcoes) {
    var d0 = estado.dados, A = d0.aportes, custo = opcoes && opcoes.custo ? Number(opcoes.custo) || 0 : 0;
    var rx = taxaMensal(A.xp.retorno, custo), rp = taxaMensal(A.prev.retorno, custo);
    var xp = Number(A.xp.saldo) || 0, pv = Number(A.prev.saldo) || 0;
    var cotas = d0.despesas.filter(function (d) { return d.cota; });
    var inicio = INICIO.ano * 12 + INICIO.mes - 1, fim = (ANO_INICIAL + ANOS) * 12 - 1;
    var contemp = cotas.map(function (d) { return indiceDe(d.cota.contemplacao); });
    var acumTotal = cotas.map(function (d) { return Number(d.cota.pago) || 0; });
    var acumAte = acumTotal.slice();
    var congelada = contemp.map(function (c) { return c !== null && c < inicio; });
    var linhas = [], idx, deficit = 0, primeiroZero = null;
    for (idx = inicio; idx <= fim; idx++) {
      var ano = Math.floor(idx / 12), mes = idx % 12 + 1, c = calcMes(ano, mes);
      var rendXp = xp * rx, rendPv = pv * rp;
      // A corretora não fica negativa: o que faltar vira déficit acumulado, e uma sobra futura quita o déficit primeiro.
      xp += rendXp + c.aporteXP;
      if (xp < 0) { deficit -= xp; xp = 0; if (!primeiroZero) primeiroZero = { ano: ano, mes: mes }; }
      else if (deficit > 0) { var quita = Math.min(xp, deficit); xp -= quita; deficit -= quita; }
      pv += rendPv + c.aportePrev;
      var cotasMes = cotas.map(function (d, i) {
        var pago = ativo(d, ano, mes) ? (Number(d.valor) || 0) * fator(taxaDoItem("despesas", d), ano) : 0;
        acumTotal[i] += pago;
        if (!congelada[i]) {
          acumAte[i] += pago;
          if (contemp[i] !== null && idx >= contemp[i]) congelada[i] = true;
        }
        return pago;
      });
      linhas.push({
        ano: ano, mes: mes, c: c, aporteXP: c.aporteXP, aportePrev: c.aportePrev, rendXP: rendXp, rendPrev: rendPv, rendimento: rendXp + rendPv,
        saldoXP: xp, saldoPrev: pv, deficit: deficit, cotasMes: cotasMes, parcelas: cotasMes.reduce(function (t, v) { return t + v; }, 0),
        acumTotal: acumTotal.slice(), acumAte: acumAte.slice()
      });
    }
    return { linhas: linhas, cotas: cotas, primeiroZero: primeiroZero };
  }

  function linhaDoMes(serie, ano, mes) {
    return serie.linhas.filter(function (l) { return l.ano === ano && l.mes === mes; })[0] || null;
  }

  // ---------------------------------------------------------------- DOM
  function el(tag, attrs) {
    var e = document.createElement(tag);
    Object.keys(attrs || {}).forEach(function (k) { e[k] = attrs[k]; });
    return e;
  }

  function texto(id, valor) { document.getElementById(id).textContent = valor; }

  /** Esvazia o elemento e o devolve. */
  function limpar(id) { var e = document.getElementById(id); e.textContent = ""; return e; }

  function soma(valores) { return valores.reduce(function (t, x) { return t + x; }, 0); }

  function nomeMes(m) { return MESES[m - 1].toLowerCase(); }

  /** Campo numérico com prefixo ou sufixo (R$ / %). Em "moeda", mostra milhares e 2 casas (5.698,46). */
  function campoNumero(opcoes) {
    var oculto = estado.oculto;
    var caixa = el("label", { className: "moeda" });
    var campo = opcoes.moeda
      ? el("input", { type: "text", value: oculto ? "••••" : formatoNumero.format(opcoes.valor), readOnly: oculto })
      : el("input", { type: "number", step: opcoes.passo, min: "0", value: opcoes.valor });
    if (opcoes.moeda && oculto) campo.title = "Valores ocultos. Clique em \"Mostrar valores\" para editar.";
    if (opcoes.moeda && !oculto) {
      campo.inputMode = "decimal";
      campo.addEventListener("focus", function () { campo.select(); });
      campo.addEventListener("blur", function () { campo.value = formatoNumero.format(lerNumero(campo.value)); });
    }
    campo.setAttribute("aria-label", opcoes.rotulo);
    if (opcoes.prefixo) caixa.appendChild(el("span", { textContent: opcoes.prefixo }));
    caixa.appendChild(campo);
    if (opcoes.sufixo) caixa.appendChild(el("span", { textContent: opcoes.sufixo }));
    return { caixa: caixa, campo: campo };
  }

  // ---------------------------------------------------------------- cabeçalho (igual nas duas páginas)
  function desenharCabecalho() {
    var d0 = estado.dados, mes = document.getElementById("sel-mes"), ano = document.getElementById("sel-ano"), i;
    var b = document.getElementById("btn-ocultar");
    b.textContent = estado.oculto ? "👁 Mostrar valores" : "🙈 Ocultar valores";
    b.setAttribute("aria-pressed", estado.oculto ? "true" : "false");
    document.body.classList.toggle("oculto", estado.oculto);
    if (!mes || !ano) return; // páginas sem mês analisado (ex.: Aposentadoria)
    mes.textContent = ""; ano.textContent = "";
    for (i = 0; i < 12; i++) mes.appendChild(el("option", { value: i + 1, textContent: MESES_LONGOS[i], selected: d0.ref.mes === i + 1, disabled: antesDoInicio(d0.ref.ano, i + 1) }));
    for (i = 0; i < ANOS; i++) ano.appendChild(el("option", { value: ANO_INICIAL + i, textContent: ANO_INICIAL + i, selected: d0.ref.ano === ANO_INICIAL + i }));
  }

  /** Cabeçalho de tabela mês a mês com um botão por mês (o do mês analisado fica destacado). */
  function cabecalhoMeses(tabela, ano, aoMudar) {
    var d0 = estado.dados, topo = el("tr");
    topo.appendChild(el("th", { textContent: ano, scope: "col" }));
    MESES.forEach(function (nome, k) {
      var th = el("th", { scope: "col" });
      var b = el("button", { type: "button", textContent: nome, className: "mes" + (k + 1 === d0.ref.mes ? " atual" : "") });
      b.disabled = antesDoInicio(ano, k + 1);
      b.setAttribute("aria-label", "Analisar " + MESES_LONGOS[k] + " de " + ano);
      b.setAttribute("aria-pressed", k + 1 === d0.ref.mes ? "true" : "false");
      b.addEventListener("click", function () { d0.ref.mes = k + 1; salvar(); aoMudar(); });
      th.appendChild(b);
      topo.appendChild(th);
    });
    topo.appendChild(el("th", { textContent: "Ano", scope: "col" }));
    tabela.appendChild(el("thead")).appendChild(topo);
  }

  /** Rola a tabela até o mês analisado, se ela for mais larga que a tela. */
  function centrarTabela(tabela) {
    var atual = tabela.querySelector("button.mes.atual"), rolagem = tabela.parentNode;
    if (atual && rolagem.scrollWidth > rolagem.clientWidth) rolagem.scrollLeft = Math.max(0, atual.parentNode.offsetLeft - rolagem.clientWidth / 2);
  }

  // ---------------------------------------------------------------- painel de backup (igual nas quatro páginas)
  var DIAS_ALERTA_BACKUP = 30;

  function backupAtrasado() {
    var u = ultimoBackup();
    return u === null || Date.now() - u > DIAS_ALERTA_BACKUP * 86400000;
  }

  function iniciarBackup() {
    var ocultar = document.getElementById("btn-ocultar");
    if (!ocultar || document.getElementById("btn-backup")) return;
    var botao = el("button", { type: "button", id: "btn-backup", className: "ocultar backup-btn", textContent: "💾 Backup" });
    ocultar.parentNode.insertBefore(botao, ocultar);

    var dlg = el("dialog", { id: "dlg-backup", className: "dialogo" });
    dlg.setAttribute("aria-labelledby", "bk-titulo");
    dlg.appendChild(el("h2", { id: "bk-titulo", textContent: "Backup dos seus dados" }));
    dlg.appendChild(el("p", { textContent: "Seus dados ficam só neste navegador: se você limpar os dados de navegação ou trocar de computador, eles somem. Baixe um arquivo para guardar uma cópia ou levar para outro lugar." }));
    dlg.appendChild(el("p", { className: "bk-aviso", textContent: "O arquivo contém todos os seus valores (e a carteira importada). Guarde-o em um local seguro e não o envie a ninguém sem querer." }));
    var status = el("p", { id: "bk-ultimo", className: "bk-ultimo" });
    var msg = el("p", { id: "bk-msg", className: "bk-msg" });
    msg.setAttribute("role", "status");
    var baixar = el("button", { type: "button", id: "bk-baixar", textContent: "Baixar backup" });
    var arq = el("input", { type: "file", id: "bk-arquivo", accept: ".json,application/json", hidden: true });
    var restaurar = el("label", { className: "btn-arquivo secundario-arq", textContent: "Restaurar de um arquivo…" });
    restaurar.setAttribute("for", "bk-arquivo");
    var fechar = el("button", { type: "button", className: "secundario", textContent: "Fechar" });
    var compartilhar = el("button", { type: "button", id: "bk-compartilhar", textContent: "Enviar backup…", hidden: true });
    var acoes = el("div", { className: "bk-acoes" });
    acoes.append(baixar, compartilhar, restaurar, arq, fechar);

    // cópia automática em arquivo (Chrome e Edge no computador)
    var copia = window.CopiaAutomatica ? window.CopiaAutomatica.criar({
      chave: "planejador", nomeArquivo: "planejador-copia-automatica.json",
      obterTexto: function () { return JSON.stringify(montarBackup(), null, 2); },
      aoGravar: function () { registrarBackupFeito(); }
    }) : null;
    var copiaCaixa = el("div", { className: "bk-copia", hidden: true });
    var copiaTexto = el("p", { id: "bk-copia-texto" });
    var copiaEscolher = el("button", { type: "button", id: "bk-copia-escolher", textContent: "Escolher o arquivo…" });
    var copiaReativar = el("button", { type: "button", id: "bk-copia-reativar", textContent: "Reativar", hidden: true });
    var copiaDesligar = el("button", { type: "button", id: "bk-copia-desligar", className: "secundario", textContent: "Desligar", hidden: true });
    copiaCaixa.append(el("h3", { className: "bk-sub", textContent: "Cópia automática em arquivo" }),
      el("p", { className: "bk-aviso", textContent: "Escolha um arquivo (por exemplo, dentro da pasta do OneDrive) e ele é atualizado sozinho a cada alteração. Serve como backup e pode ser restaurado aqui." }),
      copiaTexto, el("div", { className: "bk-acoes" }));
    copiaCaixa.lastChild.append(copiaEscolher, copiaReativar, copiaDesligar);
    dlg.append(status, acoes, copiaCaixa, msg);
    document.body.appendChild(dlg);
    if (copia && copia.suportado()) { copiaCaixa.hidden = false; aoSalvar(copia.agendar); }

    function atualizarStatus() {
      var u = ultimoBackup();
      status.textContent = u === null ? "Você ainda não baixou nenhum backup neste navegador." : "Último backup baixado em " + new Date(u).toLocaleString("pt-BR") + ".";
      botao.classList.toggle("atencao", backupAtrasado() || copiaPrecisaPermissao);
      botao.title = copiaPrecisaPermissao ? "A cópia automática precisa ser reativada" : backupAtrasado() ? "Faz tempo (ou nunca) que você não baixa um backup" : "Backup e restauração dos dados";
      if (copia && copia.suportado()) copia.estado().then(function (e) {
        copiaPrecisaPermissao = e.estado === "precisa-permissao";
        copiaEscolher.textContent = e.estado === "desligada" ? "Escolher o arquivo…" : "Trocar o arquivo…";
        copiaReativar.hidden = e.estado !== "precisa-permissao"; copiaDesligar.hidden = e.estado === "desligada";
        copiaTexto.textContent = e.estado === "ativa" ? "✓ Ligada: gravando em \"" + e.nome + "\"" + (e.ultimaGravacao ? " (última gravação às " + new Date(e.ultimaGravacao).toLocaleTimeString("pt-BR") + ")" : "") + "."
          : e.estado === "precisa-permissao" ? "! O navegador pediu a permissão de novo para gravar em \"" + e.nome + "\". Clique em Reativar." : "Desligada.";
        if (e.erro) copiaTexto.textContent += " Último erro: " + e.erro + ".";
        botao.classList.toggle("atencao", backupAtrasado() || copiaPrecisaPermissao);
      });
    }
    var copiaPrecisaPermissao = false;
    function mensagem(t, erro) { msg.textContent = t; msg.className = "bk-msg" + (erro ? " erro" : ""); }
    function abrir() { mensagem(""); atualizarStatus(); if (typeof dlg.showModal === "function") dlg.showModal(); else dlg.setAttribute("open", ""); }

    botao.addEventListener("click", abrir);
    fechar.addEventListener("click", function () { if (typeof dlg.close === "function") dlg.close(); else dlg.removeAttribute("open"); });
    baixar.addEventListener("click", function () {
      var b = montarBackup(), a = el("a", { download: "planejador-backup-" + b.geradoEm.slice(0, 10) + ".json" });
      a.href = URL.createObjectURL(new Blob([JSON.stringify(b, null, 2)], { type: "application/json" }));
      document.body.appendChild(a); a.click(); a.remove();
      setTimeout(function () { URL.revokeObjectURL(a.href); }, 1000);
      registrarBackupFeito(); atualizarStatus();
      mensagem("Backup baixado. Procure o arquivo na pasta de Downloads.", false);
    });
    arq.addEventListener("change", function () {
      var f = arq.files[0];
      if (!f) return;
      if (f.size > 5 * 1024 * 1024) { mensagem("O arquivo é grande demais para ser um backup (mais de 5 MB).", true); arq.value = ""; return; }
      f.text().then(function (t) {
        var novos = lerBackup(t); // lança Error com mensagem clara se o arquivo não servir
        if (!window.confirm("Substituir TODOS os dados atuais pelos do arquivo \"" + f.name + "\"? Esta ação não pode ser desfeita (baixe um backup antes, se quiser).")) { mensagem("Restauração cancelada.", false); return; }
        definirDados(novos);
        mensagem("Dados restaurados. Recarregando a página…", false);
        setTimeout(function () { window.location.reload(); }, 400);
      }).catch(function (e) { mensagem("Não consegui restaurar: " + (e && e.message ? e.message : "arquivo inválido"), true); })
        .then(function () { arq.value = ""; });
    });
    var arquivoTeste = typeof File === "function" ? new File(["{}"], "teste.json", { type: "application/json" }) : null;
    if (arquivoTeste && window.CopiaAutomatica && window.CopiaAutomatica.podeCompartilhar(arquivoTeste)) compartilhar.hidden = false;
    compartilhar.addEventListener("click", function () {
      var b = montarBackup(), arquivo = new File([JSON.stringify(b, null, 2)], "planejador-backup-" + b.geradoEm.slice(0, 10) + ".json", { type: "application/json" });
      navigator.share({ files: [arquivo], title: "Backup do planejador" }).then(function () {
        registrarBackupFeito(); atualizarStatus(); mensagem("Backup enviado. Guarde-o em um lugar seguro e apague das conversas depois.", false);
      }, function (e) { if (!e || e.name !== "AbortError") mensagem("Não consegui compartilhar: " + ((e && e.message) || "erro"), true); });
    });
    copiaEscolher.addEventListener("click", function () {
      copia.escolherArquivo().then(function (r) {
        if (r.ok) { mensagem("Cópia automática ligada. O arquivo é atualizado a cada alteração.", false); }
        else if (!r.cancelado) mensagem("Não consegui ligar a cópia automática: " + r.erro, true);
        atualizarStatus();
      });
    });
    copiaReativar.addEventListener("click", function () {
      copia.reativar().then(function (r) { mensagem(r.ok ? "Cópia automática reativada." : "Não foi possível reativar: " + r.erro, !r.ok); atualizarStatus(); });
    });
    copiaDesligar.addEventListener("click", function () { copia.desligar().then(function () { mensagem("Cópia automática desligada. O arquivo já gravado continua no seu computador.", false); atualizarStatus(); }); });
    atualizarStatus();
  }

  /** Liga o botão de ocultar e os seletores de mês/ano; `aoMudar` redesenha a página. */
  function iniciarCabecalho(aoMudar) {
    iniciarBackup();
    document.getElementById("btn-ocultar").addEventListener("click", function () { estado.oculto = !estado.oculto; salvarOculto(); aoMudar(); });
    var selMes = document.getElementById("sel-mes"), selAno = document.getElementById("sel-ano");
    if (selMes) selMes.addEventListener("change", function (e) { estado.dados.ref.mes = Number(e.target.value); salvar(); aoMudar(); });
    if (selAno) selAno.addEventListener("change", function (e) {
      var ref = estado.dados.ref;
      ref.ano = Number(e.target.value);
      if (antesDoInicio(ref.ano, ref.mes)) ref.mes = INICIO.mes;
      salvar(); aoMudar();
    });
  }

  return {
    CHAVE: CHAVE, MESES: MESES, MESES_LONGOS: MESES_LONGOS, ANO_INICIAL: ANO_INICIAL, ANOS: ANOS, INICIO: INICIO, EXEMPLO: EXEMPLO,
    rotuloInicio: rotuloInicio, estado: estado, copiar: copiar, dadosPadrao: dadosPadrao, salvar: salvar, definirDados: definirDados, antesDoInicio: antesDoInicio,
    moeda: moeda, moedaInteira: moedaInteira, formatoNumero: formatoNumero, lerNumero: lerNumero, formatarAte: formatarAte, lerAte: lerAte,
    indiceDe: indiceDe, pctDe: pctDe, ativo: ativo, taxaDoItem: taxaDoItem, fator: fator, somaMes: somaMes, pctReservas: pctReservas,
    custosDaCota: custosDaCota, patrimonioAtual: patrimonioAtual, NOMES_TIPO_BEM: NOMES_TIPO_BEM, calcMes: calcMes, parcelaDaCompra: parcelaDaCompra, valorNaFatura: valorNaFatura, parcelasRestantes: parcelasRestantes, faturaDoMes: faturaDoMes, taxaMensal: taxaMensal, serieAportes: serieAportes, emReais: emReais, linhaDoMes: linhaDoMes,
    montarBackup: montarBackup, lerBackup: lerBackup, restaurarBackup: restaurarBackup, ultimoBackup: ultimoBackup, registrarBackupFeito: registrarBackupFeito, backupAtrasado: backupAtrasado,
    aoSalvar: aoSalvar, limpar: limpar, soma: soma,
    el: el, texto: texto, nomeMes: nomeMes, campoNumero: campoNumero, cabecalhoMeses: cabecalhoMeses, centrarTabela: centrarTabela, desenharCabecalho: desenharCabecalho, iniciarCabecalho: iniciarCabecalho
  };
})();
