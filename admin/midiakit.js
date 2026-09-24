/* =========================================================
   ABA MÍDIA KIT
   Um mídia kit só, com link próprio, que você manda para as marcas.

   Os números não são digitados: vêm do Instagram pela aba Visão Geral
   e se atualizam sozinhos. É isso que resolve o problema do mídia kit
   em PDF, que nasce velho no dia seguinte.

   O que você edita aqui é o texto de apresentação e a tabela de
   formatos e valores. A marca abre pelo link e vê só isso, mais os
   números: nada de lead, de cupom ou de valor de campanha aparece.
   ========================================================= */
(function () {
  "use strict";
  const P = window.Painel;

  const PAGINA = "../midiakit.html";

  let secao = null;
  let kit = null;

  P.abas.midiakit = {
    async iniciar(s) {
      secao = s;
      s.innerHTML = `<div class="avisos"></div><div id="mk-conteudo"><p class="carregando">Carregando...</p></div>`;
      s.addEventListener("click", aoClicar);
      await carregar();
    },
    async aoMostrar() { await carregar(); }
  };

  async function carregar() {
    const avisos = P.$(".avisos", secao);
    P.limparAvisos(avisos);
    const r = await P.lerSeguro("midiakit");
    if (r.erro) {
      P.avisar(avisos, r.erro + " O arquivo é o midiakit.sql.");
      kit = null;
    } else {
      kit = r.dados[0] || null;
    }
    desenhar();
  }

  const endereco = () => (kit ? location.origin + location.pathname.replace(/admin\/?$/, "") + "midiakit.html?k=" + kit.token : "");

  function desenhar() {
    const alvo = P.$("#mk-conteudo", secao);
    if (!kit) {
      alvo.innerHTML = `<div class="cartao"><p class="vazio"><b>O mídia kit ainda não existe no banco.</b><br>
        Rode o arquivo midiakit.sql no SQL Editor do Supabase.</p></div>`;
      return;
    }

    const formatos = Array.isArray(kit.formatos) ? kit.formatos : [];
    const link = endereco();

    alvo.innerHTML = `
      <div class="numeros" style="--colunas:3">
        ${numero("Quem abriu", P.inteiro(kit.visualizacoes), kit.visto_em ? "última vez em " + P.dataBR(String(kit.visto_em).slice(0, 10)) : "ninguém abriu ainda")}
        ${numero("Formatos na tabela", P.inteiro(formatos.length), kit.mostrar_valores ? "com valores à mostra" : "valores escondidos")}
        ${numero("Link", kit.link_ligado ? "No ar" : "Desligado", kit.link_ligado ? "quem tem o endereço consegue abrir" : "ninguém consegue abrir agora")}
      </div>

      <div class="rt-link-caixa bloco">
        <b>O link que você manda para a marca</b>
        <p class="rt-link-texto" id="mk-link">${P.esc(link)}</p>
        <div class="grupo-botoes">
          <button class="botao botao-principal" type="button" id="mk-copiar">${P.icone("copiar", "ico-p")}Copiar o link</button>
          <a class="botao" href="${P.esc(PAGINA)}?k=${P.esc(kit.token)}" target="_blank" rel="noopener">${P.icone("olho", "ico-p")}Ver como a marca vê</a>
          <button class="botao" type="button" id="mk-ligar">${P.icone(kit.link_ligado ? "olho-fechado" : "olho", "ico-p")}${kit.link_ligado ? "Desligar o link" : "Ligar o link"}</button>
          <button class="botao botao-perigo empurra" type="button" id="mk-novo-token">${P.icone("recarregar", "ico-p")}Gerar link novo</button>
        </div>
        <p class="mudo pequeno">Gerar um link novo derruba o antigo na hora. Use se você mandou para a marca errada.</p>
      </div>

      <div class="duas-colunas">
        <div class="cartao">
          <div class="cartao-topo"><h2>Quem sou</h2>
            <button class="botao botao-icone" type="button" id="mk-editar-texto" aria-label="Editar apresentação">${P.icone("editar")}</button>
          </div>
          <div class="cartao-corpo">
            <p style="white-space:pre-line">${P.esc(kit.apresentacao) || `<span class="mudo">Sem texto ainda. Clique no lápis para escrever.</span>`}</p>
          </div>
        </div>
        <div class="cartao">
          <div class="cartao-topo"><h2>Os números</h2></div>
          <div class="cartao-corpo">
            <p class="mudo pequeno">Seguidores, alcance, visualizações, engajamento e salvamentos entram sozinhos,
            do que a aba Visão Geral guardou. Se estiverem velhos, é só clicar em atualizar lá.</p>
          </div>
        </div>
      </div>

      <div class="cartao bloco">
        <div class="cartao-topo">
          <h2>O que eu entrego</h2>
          <div class="grupo-botoes">
            <label class="au-ligar"><input type="checkbox" id="mk-valores"${kit.mostrar_valores ? " checked" : ""}>Mostrar valores</label>
            <button class="botao" type="button" id="mk-novo-formato">${P.icone("mais", "ico-p")}Novo formato</button>
          </div>
        </div>
        ${formatos.length ? `<div class="tabela-rolagem"><table class="tabela">
          <thead><tr><th>Formato</th><th>Descrição</th><th>Valor</th><th class="acoes"></th></tr></thead>
          <tbody>${formatos.map((f, i) => `<tr class="clicavel" data-formato="${i}">
            <td><b>${P.esc(f.nome)}</b></td>
            <td class="corta">${P.esc(f.descricao) || `<span class="mudo">-</span>`}</td>
            <td class="curta">${P.esc(f.valor) || `<span class="mudo">sob consulta</span>`}</td>
            <td class="acoes"><button class="botao botao-icone" type="button" data-apagar="${i}" aria-label="Apagar ${P.esc(f.nome)}">${P.icone("lixo")}</button></td>
          </tr>`).join("")}</tbody>
        </table></div>` : `<p class="vazio">Nenhum formato ainda. Clique em "Novo formato".</p>`}
        <div class="cartao-corpo"><p class="mudo pequeno">
          Clique numa linha para editar. Deixe o valor vazio para aparecer como "sob consulta".
        </p></div>
      </div>`;
  }

  function numero(rotulo, valor, sub) {
    return `<div class="numero"><div class="numero-rotulo">${P.esc(rotulo)}</div>
      <div class="numero-valor">${P.esc(valor)}</div>
      <div class="numero-sub">${P.esc(sub)}</div></div>`;
  }

  /* ---------- Gravar ---------- */
  async function salvar(valores) {
    const erro = await P.gravar("midiakit", "atualizar", { ...valores, atualizado_em: new Date().toISOString() }, true);
    if (erro) { P.toast(erro, "erro"); return false; }
    await carregar();
    return true;
  }

  /* ---------- Cliques ---------- */
  async function aoClicar(e) {
    if (e.target.closest("#mk-copiar")) return copiarLink();
    if (e.target.closest("#mk-editar-texto")) return editarTexto();
    if (e.target.closest("#mk-novo-formato")) return editarFormato(null);
    if (e.target.closest("#mk-ligar")) {
      if (await salvar({ link_ligado: !kit.link_ligado })) {
        P.toast(kit.link_ligado ? "Link no ar." : "Link desligado.");
      }
      return;
    }
    if (e.target.closest("#mk-novo-token")) return trocarToken();

    const apagar = e.target.closest("[data-apagar]");
    if (apagar) return apagarFormato(Number(apagar.dataset.apagar));

    const linha = e.target.closest("[data-formato]");
    if (linha) return editarFormato(Number(linha.dataset.formato));
  }

  async function copiarLink() {
    try {
      await navigator.clipboard.writeText(endereco());
      P.toast("Link copiado.");
    } catch (erro) {
      const faixa = document.createRange();
      faixa.selectNodeContents(P.$("#mk-link", secao));
      const s = window.getSelection();
      s.removeAllRanges();
      s.addRange(faixa);
      P.toast("Selecionei o link. Copie com Ctrl+C.");
    }
  }

  async function trocarToken() {
    if (!confirm("Gerar um link novo? O link antigo para de funcionar na hora, inclusive para quem já recebeu.")) return;
    // 24 letras e números, sorteados pelo navegador
    const bytes = new Uint8Array(12);
    crypto.getRandomValues(bytes);
    const novo = [...bytes].map((b) => b.toString(16).padStart(2, "0")).join("");
    if (await salvar({ token: novo })) P.toast("Link novo gerado. O antigo morreu.");
  }

  function editarTexto() {
    P.formulario({
      titulo: "Quem sou",
      valores: kit,
      campos: [
        { nome: "apresentacao", rotulo: "Texto de apresentação", tipo: "texto-longo", largo: true,
          ajuda: "Duas ou três frases. É a primeira coisa que a marca lê depois dos números." }
      ],
      aoSalvar: async (v) => {
        const erro = await P.gravar("midiakit", "atualizar", { apresentacao: v.apresentacao, atualizado_em: new Date().toISOString() }, true);
        if (erro) return erro;
        P.toast("Texto salvo.");
        await carregar();
        return null;
      }
    });
  }

  function editarFormato(indice) {
    const formatos = Array.isArray(kit.formatos) ? [...kit.formatos] : [];
    const novo = indice === null;
    const f = novo ? { nome: "", descricao: "", valor: "" } : formatos[indice];
    P.formulario({
      titulo: novo ? "Novo formato" : f.nome || "Formato",
      valores: f,
      campos: [
        { nome: "nome", rotulo: "Nome do formato", tipo: "texto", obrigatorio: true, ajuda: "Ex.: Vídeo UGC, Reels no meu perfil" },
        { nome: "descricao", rotulo: "O que está incluso", tipo: "texto", largo: true },
        { nome: "valor", rotulo: "Valor", tipo: "texto", ajuda: "Escreva como quiser: R$ 450, a partir de R$ 300. Vazio vira sob consulta" }
      ],
      aoSalvar: async (v) => {
        const item = { nome: v.nome, descricao: v.descricao, valor: v.valor };
        if (novo) formatos.push(item); else formatos[indice] = item;
        const erro = await P.gravar("midiakit", "atualizar", { formatos, atualizado_em: new Date().toISOString() }, true);
        if (erro) return erro;
        P.toast(novo ? "Formato criado." : "Formato salvo.");
        await carregar();
        return null;
      },
      aoApagar: novo ? null : async () => {
        formatos.splice(indice, 1);
        const erro = await P.gravar("midiakit", "atualizar", { formatos, atualizado_em: new Date().toISOString() }, true);
        if (erro) return erro;
        P.toast("Formato apagado.");
        await carregar();
        return null;
      }
    });
  }

  async function apagarFormato(indice) {
    const formatos = Array.isArray(kit.formatos) ? [...kit.formatos] : [];
    const f = formatos[indice];
    if (!f || !confirm(`Apagar "${f.nome}" da tabela?`)) return;
    formatos.splice(indice, 1);
    if (await salvar({ formatos })) P.toast("Formato apagado.");
  }

  // A chavinha de mostrar valores fica fora do aoClicar porque é um change
  document.addEventListener("change", async (e) => {
    if (!e.target.closest("#mk-valores")) return;
    if (await salvar({ mostrar_valores: e.target.checked })) {
      P.toast(e.target.checked ? "Valores à mostra." : "Valores escondidos.");
    }
  });
})();
