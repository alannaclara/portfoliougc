/* =========================================================
   ABA VISÃO GERAL (Instagram)
   Duas partes: a análise do seu perfil, feita sozinha a partir
   dos números que o Instagram devolve, e a análise das outras
   creators, feita a partir do que você anota na aba Transcrição.

   Nada aqui é opinião: cada frase mostra a conta que a gerou.
   Quando não há post suficiente para concluir, a aba diz isso
   em vez de inventar um padrão.
   ========================================================= */
(function () {
  "use strict";
  const P = window.Painel;

  const SUBABAS = [["meu", "Meu perfil"], ["rivais", "Concorrentes"]];
  const DIAS = ["domingo", "segunda", "terça", "quarta", "quinta", "sexta", "sábado"];
  const MINIMO_POR_LADO = 8;   // menos que isso de cada lado não vira conclusão
  const DIFERENCA_MINIMA = 1.25; // precisa ser 25% melhor ou pior para virar regra

  let secao = null;
  let atual = "meu";
  let posts = [];
  let rivais = [];
  let avisoCompartilhados = false;

  /* ---------- Contas ---------- */
  const num = (v) => (Number.isFinite(Number(v)) ? Number(v) : 0);
  const media = (lista, campo) => (lista.length ? Math.round(lista.reduce((s, x) => s + num(x[campo]), 0) / lista.length) : 0);
  const mediana = (lista, campo) => {
    if (!lista.length) return 0;
    const v = lista.map((x) => num(x[campo])).sort((a, b) => a - b);
    return v[Math.floor(v.length / 2)];
  };
  // O que conta como interação confiável. Compartilhamento fica de fora
  // de propósito: a Meta devolve valores impossíveis nesse campo.
  const interacoes = (x) => num(x.curtidas) + num(x.comentarios) + num(x.salvos);

  /* ---------- A aba ---------- */
  P.abas.visaogeral = {
    async iniciar(s) {
      secao = s;
      s.innerHTML = `
        <div class="avisos"></div>
        <div class="subabas filtros" id="vg-subabas" role="tablist" aria-label="Partes da visão geral">
          ${SUBABAS.map(([v, n]) => `<button class="filtro" type="button" role="tab" data-sub="${v}" aria-selected="${v === atual}" aria-pressed="${v === atual}">${n}</button>`).join("")}
        </div>
        <div id="vg-conteudo"><p class="carregando">Carregando...</p></div>`;
      P.$("#vg-subabas", s).addEventListener("click", (e) => {
        const b = e.target.closest("[data-sub]");
        if (!b) return;
        atual = b.dataset.sub;
        P.$$("[data-sub]", s).forEach((x) => {
          x.setAttribute("aria-selected", String(x === b));
          x.setAttribute("aria-pressed", String(x === b));
        });
        desenhar();
      });
      P.$("#vg-conteudo", s).addEventListener("click", aoClicar);
      await carregar();
    },
    async aoMostrar() { await carregar(); }
  };

  async function carregar() {
    const avisos = P.$(".avisos", secao);
    P.limparAvisos(avisos);
    const [rp, rt] = await Promise.all([
      P.lerSeguro("instagram_posts", (q) => q.order("postado_em", { ascending: false })),
      P.lerSeguro("transcricoes", (q) => q.eq("de_quem", "outra").order("created_at", { ascending: false }))
    ]);
    if (rp.erro) P.avisar(avisos, rp.erro + " O arquivo é o visao-geral.sql.");
    if (rt.erro) P.avisar(avisos, rt.erro);
    posts = rp.dados;
    rivais = rt.dados;
    avisoCompartilhados = posts.filter((x) => num(x.compartilhados) > num(x.visualizacoes)).length > posts.length * 0.1;
    desenhar();
  }

  function desenhar() {
    const alvo = P.$("#vg-conteudo", secao);
    if (atual === "meu") desenharMeu(alvo); else desenharRivais(alvo);
  }

  /* =========================================================
     PARTE 1: O MEU PERFIL
     ========================================================= */
  function desenharMeu(alvo) {
    if (!posts.length) {
      alvo.innerHTML = `<div class="cartao"><p class="vazio"><b>Ainda não tem nada para analisar.</b><br>
        Clique em atualizar para eu buscar os seus posts no Instagram.</p>
        <div class="grupo-botoes" style="justify-content:center;padding:0 14px 20px">
          <button class="botao botao-principal" type="button" id="vg-atualizar">${P.icone("recarregar", "ico-p")}Buscar meus posts</button>
        </div></div>`;
      return;
    }

    const datas = posts.map((x) => x.postado_em).filter(Boolean).sort();
    const formatos = agruparPorFormato(posts);
    const melhorFormato = [...formatos].sort((a, b) => b.views - a.views)[0];
    const ordenados = [...posts].sort((a, b) => num(b.visualizacoes) - num(a.visualizacoes));
    const regras = descobrirRegras(posts);

    alvo.innerHTML = `
      <div class="ferramentas">
        <p class="mudo pequeno" style="flex:1 1 280px;min-width:0">
          ${P.plural(posts.length, "post analisado", "posts analisados")}, de ${P.dataBR(datas[0])} a ${P.dataBR(datas[datas.length - 1])}.
          Números atualizados ${P.dataBR(String(posts[0].atualizado_em).slice(0, 10))}.
        </p>
        <div class="grupo-botoes empurra">
          <button class="botao" type="button" id="vg-copiar">${P.icone("copiar", "ico-p")}Estudar com o Claude</button>
          <button class="botao botao-principal" type="button" id="vg-atualizar">${P.icone("recarregar", "ico-p")}Atualizar do Instagram</button>
        </div>
      </div>

      <div class="numeros" style="--colunas:4">
        ${numero("Visualizações por post", P.inteiro(media(posts, "visualizacoes")), "mediana de " + P.inteiro(mediana(posts, "visualizacoes")))}
        ${numero("Contas alcançadas", P.inteiro(media(posts, "alcance")), "por post")}
        ${numero("Melhor formato", melhorFormato.formato, P.inteiro(melhorFormato.views) + " views em média")}
        ${numero("Salvamentos por post", P.inteiro(media(posts, "salvos")), "o sinal mais forte de conteúdo útil")}
      </div>

      ${avisoCompartilhados ? `<div class="aviso-banco" role="alert">${P.icone("alerta")}<div>
        <b>Os compartilhamentos estão fora deste cálculo.</b> A Meta devolve números impossíveis nesse campo,
        como 16 mil compartilhamentos num vídeo de 2 mil visualizações. Confira um post seu no aplicativo do
        Instagram e me diga o número real, que eu decido se dá para voltar a usar.</div></div>` : ""}

      <div class="cartao bloco">
        <div class="cartao-topo"><h2>O formato que deu certo</h2></div>
        <div class="tabela-rolagem">
          <table class="tabela">
            <thead><tr>
              <th>Formato</th><th class="num">Posts</th><th class="num">Views</th><th class="num">Alcance</th>
              <th class="num">Curtidas</th><th class="num">Comentários</th><th class="num">Salvos</th><th class="num">Engajamento</th>
            </tr></thead>
            <tbody>${formatos.map((f) => `
              <tr>
                <td><b>${P.esc(f.formato)}</b>${f.n < MINIMO_POR_LADO ? ` <span class="pilula p-amarelo">poucos posts</span>` : ""}</td>
                <td class="num">${f.n}</td><td class="num">${P.inteiro(f.views)}</td><td class="num">${P.inteiro(f.alcance)}</td>
                <td class="num">${P.inteiro(f.curtidas)}</td><td class="num">${P.inteiro(f.comentarios)}</td>
                <td class="num">${P.inteiro(f.salvos)}</td><td class="num">${f.engajamento}%</td>
              </tr>`).join("")}
            </tbody>
          </table>
        </div>
        <div class="cartao-corpo"><p class="mudo pequeno">
          Engajamento é curtidas, comentários e salvamentos divididos pelo alcance. Ele compara posts de
          tamanhos diferentes de forma justa: um vídeo pequeno com gente muito interessada ganha de um
          vídeo grande que ninguém tocou.
        </p></div>
      </div>

      ${blocoRegras(regras)}

      <div class="vg-par">
        ${blocoPosts("Os cinco que mais funcionaram", ordenados.slice(0, 5))}
        ${blocoPosts("Os cinco que menos funcionaram", ordenados.slice(-5).reverse())}
      </div>`;
  }

  function numero(rotulo, valor, sub) {
    return `<div class="numero"><div class="numero-rotulo">${P.esc(rotulo)}</div>
      <div class="numero-valor">${P.esc(valor)}</div>
      <div class="numero-sub">${P.esc(sub)}</div></div>`;
  }

  function agruparPorFormato(lista) {
    const grupos = {};
    lista.forEach((x) => { (grupos[x.formato] = grupos[x.formato] || []).push(x); });
    return Object.entries(grupos).map(([formato, xs]) => {
      const alcanceTotal = xs.reduce((s, x) => s + num(x.alcance), 0);
      const interTotal = xs.reduce((s, x) => s + interacoes(x), 0);
      return {
        formato, n: xs.length,
        views: media(xs, "visualizacoes"), alcance: media(xs, "alcance"),
        curtidas: media(xs, "curtidas"), comentarios: media(xs, "comentarios"), salvos: media(xs, "salvos"),
        engajamento: alcanceTotal ? Math.round(interTotal / alcanceTotal * 1000) / 10 : 0
      };
    }).sort((a, b) => b.n - a.n);
  }

  /* ---------- Os sinais: o que separa um post bom de um ruim ----------
     Para cada característica, compara a média de visualizações dos posts
     que a têm com a dos que não têm. Só vira regra quando os dois lados
     têm posts suficientes e a diferença é grande. */
  // O formato fica de fora desta lista de propósito: ele já tem a tabela
  // acima, e como quase todo post é Reels ou carrossel, ele apareceria
  // duas vezes, como "repetir" de um lado e "evitar" do outro.
  const CARACTERISTICAS = [
    { id: "pergunta", nome: "fazer uma pergunta na legenda", tem: (x) => /\?/.test(x.legenda || "") },
    { id: "curta", nome: "legenda curta, até 300 letras", tem: (x) => (x.legenda || "").length > 0 && (x.legenda || "").length <= 300 },
    { id: "publi", nome: "ser publicidade", tem: (x) => /\b(publi|parceria paga|ad|#publi)\b/i.test(x.legenda || "") },
    { id: "cupom", nome: "ter cupom ou desconto na legenda", tem: (x) => /\b(cupom|desconto|off|%)\b/i.test(x.legenda || "") },
    { id: "marca", nome: "marcar outro perfil", tem: (x) => /@\w/.test(x.legenda || "") },
    { id: "hashtag", nome: "usar hashtags", tem: (x) => /#\w/.test(x.legenda || "") },
    { id: "caps", nome: "começar a legenda gritando em maiúsculas", tem: (x) => /^[^a-zà-ú]{8,}/.test((x.legenda || "").trim()) },
    { id: "fimdesemana", nome: "postar no fim de semana", tem: (x) => [0, 6].includes(new Date(x.postado_em).getDay()) }
  ];

  function descobrirRegras(lista) {
    const validos = lista.filter((x) => x.postado_em && num(x.visualizacoes) > 0);
    const saida = [];
    CARACTERISTICAS.forEach((c) => {
      const com = validos.filter(c.tem);
      const sem = validos.filter((x) => !c.tem(x));
      if (com.length < MINIMO_POR_LADO || sem.length < MINIMO_POR_LADO) return;
      const mCom = media(com, "visualizacoes");
      const mSem = media(sem, "visualizacoes");
      if (!mSem) return;
      const razao = mCom / mSem;
      if (razao >= DIFERENCA_MINIMA) saida.push({ tipo: "repetir", nome: c.nome, mCom, mSem, razao, n: com.length });
      else if (razao <= 1 / DIFERENCA_MINIMA) saida.push({ tipo: "evitar", nome: c.nome, mCom, mSem, razao, n: com.length });
    });
    // O melhor e o pior dia, quando há dias com posts suficientes
    const porDia = {};
    validos.forEach((x) => { const d = new Date(x.postado_em).getDay(); (porDia[d] = porDia[d] || []).push(x); });
    const dias = Object.entries(porDia).filter(([, xs]) => xs.length >= MINIMO_POR_LADO)
      .map(([d, xs]) => ({ dia: DIAS[d], views: media(xs, "visualizacoes"), n: xs.length }))
      .sort((a, b) => b.views - a.views);
    return { sinais: saida.sort((a, b) => Math.abs(Math.log(b.razao)) - Math.abs(Math.log(a.razao))), dias };
  }

  function blocoRegras({ sinais, dias }) {
    const repetir = sinais.filter((s) => s.tipo === "repetir");
    const evitar = sinais.filter((s) => s.tipo === "evitar");
    const frase = (s) => {
      const vezes = s.razao >= 1 ? s.razao : 1 / s.razao;
      return `<li><b>${P.esc(s.nome)}</b><br>
        <span class="mudo pequeno">${P.inteiro(s.mCom)} views em média contra ${P.inteiro(s.mSem)} sem isso,
        ou seja ${Math.round(vezes * 10) / 10}x. Medido em ${P.plural(s.n, "post", "posts")}.</span></li>`;
    };

    if (!repetir.length && !evitar.length && !dias.length) {
      return `<div class="cartao bloco"><div class="cartao-topo"><h2>O que repetir e o que não repetir</h2></div>
        <div class="cartao-corpo"><p class="mudo">Ainda não encontrei nenhum padrão forte o bastante para
        virar recomendação. Isso é bom sinal de honestidade e mau sinal de amostra: com mais posts variados,
        os padrões aparecem. Eu só afirmo quando há pelo menos ${MINIMO_POR_LADO} posts de cada lado e uma
        diferença de ${Math.round((DIFERENCA_MINIMA - 1) * 100)}% ou mais.</p></div></div>`;
    }

    return `<p class="mudo pequeno" style="margin:-4px 0 12px">
      Isto é o que aconteceu junto, não o que causou. Um post pode ter ido bem pelo assunto, e não pela
      característica que a conta pegou. Use como pista para testar, não como lei.
    </p>
    <div class="vg-par">
      <div class="cartao">
        <div class="cartao-topo"><h2>O que repetir</h2>${P.pilula(String(repetir.length), "verde")}</div>
        <div class="cartao-corpo">
          ${repetir.length ? `<ul class="dicas">${repetir.map(frase).join("")}</ul>` : `<p class="mudo">Nada se destacou para cima.</p>`}
          ${dias.length ? `<p class="mudo pequeno" style="margin-top:12px">Melhor dia para postar: <b>${P.esc(dias[0].dia)}</b>,
            com ${P.inteiro(dias[0].views)} views em média em ${P.plural(dias[0].n, "post", "posts")}.</p>` : ""}
        </div>
      </div>
      <div class="cartao">
        <div class="cartao-topo"><h2>O que não repetir</h2>${P.pilula(String(evitar.length), "vermelho")}</div>
        <div class="cartao-corpo">
          ${evitar.length ? `<ul class="dicas">${evitar.map(frase).join("")}</ul>` : `<p class="mudo">Nada se destacou para baixo.</p>`}
          ${dias.length > 1 ? `<p class="mudo pequeno" style="margin-top:12px">Dia mais fraco: <b>${P.esc(dias[dias.length - 1].dia)}</b>,
            com ${P.inteiro(dias[dias.length - 1].views)} views em média.</p>` : ""}
        </div>
      </div>
    </div>`;
  }

  function blocoPosts(titulo, lista) {
    return `<div class="cartao">
      <div class="cartao-topo"><h2>${P.esc(titulo)}</h2></div>
      <div class="cartao-corpo"><ul class="lista-simples">${lista.map((x) => `
        <li>
          <span class="cresce">
            <b>${P.esc(P.texto(x.formato))}</b> · ${P.dataBR(String(x.postado_em).slice(0, 10))}<br>
            <span class="mudo pequeno">${P.esc(curto(x.legenda, 70) || "sem legenda")}</span>
          </span>
          <span class="pilula p-ciano">${P.inteiro(x.visualizacoes)} views</span>
          <span class="mudo pequeno">${P.inteiro(x.curtidas)} curtidas · ${P.inteiro(x.comentarios)} coment. · ${P.inteiro(x.salvos)} salvos</span>
          ${x.permalink ? `<a class="botao botao-icone" href="${P.esc(x.permalink)}" target="_blank" rel="noopener" aria-label="Abrir no Instagram">${P.icone("link")}</a>` : ""}
        </li>`).join("")}</ul></div>
    </div>`;
  }

  const curto = (t, n) => {
    const s = String(t == null ? "" : t).replace(/\s+/g, " ").trim();
    return s.length > n ? s.slice(0, n - 1) + "…" : s;
  };

  /* =========================================================
     PARTE 2: OS CONCORRENTES
     Vem da aba Transcrição, dos vídeos marcados como "De outra".
     ========================================================= */
  function desenharRivais(alvo) {
    if (!rivais.length) {
      alvo.innerHTML = `<div class="cartao"><p class="vazio">
        <b>Nenhum vídeo de outra creator ainda.</b><br>
        Vá na aba Transcrição, cole o link de um reel de alguém que você acompanha e marque como
        "De outra". Ele aparece aqui para você anotar os números.</p></div>`;
      return;
    }

    const comNumeros = rivais.filter((x) => num(x.visualizacoes) > 0);
    const meuViews = media(posts, "visualizacoes");
    const delasViews = media(comNumeros, "visualizacoes");

    alvo.innerHTML = `
      <div class="ferramentas">
        <p class="mudo pequeno" style="flex:1 1 280px;min-width:0">
          ${P.plural(rivais.length, "vídeo salvo", "vídeos salvos")} de outras creators,
          ${comNumeros.length} com número anotado. Quanto mais você anotar, mais firme fica a comparação.
        </p>
        <div class="grupo-botoes empurra">
          <button class="botao" type="button" id="vg-copiar-rivais">${P.icone("copiar", "ico-p")}Estudar com o Claude</button>
        </div>
      </div>

      ${comNumeros.length >= 3 ? `
      <div class="numeros" style="--colunas:3">
        ${numero("Views delas", P.inteiro(delasViews), "média dos " + comNumeros.length + " anotados")}
        ${numero("Suas views", P.inteiro(meuViews), "média dos seus " + posts.length + " posts")}
        ${numero("Diferença", (delasViews && meuViews ? (delasViews > meuViews ? "+" : "") + Math.round((delasViews / meuViews - 1) * 100) + "%" : "-"), "delas em relação às suas")}
      </div>` : `<div class="aviso-banco" role="alert">${P.icone("alerta")}<div>
        Com menos de três vídeos anotados eu não comparo médias, porque um vídeo fora da curva
        entortaria a conclusão inteira. Anote os números de mais alguns.</div></div>`}

      <div class="cartao bloco">
        <div class="cartao-topo">
          <h2>Os vídeos delas</h2>
          <span class="mudo pequeno">Clique numa linha para anotar os números</span>
        </div>
        <div class="tabela-rolagem">
          <table class="tabela">
            <thead><tr>
              <th>Perfil</th><th>Vídeo</th><th>Formato</th>
              <th class="num">Views</th><th class="num">Curtidas</th><th class="num">Coment.</th><th class="acoes"></th>
            </tr></thead>
            <tbody>${[...rivais].sort((a, b) => num(b.visualizacoes) - num(a.visualizacoes)).map((x) => `
              <tr class="clicavel" data-rival="${P.esc(x.id)}">
                <td class="curta"><b>${P.esc(P.arroba(x.perfil) || "sem perfil")}</b></td>
                <td class="corta">${P.esc(curto(x.titulo || x.legenda || x.transcricao, 60) || "sem título")}</td>
                <td class="curta">${x.formato ? P.pilula(x.formato, "cinza") : `<span class="mudo">-</span>`}</td>
                <td class="num">${x.visualizacoes == null ? `<span class="mudo">anotar</span>` : P.inteiro(x.visualizacoes)}</td>
                <td class="num">${x.curtidas == null ? "-" : P.inteiro(x.curtidas)}</td>
                <td class="num">${x.comentarios == null ? "-" : P.inteiro(x.comentarios)}</td>
                <td class="acoes">${x.url ? `<a class="botao botao-icone" href="${P.esc(x.url)}" target="_blank" rel="noopener" aria-label="Abrir vídeo" data-parar>${P.icone("link")}</a>` : ""}</td>
              </tr>`).join("")}
            </tbody>
          </table>
        </div>
      </div>

      ${blocoGanchos(comNumeros)}`;
  }

  /* Os ganchos: as primeiras palavras faladas em cada vídeo. É o que
     segura a pessoa nos três primeiros segundos, e é o que mais vale
     copiar como estrutura, nunca como frase pronta. */
  function blocoGanchos(lista) {
    const comTexto = lista.filter((x) => (x.transcricao || "").trim().length > 20);
    if (comTexto.length < 3) {
      return `<div class="cartao"><div class="cartao-topo"><h2>Os ganchos delas</h2></div>
        <div class="cartao-corpo"><p class="mudo">Preciso de pelo menos três vídeos transcritos e com
        número anotado para montar esta parte. Transcreva mais alguns na aba Transcrição.</p></div></div>`;
    }
    const ordenados = [...comTexto].sort((a, b) => num(b.visualizacoes) - num(a.visualizacoes)).slice(0, 8);
    return `<div class="cartao bloco">
      <div class="cartao-topo"><h2>Os ganchos que mais funcionaram</h2></div>
      <div class="cartao-corpo">
        <p class="mudo pequeno" style="margin-bottom:12px">As primeiras palavras faladas nos vídeos delas que
        mais rodaram. Copie a estrutura, nunca a frase: frase repetida o público reconhece na hora.</p>
        <div class="blocos-tempo">${ordenados.map((x) => `
          <div class="bloco-tempo">
            <span class="tempo">${P.inteiro(x.visualizacoes)}</span>
            <span>${P.esc(curto(x.transcricao, 130))}</span>
          </div>`).join("")}</div>
      </div>
    </div>`;
  }

  /* ---------- Cliques ---------- */
  async function aoClicar(e) {
    if (e.target.closest("[data-parar]")) return;

    if (e.target.closest("#vg-atualizar")) return atualizar(e.target.closest("#vg-atualizar"));
    if (e.target.closest("#vg-copiar")) return copiarEstudo("meu");
    if (e.target.closest("#vg-copiar-rivais")) return copiarEstudo("rivais");

    const linha = e.target.closest("[data-rival]");
    if (linha) abrirRival(rivais.find((x) => String(x.id) === linha.dataset.rival));
  }

  async function atualizar(botao) {
    botao.disabled = true;
    const antes = botao.innerHTML;
    botao.innerHTML = "Buscando no Instagram...";
    try {
      const { data, error } = await banco.functions.invoke("instagram", { body: { acao: "sincronizar" } });
      if (error) throw new Error(error.message || "erro");
      if (data && data.erro) throw new Error(data.erro);
      P.toast(`${P.plural(data.gravados, "post atualizado", "posts atualizados")}.`);
      await carregar();
    } catch (erro) {
      P.toast("Não consegui buscar agora. Se o token do Instagram venceu, é só gerar outro na Meta e trocar o IG_TOKEN no Supabase.", "erro");
      botao.disabled = false;
      botao.innerHTML = antes;
    }
  }

  function abrirRival(x) {
    if (!x) return;
    P.formulario({
      titulo: P.arroba(x.perfil) || "Vídeo de outra creator",
      valores: x,
      campos: [
        { nome: "formato", rotulo: "Formato", tipo: "escolha", opcoes: [["", "Não sei"], ["Reels", "Reels"], ["Carrossel", "Carrossel"], ["Foto", "Foto"]] },
        { nome: "visualizacoes", rotulo: "Visualizações", tipo: "numero", ajuda: "O número que aparece embaixo do vídeo" },
        { nome: "curtidas", rotulo: "Curtidas", tipo: "numero" },
        { nome: "comentarios", rotulo: "Comentários", tipo: "numero" },
        { nome: "seguidores", rotulo: "Seguidores do perfil", tipo: "numero", ajuda: "Ajuda a comparar com quem tem tamanho parecido com o seu" },
        { nome: "obs", rotulo: "O que você achou", tipo: "texto-longo", largo: true, ajuda: "Por que você acha que funcionou, o que daria para adaptar" }
      ],
      aoSalvar: async (v) => {
        const erro = await P.gravar("transcricoes", "atualizar", {
          formato: v.formato || null,
          visualizacoes: v.visualizacoes || null,
          curtidas: v.curtidas || null,
          comentarios: v.comentarios || null,
          seguidores: v.seguidores || null,
          obs: v.obs
        }, x.id);
        if (erro) return erro;
        P.toast("Anotado.");
        await carregar();
        return null;
      }
    });
  }

  /* ---------- O prompt para estudar com o Claude ----------
     O painel não tem nenhuma chave de inteligência artificial, e é de
     propósito. Aqui a gente só monta o texto e copia: você cola numa
     conversa com o Claude e recebe a leitura qualitativa. */
  async function copiarEstudo(qual) {
    let texto = "";
    if (qual === "meu") {
      const ord = [...posts].sort((a, b) => num(b.visualizacoes) - num(a.visualizacoes));
      const linha = (x) => `- ${x.formato}, ${P.dataBR(String(x.postado_em).slice(0, 10))}: ${num(x.visualizacoes)} views, ${num(x.alcance)} alcance, ${num(x.curtidas)} curtidas, ${num(x.comentarios)} comentários, ${num(x.salvos)} salvos\n  legenda: "${curto(x.legenda, 220)}"`;
      texto = `Sou creator de UGC. Aqui estão os meus 10 posts que mais funcionaram e os 10 que menos funcionaram no Instagram, com os números reais.\n\nME DIGA: que formato deu certo, por que deu certo, o que eu devo repetir e o que não devo repetir. Fale das legendas e dos ganchos, não só dos números.\n\nOS 10 MELHORES:\n${ord.slice(0, 10).map(linha).join("\n")}\n\nOS 10 PIORES:\n${ord.slice(-10).map(linha).join("\n")}`;
    } else {
      const ord = [...rivais].filter((x) => (x.transcricao || "").trim()).sort((a, b) => num(b.visualizacoes) - num(a.visualizacoes)).slice(0, 8);
      texto = `Sou creator de UGC. Abaixo estão roteiros de vídeos de outras creators que eu acompanho, transcritos, com os números que eu anotei.\n\nME DIGA: que padrão de gancho e de estrutura aparece nos que mais rodaram, por que funciona, o que eu posso adaptar para o meu conteúdo e o que seria cópia demais.\n\n${ord.map((x) => `--- ${P.arroba(x.perfil) || "creator"} · ${num(x.visualizacoes)} views · ${num(x.curtidas)} curtidas\n${curto(x.transcricao, 1200)}`).join("\n\n")}`;
    }
    try {
      await navigator.clipboard.writeText(texto);
      P.toast("Copiado. Cole numa conversa com o Claude.");
    } catch (erro) {
      P.ver("Copie este texto", `<textarea style="width:100%;min-height:340px">${P.esc(texto)}</textarea>`);
    }
  }
})();
