/* =========================================================
   ABA MARCAS
   Sua base de contatos de empresas, em formato de planilha.
   O formulário do site cai aqui como Lead.
   ========================================================= */
(function () {
  "use strict";
  const P = window.Painel;

  // Situações, na ordem do funil, cada uma com sua cor
  const SITUACOES = [
    ["lead", "Lead", "ciano"],
    ["conversando", "Conversando", "amarelo"],
    ["cliente", "Cliente", "verde"],
    ["parada", "Parada", "cinza"]
  ];
  const nomeSituacao = (s) => (SITUACOES.find((x) => x[0] === s) || [s, s || "Sem situação"])[1];
  const corSituacao = (s) => (SITUACOES.find((x) => x[0] === s) || [0, 0, "cinza"])[2];

  let secao = null;
  let marcas = [];
  let filtro = "todas";
  let busca = "";

  P.abas.marcas = {
    async iniciar(s) {
      secao = s;
      s.innerHTML = `
        <div class="avisos"></div>
        <div class="ferramentas">
          <label class="busca"><span class="sr">Buscar</span>${P.icone("busca", "ico-p")}<input type="search" id="mc-busca" placeholder="Buscar por nome, @ ou e-mail"></label>
          <div class="filtros" id="mc-filtros" role="group" aria-label="Filtrar por situação"></div>
          <div class="grupo-botoes empurra">
            <button class="botao" type="button" id="mc-importar">${P.icone("subir", "ico-p")}Importar planilha</button>
            <button class="botao" type="button" id="mc-csv">${P.icone("baixar", "ico-p")}Baixar CSV</button>
            <button class="botao botao-principal" type="button" id="mc-novo">${P.icone("mais", "ico-p")}Adicionar marca</button>
          </div>
          <input type="file" id="mc-arquivo" accept=".csv,.txt,text/csv" hidden>
        </div>
        <div class="cartao">
          <div class="tabela-rolagem">
            <table class="tabela">
              <thead><tr><th>Marca</th><th>Instagram</th><th>E-mail</th><th>Telefone</th><th>Situação</th><th>Observação</th><th>Último contato</th><th class="acoes"><span class="sr">Ações</span></th></tr></thead>
              <tbody id="mc-lista"><tr><td colspan="8" class="carregando">Carregando...</td></tr></tbody>
            </table>
          </div>
        </div>
        <p class="mudo pequeno" id="mc-rodape" style="margin-top:8px"></p>`;
      P.$("#mc-busca", s).addEventListener("input", (e) => { busca = e.target.value.trim().toLowerCase(); desenhar(); });
      P.$("#mc-filtros", s).addEventListener("click", (e) => {
        const b = e.target.closest("[data-filtro]");
        if (!b) return;
        filtro = b.dataset.filtro;
        desenhar();
      });
      P.$("#mc-novo", s).addEventListener("click", () => abrirForm(null));
      P.$("#mc-csv", s).addEventListener("click", baixar);
      P.$("#mc-importar", s).addEventListener("click", () => P.$("#mc-arquivo", s).click());
      P.$("#mc-arquivo", s).addEventListener("change", aoEscolherArquivo);
      P.$("#mc-lista", s).addEventListener("click", (e) => {
        if (e.target.closest("a")) return; // links (WhatsApp, Instagram, e-mail) abrem sozinhos
        const tr = e.target.closest("tr[data-id]");
        if (!tr) return;
        const marca = marcas.find((m) => String(m.id) === tr.dataset.id);
        if (marca) abrirForm(marca);
      });
      P.$("#mc-lista", s).addEventListener("keydown", (e) => {
        if (e.key !== "Enter" || e.target.closest("a")) return;
        const tr = e.target.closest("tr[data-id]");
        if (tr) tr.click();
      });
      await carregar();
    },
    async aoMostrar() { await carregar(); }
  };

  async function carregar() {
    const avisos = P.$(".avisos", secao);
    P.limparAvisos(avisos);
    const r = await P.lerSeguro("marcas", (q) => q.order("criado_em", { ascending: false }));
    if (r.erro) P.avisar(avisos, r.erro);
    P.conferirCampos(avisos, "marcas", r.dados, ["nome", "instagram", "email", "telefone", "situacao", "obs", "ultimo_contato"]);
    marcas = r.dados;
    desenhar();
  }

  function filtradas() {
    return marcas.filter((m) => {
      if (filtro !== "todas" && m.situacao !== filtro) return false;
      if (!busca) return true;
      return [m.nome, m.instagram, m.email].some((c) => String(c || "").toLowerCase().includes(busca));
    });
  }

  function desenhar() {
    // Filtros com a contagem de cada situação
    const conta = (s) => marcas.filter((m) => m.situacao === s).length;
    P.$("#mc-filtros", secao).innerHTML =
      `<button class="filtro" type="button" data-filtro="todas" aria-pressed="${filtro === "todas"}">Todas<span class="qtd">${marcas.length}</span></button>` +
      SITUACOES.map(([valor, nome]) => `<button class="filtro" type="button" data-filtro="${valor}" aria-pressed="${filtro === valor}">${nome}<span class="qtd">${conta(valor)}</span></button>`).join("");

    const lista = filtradas();
    const corpo = P.$("#mc-lista", secao);
    P.$("#mc-rodape", secao).textContent = marcas.length ? `Mostrando ${P.plural(lista.length, "marca", "marcas")} de ${marcas.length}. Clique numa linha para editar.` : "";
    if (!marcas.length) {
      corpo.innerHTML = `<tr><td colspan="8" class="vazio">Nenhuma marca ainda. Quando alguém mandar mensagem pelo formulário do site, ela aparece aqui como Lead.</td></tr>`;
      return;
    }
    if (!lista.length) {
      corpo.innerHTML = `<tr><td colspan="8" class="vazio">Nenhuma marca com essa busca ou filtro.</td></tr>`;
      return;
    }
    corpo.innerHTML = lista.map((m) => {
      const insta = P.arroba(m.instagram);
      const linkInsta = P.linkInstagram(m.instagram);
      const whats = P.linkWhats(m.telefone);
      return `<tr class="clicavel" data-id="${P.esc(m.id)}" tabindex="0">
        <td><b>${P.esc(m.nome || "Sem nome")}</b>${P.pilulaExemplo(m)}${m.origem === "site" ? ` <span class="pilula p-pessego" title="Chegou pelo formulário do site">site</span>` : ""}</td>
        <td class="curta">${linkInsta ? `<a class="link-tabela" href="${linkInsta}" target="_blank" rel="noopener">${P.esc(insta)}</a>` : ""}</td>
        <td class="curta">${m.email ? `<a class="link-tabela" href="mailto:${P.esc(m.email)}">${P.esc(m.email)}</a>` : ""}</td>
        <td class="curta">${P.esc(m.telefone)}</td>
        <td>${P.pilula(nomeSituacao(m.situacao), corSituacao(m.situacao))}</td>
        <td class="corta" title="${P.esc(m.obs)}">${P.esc(m.obs)}</td>
        <td class="curta">${P.dataBR(m.ultimo_contato)}</td>
        <td class="acoes">${whats ? `<a class="botao" href="${whats}" target="_blank" rel="noopener" title="Abrir conversa no WhatsApp">${P.icone("whats", "ico-p")}WhatsApp</a>` : ""}</td>
      </tr>`;
    }).join("");
  }

  function abrirForm(marca) {
    const m = marca || { situacao: "lead", ultimo_contato: P.hoje() };
    P.formulario({
      titulo: marca ? "Editar marca" : "Adicionar marca",
      valores: m,
      campos: [
        { nome: "nome", rotulo: "Marca", tipo: "texto", obrigatorio: true, largo: true },
        { nome: "instagram", rotulo: "Instagram", tipo: "texto", ajuda: "Ex.: @marca" },
        { nome: "email", rotulo: "E-mail", tipo: "email" },
        { nome: "telefone", rotulo: "Telefone", tipo: "tel", ajuda: "Com DDD. Ganha o botão de WhatsApp." },
        { nome: "situacao", rotulo: "Situação", tipo: "escolha", opcoes: SITUACOES.map(([v, n]) => [v, n]) },
        { nome: "ultimo_contato", rotulo: "Último contato", tipo: "data" },
        { nome: "obs", rotulo: "Observação", tipo: "texto-longo" }
      ],
      aoSalvar: async (dados) => {
        const erro = marca
          ? await P.gravar("marcas", "atualizar", dados, marca.id)
          : await P.gravar("marcas", "inserir", dados);
        if (erro) return erro;
        P.toast(marca ? "Marca salva." : "Marca adicionada.");
        await carregar();
        return null;
      },
      aoApagar: marca ? async () => {
        const erro = await P.gravar("marcas", "apagar", null, marca.id);
        if (erro) return erro;
        P.toast("Marca apagada.");
        await carregar();
        return null;
      } : null
    });
  }

  /* =========================================================
     IMPORTAR PLANILHA (CSV)
     Lê o arquivo, tenta adivinhar o que é cada coluna, mostra uma
     prévia para você conferir e só então grava as marcas na base.
     ========================================================= */

  // Para onde cada coluna da planilha pode ir
  const DESTINOS = [
    ["ignorar", "Não importar"],
    ["nome", "Marca"],
    ["instagram", "Instagram"],
    ["email", "E-mail"],
    ["telefone", "Telefone"],
    ["situacao", "Situação"],
    ["obs", "Observação"],
    ["ultimo_contato", "Último contato"]
  ];

  // Palavras que costumam aparecer no cabeçalho de cada coluna
  const PALPITES = {
    nome: ["marca", "nome", "empresa", "cliente", "brand", "company", "razao"],
    instagram: ["instagram", "insta", "arroba", "@", "perfil", "handle"],
    email: ["email", "e-mail", "mail", "contato de email"],
    telefone: ["telefone", "fone", "celular", "whats", "whatsapp", "phone", "tel"],
    situacao: ["situacao", "situação", "status", "etapa", "estagio", "estágio", "funil"],
    obs: ["obs", "observacao", "observação", "anotacao", "anotação", "nota", "comentario", "comentário", "descricao", "descrição"],
    ultimo_contato: ["ultimo contato", "último contato", "data", "contato em", "ultimo_contato"]
  };

  const semAcento = (t) => String(t || "").normalize("NFD").replace(/[̀-ͯ]/g, "").toLowerCase().trim();

  // Lê o arquivo respeitando o acento, tanto do Excel do Brasil quanto do Google Planilhas
  function lerTexto(arquivo) {
    return new Promise((resolve, reject) => {
      const leitor = new FileReader();
      leitor.onerror = () => reject(new Error("falha ao ler"));
      leitor.onload = () => {
        const bytes = new Uint8Array(leitor.result);
        let texto;
        try {
          texto = new TextDecoder("utf-8", { fatal: true }).decode(bytes);
        } catch (erro) {
          texto = new TextDecoder("windows-1252").decode(bytes); // planilha salva pelo Excel antigo
        }
        resolve(texto.replace(/^﻿/, ""));
      };
      leitor.readAsArrayBuffer(arquivo);
    });
  }

  // Descobre se a planilha usa ponto e vírgula, vírgula ou tabulação
  function descobrirSeparador(texto) {
    const primeira = texto.split(/\r?\n/)[0] || "";
    const fora = primeira.replace(/"[^"]*"/g, "");
    const contagem = { ";": (fora.match(/;/g) || []).length, ",": (fora.match(/,/g) || []).length, "\t": (fora.match(/\t/g) || []).length };
    return Object.entries(contagem).sort((a, b) => b[1] - a[1])[0][1] > 0
      ? Object.entries(contagem).sort((a, b) => b[1] - a[1])[0][0]
      : ";";
  }

  // Quebra o texto em linhas e colunas, respeitando o que está entre aspas
  function lerCSV(texto, sep) {
    const linhas = [];
    let linha = [], campo = "", aspas = false;
    for (let i = 0; i < texto.length; i++) {
      const c = texto[i];
      if (aspas) {
        if (c === '"' && texto[i + 1] === '"') { campo += '"'; i++; }
        else if (c === '"') aspas = false;
        else campo += c;
      } else if (c === '"') aspas = true;
      else if (c === sep) { linha.push(campo); campo = ""; }
      else if (c === "\n") { linha.push(campo); linhas.push(linha); linha = []; campo = ""; }
      else if (c !== "\r") campo += c;
    }
    linha.push(campo);
    linhas.push(linha);
    return linhas.filter((l) => l.some((v) => String(v).trim() !== ""));
  }

  // Uma célula que já é um dado (e-mail, @, telefone, data, link) nunca é título de coluna
  const pareceDado = (c) => {
    const t = String(c || "").trim();
    if (!t) return false;
    return /^@/.test(t) || /^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/.test(t) || /^[\d\s()+.-]{6,}$/.test(t) ||
      /^\d{1,4}[\/.-]\d{1,2}[\/.-]\d{2,4}$/.test(t) || /^https?:\/\//i.test(t);
  };

  function adivinharDestino(cabecalho, jaUsados) {
    const t = semAcento(cabecalho);
    if (!t || pareceDado(cabecalho)) return "ignorar";
    for (const [destino, palavras] of Object.entries(PALPITES)) {
      if (jaUsados.includes(destino)) continue;
      if (palavras.some((p) => t === semAcento(p) || t.includes(semAcento(p)))) return destino;
    }
    return "ignorar";
  }

  // Sem cabeçalho (ou com cabeçalho estranho), olha o conteúdo da coluna para adivinhar
  function adivinharPeloConteudo(dados, i) {
    const amostra = dados.slice(0, 10).map((l) => String(l[i] || "").trim()).filter(Boolean);
    if (!amostra.length) return "";
    const parte = (teste) => amostra.filter(teste).length / amostra.length;
    if (parte((v) => /^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/.test(v)) > 0.5) return "email";
    if (parte((v) => /^@/.test(v) || /instagram\.com/i.test(v)) > 0.5) return "instagram";
    if (parte((v) => /^[\d\s()+.-]{8,}$/.test(v)) > 0.5) return "telefone";
    if (parte((v) => /^\d{1,4}[\/.-]\d{1,2}[\/.-]\d{2,4}$/.test(v)) > 0.5) return "ultimo_contato";
    if (parte((v) => /^(lead|client|convers|parad|negoci|perdid)/.test(semAcento(v))) > 0.5) return "situacao";
    return "";
  }

  // Deixa cada valor no formato que a base usa
  const limparSituacao = (v) => {
    const t = semAcento(v);
    if (t.includes("client")) return "cliente";
    if (t.includes("convers") || t.includes("negoci") || t.includes("andamento")) return "conversando";
    if (t.includes("parad") || t.includes("perd") || t.includes("frio")) return "parada";
    return "lead";
  };
  const limparData = (v) => {
    const t = String(v || "").trim();
    let m = t.match(/^(\d{1,2})[\/.-](\d{1,2})[\/.-](\d{2,4})$/);
    if (m) {
      const ano = m[3].length === 2 ? "20" + m[3] : m[3];
      return `${ano}-${m[2].padStart(2, "0")}-${m[1].padStart(2, "0")}`;
    }
    m = t.match(/^(\d{4})-(\d{1,2})-(\d{1,2})/);
    if (m) return `${m[1]}-${m[2].padStart(2, "0")}-${m[3].padStart(2, "0")}`;
    return null;
  };
  const limparTelefone = (v) => String(v || "").replace(/[^\d+() -]/g, "").trim().slice(0, 60);
  const limparEmail = (v) => { const t = String(v || "").trim().toLowerCase(); return /^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/.test(t) ? t.slice(0, 200) : ""; };

  let planilha = null; // { colunas: [], linhas: [[]] }

  async function aoEscolherArquivo(e) {
    const arquivo = e.target.files && e.target.files[0];
    e.target.value = ""; // permite escolher o mesmo arquivo de novo depois
    if (!arquivo) return;
    if (arquivo.size > 5 * 1024 * 1024) { P.toast("Essa planilha é muito grande. Divida em partes de até 5 MB.", "erro"); return; }
    let texto;
    try { texto = await lerTexto(arquivo); } catch (erro) { P.toast("Não consegui abrir esse arquivo. Salve a planilha como CSV e tente de novo.", "erro"); return; }
    const linhas = lerCSV(texto, descobrirSeparador(texto));
    if (linhas.length < 1) { P.toast("A planilha está vazia.", "erro"); return; }

    // A primeira linha é cabeçalho? Só quando duas ou mais células parecem título de coluna
    const primeira = linhas[0].map((c) => String(c).trim());
    const reconhecidas = primeira.filter((c) => adivinharDestino(c, []) !== "ignorar").length;
    const temCabecalho = reconhecidas >= 2 || (primeira.length === 1 && reconhecidas === 1);
    const colunas = temCabecalho ? primeira : primeira.map((_, i) => `Coluna ${i + 1}`);
    const dados = temCabecalho ? linhas.slice(1) : linhas;
    if (!dados.length) { P.toast("A planilha só tem o cabeçalho, sem marcas.", "erro"); return; }

    // Primeiro pelo nome da coluna, depois pelo conteúdo, e o que sobrar vira a marca
    const usados = [];
    const destinos = colunas.map((c, i) => {
      let d = temCabecalho ? adivinharDestino(c, usados) : "ignorar";
      if (d === "ignorar") {
        const pelaCara = adivinharPeloConteudo(dados, i);
        if (pelaCara && !usados.includes(pelaCara)) d = pelaCara;
      }
      if (d !== "ignorar") usados.push(d);
      return d;
    });
    if (!destinos.includes("nome")) {
      const livre = destinos.findIndex((d) => d === "ignorar");
      destinos[livre >= 0 ? livre : 0] = "nome";
    }

    planilha = { arquivo: arquivo.name, colunas, destinos, dados };
    mostrarPrevia();
  }

  function mostrarPrevia() {
    const { colunas, destinos, dados, arquivo } = planilha;
    const amostra = dados.slice(0, 5);
    const corpo = P.ver("Importar planilha", `
      <p class="mudo" style="margin-bottom:12px">Arquivo <b>${P.esc(arquivo)}</b>, com ${P.plural(dados.length, "linha", "linhas")}. Confira se entendi cada coluna e ajuste o que precisar.</p>
      <div class="tabela-rolagem" style="max-height:46vh">
        <table class="tabela">
          <thead>
            <tr>${colunas.map((c, i) => `<th><div style="margin-bottom:6px">${P.esc(c)}</div><select class="selecao" data-coluna="${i}">${DESTINOS.map(([v, n]) => `<option value="${v}"${destinos[i] === v ? " selected" : ""}>${n}</option>`).join("")}</select></th>`).join("")}</tr>
          </thead>
          <tbody>
            ${amostra.map((l) => `<tr>${colunas.map((_, i) => `<td class="corta">${P.esc(l[i] || "")}</td>`).join("")}</tr>`).join("")}
          </tbody>
        </table>
      </div>
      <label class="campo campo-marcar" style="margin-top:12px"><input type="checkbox" id="mc-pular" checked>Pular marcas que já estão na minha base (mesmo e-mail, @ ou nome)</label>
      <label class="campo campo-marcar"><input type="checkbox" id="mc-como-lead" checked>Quando a planilha não disser a situação, entrar como Lead</label>
      <p class="erro-form" id="mc-erro-importar" role="alert" hidden></p>
      <div class="grupo-botoes" style="margin-top:14px">
        <button class="botao botao-principal" type="button" id="mc-confirmar">${P.icone("subir", "ico-p")}Importar ${P.plural(dados.length, "marca", "marcas")}</button>
        <button class="botao" type="button" id="mc-cancelar">Cancelar</button>
        <button class="botao empurra" type="button" id="mc-modelo">${P.icone("baixar", "ico-p")}Baixar planilha modelo</button>
      </div>`);
    corpo.onchange = (e) => {
      const sel = e.target.closest("[data-coluna]");
      if (sel) planilha.destinos[Number(sel.dataset.coluna)] = sel.value;
    };
    corpo.onclick = (e) => {
      if (e.target.closest("#mc-cancelar")) P.fecharVer();
      if (e.target.closest("#mc-modelo")) baixarModelo();
      if (e.target.closest("#mc-confirmar")) importar(e.target.closest("#mc-confirmar"));
    };
  }

  function baixarModelo() {
    P.baixarCSV("modelo-marcas",
      ["Marca", "Instagram", "E-mail", "Telefone", "Situação", "Observação", "Último contato"],
      [["Marca Exemplo", "@marcaexemplo", "contato@marcaexemplo.com", "(41) 99999-0000", "Lead", "Achei pelo Instagram", "20/09/2026"]]);
  }

  async function importar(botao) {
    const { destinos, dados } = planilha;
    const pularRepetidas = P.$("#mc-pular").checked;
    const comoLead = P.$("#mc-como-lead").checked;
    const erro = P.$("#mc-erro-importar");
    const coluna = (destino) => destinos.indexOf(destino);

    const jaExiste = new Set();
    marcas.forEach((m) => {
      if (m.email) jaExiste.add("e:" + semAcento(m.email));
      if (m.instagram) jaExiste.add("i:" + semAcento(P.arroba(m.instagram)));
      if (m.nome) jaExiste.add("n:" + semAcento(m.nome));
    });

    const novas = [];
    let repetidas = 0, semNome = 0;
    dados.forEach((linha) => {
      const pegar = (destino) => { const i = coluna(destino); return i >= 0 ? String(linha[i] || "").trim() : ""; };
      const email = limparEmail(pegar("email"));
      const instagram = P.arroba(pegar("instagram"));
      let nome = pegar("nome").slice(0, 200);
      if (!nome) nome = instagram || (email ? email.split("@")[0] : "");
      if (!nome) { semNome++; return; }
      const chaves = [email ? "e:" + semAcento(email) : "", instagram ? "i:" + semAcento(instagram) : "", "n:" + semAcento(nome)].filter(Boolean);
      if (pularRepetidas && chaves.some((c) => jaExiste.has(c))) { repetidas++; return; }
      chaves.forEach((c) => jaExiste.add(c));
      const situacaoDaPlanilha = pegar("situacao");
      novas.push({
        nome,
        instagram: instagram.slice(0, 200),
        email,
        telefone: limparTelefone(pegar("telefone")),
        situacao: situacaoDaPlanilha ? limparSituacao(situacaoDaPlanilha) : (comoLead ? "lead" : "lead"),
        obs: pegar("obs").slice(0, 3000),
        ultimo_contato: limparData(pegar("ultimo_contato")),
        origem: "admin",
        exemplo: false
      });
    });

    if (!novas.length) {
      erro.textContent = repetidas
        ? `Todas as ${repetidas} marcas da planilha já estão na sua base.`
        : "Não encontrei nenhuma marca válida na planilha. Confira se a coluna da marca está escolhida certa.";
      erro.hidden = false;
      return;
    }

    erro.hidden = true;
    botao.disabled = true;
    botao.textContent = "Importando...";
    let gravadas = 0, falhas = 0;
    for (let i = 0; i < novas.length; i += 100) { // manda de 100 em 100 para não pesar
      const lote = novas.slice(i, i + 100);
      const problema = await P.gravar("marcas", "inserir", lote);
      if (problema) { falhas += lote.length; erro.textContent = problema; erro.hidden = false; }
      else gravadas += lote.length;
    }
    botao.disabled = false;
    botao.textContent = "Importar";
    await carregar();
    if (!falhas) P.fecharVer();
    const partes = [`${P.plural(gravadas, "marca importada", "marcas importadas")}`];
    if (repetidas) partes.push(repetidas === 1 ? "1 já estava na base" : `${repetidas} já estavam na base`);
    if (semNome) partes.push(semNome === 1 ? "1 linha sem nome" : `${semNome} linhas sem nome`);
    if (falhas) partes.push(falhas === 1 ? "1 não entrou" : `${falhas} não entraram`);
    P.toast(partes.join(", ") + ".", falhas ? "erro" : "ok");
  }

  function baixar() {
    const lista = filtradas();
    if (!lista.length) { P.toast("Não tem nenhuma marca para baixar com esse filtro."); return; }
    P.baixarCSV("marcas",
      ["Marca", "Instagram", "E-mail", "Telefone", "Situação", "Observação", "Último contato", "Veio do site"],
      lista.map((m) => [m.nome, P.arroba(m.instagram), m.email, m.telefone, nomeSituacao(m.situacao), m.obs, P.dataBR(m.ultimo_contato), m.origem === "site" ? "Sim" : "Não"]));
  }
})();
