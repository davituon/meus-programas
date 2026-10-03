// Importação da "Posição detalhada" exportada pela XP (.xlsx). Roda no navegador (sem enviar nada a servidor)
// e também em Node (para os testes). Duas etapas:
//   1. lerXlsx(buffer): abre o .xlsx (que é um zip) e devolve a planilha como uma grade de textos;
//   2. interpretarCarteira(grade): reconhece cabeçalho, seções, grupos e ativos, e confere os totais.
// O número da conta e os dados do assessor que aparecem no arquivo NÃO são guardados.
(function (raiz) {
  "use strict";

  // ---------------------------------------------------------------- utilidades
  function semAcento(s) {
    return String(s).normalize("NFD").replace(/[̀-ͯ]/g, "").toLowerCase().replace(/\s+/g, " ").trim();
  }

  /** "R$ 1.532,40" -> 1532.4 | "1,98%" -> 1.98 | "-", "Indefinido", vazio -> null. */
  function numero(t) {
    if (t === null || t === undefined) return null;
    var s = String(t).trim();
    if (!s || s === "-" || /indefinid/i.test(s)) return null;
    var n = parseFloat(s.replace(/R\$|%/g, "").replace(/\s/g, "").replace(/\./g, "").replace(",", "."));
    return isNaN(n) ? null : n;
  }

  // ---------------------------------------------------------------- etapa 1: .xlsx -> grade
  function u16(v, o) { return v[o] | (v[o + 1] << 8); }
  function u32(v, o) { return (v[o] | (v[o + 1] << 8) | (v[o + 2] << 16) | (v[o + 3] << 24)) >>> 0; }

  async function inflar(bytes) {
    var fluxo = new Blob([bytes]).stream().pipeThrough(new DecompressionStream("deflate-raw"));
    return new Uint8Array(await new Response(fluxo).arrayBuffer());
  }

  function abrirZip(buffer) {
    var v = new Uint8Array(buffer), fim = -1, i;
    for (i = v.length - 22; i >= Math.max(0, v.length - 65557); i--) {
      if (u32(v, i) === 0x06054b50) { fim = i; break; }
    }
    if (fim < 0) throw new Error("O arquivo não parece ser um .xlsx (não é um zip válido).");
    var total = u16(v, fim + 10), p = u32(v, fim + 16), mapa = {}, k;
    for (k = 0; k < total && u32(v, p) === 0x02014b50; k++) {
      var nomeLen = u16(v, p + 28), extraLen = u16(v, p + 30), comLen = u16(v, p + 32);
      mapa[new TextDecoder().decode(v.subarray(p + 46, p + 46 + nomeLen))] = { metodo: u16(v, p + 10), comp: u32(v, p + 20), local: u32(v, p + 42) };
      p += 46 + nomeLen + extraLen + comLen;
    }
    return { v: v, mapa: mapa };
  }

  async function lerEntrada(zip, nome) {
    var e = zip.mapa[nome];
    if (!e) return null;
    var l = e.local, ini = l + 30 + u16(zip.v, l + 26) + u16(zip.v, l + 28), bytes = zip.v.subarray(ini, ini + e.comp);
    if (e.metodo === 8) bytes = await inflar(bytes);
    else if (e.metodo !== 0) throw new Error("Compressão do .xlsx não suportada.");
    return new TextDecoder("utf-8").decode(bytes);
  }

  function desescapar(s) {
    return s.replace(/&(#x?[0-9a-fA-F]+|amp|lt|gt|quot|apos);/g, function (m, e) {
      if (e === "amp") return "&";
      if (e === "lt") return "<";
      if (e === "gt") return ">";
      if (e === "quot") return "\"";
      if (e === "apos") return "'";
      return String.fromCodePoint(e[1] === "x" || e[1] === "X" ? parseInt(e.slice(2), 16) : parseInt(e.slice(1), 10));
    });
  }

  function textosCompartilhados(xml) {
    var out = [], m, re = /<si>([\s\S]*?)<\/si>/g;
    while ((m = re.exec(xml))) {
      var t = "", n, r2 = /<t[^>]*>([\s\S]*?)<\/t>/g;
      while ((n = r2.exec(m[1]))) t += n[1];
      out.push(desescapar(t));
    }
    return out;
  }

  function colunaParaIndice(letras) {
    var n = 0, i;
    for (i = 0; i < letras.length; i++) n = n * 26 + (letras.charCodeAt(i) - 64);
    return n - 1;
  }

  /** Lê o primeiro caderno do .xlsx e devolve uma grade: array de linhas, cada linha um array de textos. */
  async function lerXlsx(buffer) {
    var zip = abrirZip(buffer);
    var nomes = Object.keys(zip.mapa).filter(function (n) { return /^xl\/worksheets\/sheet\d+\.xml$/.test(n); }).sort();
    if (!nomes.length) throw new Error("Não encontrei nenhuma planilha dentro do arquivo.");
    var compart = textosCompartilhados((await lerEntrada(zip, "xl/sharedStrings.xml")) || "");
    var xml = await lerEntrada(zip, nomes[0]);
    var grade = [], re = /<c\s+([^>]*?)(?:\/>|>([\s\S]*?)<\/c>)/g, m;
    while ((m = re.exec(xml))) {
      var ref = /\br="([A-Z]+)(\d+)"/.exec(m[1]);
      if (!ref) continue;
      var tipo = (/\bt="(\w+)"/.exec(m[1]) || [])[1], corpo = m[2] || "", valor = "";
      var v = /<v>([\s\S]*?)<\/v>/.exec(corpo);
      if (tipo === "s" && v) valor = compart[Number(v[1])] || "";
      else if (tipo === "inlineStr") { var t = /<t[^>]*>([\s\S]*?)<\/t>/.exec(corpo); valor = t ? desescapar(t[1]) : ""; }
      else if (v) valor = desescapar(v[1]);
      var r = Number(ref[2]) - 1;
      (grade[r] = grade[r] || [])[colunaParaIndice(ref[1])] = valor;
    }
    return grade;
  }

  // ---------------------------------------------------------------- etapa 2: grade -> carteira
  var CHAVES = {
    "saldo": "saldo", "valor total": "saldo", "% alocacao": "pctAloc", "rentabilidade": "rentab",
    "preco medio": "precoMedio", "preco medio (abertura)": "precoMedio",
    "ultimo preco (r$)": "ultimoPreco", "ultima cotacao": "ultimoPreco", "valor atual (pu)": "ultimoPreco",
    "qtd. total": "qtd", "quantidade de cotas": "qtd", "quantidade": "qtd",
    "valor aplicado": "aplicado", "saldo liquido": "saldoLiquido", "disponivel": "disponivel",
    "vencimento": "vencimento", "data de vencimento": "vencimento",
    "provisionado": "qtd", "valor provisionado bruto": "bruto", "valor provisionado liquido": "liquido",
    "evento": "evento", "previsao pagamento": "pagamento"
  };
  var TEXTO = { vencimento: 1, evento: 1, pagamento: 1 };

  function interpretarCarteira(grade) {
    var L = grade.map(function (linha) {
      var l = [], j;
      for (j = 0; j < 7; j++) l.push(linha && linha[j] !== undefined && linha[j] !== null ? String(linha[j]).trim() : "");
      return l;
    });
    var res = { geradoEm: "", patrimonio: null, investido: null, disponivel: null, projetado: null, secoes: [], proventos: [], provTotais: [], custodia: [], avisos: [] };

    var iRot = -1, i;
    for (i = 0; i < L.length && iRot < 0; i++) if (L[i].some(function (c) { return semAcento(c) === "total investido"; })) iRot = i;
    if (iRot >= 0) {
      L[iRot].forEach(function (c, j) {
        var k = semAcento(c), v = (L[iRot + 1] || [])[j];
        if (k.indexOf("seu patrimonio") >= 0) res.patrimonio = numero(v);
        else if (k === "total investido") res.investido = numero(v);
        else if (k === "saldo disponivel") res.disponivel = numero(v);
        else if (k === "saldo projetado") res.projetado = numero(v);
      });
    }
    for (i = 0; i < Math.min(L.length, 4); i++) {
      L[i].forEach(function (c) { var m = /(\d{2}\/\d{2}\/\d{4}),?\s*(\d{2}:\d{2})/.exec(c); if (m) res.geradoEm = m[1] + " " + m[2]; });
    }

    var modo = "posicao", secao = null, grupo = null, mapaCol = null;
    for (i = iRot >= 0 ? iRot + 2 : 0; i < L.length; i++) {
      var l = L[i], a = l[0], g = l[6];
      if (!l.some(function (c) { return c; })) continue;
      var soA = a && l.slice(1).every(function (c) { return !c; });
      var soTotal = a && l.slice(1, 6).every(function (c) { return !c; }) && /R\$/.test(g);
      var gm = /^(\d+(?:,\d+)?)%\s*\|\s*(.+)$/.exec(a);

      if (soA && semAcento(a).indexOf("dividendos") === 0) { modo = "distribuicoes"; secao = null; grupo = null; continue; }
      if (soA && semAcento(a).indexOf("custodia remunerada") === 0) { modo = "custodia"; secao = null; grupo = null; continue; }
      if (soA) continue; // subtítulos soltos, como "Proventos"

      if (soTotal) {
        secao = { nome: a, total: numero(g), grupos: [] };
        if (modo === "posicao") res.secoes.push(secao);
        else if (modo === "distribuicoes") res.provTotais.push({ secao: a, total: numero(g) });
        grupo = null;
        continue;
      }
      if (gm) {
        grupo = { nome: gm[2].trim(), pctGrupo: numero(gm[1]), secao: secao ? secao.nome : "", itens: [] };
        mapaCol = l.map(function (c, j) { return j === 0 ? null : (CHAVES[semAcento(c)] || null); });
        if (modo === "posicao" && secao) secao.grupos.push(grupo);
        else if (modo === "distribuicoes") res.proventos.push(grupo);
        else if (modo === "custodia") res.custodia.push(grupo);
        continue;
      }
      if (grupo && mapaCol) {
        var item = { nome: a };
        mapaCol.forEach(function (chave, j) { if (chave) item[chave] = TEXTO[chave] ? l[j] : numero(l[j]); });
        grupo.itens.push(item);
      }
    }

    if (!res.secoes.length) throw new Error("Não reconheci o formato do arquivo. Use a \"Posição detalhada\" exportada pela XP.");

    // conferências: o que o arquivo informa precisa bater com o que foi lido
    var somaSecoes = 0, somaProv = 0;
    res.secoes.forEach(function (s) {
      var soma = 0;
      s.grupos.forEach(function (gr) { gr.itens.forEach(function (it) { soma += it.saldo || 0; }); });
      s.somaItens = soma;
      somaSecoes += s.total || 0;
      if (s.total !== null && Math.abs(soma - s.total) > 0.05) res.avisos.push("A soma dos ativos de \"" + s.nome + "\" não bate com o total informado no arquivo.");
    });
    res.provTotais.forEach(function (p) { somaProv += p.total || 0; });
    if (res.investido !== null && Math.abs(somaSecoes + somaProv - res.investido) > 0.05) res.avisos.push("As seções somadas (com proventos) não batem com o \"Total investido\" do arquivo.");
    return res;
  }

  /** Posições reunidas por classe (para o gráfico). A custódia remunerada não entra: já está dentro de Ações. */
  function classes(carteira) {
    var out = [], total = 0;
    carteira.secoes.forEach(function (s) {
      s.grupos.forEach(function (g) {
        var saldo = g.itens.reduce(function (t, it) { return t + (it.saldo || 0); }, 0);
        out.push({ nome: s.nome + " · " + g.nome, saldo: saldo });
        total += saldo;
      });
    });
    out.forEach(function (c) { c.pct = total > 0 ? c.saldo / total : 0; });
    return out.sort(function (x, y) { return y.saldo - x.saldo; });
  }

  var API = { lerXlsx: lerXlsx, interpretarCarteira: interpretarCarteira, classes: classes, numero: numero, semAcento: semAcento };
  if (typeof module !== "undefined" && module.exports) module.exports = API;
  else raiz.Importar = API;
})(typeof window !== "undefined" ? window : globalThis);
