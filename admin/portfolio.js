/* =========================================================
   ABA PORTFÓLIO
   Números das visitas, gráfico de 14 dias, de onde vêm
   e a tabela dos vídeos que aparecem no site.
   ========================================================= */
(function () {
  "use strict";
  const P = window.Painel;

  // Mesmos nichos do site. A chave (à esquerda) é o que fica gravado no banco.
  const NICHOS = { beleza: "Beleza", skincare: "Skincare", comida: "Comida", tech: "Tech" };
  const FORMATOS = ["Vídeo UGC", "Reels", "TikTok", "Anúncio", "Unboxing", "Fotos do produto", "Publicação no perfil"];

  let secao = null;
  let videos = [];

  const nomeNicho = (n) => NICHOS[n] || (n ? n.charAt(0).toUpperCase() + n.slice(1) : "Sem nicho");
  const noAr = (v) => v.visivel !== false && !v.exemplo;

  P.abas.portfolio = {
    async iniciar(s) {
      secao = s;
      s.innerHTML = `
        <div class="avisos"></div>
        <div class="numeros" id="pf-numeros" style="--colunas:5"></div>
        <div class="duas-colunas">
          <div class="cartao">
            <div class="cartao-topo"><h2>Visitas dos últimos 14 dias</h2><span class="mudo pequeno" id="pf-total14"></span></div>
            <div class="cartao-corpo" id="pf-grafico"><p class="carregando">Carregando...</p></div>
          </div>
          <div class="cartao">
            <div class="cartao-topo"><h2>Por onde chegaram</h2><span class="mudo pequeno">14 dias</span></div>
            <div class="cartao-corpo" id="pf-origens"><p class="carregando">Carregando...</p></div>
          </div>
        </div>
        <div class="cartao">
          <div class="cartao-topo">
            <h2>Meus vídeos</h2>
            <div class="grupo-botoes">
              <span class="mudo pequeno">Arraste pela alcinha para mudar a ordem no site</span>
              <button class="botao botao-principal" type="button" id="pf-novo">${P.icone("mais", "ico-p")}Adicionar vídeo</button>
            </div>
          </div>
          <div class="tabela-rolagem">
            <table class="tabela">
              <thead><tr><th><span class="sr">Ordem</span></th><th>Vídeo</th><th>Nicho</th><th>Formato</th><th>Destaque</th><th>Link</th><th class="acoes">Ações</th></tr></thead>
              <tbody id="pf-lista"><tr><td colspan="7" class="carregando">Carregando...</td></tr></tbody>
            </table>
          </div>
        </div>`;
      P.$("#pf-novo", s).addEventListener("click", () => abrirForm(null));
      P.$("#pf-lista", s).addEventListener("click", aoClicarNaLista);
      prepararArrasto(P.$("#pf-lista", s));
      await carregar();
    },
    async aoMostrar() { await carregar(); }
  };

  async function carregar() {
    const avisos = P.$(".avisos", secao);
    P.limparAvisos(avisos);
    const inicio = new Date();
    inicio.setHours(0, 0, 0, 0);
    inicio.setDate(inicio.getDate() - 13);
    const [rv, rs] = await Promise.all([
      P.lerSeguro("videos", (q) => q.order("ordem", { ascending: true }).order("criado_em", { ascending: true })),
      P.lerSeguro("visitas", (q) => q.gte("data", inicio.toISOString()).order("data", { ascending: true }).limit(20000))
    ]);
    if (rv.erro) P.avisar(avisos, rv.erro);
    if (rs.erro) P.avisar(avisos, rs.erro);
    P.conferirCampos(avisos, "videos", rv.dados, ["titulo", "link", "nicho", "formato", "marca", "destaque", "ordem", "visivel"]);
    P.conferirCampos(avisos, "visitas", rs.dados, ["data", "pagina", "origem"]);
    videos = rv.dados;
    const visitas = rs.dados.filter((v) => v.data && new Date(v.data) >= inicio);
    desenharNumeros(visitas);
    desenharGrafico(visitas);
    desenharOrigens(visitas);
    desenharVideos();
  }

  /* ---------- Faixa de números ---------- */
  function maisComum(lista) {
    const conta = {};
    lista.forEach((x) => { if (x) conta[x] = (conta[x] || 0) + 1; });
    const ordenado = Object.entries(conta).sort((a, b) => b[1] - a[1]);
    return ordenado.length ? ordenado[0] : null;
  }

  function desenharNumeros(visitas) {
    const hoje = P.hoje();
    const deHoje = visitas.filter((v) => P.isoData(new Date(v.data)) === hoje).length;
    const noArLista = videos.filter(noAr);
    const nicho = maisComum(noArLista.map((v) => v.nicho));
    const origem = maisComum(visitas.map((v) => v.origem || "Direto"));
    const celula = (rotulo, valor, sub) => `<div class="numero"><p class="numero-rotulo">${rotulo}</p><p class="numero-valor" title="${P.esc(valor)}">${P.esc(valor)}</p>${sub ? `<p class="numero-sub">${P.esc(sub)}</p>` : ""}</div>`;
    P.$("#pf-numeros", secao).innerHTML =
      celula("Visitas em 14 dias", P.inteiro(visitas.length)) +
      celula("Visitas hoje", P.inteiro(deHoje)) +
      celula("Vídeos no ar", P.inteiro(noArLista.length)) +
      celula("Nicho mais forte", nicho ? nomeNicho(nicho[0]) : "Nenhum ainda", nicho ? P.plural(nicho[1], "vídeo", "vídeos") : "") +
      celula("De onde mais vêm", origem ? origem[0] : "Nenhuma visita ainda", origem ? P.plural(origem[1], "visita", "visitas") : "");
  }

  /* ---------- Gráfico de barras dos 14 dias ---------- */
  function desenharGrafico(visitas) {
    const dias = [];
    for (let i = 13; i >= 0; i--) {
      const d = new Date();
      d.setHours(0, 0, 0, 0);
      d.setDate(d.getDate() - i);
      dias.push({ iso: P.isoData(d), data: d, total: 0 });
    }
    const porDia = {};
    visitas.forEach((v) => { const iso = P.isoData(new Date(v.data)); porDia[iso] = (porDia[iso] || 0) + 1; });
    dias.forEach((d) => { d.total = porDia[d.iso] || 0; });
    const total = dias.reduce((s, d) => s + d.total, 0);
    P.$("#pf-total14", secao).textContent = P.plural(total, "visita", "visitas");
    const alvo = P.$("#pf-grafico", secao);
    if (total === 0) {
      alvo.innerHTML = `<p class="vazio">Aqui vai aparecer um gráfico com quantas pessoas visitaram o seu portfólio em cada um dos últimos 14 dias. Assim que as primeiras visitas chegarem, as barras começam a subir.</p>`;
      return;
    }
    const maior = Math.max(...dias.map((d) => d.total));
    const hoje = P.hoje();
    alvo.innerHTML = `<div class="grafico" role="img" aria-label="Visitas por dia nos últimos 14 dias">${dias.map((d) => {
      const altura = maior > 0 ? Math.max(2, Math.round((d.total / maior) * 100)) : 2;
      const rotulo = d.data.toLocaleDateString("pt-BR", { day: "2-digit", month: "2-digit" });
      return `<div class="barra-col${d.iso === hoje ? " hoje" : ""}" title="${rotulo}: ${P.plural(d.total, "visita", "visitas")}">
        <span class="barra-valor">${d.total || ""}</span>
        <span class="barra" style="height:${altura}%"></span>
        <span class="barra-dia">${rotulo}</span>
      </div>`;
    }).join("")}</div>`;
  }

  /* ---------- De onde as pessoas chegaram ---------- */
  function desenharOrigens(visitas) {
    const alvo = P.$("#pf-origens", secao);
    if (!visitas.length) {
      alvo.innerHTML = `<p class="vazio">Aqui vai aparecer por onde as pessoas chegaram ao seu portfólio: Instagram, Google, link direto, WhatsApp e outros.</p>`;
      return;
    }
    const conta = {};
    visitas.forEach((v) => { const o = v.origem || "Direto"; conta[o] = (conta[o] || 0) + 1; });
    const lista = Object.entries(conta).sort((a, b) => b[1] - a[1]).slice(0, 8);
    const maior = lista[0][1];
    alvo.innerHTML = `<div class="origens">${lista.map(([nome, qtd]) => {
      const pct = Math.round(P.divide(qtd, visitas.length) * 100);
      const largura = Math.round(P.divide(qtd, maior) * 100);
      return `<div class="origem-linha"><span>${P.esc(nome)}</span><span class="mudo">${P.inteiro(qtd)} (${pct}%)</span><span class="origem-trilho"><span style="width:${largura}%"></span></span></div>`;
    }).join("")}</div>`;
  }

  /* ---------- Tabela dos vídeos ---------- */
  function linkCurto(url) {
    return String(url || "").replace(/^https?:\/\/(www\.)?/, "").replace(/\?.*$/, "");
  }

  function desenharVideos() {
    const corpo = P.$("#pf-lista", secao);
    if (!videos.length) {
      corpo.innerHTML = `<tr><td colspan="7" class="vazio">Nenhum vídeo ainda. Clique em Adicionar vídeo para colocar o primeiro no site.</td></tr>`;
      return;
    }
    corpo.innerHTML = videos.map((v) => {
      const visivel = v.visivel !== false;
      const titulo = v.titulo || v.marca || "Sem título";
      return `<tr data-id="${P.esc(v.id)}" class="${visivel ? "" : "escondido"}">
        <td><button class="alca" type="button" data-alca aria-label="Mudar a ordem de ${P.esc(titulo)}. Use as setas para cima e para baixo." title="Arraste para mudar a ordem">${P.icone("alca")}</button></td>
        <td><b>${P.esc(titulo)}</b>${P.pilulaExemplo(v)}${v.titulo && v.marca ? `<div class="mudo pequeno">${P.esc(v.marca)}</div>` : ""}</td>
        <td class="curta">${P.esc(nomeNicho(v.nicho))}</td>
        <td class="curta">${P.esc(v.formato)}</td>
        <td class="curta">${v.destaque ? P.pilula(v.destaque, "escuro") : ""}</td>
        <td class="corta">${v.link ? `<a class="link-tabela" href="${P.esc(v.link)}" target="_blank" rel="noopener">${P.esc(linkCurto(v.link))}</a>` : ""}</td>
        <td class="acoes">
          <button class="botao botao-icone" type="button" data-acao="olho" aria-label="${visivel ? "Esconder do site" : "Mostrar no site"}" title="${visivel ? "No site. Clique para esconder" : "Escondido. Clique para mostrar"}">${P.icone(visivel ? "olho" : "olho-fechado")}</button>
          <button class="botao botao-icone" type="button" data-acao="editar" aria-label="Editar" title="Editar">${P.icone("editar")}</button>
          <button class="botao botao-icone" type="button" data-acao="apagar" aria-label="Apagar" title="Apagar">${P.icone("lixo")}</button>
        </td>
      </tr>`;
    }).join("");
  }

  async function aoClicarNaLista(e) {
    const botao = e.target.closest("[data-acao]");
    if (!botao) return;
    const id = botao.closest("tr").dataset.id;
    const video = videos.find((v) => String(v.id) === id);
    if (!video) return;
    const acao = botao.dataset.acao;
    if (acao === "editar") abrirForm(video);
    if (acao === "apagar") {
      if (!confirm(`Apagar o vídeo "${video.titulo || video.marca || "sem título"}"? Ele sai do site também.`)) return;
      const erro = await P.gravar("videos", "apagar", null, video.id);
      if (erro) { P.toast(erro, "erro"); return; }
      P.toast("Vídeo apagado.");
      await carregar();
    }
    if (acao === "olho") {
      const novo = video.visivel === false;
      const erro = await P.gravar("videos", "atualizar", { visivel: novo }, video.id);
      if (erro) { P.toast(erro, "erro"); return; }
      video.visivel = novo;
      P.toast(novo ? "Agora aparece no site." : "Escondido do site.");
      desenharVideos();
      await carregar();
    }
  }

  function abrirForm(video) {
    const v = video || { visivel: true, nicho: "beleza" };
    const opcoesNicho = Object.entries(NICHOS);
    if (v.nicho && !NICHOS[v.nicho]) opcoesNicho.push([v.nicho, nomeNicho(v.nicho)]);
    P.formulario({
      titulo: video ? "Editar vídeo" : "Adicionar vídeo",
      valores: v,
      campos: [
        { nome: "link", rotulo: "Link do vídeo", tipo: "url", obrigatorio: true, largo: true, ajuda: "Link do YouTube (Shorts ou normal) toca dentro do site. Outros links abrem numa aba nova." },
        { nome: "marca", rotulo: "Marca", tipo: "texto" },
        { nome: "titulo", rotulo: "Título", tipo: "texto", ajuda: "Opcional. Vazio, o site mostra o nome da marca." },
        { nome: "nicho", rotulo: "Nicho", tipo: "escolha", opcoes: opcoesNicho },
        { nome: "formato", rotulo: "Formato", tipo: "texto", lista: FORMATOS },
        { nome: "destaque", rotulo: "Destaque", tipo: "texto", largo: true, ajuda: "Ex.: 2,4M views. Aparece como etiqueta no vídeo do site." },
        { nome: "visivel", rotulo: "Mostrar no site", tipo: "marcar", largo: true }
      ],
      aoSalvar: async (dados) => {
        if (video) {
          const erro = await P.gravar("videos", "atualizar", dados, video.id);
          if (erro) return erro;
          P.toast("Vídeo salvo. O site já mostra a mudança.");
        } else {
          const maiorOrdem = videos.reduce((m, x) => Math.max(m, P.num(x.ordem)), 0);
          const erro = await P.gravar("videos", "inserir", { ...dados, ordem: maiorOrdem + 1 });
          if (erro) return erro;
          P.toast("Vídeo adicionado ao site.");
        }
        await carregar();
        return null;
      },
      aoApagar: video ? async () => {
        const erro = await P.gravar("videos", "apagar", null, video.id);
        if (erro) return erro;
        P.toast("Vídeo apagado.");
        await carregar();
        return null;
      } : null
    });
  }

  /* ---------- Arrastar pela alcinha para mudar a ordem ---------- */
  function prepararArrasto(corpo) {
    corpo.addEventListener("pointerdown", (e) => {
      const alca = e.target.closest("[data-alca]");
      if (!alca) return;
      e.preventDefault();
      const linha = alca.closest("tr");
      linha.classList.add("arrastando");
      try { alca.setPointerCapture(e.pointerId); } catch (erro) { /* segue sem captura */ }
      const mover = (ev) => {
        const embaixo = document.elementFromPoint(ev.clientX, ev.clientY);
        const alvo = embaixo && embaixo.closest("tr[data-id]");
        if (!alvo || alvo === linha || alvo.parentNode !== corpo) return;
        const caixa = alvo.getBoundingClientRect();
        corpo.insertBefore(linha, ev.clientY > caixa.top + caixa.height / 2 ? alvo.nextSibling : alvo);
      };
      const soltar = () => {
        alca.removeEventListener("pointermove", mover);
        linha.classList.remove("arrastando");
        salvarOrdem();
      };
      alca.addEventListener("pointermove", mover);
      alca.addEventListener("pointerup", soltar, { once: true });
      alca.addEventListener("pointercancel", soltar, { once: true });
    });
    // Pelo teclado: foco na alcinha e setas para cima ou para baixo
    corpo.addEventListener("keydown", (e) => {
      const alca = e.target.closest("[data-alca]");
      if (!alca || (e.key !== "ArrowUp" && e.key !== "ArrowDown")) return;
      e.preventDefault();
      const linha = alca.closest("tr");
      const vizinha = e.key === "ArrowUp" ? linha.previousElementSibling : linha.nextElementSibling;
      if (!vizinha) return;
      corpo.insertBefore(linha, e.key === "ArrowUp" ? vizinha : vizinha.nextSibling);
      alca.focus();
      salvarOrdem();
    });
  }

  async function salvarOrdem() {
    const ids = P.$$("#pf-lista tr[data-id]", secao).map((tr) => tr.dataset.id);
    const mudancas = [];
    ids.forEach((id, i) => {
      const v = videos.find((x) => String(x.id) === id);
      if (v && P.num(v.ordem) !== i + 1) { v.ordem = i + 1; mudancas.push(v); }
    });
    if (!mudancas.length) return;
    videos.sort((a, b) => P.num(a.ordem) - P.num(b.ordem));
    const erros = (await Promise.all(mudancas.map((v) => P.gravar("videos", "atualizar", { ordem: v.ordem }, v.id)))).filter(Boolean);
    if (erros.length) { P.toast(erros[0], "erro"); await carregar(); return; }
    P.toast("Ordem salva. O site já mostra nessa ordem.");
  }
})();
