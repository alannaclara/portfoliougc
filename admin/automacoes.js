/* =========================================================
   ABA AUTOMAÇÕES
   Respostas automáticas para comentários e DMs do Instagram.
   As regras ficam na tabela "automacoes" do Supabase.
   Quem dispara as respostas é a função "instagram" (Edge Function),
   que o Instagram chama sozinho quando alguém comenta, manda DM ou
   toca num botão da mensagem.

   A automação pode ser só uma mensagem, como era no começo, ou uma
   conversa em etapas: boas-vindas com botão, pedido para seguir, o
   link, o pedido de e-mail e o lembrete de quem não abriu.
   ========================================================= */
(function () {
  "use strict";
  const P = window.Painel;

  let secao = null;
  let regras = [];
  let emails = [];
  let janela = null;
  let editando = null;       // regra aberta na janela (null = nova)
  let postEscolhido = null;  // { id, legenda } ou null = todos os posts

  // Os mesmos textos que a função "instagram" usa quando o campo fica vazio.
  const PADRAO = {
    botaoBoasVindas: "Me envie o link",
    seguir: "Antes de eu te mandar: me segue aqui? Leva um segundo e me ajuda demais.",
    email: "Me manda o seu e-mail? Assim eu te aviso quando sair coisa nova.",
    emailOk: "Anotado, obrigada!",
    lembrete: "Oi! Vi que você ainda não abriu o link. Deixei ele aqui de novo."
  };

  const curto = (t, n) => {
    const s = String(t == null ? "" : t).replace(/\s+/g, " ").trim();
    return s.length > n ? s.slice(0, n - 1) + "…" : s;
  };

  const val = (id) => P.$("#" + id, janela).value.trim();
  const marcado = (id) => P.$("#" + id, janela).checked;

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
        <div id="au-emails"></div>
        <p class="mudo pequeno" style="margin-top:10px">Regra do Instagram: cada comentário recebe uma DM só, até 7 dias depois de ser escrito. E depois de 24 horas sem a pessoa responder nem tocar em nada, ele não deixa mais mandar nada para ela. Por isso o lembrete espera no máximo 23 horas.</p>`;
      montarJanela();
      P.$("#au-nova", s).addEventListener("click", () => abrir(null));
      P.$("#au-lista", s).addEventListener("click", (e) => {
        const b = e.target.closest("[data-editar]");
        if (b) abrir(regras.find((r) => r.id === b.dataset.editar));
      });
      P.$("#au-lista", s).addEventListener("change", ligarOuPausar);
      P.$("#au-emails", s).addEventListener("click", cuidarDosEmails);
      await carregar();
    },
    async aoMostrar() {
      await carregar();
      soltarLembretes();
    }
  };

  /* Toda vez que você abre a aba, o painel aproveita e pergunta ao robô
     se tem lembrete vencido para mandar. Quem também pergunta, de hora
     em hora, é o agendador do Supabase. */
  function soltarLembretes() {
    banco.functions.invoke("instagram", { body: { acao: "lembretes" } }).catch(() => { /* sem barulho */ });
  }

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
    if (r.erro) P.avisar(avisos, r.erro + " Os arquivos das tabelas são o automacoes.sql e o automacoes-conversa.sql.");
    regras = r.dados;
    desenhar();
    await carregarEmails();
  }

  /* ---------- A lista de regras ---------- */
  function desenhar() {
    const alvo = P.$("#au-lista", secao);
    if (!regras.length) {
      alvo.innerHTML = `<div class="cartao"><p class="vazio"><b>Nenhuma automação ainda.</b><br>Crie a primeira: quando alguém comentar uma palavra que você escolher, a pessoa recebe sua mensagem no direct.</p></div>`;
      return;
    }
    alvo.innerHTML = `<div class="au-lista">${regras.map((r) => {
      const envios = P.num(r.automacoes_envios && r.automacoes_envios[0] && r.automacoes_envios[0].count);
      const alvoRegra = r.gatilho === "comentario"
        ? (r.post_id ? `Post: ${curto(r.post_legenda || "sem legenda", 45)}` : "Em todos os posts")
        : r.gatilho === "primeira_dm" ? "Na primeira DM da pessoa" : "Em qualquer DM";
      const palavras = String(r.palavras || "").split(",").map((p) => p.trim()).filter(Boolean);
      return `
        <article class="au-regra${r.ativa ? "" : " pausada"}">
          <div class="au-linha">
            <h3 class="au-nome">${P.esc(r.nome)}</h3>
            ${P.pilula(rotuloGatilho(r.gatilho), corGatilho(r.gatilho))}
            <label class="au-ligar"><input type="checkbox" data-ligar="${P.esc(r.id)}"${r.ativa ? " checked" : ""}>${r.ativa ? "Ligada" : "Pausada"}</label>
            <button class="botao botao-icone" type="button" data-editar="${P.esc(r.id)}" aria-label="Editar ${P.esc(r.nome)}">${P.icone("editar")}</button>
          </div>
          ${r.gatilho === "primeira_dm" ? "" : `<div class="au-palavras">${palavras.map((p) => P.pilula(p, "cinza")).join("")}</div>`}
          <p class="au-msg">${P.esc(curto(r.mensagem, 180))}</p>
          <div class="au-meta">
            <span>${P.esc(alvoRegra)}</span>
            <span>${P.plural(envios, "envio", "envios")}</span>
            ${r.boas_vindas ? `<span>${P.icone("raio", "ico-p")} boas-vindas</span>` : ""}
            ${r.pedir_seguir ? `<span>${P.icone("check", "ico-p")} pede para seguir</span>` : ""}
            ${r.link ? `<span>${P.icone("link", "ico-p")} botão "${P.esc(r.link_texto || "Ver agora")}"</span>` : ""}
            ${quantasRespostas(r) > 1 ? `<span>${P.icone("legenda", "ico-p")} ${quantasRespostas(r)} respostas sorteadas</span>` : ""}
            ${r.pedir_email ? `<span>${P.icone("carta", "ico-p")} pede e-mail</span>` : ""}
            ${r.lembrete ? `<span>${P.icone("relogio", "ico-p")} lembra em ${Math.round(P.num(r.lembrete_horas)) || 20}h</span>` : ""}
          </div>
        </article>`;
    }).join("")}</div>`;
  }

  const quantasRespostas = (r) =>
    [r.resposta_publica, r.resposta_publica_2, r.resposta_publica_3, r.resposta_publica_4]
      .filter((t) => String(t || "").trim()).length;

  const rotuloGatilho = (g) =>
    g === "dm" ? "Mensagem direta" : g === "primeira_dm" ? "Primeira DM" : "Comentário";
  const corGatilho = (g) =>
    g === "dm" ? "lilas" : g === "primeira_dm" ? "verde" : "ciano";

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

  /* ---------- Os e-mails que as pessoas mandaram ---------- */
  async function carregarEmails() {
    const alvo = P.$("#au-emails", secao);
    try {
      const { data, error } = await banco
        .from("automacoes_emails")
        .select("*")
        .order("criado_em", { ascending: false })
        .limit(500);
      if (error) throw error;
      emails = Array.isArray(data) ? data : [];
    } catch (e) {
      emails = [];
    }
    if (!emails.length) { alvo.innerHTML = ""; return; }
    alvo.innerHTML = `
      <div class="cartao au-emails">
        <div class="au-linha">
          <h3 class="au-nome">${P.icone("carta", "ico-p")}E-mails recebidos</h3>
          ${P.pilula(P.plural(emails.length, "e-mail", "e-mails"), "cinza")}
          <button class="botao empurra" type="button" id="au-copiar-emails">${P.icone("copiar", "ico-p")}Copiar todos</button>
        </div>
        <ul class="au-emails-lista">
          ${emails.map((e) => `
            <li>
              <span class="au-email">${P.esc(e.email)}</span>
              <span class="mudo pequeno">${e.username ? P.arroba(e.username) + " · " : ""}${P.esc(P.dataBR(e.criado_em))}</span>
              <button class="botao botao-icone" type="button" data-apagar-email="${P.esc(e.id)}" aria-label="Apagar ${P.esc(e.email)}">${P.icone("lixo")}</button>
            </li>`).join("")}
        </ul>
      </div>`;
  }

  async function cuidarDosEmails(e) {
    const copiar = e.target.closest("#au-copiar-emails");
    if (copiar) {
      try {
        await navigator.clipboard.writeText(emails.map((x) => x.email).join("\n"));
        P.toast("E-mails copiados.");
      } catch (erro) {
        P.toast("Seu navegador não deixou copiar. Selecione com o mouse.", "erro");
      }
      return;
    }
    const apagar = e.target.closest("[data-apagar-email]");
    if (!apagar) return;
    if (!confirm("Apagar este e-mail da lista? Isso não tem volta.")) return;
    const erro = await P.gravar("automacoes_emails", "apagar", null, apagar.dataset.apagarEmail);
    if (erro) return P.toast(erro, "erro");
    P.toast("E-mail apagado.");
    await carregarEmails();
  }

  /* ---------- A janela de criar e editar ---------- */

  // Um cartão de etapa: título, chavinha de ligar e os campos que só
  // aparecem quando ela está ligada.
  function etapa(id, titulo, ajuda, campos) {
    return `
      <section class="au-etapa" data-etapa="${id}">
        <div class="au-etapa-topo">
          <div>
            <h4>${titulo}</h4>
            ${ajuda ? `<p class="mudo pequeno">${ajuda}</p>` : ""}
          </div>
          <label class="au-chave">
            <input type="checkbox" id="au-${id}" aria-label="Ligar: ${titulo}">
            <span class="au-chave-trilho" aria-hidden="true"></span>
          </label>
        </div>
        <div class="au-etapa-campos" id="au-campos-${id}" hidden>${campos}</div>
      </section>`;
  }

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
                <option value="dm">Alguém mandar uma DM com a palavra</option>
                <option value="primeira_dm">Alguém te mandar a primeira DM</option>
              </select>
              <span class="campo-ajuda" id="au-ajuda-gatilho"></span>
            </div>
            <div class="campo largo" id="au-bloco-palavras">
              <label for="au-palavras">Palavras-chave *</label>
              <input id="au-palavras" type="text" placeholder="quero, mídia kit, link">
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
          </div>

          <h3 class="au-titulo-secao">Eles receberão</h3>
          <p class="mudo pequeno" id="au-aviso-etapas" hidden></p>

          ${etapa("boas_vindas",
            "uma mensagem de boas-vindas",
            "Com um botão para a pessoa tocar. Só depois do toque é que o resto acontece.",
            `<div class="campo largo">
               <label for="au-boas_vindas_texto">O que ela vai ler</label>
               <textarea id="au-boas_vindas_texto" maxlength="640" placeholder="Oi! Que bom te ver por aqui. Toca no botão abaixo que eu já te mando."></textarea>
             </div>
             <div class="campo largo">
               <label for="au-boas_vindas_botao">O que o botão escreve</label>
               <input id="au-boas_vindas_botao" type="text" maxlength="20" placeholder="${PADRAO.botaoBoasVindas}">
               <span class="campo-ajuda">Até 20 letras. É limite do Instagram, não meu.</span>
             </div>`)}

          ${etapa("pedir_seguir",
            "uma DM pedindo que te sigam antes do link",
            "Só aparece para quem ainda não te segue. Quem já segue vai direto para o link.",
            `<div class="campo largo">
               <label for="au-pedir_seguir_texto">O que ela vai ler</label>
               <textarea id="au-pedir_seguir_texto" maxlength="640" placeholder="${P.esc(PADRAO.seguir)}"></textarea>
               <span class="campo-ajuda">Vão dois botões junto: um que abre o seu perfil e um "Já segui".</span>
             </div>`)}

          <section class="au-etapa au-etapa-fixa">
            <div class="au-etapa-topo">
              <div>
                <h4>uma DM com a sua mensagem</h4>
                <p class="mudo pequeno">Esta é a única que sempre vai. As outras são opcionais.</p>
              </div>
              <span class="pilula p-cinza">sempre</span>
            </div>
            <div class="au-etapa-campos">
              <div class="campo largo">
                <label for="au-mensagem">O que ela vai ler *</label>
                <textarea id="au-mensagem" placeholder="Oi! Aqui está o meu mídia kit:" required></textarea>
              </div>
              <div class="campo largo" id="au-bloco-link">
                <button class="botao" type="button" id="au-add-link">${P.icone("mais", "ico-p")}Adicionar um link</button>
                <div class="au-link-campos" id="au-link-campos" hidden>
                  <div class="campo">
                    <label for="au-link">Para onde o botão leva</label>
                    <input id="au-link" type="url" placeholder="https://...">
                  </div>
                  <div class="campo">
                    <label for="au-link-texto">O que o botão escreve</label>
                    <input id="au-link-texto" type="text" maxlength="20" placeholder="Ver agora">
                    <span class="campo-ajuda">Até 20 letras. É limite do Instagram, não meu.</span>
                  </div>
                  <button class="botao botao-perigo" type="button" id="au-tirar-link">${P.icone("x", "ico-p")}Tirar o link</button>
                </div>
              </div>
            </div>
          </section>

          ${etapa("pedir_email",
            "uma DM pedindo o e-mail",
            "Vai logo depois do link. O que a pessoa responder fica guardado na lista de e-mails desta aba.",
            `<div class="campo largo">
               <label for="au-pedir_email_texto">O pedido</label>
               <textarea id="au-pedir_email_texto" maxlength="900" placeholder="${P.esc(PADRAO.email)}"></textarea>
             </div>
             <div class="campo largo">
               <label for="au-pedir_email_ok">O agradecimento</label>
               <input id="au-pedir_email_ok" type="text" maxlength="300" placeholder="${PADRAO.emailOk}">
               <span class="campo-ajuda">Mandado assim que ela responder com um e-mail de verdade.</span>
             </div>`)}

          ${etapa("lembrete",
            "uma DM de lembrete, se ela não abrir o link",
            "Só chega para quem recebeu o link e não tocou nele.",
            `<div class="campo largo">
               <label for="au-lembrete_horas">Esperar quantas horas</label>
               <input id="au-lembrete_horas" type="number" min="1" max="23" step="1" value="20">
               <span class="campo-ajuda">No máximo 23. Depois de 24 horas o Instagram não deixa mais falar com quem não respondeu.</span>
             </div>
             <div class="campo largo">
               <label for="au-lembrete_texto">O que ela vai ler</label>
               <textarea id="au-lembrete_texto" maxlength="640" placeholder="${P.esc(PADRAO.lembrete)}"></textarea>
             </div>`)}

          <div class="grade-campos" style="margin-top:14px">
            <div class="campo largo">
              <label>Como vai chegar</label>
              <div class="au-previa" id="au-previa"></div>
            </div>
            <div class="campo largo" id="au-bloco-publica">
              <label for="au-publica">Resposta no comentário</label>
              <div class="au-respostas">
                <input id="au-publica" type="text" maxlength="300" placeholder="Te mandei no direct!">
                <input id="au-publica-2" type="text" maxlength="300" placeholder="Prontinho, corre ver o seu direct">
                <input id="au-publica-3" type="text" maxlength="300" placeholder="Acabei de te mandar por lá">
                <input id="au-publica-4" type="text" maxlength="300" placeholder="Já foi pro seu direct, dá uma olhada">
              </div>
              <span class="campo-ajuda">Opcional. Fica visível para todo mundo embaixo do comentário. Escreva mais de uma e o robô sorteia uma a cada comentário, para não ficar a mesma frase repetida embaixo de todo mundo.</span>
              <p class="mudo pequeno" id="au-conta-respostas"></p>
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
    P.$("#au-add-link", janela).addEventListener("click", () => mostrarLink(true));
    P.$("#au-tirar-link", janela).addEventListener("click", () => {
      P.$("#au-link", janela).value = "";
      P.$("#au-link-texto", janela).value = "";
      mostrarLink(false);
    });

    // As chavinhas das etapas
    ["boas_vindas", "pedir_seguir", "pedir_email", "lembrete"].forEach((id) => {
      P.$("#au-" + id, janela).addEventListener("change", () => { ajustarEtapas(); desenharPrevia(); });
    });

    // Tudo que muda o texto redesenha a prévia
    ["au-mensagem", "au-link", "au-link-texto", "au-boas_vindas_texto", "au-boas_vindas_botao",
     "au-pedir_seguir_texto", "au-pedir_email_texto", "au-lembrete_texto", "au-lembrete_horas"
    ].forEach((id) => {
      P.$("#" + id, janela).addEventListener("input", desenharPrevia);
    });

    P.$$(".au-respostas input", janela).forEach((i) => i.addEventListener("input", contarRespostas));

    P.$("#au-apagar", janela).addEventListener("click", apagar);
    P.$("#au-form", janela).addEventListener("submit", salvar);
  }

  // Só para você saber, sem abrir o Instagram, quantas frases estão
  // entrando no sorteio das respostas públicas.
  function respostasEscritas() {
    return ["au-publica", "au-publica-2", "au-publica-3", "au-publica-4"]
      .map(val).filter(Boolean);
  }

  function contarRespostas() {
    const quantas = respostasEscritas().length;
    P.$("#au-conta-respostas", janela).textContent = quantas > 1
      ? `O robô vai sortear entre ${quantas} respostas.`
      : quantas === 1 ? "Só uma resposta escrita, então ela vai repetir embaixo de todo comentário." : "";
  }

  // Mostra ou esconde os campos do link. O botão "Adicionar um link"
  // some quando os campos aparecem, para não ficarem os dois na tela.
  function mostrarLink(mostrar) {
    P.$("#au-link-campos", janela).hidden = !mostrar;
    P.$("#au-add-link", janela).hidden = mostrar;
    if (mostrar) P.$("#au-link", janela).focus();
    desenharPrevia();
  }

  /* As etapas de seguir, e-mail e lembrete precisam saber QUEM é a
     pessoa, e o Instagram só conta isso depois que ela toca em algo seu.
     Num comentário ninguém tocou em nada ainda, então essas três só
     funcionam junto com as boas-vindas. O painel liga sozinho e avisa. */
  function ajustarEtapas() {
    const gatilho = P.$("#au-gatilho", janela).value;
    const dependentes = ["pedir_seguir", "pedir_email", "lembrete"];
    const precisa = gatilho === "comentario" && dependentes.some((d) => marcado("au-" + d));

    if (precisa && !marcado("au-boas_vindas")) P.$("#au-boas_vindas", janela).checked = true;

    const aviso = P.$("#au-aviso-etapas", janela);
    aviso.hidden = !precisa;
    aviso.textContent = precisa
      ? "As boas-vindas ficam ligadas porque num comentário o Instagram só me conta quem é a pessoa depois que ela toca no botão."
      : "";

    ["boas_vindas", "pedir_seguir", "pedir_email", "lembrete"].forEach((id) => {
      const ligada = marcado("au-" + id);
      P.$("#au-campos-" + id, janela).hidden = !ligada;
      P.$$(`[data-etapa="${id}"]`, janela).forEach((s) => s.classList.toggle("ligada", ligada));
    });

    // Sem link não existe o que lembrar de abrir
    const semLink = !val("au-link");
    const cartaoLembrete = P.$('[data-etapa="lembrete"]', janela);
    cartaoLembrete.classList.toggle("impedida", semLink);
    P.$("#au-lembrete", janela).disabled = semLink;
    if (semLink && marcado("au-lembrete")) P.$("#au-lembrete", janela).checked = false;
  }

  /* A prévia: os balões da DM na ordem em que vão chegar. Não é foto de
     celular, é o conteúdo de verdade, que é o que importa conferir. */
  function balao(texto, botoes, nota, vazio) {
    return `
      <div class="au-passo">
        <div class="au-balao">
          <p>${texto ? P.esc(texto) : `<span class="mudo">${P.esc(vazio || "")}</span>`}</p>
          ${(botoes || []).map((b) => `<span class="au-botao-dm">${P.esc(b)}</span>`).join("")}
        </div>
        ${nota ? `<p class="mudo pequeno">${P.esc(nota)}</p>` : ""}
      </div>`;
  }

  function desenharPrevia() {
    if (!janela) return;
    ajustarEtapas();
    const link = val("au-link");
    const rotuloLink = val("au-link-texto") || "Ver agora";
    const passos = [];

    if (marcado("au-boas_vindas")) {
      passos.push(balao(
        val("au-boas_vindas_texto") || val("au-mensagem"),
        [val("au-boas_vindas_botao") || PADRAO.botaoBoasVindas],
        "Nada mais acontece enquanto ela não tocar nesse botão.",
        "sua mensagem de boas-vindas aqui"));
    }
    if (marcado("au-pedir_seguir")) {
      passos.push(balao(
        val("au-pedir_seguir_texto") || PADRAO.seguir,
        ["Seguir", "Já segui"],
        "Só para quem ainda não te segue."));
    }
    passos.push(balao(
      val("au-mensagem"),
      link ? [rotuloLink] : [],
      link ? "O botão leva para " + curto(link, 45) : "",
      "sua mensagem aqui"));
    if (marcado("au-pedir_email")) {
      passos.push(balao(
        val("au-pedir_email_texto") || PADRAO.email,
        [],
        "A resposta dela entra na lista de e-mails desta aba."));
    }
    if (marcado("au-lembrete")) {
      const horas = Math.round(P.num(val("au-lembrete_horas"))) || 20;
      passos.push(balao(
        val("au-lembrete_texto") || PADRAO.lembrete,
        link ? [rotuloLink] : [],
        `Só para quem não abriu o link, ${horas} ${horas === 1 ? "hora" : "horas"} depois.`));
    }
    P.$("#au-previa", janela).innerHTML = passos.join("");
  }

  function fechar() { if (janela.open) janela.close(); }

  function erroNaJanela(msg) {
    const el = P.$("#au-erro", janela);
    el.textContent = msg || "";
    el.hidden = !msg;
  }

  // Post e resposta pública só existem no comentário.
  // Palavras-chave não existem na primeira DM: ali vale qualquer coisa.
  function ajustarGatilho() {
    const gatilho = P.$("#au-gatilho", janela).value;
    const comentario = gatilho === "comentario";
    P.$("#au-bloco-post", janela).hidden = !comentario;
    P.$("#au-bloco-publica", janela).hidden = !comentario;
    P.$("#au-bloco-palavras", janela).hidden = gatilho === "primeira_dm";
    P.$("#au-ajuda-gatilho", janela).textContent = gatilho === "primeira_dm"
      ? "Vale uma vez por pessoa, na primeira mensagem que ela te manda. O Instagram não avisa ninguém quando você ganha um seguidor, então esta é a boas-vindas que dá para fazer de verdade."
      : "";
    desenharPrevia();
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
    P.$("#au-publica-2", janela).value = regra ? P.texto(regra.resposta_publica_2) : "";
    P.$("#au-publica-3", janela).value = regra ? P.texto(regra.resposta_publica_3) : "";
    P.$("#au-publica-4", janela).value = regra ? P.texto(regra.resposta_publica_4) : "";
    P.$("#au-ativa", janela).checked = regra ? !!regra.ativa : true;
    P.$("#au-link", janela).value = regra ? P.texto(regra.link) : "";
    P.$("#au-link-texto", janela).value = regra ? P.texto(regra.link_texto) : "";

    P.$("#au-boas_vindas", janela).checked = !!(regra && regra.boas_vindas);
    P.$("#au-boas_vindas_texto", janela).value = regra ? P.texto(regra.boas_vindas_texto) : "";
    P.$("#au-boas_vindas_botao", janela).value = regra ? P.texto(regra.boas_vindas_botao) : "";
    P.$("#au-pedir_seguir", janela).checked = !!(regra && regra.pedir_seguir);
    P.$("#au-pedir_seguir_texto", janela).value = regra ? P.texto(regra.pedir_seguir_texto) : "";
    P.$("#au-pedir_email", janela).checked = !!(regra && regra.pedir_email);
    P.$("#au-pedir_email_texto", janela).value = regra ? P.texto(regra.pedir_email_texto) : "";
    P.$("#au-pedir_email_ok", janela).value = regra ? P.texto(regra.pedir_email_ok) : "";
    P.$("#au-lembrete", janela).checked = !!(regra && regra.lembrete);
    P.$("#au-lembrete_texto", janela).value = regra ? P.texto(regra.lembrete_texto) : "";
    P.$("#au-lembrete_horas", janela).value = regra && regra.lembrete_horas ? regra.lembrete_horas : 20;

    mostrarLink(!!(regra && regra.link));
    P.$("#au-posts", janela).hidden = true;
    P.$("#au-posts", janela).innerHTML = "";
    postEscolhido = regra && regra.post_id ? { id: regra.post_id, legenda: regra.post_legenda } : null;
    mostrarPost();
    ajustarGatilho();
    contarRespostas();
    if (typeof janela.showModal === "function") janela.showModal(); else janela.setAttribute("open", "");
    P.$("#au-nome", janela).focus();
  }

  async function salvar(e) {
    e.preventDefault();
    const gatilho = P.$("#au-gatilho", janela).value;
    const comentario = gatilho === "comentario";
    // As respostas vazias saem da lista e as que sobraram sobem, para
    // não ficar buraco no meio nem frase em branco no sorteio.
    const publicas = comentario ? respostasEscritas() : [];
    const link = val("au-link");
    const horas = Math.round(P.num(val("au-lembrete_horas"))) || 20;

    const valores = {
      nome: val("au-nome"),
      gatilho,
      palavras: gatilho === "primeira_dm" ? "" : val("au-palavras"),
      mensagem: val("au-mensagem"),
      resposta_publica: publicas[0] || null,
      resposta_publica_2: publicas[1] || null,
      resposta_publica_3: publicas[2] || null,
      resposta_publica_4: publicas[3] || null,
      post_id: comentario && postEscolhido ? postEscolhido.id : null,
      post_legenda: comentario && postEscolhido ? postEscolhido.legenda : null,
      ativa: marcado("au-ativa"),

      link: link || null,
      link_texto: link ? (val("au-link-texto") || "Ver agora") : null,

      boas_vindas: marcado("au-boas_vindas"),
      boas_vindas_texto: val("au-boas_vindas_texto") || null,
      boas_vindas_botao: val("au-boas_vindas_botao") || null,

      pedir_seguir: marcado("au-pedir_seguir"),
      pedir_seguir_texto: val("au-pedir_seguir_texto") || null,

      pedir_email: marcado("au-pedir_email"),
      pedir_email_texto: val("au-pedir_email_texto") || null,
      pedir_email_ok: val("au-pedir_email_ok") || null,

      lembrete: marcado("au-lembrete") && !!link,
      lembrete_texto: val("au-lembrete_texto") || null,
      lembrete_horas: Math.min(23, Math.max(1, horas))
    };

    if (!valores.nome) return erroNaJanela('Preencha o campo "Nome".');
    if (gatilho !== "primeira_dm" && !valores.palavras) return erroNaJanela('Preencha o campo "Palavras-chave".');
    if (!valores.mensagem) return erroNaJanela('Escreva a mensagem que a pessoa vai receber.');
    if (link && !/^https?:\/\//i.test(link)) return erroNaJanela("O link precisa começar com https://");
    if (valores.boas_vindas && !valores.boas_vindas_texto && !valores.mensagem) {
      return erroNaJanela("Escreva o texto das boas-vindas.");
    }

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
            const escolhido = postEscolhido && postEscolhido.id === p.id;
            return `<button class="au-post" type="button" data-id="${P.esc(p.id)}" data-legenda="${P.esc(legenda)}"
                      aria-pressed="${escolhido ? "true" : "false"}" title="${P.esc(legenda || "Post sem legenda")}">
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
