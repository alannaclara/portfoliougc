/* =========================================================
   ABA CALENDÁRIO
   O mês inteiro, de segunda a domingo. Os prazos das
   campanhas aparecem sozinhos, puxados da tabela campanhas.
   ========================================================= */
(function () {
  "use strict";
  const P = window.Painel;

  const TIPOS = [["gravar", "Gravar"], ["editar", "Editar"], ["postar", "Postar"]];
  const nomeTipo = (t) => (TIPOS.find((x) => x[0] === t) || [t, t === "prazo" ? "Prazo" : t])[1];
  const MAX_POR_DIA = 3;

  let secao = null;
  let itens = [];       // linhas da tabela calendario
  let campanhas = [];   // para puxar os prazos
  let nomesMarcas = [];
  let mes = primeiroDoMes(new Date());
  let filtro = "todos";

  function primeiroDoMes(d) { return new Date(d.getFullYear(), d.getMonth(), 1); }

  P.abas.calendario = {
    async iniciar(s) {
      secao = s;
      s.innerHTML = `
        <div class="avisos"></div>
        <div class="cal-cabeca">
          <button class="botao botao-icone" type="button" id="cl-ant" aria-label="Mês anterior">${P.icone("esq")}</button>
          <h2 class="cal-mes" id="cl-mes" aria-live="polite"></h2>
          <button class="botao botao-icone" type="button" id="cl-prox" aria-label="Próximo mês">${P.icone("dir")}</button>
          <button class="botao" type="button" id="cl-hoje">Este mês</button>
          <div class="filtros" id="cl-filtros" role="group" aria-label="Filtrar por tipo"></div>
          <button class="botao botao-principal empurra" type="button" id="cl-novo">${P.icone("mais", "ico-p")}Adicionar</button>
        </div>
        <div class="cal">
          <div class="cal-semana" aria-hidden="true"><div>Seg</div><div>Ter</div><div>Qua</div><div>Qui</div><div>Sex</div><div>Sáb</div><div>Dom</div></div>
          <div class="cal-grade" id="cl-grade"></div>
        </div>
        <div class="legenda-cal">
          <span><i class="t-gravar"></i>Gravar</span><span><i class="t-editar"></i>Editar</span><span><i class="t-postar"></i>Postar</span><span><i class="t-prazo"></i>Prazo de campanha</span>
        </div>
        <div class="cartao atrasados">
          <div class="cartao-topo"><h2>Ficou pra trás</h2><span class="mudo pequeno">o que passou do dia e não foi feito</span></div>
          <ul class="lista-simples" id="cl-atrasados"></ul>
        </div>`;
      P.$("#cl-ant", s).addEventListener("click", () => { mes = new Date(mes.getFullYear(), mes.getMonth() - 1, 1); desenhar(); });
      P.$("#cl-prox", s).addEventListener("click", () => { mes = new Date(mes.getFullYear(), mes.getMonth() + 1, 1); desenhar(); });
      P.$("#cl-hoje", s).addEventListener("click", () => { mes = primeiroDoMes(new Date()); desenhar(); });
      P.$("#cl-novo", s).addEventListener("click", () => abrirForm(null, P.hoje()));
      P.$("#cl-filtros", s).addEventListener("click", (e) => {
        const b = e.target.closest("[data-filtro]");
        if (!b) return;
        filtro = b.dataset.filtro;
        desenhar();
      });
      P.$("#cl-grade", s).addEventListener("click", aoClicarNaGrade);
      P.$("#cl-atrasados", s).addEventListener("click", aoClicarNosAtrasados);
      await carregar();
    },
    async aoMostrar() { await carregar(); }
  };

  async function carregar() {
    const avisos = P.$(".avisos", secao);
    P.limparAvisos(avisos);
    const [rc, rp, rm] = await Promise.all([
      P.lerSeguro("calendario", (q) => q.order("data", { ascending: true })),
      P.ler("campanhas"),
      P.ler("marcas")
    ]);
    if (rc.erro) P.avisar(avisos, rc.erro);
    if (rp.erro) P.avisar(avisos, rp.erro + " Os prazos das campanhas não vão aparecer no calendário até isso ser resolvido.");
    P.conferirCampos(avisos, "calendario", rc.dados, ["titulo", "marca", "tipo", "data", "status"]);
    itens = rc.dados;
    campanhas = rp.dados;
    nomesMarcas = [...new Set([...rm.dados.map((m) => m.nome), ...campanhas.map((c) => c.cliente)].filter(Boolean))].sort();
    desenhar();
  }

  // Junta tudo o que aparece no calendário: itens + prazos das campanhas
  function todosOsEventos() {
    const eventos = itens.filter((i) => i.data).map((i) => ({
      origem: "cal", id: i.id, iso: String(i.data).slice(0, 10), tipo: i.tipo || "gravar",
      titulo: i.titulo || "Sem título", marca: i.marca || "", feito: i.status === "feito", exemplo: !!i.exemplo
    }));
    campanhas.filter((c) => c.prazo && c.ativa !== false).forEach((c) => eventos.push({
      origem: "prazo", id: c.id, iso: String(c.prazo).slice(0, 10), tipo: "prazo",
      titulo: `Prazo: ${c.campanha || "campanha"}`, marca: c.cliente || "", feito: c.status === "Entregue", status: c.status, exemplo: !!c.exemplo
    }));
    return eventos;
  }

  function passaNoFiltro(ev) {
    if (filtro === "todos") return true;
    return ev.tipo === filtro;
  }

  function desenhar() {
    // Filtros
    P.$("#cl-filtros", secao).innerHTML = [["todos", "Todos"], ...TIPOS, ["prazo", "Prazos"]].map(([v, n]) =>
      `<button class="filtro" type="button" data-filtro="${v}" aria-pressed="${filtro === v}">${n}</button>`).join("");

    P.$("#cl-mes", secao).textContent = mes.toLocaleDateString("pt-BR", { month: "long", year: "numeric" });

    // Monta a grade: começa na segunda-feira da semana do dia 1
    const deslocamento = (mes.getDay() + 6) % 7;
    const inicio = new Date(mes.getFullYear(), mes.getMonth(), 1 - deslocamento);
    const diasNoMes = new Date(mes.getFullYear(), mes.getMonth() + 1, 0).getDate();
    const totalCelulas = Math.ceil((deslocamento + diasNoMes) / 7) * 7;
    const hoje = P.hoje();

    const porDia = {};
    todosOsEventos().filter(passaNoFiltro).forEach((ev) => { (porDia[ev.iso] = porDia[ev.iso] || []).push(ev); });

    let html = "";
    for (let i = 0; i < totalCelulas; i++) {
      const d = new Date(inicio.getFullYear(), inicio.getMonth(), inicio.getDate() + i);
      const iso = P.isoData(d);
      const doDia = porDia[iso] || [];
      const fora = d.getMonth() !== mes.getMonth();
      const rotuloDia = d.toLocaleDateString("pt-BR", { day: "numeric", month: "long" });
      html += `<div class="cal-dia${fora ? " fora" : ""}${iso === hoje ? " hoje" : ""}" data-dia="${iso}">
        <span class="cal-num"${iso === hoje ? ' title="Hoje"' : ""}>${d.getDate()}</span>
        <button class="cal-mais-add" type="button" data-adicionar aria-label="Adicionar em ${rotuloDia}">${P.icone("mais", "ico-p")}</button>
        <div class="cal-itens">
          ${doDia.slice(0, MAX_POR_DIA).map(itemHTML).join("")}
          ${doDia.length > MAX_POR_DIA ? `<button class="cal-mais" type="button" data-ver-dia>+${doDia.length - MAX_POR_DIA} mais</button>` : ""}
        </div>
      </div>`;
    }
    P.$("#cl-grade", secao).innerHTML = html;
    desenharAtrasados();
  }

  function itemHTML(ev) {
    const dica = `${nomeTipo(ev.tipo)}: ${ev.titulo}${ev.marca ? " · " + ev.marca : ""}${ev.feito ? " (feito)" : ""}`;
    return `<button class="cal-item t-${P.esc(ev.tipo)}${ev.feito ? " feito" : ""}" type="button" data-evento="${ev.origem}:${P.esc(ev.id)}" title="${P.esc(dica)}">${P.esc(ev.titulo)}</button>`;
  }

  function acharEvento(chave) {
    const [origem, id] = chave.split(/:(.+)/);
    return todosOsEventos().find((ev) => ev.origem === origem && String(ev.id) === id);
  }

  function aoClicarNaGrade(e) {
    const celula = e.target.closest("[data-dia]");
    if (!celula) return;
    const iso = celula.dataset.dia;
    const botaoEvento = e.target.closest("[data-evento]");
    if (botaoEvento) { abrirEvento(acharEvento(botaoEvento.dataset.evento)); return; }
    if (e.target.closest("[data-ver-dia]")) { abrirDia(iso); return; }
    abrirForm(null, iso); // clicou no dia (ou no +): abre o formulário já com a data
  }

  function abrirEvento(ev) {
    if (!ev) return;
    if (ev.origem === "cal") {
      abrirForm(itens.find((i) => String(i.id) === String(ev.id)), ev.iso);
      return;
    }
    const c = campanhas.find((x) => String(x.id) === String(ev.id)) || {};
    const corpo = P.ver(c.campanha || "Campanha", `
      <p><b>Cliente:</b> ${P.esc(c.cliente || "Sem cliente")}</p>
      <p><b>Prazo:</b> ${P.esc(P.dataBR(c.prazo))}</p>
      <p><b>Status:</b> ${P.esc(c.status || "")}</p>
      <p class="mudo pequeno" style="margin-top:10px">Este prazo vem da aba Campanhas. Para mudar a data, edite a campanha.</p>
      <div class="grupo-botoes" style="margin-top:14px"><button class="botao botao-principal" type="button" data-ir-campanhas>Abrir Campanhas</button></div>`);
    P.$("[data-ir-campanhas]", corpo).addEventListener("click", () => { P.fecharVer(); location.hash = "campanhas"; });
  }

  // Abre só aquele dia, com tudo o que tem nele
  function abrirDia(iso) {
    const d = P.paraData(iso);
    const titulo = d.toLocaleDateString("pt-BR", { weekday: "long", day: "numeric", month: "long" });
    const doDia = todosOsEventos().filter((ev) => ev.iso === iso && passaNoFiltro(ev));
    const corpo = P.ver(titulo.charAt(0).toUpperCase() + titulo.slice(1), `
      <ul class="lista-simples">${doDia.map((ev) => `
        <li>
          <span class="pilula t-${P.esc(ev.tipo)}">${P.esc(nomeTipo(ev.tipo))}</span>
          <span class="cresce"><b${ev.feito ? ' style="text-decoration:line-through"' : ""}>${P.esc(ev.titulo)}</b>${ev.marca ? `<span class="mudo"> · ${P.esc(ev.marca)}</span>` : ""}</span>
          <button class="botao" type="button" data-evento="${ev.origem}:${P.esc(ev.id)}">Abrir</button>
        </li>`).join("")}</ul>
      <div class="grupo-botoes" style="margin-top:14px"><button class="botao botao-principal" type="button" data-adicionar-dia>${P.icone("mais", "ico-p")}Adicionar neste dia</button></div>`);
    corpo.onclick = (e) => {
      const b = e.target.closest("[data-evento]");
      if (b) { P.fecharVer(); abrirEvento(acharEvento(b.dataset.evento)); }
      if (e.target.closest("[data-adicionar-dia]")) { P.fecharVer(); abrirForm(null, iso); }
    };
  }

  /* ---------- Ficou pra trás ---------- */
  function desenharAtrasados() {
    const hoje = P.hoje();
    const lista = todosOsEventos().filter((ev) => ev.iso < hoje && !ev.feito).sort((a, b) => a.iso.localeCompare(b.iso));
    const alvo = P.$("#cl-atrasados", secao);
    if (!lista.length) {
      alvo.innerHTML = `<li class="mudo">Nada atrasado. Tudo em dia.</li>`;
      return;
    }
    alvo.innerHTML = lista.map((ev) => {
      const dias = -P.diasAte(ev.iso);
      return `<li>
        <span class="pilula t-${P.esc(ev.tipo)}">${P.esc(nomeTipo(ev.tipo))}</span>
        <span class="cresce"><b>${P.esc(ev.titulo)}</b>${ev.marca ? `<span class="mudo"> · ${P.esc(ev.marca)}</span>` : ""}${ev.exemplo ? ' <span class="pilula p-exemplo">exemplo</span>' : ""}</span>
        <span class="pilula p-vermelho">há ${P.plural(dias, "dia", "dias")}</span>
        ${ev.origem === "cal"
          ? `<button class="botao" type="button" data-feito="${P.esc(ev.id)}">${P.icone("check", "ico-p")}Marcar feito</button>`
          : `<button class="botao" type="button" data-evento="${ev.origem}:${P.esc(ev.id)}">Ver campanha</button>`}
      </li>`;
    }).join("");
  }

  async function aoClicarNosAtrasados(e) {
    const feito = e.target.closest("[data-feito]");
    if (feito) {
      const erro = await P.gravar("calendario", "atualizar", { status: "feito" }, feito.dataset.feito);
      if (erro) { P.toast(erro, "erro"); return; }
      P.toast("Marcado como feito.");
      await carregar();
      return;
    }
    const b = e.target.closest("[data-evento]");
    if (b) abrirEvento(acharEvento(b.dataset.evento));
  }

  /* ---------- Formulário ---------- */
  function abrirForm(item, iso) {
    const v = item || { tipo: filtro !== "todos" && filtro !== "prazo" ? filtro : "gravar", data: iso || P.hoje(), status: "a fazer" };
    P.formulario({
      titulo: item ? "Editar no calendário" : "Adicionar no calendário",
      valores: v,
      campos: [
        { nome: "titulo", rotulo: "O que é", tipo: "texto", obrigatorio: true, largo: true },
        { nome: "marca", rotulo: "Marca", tipo: "texto", lista: nomesMarcas },
        { nome: "tipo", rotulo: "Tipo", tipo: "escolha", opcoes: TIPOS },
        { nome: "data", rotulo: "Data", tipo: "data", obrigatorio: true },
        { nome: "status", rotulo: "Status", tipo: "escolha", opcoes: [["a fazer", "A fazer"], ["feito", "Feito"]] }
      ],
      aoSalvar: async (dados) => {
        const erro = item
          ? await P.gravar("calendario", "atualizar", dados, item.id)
          : await P.gravar("calendario", "inserir", dados);
        if (erro) return erro;
        P.toast(item ? "Salvo no calendário." : "Adicionado ao calendário.");
        const d = P.paraData(dados.data);
        if (d) mes = primeiroDoMes(d);
        await carregar();
        return null;
      },
      aoApagar: item ? async () => {
        const erro = await P.gravar("calendario", "apagar", null, item.id);
        if (erro) return erro;
        P.toast("Apagado do calendário.");
        await carregar();
        return null;
      } : null
    });
  }
})();
