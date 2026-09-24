/* =========================================================
   ABA VISÃO GERAL (Instagram)

   Três partes:
     1. Visão geral    o retrato de agora, com os gráficos do mês
     2. Relatório do mês  este mês contra o mês passado, e o que fazer
     3. Concorrência   as outras creators, a partir da aba Transcrição

   Regra da casa: nada aqui é opinião solta. Cada frase mostra a conta
   que a gerou, e quando não há post suficiente para concluir, a aba
   diz isso em vez de inventar um padrão.

   Os dados vêm de três lugares, todos preenchidos pelo botão
   "Atualizar do Instagram": instagram_posts, instagram_dias e a
   linha instagram_conta da tabela configuracoes.
   ========================================================= */
(function () {
  "use strict";
  const P = window.Painel;

  const SUBABAS = [["agora", "Visão geral"], ["mes", "Relatório do mês"], ["rivais", "Concorrência"]];
  const DIAS_SEMANA = ["domingo", "segunda", "terça", "quarta", "quinta", "sexta", "sábado"];
  const MESES = ["janeiro", "fevereiro", "março", "abril", "maio", "junho", "julho", "agosto", "setembro", "outubro", "novembro", "dezembro"];
  const MINIMO_POR_LADO = 8;
  const DIFERENCA_MINIMA = 1.25;

  let secao = null;
  let atual = "agora";
  let periodo = 30;
  let posts = [];
  let dias = [];
  let conta = null;
  let rivais = [];

  /* ---------- Contas ---------- */
  const num = (v) => (Number.isFinite(Number(v)) ? Number(v) : 0);
  const soma = (lista, campo) => lista.reduce((s, x) => s + num(x[campo]), 0);
  const media = (lista, campo) => (lista.length ? Math.round(soma(lista, campo) / lista.length) : 0);
  const mediana = (lista, campo) => {
    if (!lista.length) return 0;
    const v = lista.map((x) => num(x[campo])).sort((a, b) => a - b);
    return v[Math.floor(v.length / 2)];
  };
  // Compartilhamento fica de fora: a Meta devolve valores impossíveis nesse campo.
  const interacoes = (x) => num(x.curtidas) + num(x.comentarios) + num(x.salvos);
  const curto = (t, n) => {
    const s = String(t == null ? "" : t).replace(/\s+/g, " ").trim();
    return s.length > n ? s.slice(0, n - 1) + "…" : s;
  };
  const mesDe = (iso) => String(iso || "").slice(0, 7);
  const nomeDoMes = (aaaaMM) => {
    const [a, m] = String(aaaaMM).split("-");
    return `${MESES[Number(m) - 1]} de ${a}`;
  };
  const variacao = (agora, antes) => (antes ? Math.round((agora / antes - 1) * 1000) / 10 : null);
  const setaVariacao = (v, bomSubir) => {
    if (v === null) return `<span class="mudo">-</span>`;
    const bom = bomSubir ? v >= 0 : v <= 0;
    return `<span class="${bom ? "vg-sobe" : "vg-desce"}">${v > 0 ? "+" : ""}${v}%</span>`;
  };

  /* ---------- Os temas, adivinhados pela legenda ----------
     Não é classificação perfeita: é palavra-chave. Serve para ver
     tendência, não para contabilidade. O primeiro que casar vence. */
  const TEMAS = [
    { nome: "Publi e parceria", teste: /\b(publi|parceria paga|recebid[oa]|#ad)\b/i },
    { nome: "Beleza e skincare", teste: /cabelo|pele|skincare|maquiagem|make\b|batom|s[ée]rum|hidrata/i },
    { nome: "Comida e lugares", teste: /comida|restaurante|caf[eé]|lanche|doce|jantar|almo[çc]o|curitiba|rol[êe]/i },
    { nome: "Bastidores e rotina", teste: /bastidor|rotina|dia a dia|vlog|meu dia|por tr[áa]s/i },
    { nome: "Trabalho e UGC", teste: /ugc|creator|m[íi]dia kit|portf[óo]lio|marca[s]?\b|cliente/i }
  ];
  const temaDe = (x) => (TEMAS.find((t) => t.teste.test(x.legenda || "")) || { nome: "Outros" }).nome;

  /* ---------- A aba ---------- */
  P.abas.visaogeral = {
    async iniciar(s) {
      secao = s;
      s.innerHTML = `
        <div class="avisos"></div>
        <div class="ferramentas">
          <div class="subabas filtros" id="vg-subabas" role="tablist" aria-label="Partes da visão geral">
            ${SUBABAS.map(([v, n]) => `<button class="filtro" type="button" role="tab" data-sub="${v}" aria-selected="${v === atual}" aria-pressed="${v === atual}">${n}</button>`).join("")}
          </div>
          <div class="grupo-botoes empurra">
            <button class="botao" type="button" id="vg-copiar">${P.icone("copiar", "ico-p")}Estudar com o Claude</button>
            <button class="botao botao-principal" type="button" id="vg-atualizar">${P.icone("recarregar", "ico-p")}Atualizar do Instagram</button>
          </div>
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
      s.addEventListener("click", aoClicar);
      await carregar();
    },
    async aoMostrar() { await carregar(); }
  };

  async function carregar() {
    const avisos = P.$(".avisos", secao);
    P.limparAvisos(avisos);
    const [rp, rd, rc, rt] = await Promise.all([
      P.lerSeguro("instagram_posts", (q) => q.order("postado_em", { ascending: false })),
      P.lerSeguro("instagram_dias", (q) => q.order("dia", { ascending: true })),
      P.lerSeguro("configuracoes", (q) => q.eq("chave", "instagram_conta")),
      P.lerSeguro("transcricoes", (q) => q.eq("de_quem", "outra").order("created_at", { ascending: false }))
    ]);
    if (rp.erro) P.avisar(avisos, rp.erro + " O arquivo é o visao-geral.sql.");
    if (rd.erro) P.avisar(avisos, rd.erro + " Rode o visao-geral.sql de novo, ele ganhou uma tabela nova.");
    posts = rp.dados;
    dias = rd.dados;
    rivais = rt.dados;
    conta = null;
    try { if (rc.dados[0]) conta = JSON.parse(rc.dados[0].valor); } catch (e) { conta = null; }
    desenhar();
  }

  function desenhar() {
    const alvo = P.$("#vg-conteudo", secao);
    if (!posts.length && atual !== "rivais") {
      alvo.innerHTML = `<div class="cartao"><p class="vazio"><b>Ainda não tem nada para analisar.</b><br>
        Clique em "Atualizar do Instagram" aí em cima para eu buscar os seus posts e os números da conta.</p></div>`;
      return;
    }
    if (atual === "agora") desenharAgora(alvo);
    else if (atual === "mes") desenharMes(alvo);
    else desenharRivais(alvo);
  }

  /* =========================================================
     PARTE 1: A VISÃO DE AGORA
     ========================================================= */
  function desenharAgora(alvo) {
    const janela = dias.slice(-periodo);
    const anterior = dias.slice(-periodo * 2, -periodo);
    const alcanceJanela = soma(janela, "alcance");
    const novosJanela = soma(janela, "novos_seguidores");
    const recentes = posts.slice(0, 12);
    const alcanceTotal = soma(recentes, "alcance");
    const engaj = alcanceTotal ? Math.round(recentes.reduce((s, x) => s + interacoes(x), 0) / alcanceTotal * 1000) / 10 : 0;

    alvo.innerHTML = `
      <div class="numeros" style="--colunas:4">
        ${numero("Seguidores", conta ? P.inteiro(conta.followers_count) : "-",
          novosJanela ? `+${P.inteiro(novosJanela)} em ${periodo} dias` : "atualize para ver")}
        ${numero("Contas alcançadas", P.inteiro(alcanceJanela),
          anterior.length ? `${setaVariacao(variacao(alcanceJanela, soma(anterior, "alcance")), true)} contra os ${periodo} dias antes` : `nos últimos ${periodo} dias`)}
        ${numero("Posts publicados", P.inteiro(conta ? conta.media_count : posts.length), `${posts.length} com números guardados`)}
        ${numero("Engajamento", engaj + "%", "dos últimos 12 posts, por alcance")}
      </div>

      ${blocoEstrategista()}

      <div class="vg-par">
        ${grafico("Crescimento de perfil", "novos seguidores por dia", janela, "novos_seguidores", P.inteiro(novosJanela) + " novos")}
        ${grafico("Alcance", "contas alcançadas por dia", janela, "alcance", P.inteiro(alcanceJanela) + " contas")}
      </div>

      <div class="ferramentas">
        <div class="filtros" id="vg-periodo" role="group" aria-label="Período dos gráficos">
          ${[7, 15, 30, 90].map((d) => `<button class="filtro" type="button" data-periodo="${d}" aria-pressed="${d === periodo}">${d} dias</button>`).join("")}
        </div>
        <p class="mudo pequeno">${P.plural(dias.length, "dia guardado", "dias guardados")} até agora.
          O Instagram só entrega 30 dias, então a série cresce a cada vez que você atualiza.</p>
      </div>

      ${blocoPostos("Os que mais funcionaram nos últimos 90 dias", ultimosDias(90).sort((a, b) => num(b.visualizacoes) - num(a.visualizacoes)).slice(0, 5))}`;
  }

  function ultimosDias(n) {
    const limite = Date.now() - n * 86400000;
    return posts.filter((x) => new Date(x.postado_em).getTime() >= limite);
  }

  function numero(rotulo, valor, sub) {
    return `<div class="numero"><div class="numero-rotulo">${P.esc(rotulo)}</div>
      <div class="numero-valor">${P.esc(valor)}</div>
      <div class="numero-sub">${sub}</div></div>`;
  }

  function grafico(titulo, subtitulo, lista, campo, resumo) {
    if (!lista.length) {
      return `<div class="cartao"><div class="cartao-topo"><h2>${P.esc(titulo)}</h2></div>
        <div class="cartao-corpo"><p class="mudo">Sem histórico ainda. Clique em atualizar.</p></div></div>`;
    }
    const maior = Math.max(...lista.map((x) => num(x[campo])), 1);
    const pico = lista.reduce((a, b) => (num(b[campo]) > num(a[campo]) ? b : a));
    const med = Math.round(soma(lista, campo) / lista.length * 10) / 10;
    return `<div class="cartao">
      <div class="cartao-topo"><h2>${P.esc(titulo)}</h2><span class="mudo pequeno">${P.esc(subtitulo)}</span></div>
      <div class="cartao-corpo">
        <p class="numero-valor" style="font-size:22px">${resumo}</p>
        <div class="vg-grafico" style="--barras:${lista.length}">
          ${lista.map((x) => {
            const v = num(x[campo]);
            const altura = Math.max(2, Math.round(v / maior * 100));
            return `<div class="vg-col${x === pico ? " alto" : ""}" title="${P.dataBR(x.dia)}: ${P.inteiro(v)}">
              <span class="vg-barra" style="height:${altura}%"></span></div>`;
          }).join("")}
        </div>
        <div class="vg-eixo"><span>${P.dataBR(lista[0].dia)}</span><span>${P.dataBR(lista[lista.length - 1].dia)}</span></div>
        <p class="mudo pequeno" style="margin-top:8px">média de ${med} por dia · pico de ${P.inteiro(num(pico[campo]))} em ${P.dataBR(pico.dia)}</p>
      </div>
    </div>`;
  }

  /* ---------- O estrategista: a leitura em frases ----------
     Cada frase só aparece quando o dado que a sustenta existe. */
  function blocoEstrategista() {
    const linhas = [];
    const diz = (tipo, icone, texto) => linhas.push({ tipo, icone, texto });

    const janela = dias.slice(-30);
    const antes = dias.slice(-60, -30);
    const novos = soma(janela, "novos_seguidores");
    const alcance = soma(janela, "alcance");

    if (conta && novos) {
      diz("bom", "check", `Você ganhou <b>${P.inteiro(novos)} seguidores</b> nos últimos 30 dias e está com ${P.inteiro(conta.followers_count)} no total.`);
    }
    if (antes.length >= 20) {
      const v = variacao(alcance, soma(antes, "alcance"));
      if (v !== null && v <= -20) diz("atencao", "alerta", `O alcance caiu <b>${Math.abs(v)}%</b> contra os 30 dias anteriores. Normalmente isso é frequência de post, não punição do Instagram.`);
      else if (v !== null && v >= 20) diz("bom", "check", `O alcance subiu <b>${v}%</b> contra os 30 dias anteriores. O que você mudou no último mês está funcionando.`);
    }

    // Há quantos dias sem postar
    if (posts.length) {
      const ultimo = new Date(posts[0].postado_em);
      const semPostar = Math.floor((Date.now() - ultimo.getTime()) / 86400000);
      if (semPostar >= 3) diz("atencao", "alerta", `Você está há <b>${P.plural(semPostar, "dia", "dias")}</b> sem postar. A frequência é o que mais mexe no alcance.`);
      else diz("bom", "check", `Último post foi ${semPostar <= 0 ? "hoje" : P.plural(semPostar, "dia atrás", "dias atrás")}. Frequência em dia.`);
    }

    // O formato que está rendendo nos últimos 90 dias
    const recentes = ultimosDias(90);
    if (recentes.length >= 6) {
      const grupos = agruparPorFormato(recentes).filter((f) => f.n >= 3);
      if (grupos.length >= 2) {
        const melhor = [...grupos].sort((a, b) => b.views - a.views)[0];
        const pior = [...grupos].sort((a, b) => a.views - b.views)[0];
        diz("ideia", "estrela", `Nos últimos 90 dias, <b>${melhor.formato}</b> rendeu ${P.inteiro(melhor.views)} views por post contra ${P.inteiro(pior.views)} de ${pior.formato}.`);
      }
    }

    // O melhor post recente, para ela se inspirar em si mesma
    const destaque = [...ultimosDias(60)].sort((a, b) => num(b.visualizacoes) - num(a.visualizacoes))[0];
    if (destaque && num(destaque.visualizacoes) > 0) {
      diz("ideia", "estrela", `Seu melhor post recente fez <b>${P.inteiro(destaque.visualizacoes)} views</b>: "${P.esc(curto(destaque.legenda, 70))}". Vale olhar o que ele tem que os outros não têm.`);
    }

    if (!linhas.length) return "";

    const foco = montarFoco();
    return `<div class="cartao bloco">
      <div class="cartao-topo"><h2>A leitura de hoje</h2><span class="mudo pequeno">montada a partir dos seus números</span></div>
      <div class="cartao-corpo">
        <div class="vg-leitura">${linhas.map((l) => `
          <div class="vg-linha"><span class="vg-${l.tipo}">${P.icone(l.icone)}</span><span>${l.texto}</span></div>`).join("")}
        </div>
        ${foco ? `<div class="vg-foco"><p>Foco da semana</p><p>${foco}</p></div>` : ""}
      </div>
    </div>`;
  }

  function montarFoco() {
    const { sinais } = descobrirRegras(posts);
    const forte = sinais.find((s) => s.tipo === "repetir") || sinais.find((s) => s.tipo === "evitar");
    if (!forte) return "";
    const vezes = Math.round((forte.razao >= 1 ? forte.razao : 1 / forte.razao) * 10) / 10;
    return forte.tipo === "repetir"
      ? `Faça um post testando de novo <b>${P.esc(forte.nome)}</b>. Quando você fez isso, rendeu ${vezes}x mais views.`
      : `No próximo post, tente <b>não</b> ${P.esc(forte.nome)}. Quando você fez isso, rendeu ${vezes}x menos views.`;
  }

  function blocoPostos(titulo, lista) {
    if (!lista.length) return "";
    return `<div class="cartao bloco">
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

  /* =========================================================
     PARTE 2: O RELATÓRIO DO MÊS
     ========================================================= */
  function desenharMes(alvo) {
    const meses = [...new Set(posts.map((x) => mesDe(x.postado_em)).filter(Boolean))].sort().reverse();
    if (meses.length < 2) {
      alvo.innerHTML = `<div class="cartao"><p class="vazio"><b>Preciso de dois meses de posts para comparar.</b><br>
        Você tem ${P.plural(meses.length, "mês", "meses")} até agora.</p></div>`;
      return;
    }
    const mes = meses[0];
    const antes = meses[1];
    const doMes = posts.filter((x) => mesDe(x.postado_em) === mes);
    const doAntes = posts.filter((x) => mesDe(x.postado_em) === antes);

    const METRICAS = [
      { nome: "Posts publicados", valor: doMes.length, antes: doAntes.length, bomSubir: true, leitura: (v) => v > 0 ? "Mais conteúdo no ar, o que costuma puxar o alcance junto." : "Menos posts que no mês passado, e o alcance costuma sentir." },
      { nome: "Alcance médio por post", valor: media(doMes, "alcance"), antes: media(doAntes, "alcance"), bomSubir: true, leitura: (v) => v > 0 ? "Cada post está chegando a mais gente." : "Cada post está chegando a menos gente que antes." },
      { nome: "Views médias por post", valor: media(doMes, "visualizacoes"), antes: media(doAntes, "visualizacoes"), bomSubir: true, leitura: (v) => v > 0 ? "O conteúdo está segurando mais gente." : "O conteúdo está segurando menos gente." },
      { nome: "Curtidas médias por post", valor: media(doMes, "curtidas"), antes: media(doAntes, "curtidas"), bomSubir: true, leitura: () => "Curtida é o sinal mais fraco, mas ainda conta." },
      { nome: "Comentários médios por post", valor: media(doMes, "comentarios"), antes: media(doAntes, "comentarios"), bomSubir: true, leitura: (v) => v > 0 ? "Mais conversa, e conversa é o que o Instagram mais premia." : "Menos conversa que no mês passado." },
      { nome: "Salvamentos médios por post", valor: media(doMes, "salvos"), antes: media(doAntes, "salvos"), bomSubir: true, leitura: (v) => v > 0 ? "Conteúdo mais útil: salvar é guardar para usar depois." : "Menos gente guardando o seu conteúdo para depois." }
    ];

    const porTema = agruparPor(doMes, temaDe);
    const porFormato = agruparPorFormato(doMes);
    const caixas = montarCaixasDoMes(METRICAS, porTema, porFormato);

    alvo.innerHTML = `
      <div class="ferramentas">
        <div>
          <h2 style="font-family:inherit;font-size:16px;font-weight:700">${P.esc(nomeDoMes(mes))}</h2>
          <p class="mudo pequeno">comparado com ${P.esc(nomeDoMes(antes))} · ${P.plural(doMes.length, "post", "posts")} no mês</p>
        </div>
      </div>

      <div class="vg-caixas">
        <div class="vg-caixa boa"><h3>${P.icone("check", "ico-p")}Está funcionando</h3>
          ${caixas.bom.length ? `<ul>${caixas.bom.map((t) => `<li>${t}</li>`).join("")}</ul>` : `<p class="mudo pequeno">Nada subiu de forma clara neste mês.</p>`}</div>
        <div class="vg-caixa ruim"><h3>${P.icone("alerta", "ico-p")}Está piorando</h3>
          ${caixas.ruim.length ? `<ul>${caixas.ruim.map((t) => `<li>${t}</li>`).join("")}</ul>` : `<p class="mudo pequeno">Nada caiu de forma clara neste mês.</p>`}</div>
        <div class="vg-caixa chance"><h3>${P.icone("estrela", "ico-p")}Maior oportunidade</h3>
          ${caixas.chance.length ? `<ul>${caixas.chance.map((t) => `<li>${t}</li>`).join("")}</ul>` : `<p class="mudo pequeno">Sem tema destacado ainda.</p>`}</div>
      </div>

      <div class="cartao bloco">
        <div class="cartao-topo"><h2>Os números do mês, e o que eles querem dizer</h2></div>
        <div class="tabela-rolagem"><table class="tabela">
          <thead><tr><th>Métrica</th><th class="num">Valor</th><th class="num">Vs mês anterior</th><th>Leitura</th></tr></thead>
          <tbody>${METRICAS.map((m) => {
            const v = variacao(m.valor, m.antes);
            return `<tr>
              <td><b>${P.esc(m.nome)}</b></td>
              <td class="num">${P.inteiro(m.valor)}</td>
              <td class="num">${setaVariacao(v, m.bomSubir)}</td>
              <td><span class="vg-leitura-tabela">${P.esc(v === null ? "Sem mês anterior para comparar." : m.leitura(v))}</span></td>
            </tr>`;
          }).join("")}</tbody>
        </table></div>
      </div>

      ${tabelaAgrupada("Por tema", "média por post", porTema, "A audiência responde mais ao tema do topo. Se ele também for o que você gosta de fazer, é por ali.")}
      ${tabelaAgrupada("Por formato", "média por post", porFormato, "Formato com mais alcance nem sempre é o com mais conversa. Olhe as duas colunas antes de decidir.")}

      ${blocoOQueFazer(porTema, porFormato)}`;
  }

  function agruparPor(lista, classificar) {
    const grupos = {};
    lista.forEach((x) => { const k = classificar(x); (grupos[k] = grupos[k] || []).push(x); });
    return Object.entries(grupos).map(([nome, xs]) => ({
      nome, n: xs.length,
      alcance: media(xs, "alcance"), views: media(xs, "visualizacoes"),
      curtidas: media(xs, "curtidas"), comentarios: media(xs, "comentarios"), salvos: media(xs, "salvos")
    })).sort((a, b) => b.alcance - a.alcance);
  }

  function agruparPorFormato(lista) {
    const g = agruparPor(lista, (x) => x.formato || "Outro");
    return g.map((f) => ({ ...f, formato: f.nome }));
  }

  function tabelaAgrupada(titulo, sub, grupos, rodape) {
    if (!grupos.length) return "";
    return `<div class="cartao bloco">
      <div class="cartao-topo"><h2>${P.esc(titulo)}</h2><span class="mudo pequeno">${P.esc(sub)}</span></div>
      <div class="tabela-rolagem"><table class="tabela">
        <thead><tr><th>${P.esc(titulo.replace("Por ", ""))}</th><th class="num">Posts</th><th class="num">Alcance</th>
          <th class="num">Views</th><th class="num">Coment.</th><th class="num">Salvos</th></tr></thead>
        <tbody>${grupos.map((g) => `<tr>
          <td><b>${P.esc(g.nome)}</b>${g.n < 3 ? ` <span class="pilula p-amarelo">poucos posts</span>` : ""}</td>
          <td class="num">${g.n}</td><td class="num">${P.inteiro(g.alcance)}</td><td class="num">${P.inteiro(g.views)}</td>
          <td class="num">${P.inteiro(g.comentarios)}</td><td class="num">${P.inteiro(g.salvos)}</td>
        </tr>`).join("")}</tbody>
      </table></div>
      <div class="cartao-corpo"><p class="mudo pequeno">${P.esc(rodape)}</p></div>
    </div>`;
  }

  function montarCaixasDoMes(metricas, porTema, porFormato) {
    const bom = [], ruim = [], chance = [];
    metricas.forEach((m) => {
      const v = variacao(m.valor, m.antes);
      if (v === null) return;
      if (v >= 20) bom.push(`${m.nome} subiu ${v}%, de ${P.inteiro(m.antes)} para ${P.inteiro(m.valor)}.`);
      if (v <= -20) ruim.push(`${m.nome} caiu ${Math.abs(v)}%, de ${P.inteiro(m.antes)} para ${P.inteiro(m.valor)}.`);
    });
    const temasBons = porTema.filter((t) => t.n >= 2);
    if (temasBons.length >= 2) {
      const topo = temasBons[0];
      chance.push(`<b>${P.esc(topo.nome)}</b> teve ${P.inteiro(topo.alcance)} de alcance médio, o melhor do mês, em ${P.plural(topo.n, "post", "posts")}. Fazer mais disso é o caminho mais curto.`);
    }
    const fmt = porFormato.filter((f) => f.n >= 2);
    if (fmt.length >= 2) {
      const melhor = fmt[0];
      chance.push(`${P.esc(melhor.formato)} está rendendo mais alcance este mês: ${P.inteiro(melhor.alcance)} por post.`);
    }
    return { bom, ruim, chance };
  }

  function blocoOQueFazer(porTema, porFormato) {
    const { sinais } = descobrirRegras(posts);
    const repetir = sinais.filter((s) => s.tipo === "repetir");
    const evitar = sinais.filter((s) => s.tipo === "evitar");
    const fracos = sinais.filter((s) => s.tipo === "fraco");
    const temas = porTema.filter((t) => t.n >= 2);
    const poucos = porTema.filter((t) => t.n === 1);

    const item = (s) => {
      const vezes = Math.round((s.razao >= 1 ? s.razao : 1 / s.razao) * 10) / 10;
      return `${P.esc(s.nome)} <span class="mudo">(${vezes}x, em ${P.plural(s.n, "post", "posts")})</span>`;
    };

    return `<div class="cartao bloco">
      <div class="cartao-topo"><h2>O que fazer</h2><span class="mudo pequeno">tirado de todos os ${posts.length} posts, não só deste mês</span></div>
      <div class="cartao-corpo">
        <p class="mudo pequeno" style="margin-bottom:12px">Isto é o que aconteceu junto, não o que causou. Um post pode
        ter ido bem pelo assunto, e não pela característica que a conta pegou. Use como pista para testar.</p>
        <div class="vg-caixas" style="margin-bottom:0">
          <div class="vg-caixa"><h3>Fazer mais</h3>
            ${repetir.length ? `<ul>${repetir.map((s) => `<li>${item(s)}</li>`).join("")}</ul>`
              : temas.length ? `<ul><li>Conteúdo de ${P.esc(temas[0].nome)}, que puxou mais alcance</li></ul>`
              : `<p class="mudo pequeno">Nada se destacou para cima.</p>`}</div>
          <div class="vg-caixa"><h3>Fazer menos</h3>
            ${evitar.length ? `<ul>${evitar.map((s) => `<li>${item(s)}</li>`).join("")}</ul>` : `<p class="mudo pequeno">Nada se destacou para baixo.</p>`}</div>
          <div class="vg-caixa"><h3>Testar</h3>
            ${fracos.length ? `<ul>${fracos.map((s) => `<li>${item(s)}</li>`).join("")}</ul>` : `<p class="mudo pequeno">Sem pista fraca no momento.</p>`}</div>
          <div class="vg-caixa"><h3>Está deixando passar</h3>
            ${poucos.length ? `<ul>${poucos.map((t) => `<li>${P.esc(t.nome)}: só ${P.plural(t.n, "post", "posts")} no mês, com ${P.inteiro(t.alcance)} de alcance</li>`).join("")}</ul>`
              : `<p class="mudo pequeno">Você cobriu bem os temas este mês.</p>`}</div>
        </div>
      </div>
    </div>`;
  }

  /* ---------- Os sinais: o que separa um post bom de um ruim ----------
     Para cada característica, compara a média de visualizações dos posts
     que a têm com a dos que não têm. Só vira regra quando os dois lados
     têm posts suficientes e a diferença é grande.

     O formato fica de fora de propósito: ele já tem tabela própria, e
     como quase todo post é Reels ou carrossel, apareceria duas vezes,
     como "fazer mais" de um lado e "fazer menos" do outro. */
  const CARACTERISTICAS = [
    { nome: "fazer uma pergunta na legenda", tem: (x) => /\?/.test(x.legenda || "") },
    { nome: "legenda curta, até 300 letras", tem: (x) => (x.legenda || "").length > 0 && (x.legenda || "").length <= 300 },
    { nome: "ser publicidade", tem: (x) => /\b(publi|parceria paga|ad|#publi)\b/i.test(x.legenda || "") },
    { nome: "ter cupom ou desconto na legenda", tem: (x) => /\b(cupom|desconto|off|%)\b/i.test(x.legenda || "") },
    { nome: "marcar outro perfil", tem: (x) => /@\w/.test(x.legenda || "") },
    { nome: "usar hashtags", tem: (x) => /#\w/.test(x.legenda || "") },
    { nome: "começar a legenda gritando em maiúsculas", tem: (x) => /^[^a-zà-ú]{8,}/.test((x.legenda || "").trim()) },
    { nome: "postar no fim de semana", tem: (x) => [0, 6].includes(new Date(x.postado_em).getDay()) },
    { nome: "postar depois das 18h", tem: (x) => new Date(x.postado_em).getHours() >= 18 },
    { nome: "falar de cabelo, pele ou maquiagem", tem: (x) => /cabelo|pele|skincare|maquiagem|make\b|batom/i.test(x.legenda || "") },
    { nome: "falar de um lugar ou de Curitiba", tem: (x) => /curitiba|restaurante|caf[eé]|lugar|rolê|role\b/i.test(x.legenda || "") },
    { nome: "fazer lista ou passo a passo", tem: (x) => /\b(1\.|2\.|passo|dicas?|como)\b/i.test(x.legenda || "") }
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
      const item = { nome: c.nome, mCom, mSem, razao, n: com.length };
      if (razao >= DIFERENCA_MINIMA) saida.push({ ...item, tipo: "repetir" });
      else if (razao <= 1 / DIFERENCA_MINIMA) saida.push({ ...item, tipo: "evitar" });
      else if (razao >= 1.12 || razao <= 1 / 1.12) saida.push({ ...item, tipo: "fraco" });
    });
    const porDia = {};
    validos.forEach((x) => { const d = new Date(x.postado_em).getDay(); (porDia[d] = porDia[d] || []).push(x); });
    const diasSemana = Object.entries(porDia).filter(([, xs]) => xs.length >= MINIMO_POR_LADO)
      .map(([d, xs]) => ({ dia: DIAS_SEMANA[d], views: media(xs, "visualizacoes"), n: xs.length }))
      .sort((a, b) => b.views - a.views);
    return { sinais: saida.sort((a, b) => Math.abs(Math.log(b.razao)) - Math.abs(Math.log(a.razao))), dias: diasSemana };
  }

  /* =========================================================
     PARTE 3: A CONCORRÊNCIA
     ========================================================= */
  function desenharRivais(alvo) {
    if (!rivais.length) {
      alvo.innerHTML = `<div class="cartao"><p class="vazio">
        <b>Nenhum vídeo de outra creator ainda.</b><br>
        Vá na aba Transcrição, cole o link de um reel de alguém que você acompanha e marque como
        "De outra". Ele aparece aqui para você anotar os números.<br><br>
        <span class="mudo">A API do Instagram não entrega dados de outros perfis no seu tipo de app,
        então esses números são digitados por você. Uma vez por mês já resolve.</span></p></div>`;
      return;
    }

    const comNumeros = rivais.filter((x) => num(x.visualizacoes) > 0);
    const meuViews = media(posts.slice(0, 30), "visualizacoes");
    const delasViews = media(comNumeros, "visualizacoes");

    // Você entra na lista de perfis, para a comparação incluir você
    const perfis = {};
    rivais.forEach((x) => {
      const p = P.arroba(x.perfil) || "sem perfil";
      perfis[p] = perfis[p] || { perfil: p, videos: 0, views: [], seguidores: null };
      perfis[p].videos++;
      if (num(x.visualizacoes)) perfis[p].views.push(num(x.visualizacoes));
      if (num(x.seguidores)) perfis[p].seguidores = num(x.seguidores);
    });
    const lista = Object.values(perfis).map((p) => ({
      ...p, mediaViews: p.views.length ? Math.round(p.views.reduce((a, b) => a + b, 0) / p.views.length) : 0
    }));
    if (conta) lista.push({ perfil: "Você", videos: posts.length, mediaViews: meuViews, seguidores: conta.followers_count, eu: true });
    lista.sort((a, b) => num(b.seguidores) - num(a.seguidores) || b.mediaViews - a.mediaViews);

    alvo.innerHTML = `
      ${comNumeros.length >= 3 ? `
      <div class="numeros" style="--colunas:3">
        ${numero("Views delas", P.inteiro(delasViews), `média dos ${comNumeros.length} anotados`)}
        ${numero("Suas views", P.inteiro(meuViews), "média dos seus 30 últimos posts")}
        ${numero("Diferença", (delasViews && meuViews ? (delasViews > meuViews ? "+" : "") + Math.round((delasViews / meuViews - 1) * 100) + "%" : "-"), "delas em relação às suas")}
      </div>` : `<div class="aviso-banco" role="alert">${P.icone("alerta")}<div>
        Com menos de três vídeos anotados eu não comparo médias, porque um vídeo fora da curva
        entortaria a conclusão inteira. Anote os números de mais alguns.</div></div>`}

      <div class="cartao bloco">
        <div class="cartao-topo"><h2>Você vs. concorrência</h2><span class="mudo pequeno">seguidores digitados por você</span></div>
        <div class="tabela-rolagem"><table class="tabela">
          <thead><tr><th>Perfil</th><th class="num">Seguidores</th><th class="num">Vídeos salvos</th><th class="num">Views médias</th></tr></thead>
          <tbody>${lista.map((p) => `<tr${p.eu ? ' style="background:var(--azul-bem-suave)"' : ""}>
            <td><b>${P.esc(p.perfil)}</b>${p.eu ? ` <span class="pilula p-ciano">você</span>` : ""}</td>
            <td class="num">${p.seguidores ? P.inteiro(p.seguidores) : `<span class="mudo">anotar</span>`}</td>
            <td class="num">${p.videos}</td>
            <td class="num">${p.mediaViews ? P.inteiro(p.mediaViews) : `<span class="mudo">-</span>`}</td>
          </tr>`).join("")}</tbody>
        </table></div>
      </div>

      <div class="cartao bloco">
        <div class="cartao-topo"><h2>Os vídeos delas</h2><span class="mudo pequeno">Clique numa linha para anotar os números</span></div>
        <div class="tabela-rolagem"><table class="tabela">
          <thead><tr><th>Perfil</th><th>Vídeo</th><th>Formato</th>
            <th class="num">Views</th><th class="num">Curtidas</th><th class="num">Coment.</th><th class="acoes"></th></tr></thead>
          <tbody>${[...rivais].sort((a, b) => num(b.visualizacoes) - num(a.visualizacoes)).map((x) => `
            <tr class="clicavel" data-rival="${P.esc(x.id)}">
              <td class="curta"><b>${P.esc(P.arroba(x.perfil) || "sem perfil")}</b></td>
              <td class="corta">${P.esc(curto(x.titulo || x.legenda || x.transcricao, 60) || "sem título")}</td>
              <td class="curta">${x.formato ? P.pilula(x.formato, "cinza") : `<span class="mudo">-</span>`}</td>
              <td class="num">${x.visualizacoes == null ? `<span class="mudo">anotar</span>` : P.inteiro(x.visualizacoes)}</td>
              <td class="num">${x.curtidas == null ? "-" : P.inteiro(x.curtidas)}</td>
              <td class="num">${x.comentarios == null ? "-" : P.inteiro(x.comentarios)}</td>
              <td class="acoes">${x.url ? `<a class="botao botao-icone" href="${P.esc(x.url)}" target="_blank" rel="noopener" aria-label="Abrir vídeo" data-parar>${P.icone("link")}</a>` : ""}</td>
            </tr>`).join("")}</tbody>
        </table></div>
      </div>

      ${blocoGanchos(comNumeros)}`;
  }

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
          <div class="bloco-tempo"><span class="tempo">${P.inteiro(x.visualizacoes)}</span>
            <span>${P.esc(curto(x.transcricao, 130))}</span></div>`).join("")}</div>
      </div>
    </div>`;
  }

  /* ---------- Cliques ---------- */
  async function aoClicar(e) {
    if (e.target.closest("[data-parar]")) return;
    if (e.target.closest("#vg-atualizar")) return atualizar(e.target.closest("#vg-atualizar"));
    if (e.target.closest("#vg-copiar")) return copiarEstudo();

    const p = e.target.closest("[data-periodo]");
    if (p) {
      periodo = Number(p.dataset.periodo);
      desenhar();
      return;
    }
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
      P.toast(`${P.plural(data.gravados, "post atualizado", "posts atualizados")} e ${P.plural(data.dias || 0, "dia", "dias")} de histórico.`);
      await carregar();
    } catch (erro) {
      P.toast("Não consegui buscar agora. Se o token do Instagram venceu, gere outro na Meta e troque o IG_TOKEN no Supabase.", "erro");
    }
    botao.disabled = false;
    botao.innerHTML = antes;
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
     propósito. Aqui a gente monta o texto e copia: você cola numa
     conversa com o Claude e recebe a leitura que número nenhum dá. */
  async function copiarEstudo() {
    const linha = (x) => `- ${x.formato}, ${P.dataBR(String(x.postado_em).slice(0, 10))}: ${num(x.visualizacoes)} views, ${num(x.alcance)} alcance, ${num(x.curtidas)} curtidas, ${num(x.comentarios)} comentários, ${num(x.salvos)} salvos\n  legenda: "${curto(x.legenda, 200)}"`;
    const ord = [...posts].sort((a, b) => num(b.visualizacoes) - num(a.visualizacoes));
    let texto = `Sou creator de UGC no Instagram, @${conta ? conta.username : ""}, com ${conta ? conta.followers_count : "?"} seguidores.\n\n`;
    texto += `ME DIGA: que formato e que assunto deram certo, por que deram certo, o que eu devo repetir e o que não devo repetir. Fale das legendas e dos ganchos, não só dos números. Se algum padrão parecer coincidência, diga isso.\n\n`;
    texto += `OS 10 MELHORES:\n${ord.slice(0, 10).map(linha).join("\n")}\n\nOS 10 PIORES:\n${ord.slice(-10).map(linha).join("\n")}`;
    const comTexto = rivais.filter((x) => (x.transcricao || "").trim());
    if (comTexto.length) {
      const r = [...comTexto].sort((a, b) => num(b.visualizacoes) - num(a.visualizacoes)).slice(0, 6);
      texto += `\n\nROTEIROS DE OUTRAS CREATORS QUE EU ACOMPANHO:\n${r.map((x) => `--- ${P.arroba(x.perfil) || "creator"} · ${num(x.visualizacoes)} views\n${curto(x.transcricao, 900)}`).join("\n\n")}`;
    }
    try {
      await navigator.clipboard.writeText(texto);
      P.toast("Copiado. Cole numa conversa com o Claude.");
    } catch (erro) {
      P.ver("Copie este texto", `<textarea style="width:100%;min-height:340px">${P.esc(texto)}</textarea>`);
    }
  }
})();
