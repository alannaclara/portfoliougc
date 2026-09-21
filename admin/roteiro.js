/* =========================================================
   ABA ROTEIRO
   Escreve o roteiro uma vez, gera para várias marcas, e manda
   um link de aprovação para a marca ver. O painel avisa quando ela abriu.
   ========================================================= */
(function () {
  "use strict";
  const P = window.Painel;

  const STATUS = [
    ["Rascunho", "cinza"],
    ["Aprovação", "amarelo"],
    ["Ajuste", "pessego"],
    ["Aprovado", "verde"],
    ["Finalizado", "escuro"]
  ];
  const corStatus = (s) => (STATUS.find((x) => x[0] === s) || [0, "cinza"])[1];

  const CATEGORIAS = ["Conteúdo para o meu perfil", "Conteúdo UGC", "Publicidade"];
  const FONTES = [
    ["", "Fonte do painel"],
    ["Plus Jakarta Sans, sans-serif", "Plus Jakarta Sans"],
    ["Georgia, serif", "Georgia"],
    ["Arial, Helvetica, sans-serif", "Arial"],
    ["Verdana, sans-serif", "Verdana"],
    ["Courier New, monospace", "Courier New"]
  ];
  const TAMANHOS = [["", "Tamanho"], ["2", "Pequeno"], ["3", "Normal"], ["4", "Médio"], ["5", "Grande"], ["6", "Enorme"]];

  let secao = null;
  let roteiros = [];
  let campanhas = [];
  let marcasBase = [];
  let busca = "";
  let filtro = "todos";
  let atual = null;      // o roteiro aberto na janela
  let moodboard = [];    // [{url, caminho, x, y, z, link}]
  let fotoEscolhida = -1;

  const enderecoPublico = () => location.href.replace(/admin\/[^/]*$/, "") + "roteiro.html";

  /* =========================================================
     LIMPAR O HTML
     O roteiro vira uma página que a marca abre. Antes de guardar e
     antes de mostrar, tiro tudo que não for formatação de texto.
     ========================================================= */
  const TAGS_OK = ["B", "STRONG", "I", "EM", "U", "S", "STRIKE", "SPAN", "DIV", "P", "BR", "UL", "OL", "LI", "A", "FONT", "H1", "H2", "H3", "BLOCKQUOTE"];
  const ESTILOS_OK = ["color", "background-color", "font-weight", "font-style", "text-decoration", "text-align", "font-family", "font-size"];

  function limparHtml(sujo) {
    const caixa = document.createElement("div");
    caixa.innerHTML = String(sujo || "");
    const revisar = (no) => {
      Array.from(no.children).forEach((filho) => {
        if (!TAGS_OK.includes(filho.tagName)) {
          const texto = document.createTextNode(filho.textContent || "");
          filho.replaceWith(texto);
          return;
        }
        Array.from(filho.attributes).forEach((atributo) => {
          const nome = atributo.name.toLowerCase();
          if (nome === "style") {
            const limpo = atributo.value.split(";").map((p) => p.trim()).filter((p) => {
              const prop = p.split(":")[0].trim().toLowerCase();
              return ESTILOS_OK.includes(prop) && !/url\s*\(|expression|javascript:/i.test(p);
            }).join("; ");
            if (limpo) filho.setAttribute("style", limpo); else filho.removeAttribute("style");
            return;
          }
          if (filho.tagName === "A" && nome === "href") {
            if (!/^(https?:|mailto:)/i.test(atributo.value.trim())) filho.removeAttribute("href");
            else { filho.setAttribute("target", "_blank"); filho.setAttribute("rel", "noopener noreferrer"); }
            return;
          }
          if (filho.tagName === "FONT" && (nome === "size" || nome === "color" || nome === "face")) return;
          if (nome === "target" || nome === "rel") return;
          filho.removeAttribute(atributo.name);
        });
        revisar(filho);
      });
    };
    revisar(caixa);
    return caixa.innerHTML;
  }

  // Troca {{marca}} e {{nome}} pelo nome da marca do roteiro
  function personalizar(texto, marca) {
    const completo = String(marca || "").trim();
    const primeiro = completo.split(/\s+/)[0] || completo;
    return String(texto || "")
      .replace(/\{\{\s*marca\s*\}\}/gi, completo)
      .replace(/\{\{\s*nome\s*\}\}/gi, primeiro);
  }

  /* =========================================================
     CORES (o seletor da imagem de referência)
     ========================================================= */
  function hexParaRgb(hex) {
    const h = String(hex || "").replace("#", "").trim();
    const c = h.length === 3 ? h.split("").map((x) => x + x).join("") : h;
    if (!/^[0-9a-f]{6}$/i.test(c)) return null;
    return [parseInt(c.slice(0, 2), 16), parseInt(c.slice(2, 4), 16), parseInt(c.slice(4, 6), 16)];
  }
  function rgbParaHsv(r, g, b) {
    r /= 255; g /= 255; b /= 255;
    const max = Math.max(r, g, b), min = Math.min(r, g, b), d = max - min;
    let h = 0;
    if (d) {
      if (max === r) h = ((g - b) / d) % 6;
      else if (max === g) h = (b - r) / d + 2;
      else h = (r - g) / d + 4;
      h *= 60;
      if (h < 0) h += 360;
    }
    return [h, max ? d / max : 0, max];
  }
  function hsvParaHex(h, s, v) {
    const c = v * s, x = c * (1 - Math.abs(((h / 60) % 2) - 1)), m = v - c;
    let r = 0, g = 0, b = 0;
    if (h < 60) [r, g, b] = [c, x, 0];
    else if (h < 120) [r, g, b] = [x, c, 0];
    else if (h < 180) [r, g, b] = [0, c, x];
    else if (h < 240) [r, g, b] = [0, x, c];
    else if (h < 300) [r, g, b] = [x, 0, c];
    else [r, g, b] = [c, 0, x];
    const p = (n) => Math.round((n + m) * 255).toString(16).padStart(2, "0");
    return "#" + p(r) + p(g) + p(b);
  }

  let seletor = null;
  function abrirSeletorDeCor(botao, corInicial, aoMudar) {
    fecharSeletorDeCor();
    const rgb = hexParaRgb(corInicial) || [167, 235, 242];
    let [h, s, v] = rgbParaHsv(rgb[0], rgb[1], rgb[2]);

    const caixa = document.createElement("div");
    caixa.className = "seletor-cor";
    caixa.innerHTML = `
      <div class="sc-abas"><span class="sc-aba ativa">Cor sólida</span></div>
      <div class="sc-area" tabindex="0" role="application" aria-label="Escolher a cor"><span class="sc-bolinha"></span></div>
      <div class="sc-matiz"><input type="range" min="0" max="360" step="1" aria-label="Matiz"></div>
      <div class="sc-baixo">
        <input class="sc-hex" type="text" maxlength="7" spellcheck="false" aria-label="Código hex da cor">
        <button class="botao botao-icone sc-pipeta" type="button" title="Pegar uma cor da tela" aria-label="Pegar uma cor da tela">${P.icone("pipeta")}</button>
      </div>`;
    // Tem que nascer DENTRO da janela aberta. Nascendo fora, ele aparece
    // atrás dela e não aceita clique nenhum.
    (botao.closest("dialog") || document.body).appendChild(caixa);

    const area = P.$(".sc-area", caixa);
    const bolinha = P.$(".sc-bolinha", caixa);
    const matiz = P.$(".sc-matiz input", caixa);
    const hex = P.$(".sc-hex", caixa);
    const pipeta = P.$(".sc-pipeta", caixa);
    if (!window.EyeDropper) pipeta.hidden = true;

    function desenhar(avisar) {
      const cor = hsvParaHex(h, s, v);
      area.style.background = `linear-gradient(to top, #000, rgba(0,0,0,0)), linear-gradient(to right, #fff, rgba(255,255,255,0)), hsl(${h} 100% 50%)`;
      bolinha.style.left = `${s * 100}%`;
      bolinha.style.top = `${(1 - v) * 100}%`;
      bolinha.style.background = cor;
      if (document.activeElement !== hex) hex.value = cor.toUpperCase();
      matiz.value = Math.round(h);
      if (avisar !== false) aoMudar(cor);
    }

    function pegarNaArea(e) {
      const c = area.getBoundingClientRect();
      s = Math.min(1, Math.max(0, (e.clientX - c.left) / c.width));
      v = 1 - Math.min(1, Math.max(0, (e.clientY - c.top) / c.height));
      desenhar();
    }
    area.addEventListener("pointerdown", (e) => {
      e.preventDefault();
      area.setPointerCapture(e.pointerId);
      pegarNaArea(e);
      const mover = (ev) => pegarNaArea(ev);
      area.addEventListener("pointermove", mover);
      area.addEventListener("pointerup", () => area.removeEventListener("pointermove", mover), { once: true });
    });
    area.addEventListener("keydown", (e) => {
      const passo = e.shiftKey ? 0.1 : 0.02;
      if (e.key === "ArrowRight") s = Math.min(1, s + passo);
      else if (e.key === "ArrowLeft") s = Math.max(0, s - passo);
      else if (e.key === "ArrowUp") v = Math.min(1, v + passo);
      else if (e.key === "ArrowDown") v = Math.max(0, v - passo);
      else return;
      e.preventDefault();
      desenhar();
    });
    matiz.addEventListener("input", () => { h = Number(matiz.value); desenhar(); });
    hex.addEventListener("input", () => {
      const t = hex.value.trim();
      const r = hexParaRgb(t);
      if (!r) return;
      [h, s, v] = rgbParaHsv(r[0], r[1], r[2]);
      desenhar();
    });
    pipeta.addEventListener("click", async () => {
      try {
        const escolhida = await new window.EyeDropper().open();
        const r = hexParaRgb(escolhida.sRGBHex);
        if (!r) return;
        [h, s, v] = rgbParaHsv(r[0], r[1], r[2]);
        desenhar();
      } catch (e) { /* cancelou */ }
    });

    // Fica encostado no botão, sem passar da borda da tela
    const c = botao.getBoundingClientRect();
    const largura = 232, altura = 268;
    caixa.style.left = `${Math.max(8, Math.min(window.innerWidth - largura - 8, c.left + c.width / 2 - largura / 2))}px`;
    caixa.style.top = `${c.bottom + 8 + altura > window.innerHeight ? Math.max(8, c.top - altura - 8) : c.bottom + 8}px`;
    desenhar(false);

    const foraDaCaixa = (e) => { if (!caixa.contains(e.target) && e.target !== botao && !botao.contains(e.target)) fecharSeletorDeCor(); };
    const aoTeclar = (e) => { if (e.key === "Escape") { e.stopPropagation(); fecharSeletorDeCor(); } };
    const aoRolar = (e) => { if (!caixa.contains(e.target)) fecharSeletorDeCor(); };
    setTimeout(() => {
      document.addEventListener("pointerdown", foraDaCaixa, true);
      document.addEventListener("keydown", aoTeclar, true);
      document.addEventListener("scroll", aoRolar, true);
    }, 0);
    seletor = { caixa, foraDaCaixa, aoTeclar, aoRolar };
    area.focus();
  }
  function fecharSeletorDeCor() {
    if (!seletor) return;
    document.removeEventListener("pointerdown", seletor.foraDaCaixa, true);
    document.removeEventListener("keydown", seletor.aoTeclar, true);
    document.removeEventListener("scroll", seletor.aoRolar, true);
    seletor.caixa.remove();
    seletor = null;
  }

  /* =========================================================
     A ABA
     ========================================================= */
  P.abas.roteiro = {
    async iniciar(s) {
      secao = s;
      s.innerHTML = `
        <div class="avisos"></div>
        <div class="ferramentas">
          <label class="busca"><span class="sr">Buscar</span>${P.icone("busca", "ico-p")}<input type="search" id="rt-busca" placeholder="Buscar por marca, produto ou categoria"></label>
          <div class="filtros" id="rt-filtros" role="group" aria-label="Filtrar por status"></div>
          <div class="grupo-botoes empurra">
            <button class="botao botao-principal" type="button" id="rt-novo">${P.icone("mais", "ico-p")}Novo roteiro</button>
          </div>
        </div>
        <div id="rt-lista"><p class="carregando">Carregando...</p></div>`;

      P.$("#rt-busca", s).addEventListener("input", (e) => { busca = e.target.value.trim().toLowerCase(); desenharLista(); });
      P.$("#rt-filtros", s).addEventListener("click", (e) => {
        const b = e.target.closest("[data-filtro]");
        if (!b) return;
        filtro = b.dataset.filtro;
        desenharLista();
      });
      P.$("#rt-novo", s).addEventListener("click", () => abrirJanela(null));
      P.$("#rt-lista", s).addEventListener("click", aoClicarNaLista);
      P.$("#rt-lista", s).addEventListener("keydown", (e) => {
        if (e.key !== "Enter" && e.key !== " ") return;
        const cartao = e.target.closest("[data-id]");
        if (!cartao) return;
        e.preventDefault();
        cartao.click();
      });
      montarJanela();
      prepararJanela();
      await carregar();
    },
    async aoMostrar() { await carregar(); }
  };

  async function carregar() {
    const avisos = P.$(".avisos", secao);
    P.limparAvisos(avisos);
    const [rr, rc, rm] = await Promise.all([
      P.lerSeguro("roteiros", (q) => q.order("criado_em", { ascending: false })),
      P.ler("campanhas"),
      P.ler("marcas")
    ]);
    if (rr.erro) P.avisar(avisos, rr.erro.replace("banco.sql", "roteiro.sql"));
    roteiros = rr.dados;
    campanhas = rc.dados;
    marcasBase = rm.dados;
    desenharLista();
  }

  function filtrados() {
    return roteiros.filter((r) => {
      if (filtro !== "todos" && r.status !== filtro) return false;
      if (!busca) return true;
      return [r.marca, r.produto, r.categoria].some((c) => String(c || "").toLowerCase().includes(busca));
    });
  }

  function desenharLista() {
    const conta = (s) => roteiros.filter((r) => r.status === s).length;
    P.$("#rt-filtros", secao).innerHTML =
      `<button class="filtro" type="button" data-filtro="todos" aria-pressed="${filtro === "todos"}">Todos<span class="qtd">${roteiros.length}</span></button>` +
      STATUS.map(([nome]) => `<button class="filtro" type="button" data-filtro="${P.esc(nome)}" aria-pressed="${filtro === nome}">${P.esc(nome)}<span class="qtd">${conta(nome)}</span></button>`).join("");

    const lista = filtrados();
    const alvo = P.$("#rt-lista", secao);
    if (!roteiros.length) {
      alvo.innerHTML = `<div class="cartao"><p class="vazio">Nenhum roteiro ainda. Clique em <b>Novo roteiro</b> para escrever o primeiro. Dentro do roteiro, onde você escrever <b>{{marca}}</b>, entra o nome da marca sozinho, e aí dá para gerar o mesmo roteiro para várias marcas de uma vez.</p></div>`;
      return;
    }
    if (!lista.length) {
      alvo.innerHTML = `<div class="cartao"><p class="vazio">Nenhum roteiro com essa busca ou filtro.</p></div>`;
      return;
    }
    alvo.innerHTML = `<div class="rt-grade">${lista.map((r) => {
      const campanha = campanhas.find((c) => c.id === r.campanha_id);
      const fotos = Array.isArray(r.moodboard) ? r.moodboard.length : 0;
      return `<article class="rt-cartao" data-id="${P.esc(r.id)}" tabindex="0" role="button" style="${r.cor_ativa ? `--cor-marca:${P.esc(r.cor)}` : ""}">
        <span class="rt-fita${r.cor_ativa ? " rt-fita-marca" : ""}" aria-hidden="true"></span>
        <div class="rt-cartao-topo">
          <b>${P.esc(personalizar(r.marca, r.marca) || "Sem marca")}</b>
          ${P.pilula(r.status, corStatus(r.status))}
        </div>
        <p class="mudo pequeno">${[r.produto, r.categoria].filter(Boolean).map(P.esc).join(" · ") || "Sem produto nem categoria"}</p>
        <div class="rt-cartao-pes">
          ${campanha ? `<span class="pilula p-ciano" title="Trabalho vinculado">${P.esc(campanha.campanha || campanha.cliente)}</span>` : ""}
          ${fotos ? `<span class="mudo pequeno">${P.plural(fotos, "foto", "fotos")}</span>` : ""}
          <span class="mudo pequeno empurra">${r.visto_em ? `Visto ${P.esc(quando(r.visto_em))}` : "Ainda não visto"}</span>
        </div>
      </article>`;
    }).join("")}</div>`;
  }

  function quando(iso) {
    const d = iso ? new Date(iso) : null;
    if (!d || isNaN(d)) return "";
    const seg = Math.round((Date.now() - d.getTime()) / 1000);
    if (seg < 60) return "agora mesmo";
    if (seg < 3600) return `há ${P.plural(Math.round(seg / 60), "minuto", "minutos")}`;
    if (seg < 86400) return `há ${P.plural(Math.round(seg / 3600), "hora", "horas")}`;
    const dias = Math.round(seg / 86400);
    if (dias === 1) return "ontem";
    if (dias < 30) return `há ${P.plural(dias, "dia", "dias")}`;
    return "em " + d.toLocaleDateString("pt-BR");
  }

  function aoClicarNaLista(e) {
    const cartao = e.target.closest("[data-id]");
    if (!cartao) return;
    const r = roteiros.find((x) => String(x.id) === cartao.dataset.id);
    if (r) abrirJanela(r);
  }

  /* =========================================================
     A JANELA DO ROTEIRO
     ========================================================= */
  const $j = (sel) => P.$(sel, P.$("#janela-roteiro"));

  function prepararJanela() {
    const janela = P.$("#janela-roteiro");
    if (!janela || janela.dataset.pronta) return;
    janela.dataset.pronta = "1";

    P.$$("[data-fechar]", janela).forEach((b) => b.addEventListener("click", () => fecharJanela()));
    janela.addEventListener("close", () => { fecharSeletorDeCor(); atual = null; });

    $j("#rt-form").addEventListener("submit", async (e) => { e.preventDefault(); await salvar(); });

    // Barra de formatação
    $j("#rt-barra").addEventListener("mousedown", (e) => { if (e.target.closest("button")) e.preventDefault(); });
    $j("#rt-barra").addEventListener("click", (e) => {
      const b = e.target.closest("[data-cmd]");
      if (!b) return;
      const cmd = b.dataset.cmd;
      if (cmd === "cor" || cmd === "destaque") {
        abrirSeletorDeCor(b, cmd === "cor" ? "#173b43" : "#fff3a3", (nova) => {
          comando(cmd === "cor" ? "foreColor" : "hiliteColor", nova, cmd === "destaque");
        });
        return;
      }
      if (cmd === "link") { inserirLink(); return; }
      comando(cmd);
    });
    $j("#rt-fonte").addEventListener("change", (e) => { comando("fontName", e.target.value); e.target.selectedIndex = 0; });
    $j("#rt-tamanho").addEventListener("change", (e) => { comando("fontSize", e.target.value); e.target.selectedIndex = 0; });

    // Editor
    const editor = $j("#rt-editor");
    editor.addEventListener("input", () => marcarVazio());
    editor.addEventListener("paste", (e) => {
      e.preventDefault();
      const texto = (e.clipboardData || window.clipboardData).getData("text/plain");
      document.execCommand("insertText", false, texto);
    });

    // Cor da marca
    $j("#rt-cor-ativa").addEventListener("change", (e) => {
      $j("#rt-bolinha").disabled = !e.target.checked;
      aplicarCorNaJanela();
    });
    $j("#rt-bolinha").addEventListener("click", (ev) => {
      abrirSeletorDeCor(ev.currentTarget, $j("#rt-bolinha").dataset.cor || "#a7ebf2", (nova) => {
        $j("#rt-bolinha").dataset.cor = nova;
        aplicarCorNaJanela();
      });
    });

    // Visualização
    $j("#rt-recarregar").addEventListener("click", conferirVisualizacao);

    // Moodboard
    $j("#rt-anexar").addEventListener("click", () => $j("#rt-arquivo").click());
    $j("#rt-arquivo").addEventListener("change", subirFotos);
    $j("#rt-colar-link").addEventListener("click", colarLinkDeImagem);
    $j("#rt-foto-link").addEventListener("input", (e) => {
      if (fotoEscolhida < 0) return;
      moodboard[fotoEscolhida].link = e.target.value.trim();
      desenharMoodboard();
    });
    $j("#rt-foto-abrir").addEventListener("click", () => {
      const l = fotoEscolhida >= 0 ? moodboard[fotoEscolhida].link : "";
      if (l) window.open(l, "_blank", "noopener");
    });
    $j("#rt-foto-tirar").addEventListener("click", tirarFoto);

    // Rodapé
    $j("#rt-copiar").addEventListener("click", copiarTudo);
    $j("#rt-varias").addEventListener("click", gerarParaVarias);
    $j("#rt-apagar").addEventListener("click", apagar);
    $j("#rt-copiar-link").addEventListener("click", copiarLink);
    $j("#rt-abrir-link").addEventListener("click", () => { const l = linkDoRoteiro(); if (l) window.open(l, "_blank", "noopener"); });
    $j("#rt-link-ligado").addEventListener("change", () => mostrarLink());
  }

  function comando(nome, valor, comCss) {
    $j("#rt-editor").focus();
    try {
      if (comCss) document.execCommand("styleWithCSS", false, true);
      document.execCommand(nome, false, valor === undefined ? null : valor);
      if (comCss) document.execCommand("styleWithCSS", false, false);
    } catch (e) { P.toast("Esse navegador não deixou aplicar essa formatação.", "erro"); }
    marcarVazio();
  }

  function inserirLink() {
    const editor = $j("#rt-editor");
    editor.focus();
    const selecao = String(window.getSelection() || "");
    const url = prompt(selecao ? `Link para "${selecao}":` : "Cole o link:", "https://");
    if (!url || !/^https?:\/\/.+/i.test(url.trim())) { if (url !== null) P.toast("O link tem que começar com https://", "erro"); return; }
    if (selecao) comando("createLink", url.trim());
    else {
      document.execCommand("insertHTML", false, `<a href="${P.esc(url.trim())}" target="_blank" rel="noopener noreferrer">${P.esc(url.trim())}</a>`);
      marcarVazio();
    }
  }

  const marcarVazio = () => {
    const e = $j("#rt-editor");
    e.classList.toggle("vazio", !e.textContent.trim() && !e.querySelector("img"));
  };

  function aplicarCorNaJanela() {
    const ligada = $j("#rt-cor-ativa").checked;
    const cor = $j("#rt-bolinha").dataset.cor || "#a7ebf2";
    $j("#rt-bolinha").style.background = cor;
    P.$("#janela-roteiro").style.setProperty("--cor-marca", ligada ? cor : "var(--azul)");
    P.$("#janela-roteiro").classList.toggle("com-cor", ligada);
  }

  function opcoesDeCampanha(escolhida) {
    const ativas = campanhas.filter((c) => c.ativa !== false && !c.exemplo);
    const paradas = campanhas.filter((c) => c.ativa === false && !c.exemplo);
    const linha = (c) => `<option value="${P.esc(c.id)}"${String(escolhida) === String(c.id) ? " selected" : ""}>${P.esc(c.campanha || "Sem nome")}${c.cliente ? ` (${P.esc(c.cliente)})` : ""}</option>`;
    return `<option value="">Nenhum</option>` +
      (ativas.length ? `<optgroup label="Campanhas ativas">${ativas.map(linha).join("")}</optgroup>` : "") +
      (paradas.length ? `<optgroup label="Campanhas encerradas">${paradas.map(linha).join("")}</optgroup>` : "");
  }

  function abrirJanela(r) {
    atual = r;
    moodboard = r && Array.isArray(r.moodboard) ? JSON.parse(JSON.stringify(r.moodboard)) : [];
    fotoEscolhida = -1;

    $j("#rt-marca").value = r ? r.marca : "";
    $j("#rt-status").value = r ? r.status : "Rascunho";
    $j("#rt-produto").value = r ? r.produto : "";
    $j("#rt-categoria").value = r ? r.categoria : "";
    $j("#rt-dmin").value = r ? r.duracao_min : "";
    $j("#rt-dmax").value = r ? r.duracao_max : "";
    $j("#rt-campanha").innerHTML = opcoesDeCampanha(r ? r.campanha_id : "");
    $j("#rt-editor").innerHTML = r ? limparHtml(r.roteiro) : "";
    $j("#rt-cor-ativa").checked = !!(r && r.cor_ativa);
    $j("#rt-bolinha").dataset.cor = (r && r.cor) || "#a7ebf2";
    $j("#rt-bolinha").disabled = !(r && r.cor_ativa);
    $j("#rt-link-ligado").checked = r ? r.link_ligado !== false : true;
    $j("#rt-apagar").hidden = !r;
    $j("#rt-varias").hidden = false;
    $j("#rt-titulo-janela").textContent = r ? "Editar roteiro" : "Novo roteiro";

    aplicarCorNaJanela();
    marcarVazio();
    desenharVisualizacao();
    desenharMoodboard();
    mostrarLink();

    const janela = P.$("#janela-roteiro");
    if (typeof janela.showModal === "function") janela.showModal(); else janela.setAttribute("open", "");
    $j("#rt-marca").focus();
  }

  function fecharJanela() {
    const janela = P.$("#janela-roteiro");
    if (janela.open) janela.close();
  }

  function desenharVisualizacao() {
    const alvo = $j("#rt-visu-texto");
    if (!atual) { alvo.textContent = "Salve o roteiro para gerar o link da marca."; return; }
    if (!atual.visto_em) { alvo.textContent = "Ainda não visualizado pela marca."; return; }
    const d = new Date(atual.visto_em);
    alvo.innerHTML = `<b>Visualizado ${P.esc(quando(atual.visto_em))}</b><br><span class="mudo">${P.esc(d.toLocaleString("pt-BR"))}${atual.visualizacoes > 1 ? `, ${P.plural(atual.visualizacoes, "vez", "vezes")}` : ""}</span>`;
  }

  async function conferirVisualizacao() {
    if (!atual) { P.toast("Salve o roteiro primeiro."); return; }
    const botao = $j("#rt-recarregar");
    botao.classList.add("girando");
    const r = await P.ler("roteiros", (q) => q.eq("id", atual.id));
    botao.classList.remove("girando");
    if (r.erro || !r.dados.length) { P.toast("Não consegui conferir agora.", "erro"); return; }
    const antes = atual.visto_em;
    atual.visto_em = r.dados[0].visto_em;
    atual.visualizacoes = r.dados[0].visualizacoes;
    desenharVisualizacao();
    const novo = roteiros.find((x) => x.id === atual.id);
    if (novo) { novo.visto_em = atual.visto_em; novo.visualizacoes = atual.visualizacoes; }
    P.toast(atual.visto_em ? (antes === atual.visto_em ? "Sem novidade desde a última vez." : "A marca abriu o roteiro.") : "A marca ainda não abriu.");
  }

  /* ---------- O link de aprovação ---------- */
  const linkDoRoteiro = () => (atual && atual.token ? `${enderecoPublico()}?r=${atual.token}` : "");

  function mostrarLink() {
    const caixa = $j("#rt-link-caixa");
    const link = linkDoRoteiro();
    caixa.hidden = !link;
    if (!link) return;
    const ligado = $j("#rt-link-ligado").checked;
    $j("#rt-link-texto").textContent = ligado ? link : "Link desligado. A marca vê uma página dizendo que o link não está disponível.";
    $j("#rt-copiar-link").disabled = !ligado;
    $j("#rt-abrir-link").disabled = !ligado;
  }

  async function copiarLink() {
    const link = linkDoRoteiro();
    if (!link) return;
    try { await navigator.clipboard.writeText(link); P.toast("Link copiado. Pode mandar para a marca."); }
    catch (e) { P.toast("Não consegui copiar. Selecione o link e use Ctrl C.", "erro"); }
  }

  /* =========================================================
     MOODBOARD
     ========================================================= */
  function desenharMoodboard() {
    const palco = $j("#rt-palco");
    if (!moodboard.length) {
      palco.innerHTML = `<p class="rt-palco-vazio">Nenhuma foto ainda. Use o botão <b>Anexar foto</b> aqui embaixo.</p>`;
    } else {
      palco.innerHTML = moodboard.map((f, i) => `
        <div class="rt-foto${i === fotoEscolhida ? " escolhida" : ""}" data-foto="${i}" style="left:${P.num(f.x)}%;top:${P.num(f.y)}%;z-index:${P.num(f.z) || 1}" tabindex="0" role="button" aria-label="Foto ${i + 1} do moodboard">
          <img src="${P.esc(f.url)}" alt="" draggable="false">
          ${f.link ? `<span class="rt-foto-selo" title="${P.esc(f.link)}">${P.icone("link", "ico-p")}</span>` : ""}
        </div>`).join("");
    }
    const painel = $j("#rt-foto-painel");
    painel.hidden = fotoEscolhida < 0;
    if (fotoEscolhida >= 0) {
      $j("#rt-foto-link").value = moodboard[fotoEscolhida].link || "";
      $j("#rt-foto-abrir").disabled = !moodboard[fotoEscolhida].link;
    }
    $j("#rt-mood-conta").textContent = moodboard.length ? P.plural(moodboard.length, "foto", "fotos") : "";
  }

  function prepararArrastoDaFoto(palco) {
    palco.addEventListener("pointerdown", (e) => {
      const caixa = e.target.closest("[data-foto]");
      if (!caixa) return;
      e.preventDefault();
      const i = Number(caixa.dataset.foto);
      fotoEscolhida = i;
      moodboard[i].z = Math.max(0, ...moodboard.map((f) => P.num(f.z))) + 1;
      const area = palco.getBoundingClientRect();
      const dentro = caixa.getBoundingClientRect();
      const dx = e.clientX - dentro.left;
      const dy = e.clientY - dentro.top;
      let arrastou = false;
      caixa.setPointerCapture(e.pointerId);
      caixa.classList.add("arrastando");

      const mover = (ev) => {
        arrastou = true;
        const x = ((ev.clientX - dx - area.left) / area.width) * 100;
        const y = ((ev.clientY - dy - area.top) / area.height) * 100;
        moodboard[i].x = Math.min(92, Math.max(0, x));
        moodboard[i].y = Math.min(88, Math.max(0, y));
        caixa.style.left = `${moodboard[i].x}%`;
        caixa.style.top = `${moodboard[i].y}%`;
        caixa.style.zIndex = moodboard[i].z;
      };
      const soltar = () => {
        caixa.removeEventListener("pointermove", mover);
        caixa.classList.remove("arrastando");
        desenharMoodboard();
        void arrastou;
      };
      caixa.addEventListener("pointermove", mover);
      caixa.addEventListener("pointerup", soltar, { once: true });
      caixa.addEventListener("pointercancel", soltar, { once: true });
    });
    // Pelo teclado
    palco.addEventListener("keydown", (e) => {
      const caixa = e.target.closest("[data-foto]");
      if (!caixa) return;
      const i = Number(caixa.dataset.foto);
      const passo = e.shiftKey ? 8 : 2;
      if (e.key === "ArrowRight") moodboard[i].x = Math.min(92, P.num(moodboard[i].x) + passo);
      else if (e.key === "ArrowLeft") moodboard[i].x = Math.max(0, P.num(moodboard[i].x) - passo);
      else if (e.key === "ArrowDown") moodboard[i].y = Math.min(88, P.num(moodboard[i].y) + passo);
      else if (e.key === "ArrowUp") moodboard[i].y = Math.max(0, P.num(moodboard[i].y) - passo);
      else if (e.key === "Enter" || e.key === " ") { fotoEscolhida = i; }
      else return;
      e.preventDefault();
      desenharMoodboard();
      const dnovo = P.$(`[data-foto="${i}"]`, palco);
      if (dnovo) dnovo.focus();
    });
  }

  async function subirFotos(e) {
    const arquivos = Array.from(e.target.files || []);
    e.target.value = "";
    if (!arquivos.length) return;
    const botao = $j("#rt-anexar");
    botao.disabled = true;
    let entraram = 0, falhas = 0;
    for (const arquivo of arquivos) {
      if (!/^image\//.test(arquivo.type)) { falhas++; continue; }
      if (arquivo.size > 8 * 1024 * 1024) { P.toast(`"${arquivo.name}" passa de 8 MB. Diminua a foto e tente de novo.`, "erro"); falhas++; continue; }
      botao.textContent = `Subindo ${entraram + 1} de ${arquivos.length}...`;
      const limpo = arquivo.name.normalize("NFD").replace(/[^\w.\-]/g, "-").slice(-60);
      const caminho = `${(atual && atual.id) || "novos"}/${Date.now()}-${Math.random().toString(36).slice(2, 7)}-${limpo}`;
      try {
        const { error } = await banco.storage.from("moodboard").upload(caminho, arquivo, { cacheControl: "31536000", upsert: false });
        if (error) throw error;
        const { data } = banco.storage.from("moodboard").getPublicUrl(caminho);
        acrescentarFoto(data.publicUrl, caminho);
        entraram++;
      } catch (erro) {
        falhas++;
        console.error(erro);
      }
    }
    botao.disabled = false;
    botao.innerHTML = `${P.icone("mais", "ico-p")}Anexar foto`;
    desenharMoodboard();
    if (falhas) P.toast(falhas === 1 ? "Uma foto não subiu. Confira se o roteiro.sql foi rodado inteiro." : `${falhas} fotos não subiram.`, "erro");
    else if (entraram) P.toast(P.plural(entraram, "foto entrou", "fotos entraram") + ". Arraste para posicionar.");
  }

  function colarLinkDeImagem() {
    const url = prompt("Cole o endereço da imagem (precisa terminar em jpg, png, webp ou gif):", "https://");
    if (!url) return;
    if (!/^https?:\/\/.+/i.test(url.trim())) { P.toast("O endereço tem que começar com https://", "erro"); return; }
    acrescentarFoto(url.trim(), "");
    desenharMoodboard();
  }

  function acrescentarFoto(url, caminho) {
    const n = moodboard.length;
    moodboard.push({
      url, caminho, link: "",
      x: Math.min(70, 4 + (n % 5) * 17),
      y: Math.min(60, 6 + Math.floor(n / 5) * 26),
      z: n + 1
    });
    fotoEscolhida = moodboard.length - 1;
  }

  async function tirarFoto() {
    if (fotoEscolhida < 0) return;
    const f = moodboard[fotoEscolhida];
    if (!confirm("Tirar esta foto do moodboard?")) return;
    if (f.caminho) {
      try { await banco.storage.from("moodboard").remove([f.caminho]); } catch (e) { /* o importante é sair do moodboard */ }
    }
    moodboard.splice(fotoEscolhida, 1);
    fotoEscolhida = -1;
    desenharMoodboard();
  }

  /* =========================================================
     SALVAR, COPIAR, GERAR, APAGAR
     ========================================================= */
  function lerJanela() {
    return {
      marca: $j("#rt-marca").value.trim().slice(0, 200),
      status: $j("#rt-status").value,
      cor: $j("#rt-bolinha").dataset.cor || "#a7ebf2",
      cor_ativa: $j("#rt-cor-ativa").checked,
      produto: $j("#rt-produto").value.trim().slice(0, 300),
      categoria: $j("#rt-categoria").value.trim().slice(0, 200),
      duracao_min: $j("#rt-dmin").value.trim().slice(0, 40),
      duracao_max: $j("#rt-dmax").value.trim().slice(0, 40),
      campanha_id: $j("#rt-campanha").value || null,
      roteiro: limparHtml($j("#rt-editor").innerHTML).slice(0, 200000),
      moodboard,
      link_ligado: $j("#rt-link-ligado").checked,
      atualizado_em: new Date().toISOString()
    };
  }

  async function salvar() {
    const dados = lerJanela();
    if (!dados.marca) { P.toast("Escreva o nome da marca lá em cima.", "erro"); $j("#rt-marca").focus(); return; }
    const botao = $j("#rt-salvar");
    botao.disabled = true;
    let erro;
    if (atual) erro = await P.gravar("roteiros", "atualizar", dados, atual.id);
    else erro = await P.gravar("roteiros", "inserir", dados);
    botao.disabled = false;
    if (erro) { P.toast(erro.replace("banco.sql", "roteiro.sql"), "erro"); return; }
    const eraNovo = !atual;
    P.toast(eraNovo ? "Roteiro criado. O link da marca já está pronto." : "Roteiro salvo.");
    await carregar();
    if (eraNovo) {
      // A lista vem da mais nova para a mais velha, então a primeira é a que acabei de criar
      if (roteiros.length) { abrirJanela(roteiros[0]); return; }
    }
    fecharJanela();
  }

  async function apagar() {
    if (!atual) return;
    if (!confirm(`Apagar o roteiro de "${atual.marca || "sem marca"}"? Isso não tem volta, e o link da marca para de funcionar.`)) return;
    const caminhos = (atual.moodboard || []).map((f) => f.caminho).filter(Boolean);
    const erro = await P.gravar("roteiros", "apagar", null, atual.id);
    if (erro) { P.toast(erro, "erro"); return; }
    if (caminhos.length) { try { await banco.storage.from("moodboard").remove(caminhos); } catch (e) { /* segue */ } }
    P.toast("Roteiro apagado.");
    fecharJanela();
    await carregar();
  }

  // Transforma o roteiro em texto puro, com as listas viradas em traços
  function roteiroEmTexto(html, marca) {
    const caixa = document.createElement("div");
    caixa.innerHTML = personalizar(html || "", marca);
    caixa.querySelectorAll("li").forEach((li) => {
      const pai = li.parentElement;
      const marcador = pai && pai.tagName === "OL" ? `${Array.from(pai.children).indexOf(li) + 1}. ` : "- ";
      li.textContent = marcador + li.textContent;
    });
    caixa.querySelectorAll("br").forEach((br) => br.replaceWith("\n"));
    caixa.querySelectorAll("p, div, li, h1, h2, h3, blockquote").forEach((b) => b.append("\n"));
    return caixa.textContent.replace(/\n{3,}/g, "\n\n").trim();
  }

  async function copiarTudo() {
    const d = lerJanela();
    const campanha = campanhas.find((c) => String(c.id) === String(d.campanha_id));
    const duracao = [d.duracao_min, d.duracao_max].filter(Boolean).join(" a ");
    const linhas = [];
    linhas.push(`MARCA: ${d.marca || "sem marca"}`);
    if (d.produto) linhas.push(`PRODUTO: ${d.produto}`);
    if (d.categoria) linhas.push(`CATEGORIA: ${d.categoria}`);
    if (duracao) linhas.push(`DURAÇÃO PREVISTA: ${duracao}`);
    if (campanha) linhas.push(`TRABALHO VINCULADO: ${campanha.campanha || campanha.cliente}`);
    linhas.push(`STATUS: ${d.status}`);
    linhas.push("");
    linhas.push("ROTEIRO");
    linhas.push(roteiroEmTexto(d.roteiro, d.marca) || "(vazio)");
    if (moodboard.length) {
      linhas.push("");
      linhas.push("MOODBOARD");
      moodboard.forEach((f, i) => linhas.push(`${i + 1}. ${f.link || f.url}`));
    }
    const texto = linhas.join("\n");
    try {
      await navigator.clipboard.writeText(texto);
      P.toast("Roteiro completo copiado.");
    } catch (e) {
      P.ver("Copiar roteiro completo", `<p class="mudo" style="margin-bottom:10px">O navegador não deixou copiar sozinho. Selecione tudo aqui e use Ctrl C.</p><textarea readonly style="width:100%;min-height:340px;padding:12px;border:1px solid var(--linha-forte);border-radius:var(--raio-sm)">${P.esc(texto)}</textarea>`);
    }
  }

  async function gerarParaVarias() {
    const d = lerJanela();
    if (!d.roteiro.trim()) { P.toast("Escreva o roteiro primeiro.", "erro"); return; }
    const comNome = marcasBase.filter((m) => m.nome && !m.exemplo);
    if (!comNome.length) { P.toast("A sua base de marcas está vazia. Vá na aba Marcas primeiro.", "erro"); return; }
    const temModelo = /\{\{\s*(marca|nome)\s*\}\}/i.test(d.roteiro);

    const corpo = P.ver("Gerar para várias marcas", `
      ${temModelo ? "" : `<div class="aviso-suave" style="margin-top:0">${P.icone("alerta", "ico-p")}<span>O seu roteiro não tem <b>{{marca}}</b> em lugar nenhum, então as cópias vão sair todas com o mesmo texto. Se quiser que cada uma chame a marca pelo nome, feche isto, escreva <b>{{marca}}</b> onde o nome deve aparecer, e volte aqui.</span></div>`}
      <p class="mudo" style="margin:12px 0">Escolha as marcas. Eu crio <b>um roteiro separado para cada uma</b>, com o mesmo texto, o mesmo moodboard e a mesma cor. Você ajusta cada um depois se quiser.</p>
      <div class="grupo-botoes" style="margin-bottom:10px">
        <button class="botao" type="button" data-todas>Marcar todas</button>
        <button class="botao" type="button" data-nenhuma>Desmarcar todas</button>
      </div>
      <div class="tabela-rolagem" style="max-height:38vh;border:1px solid var(--linha);border-radius:var(--raio-sm)">
        <table class="tabela"><tbody>${comNome.map((m) => `
          <tr><td class="col-marcar"><input type="checkbox" data-marca="${P.esc(m.nome)}"></td>
          <td><b>${P.esc(m.nome)}</b></td>
          <td class="curta">${m.nicho ? P.pilula(m.nicho, "ciano") : ""}</td></tr>`).join("")}</tbody></table>
      </div>
      <div class="grupo-botoes" style="margin-top:14px;justify-content:flex-end">
        <button class="botao" type="button" data-cancelar>Cancelar</button>
        <button class="botao botao-principal" type="button" data-gerar>Gerar</button>
      </div>`);

    corpo.onclick = async (e) => {
      if (e.target.closest("[data-cancelar]")) { P.fecharVer(); return; }
      if (e.target.closest("[data-todas]")) { P.$$("[data-marca]", corpo).forEach((c) => { c.checked = true; }); return; }
      if (e.target.closest("[data-nenhuma]")) { P.$$("[data-marca]", corpo).forEach((c) => { c.checked = false; }); return; }
      const botao = e.target.closest("[data-gerar]");
      if (!botao) return;
      const escolhidas = P.$$("[data-marca]", corpo).filter((c) => c.checked).map((c) => c.dataset.marca);
      if (!escolhidas.length) { P.toast("Escolha pelo menos uma marca."); return; }
      if (!confirm(`Vou criar ${P.plural(escolhidas.length, "roteiro novo", "roteiros novos")}, um para cada marca escolhida. Pode ir?`)) return;
      botao.disabled = true;
      botao.textContent = "Gerando...";
      const copias = escolhidas.map((nome) => {
        const c = { ...d, marca: nome };
        delete c.atualizado_em;
        return c;
      });
      const erro = await P.gravar("roteiros", "inserir", copias);
      botao.disabled = false;
      botao.textContent = "Gerar";
      if (erro) { P.toast(erro, "erro"); return; }
      P.fecharVer();
      fecharJanela();
      await carregar();
      P.toast(`${P.plural(escolhidas.length, "roteiro criado", "roteiros criados")}, um por marca.`);
    };
  }

  /* ---------- Monta a janela uma vez, quando a aba carrega ---------- */
  function montarJanela() {
    const janela = P.$("#janela-roteiro");
    if (!janela || janela.innerHTML.trim()) return;
    janela.innerHTML = `
      <form id="rt-form" novalidate>
        <div class="rt-topo">
          <input id="rt-marca" class="rt-titulo" type="text" placeholder="Marca" maxlength="200" aria-label="Marca">
          <button class="botao botao-icone" type="button" data-fechar aria-label="Fechar">${P.icone("x")}</button>
        </div>
        <h2 class="sr" id="rt-titulo-janela">Novo roteiro</h2>
        <div class="janela-corpo">
          <div class="rt-linha3">
            <div class="campo">
              <label for="rt-status">Status</label>
              <select id="rt-status">${STATUS.map(([n]) => `<option value="${P.esc(n)}">${P.esc(n)}</option>`).join("")}</select>
            </div>
            <div class="campo">
              <label>Visualização</label>
              <div class="rt-visu"><span id="rt-visu-texto" class="mudo">Ainda não visualizado pela marca.</span>
              <button class="botao botao-icone" type="button" id="rt-recarregar" title="Conferir agora se a marca abriu" aria-label="Conferir agora se a marca abriu">${P.icone("recarregar")}</button></div>
            </div>
            <div class="campo">
              <label>Cor da marca</label>
              <div class="rt-cor">
                <label class="rt-check"><input type="checkbox" id="rt-cor-ativa"> Personalizar</label>
                <button class="rt-bolinha" type="button" id="rt-bolinha" title="Escolher a cor da marca" aria-label="Escolher a cor da marca" disabled></button>
              </div>
            </div>
          </div>

          <div class="rt-linha3">
            <div class="campo"><label for="rt-produto">Produto</label><input id="rt-produto" type="text" maxlength="300"></div>
            <div class="campo"><label for="rt-campanha">Trabalho vinculado</label><select id="rt-campanha"></select></div>
            <div class="campo">
              <label for="rt-dmin">Duração prevista</label>
              <div class="rt-duracao">
                <input id="rt-dmin" type="text" placeholder="Ex: 20s" maxlength="40" aria-label="Duração mínima">
                <span class="mudo">a</span>
                <input id="rt-dmax" type="text" placeholder="Ex: 30s" maxlength="40" aria-label="Duração máxima">
              </div>
            </div>
          </div>

          <div class="campo">
            <label for="rt-categoria">Categoria</label>
            <input id="rt-categoria" type="text" list="rt-categorias" placeholder="Ex: Conteúdo para o meu perfil" maxlength="200">
            <datalist id="rt-categorias">${CATEGORIAS.map((c) => `<option value="${P.esc(c)}">`).join("")}</datalist>
          </div>

          <div class="rt-bloco">
            <label class="rt-rotulo" for="rt-editor">Roteiro</label>
            <div class="rt-barra" id="rt-barra" role="toolbar" aria-label="Formatar o texto">
              <button class="rt-bt" type="button" data-cmd="bold" title="Negrito" aria-label="Negrito"><b>B</b></button>
              <button class="rt-bt" type="button" data-cmd="italic" title="Itálico" aria-label="Itálico"><i>I</i></button>
              <button class="rt-bt" type="button" data-cmd="underline" title="Sublinhado" aria-label="Sublinhado"><u>S</u></button>
              <span class="rt-sep"></span>
              <select class="rt-sel" id="rt-fonte" aria-label="Fonte">${FONTES.map(([v, n]) => `<option value="${P.esc(v)}">${P.esc(n)}</option>`).join("")}</select>
              <select class="rt-sel" id="rt-tamanho" aria-label="Tamanho do texto">${TAMANHOS.map(([v, n]) => `<option value="${P.esc(v)}">${P.esc(n)}</option>`).join("")}</select>
              <span class="rt-sep"></span>
              <button class="rt-bt" type="button" data-cmd="insertUnorderedList" title="Lista com traço" aria-label="Lista com traço">- Lista</button>
              <button class="rt-bt" type="button" data-cmd="insertOrderedList" title="Lista numerada" aria-label="Lista numerada">1. Lista</button>
              <span class="rt-sep"></span>
              <button class="rt-bt rt-bt-cor" type="button" data-cmd="cor" title="Cor do texto" aria-label="Cor do texto"><span class="rt-letra">A</span></button>
              <button class="rt-bt rt-bt-destaque" type="button" data-cmd="destaque" title="Cor de destaque" aria-label="Cor de destaque">${P.icone("caneta", "ico-p")}</button>
              <span class="rt-sep"></span>
              <button class="rt-bt" type="button" data-cmd="link" title="Inserir link" aria-label="Inserir link">${P.icone("link", "ico-p")}</button>
              <button class="rt-bt" type="button" data-cmd="justifyLeft" title="Alinhar à esquerda" aria-label="Alinhar à esquerda">${P.icone("al-esq", "ico-p")}</button>
              <button class="rt-bt" type="button" data-cmd="justifyCenter" title="Centralizar" aria-label="Centralizar">${P.icone("al-centro", "ico-p")}</button>
              <button class="rt-bt" type="button" data-cmd="justifyRight" title="Alinhar à direita" aria-label="Alinhar à direita">${P.icone("al-dir", "ico-p")}</button>
              <button class="rt-bt" type="button" data-cmd="removeFormat" title="Tirar a formatação" aria-label="Tirar a formatação">Limpar</button>
            </div>
            <div class="rt-editor vazio" id="rt-editor" contenteditable="true" role="textbox" aria-multiline="true" aria-label="Texto do roteiro" data-dica="Escreva seu roteiro aqui... gancho, desenvolvimento, CTA"></div>
            <p class="campo-ajuda">A marca vê isso no link de aprovação. Onde você escrever <b>{{marca}}</b>, entra o nome da marca sozinho.</p>
          </div>

          <div class="rt-bloco rt-bloco-mood">
            <label class="rt-rotulo">Moodboard geral <span class="mudo pequeno" id="rt-mood-conta"></span></label>
            <p class="campo-ajuda">Arraste as fotos para posicionar como quiser, pode sobrepor, como numa colagem. Todas ficam do mesmo tamanho, não importa quantas você adicionar.</p>
            <div class="rt-palco" id="rt-palco"></div>
            <div class="grupo-botoes" style="margin-top:10px">
              <button class="botao" type="button" id="rt-anexar">${P.icone("mais", "ico-p")}Anexar foto</button>
              <button class="botao" type="button" id="rt-colar-link">${P.icone("link", "ico-p")}Colar link de imagem</button>
              <input type="file" id="rt-arquivo" accept="image/*" multiple hidden>
            </div>
            <div class="rt-foto-painel" id="rt-foto-painel" hidden>
              <label for="rt-foto-link">Link do produto desta foto</label>
              <div class="rt-foto-linha">
                <input id="rt-foto-link" type="url" placeholder="https://loja.com/o-produto">
                <button class="botao" type="button" id="rt-foto-abrir">${P.icone("link", "ico-p")}Abrir</button>
                <button class="botao botao-perigo" type="button" id="rt-foto-tirar">${P.icone("lixo", "ico-p")}Tirar do moodboard</button>
              </div>
              <span class="campo-ajuda">No link de aprovação, a marca clica na foto e vai direto para o produto.</span>
            </div>
          </div>

          <div class="rt-link-caixa" id="rt-link-caixa" hidden>
            <label class="rt-rotulo">Link de aprovação</label>
            <label class="rt-check"><input type="checkbox" id="rt-link-ligado" checked> Link ligado</label>
            <p class="rt-link-texto" id="rt-link-texto"></p>
            <div class="grupo-botoes">
              <button class="botao" type="button" id="rt-copiar-link">${P.icone("baixar", "ico-p")}Copiar link</button>
              <button class="botao" type="button" id="rt-abrir-link">${P.icone("olho", "ico-p")}Ver como a marca vê</button>
            </div>
            <span class="campo-ajuda">Só quem tem este link consegue abrir. Ele não aparece no seu site nem no Google. Quando você abre com o painel logado, não conta como visualização da marca.</span>
          </div>
        </div>

        <div class="janela-rodape">
          <button class="botao botao-perigo" type="button" id="rt-apagar" hidden>${P.icone("lixo", "ico-p")}Apagar</button>
          <button class="botao" type="button" id="rt-copiar">${P.icone("baixar", "ico-p")}Copiar roteiro completo</button>
          <button class="botao" type="button" id="rt-varias">${P.icone("marcas", "ico-p")}Gerar para várias marcas</button>
          <button class="botao" type="button" data-fechar>Cancelar</button>
          <button class="botao botao-principal" type="submit" id="rt-salvar">Salvar</button>
        </div>
      </form>`;
    prepararArrastoDaFoto(P.$("#rt-palco", janela));
    P.$("#rt-palco", janela).addEventListener("click", (e) => {
      if (!e.target.closest("[data-foto]")) { fotoEscolhida = -1; desenharMoodboard(); }
    });
  }
})();
