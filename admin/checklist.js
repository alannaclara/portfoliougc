/* =========================================================
   ABA CHECKLIST PORTFÓLIO
   Usa exatamente o conteúdo de js/biblioteca.js (window.Biblioteca).
   O que você marca no checklist fica salvo na tabela marcados.
   ========================================================= */
(function () {
  "use strict";
  const P = window.Painel;

  const SUBABAS = [
    ["check", "Checklist do portfólio"],
    ["refs", "Referências de vídeo"],
    ["roteiros", "Roteiros"],
    ["nichos", "Ideias por nicho"],
    ["revisar", "Revisar meu roteiro"]
  ];

  let secao = null;
  let atual = "check";
  let marcados = new Set();
  let salvaNoBanco = true;
  const B = () => window.Biblioteca || null;

  // Os textos de roteiro da biblioteca têm negrito e itálico. Só essas marcações passam.
  const comNegrito = (t) => P.esc(t).replace(/&lt;(\/?)(b|em|i|strong)&gt;/g, "<$1$2>");
  const idYoutube = (url) => { const m = String(url || "").match(/(?:shorts\/|[?&]v=|youtu\.be\/|embed\/)([\w-]{11})/); return m ? m[1] : ""; };
  const lista = (nome) => { const b = B(); return b && Array.isArray(b[nome]) ? b[nome] : []; };

  P.abas.checklist = {
    async iniciar(s) {
      secao = s;
      s.innerHTML = `
        <div class="avisos"></div>
        <div class="subabas filtros" id="ck-subabas" role="tablist" aria-label="Partes do checklist">
          ${SUBABAS.map(([v, n]) => `<button class="filtro" type="button" role="tab" data-sub="${v}" aria-selected="${v === atual}" aria-pressed="${v === atual}">${n}</button>`).join("")}
        </div>
        <div id="ck-conteudo"></div>`;
      P.$("#ck-subabas", s).addEventListener("click", (e) => {
        const b = e.target.closest("[data-sub]");
        if (!b) return;
        atual = b.dataset.sub;
        P.$$("[data-sub]", s).forEach((x) => { x.setAttribute("aria-selected", String(x === b)); x.setAttribute("aria-pressed", String(x === b)); });
        desenhar();
      });
      if (!B()) P.avisar(P.$(".avisos", s), "Não encontrei o arquivo js/biblioteca.js. Sem ele, o conteúdo do checklist não aparece. O resto do painel continua funcionando.");
      await carregarMarcados();
      desenhar();
    }
  };

  async function carregarMarcados() {
    const r = await P.ler("marcados");
    if (r.erro) {
      salvaNoBanco = false;
      P.avisar(P.$(".avisos", secao), r.erro + " Você ainda pode marcar os itens, mas eles não ficam salvos até isso ser resolvido.");
    }
    marcados = new Set(r.dados.map((m) => m.chave));
  }

  function desenhar() {
    const alvo = P.$("#ck-conteudo", secao);
    if (!B()) { alvo.innerHTML = `<p class="vazio">O conteúdo aparece aqui quando o arquivo js/biblioteca.js estiver no projeto.</p>`; return; }
    if (atual === "check") desenharChecklist(alvo);
    if (atual === "refs") desenharReferencias(alvo);
    if (atual === "roteiros") desenharRoteiros(alvo);
    if (atual === "nichos") desenharNichos(alvo);
    if (atual === "revisar") desenharRevisao(alvo);
  }

  /* ---------- 1. Checklist do portfólio ---------- */
  const chaveItem = (secaoId, i) => `checklist:${secaoId}:${i}`;

  function desenharChecklist(alvo) {
    const secoes = lista("CHECKLIST");
    alvo.onclick = null;
    alvo.innerHTML = `
      <div class="cartao progresso-geral">
        <b>Seu portfólio no geral</b>
        <span class="mudo" id="ck-geral-texto"></span>
        <div class="progresso"><span id="ck-geral-barra" style="width:0%"></span></div>
      </div>
      ${secoes.map((s) => `
        <details class="secao-check" data-secao="${P.esc(s.id)}">
          <summary>
            <span class="emoji" aria-hidden="true">${P.esc(s.emoji)}</span>
            <span><h3>${P.esc(s.nome)}</h3><span class="resumo">${P.esc(s.resumo)}</span></span>
            <span class="contagem" data-contagem></span>
            <span class="progresso"><span data-barra style="width:0%"></span></span>
          </summary>
          <div class="secao-corpo">
            <p class="porque"><b>Por que</b>${P.esc(s.porque)}</p>
            ${(s.itens || []).map((it, i) => {
              const chave = chaveItem(s.id, i);
              return `<label class="item-check">
                <input type="checkbox" data-chave="${P.esc(chave)}"${marcados.has(chave) ? " checked" : ""}>
                <span class="t">${P.esc(it.t)}</span>
                <span class="d">${P.esc(it.d)}</span>
              </label>`;
            }).join("")}
          </div>
        </details>`).join("")}`;
    alvo.onchange = async (e) => {
      const caixa = e.target.closest("input[data-chave]");
      if (!caixa) return;
      const chave = caixa.dataset.chave;
      if (caixa.checked) marcados.add(chave); else marcados.delete(chave);
      atualizarProgresso(alvo);
      if (!salvaNoBanco) return;
      try {
        const { error } = caixa.checked
          ? await banco.from("marcados").upsert({ chave })
          : await banco.from("marcados").delete().eq("chave", chave);
        if (error) throw error;
      } catch (erro) {
        P.toast(P.explicarErro(erro, "marcados"), "erro");
      }
    };
    atualizarProgresso(alvo);
  }

  function atualizarProgresso(alvo) {
    let total = 0, feitos = 0;
    lista("CHECKLIST").forEach((s) => {
      const qtd = (s.itens || []).length;
      const ok = (s.itens || []).filter((_, i) => marcados.has(chaveItem(s.id, i))).length;
      total += qtd; feitos += ok;
      const bloco = P.$(`[data-secao="${CSS.escape(s.id)}"]`, alvo);
      if (!bloco) return;
      P.$("[data-contagem]", bloco).textContent = `${ok} de ${qtd}`;
      P.$("[data-barra]", bloco).style.width = `${Math.round(P.divide(ok, qtd) * 100)}%`;
    });
    const pct = Math.round(P.divide(feitos, total) * 100);
    P.$("#ck-geral-texto", alvo).textContent = `${feitos} de ${total} itens prontos (${pct}%)`;
    P.$("#ck-geral-barra", alvo).style.width = `${pct}%`;
  }

  /* ---------- 2. Referências de vídeo ---------- */
  function desenharReferencias(alvo) {
    const refs = lista("REFERENCIAS");
    if (!refs.length) { alvo.innerHTML = `<p class="vazio">Nenhuma referência na biblioteca.</p>`; return; }
    alvo.innerHTML = `<div class="grade-ref">${refs.map((r) => {
      const id = idYoutube(r.youtube);
      return `<button class="ref" type="button" data-ref="${P.esc(r.id)}">
        <span class="ref-capa c-${P.esc(r.cor)}">
          ${id ? `<img src="https://i.ytimg.com/vi/${id}/oar2.jpg" alt="" loading="lazy" onerror="this.remove()">` : ""}
          <span class="emoji" aria-hidden="true">${P.esc(r.emoji)}</span>
        </span>
        <span class="ref-info"><b>${P.esc(r.titulo)}</b><small>${P.esc(r.estilo)} · ${P.esc(r.duracao)} · ${P.esc(r.marca)}</small></span>
      </button>`;
    }).join("")}</div>`;
    alvo.onclick = (e) => {
      const b = e.target.closest("[data-ref]");
      if (!b) return;
      const r = refs.find((x) => x.id === b.dataset.ref);
      if (r) abrirFicha(r);
    };
    alvo.onchange = null;
  }

  function abrirFicha(r) {
    P.ver(`${r.emoji} ${r.titulo}`, `
      <div class="ficha">
        <div class="grupo-botoes">
          ${P.pilula(r.estilo, "ciano")} ${r.audiencia ? P.pilula(r.audiencia, "cinza") : ""} ${P.pilula(r.duracao, "cinza")} ${P.pilula(r.marca, "pessego")}
        </div>
        <h3>O gancho</h3><p class="gancho">${P.esc(r.gancho)}</p>
        <h3>Por que funciona</h3><p>${P.esc(r.porque)}</p>
        <h3>O diferencial</h3><p>${P.esc(r.diferencial)}</p>
        <h3>O erro comum</h3><p>${P.esc(r.erro)}</p>
        <h3>O roteiro em blocos</h3>
        <div class="blocos-tempo">${(r.roteiro || []).map((b) => `<div class="bloco-tempo"><span class="tempo">${P.esc(b.t)}</span><span>${comNegrito(b.o)}</span></div>`).join("")}</div>
        ${r.youtube ? `<div class="grupo-botoes" style="margin-top:16px"><a class="botao botao-principal" href="${P.esc(r.youtube)}" target="_blank" rel="noopener">${P.icone("play", "ico-p")}Assistir</a></div>` : ""}
      </div>`);
  }

  /* ---------- 3. Roteiros ---------- */
  function desenharRoteiros(alvo) {
    const tipos = lista("TIPOS");
    alvo.onclick = null; alvo.onchange = null;
    if (!tipos.length) { alvo.innerHTML = `<p class="vazio">Nenhum roteiro na biblioteca.</p>`; return; }
    alvo.innerHTML = tipos.map((t) => `
      <details class="secao-check">
        <summary>
          <span class="emoji" aria-hidden="true">${P.esc(t.emoji)}</span>
          <span><h3>${P.esc(t.nome)}</h3></span>
          <span class="pilula p-cinza">${P.esc(t.duracao)}</span>
        </summary>
        <div class="secao-corpo ficha">
          <p class="porque"><b>Quando usar</b>${P.esc(t.porque)}</p>
          <h3>Os blocos de tempo</h3>
          <div class="blocos-tempo">${(t.beats || []).map((b) => `<div class="bloco-tempo"><span class="tempo">${P.esc(b.t)}</span><span>${comNegrito(b.o)}</span></div>`).join("")}</div>
          ${(t.erros || []).length ? `<h3>Erros comuns</h3><ul class="lista-erros">${t.erros.map((x) => `<li>${P.esc(x)}</li>`).join("")}</ul>` : ""}
        </div>
      </details>`).join("");
  }

  /* ---------- 4. Ideias por nicho ---------- */
  function desenharNichos(alvo) {
    const nichos = lista("NICHOS");
    const dicas = lista("COMO_USAR");
    alvo.onclick = null; alvo.onchange = null;
    if (!nichos.length) { alvo.innerHTML = `<p class="vazio">Nenhum nicho na biblioteca.</p>`; return; }
    alvo.innerHTML = `
      ${dicas.length ? `<div class="cartao bloco"><div class="cartao-topo"><h2>Como usar os ganchos</h2></div><div class="cartao-corpo"><ul class="dicas">${dicas.map((d) => `<li>${P.esc(d)}</li>`).join("")}</ul></div></div>` : ""}
      <div class="grade-nichos">${nichos.map((n) => `
        <div class="cartao">
          <div class="cartao-topo"><h2><span aria-hidden="true">${P.esc(n.emoji)}</span> ${P.esc(n.nome)}</h2></div>
          <div class="cartao-corpo">${(n.ideias || []).map((i) => `<div class="ideia"><b>${P.esc(i.t)}</b><i>"${P.esc(i.gancho)}"</i></div>`).join("")}</div>
        </div>`).join("")}</div>`;
  }

  /* ---------- 5. Revisar meu roteiro ---------- */
  // O texto e as marcações da revisão ficam só neste computador (é rascunho).
  const guardar = (k, v) => { try { localStorage.setItem(k, v); } catch (e) { /* sem problema */ } };
  const pegar = (k) => { try { return localStorage.getItem(k) || ""; } catch (e) { return ""; } };

  function desenharRevisao(alvo) {
    const blocos = lista("REVISAO");
    let marcadosRevisao = new Set(pegar("revisao-marcados").split("|").filter(Boolean));
    alvo.onclick = null;
    alvo.innerHTML = `
      <div class="revisao">
        <div>
          <label class="sr" for="ck-roteiro">Cole seu roteiro</label>
          <textarea id="ck-roteiro" placeholder="Cole aqui o seu roteiro para conferir item por item.">${P.esc(pegar("revisao-texto"))}</textarea>
          <p class="mudo pequeno" id="ck-palavras" style="margin-top:6px"></p>
        </div>
        <div>
          <div class="cartao progresso-geral">
            <b>Conferidos</b><span class="mudo" id="ck-rev-texto"></span>
            <div class="progresso"><span id="ck-rev-barra" style="width:0%"></span></div>
          </div>
          ${blocos.map((b, bi) => `
            <div class="secao-check">
              <div class="secao-corpo" style="padding-top:12px">
                <h3 style="font-size:14px;margin-bottom:6px"><span aria-hidden="true">${P.esc(b.emoji)}</span> ${P.esc(b.bloco)}</h3>
                ${(b.itens || []).map((it, ii) => {
                  const chave = `${bi}:${ii}`;
                  return `<label class="item-check"><input type="checkbox" data-rev="${chave}"${marcadosRevisao.has(chave) ? " checked" : ""}><span class="t">${P.esc(it.t)}</span><span class="d">${P.esc(it.d)}</span></label>`;
                }).join("")}
              </div>
            </div>`).join("")}
          <button class="botao" type="button" id="ck-rev-limpar">Começar outra revisão</button>
        </div>
      </div>`;
    const texto = P.$("#ck-roteiro", alvo);
    const contar = () => {
      const palavras = texto.value.trim() ? texto.value.trim().split(/\s+/).length : 0;
      const segundos = Math.round(palavras / 2.5);
      P.$("#ck-palavras", alvo).textContent = palavras ? `${P.plural(palavras, "palavra", "palavras")}, cerca de ${P.plural(segundos, "segundo", "segundos")} falando` : "";
    };
    const progresso = () => {
      const total = blocos.reduce((s, b) => s + (b.itens || []).length, 0);
      const pct = Math.round(P.divide(marcadosRevisao.size, total) * 100);
      P.$("#ck-rev-texto", alvo).textContent = `${marcadosRevisao.size} de ${total} (${pct}%)`;
      P.$("#ck-rev-barra", alvo).style.width = `${pct}%`;
    };
    texto.addEventListener("input", () => { guardar("revisao-texto", texto.value); contar(); });
    alvo.onchange = (e) => {
      const caixa = e.target.closest("input[data-rev]");
      if (!caixa) return;
      if (caixa.checked) marcadosRevisao.add(caixa.dataset.rev); else marcadosRevisao.delete(caixa.dataset.rev);
      guardar("revisao-marcados", [...marcadosRevisao].join("|"));
      progresso();
    };
    P.$("#ck-rev-limpar", alvo).addEventListener("click", () => {
      if (!confirm("Limpar o roteiro e todas as marcações da revisão?")) return;
      marcadosRevisao = new Set();
      guardar("revisao-marcados", "");
      guardar("revisao-texto", "");
      desenharRevisao(alvo);
    });
    contar();
    progresso();
  }
})();
