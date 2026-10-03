// Indicadores de saúde financeira. Carregue depois de comum.js; ficam em Plano.indicadores.
//
// Tudo em reais de hoje, sobre os 12 meses que começam no mês analisado (dados.ref). Cada indicador traz um nível:
//   "bom" | "atencao" | "alerta" | "sem" (sem dados para avaliar). Os limites são referências comuns, não regras:
//   - taxa de poupança: parte da renda que vira patrimônio (reservas marcadas "No aporte" + sobra do mês + previdência descontada na folha,
//     sem a contrapartida da empresa) ÷ receita total. Bom a partir de 20%, atenção de 10% a 20%, alerta abaixo de 10%.
//   - reserva de emergência: saldo da corretora ÷ despesas mensais médias (despesas da lista + faturas dos cartões, sem descontar reembolsos).
//     Bom a partir de 6 meses, atenção de 3 a 6, alerta abaixo de 3. Previdência e bens não contam: não são dinheiro disponível.
//   - comprometimento: (parcelas de consórcio + parcelas fixas do cartão) ÷ receita líquida. Bom até 30%, atenção até 40%, alerta acima.
//   - liquidez: quanto do patrimônio é dinheiro (corretora) e quanto está preso (previdência, imóveis, veículos, consórcio pago).
(function (P) {
  "use strict";

  var num = function (v) { return Number(v) || 0; };
  var META_RESERVA_MESES = 6, MIN_RESERVA_MESES = 3;
  var BOA_POUPANCA = 0.20, MIN_POUPANCA = 0.10;
  var BOM_COMPROMETIMENTO = 0.30, MAX_COMPROMETIMENTO = 0.40;

  function nivelMaior(v, bom, minimo) { return v >= bom ? "bom" : v >= minimo ? "atencao" : "alerta"; }
  function nivelMenor(v, bom, maximo) { return v <= bom ? "bom" : v <= maximo ? "atencao" : "alerta"; }

  /** Calcula os quatro indicadores com os dados que estiverem em P.estado.dados. */
  function calcular() {
    var d = P.estado.dados, ref = d.ref, base = ref.ano * 12 + ref.mes - 1;
    return P.emReais(function () {
      var receita = 0, liquida = 0, poupado = 0, despesas = 0, consorcio = 0, parcelado = 0, i, c, idx, ano, mes;
      var cotas = d.despesas.filter(function (x) { return x.cota; });
      for (i = 0; i < 12; i++) {
        idx = base + i; ano = Math.floor(idx / 12); mes = idx % 12 + 1; c = P.calcMes(ano, mes);
        receita += c.r; liquida += c.liquida;
        poupado += c.aporteReservas + c.sobra + c.prevFolha;
        despesas += c.brutas + c.cartao;
        cotas.forEach(function (x) { if (P.ativo(x, ano, mes)) consorcio += num(x.valor) * P.fator(P.taxaDoItem("despesas", x), ano); });
        parcelado += P.faturaDoMes(ano, mes).parcelado * P.fator(0, ano);
      }
      var p = P.patrimonioAtual();

      // taxa de poupança
      var taxa = receita > 0 ? poupado / receita : null;
      var poupanca = { valor: taxa, porMes: poupado / 12, nivel: taxa === null ? "sem" : nivelMaior(taxa, BOA_POUPANCA, MIN_POUPANCA), meta: BOA_POUPANCA };

      // reserva de emergência
      var mensal = despesas / 12, meses = mensal > 0 ? p.xp / mensal : null;
      var reserva = {
        meses: meses, liquido: p.xp, despesaMensal: mensal, metaMeses: META_RESERVA_MESES, falta: Math.max(0, META_RESERVA_MESES * mensal - p.xp),
        nivel: meses === null ? "sem" : nivelMaior(meses, META_RESERVA_MESES, MIN_RESERVA_MESES)
      };

      // comprometimento da renda
      var pct = liquida > 0 ? (consorcio + parcelado) / liquida : null;
      var comprometimento = {
        valor: pct, consorcioMensal: consorcio / 12, parceladoMensal: parcelado / 12, receitaLiquidaMensal: liquida / 12,
        nivel: pct === null ? "sem" : nivelMenor(pct, BOM_COMPROMETIMENTO, MAX_COMPROMETIMENTO)
      };

      // liquidez do patrimônio
      var travado = p.prev + p.bens + p.consorcio, total = p.xp + travado;
      var liquidez = { liquido: p.xp, travado: travado, prev: p.prev, bens: p.bens, consorcio: p.consorcio, total: total, pctLiquido: total > 0 ? p.xp / total : null, dividas: p.dividas };

      return { poupanca: poupanca, reserva: reserva, comprometimento: comprometimento, liquidez: liquidez };
    });
  }

  P.indicadores = { calcular: calcular, META_RESERVA_MESES: META_RESERVA_MESES, MIN_RESERVA_MESES: MIN_RESERVA_MESES, BOA_POUPANCA: BOA_POUPANCA, MIN_POUPANCA: MIN_POUPANCA, BOM_COMPROMETIMENTO: BOM_COMPROMETIMENTO, MAX_COMPROMETIMENTO: MAX_COMPROMETIMENTO };
})(window.Plano);
