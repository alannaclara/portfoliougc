/* =========================================================
   ABA EDIÇÃO
   Monta vídeos nos modelos Airlearn e UGC tech. Os clipes sobem
   para o balde privado "edicao" do Supabase sem perder qualidade:
   cada arquivo vai do jeito que está, cortado em pedaços de 45 MB
   (o plano grátis aceita até 50 MB por arquivo).

   Quem gera a legenda e o vídeo final em 4K é o seu computador,
   quando você roda o renderizar.cmd (pasta meu-video). O painel só
   guarda os clipes, as configurações e o resultado.
   ========================================================= */
(function () {
  "use strict";
  const P = window.Painel;

  const TABELA = "edicoes";
  const BALDE = "edicao";
  const PEDACO = 45 * 1024 * 1024;          // 45 MB por pedaço
  const ESPACO_GRATIS = 1024 * 1024 * 1024; // 1 GB no plano grátis (dividido com o moodboard)

  // Modelos: Airlearn (formato fixo) + um por nicho, medidos nos vídeos das creators
  // (referencias/guia-de-estilo.md, seção 7). Os nichos usam o mesmo motor no Remotion.
  const MODELOS = {
    airlearn: "Airlearn",
    ugctech: "UGC tech",
    beleza: "Beleza",
    casa: "Casa & deco",
    gastronomia: "Gastronomia",
    moda: "Moda",
    saude: "Saúde & fitness",
    financas: "Finanças",
    ofertas: "Ofertas & achadinhos",
    viagem: "Viagem",
    jogos: "Jogos",
    educativo: "Educativo"
  };

  // Como o nicho costuma ser editado, a cor padrão e quantas palavras da legenda aparecem por vez
  const NICHOS = {
    ugctech: { cor: "#F5D547", porVez: 1, receita: "Tela do app filmada com dedo ou cursor, etiqueta com o nome da marca na 1ª menção, checklist, números grandes e CTA “comenta PALAVRA”." },
    beleza: { cor: "#F4B8A8", porVez: 4, receita: "Close de textura e aplicação, antes/depois na pele, nome do produto no topo e uma palavra elegante em serifada itálica." },
    casa: { cor: "#FFD54A", porVez: 2, receita: "Hook escrito em caixa alta, comparação “normal × da marca”, medidas e garantia em texto manuscrito com seta." },
    gastronomia: { cor: "#FF7A3D", porVez: 4, receita: "Nome do prato ou receita grande e colorido, ingredientes manuscritos com seta, muito close de comida." },
    moda: { cor: "#F3E6D3", porVez: 4, receita: "Estética de cinema, legenda pequena e discreta, palavras em serifada itálica (modelagem, acabamento, estilo)." },
    saude: { cor: "#D7FF3A", porVez: 2, receita: "Palavras-chave em neon empilhadas, nome do prato em letra cursiva, rotina e antes/depois." },
    financas: { cor: "#7CFF6B", porVez: 4, receita: "Esquete curta, logo do banco ou app na tela, valores grandes que sobem (contador) e app na mão." },
    ofertas: { cor: "#FFE100", porVez: 2, receita: "Preço “de” riscado e “por” gigante em amarelo, prints do grupo de promoção e caixa alta dramática." },
    viagem: { cor: "#7FD6FF", porVez: 4, receita: "Tour pelo lugar, nome do destino grande em serifada, logo da marca e app de reserva." },
    jogos: { cor: "#FFD400", porVez: 1, receita: "Caixa alta amarela que vai empilhando, lista de regras ou palavras proibidas, grupo de amigos jogando." },
    educativo: { cor: "#FFD84D", porVez: 1, receita: "Título fixo o vídeo todo (linha branca + linha em caixa amarela), checklist que cresce e pílula “Comente X”." }
  };

  // Tipos de elemento na tela. "extra" muda de sentido conforme o tipo.
  const TIPOS = {
    hook: ["Hook grande empilhado", "Separe as linhas com “ / ”. A última fica na cor da marca."],
    tituloFixo: ["Título fixo", "Extra: linha de destaque na caixa amarela."],
    titulo: ["Título no topo (produto, prato, lugar)", "Separe as linhas com “ / ”."],
    destaque: ["Palavra gigante", "Extra: escreva “cor” para usar a cor da marca."],
    elegante: ["Palavra elegante (itálico)", "Extra: “esq” para ficar à esquerda."],
    rotulo: ["Rótulo manuscrito com seta", "Extra: “esq” ou “dir” (para onde a seta aponta)."],
    etiqueta: ["Nome da marca (etiqueta)", ""],
    numero: ["Número que sobe", "Extra: “de > até”, ex.: R$ 0 > R$ 1.030. Texto vai embaixo."],
    preco: ["Preço de / por", "Extra: “R$ 1.269 > R$ 764”. Texto = nome do produto."],
    lista: ["Lista que empilha", "Itens separados por “ / ”."],
    checklist: ["Checklist ✓", "Itens separados por “ / ”."],
    cta: ["CTA Comente “…”", "Texto = a palavra (ex.: LINK)."],
    flash: ["Flash de luz", "Só o início importa."]
  };

  // Elementos que mais aparecem em cada nicho (o texto é só exemplo, para trocar)
  const el = (tipo, texto, inicio, fim, extra) => ({ tipo, texto, inicio, fim, extra: extra || "" });
  const SUGESTOES = {
    ugctech: [el("hook", "Eu parei de / colocar link / na bio", 0, 2.6), el("flash", "", 3, 3), el("etiqueta", "Nome do app", 3, 5.5), el("destaque", "Profissional", 6.4, 7.6), el("checklist", "Portfólio / Contatos / Redes sociais", 8, 10.2), el("cta", "LINK", 10.4, 12)],
    beleza: [el("titulo", "Nome do produto", 0.5, 3.5), el("elegante", "textura / leve", 4, 6.5), el("rotulo", "antes", 7, 8.5, "esq"), el("rotulo", "depois", 8.5, 10, "dir"), el("cta", "PELE", 10.5, 12)],
    casa: [el("hook", "Toalha normal / × / da marca", 0, 2.8), el("rotulo", "650 g/m²", 3.5, 6, "dir"), el("elegante", "5 anos de / garantia", 6.5, 8.5), el("destaque", "Macia", 9, 10.2), el("cta", "TOALHA", 10.5, 12)],
    gastronomia: [el("titulo", "Nome da / receita", 0, 3), el("rotulo", "ingrediente 1", 3.5, 5.5, "dir"), el("rotulo", "ingrediente 2", 6, 8, "esq"), el("titulo", "leve / gostoso / prático", 9, 11)],
    moda: [el("elegante", "modelagem", 4, 5.5), el("elegante", "acabamento", 5.5, 7, "esq"), el("elegante", "estilo", 7, 8.5), el("etiqueta", "Nome da marca", 9, 11)],
    saude: [el("hook", "Para te / mostrar o meu / pós treino", 0, 3), el("destaque", "Prática", 4, 5.5, "cor"), el("elegante", "nome do prato", 6, 9), el("cta", "TREINO", 10, 12)],
    financas: [el("etiqueta", "Nome do banco", 2.5, 5), el("numero", "rendendo por mês", 5.5, 8.5, "R$ 0 > R$ 1.030"), el("destaque", "Pix", 9, 10.5), el("cta", "RENDE", 10.8, 12)],
    ofertas: [el("destaque", "Sendo / assaltado", 0, 2), el("preco", "Nome do produto", 3, 7, "R$ 1.269 > R$ 764"), el("cta", "GRUPO", 10.5, 12)],
    viagem: [el("titulo", "Nome do / lugar", 0.5, 3.5), el("etiqueta", "Nome do app", 4, 6.5), el("elegante", "lareira / & frio", 7, 9.5), el("cta", "VIAGEM", 10, 12)],
    jogos: [el("lista", "Sem falar: / palavra 1 / palavra 2 / palavra 3", 0, 4.5), el("destaque", "Não pode!", 5, 6.5, "cor"), el("numero", "cartas", 7, 9.5, "0 > 178"), el("cta", "QUERO", 10, 12)],
    educativo: [el("tituloFixo", "Decidi começar no UGC (dia 01)", 0, 60, "Já consegui trabalhos"), el("checklist", "Passo 1 / Passo 2 / Passo 3", 4, 8.5), el("cta", "UGC", 9.5, 12)]
  };
  const SITUACAO = {
    rascunho: ["Montando", "cinza"],
    legendar: ["Legenda na fila", "amarelo"],
    legendando: ["Gerando legenda", "ciano"],
    renderizar: ["4K na fila", "amarelo"],
    renderizando: ["Gerando 4K", "ciano"],
    estagiario: ["Com o estagiário", "amarelo"],
    trabalhando: ["Estagiário editando", "ciano"],
    pronto: ["Pronto", "verde"],
    erro: ["Deu erro", "vermelho"]
  };
  const NA_FILA = ["legendar", "renderizar", "estagiario"];
  const TRABALHANDO = ["legendando", "renderizando", "trabalhando"];

  // As etapas que o estagiário vai marcando (tools/estagiario.mjs usa as mesmas chaves)
  const ETAPAS = [
    ["transcreve", "Transcreve a fala"],
    ["tomadas", "Escolhe as melhores tomadas"],
    ["pausas", "Corta pausas e repetições"],
    ["legendas", "Coloca as legendas"],
    ["zoom", "Zoom e textos na tela"],
    ["musica", "Música e som"],
    ["render", "Renderiza em 4K e confere"]
  ];
  const linkDrive = (u) => /^https:\/\/drive\.google\.com\/drive\/(u\/\d+\/)?folders\/[\w-]+/.test(String(u || "").trim());

  let secao = null;
  let lista = [];
  let atual = null;        // o vídeo aberto no editor
  let enviando = false;    // tem clipe subindo agora
  let relogio = null;      // confere o andamento enquanto o computador trabalha
  let urlFinal = "";       // vídeo final montado na memória para assistir

  P.abas.edicao = {
    async iniciar(s) {
      secao = s;
      s.innerHTML = `<div class="avisos"></div><div id="ed-tela"></div>`;
      s.addEventListener("click", aoClicar);
      s.addEventListener("change", aoMudar);
      // Mostra a porcentagem enquanto arrasta o volume
      s.addEventListener("input", (ev) => {
        const txt = ev.target.id && P.$(`#${ev.target.id}-txt`, s);
        if (txt) txt.textContent = ev.target.value + "%";
      });
      await carregar();
    },
    async aoMostrar() { if (!atual) await carregar(); }
  };

  /* =========================================================
     BANCO E ARQUIVOS
     ========================================================= */
  async function carregar() {
    const avisos = P.$(".avisos", secao);
    P.limparAvisos(avisos);
    const r = await P.lerSeguro(TABELA, (q) => q.order("atualizado_em", { ascending: false }));
    if (r.erro) P.avisar(avisos, r.erro + " O arquivo é o edicao.sql.");
    lista = r.dados;
    if (atual) {
      const novo = lista.find((e) => e.id === atual.id);
      if (novo) atual = normalizar(novo);
    }
    desenhar();
  }

  // Garante que os campos existem, mesmo num vídeo antigo ou recém-criado
  function normalizar(e) {
    const c = Object.assign({}, e.config || {});
    return Object.assign({}, e, {
      clips: Array.isArray(e.clips) ? e.clips : [],
      conversa: Array.isArray(e.conversa) ? e.conversa : [],
      etapas: e.etapas && typeof e.etapas === "object" ? e.etapas : {},
      config: Object.assign({
        hook: "", legendas: [], idioma: "",
        corMarca: "", palavrasPorVez: 0, palavrasNaCor: [], palavras: [],
        elementos: [], apagarBrutos: true, musica: null, somClipes: 100
      }, c)
    });
  }

  const tamanho = (bytes) => {
    const n = P.num(bytes);
    if (!n) return "0 MB";
    if (n >= 1024 ** 3) return (n / 1024 ** 3).toFixed(2).replace(".", ",") + " GB";
    if (n >= 1024 ** 2) return Math.round(n / 1024 ** 2) + " MB";
    return Math.max(1, Math.round(n / 1024)) + " KB";
  };
  const seg = (v) => P.num(v).toFixed(1).replace(".", ",") + "s";
  const novoId = () => (crypto.randomUUID ? crypto.randomUUID() : String(Date.now()) + Math.random().toString(16).slice(2));
  const caminhosDe = (arq) => Array.from({ length: P.num(arq.partes) }, (_, i) => `${arq.caminho}/parte-${String(i).padStart(3, "0")}`);

  async function apagarArquivos(caminhos) {
    for (let i = 0; i < caminhos.length; i += 100) {
      const { error } = await banco.storage.from(BALDE).remove(caminhos.slice(i, i + 100));
      if (error) return P.explicarErro(error, "balde edicao");
    }
    return null;
  }

  async function salvar(campos) {
    const erro = await P.gravar(TABELA, "atualizar", campos, atual.id);
    if (erro) { P.toast(erro, "erro"); return false; }
    Object.assign(atual, campos);
    return true;
  }

  /* =========================================================
     DESENHO: lista ou editor
     ========================================================= */
  function desenhar() {
    pararRelogio();
    if (atual) desenharEditor(); else desenharLista();
  }

  function espacoUsado() {
    let total = 0;
    lista.forEach((e) => {
      (Array.isArray(e.clips) ? e.clips : []).forEach((c) => { if (!c.apagado) total += P.num(c.tamanho); });
      if (e.final) total += P.num(e.final.tamanho);
      if (e.config && e.config.musica) total += P.num(e.config.musica.tamanho);
    });
    return total;
  }

  function desenharLista() {
    const usado = espacoUsado();
    const prontos = lista.filter((e) => e.status === "pronto").length;
    const fila = lista.filter((e) => NA_FILA.includes(e.status) || TRABALHANDO.includes(e.status)).length;
    const pct = Math.min(100, Math.round((usado / ESPACO_GRATIS) * 100));

    P.$("#ed-tela", secao).innerHTML = `
      <div class="numeros" style="--colunas:3">
        <div class="numero"><div class="numero-rotulo">Espaço usado pelos vídeos</div>
          <div class="numero-valor">${tamanho(usado)} <span class="mudo pequeno">de 1 GB</span></div>
          <div class="progresso" style="margin-top:6px"><span style="width:${pct}%"></span></div></div>
        <div class="numero"><div class="numero-rotulo">Prontos</div>
          <div class="numero-valor">${P.inteiro(prontos)}</div>
          <div class="numero-sub">em 4K, para assistir e baixar</div></div>
        <div class="numero"><div class="numero-rotulo">Esperando o computador</div>
          <div class="numero-valor">${P.inteiro(fila)}</div>
          <div class="numero-sub">${fila ? "deixe o estagiario.cmd aberto" : "nada na fila"}</div></div>
      </div>
      <div class="ferramentas">
        <p class="mudo pequeno" style="flex:1 1 260px;min-width:0">
          Crie um pedido com o link da pasta do Google Drive e explique o que quer. O estagiário (o
          <b>estagiario.cmd</b>, na pasta meu-video) edita no seu computador e o vídeo em 4K aparece aqui.
        </p>
        <div class="grupo-botoes empurra">
          <button class="botao botao-principal" type="button" data-acao="novo">${P.icone("mais", "ico-p")}Novo vídeo</button>
        </div>
      </div>
      <div class="cartao">
        ${lista.length ? `<ul class="lista-simples">${lista.map((e) => {
          const [txt, cor] = SITUACAO[e.status] || SITUACAO.rascunho;
          const n = (Array.isArray(e.clips) ? e.clips : []).length;
          const origem = e.drive_url ? "pasta do Drive" : P.plural(n, "clipe", "clipes");
          return `<li class="ed-linha" data-abrir="${P.esc(e.id)}" tabindex="0">
            <div class="cresce"><b>${P.esc(e.titulo)}</b>
              <div class="mudo pequeno">${MODELOS[e.modelo] || e.modelo} · ${origem} · mexido em ${P.dataBR(e.atualizado_em)}</div></div>
            ${P.pilula(txt, cor)}
          </li>`;
        }).join("")}</ul>`
        : `<div class="vazio"><b>Nenhum vídeo ainda.</b><br>Clique em "Novo vídeo" para começar.</div>`}
      </div>`;
  }

  function desenharEditor() {
    const e = atual;
    const c = e.config;
    const [txt, cor] = SITUACAO[e.status] || SITUACAO.rascunho;
    const ocupado = NA_FILA.includes(e.status) || TRABALHANDO.includes(e.status);
    const temClipes = e.clips.some((x) => !x.apagado);

    P.$("#ed-tela", secao).innerHTML = `
      <div class="ferramentas">
        <button class="botao" type="button" data-acao="voltar">${P.icone("esq", "ico-p")}Todos os vídeos</button>
        ${P.pilula(txt, cor)}
        <div class="grupo-botoes empurra">
          <button class="botao botao-perigo" type="button" data-acao="apagar-video">${P.icone("lixo", "ico-p")}Apagar vídeo</button>
          <button class="botao botao-principal" type="button" data-acao="salvar"${ocupado ? " disabled" : ""}>Salvar</button>
        </div>
      </div>
      ${faixaDeStatus(e)}
      <div class="cartao bloco"><div class="cartao-corpo grade-campos">
        <div class="campo"><label for="ed-titulo">Nome do vídeo</label>
          <input id="ed-titulo" value="${P.esc(e.titulo)}"></div>
        <div class="campo"><label for="ed-modelo">Modelo</label>
          <select id="ed-modelo">${Object.entries(MODELOS).map(([v, t]) => `<option value="${v}"${e.modelo === v ? " selected" : ""}>${t}</option>`).join("")}</select>
          <span class="campo-ajuda">${e.modelo === "airlearn" ? "Só para vídeos da Airlearn: hook do Snapchat e legenda dupla." : P.esc((NICHOS[e.modelo] || NICHOS.ugctech).receita)}</span></div>
        <div class="campo largo"><label for="ed-drive">Pasta do Google Drive com os vídeos</label>
          <input id="ed-drive" type="url" value="${P.esc(e.drive_url || "")}" placeholder="https://drive.google.com/drive/folders/…">
          <span class="campo-ajuda">Compartilhe a pasta como “qualquer pessoa com o link pode ver”. Pode pôr a música na mesma pasta. Dê nomes aos b-rolls (ex.: “b-roll cabide fechando.mov”).</span></div>
      </div></div>

      ${blocoEstagiario(e, ocupado)}

      <details class="ed-ajustes"${e.drive_url ? "" : " open"}>
      <summary>Ajustes finos (manual)</summary>
      <p class="mudo pequeno" style="margin:6px 2px 12px">Aqui aparece o que o estagiário montou: cortes, legenda, textos e música. Dá para mexer à mão e gerar o 4K de novo.</p>

      <div class="cartao bloco">
        <div class="cartao-topo"><h2>Clipes <span class="mudo pequeno">(na ordem em que aparecem)</span></h2>
          <label class="botao${enviando || ocupado ? " ed-desligado" : ""}">${P.icone("subir", "ico-p")}Enviar clipes
            <input type="file" id="ed-arquivos" accept="video/*" multiple hidden${enviando || ocupado ? " disabled" : ""}></label></div>
        <div id="ed-envio"></div>
        ${e.clips.length ? `<ul class="lista-simples">${e.clips.map((x, i) => linhaClipe(x, i, e.clips.length, ocupado)).join("")}</ul>`
          : `<div class="vazio">Nenhum clipe ainda. Envie os vídeos do jeito que saíram do celular, em qualquer qualidade.</div>`}
        <p class="mudo pequeno ed-nota">Início e fim são em segundos dentro de cada clipe. Deixe em branco para usar o clipe inteiro.</p>
      </div>

      <div class="cartao bloco">
        <div class="cartao-topo"><h2>Legenda</h2>
          <div class="grupo-botoes">
            <div class="campo ed-idioma"><select id="ed-idioma" aria-label="Idioma falado">
              ${[["", "Idioma: descobrir sozinho"], ["pt", "Português"], ["en", "Inglês"], ["es", "Espanhol"], ["fr", "Francês"], ["it", "Italiano"], ["de", "Alemão"], ["ja", "Japonês"], ["ko", "Coreano"], ["ru", "Russo"], ["tr", "Turco"]]
                .map(([v, t]) => `<option value="${v}"${c.idioma === v ? " selected" : ""}>${t}</option>`).join("")}</select></div>
            <button class="botao" type="button" data-acao="pedir-legenda"${!temClipes || ocupado ? " disabled" : ""}>${P.icone("legenda", "ico-p")}Gerar legenda automática</button>
          </div></div>
        <div class="cartao-corpo">${e.modelo === "airlearn" ? camposAirlearn(c) : camposUgc(c)}</div>
      </div>

      ${e.modelo !== "airlearn" ? `<div class="cartao bloco"><div class="cartao-topo"><h2>Elementos na tela</h2>
          <div class="grupo-botoes">
            <button class="botao" type="button" data-acao="sugerir">${P.icone("estrela", "ico-p")}Sugestão do nicho</button>
            <button class="botao" type="button" data-acao="mais-elemento">${P.icone("mais", "ico-p")}Elemento</button>
          </div></div>
        <div class="cartao-corpo">${camposVisual(c, e.modelo)}</div></div>` : ""}

      ${e.modelo !== "airlearn" ? camposSom(c, ocupado) : ""}

      <div class="cartao bloco">
        <div class="cartao-topo"><h2>Vídeo final em 4K</h2>
          <button class="botao botao-principal" type="button" data-acao="pedir-render"${!temClipes || ocupado ? " disabled" : ""}>${P.icone("play", "ico-p")}Gerar vídeo 4K</button></div>
        <div class="cartao-corpo">
          <label class="campo campo-marcar"><input type="checkbox" id="ed-apagar-brutos"${c.apagarBrutos ? " checked" : ""}>
            Apagar os clipes brutos depois que o 4K ficar pronto (libera espaço no Supabase; os do Drive nunca são apagados)</label>
          <p class="mudo pequeno">Gera o 4K com o que está nestes ajustes, sem o estagiário replanejar. O vídeo pronto aparece lá em cima.</p>
        </div>
      </div>
      </details>`;

    if (TRABALHANDO.includes(e.status) || NA_FILA.includes(e.status)) ligarRelogio();
  }

  /* ---------- O estagiário: conversa, etapas e o vídeo pronto ---------- */
  function blocoEstagiario(e, ocupado) {
    const hora = (iso) => { const d = new Date(iso); return isNaN(d) ? "" : d.toLocaleTimeString("pt-BR", { hour: "2-digit", minute: "2-digit" }); };
    const bolhas = e.conversa.length ? e.conversa.map((m) => `
        <div class="ed-msg ed-msg-${m.autor === "voce" ? "voce" : "estagiario"}">
          <span class="ed-msg-quem">${m.autor === "voce" ? "Você" : "Estagiário"} <span class="mudo">${hora(m.em)}</span></span>
          <div>${P.esc(m.texto).replace(/\n/g, "<br>")}</div></div>`).join("")
      : `<p class="mudo pequeno">Escreva o pedido como se fosse para uma pessoa: o que é o vídeo, o gancho, o que cortar, a música, o que a marca pediu.</p>`;
    const estado = (k) => e.etapas[k] || "pendente";
    const icone = { feito: "check", fazendo: "recarregar", pulado: "x", pendente: "relogio" };
    const etapas = ETAPAS.map(([k, nome]) => `<li class="ed-etapa ed-etapa-${estado(k)}">${P.icone(icone[estado(k)] || "relogio", "ico-p")}<span>${nome}</span></li>`).join("");
    const f = e.final;
    return `<div class="ed-estagiario bloco">
      <div class="cartao ed-conversa">
        <div class="cartao-topo"><h2>${P.icone("caneta", "ico-p")} Estagiário <span class="mudo pequeno">de edição · trabalha no seu computador</span></h2></div>
        <div class="ed-mensagens" id="ed-mensagens">${bolhas}</div>
        <div class="ed-escrever">
          <textarea id="ed-texto" rows="3" placeholder="${e.conversa.length ? "Peça um ajuste: “tira o 2º corte”, “texto maior”, “música mais baixa”…" : "Ex.: gancho falado, depois narração. Os b-rolls estão com nome. Corta as pausas, música baixinha e um CTA pra comentar LINK."}"${ocupado ? " disabled" : ""}></textarea>
          <button class="botao botao-principal" type="button" data-acao="enviar-pedido"${ocupado ? " disabled" : ""}>${P.icone("dir", "ico-p")}${e.conversa.length ? "Enviar" : "Mandar para o estagiário"}</button>
        </div>
      </div>
      <div class="ed-lado">
        <div class="cartao"><div class="cartao-corpo"><ul class="ed-etapas">${etapas}</ul>
          ${TRABALHANDO.includes(e.status) ? `<div class="progresso" style="margin-top:10px"><span style="width:${Math.min(100, P.num(e.progresso))}%"></span></div>` : ""}</div></div>
        <div class="cartao ed-previa">
          ${f ? `<div class="cartao-corpo ed-final">
            <p><b>Pronto</b> <span class="mudo pequeno">${new Date(f.gerado_em).toLocaleString("pt-BR")} · ${P.esc(f.largura)}×${P.esc(f.altura)} · ${seg(f.duracao)} · ${tamanho(f.tamanho)}</span></p>
            <div class="grupo-botoes">
              <button class="botao" type="button" data-acao="assistir">${P.icone("play", "ico-p")}Assistir</button>
              <button class="botao" type="button" data-acao="baixar">${P.icone("baixar", "ico-p")}Baixar MP4</button>
              <button class="botao botao-icone botao-perigo" type="button" data-acao="apagar-final" aria-label="Apagar o 4K">${P.icone("lixo", "ico-p")}</button>
            </div>
            <div id="ed-player"></div></div>`
          : `<div class="ed-previa-vazia"><b>${P.esc(e.titulo)}</b><span class="mudo pequeno">${TRABALHANDO.includes(e.status) ? "editando…" : "o vídeo aparece aqui"}</span></div>`}
        </div>
      </div>
    </div>`;
  }

  async function enviarPedido() {
    const caixa = P.$("#ed-texto", secao);
    const texto = (caixa && caixa.value || "").trim();
    if (!texto) return P.toast("Escreva o pedido primeiro.", "erro");
    absorver();
    if (!linkDrive(atual.drive_url) && !atual.clips.some((x) => !x.apagado)) {
      return P.toast("Cole o link da pasta do Google Drive (drive.google.com/drive/folders/…) ou envie clipes nos ajustes finos.", "erro");
    }
    const conversa = [...atual.conversa, { autor: "voce", texto, em: new Date().toISOString() }];
    const campos = { titulo: atual.titulo, modelo: atual.modelo, drive_url: atual.drive_url, config: atual.config, clips: atual.clips,
      conversa, status: "estagiario", mensagem: null, progresso: 0 };
    if (!atual.pedido) campos.pedido = texto;
    if (await salvar(campos)) {
      P.toast("Pedido enviado. Deixe o estagiario.cmd aberto no seu computador.");
      desenharEditor();
    }
  }

  function faixaDeStatus(e) {
    const msg = P.esc(e.mensagem || "");
    if (e.status === "erro") return `<div class="aviso-banco">${P.icone("alerta")}<div><b>Deu erro no seu computador.</b> ${msg}<br>
      <button class="botao" type="button" data-acao="limpar-erro" style="margin-top:6px">Entendi, voltar a editar</button></div></div>`;
    if (e.status === "estagiario") return `<div class="ed-faixa">${P.icone("relogio")}<div>
      <b>Na fila do estagiário.</b> Ele começa assim que o <b>estagiario.cmd</b> estiver aberto no seu computador (pasta meu-video).
      <button class="botao" type="button" data-acao="cancelar" style="margin-left:8px">Cancelar pedido</button></div></div>`;
    if (e.status === "trabalhando") return "";
    if (NA_FILA.includes(e.status)) return `<div class="ed-faixa">${P.icone("relogio")}<div>
      <b>Na fila.</b> Deixe o <b>estagiario.cmd</b> aberto (pasta meu-video) para o seu computador fazer o trabalho.
      <button class="botao" type="button" data-acao="cancelar" style="margin-left:8px">Cancelar pedido</button></div></div>`;
    if (TRABALHANDO.includes(e.status)) return `<div class="ed-faixa">${P.icone("recarregar")}<div style="flex:1">
      <b>${e.status === "legendando" ? "Gerando a legenda" : "Gerando o vídeo em 4K"} no seu computador…</b> ${msg}
      <div class="progresso" style="margin-top:6px"><span style="width:${Math.min(100, P.num(e.progresso))}%"></span></div></div></div>`;
    if (msg) return `<div class="ed-faixa ed-faixa-ok">${P.icone("check")}<div>${msg}</div></div>`;
    return "";
  }

  function linhaClipe(x, i, total, ocupado) {
    const bloqueio = ocupado ? " disabled" : "";
    return `<li data-clip="${P.esc(x.id)}">
      <span class="ed-ordem">${i + 1}</span>
      <div class="cresce"><b>${P.esc(x.nome)}</b>
        <div class="mudo pequeno">${x.origem === "drive" ? `${P.pilula("Drive", "ciano")}${P.num(x.zoom) > 1 ? ` · zoom ${P.num(x.zoom).toFixed(2).replace(".", ",")}×` : ""}` : tamanho(x.tamanho)}${x.duracao ? " · " + seg(x.duracao) : ""}${x.partes > 1 ? ` · ${x.partes} pedaços` : ""}
          ${x.apagado ? ` · ${P.pilula("bruto apagado", "cinza")}` : ""}</div></div>
      <label class="ed-tempo">início <input type="text" inputmode="decimal" data-tempo="inicio" value="${x.inicio ?? ""}" placeholder="0"${bloqueio}></label>
      <label class="ed-tempo">fim <input type="text" inputmode="decimal" data-tempo="fim" value="${x.fim ?? ""}" placeholder="${x.duracao ? P.num(x.duracao).toFixed(1) : "fim"}"${bloqueio}></label>
      <div class="grupo-botoes">
        <button class="botao botao-icone" type="button" data-mover="-1" aria-label="Subir"${i === 0 || ocupado ? " disabled" : ""}>${P.icone("subir", "ico-p")}</button>
        <button class="botao botao-icone" type="button" data-mover="1" aria-label="Descer"${i === total - 1 || ocupado ? " disabled" : ""}>${P.icone("baixar", "ico-p")}</button>
        <button class="botao botao-icone" type="button" data-acao="ver-clipe" aria-label="Assistir"${x.apagado || x.origem === "drive" ? " disabled" : ""}>${P.icone("olho", "ico-p")}</button>
        <button class="botao botao-icone botao-perigo" type="button" data-acao="tirar-clipe" aria-label="Tirar"${bloqueio}>${P.icone("lixo", "ico-p")}</button>
      </div></li>`;
  }

  /* ---------- Campos de cada modelo ---------- */
  function camposAirlearn(c) {
    return `
      <div class="campo largo"><label for="ed-hook">Hook (texto do Snapchat, fica o vídeo todo)</label>
        <input id="ed-hook" value="${P.esc(c.hook)}" placeholder="Why is Russian so hard 😭"></div>
      <p class="campo-ajuda" style="margin:12px 0 6px">Legenda dupla por frase: em cima a língua falada, embaixo o inglês. Os tempos são no vídeo final, em segundos.</p>
      <div class="tabela-rolagem"><table class="tabela ed-tabela">
        <thead><tr><th>Início</th><th>Fim</th><th>Língua falada</th><th>Inglês</th><th></th></tr></thead>
        <tbody id="ed-legendas">${(c.legendas.length ? c.legendas : [{ inicio: 0, fim: 2, falada: "", ingles: "" }]).map((l) => `
          <tr><td><input type="text" inputmode="decimal" data-l="inicio" value="${l.inicio}"></td>
          <td><input type="text" inputmode="decimal" data-l="fim" value="${l.fim}"></td>
          <td><input data-l="falada" value="${P.esc(l.falada)}"></td>
          <td><input data-l="ingles" value="${P.esc(l.ingles)}"></td>
          <td class="acoes"><button class="botao botao-icone" type="button" data-acao="tirar-legenda" aria-label="Tirar frase">${P.icone("x", "ico-p")}</button></td></tr>`).join("")}
        </tbody></table></div>
      <button class="botao" type="button" data-acao="mais-legenda" style="margin-top:8px">${P.icone("mais", "ico-p")}Frase</button>`;
  }

  function camposUgc(c) {
    const texto = c.palavras.map((p) => p.texto).join(" ");
    return `<div class="grade-campos">
      <div class="campo"><label for="ed-por-vez">Palavras por vez na tela</label>
        <select id="ed-por-vez">${[[0, "Padrão do nicho"], [1, "1 (palavra a palavra)"], [2, "2"], [3, "3"], [4, "4 (frase curta)"], [6, "6"]]
          .map(([v, t]) => `<option value="${v}"${P.num(c.palavrasPorVez) === v ? " selected" : ""}>${t}</option>`).join("")}</select></div>
      <div class="campo"><label for="ed-na-cor">Palavras na cor da marca</label>
        <input id="ed-na-cor" value="${P.esc(c.palavrasNaCor.join(", "))}" placeholder="site, bio, grátis">
        <span class="campo-ajuda">Separe com vírgula</span></div>
      <div class="campo largo"><label>Fala transcrita</label>
        ${c.palavras.length ? `<div class="ed-palavras" id="ed-palavras">${c.palavras.map((p, i) =>
          `<input data-palavra="${i}" value="${P.esc(p.texto)}" size="${Math.max(2, p.texto.length)}" title="${seg(p.inicio)}">`).join("")}</div>
          <span class="campo-ajuda">${P.plural(c.palavras.length, "palavra", "palavras")}. Clique numa palavra para corrigir a grafia (o tempo continua o mesmo).</span>`
        : `<p class="mudo pequeno">Clique em "Gerar legenda automática" para o seu computador transcrever a fala.</p>`}
        <span class="sr">${P.esc(texto)}</span></div>
    </div>`;
  }

  function camposSom(c, ocupado) {
    const m = c.musica;
    const bloqueio = enviando || ocupado;
    return `<div class="cartao bloco">
      <div class="cartao-topo"><h2>Música e som</h2>
        <label class="botao${bloqueio ? " ed-desligado" : ""}">${P.icone("subir", "ico-p")}${m ? "Trocar música" : "Enviar música"}
          <input type="file" id="ed-musica" accept="audio/*,.mp3,.m4a,.wav,.aac" hidden${bloqueio ? " disabled" : ""}></label></div>
      <div id="ed-envio-musica"></div>
      <div class="cartao-corpo grade-campos">
        ${m ? `<div class="campo largo"><label>Música de fundo</label>
            <div class="ed-musica"><b>${P.esc(m.nome)}</b> <span class="mudo pequeno">${tamanho(m.tamanho)}</span>
              <button class="botao botao-icone botao-perigo" type="button" data-acao="tirar-musica" aria-label="Tirar música">${P.icone("lixo", "ico-p")}</button></div>
            <span class="campo-ajuda">Ela toca o vídeo todo (repete se for curta) e entra e sai suave.</span></div>
          <div class="campo"><label for="ed-vol-musica">Volume da música: <span id="ed-vol-musica-txt">${P.num(m.volume)}%</span></label>
            <input id="ed-vol-musica" type="range" min="0" max="100" step="5" value="${P.num(m.volume)}"></div>
          <div class="campo"><label for="ed-musica-inicio">Começar a música em (segundos)</label>
            <input id="ed-musica-inicio" type="text" inputmode="decimal" value="${P.num(m.inicio)}">
            <span class="campo-ajuda">Para pular a introdução e cair direto no refrão.</span></div>`
        : `<p class="mudo pequeno largo">Sem música. Envie um MP3 ou M4A, de preferência sem direitos autorais (ou poste sem música e escolha um áudio do próprio Instagram).</p>`}
        <div class="campo"><label for="ed-vol-clipes">Som original dos clipes: <span id="ed-vol-clipes-txt">${P.num(c.somClipes)}%</span></label>
          <input id="ed-vol-clipes" type="range" min="0" max="100" step="5" value="${P.num(c.somClipes)}">
          <span class="campo-ajuda">0% = mudo. Em vídeo sem fala, deixe baixinho para ouvir só o secador ao fundo.</span></div>
      </div></div>`;
  }

  function camposVisual(c, modelo) {
    const nicho = NICHOS[modelo] || NICHOS.ugctech;
    const opcoes = (tipo) => Object.entries(TIPOS).map(([v, [t]]) => `<option value="${v}"${v === tipo ? " selected" : ""}>${t}</option>`).join("");
    return `
      <div class="grade-campos" style="margin-bottom:12px">
        <div class="campo"><label for="ed-cor">Cor da marca</label>
          <input id="ed-cor" type="color" value="${P.esc(c.corMarca || nicho.cor)}"></div>
      </div>
      ${c.elementos.length ? `<div class="tabela-rolagem"><table class="tabela ed-tabela ed-elementos">
        <thead><tr><th>Tipo</th><th>Texto</th><th>De</th><th>Até</th><th>Extra</th><th></th></tr></thead>
        <tbody id="ed-elementos">${c.elementos.map((x) => `
          <tr><td><select data-x="tipo">${opcoes(x.tipo)}</select></td>
          <td><input data-x="texto" value="${P.esc(x.texto)}" placeholder="texto" aria-label="Texto"></td>
          <td><input type="text" inputmode="decimal" data-x="inicio" value="${x.inicio}" placeholder="de (s)" aria-label="De (segundos)"></td>
          <td><input type="text" inputmode="decimal" data-x="fim" value="${x.fim}" placeholder="até (s)" aria-label="Até (segundos)"></td>
          <td><input data-x="extra" value="${P.esc(x.extra || "")}" title="${P.esc((TIPOS[x.tipo] || ["", ""])[1])}" placeholder="${P.esc((TIPOS[x.tipo] || ["", ""])[1])}"></td>
          <td class="acoes"><button class="botao botao-icone" type="button" data-acao="tirar-elemento" aria-label="Tirar elemento">${P.icone("x", "ico-p")}</button></td></tr>`).join("")}
        </tbody></table></div>`
      : `<p class="mudo pequeno">Nenhum elemento ainda. Clique em <b>Sugestão do nicho</b> para começar com os elementos que mais aparecem nos vídeos de ${P.esc(MODELOS[modelo] || "UGC")}.</p>`}
      <p class="campo-ajuda" style="margin-top:8px">De e até são os segundos no vídeo final. Para quebrar linha no texto, use “ / ”.</p>`;
  }

  /* =========================================================
     LER O QUE ESTÁ NA TELA
     ========================================================= */
  const n = (t) => P.num(String(t == null ? "" : t).replace(",", "."));
  const vazio = (t) => String(t == null ? "" : t).trim() === "";

  function lerTela() {
    const e = atual;
    const c = Object.assign({}, e.config);
    const v = (id) => { const el = P.$("#" + id, secao); return el ? el.value : undefined; };

    c.idioma = v("ed-idioma") || "";
    c.apagarBrutos = !!(P.$("#ed-apagar-brutos", secao) || {}).checked;
    if (P.$("#ed-vol-clipes", secao)) c.somClipes = n(v("ed-vol-clipes"));
    if (c.musica && P.$("#ed-vol-musica", secao)) {
      c.musica = Object.assign({}, c.musica, { volume: n(v("ed-vol-musica")), inicio: n(v("ed-musica-inicio")) });
    }

    if (e.modelo === "airlearn") {
      c.hook = (v("ed-hook") || "").trim();
      c.legendas = P.$$("#ed-legendas tr", secao).map((tr) => ({
        inicio: n(P.$("[data-l=inicio]", tr).value),
        fim: n(P.$("[data-l=fim]", tr).value),
        falada: P.$("[data-l=falada]", tr).value.trim(),
        ingles: P.$("[data-l=ingles]", tr).value.trim()
      }));
    } else {
      if (P.$("#ed-por-vez", secao)) c.palavrasPorVez = n(v("ed-por-vez"));
      if (P.$("#ed-na-cor", secao)) c.palavrasNaCor = (v("ed-na-cor") || "").split(",").map((s) => s.trim()).filter(Boolean);
      P.$$("[data-palavra]", secao).forEach((inp) => {
        const p = c.palavras[Number(inp.dataset.palavra)];
        if (p) p.texto = inp.value.trim() || p.texto;
      });
      if (P.$("#ed-cor", secao)) c.corMarca = v("ed-cor");
      if (P.$("#ed-elementos", secao) || P.$("#ed-cor", secao)) {
        c.elementos = P.$$("#ed-elementos tr", secao).map((tr) => {
          const x = (k) => P.$(`[data-x=${k}]`, tr).value;
          const inicio = n(x("inicio"));
          return { tipo: x("tipo"), texto: x("texto").trim().replace(/^["“]|["”]$/g, ""), inicio, fim: vazio(x("fim")) ? inicio + 2 : n(x("fim")), extra: x("extra").trim() };
        });
      }
    }

    // Tempos dos clipes
    const clips = e.clips.map((x) => {
      const li = P.$(`[data-clip="${CSS.escape(x.id)}"]`, secao);
      if (!li) return x;
      const ini = P.$("[data-tempo=inicio]", li).value;
      const fim = P.$("[data-tempo=fim]", li).value;
      return Object.assign({}, x, { inicio: vazio(ini) ? null : n(ini), fim: vazio(fim) ? null : n(fim) });
    });

    return {
      titulo: (v("ed-titulo") || "").trim() || "Vídeo sem nome", modelo: v("ed-modelo") || e.modelo, config: c, clips,
      drive_url: v("ed-drive") !== undefined ? v("ed-drive").trim() || null : e.drive_url
    };
  }

  // Guarda na memória o que está digitado na tela, antes de redesenhar
  function absorver() { if (atual && P.$("#ed-titulo", secao)) Object.assign(atual, lerTela()); }

  async function salvarTela(silencioso) {
    const dados = lerTela();
    const ok = await salvar(dados);
    if (ok && !silencioso) P.toast("Vídeo salvo.");
    return ok;
  }

  /* =========================================================
     ENVIO DOS CLIPES EM PEDAÇOS (sem recomprimir nada)
     ========================================================= */
  function duracaoDoArquivo(arquivo) {
    return new Promise((ok) => {
      const v = document.createElement("video");
      v.preload = "metadata";
      v.muted = true;
      const url = URL.createObjectURL(arquivo);
      const fim = (d) => { URL.revokeObjectURL(url); ok(d); };
      v.onloadedmetadata = () => fim(Number.isFinite(v.duration) ? Math.round(v.duration * 100) / 100 : null);
      v.onerror = () => fim(null);
      setTimeout(() => fim(null), 15000);
      v.src = url;
    });
  }

  // Sobe um arquivo em pedaços de 45 MB (3 tentativas por pedaço). Devolve a mensagem de erro, ou null.
  async function subirEmPedacos(arquivo, caminho, aoPedaco) {
    const qtd = Math.max(1, Math.ceil(arquivo.size / PEDACO));
    for (let i = 0; i < qtd; i++) {
      if (aoPedaco) aoPedaco(i, qtd);
      const pedaco = arquivo.slice(i * PEDACO, Math.min(arquivo.size, (i + 1) * PEDACO));
      let erro = null;
      for (let tentativa = 0; tentativa < 3; tentativa++) {
        const r = await banco.storage.from(BALDE).upload(`${caminho}/parte-${String(i).padStart(3, "0")}`, pedaco,
          { upsert: true, contentType: "application/octet-stream", cacheControl: "3600" });
        erro = r.error;
        if (!erro) break;
      }
      if (erro) {
        await apagarArquivos(Array.from({ length: i }, (_, k) => `${caminho}/parte-${String(k).padStart(3, "0")}`));
        return P.explicarErro(erro, "balde edicao");
      }
    }
    return null;
  }

  async function enviarMusica(arquivo) {
    if (!arquivo || enviando) return;
    if (arquivo.size > 60 * 1024 * 1024) return P.toast("Essa música passa de 60 MB. Use um MP3 ou M4A.", "erro");
    absorver();
    enviando = true;
    desenharEditor();
    const caixa = P.$("#ed-envio-musica", secao);
    if (caixa) caixa.innerHTML = `<div class="ed-envio">Enviando <b>${P.esc(arquivo.name)}</b>…</div>`;
    const caminho = `${atual.id}/musica/${novoId()}`;
    const erro = await subirEmPedacos(arquivo, caminho);
    enviando = false;
    if (erro) { P.toast(`Não consegui enviar a música: ${erro}`, "erro"); return desenharEditor(); }
    const antiga = atual.config.musica;
    if (antiga && antiga.caminho) await apagarArquivos(caminhosDe(antiga));
    const ext = (arquivo.name.match(/\.(\w+)$/) || ["", "mp3"])[1].toLowerCase();
    atual.config.musica = {
      nome: arquivo.name, tamanho: arquivo.size, partes: Math.max(1, Math.ceil(arquivo.size / PEDACO)), caminho, ext,
      volume: antiga ? antiga.volume : 60, inicio: 0
    };
    // Vídeo sem fala: o som ambiente dos clipes fica bem baixinho por padrão
    if (!antiga && !atual.config.palavras.length) atual.config.somClipes = 10;
    if (await salvar({ config: atual.config })) { P.toast("Música enviada."); desenharEditor(); }
  }

  async function tirarMusica() {
    const m = atual.config.musica;
    if (!m || !confirm(`Tirar a música "${m.nome}"?`)) return;
    absorver();
    await apagarArquivos(caminhosDe(m));
    atual.config.musica = null;
    if (await salvar({ config: atual.config })) desenharEditor();
  }

  async function enviarClipes(arquivos) {
    if (!arquivos.length || enviando) return;
    await salvarTela(true);
    enviando = true;
    desenharEditor();
    const caixa = () => P.$("#ed-envio", secao);
    const total = arquivos.reduce((s, a) => s + a.size, 0);
    if (espacoUsado() + total > ESPACO_GRATIS * 0.95) {
      P.toast(`Esses clipes somam ${tamanho(total)} e o espaço grátis está quase cheio. Apague clipes brutos ou vídeos antigos primeiro.`, "erro");
      enviando = false;
      return desenharEditor();
    }
    let mandados = 0;
    for (const arquivo of arquivos) {
      const id = novoId();
      const caminho = `${atual.id}/clips/${id}`;
      const qtd = Math.max(1, Math.ceil(arquivo.size / PEDACO));
      const duracao = await duracaoDoArquivo(arquivo);
      const erro = await subirEmPedacos(arquivo, caminho, (i) => {
        if (caixa()) caixa().innerHTML = `<div class="ed-envio">Enviando <b>${P.esc(arquivo.name)}</b> · pedaço ${i + 1} de ${qtd}
          <div class="progresso"><span style="width:${Math.round(((mandados + i * PEDACO) / total) * 100)}%"></span></div></div>`;
      });
      if (erro) {
        P.toast(`Não consegui enviar ${arquivo.name}: ${erro}`, "erro");
        enviando = false;
        return desenharEditor();
      }
      mandados += arquivo.size;
      atual.clips.push({ id, nome: arquivo.name, tipo: arquivo.type || "video/mp4", tamanho: arquivo.size, partes: qtd, caminho, duracao, inicio: null, fim: null });
      await salvar({ clips: atual.clips });
    }
    enviando = false;
    P.toast(arquivos.length === 1 ? "Clipe enviado." : `${arquivos.length} clipes enviados.`);
    await carregar();
  }

  // Junta os pedaços de volta num arquivo só, na memória do navegador
  async function montar(arq, tipo) {
    const blobs = [];
    for (const caminho of caminhosDe(arq)) {
      const { data, error } = await banco.storage.from(BALDE).download(caminho);
      if (error) throw error;
      blobs.push(data);
    }
    return new Blob(blobs, { type: tipo || "video/mp4" });
  }

  /* =========================================================
     CLIQUES
     ========================================================= */
  async function aoClicar(ev) {
    const linha = ev.target.closest("[data-abrir]");
    if (linha) { atual = normalizar(lista.find((e) => e.id === linha.dataset.abrir)); return desenhar(); }

    const mover = ev.target.closest("[data-mover]");
    if (mover) return moverClipe(mover.closest("[data-clip]").dataset.clip, Number(mover.dataset.mover));

    const botao = ev.target.closest("[data-acao]");
    if (!botao) return;
    const acao = botao.dataset.acao;
    const linhaClip = botao.closest("[data-clip]");
    const idClipe = linhaClip ? linhaClip.dataset.clip : null;

    if (acao === "novo") return criar();
    if (acao === "voltar") { soltarVideo(); atual = null; return carregar(); }
    if (acao === "salvar") { if (await salvarTela()) desenharEditor(); return; }
    if (acao === "apagar-video") return apagarVideo();
    if (acao === "pedir-legenda") return pedir("legendar");
    if (acao === "pedir-render") return pedir("renderizar");
    if (acao === "cancelar" || acao === "limpar-erro") { await salvar({ status: "rascunho", mensagem: null, progresso: 0 }); return desenharEditor(); }
    if (acao === "tirar-clipe") return tirarClipe(idClipe);
    if (acao === "ver-clipe") return verClipe(idClipe, botao);
    if (acao === "assistir") return assistirFinal(botao);
    if (acao === "baixar") return baixarFinal(botao);
    if (acao === "apagar-final") return apagarFinal();
    if (acao === "mais-legenda") {
      absorver();
      const ult = atual.config.legendas[atual.config.legendas.length - 1];
      atual.config.legendas.push({ inicio: ult ? ult.fim : 0, fim: ult ? ult.fim + 2 : 2, falada: "", ingles: "" });
      return desenharEditor();
    }
    if (acao === "tirar-legenda") { botao.closest("tr").remove(); return; }
    if (acao === "enviar-pedido") return enviarPedido();
    if (acao === "tirar-musica") return tirarMusica();
    if (acao === "tirar-elemento") { botao.closest("tr").remove(); absorver(); return desenharEditor(); }
    if (acao === "mais-elemento") {
      absorver();
      const ult = atual.config.elementos[atual.config.elementos.length - 1];
      atual.config.elementos.push(el("destaque", "", ult ? ult.fim : 0, (ult ? ult.fim : 0) + 1.5));
      return desenharEditor();
    }
    if (acao === "sugerir") {
      absorver();
      if (atual.config.elementos.length && !confirm("Trocar os elementos atuais pela sugestão do nicho?")) return;
      atual.config.elementos = (SUGESTOES[atual.modelo] || SUGESTOES.ugctech).map((x) => Object.assign({}, x));
      return desenharEditor();
    }
  }

  function aoMudar(ev) {
    if (ev.target.id === "ed-musica") {
      const arquivo = (ev.target.files || [])[0];
      ev.target.value = "";
      enviarMusica(arquivo);
    }
    if (ev.target.id === "ed-arquivos") {
      const arquivos = Array.from(ev.target.files || []);
      ev.target.value = "";
      enviarClipes(arquivos);
    }
    if (ev.target.id === "ed-modelo" || ev.target.matches("[data-x=tipo]")) {
      absorver();
      desenharEditor();
    }
  }

  function criar() {
    P.formulario({
      titulo: "Novo pedido para o estagiário",
      valores: { modelo: "ugctech" },
      campos: [
        { nome: "titulo", rotulo: "Nome do vídeo", tipo: "texto", obrigatorio: true, largo: true, ajuda: "Ex.: Cabide a vácuo ou Airlearn turco 03" },
        { nome: "modelo", rotulo: "Nicho / modelo", tipo: "escolha", largo: true, opcoes: Object.entries(MODELOS) },
        { nome: "drive", rotulo: "Link da pasta do Google Drive", tipo: "url", largo: true,
          ajuda: "Pasta compartilhada como “qualquer pessoa com o link pode ver”. Deixe em branco para enviar os clipes pelo painel." },
        { nome: "pedido", rotulo: "O que você quer nesse vídeo", tipo: "texto-longo", largo: true,
          ajuda: "Escreva como se fosse para uma pessoa: gancho, narração, b-rolls, o que cortar, música, o que a marca pediu." }
      ],
      textoSalvar: "Criar",
      aoSalvar: async (v) => {
        if (v.drive && !linkDrive(v.drive)) return "Esse link não parece de uma pasta do Drive. Ele começa com https://drive.google.com/drive/folders/…";
        try {
          // Os elementos sugeridos do nicho ficam de ponto de partida para os ajustes finos
          const config = SUGESTOES[v.modelo] ? { elementos: SUGESTOES[v.modelo] } : {};
          const novo = { titulo: v.titulo, modelo: v.modelo, config, drive_url: v.drive || null };
          // Com pasta do Drive e pedido escrito, já vai direto para a fila do estagiário
          if (v.drive && v.pedido) {
            Object.assign(novo, { pedido: v.pedido, status: "estagiario", conversa: [{ autor: "voce", texto: v.pedido, em: new Date().toISOString() }] });
          }
          const { data, error } = await banco.from(TABELA).insert(novo).select().single();
          if (error) return P.explicarErro(error, TABELA);
          await carregar();
          atual = normalizar(data);
          desenhar();
          return null;
        } catch (e) { return P.explicarErro(e, TABELA); }
      }
    });
  }

  async function moverClipe(id, passo) {
    absorver();
    const i = atual.clips.findIndex((x) => x.id === id);
    const j = i + passo;
    if (i < 0 || j < 0 || j >= atual.clips.length) return;
    [atual.clips[i], atual.clips[j]] = [atual.clips[j], atual.clips[i]];
    if (await salvar({ clips: atual.clips })) desenharEditor();
  }

  async function tirarClipe(id) {
    const x = atual.clips.find((c) => c.id === id);
    if (!x || !confirm(`Tirar "${x.nome}" deste vídeo e apagar o arquivo do Supabase?`)) return;
    if (!x.apagado) {
      const erro = await apagarArquivos(caminhosDe(x));
      if (erro) return P.toast(erro, "erro");
    }
    absorver();
    atual.clips = atual.clips.filter((c) => c.id !== id);
    if (await salvar({ clips: atual.clips })) { P.toast("Clipe tirado."); desenharEditor(); }
  }

  async function pedir(status) {
    if (!(await salvarTela(true))) return;
    if (status === "renderizar" && atual.modelo === "airlearn" && !atual.config.hook) {
      if (!confirm("O hook do Snapchat está vazio. Gerar mesmo assim?")) return;
    }
    if (await salvar({ status, mensagem: null, progresso: 0 })) {
      P.toast("Pedido na fila. Agora rode o renderizar.cmd no seu computador.");
      desenharEditor();
    }
  }

  async function apagarVideo() {
    if (!confirm(`Apagar "${atual.titulo}" de vez, com os clipes e o vídeo final? Isso não tem volta.`)) return;
    const caminhos = [];
    atual.clips.forEach((x) => { if (!x.apagado) caminhos.push(...caminhosDe(x)); });
    if (atual.final) caminhos.push(...caminhosDe(atual.final));
    if (atual.config.musica && atual.config.musica.caminho) caminhos.push(...caminhosDe(atual.config.musica));
    const erroArq = await apagarArquivos(caminhos);
    if (erroArq) return P.toast(erroArq, "erro");
    const erro = await P.gravar(TABELA, "apagar", null, atual.id);
    if (erro) return P.toast(erro, "erro");
    soltarVideo();
    atual = null;
    P.toast("Vídeo apagado.");
    await carregar();
  }

  async function apagarFinal() {
    if (!atual.final || !confirm("Apagar o vídeo 4K do Supabase? Baixe antes se quiser guardar.")) return;
    const erro = await apagarArquivos(caminhosDe(atual.final));
    if (erro) return P.toast(erro, "erro");
    soltarVideo();
    if (await salvar({ final: null, status: "rascunho", mensagem: null })) { P.toast("Vídeo 4K apagado."); desenharEditor(); }
  }

  /* ---------- Assistir e baixar ---------- */
  function soltarVideo() { if (urlFinal) { URL.revokeObjectURL(urlFinal); urlFinal = ""; } }

  async function pegarFinal(botao) {
    if (urlFinal) return urlFinal;
    const texto = botao.innerHTML;
    botao.disabled = true;
    botao.textContent = "Baixando…";
    try {
      urlFinal = URL.createObjectURL(await montar(atual.final, "video/mp4"));
      return urlFinal;
    } catch (e) {
      P.toast("Não consegui baixar o vídeo agora. " + P.explicarErro(e, "balde edicao"), "erro");
      return "";
    } finally {
      botao.disabled = false;
      botao.innerHTML = texto;
    }
  }

  async function assistirFinal(botao) {
    const url = await pegarFinal(botao);
    if (!url) return;
    P.$("#ed-player", secao).innerHTML = `<video class="ed-video" src="${url}" controls playsinline></video>`;
  }

  async function baixarFinal(botao) {
    const url = await pegarFinal(botao);
    if (!url) return;
    const a = document.createElement("a");
    a.href = url;
    a.download = `${(atual.titulo || "video").replace(/[\\/:*?"<>|]+/g, "-")}-4k.mp4`;
    document.body.appendChild(a);
    a.click();
    a.remove();
  }

  async function verClipe(id, botao) {
    const x = atual.clips.find((c) => c.id === id);
    if (!x) return;
    botao.disabled = true;
    try {
      const url = URL.createObjectURL(await montar(x, x.tipo));
      const corpo = P.ver(x.nome, `<video class="ed-video" src="${url}" controls playsinline autoplay></video>`);
      const janela = P.$("#janela-ver");
      janela.addEventListener("close", () => { corpo.innerHTML = ""; URL.revokeObjectURL(url); }, { once: true });
    } catch (e) {
      P.toast("Não consegui abrir o clipe. " + P.explicarErro(e, "balde edicao"), "erro");
    } finally {
      botao.disabled = false;
    }
  }

  /* ---------- Acompanhar o computador trabalhando ---------- */
  function ligarRelogio() {
    pararRelogio();
    relogio = setInterval(async () => {
      if (!atual || document.hidden || !P.$("#ed-tela", secao)) return;
      const r = await P.ler(TABELA, (q) => q.eq("id", atual.id));
      const novo = r.dados[0];
      if (!novo) return;
      const mudou = novo.status !== atual.status || novo.progresso !== atual.progresso || novo.mensagem !== atual.mensagem
        || (novo.conversa || []).length !== atual.conversa.length || JSON.stringify(novo.etapas || {}) !== JSON.stringify(atual.etapas);
      if (mudou) {
        const terminou = !NA_FILA.includes(novo.status) && !TRABALHANDO.includes(novo.status);
        // não perde o que você está digitando na conversa quando a tela atualiza
        const rascunho = (P.$("#ed-texto", secao) || {}).value || "";
        atual = normalizar(novo);
        desenharEditor();
        const caixa = P.$("#ed-texto", secao);
        if (caixa && rascunho) caixa.value = rascunho;
        if (terminou) {
          pararRelogio();
          if (novo.status === "pronto") P.toast("Vídeo 4K pronto!");
        }
      }
    }, 4000);
  }
  function pararRelogio() { if (relogio) { clearInterval(relogio); relogio = null; } }
})();
