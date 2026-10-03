// Pagamentos: o que já foi pago e o que está pendente em cada mês, com a data do pagamento.
// Carregue depois de comum.js; fica em Plano.pagamentos. Guarda só em dados.pagamentos:
//   { "2026-10": { "d:Aluguel": "2026-10-05", "c:inter": "2026-10-10" } }   (chave da conta -> data do pagamento)
// Valor realmente pago (opcional, só de contas pagas): dados.realizados, mesma forma, com o valor em reais de hoje ou nominais como o previsto:
//   { "2026-10": { "d:Aluguel": 1530.5 } }   Sem valor informado, vale o previsto. Desmarcar o pagamento apaga o valor realizado.
// A chave usa o nome da despesa (ou o id do cartão); renomear uma despesa faz o pagamento marcado voltar a pendente.
// Nomes repetidos ganham sufixo (#2, #3…) pela ordem na lista.
// O dia de vencimento (1 a 31, opcional) fica na própria despesa (`dia`) ou no cartão (`dia`); em meses curtos vale o último dia.
// Situação de cada conta: paga, atrasada (pendente com vencimento antes de hoje), hoje, proxima (vence em até 7 dias) ou pendente.
(function (P) {
  "use strict";

  var num = function (v) { return Number(v) || 0; };
  function chaveMes(ano, mes) { return ano + "-" + (mes < 10 ? "0" : "") + mes; }

  function dataValida(iso) {
    if (typeof iso !== "string" || !/^\d{4}-\d{2}-\d{2}$/.test(iso)) return false;
    var p = iso.split("-").map(Number), d = new Date(p[0], p[1] - 1, p[2]);
    return d.getFullYear() === p[0] && d.getMonth() === p[1] - 1 && d.getDate() === p[2];
  }

  /** Hoje, como aaaa-mm-dd no horário local. */
  function hoje() {
    var d = new Date();
    return d.getFullYear() + "-" + ("0" + (d.getMonth() + 1)).slice(-2) + "-" + ("0" + d.getDate()).slice(-2);
  }

  function ultimoDia(ano, mes) { return new Date(ano, mes, 0).getDate(); }
  function diaValido(v) { var n = Number(v); return v !== "" && v !== null && v !== undefined && isFinite(n) && Math.floor(n) === n && n >= 1 && n <= 31 ? n : null; }
  function iso(ano, mes, dia) { return ano + "-" + ("0" + mes).slice(-2) + "-" + ("0" + dia).slice(-2); }
  function diasEntre(deIso, ateIso) { var a = deIso.split("-").map(Number), b = ateIso.split("-").map(Number); return Math.round((Date.UTC(b[0], b[1] - 1, b[2]) - Date.UTC(a[0], a[1] - 1, a[2])) / 86400000); }

  /** Acrescenta vencimento e situação à conta. */
  function situar(c, ano, mes, hojeIso) {
    c.dia = diaValido(c.dia);
    c.venc = c.dia ? iso(ano, mes, Math.min(c.dia, ultimoDia(ano, mes))) : null;
    c.dias = c.venc ? diasEntre(hojeIso, c.venc) : null; // negativo = já venceu
    c.situacao = c.pago ? "paga" : c.dias === null ? "pendente" : c.dias < 0 ? "atrasada" : c.dias === 0 ? "hoje" : c.dias <= 7 ? "proxima" : "pendente";
    return c;
  }

  function valorRealizado(d, k, chave) {
    var v = (d.realizados && d.realizados[k] || {})[chave];
    return typeof v === "number" && isFinite(v) && v > 0 ? v : null;
  }
  function arred(v) { return Math.round(v * 100) / 100; }

  /**
   * Contas do mês: despesas da lista (valor reajustado como no orçamento) e a fatura de cada cartão. `pago` = data ou null.
   * `valor` é o previsto; `real` é o que foi pago (só se pago; igual ao previsto quando não foi informado outro) e `diferenca` = real − previsto.
   */
  function contas(ano, mes, hojeIso) {
    hojeIso = hojeIso || hoje();
    var d = P.estado.dados, km = chaveMes(ano, mes), marcados = (d.pagamentos || {})[km] || {}, vistos = {}, out = [];
    function realizar(c) {
      var informado = c.pago ? valorRealizado(d, km, c.chave) : null;
      c.real = c.pago ? (informado !== null ? informado : c.valor) : null;
      c.diferenca = c.pago ? arred(c.real - c.valor) : null;
      c.realInformado = informado !== null;
      return c;
    }
    d.despesas.forEach(function (x, indice) {
      if (!P.ativo(x, ano, mes)) return;
      var valor = num(x.valor) * P.fator(P.taxaDoItem("despesas", x), ano);
      if (valor <= 0) return;
      var base = "d:" + (x.nome || "despesa"), n = (vistos[base] = (vistos[base] || 0) + 1), chave = n > 1 ? base + "#" + n : base;
      out.push(realizar(situar({ chave: chave, grupo: x.cota ? "consorcio" : "despesa", nome: x.nome || "despesa", valor: valor, pago: dataValida(marcados[chave]) ? marcados[chave] : null, dia: x.dia, fonte: { tipo: "despesa", indice: indice } }, ano, mes, hojeIso)));
    });
    var fat = P.faturaDoMes(ano, mes), escala = P.fator(0, ano);
    d.cartao.cartoes.forEach(function (c) {
      var valor = num(fat.porCartao[c.id]) * escala;
      if (valor <= 0) return;
      var chave = "c:" + c.id;
      out.push(realizar(situar({ chave: chave, grupo: "cartao", nome: "Fatura " + c.nome, valor: valor, pago: dataValida(marcados[chave]) ? marcados[chave] : null, dia: c.dia, fonte: { tipo: "cartao", id: c.id } }, ano, mes, hojeIso)));
    });
    return out;
  }

  function resumo(lista) {
    var r = { total: 0, pago: 0, pagoReal: 0, desvio: 0, qtdComDiferenca: 0, pendente: 0, qtd: lista.length, qtdPagas: 0, qtdPendentes: 0, qtdAtrasadas: 0, atrasado: 0, qtdProximas: 0 };
    lista.forEach(function (c) {
      r.total += c.valor;
      if (c.pago) {
        r.pago += c.valor; r.pagoReal += c.real; r.qtdPagas++;
        if (Math.abs(c.diferenca) >= 0.005) { r.qtdComDiferenca++; r.desvio += c.diferenca; }
      } else {
        r.pendente += c.valor; r.qtdPendentes++;
        if (c.situacao === "atrasada") { r.qtdAtrasadas++; r.atrasado += c.valor; }
        if (c.situacao === "hoje" || c.situacao === "proxima") r.qtdProximas++;
      }
    });
    return r;
  }

  /**
   * Informa quanto foi realmente pago numa conta já paga (valor > 0). Vazio ou null remove (vale o previsto). Valor igual ao previsto também
   * remove. Devolve true se gravou; false se a conta não existe, não está paga ou o valor é inválido.
   */
  function definirReal(ano, mes, chave, valor) {
    var d = P.estado.dados, k = chaveMes(ano, mes), conta = contas(ano, mes).filter(function (c) { return c.chave === chave; })[0];
    if (!conta || !conta.pago) return false;
    var v = valor === null || valor === undefined || valor === "" ? null : Number(valor);
    if (v !== null && (!isFinite(v) || v <= 0)) return false;
    if (!d.realizados[k]) d.realizados[k] = {};
    if (v === null || Math.abs(v - conta.valor) < 0.005) delete d.realizados[k][chave]; else d.realizados[k][chave] = arred(v);
    if (!Object.keys(d.realizados[k]).length) delete d.realizados[k];
    P.salvar();
    return true;
  }

  /**
   * Orçado × realizado dos últimos `n` meses até o mês `ate` ({ano, mes}), do mais antigo ao mais novo, sem meses antes do início do plano.
   * previsto = tudo que vence no mês; pagoReal = o que foi pago; desvio = real − previsto só das contas pagas.
   */
  function historico(ate, n, hojeIso) {
    var out = [], idx = ate.ano * 12 + ate.mes - 1, i;
    for (i = 0; i < (n || 12); i++) {
      var ano = Math.floor((idx - i) / 12), mes = (idx - i) % 12 + 1;
      if (P.antesDoInicio(ano, mes)) break;
      var s = resumo(contas(ano, mes, hojeIso));
      out.push({ ano: ano, mes: mes, previsto: s.total, previstoPagas: s.pago, pagoReal: s.pagoReal, desvio: s.desvio, pendente: s.pendente, qtd: s.qtd, qtdPagas: s.qtdPagas, qtdAtrasadas: s.qtdAtrasadas });
    }
    return out.reverse();
  }

  /** Marca como pago na data (aaaa-mm-dd; padrão: hoje) ou, com data null, volta para pendente. Devolve true se gravou. */
  function marcar(ano, mes, chave, data) {
    var d = P.estado.dados, k = chaveMes(ano, mes);
    if (data !== null && data !== undefined && !dataValida(data)) return false;
    if (!d.pagamentos[k]) d.pagamentos[k] = {};
    if (data === null) {
      delete d.pagamentos[k][chave]; if (!Object.keys(d.pagamentos[k]).length) delete d.pagamentos[k];
      if (d.realizados[k]) { delete d.realizados[k][chave]; if (!Object.keys(d.realizados[k]).length) delete d.realizados[k]; }
    }
    else d.pagamentos[k][chave] = data === undefined ? hoje() : data;
    P.salvar();
    return true;
  }

  /** Define o dia de vencimento (1 a 31; vazio/null remove) da despesa ou do cartão de uma conta. Devolve true se gravou. */
  function definirDia(conta, dia) {
    var d = P.estado.dados, alvo = null, v = dia === "" || dia === null || dia === undefined ? null : diaValido(dia);
    if (dia !== "" && dia !== null && dia !== undefined && v === null) return false;
    if (conta.fonte.tipo === "despesa") alvo = d.despesas[conta.fonte.indice];
    else alvo = d.cartao.cartoes.filter(function (c) { return c.id === conta.fonte.id; })[0];
    if (!alvo) return false;
    if (v === null) delete alvo.dia; else alvo.dia = v;
    P.salvar();
    return true;
  }

  /** Marca todas as pendentes do mês (na data dada, padrão hoje). Devolve quantas marcou. */
  function marcarTodas(ano, mes, data) {
    var n = 0;
    contas(ano, mes).forEach(function (c) { if (!c.pago && marcar(ano, mes, c.chave, data)) n++; });
    return n;
  }

  P.pagamentos = { definirReal: definirReal, historico: historico, definirDia: definirDia, contas: contas, resumo: resumo, marcar: marcar, marcarTodas: marcarTodas, hoje: hoje, dataValida: dataValida, chaveMes: chaveMes };
})(window.Plano);
