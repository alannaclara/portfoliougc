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
  let anexos = [];         // fotos e prints esperando ir junto da próxima mensagem: { arquivo, url }
  const fotosUrl = new Map(); // caminho no balde -> link temporário para mostrar a foto na conversa
  let ajustesAbertos = null;  // lembra se "Ajustes finos" estava aberto quando a tela redesenha

  P.abas.edicao = {
    async iniciar(s) {
      secao = s;
      s.innerHTML = `<div class="avisos"></div><div id="ed-tela"></div>`;
      s.addEventListener("click", aoClicar);
      s.addEventListener("change", aoMudar);
      // Ctrl+V de um print em qualquer lugar do editor vira foto da conversa
      s.addEventListener("paste", (ev) => {
        const caixa = P.$("#ed-texto", secao);
        if (!caixa || caixa.disabled) return;
        const fotos = Array.from((ev.clipboardData || {}).items || [])
          .filter((i) => i.kind === "file" && i.type.startsWith("image/")).map((i) => i.getAsFile()).filter(Boolean);
        if (!fotos.length) return;
        ev.preventDefault();
        anexar(fotos);
        caixa.focus();
      });
      // Arrastar a foto para cima da conversa também funciona
      s.addEventListener("dragover", (ev) => { if (ev.target.closest(".ed-conversa")) ev.preventDefault(); });
      s.addEventListener("drop", (ev) => {
        if (!ev.target.closest(".ed-conversa")) return;
        ev.preventDefault();
        anexar(Array.from(ev.dataTransfer.files || []));
      });
      // (no documento, porque clicar num bloco da linha do tempo não põe o foco dentro da aba)
      document.addEventListener("keydown", (ev) => {
        if (!P.$("#lt", secao) || !secao.offsetParent || ev.target.closest("input, textarea, select, [contenteditable]")) return;
        // Ctrl+Z desfaz a última mudança na linha do tempo
        if ((ev.ctrlKey || ev.metaKey) && ev.key.toLowerCase() === "z") {
          ev.preventDefault();
          desfazer();
        }
        if ((ev.key === "Delete" || ev.key === "Backspace") && lt.sel) {
          ev.preventDefault();
          apagarSelecionado();
        }
      });
      s.addEventListener("pointerdown", aoApertarLinha);
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
        elementos: [], efeitos: [], apagarBrutos: true, musica: null, somClipes: 100
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
    // O que não pode se perder quando a tela redesenha: o vídeo tocando, a rolagem da linha do tempo e "Ajustes finos" aberto
    const player = P.$("#ed-player video", secao);
    const rolagem = P.$("#lt-rolagem", secao);
    const rolagemX = rolagem ? rolagem.scrollLeft : 0;
    const det = P.$(".ed-ajustes", secao);
    if (det) ajustesAbertos = det.open;
    const abrirAjustes = ajustesAbertos == null ? !e.drive_url : ajustesAbertos;
    const pagina = document.scrollingElement || document.documentElement;
    const rolagemPagina = pagina.scrollTop;
    const tela = P.$("#ed-tela", secao);
    // segura a altura enquanto troca o conteúdo, para a página não pular
    if (tela.offsetHeight) tela.style.minHeight = tela.offsetHeight + "px";

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

      ${blocoLinhaDoTempo(e, ocupado)}

      <details class="ed-ajustes"${abrirAjustes ? " open" : ""}>
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

    const novoPlayer = P.$("#ed-player", secao);
    if (player && novoPlayer) novoPlayer.appendChild(player);
    const novaRolagem = P.$("#lt-rolagem", secao);
    if (novaRolagem) novaRolagem.scrollLeft = rolagemX;
    tela.style.minHeight = "";
    pagina.scrollTop = rolagemPagina;
    posicionarCursor();
    ligarCursor();
    desenharAnexos();
    carregarFotos();
    if (TRABALHANDO.includes(e.status) || NA_FILA.includes(e.status)) ligarRelogio();
  }

  /* ---------- O estagiário: conversa, etapas e o vídeo pronto ---------- */
  function blocoEstagiario(e, ocupado) {
    const hora = (iso) => { const d = new Date(iso); return isNaN(d) ? "" : d.toLocaleTimeString("pt-BR", { hour: "2-digit", minute: "2-digit" }); };
    const bolhas = e.conversa.length ? e.conversa.map((m) => `
        <div class="ed-msg ed-msg-${m.autor === "voce" ? "voce" : "estagiario"}">
          <span class="ed-msg-quem">${m.autor === "voce" ? "Você" : "Estagiário"} <span class="mudo">${hora(m.em)}</span></span>
          ${m.texto ? `<div>${P.esc(m.texto).replace(/\n/g, "<br>")}</div>` : ""}
          ${Array.isArray(m.imagens) && m.imagens.length ? `<div class="ed-fotos">${m.imagens.map((f) =>
            `<button type="button" class="ed-foto" data-ver-foto="${P.esc(f.caminho)}" aria-label="Ver foto"><img data-foto="${P.esc(f.caminho)}" alt=""></button>`).join("")}</div>` : ""}</div>`).join("")
      : `<p class="mudo pequeno">Escreva o pedido como se fosse para uma pessoa: o que é o vídeo, o gancho, o que cortar, a música, o que a marca pediu.</p>`;
    const estado = (k) => e.etapas[k] || "pendente";
    const icone = { feito: "check", fazendo: "recarregar", pulado: "x", pendente: "relogio" };
    const etapas = ETAPAS.map(([k, nome]) => `<li class="ed-etapa ed-etapa-${estado(k)}">${P.icone(icone[estado(k)] || "relogio", "ico-p")}<span>${nome}</span></li>`).join("");
    const f = e.final;
    return `<div class="ed-estagiario bloco">
      <div class="cartao ed-conversa">
        <div class="cartao-topo"><h2>${P.icone("caneta", "ico-p")} Estagiário <span class="mudo pequeno">de edição · trabalha no seu computador</span></h2></div>
        <div class="ed-mensagens" id="ed-mensagens">${bolhas}</div>
        <div id="ed-anexos" class="ed-anexos" hidden></div>
        <div class="ed-escrever">
          <label class="botao botao-icone${ocupado ? " ed-desligado" : ""}" title="Anexar foto ou print (ou cole com Ctrl+V)" aria-label="Anexar foto">${P.icone("foto", "ico-p")}
            <input type="file" id="ed-fotos" accept="image/*" multiple hidden${ocupado ? " disabled" : ""}></label>
          <textarea id="ed-texto" rows="3" placeholder="${e.conversa.length ? "Peça um ajuste: “tira o 2º corte”, “texto maior”, “música mais baixa”… Cole um print com Ctrl+V." : "Ex.: gancho falado, depois narração. Os b-rolls estão com nome. Corta as pausas, música baixinha e um CTA pra comentar LINK. Pode colar prints com Ctrl+V."}"${ocupado ? " disabled" : ""}></textarea>
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

  async function enviarPedido(botao) {
    const caixa = P.$("#ed-texto", secao);
    const texto = (caixa && caixa.value || "").trim();
    if (!texto && !anexos.length) return P.toast("Escreva o pedido primeiro.", "erro");
    absorver();
    if (!linkDrive(atual.drive_url) && !atual.clips.some((x) => !x.apagado)) {
      return P.toast("Cole o link da pasta do Google Drive (drive.google.com/drive/folders/…) ou envie clipes nos ajustes finos.", "erro");
    }
    // As fotos sobem primeiro (cada uma num arquivo só: print é pequeno)
    const imagens = [];
    if (anexos.length) {
      if (botao) { botao.disabled = true; botao.textContent = "Enviando fotos…"; }
      for (const { arquivo } of anexos) {
        const ext = ((arquivo.type.split("/")[1] || "png").replace("jpeg", "jpg").match(/^\w+/) || ["png"])[0];
        const caminho = `${atual.id}/chat/${novoId()}.${ext}`;
        const { error } = await banco.storage.from(BALDE).upload(caminho, arquivo, { contentType: arquivo.type || "image/png", cacheControl: "3600" });
        if (error) {
          P.toast("Não consegui enviar a foto: " + P.explicarErro(error, "balde edicao"), "erro");
          await apagarArquivos(imagens.map((i) => i.caminho));
          return desenharEditor();
        }
        imagens.push({ caminho, nome: arquivo.name || "print", tipo: arquivo.type || "image/png" });
      }
    }
    const msg = { autor: "voce", texto, em: new Date().toISOString() };
    if (imagens.length) msg.imagens = imagens;
    const conversa = [...atual.conversa, msg];
    const campos = { titulo: atual.titulo, modelo: atual.modelo, drive_url: atual.drive_url, config: atual.config, clips: atual.clips,
      conversa, status: "estagiario", mensagem: null, progresso: 0 };
    if (!atual.pedido) campos.pedido = texto || "(veja as fotos)";
    if (await salvar(campos)) {
      limparAnexos();
      P.toast("Pedido enviado. O estagiário começa em alguns segundos.");
    }
    desenharEditor();
  }

  /* ---------- Fotos e prints na conversa ---------- */
  function anexar(arquivos) {
    const fotos = arquivos.filter((a) => a && a.type && a.type.startsWith("image/"));
    if (!fotos.length) return arquivos.length ? P.toast("Só dá para anexar imagens (foto ou print).", "erro") : null;
    for (const f of fotos) {
      if (f.size > 15 * 1024 * 1024) { P.toast(`${f.name || "A imagem"} passa de 15 MB.`, "erro"); continue; }
      if (anexos.length >= 8) { P.toast("No máximo 8 fotos por mensagem.", "erro"); break; }
      anexos.push({ arquivo: f, url: URL.createObjectURL(f) });
    }
    desenharAnexos();
  }

  function limparAnexos() {
    anexos.forEach((a) => URL.revokeObjectURL(a.url));
    anexos = [];
    desenharAnexos();
  }

  function desenharAnexos() {
    const caixa = P.$("#ed-anexos", secao);
    if (!caixa) return;
    caixa.hidden = !anexos.length;
    caixa.innerHTML = anexos.map((a, i) => `<div class="ed-anexo"><img src="${a.url}" alt="">
      <button type="button" class="ed-anexo-tirar" data-tirar-anexo="${i}" aria-label="Tirar foto">${P.icone("x", "ico-p")}</button></div>`).join("")
      + (anexos.length ? `<span class="mudo pequeno">${P.plural(anexos.length, "foto vai", "fotos vão")} junto da mensagem</span>` : "");
  }

  // As fotos ficam no balde privado: pede um link temporário para cada uma
  async function carregarFotos() {
    const imgs = P.$$("img[data-foto]", secao);
    const faltam = [...new Set(imgs.map((i) => i.dataset.foto).filter((c) => !fotosUrl.has(c)))];
    if (faltam.length) {
      const { data } = await banco.storage.from(BALDE).createSignedUrls(faltam, 3600);
      (data || []).forEach((d) => { if (d.signedUrl) fotosUrl.set(d.path, d.signedUrl); });
    }
    imgs.forEach((i) => { const u = fotosUrl.get(i.dataset.foto); if (u && !i.src) i.src = u; });
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
    if (linha) { trocarDeVideo(); atual = normalizar(lista.find((e) => e.id === linha.dataset.abrir)); return desenhar(); }

    const tirarAnexo = ev.target.closest("[data-tirar-anexo]");
    if (tirarAnexo) {
      const [a] = anexos.splice(Number(tirarAnexo.dataset.tirarAnexo), 1);
      if (a) URL.revokeObjectURL(a.url);
      return desenharAnexos();
    }
    const verFoto = ev.target.closest("[data-ver-foto]");
    if (verFoto) {
      const u = fotosUrl.get(verFoto.dataset.verFoto);
      if (u) P.ver("Foto da conversa", `<img src="${u}" alt="" style="display:block;max-width:100%;max-height:75vh;margin:auto;border-radius:10px">`);
      return;
    }
    // botões comuns (data-acao, como "Gerar 4K") que moram dentro da linha do tempo seguem para baixo
    if (ev.target.closest("#lt") && !ev.target.closest("[data-acao]")) return cliqueNaLinha(ev);

    const mover = ev.target.closest("[data-mover]");
    if (mover) return moverClipe(mover.closest("[data-clip]").dataset.clip, Number(mover.dataset.mover));

    const botao = ev.target.closest("[data-acao]");
    if (!botao) return;
    const acao = botao.dataset.acao;
    const linhaClip = botao.closest("[data-clip]");
    const idClipe = linhaClip ? linhaClip.dataset.clip : null;

    if (acao === "novo") return criar();
    if (acao === "voltar") { trocarDeVideo(); atual = null; return carregar(); }
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
    if (acao === "enviar-pedido") return enviarPedido(botao);
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
    if (ev.target.id === "ed-fotos") {
      const arquivos = Array.from(ev.target.files || []);
      ev.target.value = "";
      return anexar(arquivos);
    }
    if (ev.target.closest(".lt-inspetor")) return aplicarInspetor(ev.target);
    if (ev.target.id === "lt-zoom") {
      // mantém o cursor no mesmo lugar da tela ao mudar o zoom
      const rol = P.$("#lt-rolagem", secao);
      const antes = rol ? lt.cursor * lt.pps - rol.scrollLeft : 0;
      lt.pps = n(ev.target.value);
      desenharEditor();
      const novo = P.$("#lt-rolagem", secao);
      if (novo) novo.scrollLeft = Math.max(0, lt.cursor * lt.pps - antes);
      return;
    }
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
      P.toast(status === "renderizar" ? "4K na fila. O estagiário começa em alguns segundos." : "Legenda na fila. O estagiário começa em alguns segundos.");
      desenharEditor();
    }
  }

  async function apagarVideo() {
    if (!confirm(`Apagar "${atual.titulo}" de vez, com os clipes e o vídeo final? Isso não tem volta.`)) return;
    const caminhos = [];
    atual.clips.forEach((x) => { if (!x.apagado) caminhos.push(...caminhosDe(x)); });
    if (atual.final) caminhos.push(...caminhosDe(atual.final));
    if (atual.config.musica && atual.config.musica.caminho) caminhos.push(...caminhosDe(atual.config.musica));
    atual.conversa.forEach((m) => (m.imagens || []).forEach((f) => caminhos.push(f.caminho)));
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

  // Ao abrir outro vídeo ou voltar para a lista, nada do vídeo anterior fica pendurado
  function trocarDeVideo() {
    soltarVideo();
    limparAnexos();
    ajustesAbertos = null;
    lt.sel = null;
    lt.historico = [];
    lt.pps = 0;
  }

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
    ligarCursor();
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

  /* =========================================================
     LINHA DO TEMPO (como a do CapCut)
     Camadas: textos na tela, vídeo, legenda, música e efeitos sonoros.
     Arraste um bloco para mudar de lugar, puxe as pontas para cortar ou esticar,
     clique para editar. Mexer num clipe leva junto a legenda, os textos e os efeitos
     que estão em cima dele (como o "vincular" do CapCut).
     ========================================================= */
  const EFEITOS = { whoosh: "Whoosh (transição)", pop: "Pop (texto que salta)", ding: "Ding (número, conquista)", click: "Click (toque na tela)" };
  const LT_NOME = 96; // largura da coluna com o nome de cada camada (igual ao admin.css)
  const lt = { sel: null, historico: [], pps: 0, arrasto: null, cursor: 0, salvarDepois: null, ignorarClique: false };
  const fix = (v) => Math.round(v * 100) / 100;
  const travado = () => !atual || NA_FILA.includes(atual.status) || TRABALHANDO.includes(atual.status);

  const durClipe = (x) => Math.max(0.1, (x.fim != null && x.fim !== "" ? n(x.fim) : (x.duracao ? n(x.duracao) : 3)) - n(x.inicio));
  function iniciosDosClipes(clips) { let t = 0; return clips.map((x) => { const a = t; t += durClipe(x); return a; }); }
  const totalVideo = (clips) => clips.reduce((s, x) => s + durClipe(x), 0);

  // Frases da legenda dos nichos: junta as palavras até uma pausa ou 6 palavras
  function frasesDe(palavras) {
    const frases = [];
    palavras.forEach((p, i) => {
      const f = frases[frases.length - 1];
      if (f && n(p.inicio) - n(palavras[i - 1].fim) < 0.45 && i - f.de < 6) f.ate = i;
      else frases.push({ de: i, ate: i });
    });
    return frases.map((f) => Object.assign(f, {
      inicio: n(palavras[f.de].inicio), fim: n(palavras[f.ate].fim),
      texto: palavras.slice(f.de, f.ate + 1).map((p) => p.texto).join(" ")
    }));
  }

  // Textos que se sobrepõem no tempo vão para linhas diferentes (itens já em ordem de início)
  function raias(itens) {
    const fins = [];
    return itens.map((x) => {
      let r = fins.findIndex((f) => f <= x.inicio + 0.01);
      if (r < 0) { r = fins.length; fins.push(0); }
      fins[r] = x.fim;
      return r;
    });
  }

  function blocoLinhaDoTempo(e, ocupado) {
    const c = e.config;
    const airlearn = e.modelo === "airlearn";
    if (!e.clips.length && !c.elementos.length && !(c.legendas || []).length) return "";
    const total = totalVideo(e.clips);
    const fins = [...c.elementos.map((x) => n(x.fim)), ...(c.legendas || []).map((l) => n(l.fim)),
      ...(c.palavras || []).map((p) => n(p.fim)), ...(c.efeitos || []).map((x) => n(x.inicio) + 0.5)];
    const dur = Math.max(total, 5, ...fins);
    if (!lt.pps) lt.pps = Math.max(14, Math.min(120, Math.floor(((secao.clientWidth || 900) - LT_NOME - 60) / dur)));
    const pps = lt.pps;
    const W = Math.ceil(dur * pps) + 80;
    const px = (t) => (Math.max(0, t) * pps).toFixed(1);
    const sel = lt.sel;
    const bloco = (tipo, i, ini, fim, rotulo, classe, opc = {}) => {
      const pontas = !(opc.fixo || opc.semPontas);
      return `<div class="lt-bloco ${classe}${sel && sel.tipo === tipo && sel.i === i ? " lt-sel" : ""}${opc.fixo ? " lt-fixo" : ""}"
        data-lt="${tipo}" data-i="${i}" style="left:${px(ini)}px;width:${Math.max(8, (fim - ini) * pps).toFixed(1)}px" title="${P.esc(rotulo)}">
        ${pontas ? `<span class="lt-ponta lt-ponta-e" data-ponta="e"></span>` : ""}<span class="lt-rotulo">${P.esc(rotulo)}</span>${pontas ? `<span class="lt-ponta lt-ponta-d" data-ponta="d"></span>` : ""}</div>`;
    };
    const trilha = (nome, conteudo, classe) => `<div class="lt-trilha ${classe || ""}"><div class="lt-nome">${nome}</div>
      <div class="lt-pista" style="width:${W}px">${conteudo}</div></div>`;

    // Régua: traço a cada segundo, número a cada 1, 2 ou 5 s conforme o zoom
    const passo = pps >= 60 ? 1 : pps >= 28 ? 2 : 5;
    let regua = "";
    for (let s = 0; s <= dur + 1; s++) {
      const forte = s % passo === 0;
      regua += `<span class="lt-traco${forte ? " lt-traco-forte" : ""}" style="left:${px(s)}px">${forte ? `<b>${Math.floor(s / 60)}:${String(s % 60).padStart(2, "0")}</b>` : ""}</span>`;
    }

    let trilhas = "";
    if (airlearn) {
      trilhas += trilha("Hook", bloco("hook", 0, 0, Math.max(total, 1), c.hook || "(sem hook)", "lt-texto", { fixo: true }));
    } else {
      const ordem = c.elementos.map((x, i) => ({ i, inicio: n(x.inicio), fim: x.tipo === "flash" ? n(x.inicio) + 0.3 : n(x.fim) }))
        .sort((a, b) => a.inicio - b.inicio);
      const r = raias(ordem);
      const qtd = Math.max(1, ...r.map((v) => v + 1));
      for (let k = qtd - 1; k >= 0; k--) {
        trilhas += trilha(k === qtd - 1 ? "Textos" : "", ordem.filter((_, j) => r[j] === k).map((o) => {
          const x = c.elementos[o.i];
          const nome = (TIPOS[x.tipo] || [x.tipo])[0].split(" (")[0];
          // o texto vem primeiro (é o que aparece no bloco estreito); o tipo fica no fim
          return bloco("el", o.i, o.inicio, o.fim, x.tipo === "flash" ? "⚡" : x.texto ? `${x.texto.replace(/\s\/\s/g, " ")} · ${nome}` : nome,
            x.tipo === "flash" ? "lt-flash" : "lt-texto", { semPontas: x.tipo === "flash" });
        }).join(""));
      }
    }
    const inis = iniciosDosClipes(e.clips);
    trilhas += trilha("Vídeo", e.clips.map((x, i) => bloco("clip", i, inis[i], inis[i] + durClipe(x),
      `${x.nome}${n(x.zoom) > 1 ? " · zoom" : ""}`, "lt-clipe" + (x.apagado ? " lt-apagado" : ""))).join("")
      || `<span class="lt-vazio">sem clipes</span>`, "lt-trilha-video");
    if (airlearn) {
      trilhas += trilha("Legenda", (c.legendas || []).map((l, i) => bloco("leg", i, n(l.inicio), n(l.fim), l.falada || l.ingles || "frase", "lt-legenda")).join(""));
    } else {
      trilhas += trilha("Legenda", frasesDe(c.palavras).map((f, i) => bloco("frase", i, f.inicio, f.fim, f.texto, "lt-legenda")).join("")
        || `<span class="lt-vazio">sem legenda</span>`);
      trilhas += trilha("Música", c.musica ? bloco("musica", 0, 0, Math.max(total, 1), `♪ ${c.musica.nome} · ${n(c.musica.volume)}%`, "lt-musica", { fixo: true })
        : `<span class="lt-vazio">sem música (envie em Ajustes finos ou ponha na pasta do Drive)</span>`);
      trilhas += trilha("Efeitos", (c.efeitos || []).map((x, i) => bloco("efeito", i, n(x.inicio), n(x.inicio) + 0.5,
        (EFEITOS[x.tipo] || x.tipo).split(" (")[0], "lt-efeito", { semPontas: true })).join(""));
    }

    return `<div class="cartao bloco lt-cartao" id="lt">
      <div class="cartao-topo"><h2>${P.icone("cortar", "ico-p")} Linha do tempo <span class="mudo pequeno">${seg(total)}</span></h2>
        <div class="grupo-botoes">
          <button class="botao" type="button" data-lt-acao="desfazer"${lt.historico.length && !ocupado ? "" : " disabled"} title="Ctrl+Z">${P.icone("desfazer", "ico-p")}Desfazer</button>
          ${airlearn ? `<button class="botao" type="button" data-lt-acao="mais-leg"${ocupado ? " disabled" : ""}>${P.icone("mais", "ico-p")}Frase</button>`
            : `<button class="botao" type="button" data-lt-acao="mais-texto"${ocupado ? " disabled" : ""}>${P.icone("mais", "ico-p")}Texto</button>
               <button class="botao" type="button" data-lt-acao="mais-efeito"${ocupado ? " disabled" : ""}>${P.icone("mais", "ico-p")}Efeito sonoro</button>`}
          <label class="lt-zoom" title="Zoom da linha do tempo">${P.icone("busca", "ico-p")}<input type="range" id="lt-zoom" min="10" max="200" step="2" value="${pps}" aria-label="Zoom"></label>
          <button class="botao botao-principal" type="button" data-acao="pedir-render"${!e.clips.some((x) => !x.apagado) || ocupado ? " disabled" : ""}>${P.icone("play", "ico-p")}Gerar 4K com as mudanças</button>
        </div></div>
      ${ocupado ? `<p class="mudo pequeno lt-aviso">O computador está mexendo neste vídeo agora. Dá para editar aqui quando ele terminar.</p>` : ""}
      <div class="lt-rolagem${ocupado ? " lt-travada" : ""}" id="lt-rolagem">
        <div class="lt-trilha lt-trilha-regua"><div class="lt-nome"></div><div class="lt-pista lt-regua" style="width:${W}px">${regua}</div></div>
        ${trilhas}
        <div class="lt-cursor" id="lt-cursor" style="left:${(LT_NOME + lt.cursor * pps).toFixed(1)}px"></div>
      </div>
      <div class="lt-inspetor">${inspetor(e, ocupado)}</div>
      <p class="mudo pequeno lt-dica">Arraste para mover · puxe as pontas para cortar ou esticar · clique para editar · Ctrl+Z desfaz · Delete apaga.
        Salva sozinho. Depois clique em <b>Gerar 4K com as mudanças</b>. Se pedir um ajuste ao estagiário, ele refaz a partir do plano dele.</p>
    </div>`;
  }

  function inspetor(e, ocupado) {
    const c = e.config;
    const s = lt.sel;
    const campo = (rotulo, html, largo) => `<label class="campo${largo ? " lt-largo" : ""}"><span>${rotulo}</span>${html}</label>`;
    const num = (k, v) => `<input type="text" inputmode="decimal" data-campo="${k}" value="${String(fix(n(v))).replace(".", ",")}">`;
    const txt = (k, v, dica) => `<input data-campo="${k}" value="${P.esc(v || "")}" placeholder="${P.esc(dica || "")}">`;
    const apagar = `<button class="botao botao-perigo" type="button" data-lt-acao="apagar">${P.icone("lixo", "ico-p")}Apagar</button>`;
    const caixa = (titulo, campos, botoes) => `<fieldset class="lt-campos"${ocupado ? " disabled" : ""}>
      <legend>${titulo}</legend>${campos}<div class="grupo-botoes lt-botoes">${botoes || ""}</div></fieldset>`;
    if (!s) return `<p class="mudo pequeno">Clique num bloco para editar. Clique na régua para pôr o cursor (linha vermelha)${P.$("#ed-player video", secao) ? " e pular o vídeo para esse ponto" : ""}.</p>`;

    if (s.tipo === "el") {
      const x = c.elementos[s.i];
      if (!x) return "";
      return caixa("Texto na tela",
        campo("Tipo", `<select data-campo="tipo">${Object.entries(TIPOS).map(([v, [t]]) => `<option value="${v}"${v === x.tipo ? " selected" : ""}>${t}</option>`).join("")}</select>`)
        + campo("Texto", txt("texto", x.texto, "use “ / ” para quebrar a linha"), true)
        + campo("Extra", txt("extra", x.extra, (TIPOS[x.tipo] || ["", ""])[1]))
        + campo("De (s)", num("inicio", x.inicio)) + campo("Até (s)", num("fim", x.fim)),
        `<button class="botao" type="button" data-lt-acao="duplicar">${P.icone("copiar", "ico-p")}Duplicar</button>${apagar}`);
    }
    if (s.tipo === "clip") {
      const x = e.clips[s.i];
      if (!x) return "";
      const z = n(x.zoom) || 1;
      return caixa(`Clipe ${s.i + 1}: ${P.esc(x.nome)}`,
        campo("Começa no segundo", num("inicio", x.inicio)) + campo("Termina no segundo", num("fim", x.fim != null && x.fim !== "" ? x.fim : (x.duracao || 0)))
        + campo("Zoom", `<select data-campo="zoom">${[[1, "Sem zoom"], [1.1, "Leve (1,1×)"], [1.15, "Médio (1,15×)"], [1.25, "Forte (1,25×)"], [1.4, "Bem perto (1,4×)"]]
          .map(([v, t]) => `<option value="${v}"${Math.abs(z - v) < 0.01 ? " selected" : ""}>${t}</option>`).join("")}</select>`)
        + `<p class="mudo pequeno lt-largo">Os segundos são dentro do arquivo original${x.duracao ? ` (que tem ${seg(x.duracao)})` : ""}.</p>`,
        `<button class="botao" type="button" data-lt-acao="dividir" title="Corta o clipe onde está o cursor">${P.icone("cortar", "ico-p")}Dividir no cursor</button>
         <button class="botao botao-icone" type="button" data-lt-acao="mover" data-passo="-1" aria-label="Mover para a esquerda"${s.i === 0 ? " disabled" : ""}>${P.icone("esq", "ico-p")}</button>
         <button class="botao botao-icone" type="button" data-lt-acao="mover" data-passo="1" aria-label="Mover para a direita"${s.i === e.clips.length - 1 ? " disabled" : ""}>${P.icone("dir", "ico-p")}</button>${apagar}`);
    }
    if (s.tipo === "frase") {
      const f = frasesDe(c.palavras)[s.i];
      if (!f) return "";
      return caixa("Legenda",
        campo("Texto", txt("texto", f.texto), true) + campo("De (s)", num("inicio", f.inicio)) + campo("Até (s)", num("fim", f.fim))
        + `<p class="mudo pequeno lt-largo">Corrija a grafia aqui. Se mudar o número de palavras, o tempo da frase é dividido igual entre elas.</p>`, apagar);
    }
    if (s.tipo === "leg") {
      const l = (c.legendas || [])[s.i];
      if (!l) return "";
      return caixa("Legenda dupla",
        campo("Língua falada", txt("falada", l.falada), true) + campo("Inglês", txt("ingles", l.ingles), true)
        + campo("De (s)", num("inicio", l.inicio)) + campo("Até (s)", num("fim", l.fim)), apagar);
    }
    if (s.tipo === "hook") return caixa("Hook do Snapchat (fica o vídeo todo)", campo("Texto", txt("hook", c.hook), true));
    if (s.tipo === "musica" && c.musica) {
      return caixa(`Música: ${P.esc(c.musica.nome)}`,
        campo(`Volume`, `<input type="range" data-campo="volume" min="0" max="100" step="5" value="${n(c.musica.volume)}">`)
        + campo("Começar a música em (s)", num("inicio", c.musica.inicio)),
        `<button class="botao botao-perigo" type="button" data-lt-acao="apagar">${P.icone("lixo", "ico-p")}Tirar música</button>`);
    }
    if (s.tipo === "efeito") {
      const x = (c.efeitos || [])[s.i];
      if (!x) return "";
      return caixa("Efeito sonoro",
        campo("Som", `<select data-campo="tipo">${Object.entries(EFEITOS).map(([v, t]) => `<option value="${v}"${v === x.tipo ? " selected" : ""}>${t}</option>`).join("")}</select>`)
        + campo("Toca em (s)", num("inicio", x.inicio))
        + campo("Volume", `<input type="range" data-campo="volume" min="10" max="100" step="5" value="${n(x.volume ?? 70)}">`), apagar);
    }
    return "";
  }

  /* ---------- Guardar, desfazer e salvar sozinho ---------- */
  function guardar() {
    absorver();
    lt.historico.push(JSON.stringify({ config: atual.config, clips: atual.clips }));
    if (lt.historico.length > 40) lt.historico.shift();
  }

  function desfazer() {
    if (travado()) return;
    const ultimo = lt.historico.pop();
    if (!ultimo) return;
    const d = JSON.parse(ultimo);
    atual.config = d.config;
    atual.clips = d.clips;
    lt.sel = null;
    mudou();
  }

  function mudou() {
    desenharEditor();
    clearTimeout(lt.salvarDepois);
    lt.salvarDepois = setTimeout(async () => {
      if (atual && !travado()) await salvar({ config: atual.config, clips: atual.clips });
    }, 800);
  }

  /* ---------- Mexer num clipe leva junto o que está em cima dele ---------- */
  function ancorar() {
    const inis = iniciosDosClipes(atual.clips);
    const achar = (t) => { let k = 0; inis.forEach((a, i) => { if (t >= a - 0.001) k = i; }); return k; };
    const c = atual.config;
    const marcar = (obj, colado) => {
      const k = achar(n(obj.inicio));
      const x = atual.clips[k];
      return x ? { obj, colado, clipe: x, src: n(obj.inicio) - inis[k] + n(x.inicio), dur: obj.fim != null ? n(obj.fim) - n(obj.inicio) : 0 } : null;
    };
    // palavras e frases da Airlearn somem junto com o clipe; textos e efeitos ficam onde estão
    return [...(c.palavras || []).map((o) => marcar(o, true)), ...(c.legendas || []).map((o) => marcar(o, true)),
      ...(c.elementos || []).map((o) => marcar(o, false)), ...(c.efeitos || []).map((o) => marcar(o, false))].filter(Boolean);
  }

  function reaplicar(ancoras) {
    const inis = iniciosDosClipes(atual.clips);
    const total = totalVideo(atual.clips);
    const fora = new Set();
    ancoras.forEach((a) => {
      const k = atual.clips.indexOf(a.clipe);
      if (k < 0) {
        if (a.colado) fora.add(a.obj);
        return;
      }
      const ini = n(a.clipe.inicio);
      const fim = ini + durClipe(a.clipe);
      let src = a.src;
      if (src < ini - 0.05 || src >= fim) {
        if (a.colado) { fora.add(a.obj); return; }
        src = Math.min(Math.max(src, ini), fim - 0.1);
      }
      const t = Math.min(inis[k] + (src - ini), Math.max(0, total - 0.1));
      a.obj.inicio = fix(t);
      if (a.obj.fim != null) a.obj.fim = fix(t + a.dur);
    });
    const c = atual.config;
    const filtrar = (lista) => (Array.isArray(lista) ? lista.filter((o) => !fora.has(o)) : lista);
    c.palavras = filtrar(c.palavras);
    c.legendas = filtrar(c.legendas);
  }

  /* ---------- Arrastar blocos ---------- */
  function aoApertarLinha(ev) {
    if (ev.button !== 0 || !ev.target.closest("#lt-rolagem")) return;
    const regua = ev.target.closest(".lt-regua");
    if (regua) return arrastarCursor(ev, regua);
    const bloco = ev.target.closest(".lt-bloco");
    if (!bloco || bloco.classList.contains("lt-fixo") || travado()) return;
    ev.preventDefault();
    const ponta = ev.target.closest("[data-ponta]");
    lt.arrasto = {
      tipo: bloco.dataset.lt, i: Number(bloco.dataset.i), ponta: ponta ? ponta.dataset.ponta : null,
      x0: ev.clientX, el: bloco, left0: parseFloat(bloco.style.left), w0: parseFloat(bloco.style.width), dx: 0, moveu: false
    };
    window.addEventListener("pointermove", aoArrastar);
    window.addEventListener("pointerup", aoSoltar, { once: true });
    window.addEventListener("pointercancel", aoSoltar, { once: true });
  }

  function aoArrastar(ev) {
    const a = lt.arrasto;
    if (!a) return;
    a.dx = ev.clientX - a.x0;
    if (!a.moveu && Math.abs(a.dx) < 4) return;
    a.moveu = true;
    a.el.classList.add("lt-arrastando");
    // só a prévia na tela; os tempos mudam de verdade quando soltar
    if (!a.ponta) a.el.style.left = Math.max(0, a.left0 + a.dx) + "px";
    else if (a.ponta === "e") {
      const w = Math.max(8, a.w0 - a.dx);
      a.el.style.left = Math.max(0, a.left0 + a.w0 - w) + "px";
      a.el.style.width = w + "px";
    } else a.el.style.width = Math.max(8, a.w0 + a.dx) + "px";
  }

  function aoSoltar() {
    const a = lt.arrasto;
    lt.arrasto = null;
    window.removeEventListener("pointermove", aoArrastar);
    window.removeEventListener("pointerup", aoSoltar);
    window.removeEventListener("pointercancel", aoSoltar);
    if (!a) return;
    if (!a.moveu) return; // foi só um clique: o "click" seleciona
    lt.ignorarClique = true;
    setTimeout(() => { lt.ignorarClique = false; }, 0);
    lt.sel = { tipo: a.tipo, i: a.i };
    aplicarArrasto(a, a.dx / lt.pps);
  }

  function aplicarArrasto(a, dt) {
    guardar();
    const c = atual.config;
    const mexer = (obj, minimo) => {
      let ini = n(obj.inicio);
      let fim = n(obj.fim);
      if (!a.ponta) { const d = Math.max(-ini, dt); ini += d; fim += d; }
      else if (a.ponta === "e") ini = Math.min(Math.max(0, ini + dt), fim - (minimo || 0.2));
      else fim = Math.max(ini + (minimo || 0.2), fim + dt);
      obj.inicio = fix(ini);
      obj.fim = fix(fim);
    };
    if (a.tipo === "el" && c.elementos[a.i]) {
      const x = c.elementos[a.i];
      if (x.tipo === "flash") { x.inicio = fix(Math.max(0, n(x.inicio) + dt)); x.fim = x.inicio; } else mexer(x);
    } else if (a.tipo === "leg" && c.legendas[a.i]) mexer(c.legendas[a.i]);
    else if (a.tipo === "efeito" && c.efeitos && c.efeitos[a.i]) c.efeitos[a.i].inicio = fix(Math.max(0, n(c.efeitos[a.i].inicio) + dt));
    else if (a.tipo === "frase") {
      const f = frasesDe(c.palavras)[a.i];
      if (f) {
        const alvo = { inicio: f.inicio, fim: f.fim };
        mexer(alvo, 0.15);
        reescalarFrase(f, alvo.inicio, alvo.fim);
      }
    } else if (a.tipo === "clip" && atual.clips[a.i]) {
      const ancoras = ancorar();
      const x = atual.clips[a.i];
      if (!a.ponta) {
        // muda a ordem: o clipe entra onde o meio dele foi solto
        const inis = iniciosDosClipes(atual.clips);
        const meio = inis[a.i] + durClipe(x) / 2 + dt;
        const resto = atual.clips.filter((_, k) => k !== a.i);
        let pos = 0;
        let t = 0;
        for (const y of resto) { if (meio > t + durClipe(y) / 2) pos++; t += durClipe(y); }
        resto.splice(pos, 0, x);
        atual.clips = resto;
        lt.sel = { tipo: "clip", i: pos };
      } else if (a.ponta === "e") {
        const fimSrc = n(x.inicio) + durClipe(x);
        x.inicio = fix(Math.min(Math.max(0, n(x.inicio) + dt), fimSrc - 0.2));
        if (x.fim == null || x.fim === "") x.fim = fix(fimSrc);
      } else {
        const max = x.duracao ? n(x.duracao) : Infinity;
        x.fim = fix(Math.min(max, Math.max(n(x.inicio) + 0.2, n(x.inicio) + durClipe(x) + dt)));
      }
      reaplicar(ancoras);
    }
    mudou();
  }

  // Muda início/fim de uma frase da legenda esticando ou encolhendo as palavras dela
  function reescalarFrase(f, inicio, fim) {
    const c = atual.config;
    const escala = (fim - inicio) / Math.max(0.01, f.fim - f.inicio);
    for (let k = f.de; k <= f.ate; k++) {
      const p = c.palavras[k];
      p.inicio = fix(inicio + (n(p.inicio) - f.inicio) * escala);
      p.fim = fix(inicio + (n(p.fim) - f.inicio) * escala);
    }
    c.palavras.sort((x, y) => x.inicio - y.inicio);
  }

  /* ---------- Cursor (linha vermelha) e o vídeo pronto ---------- */
  function posicionarCursor() {
    const el = P.$("#lt-cursor", secao);
    const nome = P.$(".lt-nome", secao); // no celular a coluna dos nomes é mais estreita
    if (el) el.style.left = ((nome ? nome.offsetWidth : LT_NOME) + lt.cursor * lt.pps).toFixed(1) + "px";
  }

  function arrastarCursor(ev, regua) {
    const mover = (x) => {
      lt.cursor = Math.max(0, (x - regua.getBoundingClientRect().left) / lt.pps);
      posicionarCursor();
      const v = P.$("#ed-player video", secao);
      if (v && Number.isFinite(v.duration)) v.currentTime = Math.min(lt.cursor, v.duration);
    };
    mover(ev.clientX);
    const aoMover = (e2) => mover(e2.clientX);
    window.addEventListener("pointermove", aoMover);
    window.addEventListener("pointerup", () => window.removeEventListener("pointermove", aoMover), { once: true });
  }

  // Enquanto o vídeo pronto toca, o cursor anda junto (e a linha do tempo rola para acompanhar)
  function ligarCursor() {
    const v = P.$("#ed-player video", secao);
    if (!v || v.dataset.lt) return;
    v.dataset.lt = "1";
    const andar = () => {
      lt.cursor = v.currentTime;
      posicionarCursor();
      const rol = P.$("#lt-rolagem", secao);
      const x = LT_NOME + lt.cursor * lt.pps;
      if (rol && !v.paused && (x < rol.scrollLeft + LT_NOME || x > rol.scrollLeft + rol.clientWidth - 40)) rol.scrollLeft = x - LT_NOME - 40;
      if (!v.paused) requestAnimationFrame(andar);
    };
    v.addEventListener("play", andar);
    v.addEventListener("seeked", andar);
  }

  /* ---------- Cliques e botões da linha do tempo ---------- */
  function cliqueNaLinha(ev) {
    const botao = ev.target.closest("[data-lt-acao]");
    if (botao) return acaoDaLinha(botao.dataset.ltAcao, botao);
    if (lt.ignorarClique) return;
    const bloco = ev.target.closest(".lt-bloco");
    if (bloco) {
      lt.sel = { tipo: bloco.dataset.lt, i: Number(bloco.dataset.i) };
      return desenharEditor();
    }
    if (ev.target.closest(".lt-pista") && !ev.target.closest(".lt-regua") && lt.sel) {
      lt.sel = null;
      desenharEditor();
    }
  }

  async function acaoDaLinha(acao, botao) {
    if (acao === "desfazer") return desfazer();
    if (travado()) return;
    const c = atual.config;
    const agora = fix(lt.cursor);
    if (acao === "mais-texto") {
      guardar();
      atual.config.elementos.push(el("destaque", "Texto", agora, fix(agora + 1.5)));
      lt.sel = { tipo: "el", i: atual.config.elementos.length - 1 };
      return mudou();
    }
    if (acao === "mais-efeito") {
      guardar();
      atual.config.efeitos = [...(atual.config.efeitos || []), { tipo: "whoosh", inicio: agora, volume: 70 }];
      lt.sel = { tipo: "efeito", i: atual.config.efeitos.length - 1 };
      return mudou();
    }
    if (acao === "mais-leg") {
      guardar();
      atual.config.legendas.push({ inicio: agora, fim: fix(agora + 2), falada: "", ingles: "" });
      atual.config.legendas.sort((a, b) => a.inicio - b.inicio);
      lt.sel = { tipo: "leg", i: atual.config.legendas.findIndex((l) => l.inicio === agora && !l.falada) };
      return mudou();
    }
    if (acao === "apagar") return apagarSelecionado();
    if (acao === "duplicar" && lt.sel && c.elementos[lt.sel.i]) {
      guardar();
      const x = Object.assign({}, atual.config.elementos[lt.sel.i]);
      const d = Math.max(0.5, n(x.fim) - n(x.inicio));
      x.inicio = fix(n(x.inicio) + d);
      x.fim = fix(n(x.fim) + d);
      atual.config.elementos.push(x);
      lt.sel = { tipo: "el", i: atual.config.elementos.length - 1 };
      return mudou();
    }
    if (acao === "mover" && lt.sel) {
      const i = lt.sel.i;
      const j = i + Number(botao.dataset.passo);
      if (j < 0 || j >= atual.clips.length) return;
      guardar();
      const ancoras = ancorar();
      [atual.clips[i], atual.clips[j]] = [atual.clips[j], atual.clips[i]];
      reaplicar(ancoras);
      lt.sel = { tipo: "clip", i: j };
      return mudou();
    }
    if (acao === "dividir" && lt.sel) {
      const k = lt.sel.i;
      const inis = iniciosDosClipes(atual.clips);
      const dentro = lt.cursor - inis[k];
      if (!atual.clips[k] || dentro <= 0.15 || dentro >= durClipe(atual.clips[k]) - 0.15) {
        return P.toast("Ponha o cursor (linha vermelha) no meio deste clipe para dividir: clique na régua.", "erro");
      }
      guardar();
      const x = atual.clips[k];
      const corte = fix(n(x.inicio) + dentro);
      const fimOriginal = x.fim != null && x.fim !== "" ? x.fim : (x.duracao || null);
      atual.clips.splice(k + 1, 0, Object.assign({}, x, { id: novoId(), inicio: corte, fim: fimOriginal }));
      x.fim = corte;
      lt.sel = { tipo: "clip", i: k + 1 };
      return mudou();
    }
  }

  async function apagarSelecionado() {
    const s = lt.sel;
    if (!s || travado()) return;
    if (s.tipo === "musica") { lt.sel = null; return tirarMusica(); }
    if (s.tipo === "hook") return;
    guardar();
    const c = atual.config;
    if (s.tipo === "el") c.elementos.splice(s.i, 1);
    else if (s.tipo === "efeito") (c.efeitos || []).splice(s.i, 1);
    else if (s.tipo === "leg") c.legendas.splice(s.i, 1);
    else if (s.tipo === "frase") {
      const f = frasesDe(c.palavras)[s.i];
      if (f) c.palavras.splice(f.de, f.ate - f.de + 1);
    } else if (s.tipo === "clip") {
      const x = atual.clips[s.i];
      if (!x) return;
      // arquivo enviado pelo painel: só apaga do Supabase se nenhum outro pedaço usa o mesmo arquivo
      const usadoEmOutro = atual.clips.some((y) => y !== x && y.caminho && y.caminho === x.caminho);
      if (x.origem !== "drive" && !x.apagado && x.caminho && !usadoEmOutro) {
        if (!confirm(`Tirar "${x.nome}" do vídeo e apagar o arquivo do Supabase? Isso não dá para desfazer.`)) { lt.historico.pop(); return; }
        const erro = await apagarArquivos(caminhosDe(x));
        if (erro) { lt.historico.pop(); return P.toast(erro, "erro"); }
        lt.historico = [];
      }
      const ancoras = ancorar();
      atual.clips.splice(s.i, 1);
      reaplicar(ancoras);
    }
    lt.sel = null;
    mudou();
  }

  // Campos do painel de baixo (o "inspetor"): cada mudança vale na hora
  function aplicarInspetor(alvo) {
    const s = lt.sel;
    const k = alvo.dataset.campo;
    if (!s || !k || travado()) return;
    guardar();
    const c = atual.config;
    const v = alvo.value;
    const num = Math.max(0, n(v));
    const tempos = (obj) => {
      obj[k] = fix(num);
      if (n(obj.fim) <= n(obj.inicio)) obj.fim = fix(n(obj.inicio) + 1);
    };
    if (s.tipo === "el" && c.elementos[s.i]) {
      const x = c.elementos[s.i];
      if (k === "inicio" || k === "fim") tempos(x); else x[k] = v.trim().replace(/^["“]|["”]$/g, "");
    } else if (s.tipo === "leg" && c.legendas[s.i]) {
      const l = c.legendas[s.i];
      if (k === "inicio" || k === "fim") tempos(l); else l[k] = v.trim();
    } else if (s.tipo === "efeito" && c.efeitos && c.efeitos[s.i]) {
      c.efeitos[s.i][k] = k === "tipo" ? v : fix(k === "volume" ? Math.min(100, num) : num);
    } else if (s.tipo === "hook") c.hook = v.trim();
    else if (s.tipo === "musica" && c.musica) {
      c.musica = Object.assign({}, c.musica, { [k]: k === "volume" ? Math.min(100, num) : fix(num) });
    } else if (s.tipo === "frase") {
      const f = frasesDe(c.palavras)[s.i];
      if (!f) return;
      if (k === "texto") {
        const novas = v.trim().split(/\s+/).filter(Boolean);
        if (!novas.length) { lt.historico.pop(); return; }
        const antigas = c.palavras.slice(f.de, f.ate + 1);
        const passo = (f.fim - f.inicio) / novas.length;
        c.palavras.splice(f.de, antigas.length, ...novas.map((texto, j) => (novas.length === antigas.length
          ? { texto, inicio: antigas[j].inicio, fim: antigas[j].fim }
          : { texto, inicio: fix(f.inicio + j * passo), fim: fix(f.inicio + (j + 1) * passo) })));
      } else {
        const ini = k === "inicio" ? num : f.inicio;
        const fim = k === "fim" ? num : f.fim;
        reescalarFrase(f, ini, Math.max(ini + 0.15, fim));
      }
    } else if (s.tipo === "clip" && atual.clips[s.i]) {
      const ancoras = ancorar();
      const x = atual.clips[s.i];
      if (k === "zoom") x.zoom = n(v);
      else if (k === "inicio") {
        const fimSrc = n(x.inicio) + durClipe(x);
        x.inicio = fix(Math.min(num, fimSrc - 0.2));
        if (x.fim == null || x.fim === "") x.fim = fix(fimSrc);
      } else if (k === "fim") x.fim = fix(Math.max(n(x.inicio) + 0.2, x.duracao ? Math.min(num, n(x.duracao)) : num));
      reaplicar(ancoras);
    }
    mudou();
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
