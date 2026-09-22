/* =========================================================
   ABA AUTOMAÇÕES
   Respostas automáticas para comentários e DMs do Instagram.
   As regras ficam na tabela "automacoes" do Supabase.
   Quem dispara as respostas é a função "instagram" (Edge Function),
   que o Instagram chama sozinho quando alguém comenta ou manda DM.
   ========================================================= */
(function () {
  "use strict";
  const P = window.Painel;

  let secao = null;
  let regras = [];
  let janela = null;
  let editando = null;       // regra aberta na janela (null = nova)
  let postEscolhido = null;  // { id, legenda } ou null = todos os posts

  const curto = (t, n) => {
    const s = String(t == null ? "" : t).replace(/\s+/g, " ").trim();
    return s.length > n ? s.slice(0, n - 1) + "…" : s;
  };

  P.abas.automacoes = {
    async iniciar(s) {
      secao = s;
      s.innerHTML = `
        <div class="avisos"></div>
        <div class="ferramentas">
          <p class="mudo pequeno" style="flex:1 1 280px;min-width:0">Quando alguém comenta ou manda uma DM com uma palavra que você escolheu, o Instagram responde sozinho.</p>
          <div class="grupo-botoes empurra">
            <button class="botao botao-principal" type="button" id="au-nova">${P.icone("mais", "ico-p")}Nova automação</button>
          </div>
        </div>
        <div id="au-lista"></div>
        <p class="mudo pequeno" style="margin-top:10px">Regra do Instagram: cada comentário recebe uma DM só, até 7 dias depois de ser escrito. O painel nunca manda duas para o mesmo comentário.</p>`;
      montarJanela();
      P.$("#au-nova", s).addEventListener("click", () => abrir(null));
      P.$("#au-lista", s).addEventListener("click", (e) => {
        const b = e.target.closest("[data-editar]");
        if (b) abrir(regras.find((r) => r.id === b.dataset.editar));
      });
      P.$("#au-lista", s).addEventListener("change", ligarOuPausar);
      await carregar();
    },
    async aoMostrar() { await carregar(); }
  };

  /* ---------- Ler as regras (com a contagem de envios junto) ---------- */
  async function lerRegras() {
    try {
      const { data, error } = await banco
        .from("automacoes")
        .select("*, automacoes_envios(count)")
        .order("criado_em", { ascending: false });
      if (error) return { dados: [], erro: P.explicarErro(error, "automacoes") };
      return { dados: Array.isArray(data) ? data : [], erro: null };
    } catch (e) {
      return { dados: [], erro: P.explicarErro(e, "automacoes") };
    }
  }

  async function carregar() {
    const avisos = P.$(".avisos", secao);
    P.limparAvisos(avisos);
    const r = await lerRegras();
    if (r.erro) P.avisar(avisos, r.erro + " O arquivo das tabelas é o automacoes.sql.");
    regras = r.dados;
    desenhar();
  }

  /* ---------- A lista ---------- */
  function desenhar() {
    const alvo = P.$("#au-lista", secao);
    if (!regras.length) {
      alvo.innerHTML = `<div class="cartao"><p class="vazio"><b>Nenhuma automação ainda.</b><br>Crie a primeira: quando alguém comentar uma palavra que você escolher, a pessoa recebe sua mensagem no direct.</p></div>`;
      return;
    }
    alvo.innerHTML = `<div class="au-lista">${regras.map((r) => {
      const envios = P.num(r.automacoes_envios && r.automacoes_envios[0] && r.automacoes_envios[0].count);
      const alvoRegra = r.gatilho === "dm"
        ? "Em qualquer DM"
        : r.post_id ? `Post: ${curto(r.post_legenda || "sem legenda", 45)}` : "Em todos os posts";
      const palavras = String(r.palavras || "").split(",").map((p) => p.trim()).filter(Boolean);
      return `
        <article class="au-regra${r.ativa ? "" : " pausada"}">
          <div class="au-linha">
            <h3 class="au-nome">${P.esc(r.nome)}</h3>
            ${P.pilula(r.gatilho === "dm" ? "Mensagem direta" : "Comentário", r.gatilho === "dm" ? "lilas" : "ciano")}
            <label class="au-ligar"><input type="checkbox" data-ligar="${P.esc(r.id)}"${r.ativa ? " checked" : ""}>${r.ativa ? "Ligada" : "Pausada"}</label>
            <button class="botao botao-icone" type="button" data-editar="${P.esc(r.id)}" aria-label="Editar ${P.esc(r.nome)}">${P.icone("editar")}</button>
          </div>
          <div class="au-palavras">${palavras.map((p) => P.pilula(p, "cinza")).join("")}</div>
          <p class="au-msg">${P.esc(curto(r.mensagem, 180))}</p>
          <div class="au-meta"><span>${P.esc(alvoRegra)}</span><span>${P.plural(envios, "envio", "envios")}</span></div>
        </article>`;
    }).join("")}</div>`;
  }

  async function ligarOuPausar(e) {
    const chave = e.target.closest("[data-ligar]");
    if (!chave) return;
    chave.disabled = true;
    const erro = await P.gravar("automacoes", "atualizar", { ativa: chave.checked }, chave.dataset.ligar);
    chave.disabled = false;
    if (erro) {
      chave.checked = !chave.checked;
      P.toast(erro, "erro");
      return;
    }
    P.toast(chave.checked ? "Automação ligada." : "Automação pausada.");
    await carregar();
  }

  /* ---------- A janela de criar e editar ---------- */
  function montarJanela() {
    if (janela) return;
    janela = document.createElement("dialog");
    janela.className = "janela";
    janela.id = "janela-automacao";
    janela.setAttribute("aria-labelledby", "au-titulo");
    janela.innerHTML = `
      <form id="au-form" novalidate>
        <div class="janela-topo">
          <h2 id="au-titulo">Nova automação</h2>
          <button class="botao botao-icone" type="button" data-au-fechar aria-label="Fechar">${P.icone("x")}</button>
        </div>
        <div class="janela-corpo">
          <p class="erro-form" id="au-erro" role="alert" hidden></p>
          <div class="grade-campos">
            <div class="campo largo">
              <label for="au-nome">Nome *</label>
              <input id="au-nome" type="text" placeholder="Ex.: mídia kit no post fixado" required>
            </div>
            <div class="campo largo">
              <label for="au-gatilho">Quando</label>
              <select id="au-gatilho">
                <option value="comentario">Alguém comentar num post</option>
                <option value="dm">Alguém mandar uma DM</option>
              </select>
            </div>
            <div class="campo largo">
              <label for="au-palavras">Palavras-chave *</label>
              <input id="au-palavras" type="text" placeholder="quero, mídia kit, link" required>
              <span class="campo-ajuda">Separe por vírgula. Maiúsculas e acentos não fazem diferença.</span>
            </div>
            <div class="campo largo" id="au-bloco-post">
              <label for="au-ver-posts">Post</label>
              <div class="au-linha">
                <span class="pilula p-cinza" id="au-post-atual">Todos os posts</span>
                <button class="botao" type="button" id="au-ver-posts">Escolher post</button>
                <button class="botao" type="button" id="au-limpar-post" hidden>Usar em todos</button>
              </div>
              <div class="au-posts" id="au-posts" hidden></div>
            </div>
            <div class="campo largo">
              <label for="au-mensagem">Mensagem na DM *</label>
              <textarea id="au-mensagem" placeholder="Oi! Aqui está o meu mídia kit: https://..." required></textarea>
            </div>
            <div class="campo largo" id="au-bloco-publica">
              <label for="au-publica">Resposta no comentário</label>
              <input id="au-publica" type="text" placeholder="Te mandei no direct!">
              <span class="campo-ajuda">Opcional. Fica visível para todo mundo embaixo do comentário.</span>
            </div>
            <label class="campo campo-marcar largo" for="au-ativa"><input id="au-ativa" type="checkbox" checked>Automação ligada</label>
          </div>
        </div>
        <div class="janela-rodape">
          <button class="botao botao-perigo" type="button" id="au-apagar" hidden>${P.icone("lixo", "ico-p")}Apagar</button>
          <button class="botao" type="button" data-au-fechar>Cancelar</button>
          <button class="botao botao-principal" type="submit" id="au-salvar">Salvar</button>
        </div>
      </form>`;
    document.body.appendChild(janela);

    P.$$("[data-au-fechar]", janela).forEach((b) => b.addEventListener("click", fechar));
    janela.addEventListener("click", (e) => { if (e.target === janela) fechar(); });
    P.$("#au-gatilho", janela).addEventListener("change", ajustarGatilho);
    P.$("#au-ver-posts", janela).addEventListener("click", buscarPosts);
    P.$("#au-limpar-post", janela).addEventListener("click", () => {
      postEscolhido = null;
      P.$$(".au-post", janela).forEach((b) => b.setAttribute("aria-pressed", "false"));
      mostrarPost();
    });
    P.$("#au-posts", janela).addEventListener("click", (e) => {
      const b = e.target.closest(".au-post");
      if (!b) return;
      P.$$(".au-post", janela).forEach((x) => x.setAttribute("aria-pressed", String(x === b)));
      postEscolhido = { id: b.dataset.id, legenda: b.dataset.legenda };
      mostrarPost();
    });
    P.$("#au-apagar", janela).addEventListener("click", apagar);
    P.$("#au-form", janela).addEventListener("submit", salvar);
  }

  function fechar() { if (janela.open) janela.close(); }

  function erroNaJanela(msg) {
    const el = P.$("#au-erro", janela);
    el.textContent = msg || "";
    el.hidden = !msg;
  }

  // Post e resposta pública só existem quando o gatilho é comentário
  function ajustarGatilho() {
    const comentario = P.$("#au-gatilho", janela).value === "comentario";
    P.$("#au-bloco-post", janela).hidden = !comentario;
    P.$("#au-bloco-publica", janela).hidden = !comentario;
  }

  function mostrarPost() {
    P.$("#au-post-atual", janela).textContent = postEscolhido
      ? curto(postEscolhido.legenda || "Post sem legenda", 40)
      : "Todos os posts";
    P.$("#au-limpar-post", janela).hidden = !postEscolhido;
  }

  function abrir(regra) {
    editando = regra || null;
    erroNaJanela("");
    P.$("#au-titulo", janela).textContent = regra ? "Editar automação" : "Nova automação";
    P.$("#au-apagar", janela).hidden = !regra;
    P.$("#au-nome", janela).value = regra ? P.texto(regra.nome) : "";
    P.$("#au-gatilho", janela).value = regra ? P.texto(regra.gatilho) || "comentario" : "comentario";
    P.$("#au-palavras", janela).value = regra ? P.texto(regra.palavras) : "";
    P.$("#au-mensagem", janela).value = regra ? P.texto(regra.mensagem) : "";
    P.$("#au-publica", janela).value = regra ? P.texto(regra.resposta_publica) : "";
    P.$("#au-ativa", janela).checked = regra ? !!regra.ativa : true;
    P.$("#au-posts", janela).hidden = true;
    P.$("#au-posts", janela).innerHTML = "";
    postEscolhido = regra && regra.post_id ? { id: regra.post_id, legenda: regra.post_legenda } : null;
    mostrarPost();
    ajustarGatilho();
    if (typeof janela.showModal === "function") janela.showModal(); else janela.setAttribute("open", "");
    P.$("#au-nome", janela).focus();
  }

  async function salvar(e) {
    e.preventDefault();
    const comentario = P.$("#au-gatilho", janela).value === "comentario";
    const publica = P.$("#au-publica", janela).value.trim();
    const valores = {
      nome: P.$("#au-nome", janela).value.trim(),
      gatilho: comentario ? "comentario" : "dm",
      palavras: P.$("#au-palavras", janela).value.trim(),
      mensagem: P.$("#au-mensagem", janela).value.trim(),
      resposta_publica: comentario && publica ? publica : null,
      post_id: comentario && postEscolhido ? postEscolhido.id : null,
      post_legenda: comentario && postEscolhido ? postEscolhido.legenda : null,
      ativa: P.$("#au-ativa", janela).checked
    };
    if (!valores.nome) return erroNaJanela('Preencha o campo "Nome".');
    if (!valores.palavras) return erroNaJanela('Preencha o campo "Palavras-chave".');
    if (!valores.mensagem) return erroNaJanela('Preencha o campo "Mensagem na DM".');

    const botao = P.$("#au-salvar", janela);
    botao.disabled = true;
    const erro = editando
      ? await P.gravar("automacoes", "atualizar", valores, editando.id)
      : await P.gravar("automacoes", "inserir", valores);
    botao.disabled = false;
    if (erro) return erroNaJanela(erro);
    fechar();
    P.toast(editando ? "Automação salva." : "Automação criada.");
    await carregar();
  }

  async function apagar() {
    if (!editando) return;
    if (!confirm(`Apagar "${editando.nome}"? Isso não tem volta.`)) return;
    const erro = await P.gravar("automacoes", "apagar", null, editando.id);
    if (erro) return erroNaJanela(erro);
    fechar();
    P.toast("Automação apagada.");
    await carregar();
  }

  /* ---------- Miniaturas dos seus posts (vêm da função "instagram") ---------- */
  async function buscarPosts(e) {
    const botao = e.currentTarget;
    const grade = P.$("#au-posts", janela);
    botao.disabled = true;
    botao.textContent = "Carregando...";
    try {
      const { data, error } = await banco.functions.invoke("instagram", { body: { acao: "posts" } });
      if (error) throw new Error(error.message || "erro");
      if (data && data.erro) throw new Error(data.erro);
      const posts = (data && data.posts) || [];
      grade.innerHTML = posts.length
        ? posts.map((p) => {
            const img = p.media_type === "VIDEO" ? p.thumbnail_url : p.media_url;
            const legenda = curto(p.caption, 120);
            const marcado = postEscolhido && postEscolhido.id === p.id;
            return `<button class="au-post" type="button" data-id="${P.esc(p.id)}" data-legenda="${P.esc(legenda)}"
                      aria-pressed="${marcado ? "true" : "false"}" title="${P.esc(legenda || "Post sem legenda")}">
                      ${img ? `<img src="${P.esc(img)}" alt="" loading="lazy">` : ""}
                    </button>`;
          }).join("")
        : `<p class="vazio">Nenhum post encontrado na sua conta.</p>`;
      grade.hidden = false;
    } catch (erro) {
      P.toast("Não consegui buscar seus posts agora. Confira se a função \"instagram\" está publicada no Supabase e se o IG_TOKEN ainda é válido.", "erro");
    } finally {
      botao.disabled = false;
      botao.textContent = "Escolher post";
    }
  }
})();
