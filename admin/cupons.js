/* =========================================================
   ABA CUPONS
   Os seus códigos de desconto. O que você cadastra aqui aparece
   sozinho na página de links da bio, sem mexer em código.

   A página de links não lê esta tabela: ela lê a vista
   "cupons_publicos", que mostra só marca, código, link e descrição,
   e só dos cupons ligados e dentro da validade. Comissão e anotação
   ficam aqui dentro, e ninguém de fora enxerga.
   ========================================================= */
(function () {
  "use strict";
  const P = window.Painel;

  const PAGINA_DE_LINKS = "../links/";

  let secao = null;
  let cupons = [];

  P.abas.cupons = {
    async iniciar(s) {
      secao = s;
      s.innerHTML = `
        <div class="avisos"></div>
        <div class="numeros" id="cu-numeros" style="--colunas:3"></div>
        <div class="ferramentas">
          <p class="mudo pequeno" style="flex:1 1 260px;min-width:0">
            O que estiver ligado e dentro da validade aparece na sua página de links, na hora.
          </p>
          <div class="grupo-botoes empurra">
            <a class="botao" href="${PAGINA_DE_LINKS}" target="_blank" rel="noopener">${P.icone("link", "ico-p")}Ver a página</a>
            <button class="botao botao-principal" type="button" id="cu-novo">${P.icone("mais", "ico-p")}Novo cupom</button>
          </div>
        </div>
        <div class="cartao">
          <div class="tabela-rolagem">
            <table class="tabela">
              <thead><tr>
                <th class="num">Ordem</th><th>Marca</th><th>Código</th><th>Descrição</th>
                <th>Comissão</th><th>Validade</th><th>No ar</th>
              </tr></thead>
              <tbody id="cu-lista"><tr><td colspan="7" class="carregando">Carregando...</td></tr></tbody>
            </table>
          </div>
        </div>
        <p class="mudo pequeno" style="margin-top:8px">
          Clique numa linha para editar. A ordem manda: número menor aparece primeiro na página.
        </p>`;
      P.$("#cu-novo", s).addEventListener("click", () => abrir(null));
      P.$("#cu-lista", s).addEventListener("click", aoClicar);
      P.$("#cu-lista", s).addEventListener("change", ligarOuPausar);
      await carregar();
    },
    async aoMostrar() { await carregar(); }
  };

  async function carregar() {
    const avisos = P.$(".avisos", secao);
    P.limparAvisos(avisos);
    const r = await P.lerSeguro("cupons", (q) => q.order("ordem").order("marca"));
    if (r.erro) P.avisar(avisos, r.erro + " O arquivo é o cupons.sql.");
    cupons = r.dados;
    desenhar();
  }

  /* ---------- Quanto falta para vencer ----------
     Devolve null quando não tem validade, negativo quando já venceu. */
  const diasParaVencer = (c) => (c.validade ? P.diasAte(c.validade) : null);

  function situacao(c) {
    const dias = diasParaVencer(c);
    if (!c.ativo) return { texto: "Pausado", cor: "cinza" };
    if (dias !== null && dias < 0) return { texto: "Venceu", cor: "vermelho" };
    if (dias !== null && dias <= 7) return { texto: P.plural(dias, "dia", "dias"), cor: "amarelo" };
    return { texto: "No ar", cor: "verde" };
  }

  function desenhar() {
    const noAr = cupons.filter((c) => c.ativo && (diasParaVencer(c) === null || diasParaVencer(c) >= 0));
    const vencendo = cupons.filter((c) => c.ativo && diasParaVencer(c) !== null && diasParaVencer(c) >= 0 && diasParaVencer(c) <= 30);
    const venceram = cupons.filter((c) => c.ativo && diasParaVencer(c) !== null && diasParaVencer(c) < 0);

    P.$("#cu-numeros", secao).innerHTML = `
      ${numero("Na página agora", P.inteiro(noAr.length), P.plural(cupons.length, "cupom cadastrado", "cupons cadastrados"))}
      ${numero("Vencendo em 30 dias", P.inteiro(vencendo.length), vencendo.length ? vencendo.map((c) => c.marca).join(", ") : "nenhum por enquanto")}
      ${numero("Já venceram", P.inteiro(venceram.length), venceram.length ? "ainda estão ligados, vale revisar" : "nada vencido")}`;

    const lista = P.$("#cu-lista", secao);
    if (!cupons.length) {
      lista.innerHTML = `<tr><td colspan="7" class="vazio">
        <b>Nenhum cupom ainda.</b><br>Clique em "Novo cupom" para cadastrar o primeiro.</td></tr>`;
      return;
    }

    lista.innerHTML = cupons.map((c) => {
      const s = situacao(c);
      const venceu = c.ativo && diasParaVencer(c) !== null && diasParaVencer(c) < 0;
      return `<tr class="clicavel${venceu ? " escondido" : ""}" data-id="${P.esc(c.id)}" tabindex="0">
        <td class="num">${P.inteiro(c.ordem)}</td>
        <td><b>${P.esc(c.marca) || "<span class='mudo'>sem marca</span>"}</b></td>
        <td class="curta"><span class="pilula p-ciano">${P.esc(c.codigo)}</span></td>
        <td class="corta">${P.esc(c.descricao) || `<span class="mudo">-</span>`}</td>
        <td class="curta">${P.esc(c.comissao) || `<span class="mudo">-</span>`}</td>
        <td class="curta">${c.validade ? P.dataBR(c.validade) : `<span class="mudo">sem prazo</span>`} ${P.pilula(s.texto, s.cor)}</td>
        <td class="acoes"><label class="au-ligar" data-parar>
          <input type="checkbox" data-ligar="${P.esc(c.id)}"${c.ativo ? " checked" : ""}>
          <span class="sr">Ligar ou pausar ${P.esc(c.marca)}</span></label></td>
      </tr>`;
    }).join("");
  }

  function numero(rotulo, valor, sub) {
    return `<div class="numero"><div class="numero-rotulo">${P.esc(rotulo)}</div>
      <div class="numero-valor">${P.esc(valor)}</div>
      <div class="numero-sub">${P.esc(sub)}</div></div>`;
  }

  function aoClicar(e) {
    if (e.target.closest("[data-parar]")) return;
    const linha = e.target.closest("tr[data-id]");
    if (linha) abrir(cupons.find((c) => String(c.id) === linha.dataset.id));
  }

  async function ligarOuPausar(e) {
    const chave = e.target.closest("[data-ligar]");
    if (!chave) return;
    chave.disabled = true;
    const erro = await P.gravar("cupons", "atualizar", { ativo: chave.checked }, chave.dataset.ligar);
    chave.disabled = false;
    if (erro) { chave.checked = !chave.checked; return P.toast(erro, "erro"); }
    P.toast(chave.checked ? "Cupom no ar." : "Cupom fora da página.");
    await carregar();
  }

  function abrir(c) {
    const novo = !c;
    const proximaOrdem = cupons.length ? Math.max(...cupons.map((x) => P.num(x.ordem))) + 1 : 1;
    P.formulario({
      titulo: novo ? "Novo cupom" : `Cupom da ${c.marca || "marca"}`,
      valores: c || { ativo: true, ordem: proximaOrdem },
      campos: [
        { nome: "marca", rotulo: "Marca ou loja", tipo: "texto", obrigatorio: true, ajuda: "É este nome que aparece na página" },
        { nome: "codigo", rotulo: "Código do cupom", tipo: "texto", obrigatorio: true },
        { nome: "link", rotulo: "Link da loja", tipo: "url", largo: true, ajuda: "Para onde o botão Ir à loja leva" },
        { nome: "descricao", rotulo: "Desconto", tipo: "texto", ajuda: "Ex.: 30% OFF. Aparece na página, ao lado da marca" },
        { nome: "comissao", rotulo: "Sua comissão", tipo: "texto", ajuda: "Só você vê. Ex.: 10% por venda" },
        { nome: "validade", rotulo: "Vence em", tipo: "data", ajuda: "Deixe vazio se não tem prazo. Vencido some da página sozinho" },
        { nome: "ordem", rotulo: "Ordem na página", tipo: "numero" },
        { nome: "ativo", rotulo: "Mostrar na página de links", tipo: "marcar" },
        { nome: "obs", rotulo: "Anotações", tipo: "texto-longo", largo: true, ajuda: "Só você vê. Contato da marca, regras da parceria, o que for" }
      ],
      aoSalvar: async (v) => {
        const valores = {
          marca: v.marca, codigo: v.codigo, link: v.link, descricao: v.descricao,
          comissao: v.comissao, obs: v.obs, ordem: v.ordem,
          validade: v.validade || null, ativo: v.ativo
        };
        const erro = novo
          ? await P.gravar("cupons", "inserir", valores)
          : await P.gravar("cupons", "atualizar", valores, c.id);
        if (erro) return erro;
        P.toast(novo ? "Cupom criado." : "Cupom salvo.");
        await carregar();
        return null;
      },
      aoApagar: novo ? null : async () => {
        const erro = await P.gravar("cupons", "apagar", null, c.id);
        if (erro) return erro;
        P.toast("Cupom apagado.");
        await carregar();
        return null;
      }
    });
  }
})();
