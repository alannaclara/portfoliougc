/* =========================================================
   ABA TRANSCRIÇÕES
   Cola o link de um reel, de um TikTok ou de um YouTube e o
   serviço da Supadata devolve a fala do vídeo em texto.
   Tudo fica guardado na tabela transcricoes, com etiqueta
   separando os seus vídeos dos vídeos de outras creators.

   A sua chave da Supadata NÃO fica neste arquivo. Ela fica
   gravada na tabela configuracoes do banco, que só você lê.
   ========================================================= */
(function () {
  "use strict";
  const P = window.Painel;

  const TABELA = "transcricoes";
  const TABELA_CONFIG = "configuracoes";
  const NOME_DA_CHAVE = "supadata_api_key";
  const API = "https://api.supadata.ai/v1";
  const ESPERA_MAXIMA = 6 * 60 * 1000;   // 6 minutos
  const PASSO = 5000;                    // consulta o serviço de 5 em 5 segundos

  const FONTES = {
    instagram: "Instagram",
    tiktok: "TikTok",
    youtube: "YouTube",
    manual: "Escrito na mão"
  };

  let secao = null;
  let itens = [];
  let chave = "";
  let busca = "";
  let filtro = "todos";
  let trabalhando = false;
  let contador = null;   // o relógio do "Ouvindo o vídeo… 45s"

  /* =========================================================
     LINKS: limpar, descobrir de onde é, descobrir o @ e o embed
     ========================================================= */

  // Tira o lixo do link copiado do aplicativo e arruma /reels/ para /reel/
  function limparLink(bruto) {
    let t = String(bruto || "").trim();
    if (!t) return "";
    if (!/^https?:\/\//i.test(t) && /^[\w-]+(\.[\w-]+)+\//.test(t)) t = "https://" + t;
    let u;
    try { u = new URL(t); } catch (e) { return t; }
    u.hash = "";
    const lixo = ["igsh", "igshid", "si", "fbclid", "gclid", "mibextid", "_r", "_t", "is_from_webapp", "sender_device", "web_id", "feature", "pp"];
    Array.from(u.searchParams.keys()).forEach((k) => {
      const nome = k.toLowerCase();
      if (nome.startsWith("utm_") || lixo.includes(nome)) u.searchParams.delete(k);
    });
    if (/instagram\.com$/i.test(u.hostname.replace(/^www\./i, ""))) {
      u.pathname = u.pathname.replace(/\/reels\//i, "/reel/");
    }
    return u.toString().replace(/\?$/, "");
  }

  function fonteDoLink(url) {
    const t = String(url || "").toLowerCase();
    if (t.includes("instagram.com")) return "instagram";
    if (t.includes("tiktok.com")) return "tiktok";
    if (t.includes("youtube.com") || t.includes("youtu.be")) return "youtube";
    return "manual";
  }

  // O @ do perfil só existe dentro do link em dois casos.
  // Instagram: instagram.com/<perfil>/reel/<id>   TikTok: tiktok.com/@<perfil>/...
  function perfilDoLink(url) {
    const t = String(url || "");
    let m = t.match(/tiktok\.com\/@([\w.\-]+)/i);
    if (m) return "@" + m[1];
    m = t.match(/instagram\.com\/([A-Za-z0-9._]+)\/(?:reel|reels|p|tv)\//i);
    if (m && !/^(reel|reels|p|tv|explore|stories)$/i.test(m[1])) return "@" + m[1];
    return "";
  }

  // O endereço do vídeo para tocar dentro do card. Só carrega quando você clica.
  function embedDe(item) {
    const url = String((item && item.url) || "");
    const fonte = (item && item.fonte) || fonteDoLink(url);
    let m;
    if (fonte === "instagram") {
      m = url.match(/instagram\.com\/(?:[A-Za-z0-9._]+\/)?(?:reel|reels|p|tv)\/([A-Za-z0-9_-]+)/i);
      return m ? `https://www.instagram.com/reel/${m[1]}/embed` : "";
    }
    if (fonte === "youtube") {
      m = url.match(/(?:shorts\/|[?&]v=|youtu\.be\/|embed\/|live\/)([\w-]{11})/);
      return m ? `https://www.youtube.com/embed/${m[1]}` : "";
    }
    if (fonte === "tiktok") {
      m = url.match(/(?:\/video\/|\/v\/|\/photo\/|item_id=)(\d{6,})/);
      return m ? `https://www.tiktok.com/embed/v2/${m[1]}` : "";
    }
    return "";
  }

  /* =========================================================
     O SERVIÇO DE TRANSCRIÇÃO (Supadata)
     ========================================================= */

  async function pedir(caminho) {
    const resposta = await fetch(API + caminho, { headers: { "x-api-key": chave } });
    let corpo = null;
    try { corpo = await resposta.json(); } catch (e) { corpo = null; }
    return { resposta, corpo };
  }

  // Traduz o erro do serviço para uma frase que dá para entender
  function explicarSupadata(resposta, corpo) {
    const codigo = String((corpo && (corpo.error || corpo.code)) || "").toLowerCase();
    const detalhe = String((corpo && (corpo.details || corpo.message)) || "").toLowerCase();
    const status = resposta ? resposta.status : 0;

    if (status === 401 || status === 403 || codigo.includes("api-key") || codigo.includes("unauthorized") || codigo.includes("forbidden")) {
      return "A sua chave da Supadata não foi aceita. Confira se você colou ela inteira, sem espaço sobrando, no campo aqui de cima.";
    }
    if (codigo.includes("limit")) {
      // O mesmo código serve para dois casos bem diferentes. Só o detalhe separa.
      if (detalhe.includes("rate") || detalhe.includes("per minute") || detalhe.includes("too many")) {
        return "Você pediu muitas transcrições seguidas. Espere 1 minuto e clique em Transcrever de novo.";
      }
      return "Acabaram os seus créditos do mês na Supadata. Eles voltam no começo do mês que vem, ou você pode aumentar o plano no site deles.";
    }
    if (codigo.includes("transcript-unavailable") || codigo.includes("no-transcript")) {
      return "Não achei fala nesse vídeo. Costuma ser reel só com música ou só com texto na tela.";
    }
    if (codigo.includes("not-found") || status === 404) {
      return "Não achei esse vídeo. Confira se o link está certo e se o perfil não é fechado.";
    }
    if (codigo.includes("invalid") || status === 400) {
      return "Esse link não serve. Use o link de um reel do Instagram, de um vídeo do TikTok ou do YouTube.";
    }
    if (status >= 500) {
      return "O serviço de transcrição está fora do ar agora. Tente de novo daqui a pouco.";
    }
    return "Não consegui transcrever esse vídeo agora. Tente de novo daqui a pouco.";
  }

  // Aceita os dois formatos: texto direto ou lista de trechos
  function lerConteudo(corpo) {
    if (!corpo) return { erro: "O serviço respondeu de um jeito que eu não entendi. Tente de novo." };
    if (corpo.error) return { erro: explicarSupadata(null, corpo) };
    const bruto = corpo.content;
    const segmentos = Array.isArray(bruto) ? bruto : null;
    let texto = "";
    if (typeof bruto === "string") texto = bruto.trim();
    else if (Array.isArray(bruto)) texto = bruto.map((s) => String((s && s.text) || "")).join(" ").replace(/\s+/g, " ").trim();
    const semFala = !texto || String(corpo.lang || "").toLowerCase() === "none";
    return { texto, segmentos, vazio: semFala };
  }

  const dormir = (ms) => new Promise((r) => setTimeout(r, ms));

  // Vídeo longo: o serviço devolve um jobId e a gente fica perguntando se já ficou pronto
  async function esperarJob(jobId) {
    const limite = Date.now() + ESPERA_MAXIMA;
    while (Date.now() < limite) {
      await dormir(PASSO);
      let r;
      try { r = await pedir("/transcript/" + encodeURIComponent(jobId)); }
      catch (e) { return { erro: "Perdi a conexão no meio da transcrição. Confira sua internet e tente de novo." }; }
      const estado = String((r.corpo && r.corpo.status) || "").toLowerCase();
      if (estado === "completed") return lerConteudo(r.corpo);
      if (estado === "failed") return { erro: explicarSupadata(r.resposta, r.corpo) };
      if (!r.resposta.ok && estado !== "queued" && estado !== "active" && estado !== "processing") {
        return { erro: explicarSupadata(r.resposta, r.corpo) };
      }
    }
    return { erro: "Esse vídeo está demorando demais (passou de 6 minutos). Tente de novo daqui a pouco ou escreva o texto na mão." };
  }

  async function buscarTranscricao(url) {
    // mode=auto e lang=pt são obrigatórios: sem eles reel volta vazio ou traduzido
    const params = new URLSearchParams({ url, mode: "auto", text: "true", lang: "pt" });
    let r;
    try { r = await pedir("/transcript?" + params.toString()); }
    catch (e) { return { erro: "Não consegui falar com o serviço de transcrição. Confira sua internet e tente de novo." }; }
    if (r.resposta.status === 202 && r.corpo && r.corpo.jobId) return await esperarJob(r.corpo.jobId);
    if (r.corpo && r.corpo.error) return { erro: explicarSupadata(r.resposta, r.corpo) };
    if (!r.resposta.ok) return { erro: explicarSupadata(r.resposta, r.corpo) };
    return lerConteudo(r.corpo);
  }

  /* =========================================================
     A CHAVE E O SALDO
     ========================================================= */

  const fimDaChave = (k) => (String(k || "").length > 4 ? "••••" + String(k).slice(-4) : "");

  async function carregarChave() {
    try {
      const { data, error } = await banco.from(TABELA_CONFIG).select("valor").eq("chave", NOME_DA_CHAVE).maybeSingle();
      if (error) return { erro: erroTabela(error, TABELA_CONFIG) };
      chave = (data && data.valor) || "";
      return { erro: null };
    } catch (e) {
      return { erro: erroTabela(e, TABELA_CONFIG) };
    }
  }

  async function salvarChave(nova) {
    try {
      const { error } = await banco.from(TABELA_CONFIG).upsert({ chave: NOME_DA_CHAVE, valor: nova, updated_at: new Date().toISOString() });
      if (error) return erroTabela(error, TABELA_CONFIG);
      chave = nova;
      return null;
    } catch (e) {
      return erroTabela(e, TABELA_CONFIG);
    }
  }

  async function mostrarSaldo() {
    const alvo = P.$("#tr-saldo", secao);
    if (!alvo) return;
    if (!chave) { alvo.textContent = ""; return; }
    alvo.textContent = "Conferindo o saldo...";
    try {
      const { resposta, corpo } = await pedir("/me");
      if (!resposta.ok || !corpo) { alvo.textContent = explicarSupadata(resposta, corpo); return; }
      const usados = P.num(corpo.usedCredits);
      const total = P.num(corpo.maxCredits);
      const plano = corpo.plan ? ` · plano ${corpo.plan}` : "";
      alvo.textContent = `${P.inteiro(usados)} de ${P.inteiro(total)} créditos usados${plano}`;
    } catch (e) {
      alvo.textContent = "Não consegui conferir o saldo agora.";
    }
  }

  /* =========================================================
     BANCO
     ========================================================= */

  const erroTabela = (e, tabela) => P.explicarErro(e, tabela || TABELA).replace(/banco\.sql/g, "sql-transcricoes.sql");

  async function lerTudo() {
    try {
      const { data, error } = await banco.from(TABELA).select("*").order("created_at", { ascending: false });
      if (error) return { dados: [], erro: erroTabela(error) };
      return { dados: Array.isArray(data) ? data : [], erro: null };
    } catch (e) {
      return { dados: [], erro: erroTabela(e) };
    }
  }

  async function inserir(valores) {
    try {
      const { data, error } = await banco.from(TABELA).insert(valores).select().single();
      if (error) return { erro: erroTabela(error) };
      return { linha: data, erro: null };
    } catch (e) {
      return { erro: erroTabela(e) };
    }
  }

  async function atualizar(id, valores) {
    try {
      const { error } = await banco.from(TABELA).update({ ...valores, updated_at: new Date().toISOString() }).eq("id", id);
      if (error) return erroTabela(error);
      return null;
    } catch (e) {
      return erroTabela(e);
    }
  }

  /* =========================================================
     A TELA
     ========================================================= */

  P.abas.transcricao = {
    async iniciar(s) {
      secao = s;
      s.innerHTML = `
        <div class="avisos"></div>

        <div class="tr-capa">
          <div class="tr-capa-texto">
            <span class="tr-selo" aria-hidden="true">${P.icone("legenda")}</span>
            <h2>Transcrições</h2>
            <p>Cole o link de um reel e eu transcrevo. Serve pros seus e pros das outras, com etiqueta pra você separar.</p>
          </div>
        </div>

        <div class="tr-linha">
          <label class="tr-campo-link">
            <span class="sr">Link do vídeo</span>
            <input type="url" id="tr-link" placeholder="Cole aqui: instagram.com/reel/... · tiktok.com/... · youtube.com/...">
          </label>
          <label class="sr" for="tr-dequem">De quem é o vídeo</label>
          <select class="selecao" id="tr-dequem">
            <option value="outra">De outra pessoa</option>
            <option value="minha">Meu</option>
          </select>
          <button class="botao botao-principal" type="button" id="tr-transcrever">${P.icone("legenda", "ico-p")}Transcrever</button>
          <button class="botao" type="button" id="tr-manual">${P.icone("mais", "ico-p")}Escrever na mão</button>
        </div>

        <div class="tr-aviso" id="tr-aviso" aria-live="polite"></div>

        <details class="tr-config" id="tr-config">
          <summary>${P.icone("chave", "ico-p")}<b>Chave da Supadata</b><span class="mudo pequeno" id="tr-chave-resumo"></span></summary>
          <div class="tr-config-corpo">
            <div class="tr-config-linha">
              <label class="tr-campo-link">
                <span class="sr">Chave da Supadata</span>
                <input type="password" id="tr-chave" placeholder="Cole aqui a sua chave" autocomplete="off" spellcheck="false">
              </label>
              <button class="botao botao-principal" type="button" id="tr-salvar-chave">${P.icone("check", "ico-p")}Salvar chave</button>
              <button class="botao" type="button" id="tr-ver-saldo">${P.icone("recarregar", "ico-p")}Ver saldo</button>
            </div>
            <p class="mudo pequeno" id="tr-saldo"></p>
            <p class="mudo pequeno">A chave fica guardada no seu banco, não neste computador. Assim ela funciona em qualquer lugar que você entrar no painel. Para conseguir uma: crie uma conta grátis em <a class="link-tabela" href="https://supadata.ai" target="_blank" rel="noopener">supadata.ai</a> (100 créditos por mês, sem cartão), copie a API key e cole aqui.</p>
          </div>
        </details>

        <div class="ferramentas">
          <label class="busca"><span class="sr">Buscar</span>${P.icone("busca", "ico-p")}<input type="search" id="tr-busca" placeholder="Buscar na transcrição, no perfil, no título ou nas notas"></label>
          <div class="filtros" id="tr-filtros" role="group" aria-label="Filtrar a biblioteca"></div>
          <div class="grupo-botoes empurra">
            <button class="botao" type="button" id="tr-estudar">${P.icone("estrela", "ico-p")}Estudar com o Claude</button>
          </div>
        </div>

        <div id="tr-lista"><p class="carregando">Carregando...</p></div>`;

      P.$("#tr-transcrever", s).addEventListener("click", () => transcrever());
      P.$("#tr-link", s).addEventListener("keydown", (e) => { if (e.key === "Enter") { e.preventDefault(); transcrever(); } });
      P.$("#tr-manual", s).addEventListener("click", () => abrirEdicao(null));
      P.$("#tr-salvar-chave", s).addEventListener("click", aoSalvarChave);
      P.$("#tr-ver-saldo", s).addEventListener("click", mostrarSaldo);
      P.$("#tr-busca", s).addEventListener("input", (e) => { busca = e.target.value.trim().toLowerCase(); desenharLista(); });
      P.$("#tr-filtros", s).addEventListener("click", (e) => {
        const b = e.target.closest("[data-filtro]");
        if (!b) return;
        filtro = b.dataset.filtro;
        desenharLista();
      });
      P.$("#tr-estudar", s).addEventListener("click", estudarComOClaude);
      P.$("#tr-lista", s).addEventListener("click", aoClicarNaLista);
      P.$("#tr-aviso", s).addEventListener("click", aoClicarNoAviso);

      await carregar();
    },
    async aoMostrar() { if (!trabalhando) await carregar(); }
  };

  async function carregar() {
    const avisos = P.$(".avisos", secao);
    P.limparAvisos(avisos);
    const [rc, rt] = await Promise.all([carregarChave(), lerTudo()]);
    if (rc.erro) P.avisar(avisos, rc.erro);
    if (rt.erro) P.avisar(avisos, rt.erro);
    itens = rt.dados;
    P.$("#tr-chave-resumo", secao).textContent = chave ? `guardada, termina em ${fimDaChave(chave)}` : "ainda não salva";
    if (!chave) P.$("#tr-config", secao).open = true;
    desenharLista();
    if (chave) mostrarSaldo();
  }

  /* ---------- A chave ---------- */
  async function aoSalvarChave() {
    const campo = P.$("#tr-chave", secao);
    const nova = campo.value.trim();
    if (!nova) { avisar("erro", "Cole a chave antes de salvar."); return; }
    const botao = P.$("#tr-salvar-chave", secao);
    botao.disabled = true;
    const erro = await salvarChave(nova);
    botao.disabled = false;
    if (erro) { avisar("erro", erro); return; }
    campo.value = "";
    P.$("#tr-chave-resumo", secao).textContent = `guardada, termina em ${fimDaChave(chave)}`;
    P.toast("Chave salva. Agora dá para transcrever.");
    avisar("ok", "✅ Chave salva. Pode colar um link e clicar em Transcrever.");
    mostrarSaldo();
  }

  /* ---------- A faixa de aviso e andamento ---------- */
  function avisar(tipo, html) {
    const alvo = P.$("#tr-aviso", secao);
    if (!alvo) return;
    alvo.className = "tr-aviso tr-aviso-" + (tipo || "info");
    alvo.innerHTML = html || "";
    alvo.hidden = !html;
  }
  function limparAviso() { avisar("info", ""); }

  function comoConseguirChave() {
    avisar("info", `<b>Falta a sua chave da Supadata.</b>
      <p>É de graça e leva dois minutos:</p>
      <ol class="tr-passos">
        <li>Entre em <a class="link-tabela" href="https://supadata.ai" target="_blank" rel="noopener">supadata.ai</a> e crie uma conta grátis (100 créditos por mês, sem cartão).</li>
        <li>No painel deles, copie a <b>API key</b>.</li>
        <li>Volte aqui, abra <b>Chave da Supadata</b> aqui em cima, cole e clique em Salvar chave.</li>
      </ol>`);
    P.$("#tr-config", secao).open = true;
    P.$("#tr-chave", secao).focus();
  }

  async function aoClicarNoAviso(e) {
    const botao = e.target.closest("[data-aviso]");
    if (!botao) return;
    const acao = botao.dataset.aviso;
    if (acao === "guardar") {
      const item = itens.find((x) => String(x.id) === botao.dataset.id);
      limparAviso();
      if (item) abrirEdicao(item);
      return;
    }
    if (acao === "fechar") limparAviso();
  }

  /* =========================================================
     TRANSCREVER
     ========================================================= */

  function ligarContador(quando) {
    desligarContador();
    const passar = () => {
      const seg = Math.round((Date.now() - quando) / 1000);
      const tempo = seg < 60 ? `${seg}s` : `${Math.floor(seg / 60)}min ${seg % 60}s`;
      avisar("trabalhando", `<b>${P.icone("relogio", "ico-p")} Ouvindo o vídeo… ${tempo}</b>
        <p>Costuma levar de 3 a 4 minutos, pode deixar a aba aberta. Se fechar, o vídeo fica marcado como "processando" na biblioteca e você clica em tentar de novo depois.</p>`);
    };
    passar();
    contador = setInterval(passar, 1000);
  }
  function desligarContador() { if (contador) { clearInterval(contador); contador = null; } }

  async function transcrever(reusar) {
    if (trabalhando) { P.toast("Espere essa transcrição terminar antes de começar outra."); return; }
    if (!chave) { comoConseguirChave(); return; }

    const campo = P.$("#tr-link", secao);
    const bruto = reusar ? reusar.url : campo.value;
    const url = limparLink(bruto);

    if (!url || !/^https?:\/\//i.test(url)) {
      avisar("erro", `<b>Esse link não dá.</b><p>Cole o link inteiro do vídeo, aquele que começa com <b>https://</b>. Exemplo: https://www.instagram.com/reel/AbCdEf123/</p>`);
      if (!reusar) campo.focus();
      return;
    }

    let linha = reusar || null;
    if (!linha) {
      const repetido = itens.find((x) => String(x.url || "").toLowerCase() === url.toLowerCase());
      if (repetido) {
        const nome = repetido.titulo || repetido.perfil || "esse vídeo";
        if (!confirm(`Esse link já está na biblioteca ("${nome}"). Transcrever de novo vai gastar mais um crédito. Quer mesmo?`)) return;
      }
      const de_quem = P.$("#tr-dequem", secao).value === "minha" ? "minha" : "outra";
      const r = await inserir({
        fonte: fonteDoLink(url),
        url,
        perfil: perfilDoLink(url),
        de_quem,
        status: "processando"
      });
      if (r.erro) { avisar("erro", r.erro); return; }
      linha = r.linha;
      itens.unshift(linha);
      campo.value = "";
      desenharLista();
    } else {
      await atualizar(linha.id, { status: "processando", erro: null });
      linha.status = "processando";
      desenharLista();
    }

    trabalhando = true;
    P.$("#tr-transcrever", secao).disabled = true;
    ligarContador(Date.now());

    const saida = await buscarTranscricao(url);

    desligarContador();
    trabalhando = false;
    P.$("#tr-transcrever", secao).disabled = false;

    if (saida.erro) {
      await atualizar(linha.id, { status: "falhou", erro: saida.erro });
      Object.assign(linha, { status: "falhou", erro: saida.erro });
      avisar("erro", `<b>Não deu certo.</b><p>${P.esc(saida.erro)}</p>
        <div class="grupo-botoes"><button class="botao" type="button" data-aviso="guardar" data-id="${P.esc(linha.id)}">${P.icone("caneta", "ico-p")}Guardar assim mesmo e escrever na mão</button></div>`);
      desenharLista();
      return;
    }

    if (saida.vazio) {
      const motivo = "Não achei fala nesse vídeo. Costuma ser reel só com música ou só com texto na tela.";
      await atualizar(linha.id, { status: "falhou", erro: motivo });
      Object.assign(linha, { status: "falhou", erro: motivo });
      avisar("erro", `<b>Esse vídeo não tem fala.</b><p>${P.esc(motivo)}</p>
        <div class="grupo-botoes"><button class="botao" type="button" data-aviso="guardar" data-id="${P.esc(linha.id)}">${P.icone("caneta", "ico-p")}Guardar assim mesmo e escrever na mão</button></div>`);
      desenharLista();
      return;
    }

    const valores = { status: "pronto", erro: null, transcricao: saida.texto, segmentos: saida.segmentos || null };
    const erro = await atualizar(linha.id, valores);
    if (erro) { avisar("erro", erro); return; }
    Object.assign(linha, valores);
    avisar("ok", "✅ Pronto. Revisa, dá um nome e salva.");
    desenharLista();
    abrirEdicao(linha);
    mostrarSaldo();
  }

  /* =========================================================
     A BIBLIOTECA
     ========================================================= */

  function todasAsTags() {
    const conta = {};
    itens.forEach((i) => (Array.isArray(i.tags) ? i.tags : []).forEach((t) => {
      const nome = String(t || "").trim();
      if (nome) conta[nome] = (conta[nome] || 0) + 1;
    }));
    return Object.entries(conta).sort((a, b) => b[1] - a[1]).slice(0, 12);
  }

  function filtrados() {
    return itens.filter((i) => {
      if (filtro === "minha" && i.de_quem !== "minha") return false;
      if (filtro === "outra" && i.de_quem === "minha") return false;
      if (filtro.startsWith("tag:")) {
        const alvo = filtro.slice(4);
        if (!(Array.isArray(i.tags) ? i.tags : []).some((t) => String(t) === alvo)) return false;
      }
      if (!busca) return true;
      return [i.transcricao, i.perfil, i.titulo, i.obs, i.legenda].some((c) => String(c || "").toLowerCase().includes(busca));
    });
  }

  const primeirasLinhas = (texto, quantas) => {
    const limpo = String(texto || "").replace(/\s+/g, " ").trim();
    if (!limpo) return "";
    const pedacos = limpo.split(/(?<=[.!?])\s+/).filter(Boolean);
    const juntos = pedacos.slice(0, quantas || 3).join(" ");
    return juntos.length > 320 ? juntos.slice(0, 320) + "…" : juntos;
  };

  function desenharLista() {
    const conta = (f) => itens.filter((i) => (f === "minha" ? i.de_quem === "minha" : i.de_quem !== "minha")).length;
    P.$("#tr-filtros", secao).innerHTML =
      `<button class="filtro" type="button" data-filtro="todos" aria-pressed="${filtro === "todos"}">Todos<span class="qtd">${itens.length}</span></button>` +
      `<button class="filtro" type="button" data-filtro="minha" aria-pressed="${filtro === "minha"}">Meus<span class="qtd">${conta("minha")}</span></button>` +
      `<button class="filtro" type="button" data-filtro="outra" aria-pressed="${filtro === "outra"}">De outras<span class="qtd">${conta("outra")}</span></button>` +
      todasAsTags().map(([t, q]) => `<button class="filtro" type="button" data-filtro="tag:${P.esc(t)}" aria-pressed="${filtro === "tag:" + t}">${P.esc(t)}<span class="qtd">${q}</span></button>`).join("");

    const lista = filtrados();
    const alvo = P.$("#tr-lista", secao);

    if (!itens.length) {
      alvo.innerHTML = `<div class="cartao"><p class="vazio">Sua biblioteca está vazia. Cole o link de um reel aqui em cima e clique em <b>Transcrever</b>. O texto do vídeo fica guardado aqui, com etiqueta separando os seus vídeos dos das outras creators.</p></div>`;
      return;
    }
    if (!lista.length) {
      alvo.innerHTML = `<div class="cartao"><p class="vazio">Nenhum roteiro com essa busca ou filtro.</p></div>`;
      return;
    }

    alvo.innerHTML = `<div class="tr-grade">${lista.map(cartao).join("")}</div>`;
  }

  function cartao(i) {
    const meu = i.de_quem === "minha";
    const temEmbed = !!embedDe(i);
    const tags = (Array.isArray(i.tags) ? i.tags : []).filter(Boolean);
    const trecho = primeirasLinhas(i.transcricao, 3);

    let capa = "";
    if (i.status === "processando") {
      capa = `<div class="tr-capa-video tr-capa-espera">${P.icone("relogio")}<span>Ouvindo…</span></div>`;
    } else if (temEmbed) {
      capa = `<div class="tr-capa-video" data-capa="${P.esc(i.id)}">
        <button class="botao tr-ver" type="button" data-acao="ver">${P.icone("play", "ico-p")}ver vídeo</button>
      </div>`;
    } else {
      capa = `<div class="tr-capa-video tr-capa-sem">${P.icone("legenda")}<span>${P.esc(FONTES[i.fonte] || "Sem vídeo")}</span></div>`;
    }

    return `<article class="tr-card${i.status === "falhou" ? " tr-card-falhou" : ""}" data-id="${P.esc(i.id)}">
      ${capa}
      <div class="tr-card-corpo">
        <div class="tr-card-topo">
          <b>${P.esc(i.titulo || "Sem título")}</b>
          <span class="pilula ${meu ? "p-ciano" : "p-pessego"}">${meu ? "Meu" : "De outra"}</span>
        </div>
        <p class="tr-card-quem">
          ${i.perfil ? `<span>${P.esc(i.perfil)}</span>` : ""}
          <span class="mudo">${P.esc(FONTES[i.fonte] || "Outro")}</span>
          ${i.postado_em ? `<span class="mudo">${P.esc(P.dataBR(i.postado_em))}</span>` : ""}
          ${i.created_at ? `<span class="mudo pequeno">salvo ${P.esc(P.dataBR(String(i.created_at).slice(0, 10)))}</span>` : ""}
        </p>
        ${tags.length ? `<div class="tr-tags">${tags.map((t) => `<span class="pilula p-cinza">${P.esc(t)}</span>`).join("")}</div>` : ""}
        ${i.status === "processando"
          ? `<div class="tr-espera">${P.icone("relogio")}<span>Transcrevendo esse vídeo. Se você fechou a aba no meio, clique em tentar de novo.</span></div>`
          : i.status === "falhou"
            ? `<p class="tr-motivo">${P.esc(i.erro || "Não deu certo dessa vez.")}</p>`
            : `<p class="tr-trecho">${P.esc(trecho || "Sem texto ainda. Clique em Editar para escrever na mão.")}</p>`}
        <div class="tr-card-acoes">
          ${i.status === "processando" ? `<button class="botao" type="button" data-acao="repetir">${P.icone("recarregar", "ico-p")}Tentar de novo</button>` : ""}
          ${i.status === "falhou" ? `<button class="botao" type="button" data-acao="editar">${P.icone("caneta", "ico-p")}Abrir mesmo assim</button>
            <button class="botao" type="button" data-acao="repetir">${P.icone("recarregar", "ico-p")}Tentar de novo</button>` : ""}
          ${i.status === "pronto" ? `<button class="botao" type="button" data-acao="copiar">${P.icone("copiar", "ico-p")}Copiar transcrição</button>
            <button class="botao" type="button" data-acao="editar">${P.icone("editar", "ico-p")}Editar</button>` : ""}
          ${i.url ? `<a class="botao botao-icone" href="${P.esc(i.url)}" target="_blank" rel="noopener" title="Abrir o vídeo no site original" aria-label="Abrir o vídeo no site original">${P.icone("link")}</a>` : ""}
          <button class="botao botao-perigo botao-icone empurra" type="button" data-acao="apagar" title="Apagar" aria-label="Apagar">${P.icone("lixo")}</button>
        </div>
      </div>
    </article>`;
  }

  async function aoClicarNaLista(e) {
    const botao = e.target.closest("[data-acao]");
    if (!botao) return;
    const card = botao.closest("[data-id]");
    const item = itens.find((x) => String(x.id) === card.dataset.id);
    if (!item) return;
    const acao = botao.dataset.acao;

    if (acao === "ver") {
      const caixa = botao.parentElement;
      const endereco = embedDe(item);
      if (!endereco) { P.toast("Não consegui montar o vídeo desse link.", "erro"); return; }
      caixa.innerHTML = `<iframe src="${P.esc(endereco)}" title="Vídeo" loading="lazy" allow="autoplay; encrypted-media; picture-in-picture" allowfullscreen referrerpolicy="no-referrer"></iframe>`;
      return;
    }

    if (acao === "copiar") {
      const ok = await copiar(item.transcricao || "");
      if (!ok) { P.toast("Não consegui copiar. Abra em Editar e copie de lá.", "erro"); return; }
      const antes = botao.innerHTML;
      botao.innerHTML = `${P.icone("check", "ico-p")}copiado ✓`;
      setTimeout(() => { botao.innerHTML = antes; }, 1800);
      return;
    }

    if (acao === "editar") { abrirEdicao(item); return; }

    if (acao === "repetir") { transcrever(item); return; }

    if (acao === "apagar") {
      const nome = item.titulo || item.perfil || "esse roteiro";
      if (!confirm(`Apagar "${nome}" de vez? Isso não tem volta.`)) return;
      try {
        const { error } = await banco.from(TABELA).delete().eq("id", item.id);
        if (error) { P.toast(erroTabela(error), "erro"); return; }
      } catch (erro) { P.toast(erroTabela(erro), "erro"); return; }
      itens = itens.filter((x) => x !== item);
      P.toast("Apagado.");
      desenharLista();
    }
  }

  async function copiar(texto) {
    if (!texto) return false;
    try {
      if (navigator.clipboard && navigator.clipboard.writeText) {
        await navigator.clipboard.writeText(texto);
        return true;
      }
    } catch (e) { /* tenta do jeito antigo */ }
    try {
      const caixa = document.createElement("textarea");
      caixa.value = texto;
      caixa.style.position = "fixed";
      caixa.style.opacity = "0";
      document.body.appendChild(caixa);
      caixa.select();
      const deu = document.execCommand("copy");
      caixa.remove();
      return deu;
    } catch (e) { return false; }
  }

  /* =========================================================
     EDITAR (janela igual às outras abas)
     ========================================================= */
  function abrirEdicao(item) {
    const novo = !item;
    const v = item || { de_quem: P.$("#tr-dequem", secao).value === "minha" ? "minha" : "outra", fonte: "manual", status: "pronto" };
    P.formulario({
      titulo: novo ? "Escrever um roteiro na mão" : "Editar roteiro",
      valores: {
        titulo: v.titulo || "",
        de_quem: v.de_quem || "outra",
        perfil: v.perfil || "",
        url: v.url || "",
        postado_em: v.postado_em || "",
        tags: (Array.isArray(v.tags) ? v.tags : []).join(", "),
        legenda: v.legenda || "",
        transcricao: v.transcricao || "",
        obs: v.obs || ""
      },
      campos: [
        { nome: "titulo", rotulo: "Título", tipo: "texto", largo: true, ajuda: "Um nome curto para você achar depois." },
        { nome: "de_quem", rotulo: "De quem é", tipo: "escolha", opcoes: [["outra", "De outra pessoa"], ["minha", "Meu"]] },
        { nome: "perfil", rotulo: "Perfil", tipo: "texto", ajuda: "Ex.: @fulana" },
        { nome: "url", rotulo: "Link do vídeo", tipo: "url", largo: true },
        { nome: "postado_em", rotulo: "Data da postagem", tipo: "data" },
        { nome: "tags", rotulo: "Tags", tipo: "texto", ajuda: "Separadas por vírgula. Ex.: gancho, skincare" },
        { nome: "legenda", rotulo: "Legenda do post", tipo: "texto-longo", largo: true },
        { nome: "transcricao", rotulo: "Transcrição", tipo: "texto-longo", largo: true },
        { nome: "obs", rotulo: "Minhas notas", tipo: "texto-longo", largo: true }
      ],
      aoSalvar: async (dados) => {
        const url = limparLink(dados.url);
        const valores = {
          titulo: dados.titulo,
          de_quem: dados.de_quem === "minha" ? "minha" : "outra",
          perfil: dados.perfil,
          url,
          postado_em: dados.postado_em || null,
          tags: String(dados.tags || "").split(",").map((t) => t.trim()).filter(Boolean),
          legenda: dados.legenda,
          transcricao: dados.transcricao,
          obs: dados.obs,
          status: "pronto",
          erro: null
        };
        if (novo) {
          valores.fonte = url ? fonteDoLink(url) : "manual";
          if (!valores.perfil) valores.perfil = perfilDoLink(url);
          const r = await inserir(valores);
          if (r.erro) return r.erro;
          itens.unshift(r.linha);
          P.toast("Roteiro guardado.");
        } else {
          if (url && url !== item.url) valores.fonte = fonteDoLink(url);
          const erro = await atualizar(item.id, valores);
          if (erro) return erro;
          Object.assign(item, valores);
          P.toast("Roteiro salvo.");
        }
        limparAviso();
        desenharLista();
        return null;
      },
      aoApagar: novo ? null : async () => {
        try {
          const { error } = await banco.from(TABELA).delete().eq("id", item.id);
          if (error) return erroTabela(error);
        } catch (e) { return erroTabela(e); }
        itens = itens.filter((x) => x !== item);
        P.toast("Apagado.");
        desenharLista();
        return null;
      }
    });
    // A transcrição costuma ser longa: essa caixa nasce maior que as outras
    const caixa = P.$("#janela-form-campos textarea[name=\"transcricao\"]");
    if (caixa) caixa.style.minHeight = "240px";
  }

  /* =========================================================
     ESTUDAR COM O CLAUDE
     Monta o texto do pedido e copia. Nenhuma chave de IA aqui.
     ========================================================= */
  async function estudarComOClaude() {
    const outras = itens
      .filter((i) => i.de_quem !== "minha" && String(i.transcricao || "").trim())
      .slice(0, 10);

    if (!outras.length) {
      avisar("info", `<b>Ainda não dá para estudar.</b><p>Transcreva pelo menos um vídeo marcado como <b>De outra pessoa</b>. O pedido é montado com os 10 últimos.</p>`);
      return;
    }

    const partes = outras.map((i, n) => {
      const cabeca = [i.perfil || "sem perfil", FONTES[i.fonte] || "", i.titulo || ""].filter(Boolean).join(" · ");
      return `--- VÍDEO ${n + 1} (${cabeca}) ---\n${String(i.transcricao).trim()}`;
    }).join("\n\n");

    const pedido =
`Sou creator de conteúdo e quero estudar o que está funcionando nos vídeos de outras creators.

Meu assunto é: ____________ (escreva aqui o seu assunto antes de enviar)

Abaixo estão ${outras.length} ${outras.length === 1 ? "roteiro transcrito" : "roteiros transcritos"} de vídeos de outras pessoas, com o perfil de cada um.

${partes}

Com base nesses roteiros, me responda em português simples:

1. ASSUNTOS EM ALTA: quais temas aparecem mais e o que eles têm em comum.
2. EXPRESSÕES QUE ESTÃO PRENDENDO: palavras e frases que se repetem e seguram quem está assistindo.
3. PADRÕES DE GANCHO: quais tipos de abertura aparecem, e para cada padrão me mostre um exemplo real tirado dos roteiros acima, dizendo de qual vídeo saiu.
4. CINCO ROTEIROS NOVOS no MEU assunto, reaproveitando a ESTRUTURA desses vídeos, nunca o conteúdo. Cada um com gancho, meio e final, escrito do jeito que uma pessoa fala de verdade, sem soar robotizado e sem frase de efeito vazia.`;

    const ok = await copiar(pedido);
    if (!ok) { avisar("erro", "Não consegui copiar o texto. Tente de novo."); return; }
    const botao = P.$("#tr-estudar", secao);
    const antes = botao.innerHTML;
    botao.innerHTML = `${P.icone("check", "ico-p")}copiado ✓`;
    setTimeout(() => { botao.innerHTML = antes; }, 2000);
    avisar("ok", `✅ Pedido copiado com ${P.plural(outras.length, "roteiro", "roteiros")} de outras creators. Abra o Claude, cole, escreva o seu assunto na linha indicada e envie.`);
  }
})();
