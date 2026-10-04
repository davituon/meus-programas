// Cópia automática dos dados em um arquivo escolhido por você (por exemplo, dentro da pasta do OneDrive).
// Usa a API de arquivos do navegador (Chrome e Edge no computador). Em outros navegadores, ou no celular, não existe e a opção some.
//
// Como funciona: você escolhe o arquivo uma vez; o navegador guarda a permissão. A cada alteração dos dados, o arquivo é regravado
// (com uma pequena espera para juntar várias alterações). Quando o navegador pede de novo a permissão (por exemplo, depois de fechar
// tudo), a tela mostra "Reativar" e um clique resolve. O arquivo é um backup comum: serve em "Restaurar backup".
//
// Este arquivo é igual nos dois projetos (planejador e Fundo de Missões). `ambiente` é opcional e serve para os testes.
(function (raiz) {
  "use strict";

  function bancoIndexedDB(nomeBanco) {
    function abrir() {
      return new Promise(function (ok, erro) {
        var req = raiz.indexedDB.open(nomeBanco, 1);
        req.onupgradeneeded = function () { req.result.createObjectStore("alcas"); };
        req.onsuccess = function () { ok(req.result); };
        req.onerror = function () { erro(req.error); };
      });
    }
    function transacao(modo, fn) {
      return abrir().then(function (db) {
        return new Promise(function (ok, erro) {
          var t = db.transaction("alcas", modo), r = fn(t.objectStore("alcas"));
          t.oncomplete = function () { db.close(); ok(r && r.result); };
          t.onerror = function () { db.close(); erro(t.error); };
        });
      });
    }
    return {
      obter: function (chave) { return transacao("readonly", function (s) { return s.get(chave); }); },
      guardar: function (chave, valor) { return transacao("readwrite", function (s) { return s.put(valor, chave); }); },
      apagar: function (chave) { return transacao("readwrite", function (s) { return s["delete"](chave); }); }
    };
  }

  /**
   * opcoes: { chave, nomeArquivo, obterTexto(): string, aoGravar(): void (opcional), atraso (ms; padrão 1500) }
   * ambiente (testes): { banco: { obter, guardar, apagar }, escolherArquivo(opcoes): Promise<alça> }
   */
  function criar(opcoes, ambiente) {
    ambiente = ambiente || {};
    var atraso = opcoes.atraso === undefined ? 1500 : opcoes.atraso, alca = null, carregada = false, timer = null, gravando = null, pendente = false;
    var ultimaGravacao = null, ultimoErro = "";
    var banco = ambiente.banco || (raiz.indexedDB ? bancoIndexedDB("copia-automatica") : null);
    var escolher = ambiente.escolherArquivo || (typeof raiz.showSaveFilePicker === "function" ? function (o) { return raiz.showSaveFilePicker(o); } : null);

    function suportado() { return !!(escolher && banco); }

    function carregar() {
      if (carregada || !banco) return Promise.resolve(alca);
      return Promise.resolve(banco.obter(opcoes.chave)).then(function (h) { alca = h || null; carregada = true; return alca; }, function () { carregada = true; return null; });
    }

    function permissao(pedir) {
      if (!alca) return Promise.resolve("desligada");
      var modo = { mode: "readwrite" };
      var consulta = typeof alca.queryPermission === "function" ? alca.queryPermission(modo) : Promise.resolve("granted");
      return Promise.resolve(consulta).then(function (p) {
        if (p === "granted" || !pedir || typeof alca.requestPermission !== "function") return p;
        return alca.requestPermission(modo);
      });
    }

    /** "nao-suportado" | "desligada" | "ativa" | "precisa-permissao" (+ nome do arquivo e última gravação). */
    function estado() {
      if (!suportado()) return Promise.resolve({ estado: "nao-suportado", nome: "", ultimaGravacao: null, erro: "" });
      return carregar().then(function () {
        if (!alca) return { estado: "desligada", nome: "", ultimaGravacao: ultimaGravacao, erro: ultimoErro };
        return permissao(false).then(function (p) { return { estado: p === "granted" ? "ativa" : "precisa-permissao", nome: alca.name || "", ultimaGravacao: ultimaGravacao, erro: ultimoErro }; });
      });
    }

    function escrever() {
      var texto = opcoes.obterTexto();
      return Promise.resolve(alca.createWritable()).then(function (w) {
        return Promise.resolve(w.write(texto)).then(function () { return w.close(); });
      }).then(function () { ultimaGravacao = Date.now(); ultimoErro = ""; if (opcoes.aoGravar) opcoes.aoGravar(); return { ok: true }; });
    }

    /** Grava agora, se houver arquivo e permissão. Nunca lança: devolve { ok, erro }. */
    function gravarAgora(pedirPermissao) {
      if (gravando) { pendente = true; return gravando; }
      gravando = carregar().then(function () {
        if (!alca) return { ok: false, erro: "nenhum arquivo escolhido" };
        return permissao(!!pedirPermissao).then(function (p) {
          if (p !== "granted") return { ok: false, erro: "sem permissão para gravar" };
          return escrever();
        });
      }).catch(function (e) { ultimoErro = e && e.message ? e.message : "falha ao gravar"; return { ok: false, erro: ultimoErro }; })
        .then(function (r) {
          gravando = null;
          if (pendente) { pendente = false; return gravarAgora(false); }
          return r;
        });
      return gravando;
    }

    /** Junta várias alterações seguidas numa gravação só. Barato de chamar a cada salvamento. */
    function agendar() {
      if (!suportado()) return;
      clearTimeout(timer);
      timer = setTimeout(function () { carregar().then(function () { if (alca) gravarAgora(false); }); }, atraso);
    }

    /** Pede ao usuário um arquivo (precisa vir de um clique), guarda a alça e já grava. */
    function escolherArquivo() {
      if (!suportado()) return Promise.resolve({ ok: false, erro: "este navegador não permite" });
      return Promise.resolve(escolher({ suggestedName: opcoes.nomeArquivo, types: [{ description: "Backup (JSON)", accept: { "application/json": [".json"] } }] })).then(function (h) {
        alca = h; carregada = true;
        return Promise.resolve(banco.guardar(opcoes.chave, h)).then(function () { return gravarAgora(true); });
      }, function (e) { return { ok: false, cancelado: !!(e && e.name === "AbortError"), erro: e && e.name === "AbortError" ? "cancelado" : (e && e.message) || "falha" }; });
    }

    /** Depois que o navegador pediu a permissão de novo: precisa vir de um clique. */
    function reativar() { return carregar().then(function () { return gravarAgora(true); }); }

    function desligar() {
      clearTimeout(timer); alca = null; carregada = true;
      return Promise.resolve(banco ? banco.apagar(opcoes.chave) : null).then(function () { return { ok: true }; }, function () { return { ok: true }; });
    }

    return { suportado: suportado, estado: estado, escolherArquivo: escolherArquivo, reativar: reativar, desligar: desligar, agendar: agendar, gravarAgora: gravarAgora };
  }

  /** Compartilhamento do aparelho (celular): devolve true se o navegador sabe compartilhar um arquivo. */
  function podeCompartilhar(arquivoDeTeste) {
    try { return !!(raiz.navigator && typeof raiz.navigator.share === "function" && typeof raiz.navigator.canShare === "function" && raiz.navigator.canShare({ files: [arquivoDeTeste] })); }
    catch (e) { return false; }
  }

  raiz.CopiaAutomatica = { criar: criar, podeCompartilhar: podeCompartilhar };
})(typeof window !== "undefined" ? window : this);
