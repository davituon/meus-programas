// Conferência dos dados preenchidos. Carregue depois de comum.js e calculo-aposentadoria.js; fica em Plano.conferencia.
//
// Roda tudo dentro do navegador, sobre os dados salvos nele. Procura o que costuma estar errado em um plano financeiro
// preenchido à mão: valores que ainda são os de exemplo, campos zerados, gastos que podem estar contados duas vezes,
// saldos que não batem entre as páginas e sinais de que o plano não fecha.
//
// Níveis: "atencao" (provável erro ou risco real), "confirme" (valor de partida ou palpite que só você pode confirmar),
//         "info" (fato útil, sem ação obrigatória) e "ok" (conferido).
(function (P) {
  "use strict";

  var norm = function (s) { return String(s || "").normalize("NFD").replace(/[̀-ͯ]/g, "").toLowerCase(); };
  var num = function (v) { return Number(v) || 0; };
  var mesAno = function (idx) { return P.MESES[idx % 12].toLowerCase() + "/" + Math.floor(idx / 12); };

  // gastos que costumam aparecer tanto na lista de despesas quanto na fatura do cartão
  var GRUPOS = {
    "mercado": ["mercado", "aliment", "supermerc"],
    "combustível": ["combust", "gasolina", "posto"],
    "saúde e farmácia": ["farmac", "saude", "drog"],
    "lazer e restaurantes": ["lazer", "restaur", "cinema"],
    "assinaturas": ["assinat", "stream", "netflix", "spotify"]
  };

  function grupoDe(texto) {
    var t = norm(texto), achados = [];
    Object.keys(GRUPOS).forEach(function (g) { if (GRUPOS[g].some(function (k) { return t.indexOf(k) >= 0; })) achados.push(g); });
    return achados;
  }

  function verificar(hoje) {
    hoje = hoje || new Date();
    var d = P.estado.dados, padrao = P.dadosPadrao(), itens = [];
    function add(id, nivel, titulo, detalhe, pagina) { itens.push({ id: id, nivel: nivel, titulo: titulo, detalhe: detalhe || "", pagina: pagina || "" }); }
    var igual = function (a, b) { return JSON.stringify(a) === JSON.stringify(b); };
    var ref = d.ref, fmt = P.moeda;

    // ------------------------------------------------ o que ainda é o exemplo (áreas personalizadas)
    var cotas = d.despesas.filter(function (x) { return x.cota; });
    var cartasPadrao = padrao.despesas.filter(function (x) { return x.cota; }).map(function (x) { return x.cota.carta; });
    var areas = [
      ["Receitas fixas", !igual(d.receitas, padrao.receitas), "index.html"],
      ["Receitas extras", !igual(d.extras, padrao.extras), "index.html"],
      ["Receitas de um mês só", !igual(d.unicas, padrao.unicas), "index.html"],
      ["Descontos em folha", !igual(d.folha, padrao.folha), "index.html"],
      ["Reservas", !igual(d.reservas, padrao.reservas), "index.html"],
      ["Despesas", !igual(d.despesas.map(function (x) { return [x.nome, x.valor, x.ate, x.reaj]; }), padrao.despesas.map(function (x) { return [x.nome, x.valor, x.ate, x.reaj]; })), "index.html"],
      ["Reembolsos", !igual(d.reembolsos, padrao.reembolsos), "index.html"],
      ["Reajustes e inflação", !igual(P.copiar(d.reajuste), P.copiar(padrao.reajuste)), "index.html"],
      ["Saldos da XP e da previdência", num(d.aportes.xp.saldo) !== num(padrao.aportes.xp.saldo) || num(d.aportes.prev.saldo) !== num(padrao.aportes.prev.saldo), "aportes.html"],
      ["Cotas de consórcio (cartas, já pago, contemplação)", cotas.length !== 4 || cotas.some(function (c, i) { return num(c.cota.carta) !== num(cartasPadrao[i]) || num(c.cota.pago) > 0 || !!c.cota.contemplacao; }), "aportes.html"],
      ["Carteira importada da XP", !!d.carteira, "carteira.html"],
      ["Compras nos cartões", d.cartao.compras.length > 0, "cartao.html"],
      ["Bens e dívidas", !igual(d.patrimonio, padrao.patrimonio), "patrimonio.html"],
      ["Premissas da aposentadoria", !igual(d.aposentadoria, padrao.aposentadoria), "aposentadoria.html"]
    ].map(function (a) { var conferida = !!(d.conferidas && d.conferidas[a[0]]); return { nome: a[0], feita: a[1] || conferida, conferida: conferida && !a[1], pagina: a[2] }; });
    var pendentes = areas.filter(function (a) { return !a.feita; });
    if (pendentes.length) {
      add("areas-exemplo", "confirme", pendentes.length + (pendentes.length === 1 ? " área ainda tem" : " áreas ainda têm") + " os valores de exemplo",
        pendentes.map(function (a) { return a.nome; }).join("; ") + ". Se esses valores já estão corretos, tudo bem; se não, atualize. A lista \"Áreas do plano\", mais abaixo, leva a cada página.", "");
    }

    // ------------------------------------------------ campos zerados
    var zerados = function (lista) { return lista.filter(function (x) { return num(x.valor) === 0; }).map(function (x) { return x.nome || "(sem nome)"; }); };
    var zFolha = zerados(d.folha), zDesp = zerados(d.despesas), zRec = zerados(d.receitas);
    if (!d.receitas.length || zRec.length === d.receitas.length) add("sem-receita", "atencao", "Nenhuma receita fixa com valor", "Sem receita fixa o orçamento e a aposentadoria não fazem sentido.", "index.html");
    else add("receita-ok", "ok", "Receitas fixas cadastradas", "", "index.html");
    if (zFolha.length) add("folha-zero", "confirme", "Descontos em folha com valor zero", zFolha.join(", ") + ". Se o desconto existe, informe o valor; se não existe, remova a linha.", "index.html");
    if (zDesp.length) add("despesa-zero", "confirme", "Despesas com valor zero", zDesp.join(", ") + ".", "index.html");
    if (!d.reservas.some(function (r) { return r.aporte; })) add("reserva-sem-aporte", "atencao", "Nenhuma reserva conta no aporte", "Marque \"No aporte\" nas reservas que viram dinheiro investido (poupança, investimento…); senão o aporte para a XP fica só com a sobra do mês.", "index.html");

    // ------------------------------------------------ cartões
    var compras = d.cartao.compras;
    if (!compras.length) add("cartao-vazio", "confirme", "Nenhuma compra cadastrada nos cartões", "Se você usa cartão de crédito, cadastre as compras (parceladas, assinaturas e fixas) para a fatura entrar no orçamento.", "cartao.html");
    var exemplos = compras.filter(function (c) { return /\(exemplo\)/i.test(c.nome || ""); });
    if (exemplos.length) add("cartao-exemplos", "atencao", "Há compras de exemplo nos cartões", exemplos.length + " compra(s) marcada(s) \"(exemplo)\" estão entrando nas despesas. Remova-as.", "cartao.html");
    var incompletas = compras.filter(function (c) { return !c.inicio || num(c.valor) <= 0; });
    if (incompletas.length) add("cartao-incompleto", "atencao", "Compras no cartão sem início ou sem valor", incompletas.map(function (c) { return c.nome || "(sem nome)"; }).join(", ") + ". Elas não entram na fatura.", "cartao.html");
    if (compras.length && d.cartao.somar === false) add("cartao-fora", "info", "As faturas estão fora do orçamento", "A caixa \"Somar as faturas às despesas\" está desmarcada: o cartão não pesa no resultado do mês.", "cartao.html");
    if (compras.length && d.cartao.somar !== false) {
      var pares = [];
      d.despesas.forEach(function (x) {
        var gs = grupoDe(x.nome);
        if (!gs.length) return;
        compras.forEach(function (c) {
          var gc = grupoDe((c.categoria || "") + " " + (c.nome || ""));
          if (gs.some(function (g) { return gc.indexOf(g) >= 0; })) pares.push("\"" + x.nome + "\" (despesas) e \"" + (c.categoria || c.nome) + "\" (cartão)");
        });
      });
      if (pares.length) add("cartao-duplicado", "atencao", "Possível gasto contado duas vezes", pares.slice(0, 4).join("; ") + (pares.length > 4 ? "; …" : "") + ". Se for o mesmo gasto, mantenha em um só lugar.", "cartao.html");
      else add("cartao-sem-duplicidade", "ok", "Não encontrei gasto do cartão repetido nas despesas", "", "cartao.html");
    }

    // ------------------------------------------------ saldos, consórcio e carteira
    if (num(d.aportes.xp.saldo) <= 0) add("xp-zero", "confirme", "Saldo da corretora XP está zerado", "Informe o saldo de hoje ou importe a posição na página Carteira.", "aportes.html");
    if (num(d.aportes.prev.saldo) <= 0) add("prev-zero", "confirme", "Saldo da previdência está zerado", "Informe o saldo de hoje conforme o extrato da previdência.", "aportes.html");
    if (num(d.aportes.prev.empresa) === 0) add("prev-empresa", "info", "Sem contrapartida da empresa na previdência", "Se a empresa também contribui, informe o valor mensal na página Aportes.", "aportes.html");
    var cartasIguais = cotas.length === 4 && cotas.every(function (c, i) { return num(c.cota.carta) === num(cartasPadrao[i]); });
    var semCustos = cotas.filter(function (c) { return num(c.cota.pago) > 0 && P.custosDaCota(c.cota) === 0; });
    if (semCustos.length) add("cota-sem-custos", "confirme", "Consórcio contado pelo valor pago inteiro", semCustos.map(function (c) { return c.nome; }).join(", ") + ". Taxa de administração, fundo de reserva e seguro não voltam: informe a parte de cada parcela que é custo (na página Aportes) para o patrimônio contar só o fundo comum.", "aportes.html");
    if (cotas.some(function (c) { return num(c.cota.carta) === 0; })) add("cota-sem-carta", "confirme", "Cota de consórcio sem valor de carta", cotas.filter(function (c) { return num(c.cota.carta) === 0; }).map(function (c) { return c.nome; }).join(", ") + ".", "aportes.html");
    else if (cartasIguais) add("cota-cartas-padrao", "confirme", "As cartas dos consórcios ainda são as do cadastro antigo", "Elas foram atribuídas às cotas 1 a 4 por aproximação: confira qual carta é de qual cota.", "aportes.html");
    if (cotas.length && cotas.every(function (c) { return num(c.cota.pago) === 0; })) add("cota-sem-pago", "confirme", "Nenhuma cota informa o valor já pago antes de " + P.rotuloInicio(), "Esse valor entra no patrimônio e no acompanhamento do consórcio.", "patrimonio.html");
    if (cotas.length && cotas.every(function (c) { return !c.cota.contemplacao; })) add("cota-sem-contemplacao", "info", "Nenhuma cota tem contemplação prevista", "Informe o mês (mm/aaaa) quando a cota for contemplada para congelar o acúmulo.", "aportes.html");

    var c = d.carteira;
    if (!c) add("carteira-nao", "confirme", "Carteira da XP ainda não importada", "Importe a \"Posição detalhada\" para trazer o patrimônio e os ativos.", "carteira.html");
    else {
      var m = /(\d{2})\/(\d{2})\/(\d{4})/.exec(c.geradoEm || ""), idade = m ? Math.floor((hoje - new Date(Number(m[3]), Number(m[2]) - 1, Number(m[1]))) / 86400000) : null;
      if (idade !== null && idade > 30) add("carteira-velha", "confirme", "A carteira importada tem " + idade + " dias", "Importe um arquivo novo para atualizar as posições.", "carteira.html");
      if (c.avisos && c.avisos.length) add("carteira-avisos", "atencao", "A importação da carteira teve avisos", c.avisos.join(" "), "carteira.html");
      if (c.patrimonio !== null && c.patrimonio !== undefined && Math.abs(num(c.patrimonio) - num(d.aportes.xp.saldo)) > 0.01) add("xp-difere-carteira", "atencao", "O saldo da XP não bate com a carteira importada", "Saldo da XP: " + fmt(num(d.aportes.xp.saldo)) + "; carteira: " + fmt(num(c.patrimonio)) + ". Na página Carteira, o botão \"Usar … como saldo da corretora XP\" iguala os dois.", "carteira.html");
      else if (c.patrimonio !== null && c.patrimonio !== undefined) add("xp-confere", "ok", "O saldo da XP bate com a carteira importada", "", "carteira.html");
    }

    // ------------------------------------------------ patrimônio
    var bens = d.patrimonio.bens;
    if (bens.some(function (b) { return b.tipo === "veiculo" && num(b.valor) === 0; })) add("carro-zero", "confirme", "Veículo sem valor", "Informe o valor de mercado do carro para o patrimônio.", "patrimonio.html");
    if (!d.patrimonio.dividas.length) add("sem-dividas", "info", "Nenhuma dívida cadastrada", "Se houver financiamento (apartamento, carro) ou empréstimo, informe o saldo devedor: ele reduz o patrimônio.", "patrimonio.html");

    // ------------------------------------------------ backup
    if (P.backupAtrasado()) add("backup", "atencao", P.ultimoBackup() === null ? "Você ainda não baixou nenhum backup" : "Faz mais de 30 dias do último backup", "Seus dados ficam só neste navegador. Use o botão \"Backup\" no topo para baixar uma cópia.", "");
    else add("backup-ok", "ok", "Backup recente", "", "");

    // ------------------------------------------------ diagnóstico do plano (usa os dados preenchidos)
    var ind = { mesesVermelho: 0, mediaSobra: 0, zeraXP: null, aposentadoria: null, patrimonioLiquido: null };
    try {
      var base = ref.ano * 12 + ref.mes - 1, soma = 0, i;
      for (i = 0; i < 12; i++) {
        var idx = base + i, r = P.calcMes(Math.floor(idx / 12), idx % 12 + 1);
        if (r.sobra < 0) ind.mesesVermelho++;
        soma += r.sobra;
      }
      ind.mediaSobra = soma / 12;
      if (ind.mesesVermelho >= 6) add("vermelho", "atencao", "O orçamento fecha no vermelho em " + ind.mesesVermelho + " dos próximos 12 meses", "Resultado médio dos próximos 12 meses a partir do mês analisado: " + (ind.mediaSobra < 0 ? "− " : "") + fmt(Math.abs(ind.mediaSobra)) + " por mês. Revise despesas, reajustes ou receitas.", "index.html");
      else if (ind.mesesVermelho > 0) add("vermelho", "info", "O orçamento fecha no vermelho em " + ind.mesesVermelho + " dos próximos 12 meses", "Resultado médio: " + (ind.mediaSobra < 0 ? "− " : "") + fmt(Math.abs(ind.mediaSobra)) + " por mês.", "index.html");
      else add("vermelho", "ok", "O orçamento fecha no azul nos próximos 12 meses", "Resultado médio: " + fmt(ind.mediaSobra) + " por mês.", "index.html");
      var S = P.serieAportes();
      if (S.primeiroZero) { ind.zeraXP = S.primeiroZero; add("zera-xp", "atencao", "O saldo da corretora zera em " + P.MESES[S.primeiroZero.mes - 1].toLowerCase() + "/" + S.primeiroZero.ano, "As despesas passam da receita e o dinheiro investido é consumido.", "aportes.html"); }
    } catch (e) { add("erro-diagnostico", "atencao", "Não consegui calcular o diagnóstico do orçamento", String(e && e.message || e), ""); }
    try {
      var ap = P.aposentadoria.calcular(d.aposentadoria);
      if (ap.erros && ap.erros.length) add("aposentadoria-erro", "atencao", "Premissas da aposentadoria com problema", ap.erros.join(" "), "aposentadoria.html");
      else {
        ind.aposentadoria = { pctMeta: ap.pctMeta, extra: ap.extra, falta: ap.falta, aposentar: d.aposentadoria.aposentar };
        add("aposentadoria", ap.falta > 0 ? "info" : "ok", "Aposentadoria aos " + d.aposentadoria.aposentar + ": " + Math.round(ap.pctMeta * 100) + "% da meta", ap.falta > 0 ? "Faltam " + fmt(ap.falta) + ", ou " + fmt(ap.extra) + " por mês de aporte extra até lá." : "A meta está coberta.", "aposentadoria.html");
      }
    } catch (e) { add("erro-aposentadoria", "atencao", "Não consegui calcular a aposentadoria", String(e && e.message || e), ""); }
    try { ind.patrimonioLiquido = P.patrimonioAtual().liquido; } catch (e) { /* sem patrimônio */ }

    var resumo = { atencao: 0, confirme: 0, info: 0, ok: 0 };
    itens.forEach(function (x) { resumo[x.nivel]++; });
    var ordem = { atencao: 0, confirme: 1, info: 2, ok: 3 };
    itens.sort(function (a, b) { return ordem[a.nivel] - ordem[b.nivel]; });
    return {
      itens: itens, resumo: resumo, indicadores: ind,
      areas: { feitas: areas.filter(function (a) { return a.feita; }).length, total: areas.length, lista: areas }
    };
  }

  /** Marca (ou desmarca) uma área como "já está certo", mesmo que ainda seja igual ao exemplo. Devolve false se o nome não existir. */
  function conferir(nome, sim) {
    var existe = verificar().areas.lista.some(function (a) { return a.nome === nome; });
    if (!existe) return false;
    var d = P.estado.dados;
    if (!d.conferidas) d.conferidas = {};
    if (sim === false) delete d.conferidas[nome]; else d.conferidas[nome] = true;
    P.salvar();
    return true;
  }

  P.conferencia = { verificar: verificar, grupoDe: grupoDe, conferir: conferir };
})(window.Plano);
