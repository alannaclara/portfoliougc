/* =========================================================
   NÚCLEO DO PAINEL
   Ferramentas que todas as abas usam: navegação, janelas,
   avisos, datas, dinheiro, leitura segura do banco e CSV.
   ========================================================= */
(function () {
  "use strict";

  const P = (window.Painel = { abas: {}, sessao: null });

  /* ---------- Atalhos ---------- */
  P.$ = (sel, base) => (base || document).querySelector(sel);
  P.$$ = (sel, base) => Array.from((base || document).querySelectorAll(sel));
  P.esc = (t) => String(t == null ? "" : t).replace(/[&<>"']/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c]));
  P.icone = (nome, classe) => `<svg class="ico ${classe || ""}" aria-hidden="true"><use href="#i-${nome}"/></svg>`;
  P.texto = (v) => (v == null ? "" : String(v));

  /* ---------- Datas (sempre no horário do seu computador) ---------- */
  const doisDigitos = (n) => String(n).padStart(2, "0");
  P.isoData = (d) => `${d.getFullYear()}-${doisDigitos(d.getMonth() + 1)}-${doisDigitos(d.getDate())}`;
  P.hoje = () => P.isoData(new Date());
  P.paraData = (iso) => {
    if (!iso) return null;
    const [a, m, d] = String(iso).slice(0, 10).split("-").map(Number);
    if (!a || !m || !d) return null;
    return new Date(a, m - 1, d);
  };
  P.dataBR = (iso) => {
    const d = P.paraData(iso);
    return d ? d.toLocaleDateString("pt-BR") : "";
  };
  // Quantos dias faltam até a data (negativo = já passou)
  P.diasAte = (iso) => {
    const d = P.paraData(iso);
    if (!d) return null;
    return Math.round((d - P.paraData(P.hoje())) / 86400000);
  };
  P.plural = (n, um, varios) => `${n} ${n === 1 ? um : varios}`;

  /* ---------- Números e dinheiro (nunca mostra NaN) ---------- */
  P.num = (v) => { const n = Number(v); return Number.isFinite(n) ? n : 0; };
  P.moeda = (v) => P.num(v).toLocaleString("pt-BR", { style: "currency", currency: "BRL" });
  P.inteiro = (v) => Math.round(P.num(v)).toLocaleString("pt-BR");
  P.divide = (a, b) => (P.num(b) > 0 ? P.num(a) / P.num(b) : 0);

  /* ---------- Avisos rápidos ---------- */
  P.toast = (msg, tipo) => {
    const el = document.createElement("div");
    el.className = "toast" + (tipo === "erro" ? " toast-erro" : "");
    el.textContent = msg;
    P.$("#toasts").appendChild(el);
    setTimeout(() => el.remove(), tipo === "erro" ? 6000 : 3200);
  };

  // Aviso fixo dentro de uma aba (ex.: tabela que falta no banco)
  P.avisar = (container, mensagem) => {
    if (!container || !mensagem) return;
    const jaTem = P.$$(".aviso-banco", container).some((a) => a.dataset.msg === mensagem);
    if (jaTem) return;
    const div = document.createElement("div");
    div.className = "aviso-banco";
    div.setAttribute("role", "alert");
    div.dataset.msg = mensagem;
    div.innerHTML = `${P.icone("alerta")}<div>${P.esc(mensagem)}</div>`;
    container.prepend(div);
  };
  P.limparAvisos = (container) => P.$$(".aviso-banco", container).forEach((a) => a.remove());

  // Traduz qualquer erro do banco para uma frase simples
  P.explicarErro = (erro, tabela) => {
    const codigo = String((erro && erro.code) || "");
    const msg = String((erro && erro.message) || erro || "").toLowerCase();
    if (codigo === "42P01" || codigo === "PGRST205" || msg.includes("does not exist") && msg.includes("relation") || msg.includes("could not find the table")) {
      return `A tabela "${tabela}" não existe no banco ainda. Rode o arquivo banco.sql no SQL Editor do Supabase.`;
    }
    if (codigo === "42703" || codigo === "PGRST204" || msg.includes("column")) {
      return `Falta um campo na tabela "${tabela}". Rode o arquivo banco.sql de novo no Supabase para completar.`;
    }
    if (codigo === "42501" || msg.includes("permission") || msg.includes("row-level security")) {
      return `O banco não deixou mexer em "${tabela}". Confira se você entrou com o seu e-mail e se o banco.sql foi rodado inteiro.`;
    }
    if (codigo === "23514" || msg.includes("check constraint")) {
      return `Algum campo tem um valor que o banco não aceita em "${tabela}". Confira as opções escolhidas.`;
    }
    if (msg.includes("jwt") || msg.includes("token")) {
      return "Sua sessão expirou. Saia e entre de novo.";
    }
    if (msg.includes("fetch") || msg.includes("network") || msg.includes("failed")) {
      return "Sem conexão com o banco agora. Confira sua internet.";
    }
    return `Não consegui falar com a tabela "${tabela}" agora. Tente de novo em instantes.`;
  };

  /* ---------- Banco: sempre com proteção, nunca derruba o painel ---------- */
  P.ler = async (tabela, ajustar) => {
    try {
      let consulta = banco.from(tabela).select("*");
      if (ajustar) consulta = ajustar(consulta);
      const { data, error } = await consulta;
      if (error) return { dados: [], erro: P.explicarErro(error, tabela) };
      return { dados: Array.isArray(data) ? data : [], erro: null };
    } catch (e) {
      return { dados: [], erro: P.explicarErro(e, tabela) };
    }
  };

  // Igual ao P.ler, mas se a ordenação ou o filtro usar um campo que falta,
  // lê a tabela sem eles e devolve o aviso, em vez de voltar vazio.
  P.lerSeguro = async (tabela, ajustar) => {
    const r = await P.ler(tabela, ajustar);
    if (r.erro && ajustar && r.erro.includes("Falta um campo")) {
      const simples = await P.ler(tabela);
      return { dados: simples.dados, erro: simples.erro || r.erro };
    }
    return r;
  };

  // acao: "inserir", "atualizar" ou "apagar". Devolve a mensagem de erro, ou null se deu certo.
  P.gravar = async (tabela, acao, valores, id) => {
    try {
      let resposta;
      if (acao === "inserir") resposta = await banco.from(tabela).insert(valores);
      else if (acao === "atualizar") resposta = await banco.from(tabela).update(valores).eq("id", id);
      else if (acao === "apagar") resposta = await banco.from(tabela).delete().eq("id", id);
      if (resposta && resposta.error) return P.explicarErro(resposta.error, tabela);
      return null;
    } catch (e) {
      return P.explicarErro(e, tabela);
    }
  };

  // Se a tabela veio sem algum campo esperado, avisa (e o resto segue funcionando)
  P.conferirCampos = (container, tabela, dados, esperados) => {
    if (!dados.length) return;
    const faltam = esperados.filter((c) => !(c in dados[0]));
    if (faltam.length) {
      P.avisar(container, `A tabela "${tabela}" está sem ${faltam.length === 1 ? "o campo" : "os campos"} ${faltam.join(", ")}. Rode o banco.sql de novo no Supabase. O resto continua funcionando.`);
    }
  };

  /* ---------- Pílulas coloridas ---------- */
  P.pilula = (texto, cor) => `<span class="pilula p-${cor}">${P.esc(texto)}</span>`;
  P.pilulaExemplo = (linha) => (linha && linha.exemplo ? ` <span class="pilula p-exemplo">exemplo</span>` : "");

  /* ---------- Janela de formulário (usada por todas as abas) ----------
     campos: [{ nome, rotulo, tipo, opcoes, lista, obrigatorio, largo, ajuda, passo }]
     tipos: texto, email, tel, url, numero, data, escolha, texto-longo, marcar */
  const janelaForm = () => P.$("#janela-form");
  let configForm = null;

  P.formulario = (config) => {
    configForm = config;
    const valores = config.valores || {};
    P.$("#janela-form-titulo").textContent = config.titulo || "Editar";
    P.$("#janela-form-erro").hidden = true;
    P.$("#janela-form-salvar").textContent = config.textoSalvar || "Salvar";
    P.$("#janela-form-apagar").hidden = !config.aoApagar;
    P.$("#janela-form-campos").innerHTML = config.campos.map((c, i) => {
      const id = `campo-${i}`;
      const v = valores[c.nome];
      const obrig = c.obrigatorio ? " required" : "";
      const largo = c.largo || c.tipo === "texto-longo" ? " largo" : "";
      const ajuda = c.ajuda ? `<span class="campo-ajuda">${P.esc(c.ajuda)}</span>` : "";
      if (c.tipo === "marcar") {
        return `<label class="campo campo-marcar${largo}" for="${id}"><input id="${id}" name="${c.nome}" type="checkbox"${v ? " checked" : ""}>${P.esc(c.rotulo)}</label>`;
      }
      let entrada;
      if (c.tipo === "escolha") {
        entrada = `<select id="${id}" name="${c.nome}"${obrig}>${c.opcoes.map(([valor, texto]) =>
          `<option value="${P.esc(valor)}"${String(v) === String(valor) ? " selected" : ""}>${P.esc(texto)}</option>`).join("")}</select>`;
      } else if (c.tipo === "texto-longo") {
        entrada = `<textarea id="${id}" name="${c.nome}"${obrig}>${P.esc(v)}</textarea>`;
      } else {
        const tipos = { texto: "text", email: "email", tel: "tel", url: "url", numero: "number", data: "date" };
        const lista = c.lista ? ` list="${id}-lista"` : "";
        const passo = c.tipo === "numero" ? ` step="${c.passo || "1"}" min="0" inputmode="decimal"` : "";
        const valor = v == null ? "" : String(c.tipo === "data" ? String(v).slice(0, 10) : v);
        entrada = `<input id="${id}" name="${c.nome}" type="${tipos[c.tipo] || "text"}" value="${P.esc(valor)}"${lista}${passo}${obrig}>`;
        if (c.lista) entrada += `<datalist id="${id}-lista">${c.lista.map((o) => `<option value="${P.esc(o)}">`).join("")}</datalist>`;
      }
      return `<div class="campo${largo}"><label for="${id}">${P.esc(c.rotulo)}${c.obrigatorio ? " *" : ""}</label>${entrada}${ajuda}</div>`;
    }).join("");
    const j = janelaForm();
    if (typeof j.showModal === "function") j.showModal(); else j.setAttribute("open", "");
    const primeiro = P.$("input:not([type=checkbox]), select, textarea", j);
    if (primeiro) primeiro.focus();
  };

  function lerCamposDoForm() {
    const saida = {};
    configForm.campos.forEach((c, i) => {
      const el = P.$(`#campo-${i}`);
      if (!el) return;
      if (c.tipo === "marcar") saida[c.nome] = el.checked;
      else if (c.tipo === "numero") saida[c.nome] = el.value === "" ? 0 : P.num(el.value.replace(",", "."));
      else if (c.tipo === "data") saida[c.nome] = el.value || null;
      else saida[c.nome] = el.value.trim();
    });
    return saida;
  }

  function erroNoForm(msg) {
    const el = P.$("#janela-form-erro");
    el.textContent = msg;
    el.hidden = !msg;
  }

  P.fecharFormulario = () => { const j = janelaForm(); if (j.open) j.close(); configForm = null; };

  function prepararJanelas() {
    P.$("#form-janela").addEventListener("submit", async (e) => {
      e.preventDefault();
      if (!configForm) return;
      const valores = lerCamposDoForm();
      const faltando = configForm.campos.find((c) => c.obrigatorio && c.tipo !== "marcar" && (valores[c.nome] === "" || valores[c.nome] == null));
      if (faltando) { erroNoForm(`Preencha o campo "${faltando.rotulo}".`); return; }
      const botao = P.$("#janela-form-salvar");
      botao.disabled = true;
      const erro = await configForm.aoSalvar(valores);
      botao.disabled = false;
      if (erro) { erroNoForm(erro); return; }
      P.fecharFormulario();
    });
    P.$("#janela-form-apagar").addEventListener("click", async () => {
      if (!configForm || !configForm.aoApagar) return;
      if (!confirm("Apagar de vez? Isso não tem volta.")) return;
      const erro = await configForm.aoApagar();
      if (erro) { erroNoForm(erro); return; }
      P.fecharFormulario();
    });
    P.$$("dialog.janela").forEach((j) => {
      P.$$("[data-fechar]", j).forEach((b) => b.addEventListener("click", () => j.close()));
      j.addEventListener("click", (e) => { if (e.target === j) j.close(); }); // clique fora fecha
    });
  }

  // Janela só de leitura (dia do calendário, ficha de referência)
  P.ver = (titulo, html) => {
    P.$("#janela-ver-titulo").textContent = titulo;
    const corpo = P.$("#janela-ver-corpo");
    corpo.innerHTML = html;
    const j = P.$("#janela-ver");
    if (!j.open) { if (typeof j.showModal === "function") j.showModal(); else j.setAttribute("open", ""); }
    return corpo;
  };
  P.fecharVer = () => { const j = P.$("#janela-ver"); if (j.open) j.close(); };

  /* ---------- Baixar CSV que abre certinho no Excel (com acento) ---------- */
  P.baixarCSV = (nomeArquivo, cabecalho, linhas) => {
    const celula = (v) => {
      const t = String(v == null ? "" : v);
      return /[";\n\r]/.test(t) ? `"${t.replace(/"/g, '""')}"` : t;
    };
    const conteudo = [cabecalho, ...linhas].map((l) => l.map(celula).join(";")).join("\r\n");
    const blob = new Blob(["﻿" + conteudo], { type: "text/csv;charset=utf-8" });
    const a = document.createElement("a");
    a.href = URL.createObjectURL(blob);
    a.download = `${nomeArquivo}-${P.hoje()}.csv`;
    document.body.appendChild(a);
    a.click();
    setTimeout(() => { URL.revokeObjectURL(a.href); a.remove(); }, 500);
  };

  /* ---------- Links úteis ---------- */
  // Quando a célula tem mais de um número ("(16) 99772-4745 (16) 99606-4655"), usa o primeiro
  P.primeiroTelefone = (texto) => {
    const t = String(texto || "");
    const achados = t.match(/\(?\d{2}\)?[\s.-]?9?\d{4}[\s.-]?\d{4}/g);
    if (achados && achados.length) return achados[0].trim();
    const so = t.replace(/\D/g, "");
    return so.length >= 10 ? so : "";
  };
  P.linkWhats = (telefone) => {
    let d = P.primeiroTelefone(telefone).replace(/\D/g, "");
    if (d.length < 10) return "";
    if (d.length > 13) d = d.slice(0, 13);
    if (d.length <= 11) d = "55" + d;
    return `https://wa.me/${d}`;
  };
  P.linkInstagram = (arroba) => {
    const u = String(arroba || "").trim().replace(/^@/, "").replace(/^https?:\/\/(www\.)?instagram\.com\//i, "").replace(/\/.*$/, "");
    return u ? `https://www.instagram.com/${encodeURIComponent(u)}/` : "";
  };
  P.arroba = (v) => { const u = String(v || "").trim().replace(/^https?:\/\/(www\.)?instagram\.com\//i, "").replace(/\/.*$/, "").replace(/^@/, ""); return u ? "@" + u : ""; };

  /* ---------- Navegação entre abas ---------- */
  const TITULOS = {
    portfolio: "Portfólio",
    marcas: "Marcas",
    prospeccao: "Prospecção",
    roteiro: "Roteiro",
    transcricao: "Transcrições",
    calendario: "Calendário",
    campanhas: "Campanhas",
    checklist: "Checklist portfólio",
    automacoes: "Automações",
    visaogeral: "Visão geral do Instagram"
  };

  async function irPara(aba) {
    if (!TITULOS[aba]) aba = "portfolio";
    P.$$(".aba").forEach((s) => { s.hidden = s.id !== `aba-${aba}`; });
    P.$$(".menu-item").forEach((m) => {
      if (m.dataset.aba === aba) m.setAttribute("aria-current", "page"); else m.removeAttribute("aria-current");
    });
    P.$("#titulo-aba").textContent = TITULOS[aba];
    P.$("#titulo-celular").textContent = TITULOS[aba];
    document.title = `${TITULOS[aba]} | Painel Alanna Clara`;
    fecharGaveta();
    const secao = P.$(`#aba-${aba}`);
    const modulo = P.abas[aba];
    if (!modulo) {
      P.avisar(secao, "Esta aba não carregou. Recarregue a página.");
      return;
    }
    try {
      if (!modulo.iniciada) {
        modulo.iniciada = true;
        await modulo.iniciar(secao);
      } else if (modulo.aoMostrar) {
        await modulo.aoMostrar(secao);
      }
    } catch (e) {
      console.error(e);
      P.avisar(secao, "Alguma coisa desta aba não carregou direito. O resto do painel continua funcionando.");
    }
  }

  /* ---------- Gaveta do menu no celular ---------- */
  function abrirGaveta() {
    P.$("#lateral").classList.add("aberta");
    P.$("#fundo-gaveta").classList.add("aberto");
    P.$("#abrir-menu").setAttribute("aria-expanded", "true");
  }
  function fecharGaveta() {
    P.$("#lateral").classList.remove("aberta");
    P.$("#fundo-gaveta").classList.remove("aberto");
    P.$("#abrir-menu").setAttribute("aria-expanded", "false");
  }

  /* ---------- Começo de tudo (chamado depois de conferir a sessão) ---------- */
  P.iniciar = (sessao) => {
    P.sessao = sessao;
    P.$("#meu-email").textContent = (sessao.user && sessao.user.email) || "";
    prepararJanelas();

    P.$("#abrir-menu").addEventListener("click", abrirGaveta);
    P.$("#fundo-gaveta").addEventListener("click", fecharGaveta);
    document.addEventListener("keydown", (e) => { if (e.key === "Escape") fecharGaveta(); });

    P.$("#sair").addEventListener("click", async () => {
      try { await banco.auth.signOut(); } catch (e) { /* sai mesmo assim */ }
      location.replace("../login/");
    });
    banco.auth.onAuthStateChange((evento) => {
      if (evento === "SIGNED_OUT") location.replace("../login/");
    });

    // Rede de segurança: um erro numa parte nunca deixa o painel em branco
    window.addEventListener("error", () => P.toast("Uma parte desta tela deu erro, mas o resto do painel continua funcionando.", "erro"));
    window.addEventListener("unhandledrejection", () => P.toast("Uma parte desta tela deu erro, mas o resto do painel continua funcionando.", "erro"));

    window.addEventListener("hashchange", () => irPara(location.hash.slice(1)));
    document.body.hidden = false;
    irPara(location.hash.slice(1) || "portfolio");
  };
})();
