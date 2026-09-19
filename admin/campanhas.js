/* =========================================================
   ABA CAMPANHAS
   Números no topo, filtros, busca, tabela que ordena por
   qualquer coluna e avisos de prazo.
   ========================================================= */
(function () {
  "use strict";
  const P = window.Painel;

  // O funil, nesta ordem. Ordenar por status segue esta ordem, nunca a alfabética.
  const FUNIL = ["Briefing", "Roteiro", "Aprovação Roteiro", "Gravação", "Edição", "Aprovado", "Entregue"];
  const COR_STATUS = { "Briefing": "cinza", "Roteiro": "lilas", "Aprovação Roteiro": "amarelo", "Gravação": "pessego", "Edição": "ciano", "Aprovado": "verde", "Entregue": "escuro" };
  const TIPOS = ["Conteúdo", "Publicidade"];
  const COR_TIPO = { "Conteúdo": "ciano", "Publicidade": "pessego" };

  // Colunas da tabela e como cada uma ordena
  const COLUNAS = [
    { chave: "favorita", rotulo: "Destaque", sr: true, valor: (c) => (c.favorita ? 1 : 0) },
    { chave: "campanha", rotulo: "Campanha", valor: (c) => String(c.campanha || "").toLowerCase() },
    { chave: "cliente", rotulo: "Cliente", valor: (c) => String(c.cliente || "").toLowerCase() },
    { chave: "tipo", rotulo: "Tipo", valor: (c) => String(c.tipo || "").toLowerCase() },
    { chave: "status", rotulo: "Status", valor: (c) => { const i = FUNIL.indexOf(c.status); return i < 0 ? 99 : i; } },
    { chave: "qtd", rotulo: "Qtd", num: true, valor: (c) => P.num(c.qtd) },
    { chave: "valor", rotulo: "Valor", num: true, valor: (c) => P.num(c.valor) },
    { chave: "prazo", rotulo: "Prazo", valor: (c) => c.prazo ? String(c.prazo).slice(0, 10) : "9999-99-99" },
    { chave: "pagamento", rotulo: "Pagamento", valor: (c) => (c.pagamento === "pago" ? 1 : 0) }
  ];

  let secao = null;
  let campanhas = [];
  let nomesClientes = [];
  let filtro = "todas";
  let busca = "";
  let ordem = { chave: "prazo", sentido: 1 };

  P.abas.campanhas = {
    async iniciar(s) {
      secao = s;
      s.innerHTML = `
        <div class="avisos"></div>
        <div class="numeros" id="cp-numeros" style="--colunas:4"></div>
        <div class="ferramentas">
          <div class="filtros" id="cp-filtros" role="group" aria-label="Filtrar campanhas"></div>
          <label class="busca"><span class="sr">Buscar</span>${P.icone("busca", "ico-p")}<input type="search" id="cp-busca" placeholder="Buscar campanha ou cliente"></label>
          <div class="grupo-botoes empurra">
            <button class="botao" type="button" id="cp-csv">${P.icone("baixar", "ico-p")}Baixar</button>
            <button class="botao botao-principal" type="button" id="cp-novo">${P.icone("mais", "ico-p")}Nova campanha</button>
          </div>
        </div>
        <div class="cartao">
          <div class="tabela-rolagem">
            <table class="tabela">
              <thead><tr id="cp-cabeca"></tr></thead>
              <tbody id="cp-lista"><tr><td colspan="9" class="carregando">Carregando...</td></tr></tbody>
            </table>
          </div>
        </div>
        <p class="mudo pequeno" style="margin-top:8px">Clique no nome de uma coluna para ordenar. Clique de novo para inverter. Clique numa linha para editar.</p>`;
      P.$("#cp-busca", s).addEventListener("input", (e) => { busca = e.target.value.trim().toLowerCase(); desenharTabela(); });
      P.$("#cp-filtros", s).addEventListener("click", (e) => {
        const b = e.target.closest("[data-filtro]");
        if (!b) return;
        filtro = b.dataset.filtro;
        desenharTabela();
      });
      P.$("#cp-cabeca", s).addEventListener("click", (e) => {
        const b = e.target.closest("[data-ordenar]");
        if (!b) return;
        const chave = b.dataset.ordenar;
        ordem = ordem.chave === chave ? { chave, sentido: -ordem.sentido } : { chave, sentido: 1 };
        desenharTabela();
      });
      P.$("#cp-lista", s).addEventListener("click", aoClicarNaLista);
      P.$("#cp-lista", s).addEventListener("keydown", (e) => {
        if (e.key !== "Enter" || e.target.closest("button")) return;
        const tr = e.target.closest("tr[data-id]");
        if (tr) tr.click();
      });
      P.$("#cp-novo", s).addEventListener("click", () => abrirForm(null));
      P.$("#cp-csv", s).addEventListener("click", baixar);
      await carregar();
    },
    async aoMostrar() { await carregar(); }
  };

  async function carregar() {
    const avisos = P.$(".avisos", secao);
    P.limparAvisos(avisos);
    const [r, rm] = await Promise.all([P.ler("campanhas"), P.ler("marcas")]);
    if (r.erro) P.avisar(avisos, r.erro);
    P.conferirCampos(avisos, "campanhas", r.dados, ["campanha", "cliente", "tipo", "status", "qtd", "valor", "prazo", "pagamento", "ativa", "favorita"]);
    campanhas = r.dados;
    nomesClientes = [...new Set([...rm.dados.map((m) => m.nome), ...campanhas.map((c) => c.cliente)].filter(Boolean))].sort();
    desenharNumeros();
    desenharTabela();
  }

  /* ---------- Faixa de números (sem linha de exemplo, sem divisão por zero) ---------- */
  function desenharNumeros() {
    const reais = campanhas.filter((c) => !c.exemplo);
    const ativas = reais.filter((c) => c.ativa !== false).length;
    const total = reais.reduce((s, c) => s + P.num(c.valor), 0);
    const videos = reais.reduce((s, c) => s + P.num(c.qtd), 0);
    const ticket = P.divide(total, videos);
    const aReceber = reais.filter((c) => c.pagamento !== "pago").reduce((s, c) => s + P.num(c.valor), 0);
    const recebido = reais.filter((c) => c.pagamento === "pago").reduce((s, c) => s + P.num(c.valor), 0);
    const celula = (rotulo, valor, sub) => `<div class="numero"><p class="numero-rotulo">${rotulo}</p><p class="numero-valor">${P.esc(valor)}</p>${sub ? `<p class="numero-sub">${P.esc(sub)}</p>` : ""}</div>`;
    P.$("#cp-numeros", secao).innerHTML =
      celula("Campanhas", P.inteiro(reais.length)) +
      celula("Ativas", P.inteiro(ativas)) +
      celula("Valor total", P.moeda(total), `ticket médio por vídeo: ${P.moeda(ticket)}`) +
      celula("A receber", P.moeda(aReceber), `já recebido: ${P.moeda(recebido)}`);
  }

  /* ---------- Tabela ---------- */
  function filtradas() {
    return campanhas.filter((c) => {
      if (filtro === "ativas" && c.ativa === false) return false;
      if (filtro === "finalizadas" && c.ativa !== false) return false;
      if (!busca) return true;
      return [c.campanha, c.cliente].some((t) => String(t || "").toLowerCase().includes(busca));
    });
  }

  function avisoPrazo(c) {
    if (!c.prazo || c.status === "Entregue") return "";
    const dias = P.diasAte(c.prazo);
    if (dias === null) return "";
    if (dias < 0) return ` <span class="pilula p-vermelho">atrasado ${P.plural(-dias, "dia", "dias")}</span>`;
    if (dias === 0) return ` <span class="pilula p-amarelo">vence hoje</span>`;
    if (dias <= 3) return ` <span class="pilula p-amarelo">vence em ${P.plural(dias, "dia", "dias")}</span>`;
    return "";
  }

  function desenharTabela() {
    const conta = {
      todas: campanhas.length,
      ativas: campanhas.filter((c) => c.ativa !== false).length,
      finalizadas: campanhas.filter((c) => c.ativa === false).length
    };
    P.$("#cp-filtros", secao).innerHTML = [["todas", "Todas"], ["ativas", "Ativas"], ["finalizadas", "Finalizadas"]].map(([v, n]) =>
      `<button class="filtro" type="button" data-filtro="${v}" aria-pressed="${filtro === v}">${n}<span class="qtd">${conta[v]}</span></button>`).join("");

    // Cabeçalho: coluna ativa com seta do sentido, as outras com sinal apagado
    P.$("#cp-cabeca", secao).innerHTML = COLUNAS.map((col) => {
      const ativa = ordem.chave === col.chave;
      const seta = ativa ? (ordem.sentido === 1 ? "▲" : "▼") : "↕";
      const aria = ativa ? ` aria-sort="${ordem.sentido === 1 ? "ascending" : "descending"}"` : "";
      const rotulo = col.sr ? `<span class="sr">${col.rotulo}</span>${P.icone("estrela", "ico-p")}` : col.rotulo;
      return `<th class="${col.num ? "num" : ""}"${aria}><button class="ordenar" type="button" data-ordenar="${col.chave}" title="Ordenar por ${col.rotulo.toLowerCase()}">${rotulo}<span class="seta-ord" aria-hidden="true">${seta}</span></button></th>`;
    }).join("");

    const col = COLUNAS.find((c) => c.chave === ordem.chave) || COLUNAS[7];
    const lista = filtradas().sort((a, b) => {
      const va = col.valor(a), vb = col.valor(b);
      if (va < vb) return -1 * ordem.sentido;
      if (va > vb) return 1 * ordem.sentido;
      return String(a.campanha || "").localeCompare(String(b.campanha || ""), "pt-BR");
    });

    const corpo = P.$("#cp-lista", secao);
    if (!campanhas.length) {
      corpo.innerHTML = `<tr><td colspan="9" class="vazio">Nenhuma campanha ainda. Clique em Nova campanha para cadastrar a primeira.</td></tr>`;
      return;
    }
    if (!lista.length) {
      corpo.innerHTML = `<tr><td colspan="9" class="vazio">Nenhuma campanha com essa busca ou filtro.</td></tr>`;
      return;
    }
    corpo.innerHTML = lista.map((c) => `
      <tr class="clicavel${c.favorita ? " favorita" : ""}" data-id="${P.esc(c.id)}" tabindex="0">
        <td><button class="estrela${c.favorita ? " ativa" : ""}" type="button" data-estrela aria-pressed="${!!c.favorita}" aria-label="${c.favorita ? "Tirar destaque" : "Destacar campanha"}" title="${c.favorita ? "Tirar destaque" : "Destacar"}">${P.icone("estrela")}</button></td>
        <td><b>${P.esc(c.campanha || "Sem nome")}</b>${P.pilulaExemplo(c)}${c.ativa === false ? ' <span class="pilula p-cinza">finalizada</span>' : ""}</td>
        <td class="curta">${P.esc(c.cliente)}</td>
        <td>${c.tipo ? P.pilula(c.tipo, COR_TIPO[c.tipo] || "cinza") : ""}</td>
        <td>${c.status ? P.pilula(c.status, COR_STATUS[c.status] || "cinza") : ""}</td>
        <td class="num">${P.inteiro(c.qtd)}</td>
        <td class="num">${P.moeda(c.valor)}</td>
        <td class="curta">${P.esc(P.dataBR(c.prazo))}${avisoPrazo(c)}</td>
        <td>${c.pagamento === "pago" ? P.pilula("Pago", "verde") : P.pilula("Pendente", "amarelo")}</td>
      </tr>`).join("");
  }

  async function aoClicarNaLista(e) {
    const tr = e.target.closest("tr[data-id]");
    if (!tr) return;
    const c = campanhas.find((x) => String(x.id) === tr.dataset.id);
    if (!c) return;
    if (e.target.closest("[data-estrela]")) {
      const novo = !c.favorita;
      const erro = await P.gravar("campanhas", "atualizar", { favorita: novo }, c.id);
      if (erro) { P.toast(erro, "erro"); return; }
      c.favorita = novo;
      desenharTabela();
      return;
    }
    abrirForm(c);
  }

  function abrirForm(c) {
    const v = c || { tipo: "Conteúdo", status: "Briefing", qtd: 1, valor: 0, pagamento: "pendente", ativa: true, favorita: false };
    P.formulario({
      titulo: c ? "Editar campanha" : "Nova campanha",
      valores: v,
      campos: [
        { nome: "campanha", rotulo: "Campanha", tipo: "texto", obrigatorio: true, largo: true },
        { nome: "cliente", rotulo: "Cliente", tipo: "texto", lista: nomesClientes },
        { nome: "tipo", rotulo: "Tipo", tipo: "escolha", opcoes: TIPOS.map((t) => [t, t]) },
        { nome: "status", rotulo: "Status", tipo: "escolha", opcoes: FUNIL.map((s) => [s, s]) },
        { nome: "prazo", rotulo: "Prazo", tipo: "data", ajuda: "Aparece sozinho no calendário." },
        { nome: "qtd", rotulo: "Quantidade de vídeos", tipo: "numero" },
        { nome: "valor", rotulo: "Valor total (R$)", tipo: "numero", passo: "0.01" },
        { nome: "pagamento", rotulo: "Pagamento", tipo: "escolha", opcoes: [["pendente", "Pendente"], ["pago", "Pago"]] },
        { nome: "ativa", rotulo: "Campanha ativa (desmarque quando finalizar)", tipo: "marcar", largo: true },
        { nome: "favorita", rotulo: "Destacar com estrela", tipo: "marcar", largo: true }
      ],
      aoSalvar: async (dados) => {
        const erro = c
          ? await P.gravar("campanhas", "atualizar", dados, c.id)
          : await P.gravar("campanhas", "inserir", dados);
        if (erro) return erro;
        P.toast(c ? "Campanha salva." : "Campanha criada.");
        await carregar();
        return null;
      },
      aoApagar: c ? async () => {
        const erro = await P.gravar("campanhas", "apagar", null, c.id);
        if (erro) return erro;
        P.toast("Campanha apagada.");
        await carregar();
        return null;
      } : null
    });
  }

  function baixar() {
    const lista = filtradas();
    if (!lista.length) { P.toast("Não tem nenhuma campanha para baixar com esse filtro."); return; }
    const valorBR = (v) => P.num(v).toFixed(2).replace(".", ",");
    P.baixarCSV("campanhas",
      ["Destaque", "Campanha", "Cliente", "Tipo", "Status", "Qtd", "Valor (R$)", "Prazo", "Pagamento", "Ativa"],
      lista.map((c) => [c.favorita ? "Sim" : "", c.campanha, c.cliente, c.tipo, c.status, P.num(c.qtd), valorBR(c.valor), P.dataBR(c.prazo), c.pagamento === "pago" ? "Pago" : "Pendente", c.ativa === false ? "Não" : "Sim"]));
  }
})();
