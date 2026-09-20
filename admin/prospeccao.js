/* =========================================================
   ABA PROSPECÇÃO
   Escreve um e-mail uma vez só e manda para várias marcas,
   chamando cada uma pelo nome. Os e-mails vêm da aba Marcas.

   Quem envia de verdade é a função "enviar-emails", que mora
   no Supabase. Nenhuma chave secreta passa por aqui.
   ========================================================= */
(function () {
  "use strict";
  const P = window.Painel;

  const MEU_EMAIL = "alannaclara.machadoxs@gmail.com";
  const RESPONDER = "contatoalannaclara@gmail.com";
  const SITE = "https://alannaclara.github.io/portfoliougc/";
  const LOTE = 100;   // manda de 100 em 100
  const GUARDADO = "prospeccao-rascunho-v1";

  const temEmail = (m) => /^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/.test(String(m.email || "").trim());
  const minusculo = (v) => String(v || "").trim().toLowerCase();

  /* ---------- O que fica escrito por padrão ---------- */
  const TEXTO_MODELO =
`Oi, {{marca}}, tudo bem?

Meu nome é Alanna Clara, sou criadora de conteúdo UGC em Curitiba e acompanho o trabalho da {{marca}}.

Eu gravo conteúdos criativos que conectam: vídeos verticais com roteiro, gravação e edição, prontos para o feed, os stories e os anúncios da marca.

Dá para ver alguns exemplos aqui: ${SITE}

Se fizer sentido para vocês, eu mando os pacotes e os valores. É só responder este e-mail.

Um abraço,
Alanna Clara
@_alannaclara`;

  const ASSUNTO_MODELO = "Conteúdo UGC para a {{marca}}";

  /* ---------- Estado da aba ---------- */
  let secao = null;
  let marcas = [];
  let envios = [];
  let optouts = [];
  let temColuna = true;   // a coluna "selecionada" existe?
  let temRegistro = true; // a tabela email_envios existe?
  let temDescadastro = true;
  let destino = "selecionadas";
  let modo = "facil";     // facil ou html
  let buscaHist = "";
  let enviando = false;

  const carta = {
    assunto: ASSUNTO_MODELO,
    texto: TEXTO_MODELO,
    html: "",
    botaoTexto: "",
    botaoLink: "",
    pular: true
  };

  function guardar() {
    try { localStorage.setItem(GUARDADO, JSON.stringify(carta)); } catch (e) { /* sem espaço, tudo bem */ }
  }
  function recuperar() {
    try {
      const salvo = JSON.parse(localStorage.getItem(GUARDADO) || "null");
      if (salvo && typeof salvo === "object") Object.assign(carta, salvo);
    } catch (e) { /* começa do modelo */ }
  }

  /* =========================================================
     MONTAR O E-MAIL
     ========================================================= */

  // Transforma links soltos e e-mails soltos em links de verdade
  function ligarLinks(seguro) {
    return seguro.replace(
      /(https?:\/\/[^\s<]*[^\s<.,;:!?)])|(\bwww\.[^\s<]*[^\s<.,;:!?)])|([\w.+-]+@[\w-]+\.[\w.-]+)/g,
      (todo, url, www, mail) => {
        if (url) return `<a href="${url}" style="color:#17606b">${url}</a>`;
        if (www) return `<a href="https://${www}" style="color:#17606b">${www}</a>`;
        return `<a href="mailto:${mail}" style="color:#17606b">${mail}</a>`;
      }
    );
  }

  const RODAPE_SAIR = "Se você não quiser mais receber e-mails meus, responda com a palavra SAIR e eu tiro o seu endereço da lista na hora.";

  // Do texto fácil sai um e-mail limpo, com no máximo 560px de largura
  function htmlDoTexto() {
    const blocos = String(carta.texto).replace(/\r\n/g, "\n").split(/\n{2,}/).map((b) => b.trim()).filter(Boolean);
    const paragrafos = blocos.map((b) =>
      `<p style="margin:0 0 16px;font-size:15px;line-height:1.65;color:#173b43;word-break:break-word">${ligarLinks(P.esc(b)).replace(/\n/g, "<br>")}</p>`
    ).join("");
    const botao = (carta.botaoTexto.trim() && carta.botaoLink.trim())
      ? `<p style="margin:26px 0 8px"><a href="${P.esc(carta.botaoLink.trim())}" style="display:inline-block;padding:12px 22px;border-radius:10px;background:#173b43;color:#a7ebf2;font-weight:700;font-size:15px;text-decoration:none">${P.esc(carta.botaoTexto.trim())}</a></p>`
      : "";
    return `<!DOCTYPE html>
<html lang="pt-BR"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><title>${P.esc(carta.assunto)}</title></head>
<body style="margin:0;padding:0;background:#f3eee9">
<table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="background:#f3eee9">
  <tr><td align="center" style="padding:28px 14px">
    <table role="presentation" cellpadding="0" cellspacing="0" style="width:100%;max-width:560px;background:#fbf8f5;border-radius:16px">
      <tr><td style="padding:30px 32px;font-family:Helvetica,Arial,sans-serif">
        ${paragrafos}
        ${botao}
        <p style="margin:26px 0 0;padding-top:16px;border-top:1px solid rgba(23,59,67,.15);font-size:12px;line-height:1.6;color:#5b5650;font-family:Helvetica,Arial,sans-serif">
          ${P.esc(RODAPE_SAIR)}
        </p>
      </td></tr>
    </table>
  </td></tr>
</table>
</body></html>`;
  }

  const htmlFinal = () => (modo === "html" ? carta.html : htmlDoTexto());

  // O mesmo e-mail em texto puro, para o modo rascunho e para o Gmail
  function textoPuro() {
    if (modo === "facil") return `${carta.texto}\n\n${carta.botaoTexto.trim() && carta.botaoLink.trim() ? carta.botaoTexto.trim() + ": " + carta.botaoLink.trim() + "\n\n" : ""}${RODAPE_SAIR}`;
    const semTag = String(carta.html)
      .replace(/<(style|script|head)[\s\S]*?<\/\1>/gi, "")
      .replace(/<br\s*\/?>/gi, "\n")
      .replace(/<\/(p|div|tr|h1|h2|h3)>/gi, "\n\n")
      .replace(/<[^>]+>/g, "")
      .replace(/&nbsp;/g, " ").replace(/&amp;/g, "&").replace(/&lt;/g, "<").replace(/&gt;/g, ">").replace(/&quot;/g, '"').replace(/&#39;/g, "'");
    return semTag.replace(/\n{3,}/g, "\n\n").trim();
  }

  // Troca {{nome}} e {{marca}}, igualzinho a função faz no envio
  function primeiroNome(nome) {
    const partes = String(nome || "").trim().split(/\s+/).filter(Boolean);
    if (!partes.length) return "";
    const p = partes[0];
    if (p.length <= 2 || ["de", "da", "do", "das", "dos", "e"].includes(p.toLowerCase())) return String(nome).trim();
    return p;
  }
  function personalizar(modelo, marca) {
    const completo = String(marca || "").trim();
    return String(modelo || "")
      .replace(/\{\{\s*nome\s*\}\}/gi, primeiroNome(completo))
      .replace(/\{\{\s*marca\s*\}\}/gi, completo);
  }

  const MODELO_HTML_PRONTO = () => htmlDoTexto();

  /* =========================================================
     PARA QUEM VAI
     ========================================================= */
  function situacoesDaBase() {
    const contas = new Map();
    marcas.forEach((m) => {
      const s = String(m.situacao || "").trim();
      if (!s || !temEmail(m)) return;
      contas.set(s, (contas.get(s) || 0) + 1);
    });
    return Array.from(contas.entries()).sort((a, b) => b[1] - a[1]);
  }

  // Devolve a lista final e o que ficou de fora, sem repetir e-mail
  function calcularDestinatarios() {
    if (destino === "teste") {
      return { lista: [{ email: MEU_EMAIL, marca: "Alanna Clara", id: null }], repetidos: 0, descadastrados: 0, jaReceberam: 0, semEmail: 0 };
    }
    let base = marcas.filter(temEmail);
    let semEmail = 0;
    if (destino === "selecionadas") {
      base = marcas.filter((m) => m.selecionada);
      semEmail = base.filter((m) => !temEmail(m)).length;
      base = base.filter(temEmail);
    } else if (destino.indexOf("situacao:") === 0) {
      const alvo = destino.slice(9);
      base = marcas.filter((m) => String(m.situacao || "") === alvo);
      semEmail = base.filter((m) => !temEmail(m)).length;
      base = base.filter(temEmail);
    } else {
      semEmail = marcas.filter((m) => !temEmail(m)).length;
    }

    const vistos = new Set();
    let repetidos = 0;
    const unicos = [];
    base.forEach((m) => {
      const e = minusculo(m.email);
      if (vistos.has(e)) { repetidos++; return; }
      vistos.add(e);
      unicos.push({ email: e, marca: String(m.nome || "").trim(), id: m.id });
    });

    const fora = new Set(optouts.map((o) => minusculo(o.email)));
    const semDescadastro = unicos.filter((d) => !fora.has(d.email));
    const descadastrados = unicos.length - semDescadastro.length;

    let lista = semDescadastro;
    let jaReceberam = 0;
    const assunto = carta.assunto.trim().toLowerCase();
    if (carta.pular && assunto) {
      const receberam = new Set(envios.filter((e) => e.status === "ok" && minusculo(e.assunto) === assunto).map((e) => minusculo(e.email)));
      const antes = lista.length;
      lista = lista.filter((d) => !receberam.has(d.email));
      jaReceberam = antes - lista.length;
    }
    return { lista, repetidos, descadastrados, jaReceberam, semEmail };
  }

  /* =========================================================
     A TELA
     ========================================================= */
  P.abas.prospeccao = {
    async iniciar(s) {
      secao = s;
      recuperar();
      s.innerHTML = `
        <div class="avisos"></div>

        <div class="prosp-capa">
          <div class="prosp-capa-texto">
            <span class="prosp-selo">${P.icone("carta")}</span>
            <h2>Prospecção</h2>
            <p>Escreva o seu e-mail de apresentação uma vez só. Ele sai para cada marca chamando ela pelo nome.</p>
            <div class="prosp-lembretes">
              <span>Eu sempre confirmo antes de enviar</span>
              <span>Nunca mando duas vezes pro mesmo e-mail</span>
              <span>Quem pede SAIR não recebe mais</span>
            </div>
          </div>
          <div class="prosp-total"><b id="pr-total">0</b><span id="pr-total-rotulo">e-mails já enviados</span></div>
        </div>

        <div class="prosp-cartoes" id="pr-metricas"></div>

        <div class="prosp-grade">
          <div class="prosp-coluna">

            <div class="cartao bloco">
              <div class="cartao-topo"><h2>1. Para quem vai</h2><span class="mudo pequeno">os e-mails vêm da sua aba Marcas</span></div>
              <div class="cartao-corpo" id="pr-destino"></div>
            </div>

            <div class="cartao bloco">
              <div class="cartao-topo">
                <h2>2. O que ela vai ler</h2>
                <div class="subabas" role="group" aria-label="Jeito de escrever">
                  <button class="filtro" type="button" data-modo="facil" aria-pressed="true">Escrever fácil</button>
                  <button class="filtro" type="button" data-modo="html" aria-pressed="false">Colar HTML</button>
                </div>
              </div>
              <div class="cartao-corpo">
                <div class="campo largo">
                  <label for="pr-assunto">Assunto</label>
                  <input id="pr-assunto" type="text" maxlength="300">
                  <span class="campo-ajuda">Pode usar {{marca}} e {{nome}} aqui também.</span>
                </div>

                <div id="pr-modo-facil">
                  <div class="campo largo" style="margin-top:12px">
                    <label for="pr-texto">Texto do e-mail</label>
                    <textarea id="pr-texto" rows="14" style="min-height:260px"></textarea>
                    <span class="campo-ajuda">Escreva normal, como se fosse no WhatsApp. Linha em branco separa parágrafo. Link colado vira link sozinho.</span>
                    <span class="campo-ajuda"><b>{{marca}}</b> vira o nome inteiro, como Casa Bella Enxovais. <b>{{nome}}</b> vira só a primeira palavra, como Casa, que serve quando o contato é uma pessoa.</span>
                  </div>
                  <div class="grade-campos" style="margin-top:12px">
                    <div class="campo"><label for="pr-botao-texto">Botão, se quiser (opcional)</label><input id="pr-botao-texto" type="text" maxlength="60" placeholder="Ver meu portfólio"></div>
                    <div class="campo"><label for="pr-botao-link">Link do botão</label><input id="pr-botao-link" type="url" maxlength="300" placeholder="${SITE}"></div>
                  </div>
                </div>

                <div id="pr-modo-html" hidden>
                  <div class="grupo-botoes" style="margin-top:12px">
                    <button class="botao" type="button" id="pr-do-modelo">${P.icone("baixar", "ico-p")}Começar do modelo pronto</button>
                  </div>
                  <div class="campo largo" style="margin-top:12px">
                    <label for="pr-html">HTML do e-mail</label>
                    <textarea id="pr-html" rows="16" spellcheck="false" style="min-height:300px;font-family:ui-monospace,Menlo,Consolas,monospace;font-size:12.5px"></textarea>
                    <span class="campo-ajuda">Só mexa aqui se você tiver um modelo pronto. O {{nome}} e o {{marca}} funcionam igual.</span>
                  </div>
                  <div class="aviso-suave" id="pr-aviso-sair" hidden>${P.icone("alerta", "ico-p")}<span>O seu HTML está sem a linha do descadastro. Quem recebe precisa saber como sair da lista. Escreva em algum lugar do e-mail que basta responder com a palavra SAIR.</span></div>
                </div>

                <label class="campo campo-marcar" style="margin-top:14px"><input type="checkbox" id="pr-pular" checked>Pular quem já recebeu um e-mail com este mesmo assunto</label>
              </div>
            </div>

            <div class="cartao bloco">
              <div class="cartao-topo"><h2>3. Enviar</h2></div>
              <div class="cartao-corpo" id="pr-enviar"></div>
            </div>

          </div>

          <aside class="prosp-palco">
            <div class="prosp-palco-topo">
              <b>Prévia</b>
              <button class="botao botao-icone" type="button" id="pr-tela-cheia" title="Ver em tela cheia" aria-label="Ver a prévia em tela cheia">${P.icone("expandir")}</button>
            </div>
            <div class="prosp-janela">
              <div class="prosp-janela-topo">
                <span class="prosp-avatar" aria-hidden="true">A</span>
                <div class="prosp-janela-quem">
                  <b id="pr-previa-assunto">Assunto</b>
                  <span class="mudo pequeno">Alanna Clara <span id="pr-previa-de">&lt;${P.esc(RESPONDER)}&gt;</span></span>
                  <span class="mudo pequeno">para você</span>
                </div>
              </div>
              <iframe class="prosp-quadro" id="pr-previa" title="Prévia do e-mail" sandbox=""></iframe>
            </div>
            <p class="prosp-lembrete-baixo" id="pr-lembrete"></p>
          </aside>
        </div>

        <div class="cartao" id="pr-historico-cartao">
          <div class="cartao-topo">
            <h2>Histórico de envios</h2>
            <div class="grupo-botoes">
              <label class="busca"><span class="sr">Buscar no histórico</span>${P.icone("busca", "ico-p")}<input type="search" id="pr-busca" placeholder="Buscar por e-mail ou assunto"></label>
              <button class="botao" type="button" id="pr-descadastrar">${P.icone("x", "ico-p")}Descadastrar um e-mail</button>
            </div>
          </div>
          <div class="tabela-rolagem" style="max-height:420px">
            <table class="tabela">
              <thead><tr><th>Quando</th><th>Para</th><th>Assunto</th><th>Deu certo?</th><th>Detalhe</th></tr></thead>
              <tbody id="pr-historico"><tr><td colspan="5" class="carregando">Carregando...</td></tr></tbody>
            </table>
          </div>
        </div>`;

      ligarCampos();
      await carregar();
    },
    async aoMostrar() { await carregar(); }
  };

  function ligarCampos() {
    const s = secao;
    P.$("#pr-assunto", s).value = carta.assunto;
    P.$("#pr-texto", s).value = carta.texto;
    P.$("#pr-html", s).value = carta.html || htmlDoTexto();
    P.$("#pr-botao-texto", s).value = carta.botaoTexto;
    P.$("#pr-botao-link", s).value = carta.botaoLink;
    P.$("#pr-pular", s).checked = carta.pular;

    const aoDigitar = () => {
      carta.assunto = P.$("#pr-assunto", s).value;
      carta.texto = P.$("#pr-texto", s).value;
      carta.html = P.$("#pr-html", s).value;
      carta.botaoTexto = P.$("#pr-botao-texto", s).value;
      carta.botaoLink = P.$("#pr-botao-link", s).value;
      guardar();
      desenharPrevia();
      desenharDestino();
      desenharEnviar();
      desenharMetricas();
    };
    ["#pr-assunto", "#pr-texto", "#pr-html", "#pr-botao-texto", "#pr-botao-link"].forEach((sel) => {
      P.$(sel, s).addEventListener("input", aoDigitar);
    });
    P.$("#pr-pular", s).addEventListener("change", (e) => { carta.pular = e.target.checked; guardar(); desenharDestino(); desenharEnviar(); desenharMetricas(); });

    P.$$("[data-modo]", s).forEach((b) => b.addEventListener("click", () => {
      modo = b.dataset.modo;
      P.$$("[data-modo]", s).forEach((x) => x.setAttribute("aria-pressed", String(x.dataset.modo === modo)));
      P.$("#pr-modo-facil", s).hidden = modo !== "facil";
      P.$("#pr-modo-html", s).hidden = modo !== "html";
      if (modo === "html" && !P.$("#pr-html", s).value.trim()) P.$("#pr-html", s).value = htmlDoTexto();
      carta.html = P.$("#pr-html", s).value;
      guardar();
      desenharPrevia();
      desenharEnviar();
    }));

    P.$("#pr-do-modelo", s).addEventListener("click", () => {
      P.$("#pr-html", s).value = MODELO_HTML_PRONTO();
      carta.html = P.$("#pr-html", s).value;
      guardar();
      desenharPrevia();
      desenharEnviar();
      P.toast("Pronto, o modelo está aí. Pode mudar à vontade.");
    });

    P.$("#pr-tela-cheia", s).addEventListener("click", () => {
      const corpo = P.ver("Prévia do e-mail", `<iframe class="prosp-quadro prosp-quadro-grande" title="Prévia do e-mail em tela cheia" sandbox=""></iframe>`);
      P.$("iframe", corpo).srcdoc = previaPersonalizada();
    });

    P.$("#pr-destino", s).addEventListener("change", (e) => {
      const sel = e.target.closest("#pr-quem");
      if (!sel) return;
      destino = sel.value;
      desenharDestino();
      desenharEnviar();
      desenharMetricas();
      desenharPrevia();
    });
    P.$("#pr-destino", s).addEventListener("click", (e) => {
      if (e.target.closest("[data-ir-marcas]")) location.hash = "#marcas";
    });

    P.$("#pr-enviar", s).addEventListener("click", (e) => {
      if (e.target.closest("#pr-botao-teste")) enviarTeste();
      if (e.target.closest("#pr-botao-enviar")) comecarDisparo();
      if (e.target.closest("#pr-botao-rascunho")) abrirRascunho();
    });

    P.$("#pr-busca", s).addEventListener("input", (e) => { buscaHist = e.target.value.trim().toLowerCase(); desenharHistorico(); });
    P.$("#pr-descadastrar", s).addEventListener("click", () => pedirDescadastro(""));
    P.$("#pr-historico", s).addEventListener("click", (e) => {
      const b = e.target.closest("[data-fora]");
      if (b) pedirDescadastro(b.dataset.fora);
    });
  }

  /* ---------- Buscar tudo do banco ---------- */
  async function carregar() {
    const avisos = P.$(".avisos", secao);
    P.limparAvisos(avisos);

    const rMarcas = await P.lerSeguro("marcas", (q) => q.order("criado_em", { ascending: false }));
    if (rMarcas.erro) P.avisar(avisos, rMarcas.erro);
    marcas = rMarcas.dados;
    temColuna = !marcas.length || "selecionada" in marcas[0];
    if (!temColuna) P.avisar(avisos, "A coluna das caixinhas ainda não existe no banco. Rode o arquivo disparo.sql no SQL Editor do Supabase. Até lá, use a opção de enviar para todas as marcas ou por situação.");

    const rEnvios = await P.ler("email_envios", (q) => q.order("data", { ascending: false }).limit(1000));
    temRegistro = !rEnvios.erro;
    envios = rEnvios.dados;
    if (rEnvios.erro) P.avisar(avisos, "A tabela do histórico de envios ainda não existe. Rode o arquivo disparo.sql no SQL Editor do Supabase. Você já pode escrever o e-mail, mas o histórico fica vazio.");

    const rFora = await P.ler("email_optout");
    temDescadastro = !rFora.erro;
    optouts = rFora.dados;

    if (destino === "selecionadas" && !marcas.some((m) => m.selecionada) && marcas.some(temEmail)) {
      // Nada escolhido ainda: já deixa numa opção que funciona
      if (!temColuna) destino = "todas";
    }

    desenharTudo();
  }

  function desenharTudo() {
    desenharMetricas();
    desenharDestino();
    desenharEnviar();
    desenharPrevia();
    desenharHistorico();
  }

  /* ---------- Capa e cartões coloridos ---------- */
  function desenharMetricas() {
    const okTotal = envios.filter((e) => e.status === "ok").length;
    P.$("#pr-total", secao).textContent = P.inteiro(okTotal);
    P.$("#pr-total-rotulo", secao).textContent = okTotal === 1 ? "e-mail já enviado" : "e-mails já enviados";

    const comEmail = marcas.filter(temEmail).length;
    const conta = calcularDestinatarios();
    const jaReceberam = new Set(envios.filter((e) => e.status === "ok").map((e) => minusculo(e.email))).size;
    const falhas = envios.filter((e) => e.status === "erro").length;

    const cartao = (cor, rotulo, valor, sub) =>
      `<div class="prosp-metrica m-${cor}"><span class="numero-rotulo">${P.esc(rotulo)}</span><b class="numero-valor">${valor}</b><span class="numero-sub">${sub}</span></div>`;

    P.$("#pr-metricas", secao).innerHTML =
      cartao("azul", "Marcas com e-mail", P.inteiro(comEmail), `de ${P.plural(marcas.length, "marca na base", "marcas na base")}`) +
      cartao("pessego", "A enviar agora", P.inteiro(conta.lista.length), destino === "teste" ? "é só o seu teste" : "com a escolha de agora") +
      cartao("verde", "Já receberam", P.inteiro(jaReceberam), "endereços diferentes") +
      cartao("vermelho", "Falhas", P.inteiro(falhas), falhas ? "veja no histórico" : "nenhuma até agora") +
      cartao("cinza", "Descadastrados", P.inteiro(optouts.length), "pediram para sair");
  }

  /* ---------- Bloco 1: para quem ---------- */
  function desenharDestino() {
    const caixa = P.$("#pr-destino", secao);
    if (!marcas.length) {
      caixa.innerHTML = `
        <div class="vazio">
          <p>A sua base de marcas está vazia, então não tem para quem enviar ainda.</p>
          <p class="pequeno" style="margin-top:6px">Vá na aba Marcas, use o botão Importar planilha ou adicione uma marca na mão. Depois volte aqui.</p>
          <div class="grupo-botoes" style="justify-content:center;margin-top:12px"><button class="botao botao-principal" type="button" data-ir-marcas>${P.icone("marcas", "ico-p")}Ir para Marcas</button></div>
        </div>`;
      return;
    }

    const escolhidas = marcas.filter((m) => m.selecionada && temEmail(m)).length;
    const comEmail = marcas.filter(temEmail).length;
    const opcoes = [];
    opcoes.push([`selecionadas`, `Só as marcas selecionadas (${escolhidas})`]);
    opcoes.push([`teste`, `Só para mim, teste (1)`]);
    opcoes.push([`todas`, `Todas as marcas com e-mail (${comEmail})`]);
    situacoesDaBase().forEach(([valor, quantas]) => {
      const nome = P.nomeSituacao ? P.nomeSituacao(valor) : valor;
      opcoes.push([`situacao:${valor}`, `${nome}, com e-mail (${quantas})`]);
    });
    if (!opcoes.some((o) => o[0] === destino)) destino = "selecionadas";

    const conta = calcularDestinatarios();
    const avisos = [];
    if (conta.semEmail) avisos.push(`${P.plural(conta.semEmail, "marca ficou", "marcas ficaram")} de fora por estar sem e-mail`);
    if (conta.repetidos) avisos.push(`${P.plural(conta.repetidos, "e-mail repetido saiu", "e-mails repetidos saíram")} da lista`);
    if (conta.descadastrados) avisos.push(`${P.plural(conta.descadastrados, "pediu", "pediram")} para sair da lista`);
    if (conta.jaReceberam) avisos.push(`${P.plural(conta.jaReceberam, "já recebeu", "já receberam")} um e-mail com este assunto`);

    caixa.innerHTML = `
      <div class="campo largo">
        <label for="pr-quem">Quem vai receber</label>
        <select class="selecao" id="pr-quem" style="width:100%">
          ${opcoes.map(([v, t]) => `<option value="${P.esc(v)}"${destino === v ? " selected" : ""}>${P.esc(t)}</option>`).join("")}
        </select>
      </div>
      <p class="prosp-conta">${conta.lista.length
        ? `Vão receber agora <b>${P.plural(conta.lista.length, "e-mail", "e-mails")}</b>.`
        : `<b>Ninguém vai receber com essa escolha.</b>`}</p>
      ${avisos.length ? `<ul class="prosp-listinha">${avisos.map((a) => `<li>${P.esc(a)}</li>`).join("")}</ul>` : ""}
      ${destino === "selecionadas" && !escolhidas ? `
        <div class="aviso-suave">${P.icone("alerta", "ico-p")}<span>Você ainda não marcou nenhuma marca. Vá na aba Marcas e marque a caixinha das que você quer.</span></div>
        <div class="grupo-botoes" style="margin-top:10px"><button class="botao" type="button" data-ir-marcas>${P.icone("marcas", "ico-p")}Ir para Marcas escolher</button></div>` : ""}`;
  }

  /* ---------- Bloco 3: enviar ---------- */
  function desenharEnviar() {
    const caixa = P.$("#pr-enviar", secao);
    const conta = calcularDestinatarios();
    const semAssunto = !carta.assunto.trim();
    const semTexto = !htmlFinal().trim() || (modo === "facil" && !carta.texto.trim());
    const podeEnviar = conta.lista.length > 0 && !semAssunto && !semTexto && !enviando;

    // Aviso do rodapé de descadastro no modo HTML
    const aviso = P.$("#pr-aviso-sair", secao);
    if (aviso) aviso.hidden = !(modo === "html" && carta.html.trim() && !/sair/i.test(carta.html));

    const problemas = [];
    if (semAssunto) problemas.push("Falta o assunto.");
    if (semTexto) problemas.push("Falta o texto do e-mail.");
    if (!conta.lista.length) problemas.push("A lista de quem vai receber está vazia.");

    caixa.innerHTML = `
      ${problemas.length ? `<div class="aviso-suave">${P.icone("alerta", "ico-p")}<span>${problemas.map(P.esc).join(" ")}</span></div>` : ""}
      <div class="grupo-botoes">
        <button class="botao botao-principal" type="button" id="pr-botao-enviar"${podeEnviar ? "" : " disabled"}>${P.icone("carta", "ico-p")}Enviar para ${P.plural(conta.lista.length, "marca", "marcas")}</button>
        <button class="botao" type="button" id="pr-botao-teste"${semAssunto || semTexto || enviando ? " disabled" : ""}>Mandar um teste para mim</button>
        <button class="botao" type="button" id="pr-botao-rascunho"${conta.lista.length && !enviando ? "" : " disabled"}>Modo rascunho, mandar pelo Gmail</button>
      </div>
      <p class="mudo pequeno" style="margin-top:10px">Eu mando de ${LOTE} em ${LOTE}, com uma pausa entre um e-mail e outro, e mostro uma barra de progresso. Antes de qualquer envio aparece uma janela pedindo a sua confirmação.</p>`;
  }

  /* ---------- Prévia ---------- */
  function previaPersonalizada() {
    const conta = calcularDestinatarios();
    const exemplo = conta.lista[0] ? conta.lista[0].marca : "Marca Exemplo";
    return personalizar(htmlFinal(), exemplo || "Marca Exemplo");
  }

  function desenharPrevia() {
    const conta = calcularDestinatarios();
    const exemplo = (conta.lista[0] && conta.lista[0].marca) || "Marca Exemplo";
    P.$("#pr-previa-assunto", secao).textContent = personalizar(carta.assunto, exemplo) || "Sem assunto";
    P.$("#pr-previa", secao).srcdoc = previaPersonalizada();
    P.$("#pr-lembrete", secao).textContent = destino === "teste"
      ? "Assim é como o e-mail chega na sua caixa de entrada."
      : `Estou mostrando com o nome de ${exemplo}. Cada marca recebe com o nome dela no lugar.`;
  }

  /* ---------- Histórico ---------- */
  function desenharHistorico() {
    const corpo = P.$("#pr-historico", secao);
    if (!temRegistro) {
      corpo.innerHTML = `<tr><td colspan="5" class="vazio">O histórico precisa da tabela email_envios. Rode o arquivo disparo.sql no Supabase.</td></tr>`;
      return;
    }
    const lista = envios.filter((e) => {
      if (!buscaHist) return true;
      return [e.email, e.assunto, e.erro].some((c) => String(c || "").toLowerCase().includes(buscaHist));
    });
    if (!envios.length) {
      corpo.innerHTML = `<tr><td colspan="5" class="vazio">Nenhum e-mail enviado ainda. Quando você disparar, cada envio aparece aqui, um por linha.</td></tr>`;
      return;
    }
    if (!lista.length) {
      corpo.innerHTML = `<tr><td colspan="5" class="vazio">Nada com essa busca.</td></tr>`;
      return;
    }
    corpo.innerHTML = lista.slice(0, 400).map((e) => {
      const quando = e.data ? new Date(e.data) : null;
      const certo = e.status === "ok";
      return `<tr>
        <td class="curta">${quando ? P.esc(quando.toLocaleDateString("pt-BR") + " " + quando.toLocaleTimeString("pt-BR", { hour: "2-digit", minute: "2-digit" })) : ""}</td>
        <td class="curta">${P.esc(e.email)}</td>
        <td class="corta" title="${P.esc(e.assunto)}">${P.esc(e.assunto)}</td>
        <td>${P.pilula(certo ? "Chegou" : "Deu erro", certo ? "verde" : "vermelho")}</td>
        <td class="corta" title="${P.esc(e.erro)}">${e.erro ? P.esc(e.erro) : `<button class="botao" type="button" data-fora="${P.esc(e.email)}" title="Nunca mais enviar para este e-mail">Não enviar mais</button>`}</td>
      </tr>`;
    }).join("");
  }

  /* =========================================================
     JANELAS DE PERGUNTA E DE PROGRESSO
     ========================================================= */
  function perguntar(titulo, corpoHtml, textoSim) {
    return new Promise((resolve) => {
      const corpo = P.ver(titulo, `${corpoHtml}
        <div class="grupo-botoes" style="margin-top:18px;justify-content:flex-end">
          <button class="botao" type="button" data-nao>Cancelar</button>
          <button class="botao botao-principal" type="button" data-sim>${P.esc(textoSim)}</button>
        </div>`);
      const janela = P.$("#janela-ver");
      let respondeu = false;
      const terminar = (valor) => { if (respondeu) return; respondeu = true; janela.removeEventListener("close", aoFechar); resolve(valor); };
      const aoFechar = () => terminar(false);
      janela.addEventListener("close", aoFechar);
      corpo.onclick = (e) => {
        if (e.target.closest("[data-nao]")) P.fecharVer();
        if (e.target.closest("[data-sim]")) { terminar(true); P.fecharVer(); }
      };
    });
  }

  function abrirProgresso(total) {
    const corpo = P.ver("Enviando", `
      <p class="mudo">Não feche esta janela nem o painel enquanto estou enviando.</p>
      <p class="prosp-progresso-texto" id="pr-pg-texto" style="margin-top:12px">Preparando...</p>
      <div class="progresso" style="margin-top:8px"><span id="pr-pg-barra" style="width:0%"></span></div>
      <div id="pr-pg-fim"></div>`);
    return {
      passo(feitos, aviso) {
        const barra = P.$("#pr-pg-barra");
        if (barra) barra.style.width = `${Math.round((feitos / Math.max(total, 1)) * 100)}%`;
        const texto = P.$("#pr-pg-texto");
        if (texto) texto.textContent = aviso || `${feitos} de ${total} ${total === 1 ? "e-mail" : "e-mails"}.`;
      },
      fim(html) {
        const alvo = P.$("#pr-pg-fim");
        if (alvo) alvo.innerHTML = html;
        const texto = P.$("#pr-pg-texto");
        if (texto) texto.textContent = "Terminei.";
        return alvo;
      },
      corpo
    };
  }

  /* =========================================================
     ENVIAR DE VERDADE
     ========================================================= */
  async function chamarFuncao(lote) {
    try {
      const { data, error } = await banco.functions.invoke("enviar-emails", {
        body: {
          assunto: carta.assunto.trim(),
          html: htmlFinal(),
          destinatarios: lote.map((d) => ({ email: d.email, marca: d.marca }))
        }
      });
      if (error) {
        let detalhe = null;
        try { detalhe = await error.context.json(); } catch (e) { detalhe = null; }
        const status = (error.context && error.context.status) || 0;
        if (status === 404) return { falhaGeral: "semFuncao" };
        if (detalhe && detalhe.erro === "semChave") return { falhaGeral: "semChave", mensagem: detalhe.mensagem };
        return { falhaGeral: "erro", mensagem: (detalhe && (detalhe.erro || detalhe.mensagem)) || error.message || "não consegui falar com o carteiro" };
      }
      return data || { falhaGeral: "erro", mensagem: "resposta vazia" };
    } catch (e) {
      return { falhaGeral: "erro", mensagem: String((e && e.message) || e) };
    }
  }

  async function enviarTeste() {
    const ok = await perguntar("Mandar um teste para você",
      `<p>Vou mandar <b>1 e-mail</b> para <b>${P.esc(MEU_EMAIL)}</b>, para você ver como chega. Nenhuma marca recebe nada agora.</p>`,
      "Mandar o teste");
    if (!ok) return;
    enviando = true; desenharEnviar();
    const progresso = abrirProgresso(1);
    progresso.passo(0, "Mandando o teste...");
    const resposta = await chamarFuncao([{ email: MEU_EMAIL, marca: "Marca Exemplo" }]);
    enviando = false;
    if (resposta.falhaGeral) { mostrarFalhaGeral(progresso, resposta); desenharEnviar(); return; }
    progresso.passo(1);
    progresso.fim(resposta.enviados
      ? `<p class="prosp-resumo-ok" style="margin-top:14px">Enviei. Olhe a sua caixa de entrada de ${P.esc(MEU_EMAIL)}. Se não estiver lá, olhe o spam.</p>`
      : `<p class="erro-form" style="margin-top:14px">Não consegui enviar o teste. Veja o histórico para o motivo.</p>`);
    await carregar();
  }

  async function comecarDisparo() {
    const conta = calcularDestinatarios();
    if (!conta.lista.length) return;

    const exemplos = conta.lista.slice(0, 4).map((d) => `${d.marca || d.email}`).join(", ");
    const ok = await perguntar("Confirmar o envio", `
      <p>Vou enviar para <b>${P.plural(conta.lista.length, "marca", "marcas")}</b>.</p>
      <p class="mudo" style="margin-top:8px">Assunto: <b>${P.esc(personalizar(carta.assunto, conta.lista[0].marca || "Marca"))}</b></p>
      <p class="mudo" style="margin-top:4px">Começando por ${P.esc(exemplos)}${conta.lista.length > 4 ? " e mais" : ""}.</p>
      ${conta.jaReceberam ? `<p class="mudo" style="margin-top:8px">${P.plural(conta.jaReceberam, "marca já recebeu", "marcas já receberam")} este mesmo assunto e ${conta.jaReceberam === 1 ? "fica" : "ficam"} de fora.</p>` : ""}
      <p style="margin-top:12px">Depois de enviar não tem como voltar atrás. Pode ir?</p>`,
      `Sim, enviar para ${conta.lista.length}`);
    if (!ok) return;

    enviando = true; desenharEnviar();
    const total = conta.lista.length;
    const progresso = abrirProgresso(total);
    let enviados = 0, falhas = 0, feitos = 0, cotaAcabou = false;
    const entregues = [];
    const idsEnviados = [];

    for (let i = 0; i < conta.lista.length; i += LOTE) {
      const lote = conta.lista.slice(i, i + LOTE);
      progresso.passo(feitos, `Enviando ${feitos + 1} de ${total}...`);
      const resposta = await chamarFuncao(lote);
      if (resposta.falhaGeral) { enviando = false; mostrarFalhaGeral(progresso, resposta); desenharEnviar(); await carregar(); return; }

      enviados += P.num(resposta.enviados);
      falhas += P.num(resposta.falhas);
      feitos += lote.length;
      (resposta.entregues || []).forEach((e) => entregues.push(minusculo(e)));
      progresso.passo(feitos);
      if (resposta.cotaAcabou) { cotaAcabou = true; break; }
    }

    // Marca cada marca que recebeu com a data de hoje
    const recebeu = new Set(entregues);
    conta.lista.forEach((d) => { if (d.id && recebeu.has(d.email)) idsEnviados.push(d.id); });
    if (idsEnviados.length) {
      try { await banco.from("marcas").update({ enviado_em: P.hoje() }).in("id", idsEnviados); } catch (e) { /* o envio já aconteceu */ }
    }

    enviando = false;
    const faltaram = total - enviados - falhas;
    progresso.fim(`
      <div class="prosp-resumo">
        <p class="prosp-resumo-ok">${P.plural(enviados, "e-mail saiu", "e-mails saíram")}.</p>
        ${falhas ? `<p class="mudo">${P.plural(falhas, "e-mail voltou com erro", "e-mails voltaram com erro")}. Está tudo anotado no histórico, com o motivo.</p>` : ""}
        ${cotaAcabou ? `<div class="aviso-suave" style="margin-top:10px">${P.icone("alerta", "ico-p")}<span><b>A cota de hoje do Resend acabou.</b> ${P.plural(faltaram, "marca ficou", "marcas ficaram")} sem receber. Volte amanhã nesta aba, escreva <b>exatamente o mesmo assunto</b> e deixe marcada a caixinha de pular quem já recebeu. Aí eu continuo de onde parei, sem repetir ninguém.</span></div>` : ""}
        ${destino === "selecionadas" && enviados ? `
          <p class="mudo" style="margin-top:12px">Deixei a sua escolha de marcas do jeito que estava, não apaguei nada.</p>
          <div class="grupo-botoes" style="margin-top:8px"><button class="botao" type="button" id="pr-limpar-escolha">Limpar a escolha agora</button></div>` : ""}
      </div>`);

    const limpar = P.$("#pr-limpar-escolha");
    if (limpar) limpar.addEventListener("click", async () => {
      const ids = marcas.filter((m) => m.selecionada).map((m) => m.id);
      if (!ids.length) return;
      try {
        await banco.from("marcas").update({ selecionada: false }).in("id", ids);
        P.toast("Escolha limpa.");
        limpar.disabled = true;
        await carregar();
      } catch (e) { P.toast("Não consegui limpar agora.", "erro"); }
    });

    await carregar();
  }

  function mostrarFalhaGeral(progresso, resposta) {
    if (resposta.falhaGeral === "semFuncao") {
      progresso.fim(`
        <div class="aviso-suave" style="margin-top:14px">${P.icone("alerta", "ico-p")}<span><b>O carteiro ainda não foi instalado.</b> A função enviar-emails precisa ser publicada no Supabase. O passo a passo está no arquivo enviar-emails.ts, na pasta do seu site.</span></div>
        <p class="mudo" style="margin-top:10px">Enquanto isso, o modo rascunho funciona: ele monta cada e-mail e abre o Gmail já preenchido para você só clicar em enviar.</p>`);
      return;
    }
    if (resposta.falhaGeral === "semChave") {
      progresso.fim(`
        <div class="aviso-suave" style="margin-top:14px">${P.icone("alerta", "ico-p")}<span><b>Falta colar a chave do Resend no Supabase.</b> ${P.esc(resposta.mensagem || "")}</span></div>
        <p class="mudo" style="margin-top:10px">Enquanto isso, use o modo rascunho.</p>`);
      return;
    }
    progresso.fim(`<p class="erro-form" style="margin-top:14px">${P.esc(resposta.mensagem || "Não consegui enviar agora.")}</p>
      <p class="mudo" style="margin-top:10px">Nada foi perdido. Confira o histórico para ver o que chegou a sair.</p>`);
  }

  /* =========================================================
     MODO RASCUNHO
     Funciona mesmo sem Resend nenhum: monta um e-mail por vez,
     abre o Gmail preenchido e você só clica em enviar.
     ========================================================= */
  async function abrirRascunho() {
    const conta = calcularDestinatarios();
    if (!conta.lista.length) return;
    let posicao = 0;

    const corpo = P.ver("Modo rascunho", `<div id="pr-rasc"></div>`);

    function desenhar() {
      const alvo = P.$("#pr-rasc", corpo);
      if (posicao >= conta.lista.length) {
        alvo.innerHTML = `<p class="prosp-resumo-ok">Acabou a fila. Você passou por ${P.plural(conta.lista.length, "marca", "marcas")}.</p>
          <div class="grupo-botoes" style="margin-top:14px;justify-content:flex-end"><button class="botao botao-principal" type="button" data-fim>Fechar</button></div>`;
        return;
      }
      const d = conta.lista[posicao];
      const assunto = personalizar(carta.assunto, d.marca);
      const corpoTexto = personalizar(textoPuro(), d.marca);
      const linkGmail = `https://mail.google.com/mail/?view=cm&fs=1&to=${encodeURIComponent(d.email)}&su=${encodeURIComponent(assunto)}&body=${encodeURIComponent(corpoTexto)}`;
      alvo.innerHTML = `
        <p class="mudo pequeno">${posicao + 1} de ${conta.lista.length}</p>
        <div class="progresso" style="margin:8px 0 16px"><span style="width:${Math.round((posicao / conta.lista.length) * 100)}%"></span></div>
        <div class="campo largo"><label>Para</label><input type="text" readonly value="${P.esc(d.email)}"></div>
        <div class="campo largo" style="margin-top:10px"><label>Assunto</label><input type="text" id="pr-rasc-assunto" readonly value="${P.esc(assunto)}"></div>
        <div class="campo largo" style="margin-top:10px"><label>Texto</label><textarea id="pr-rasc-texto" rows="12" readonly style="min-height:220px">${P.esc(corpoTexto)}</textarea></div>
        <div class="grupo-botoes" style="margin-top:14px">
          <a class="botao botao-principal" href="${P.esc(linkGmail)}" target="_blank" rel="noopener">${P.icone("link", "ico-p")}Abrir no Gmail preenchido</a>
          <button class="botao" type="button" data-copiar>${P.icone("baixar", "ico-p")}Copiar o texto</button>
          <button class="botao empurra" type="button" data-feito>${P.icone("check", "ico-p")}Já enviei, próxima</button>
          <button class="botao" type="button" data-pular>Pular</button>
        </div>`;
    }

    corpo.onclick = async (e) => {
      if (e.target.closest("[data-fim]")) { P.fecharVer(); await carregar(); return; }
      if (e.target.closest("[data-pular]")) { posicao++; desenhar(); return; }
      if (e.target.closest("[data-copiar]")) {
        const campo = P.$("#pr-rasc-texto", corpo);
        try { await navigator.clipboard.writeText(campo.value); P.toast("Texto copiado."); }
        catch (erro) { campo.select(); P.toast("Selecionei o texto. Use Ctrl C para copiar."); }
        return;
      }
      if (e.target.closest("[data-feito]")) {
        const d = conta.lista[posicao];
        if (d) await anotarEnvio(d, personalizar(carta.assunto, d.marca));
        posicao++;
        desenhar();
      }
    };
    desenhar();
  }

  // Anota no histórico um e-mail que você mandou na mão
  async function anotarEnvio(destinatario, assunto) {
    if (temRegistro) {
      try { await banco.from("email_envios").insert({ email: destinatario.email, assunto, status: "ok", erro: "", resend_id: "" }); }
      catch (e) { /* segue a fila */ }
    }
    if (destinatario.id) {
      try { await banco.from("marcas").update({ enviado_em: P.hoje() }).eq("id", destinatario.id); } catch (e) { /* segue */ }
    }
  }

  /* =========================================================
     DESCADASTRO
     ========================================================= */
  function pedirDescadastro(email) {
    if (!temDescadastro) { P.toast("A lista de descadastro precisa da tabela email_optout. Rode o disparo.sql no Supabase.", "erro"); return; }
    P.formulario({
      titulo: "Nunca mais enviar para este e-mail",
      textoSalvar: "Descadastrar",
      valores: { email },
      campos: [
        { nome: "email", rotulo: "E-mail", tipo: "email", obrigatorio: true, largo: true, ajuda: "Quem respondeu SAIR entra aqui e fica de fora de todos os disparos, para sempre." }
      ],
      aoSalvar: async (dados) => {
        const e = minusculo(dados.email);
        if (!/^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/.test(e)) return "Esse e-mail não parece certo.";
        try {
          const { error } = await banco.from("email_optout").upsert({ email: e }, { onConflict: "email" });
          if (error) throw error;
        } catch (erro) {
          return P.explicarErro(erro, "email_optout");
        }
        P.toast("Pronto, este e-mail não recebe mais nada.");
        await carregar();
        return null;
      }
    });
  }
})();
