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

  const MODELOS = { airlearn: "Airlearn", ugctech: "UGC tech" };
  const SITUACAO = {
    rascunho: ["Montando", "cinza"],
    legendar: ["Legenda na fila", "amarelo"],
    legendando: ["Gerando legenda", "ciano"],
    renderizar: ["4K na fila", "amarelo"],
    renderizando: ["Gerando 4K", "ciano"],
    pronto: ["Pronto", "verde"],
    erro: ["Deu erro", "vermelho"]
  };
  const NA_FILA = ["legendar", "renderizar"];
  const TRABALHANDO = ["legendando", "renderizando"];

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
      config: Object.assign({
        hook: "", legendas: [], idioma: "",
        corMarca: "#F5D547", palavrasPorVez: 1, palavrasNaCor: [], palavras: [],
        hookLinhas: [], hookAte: 2.5, destaques: [], marca: null,
        checklist: null, cta: null, flashes: [], apagarBrutos: true
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
          <div class="numero-sub">${fila ? "rode o renderizar.cmd" : "nada na fila"}</div></div>
      </div>
      <div class="ferramentas">
        <p class="mudo pequeno" style="flex:1 1 260px;min-width:0">
          Os clipes sobem sem perder qualidade. A legenda e o vídeo final em 4K são feitos no seu computador
          quando você roda o <b>renderizar.cmd</b> (pasta meu-video).
        </p>
        <div class="grupo-botoes empurra">
          <button class="botao botao-principal" type="button" data-acao="novo">${P.icone("mais", "ico-p")}Novo vídeo</button>
        </div>
      </div>
      <div class="cartao">
        ${lista.length ? `<ul class="lista-simples">${lista.map((e) => {
          const [txt, cor] = SITUACAO[e.status] || SITUACAO.rascunho;
          const n = (Array.isArray(e.clips) ? e.clips : []).length;
          return `<li class="ed-linha" data-abrir="${P.esc(e.id)}" tabindex="0">
            <div class="cresce"><b>${P.esc(e.titulo)}</b>
              <div class="mudo pequeno">${MODELOS[e.modelo] || e.modelo} · ${P.plural(n, "clipe", "clipes")} · mexido em ${P.dataBR(e.atualizado_em)}</div></div>
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
          <span class="campo-ajuda">${e.modelo === "airlearn" ? "Só para vídeos da Airlearn: hook do Snapchat e legenda dupla." : "Legenda palavra a palavra, hook grande, marca e CTA."}</span></div>
      </div></div>

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

      ${e.modelo === "ugctech" ? `<div class="cartao bloco"><div class="cartao-topo"><h2>Visual</h2></div>
        <div class="cartao-corpo">${camposVisual(c)}</div></div>` : ""}

      <div class="cartao bloco">
        <div class="cartao-topo"><h2>Vídeo final em 4K</h2>
          <button class="botao botao-principal" type="button" data-acao="pedir-render"${!temClipes || ocupado ? " disabled" : ""}>${P.icone("play", "ico-p")}Gerar vídeo 4K</button></div>
        <div class="cartao-corpo">
          <label class="campo campo-marcar"><input type="checkbox" id="ed-apagar-brutos"${c.apagarBrutos ? " checked" : ""}>
            Apagar os clipes brutos depois que o 4K ficar pronto (libera espaço no Supabase)</label>
          ${e.final ? `<div class="ed-final">
            <p><b>Pronto em ${new Date(e.final.gerado_em).toLocaleString("pt-BR")}</b>
              <span class="mudo">· ${P.esc(e.final.largura)}×${P.esc(e.final.altura)} · ${seg(e.final.duracao)} · ${tamanho(e.final.tamanho)}</span></p>
            <div class="grupo-botoes">
              <button class="botao" type="button" data-acao="assistir">${P.icone("play", "ico-p")}Assistir</button>
              <button class="botao" type="button" data-acao="baixar">${P.icone("baixar", "ico-p")}Baixar MP4</button>
              <button class="botao botao-perigo" type="button" data-acao="apagar-final">${P.icone("lixo", "ico-p")}Apagar o 4K</button>
            </div>
            <div id="ed-player"></div>
          </div>` : `<p class="mudo pequeno">Ainda não foi gerado.</p>`}
        </div>
      </div>`;

    if (TRABALHANDO.includes(e.status) || NA_FILA.includes(e.status)) ligarRelogio();
  }

  function faixaDeStatus(e) {
    const msg = P.esc(e.mensagem || "");
    if (e.status === "erro") return `<div class="aviso-banco">${P.icone("alerta")}<div><b>Deu erro no seu computador.</b> ${msg}<br>
      <button class="botao" type="button" data-acao="limpar-erro" style="margin-top:6px">Entendi, voltar a editar</button></div></div>`;
    if (NA_FILA.includes(e.status)) return `<div class="ed-faixa">${P.icone("relogio")}<div>
      <b>Na fila.</b> Agora dê dois cliques no <b>renderizar.cmd</b> (pasta meu-video) para o seu computador fazer o trabalho.
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
        <div class="mudo pequeno">${tamanho(x.tamanho)}${x.duracao ? " · " + seg(x.duracao) : ""}${x.partes > 1 ? ` · ${x.partes} pedaços` : ""}
          ${x.apagado ? ` · ${P.pilula("bruto apagado", "cinza")}` : ""}</div></div>
      <label class="ed-tempo">início <input type="text" inputmode="decimal" data-tempo="inicio" value="${x.inicio ?? ""}" placeholder="0"${bloqueio}></label>
      <label class="ed-tempo">fim <input type="text" inputmode="decimal" data-tempo="fim" value="${x.fim ?? ""}" placeholder="${x.duracao ? P.num(x.duracao).toFixed(1) : "fim"}"${bloqueio}></label>
      <div class="grupo-botoes">
        <button class="botao botao-icone" type="button" data-mover="-1" aria-label="Subir"${i === 0 || ocupado ? " disabled" : ""}>${P.icone("subir", "ico-p")}</button>
        <button class="botao botao-icone" type="button" data-mover="1" aria-label="Descer"${i === total - 1 || ocupado ? " disabled" : ""}>${P.icone("baixar", "ico-p")}</button>
        <button class="botao botao-icone" type="button" data-acao="ver-clipe" aria-label="Assistir"${x.apagado ? " disabled" : ""}>${P.icone("olho", "ico-p")}</button>
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
        <select id="ed-por-vez">${[[1, "1 (palavra a palavra)"], [2, "2"], [3, "3"], [5, "5 (frase curta)"]]
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

  function camposVisual(c) {
    const linhas = (arr, fmt) => arr.map(fmt).join("\n");
    return `<div class="grade-campos">
      <div class="campo"><label for="ed-cor">Cor da marca</label>
        <input id="ed-cor" type="color" value="${P.esc(c.corMarca)}"></div>
      <div class="campo"><label for="ed-hook-ate">Hook some em (segundos)</label>
        <input id="ed-hook-ate" type="text" inputmode="decimal" value="${P.esc(c.hookAte)}"></div>
      <div class="campo largo"><label for="ed-hook-linhas">Hook grande (uma linha por linha; a última fica na cor da marca)</label>
        <textarea id="ed-hook-linhas" rows="3" placeholder="Eu parei de&#10;colocar link&#10;na bio">${P.esc(c.hookLinhas.join("\n"))}</textarea></div>
      <div class="campo"><label for="ed-marca">Nome da marca (etiqueta no topo)</label>
        <input id="ed-marca" value="${P.esc(c.marca ? c.marca.nome : "")}" placeholder="HostGator"></div>
      <div class="campo"><label for="ed-marca-tempo">Aparece de / até (segundos)</label>
        <input id="ed-marca-tempo" value="${c.marca ? `${c.marca.inicio} - ${c.marca.fim}` : ""}" placeholder="3 - 5,5"></div>
      <div class="campo largo"><label for="ed-destaques">Palavras gigantes (texto | de | até)</label>
        <textarea id="ed-destaques" rows="3" placeholder="PROFISSIONAL | 6,4 | 7,6">${P.esc(linhas(c.destaques, (d) => `${d.texto} | ${d.inicio} | ${d.fim}`))}</textarea></div>
      <div class="campo largo"><label for="ed-checklist">Checklist que vai crescendo (texto | aparece em)</label>
        <textarea id="ed-checklist" rows="3" placeholder="Portfólio | 8&#10;Contatos | 8,5">${P.esc(c.checklist ? linhas(c.checklist.itens, (it) => `${it.texto} | ${it.inicio}`) : "")}</textarea></div>
      <div class="campo"><label for="ed-check-ate">Checklist some em (segundos)</label>
        <input id="ed-check-ate" type="text" inputmode="decimal" value="${c.checklist ? P.esc(c.checklist.ate) : ""}"></div>
      <div class="campo"><label for="ed-flashes">Flash de luz em (segundos)</label>
        <input id="ed-flashes" value="${P.esc(c.flashes.join(", "))}" placeholder="3, 8"></div>
      <div class="campo"><label for="ed-cta">CTA: Comente "…"</label>
        <input id="ed-cta" value="${P.esc(c.cta ? c.cta.palavra : "")}" placeholder="LINK"></div>
      <div class="campo"><label for="ed-cta-inicio">CTA aparece em (segundos)</label>
        <input id="ed-cta-inicio" type="text" inputmode="decimal" value="${c.cta ? P.esc(c.cta.inicio) : ""}"></div>
    </div>`;
  }

  /* =========================================================
     LER O QUE ESTÁ NA TELA
     ========================================================= */
  const n = (t) => P.num(String(t == null ? "" : t).replace(",", "."));
  const vazio = (t) => String(t == null ? "" : t).trim() === "";
  const partes = (linha) => linha.split("|").map((s) => s.trim());

  function lerTela() {
    const e = atual;
    const c = Object.assign({}, e.config);
    const v = (id) => { const el = P.$("#" + id, secao); return el ? el.value : undefined; };

    c.idioma = v("ed-idioma") || "";
    c.apagarBrutos = !!(P.$("#ed-apagar-brutos", secao) || {}).checked;

    if (e.modelo === "airlearn") {
      c.hook = (v("ed-hook") || "").trim();
      c.legendas = P.$$("#ed-legendas tr", secao).map((tr) => ({
        inicio: n(P.$("[data-l=inicio]", tr).value),
        fim: n(P.$("[data-l=fim]", tr).value),
        falada: P.$("[data-l=falada]", tr).value.trim(),
        ingles: P.$("[data-l=ingles]", tr).value.trim()
      }));
    } else {
      c.palavrasPorVez = n(v("ed-por-vez")) || 1;
      c.palavrasNaCor = (v("ed-na-cor") || "").split(",").map((s) => s.trim()).filter(Boolean);
      P.$$("[data-palavra]", secao).forEach((inp) => {
        const p = c.palavras[Number(inp.dataset.palavra)];
        if (p) p.texto = inp.value.trim() || p.texto;
      });
      c.corMarca = v("ed-cor") || c.corMarca;
      c.hookLinhas = (v("ed-hook-linhas") || "").split("\n").map((s) => s.trim()).filter(Boolean);
      c.hookAte = n(v("ed-hook-ate")) || 2.5;
      const nomeMarca = (v("ed-marca") || "").trim();
      const [mi, mf] = (v("ed-marca-tempo") || "").split(/\s*-\s*/);
      c.marca = nomeMarca ? { nome: nomeMarca, inicio: n(mi), fim: vazio(mf) ? n(mi) + 2.5 : n(mf) } : null;
      c.destaques = (v("ed-destaques") || "").split("\n").map(partes).filter((p) => p[0])
        .map(([texto, ini, fim]) => ({ texto, inicio: n(ini), fim: vazio(fim) ? n(ini) + 1.2 : n(fim) }));
      const itens = (v("ed-checklist") || "").split("\n").map(partes).filter((p) => p[0])
        .map(([texto, ini]) => ({ texto, inicio: n(ini) }));
      c.checklist = itens.length ? { itens, ate: n(v("ed-check-ate")) || itens[itens.length - 1].inicio + 1.5 } : null;
      // "3; 8,5" ou "3, 8,5": separa por ponto e vírgula, espaço ou vírgula seguida de espaço
      c.flashes = (v("ed-flashes") || "").split(/\s*;\s*|,\s+|\s+/).filter(Boolean).map(n);
      const palavraCta = (v("ed-cta") || "").trim();
      c.cta = palavraCta ? { palavra: palavraCta.replace(/^["“]|["”]$/g, ""), inicio: n(v("ed-cta-inicio")) } : null;
    }

    // Tempos dos clipes
    const clips = e.clips.map((x) => {
      const li = P.$(`[data-clip="${CSS.escape(x.id)}"]`, secao);
      if (!li) return x;
      const ini = P.$("[data-tempo=inicio]", li).value;
      const fim = P.$("[data-tempo=fim]", li).value;
      return Object.assign({}, x, { inicio: vazio(ini) ? null : n(ini), fim: vazio(fim) ? null : n(fim) });
    });

    return { titulo: (v("ed-titulo") || "").trim() || "Vídeo sem nome", modelo: v("ed-modelo") || e.modelo, config: c, clips };
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
      for (let i = 0; i < qtd; i++) {
        const pedaco = arquivo.slice(i * PEDACO, Math.min(arquivo.size, (i + 1) * PEDACO));
        if (caixa()) caixa().innerHTML = `<div class="ed-envio">Enviando <b>${P.esc(arquivo.name)}</b> · pedaço ${i + 1} de ${qtd}
          <div class="progresso"><span style="width:${Math.round(((mandados + i * PEDACO) / total) * 100)}%"></span></div></div>`;
        let erro = null;
        for (let tentativa = 0; tentativa < 3; tentativa++) {
          const r = await banco.storage.from(BALDE).upload(`${caminho}/parte-${String(i).padStart(3, "0")}`, pedaco,
            { upsert: true, contentType: "application/octet-stream", cacheControl: "3600" });
          erro = r.error;
          if (!erro) break;
        }
        if (erro) {
          await apagarArquivos(Array.from({ length: i }, (_, k) => `${caminho}/parte-${String(k).padStart(3, "0")}`));
          P.toast(`Não consegui enviar ${arquivo.name}: ${P.explicarErro(erro, "balde edicao")}`, "erro");
          enviando = false;
          return desenharEditor();
        }
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
  }

  function aoMudar(ev) {
    if (ev.target.id === "ed-arquivos") {
      const arquivos = Array.from(ev.target.files || []);
      ev.target.value = "";
      enviarClipes(arquivos);
    }
    if (ev.target.id === "ed-modelo") {
      absorver();
      desenharEditor();
    }
  }

  function criar() {
    P.formulario({
      titulo: "Novo vídeo",
      valores: { modelo: "ugctech" },
      campos: [
        { nome: "titulo", rotulo: "Nome do vídeo", tipo: "texto", obrigatorio: true, largo: true, ajuda: "Ex.: Airlearn turco 03 ou HostGator site" },
        { nome: "modelo", rotulo: "Modelo", tipo: "escolha", largo: true, opcoes: Object.entries(MODELOS) }
      ],
      textoSalvar: "Criar",
      aoSalvar: async (v) => {
        try {
          const { data, error } = await banco.from(TABELA).insert({ titulo: v.titulo, modelo: v.modelo }).select().single();
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
      const mudou = novo.status !== atual.status || novo.progresso !== atual.progresso || novo.mensagem !== atual.mensagem;
      if (mudou) {
        const terminou = !NA_FILA.includes(novo.status) && !TRABALHANDO.includes(novo.status);
        atual = normalizar(novo);
        desenharEditor();
        if (terminou) {
          pararRelogio();
          if (novo.status === "pronto") P.toast("Vídeo 4K pronto!");
        }
      }
    }, 4000);
  }
  function pararRelogio() { if (relogio) { clearInterval(relogio); relogio = null; } }
})();
