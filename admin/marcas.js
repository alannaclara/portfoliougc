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
            <button class="botao" type="button" id="mc-csv">${P.icone("baixar", "ico-p")}Baixar CSV</button>
            <button class="botao botao-principal" type="button" id="mc-novo">${P.icone("mais", "ico-p")}Adicionar marca</button>
          </div>
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

  function baixar() {
    const lista = filtradas();
    if (!lista.length) { P.toast("Não tem nenhuma marca para baixar com esse filtro."); return; }
    P.baixarCSV("marcas",
      ["Marca", "Instagram", "E-mail", "Telefone", "Situação", "Observação", "Último contato", "Veio do site"],
      lista.map((m) => [m.nome, P.arroba(m.instagram), m.email, m.telefone, nomeSituacao(m.situacao), m.obs, P.dataBR(m.ultimo_contato), m.origem === "site" ? "Sim" : "Não"]));
  }
})();
