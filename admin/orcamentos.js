/* =========================================================
   ABA ORÇAMENTOS
   Você monta a proposta aqui (pacotes, descontos, condições)
   e manda um link para a marca. A marca abre a página
   orcamento.html, vê só aquele orçamento e escolhe um pacote
   pelo botão, que leva para o seu WhatsApp.

   O painel mostra quantas vezes a marca abriu o link e qual
   pacote ela clicou por último. O contato da marca e as suas
   anotações nunca aparecem na página dela.
   ========================================================= */
(function () {
  "use strict";
  const P = window.Painel;

  const TABELA = "orcamentos";
  const STATUS = [["Rascunho", "cinza"], ["Enviado", "ciano"], ["Negociando", "amarelo"], ["Aprovado", "verde"], ["Recusado", "vermelho"]];
  const corStatus = (s) => (STATUS.find((x) => x[0] === s) || [s, "cinza"])[1];

  // O que é gravado no banco. Token, contadores e escolha da marca ficam de fora.
  const CAMPOS = ["marca", "contato_nome", "contato_email", "contato_telefone", "status", "selo", "titulo", "destaque",
    "apresentacao", "cor", "cor_ativa", "pacotes", "adicionais", "observacoes", "validade",
    "contato_titulo", "contato_texto", "whatsapp", "email", "instagram", "notas"];

  // Textos de partida de um orçamento novo. São sugestões: revise antes de mandar.
  const OBS_PADRAO = [
    { titulo: "Entrega e ajustes", texto: "O prazo começa a contar quando eu recebo o produto (quando houver envio) e o briefing completo, com tudo o que a marca precisa que apareça no vídeo.\n\nCada vídeo inclui 1 rodada de ajustes." },
    { titulo: "Direitos de uso", texto: "Uso orgânico nas redes da marca. Uso em anúncios (tráfego pago) e prazos maiores são combinados à parte." },
    { titulo: "Pagamento", texto: "50% na aprovação da proposta e 50% na entrega dos vídeos." }
  ];
  const PADRAO = {
    marca: "", contato_nome: "", contato_email: "", contato_telefone: "", status: "Rascunho",
    selo: "Proposta comercial · UGC", titulo: "Proposta", destaque: "",
    apresentacao: "Separei alguns formatos pensando no momento da sua marca. Escolha o que fizer mais sentido, e se quiser ajustar alguma coisa é só me chamar.",
    cor: "#a7ebf2", cor_ativa: false,
    pacotes: [], adicionais: [], observacoes: OBS_PADRAO, validade: null,
    contato_titulo: "Vamos tirar essa campanha do papel?",
    contato_texto: "Me chama para fechar um pacote, tirar uma dúvida ou montar um formato sob medida para a sua marca.",
    whatsapp: "5541998669857", email: "contatoalannaclara@gmail.com", instagram: "_alannaclara", notas: ""
  };
  const pacoteVazio = () => ({ nome: "", descricao: "", itens: [], valor_cheio: 0, valor: 0, prazo: "7 dias úteis", uso: "", destaque: false, botao: "" });

  let secao = null;
  let lista = [];
  let marcas = [];         // a sua base de marcas, para sugerir o nome e o contato
  let filtro = "todos";
  let busca = "";
  let atual = null;        // o orçamento aberto no editor (uma cópia, só vai para o banco ao salvar)
  let sujo = false;

  P.abas.orcamentos = {
    async iniciar(s) {
      secao = s;
      s.innerHTML = `<div class="avisos"></div><div id="oc-conteudo"><p class="carregando">Carregando...</p></div>`;
      s.addEventListener("click", aoClicar);
      s.addEventListener("input", aoDigitar);
      s.addEventListener("change", aoMudar);
      window.addEventListener("beforeunload", (e) => { if (sujo) { e.preventDefault(); e.returnValue = ""; } });
      await carregar();
    },
    // Voltar para a aba não apaga o que você está editando
    async aoMostrar() { if (!atual) await carregar(); }
  };

  /* ---------- Ajudantes ---------- */
  const erroDaTabela = (e) => P.explicarErro(e, TABELA).replace(/banco\.sql/g, "orcamentos.sql");
  const valorBR = (v) => {
    const n = P.num(v);
    return n > 0 ? n.toLocaleString("pt-BR", { style: "currency", currency: "BRL", minimumFractionDigits: n % 1 ? 2 : 0, maximumFractionDigits: 2 }) : "";
  };
  const desconto = (p) => (P.num(p.valor_cheio) > P.num(p.valor) && P.num(p.valor) > 0 ? Math.round((1 - P.num(p.valor) / P.num(p.valor_cheio)) * 100) : 0);
  const faixa = (pacotes) => {
    const v = (pacotes || []).map((p) => P.num(p.valor)).filter((n) => n > 0);
    if (!v.length) return "";
    const menor = Math.min(...v), maior = Math.max(...v);
    return menor === maior ? valorBR(menor) : `${valorBR(menor)} a ${valorBR(maior)}`;
  };
  const endereco = (o) => location.origin + location.pathname.replace(/admin\/?(index\.html)?$/, "") + "orcamento.html?t=" + o.token;
  const paginaDaMarca = (o) => "../orcamento.html?t=" + encodeURIComponent(o.token);

  function quandoFoi(iso) {
    const d = iso ? new Date(iso) : null;
    if (!d || isNaN(d)) return "";
    const seg = Math.round((Date.now() - d.getTime()) / 1000);
    if (seg < 3600) return seg < 120 ? "agora mesmo" : `há ${Math.round(seg / 60)} min`;
    if (seg < 86400) return `há ${P.plural(Math.round(seg / 3600), "hora", "horas")}`;
    const dias = Math.round(seg / 86400);
    if (dias === 1) return "ontem";
    if (dias < 30) return `há ${dias} dias`;
    return d.toLocaleDateString("pt-BR");
  }

  // "vence em 3 dias", "venceu"
  function textoValidade(iso) {
    if (!iso) return "";
    const dias = P.diasAte(iso);
    if (dias < 0) return `<span class="oc-vence venceu">venceu</span>`;
    if (dias === 0) return `<span class="oc-vence perto">vence hoje</span>`;
    if (dias <= 3) return `<span class="oc-vence perto">${P.plural(dias, "dia", "dias")}</span>`;
    return `<span class="oc-vence">${P.plural(dias, "dia", "dias")}</span>`;
  }

  // Tudo que vem do banco passa por aqui, para o editor nunca quebrar com campo faltando
  function arrumar(o) {
    const lista = (v) => (Array.isArray(v) ? v : []);
    const x = { ...PADRAO, ...o };
    x.pacotes = lista(o.pacotes).map((p) => ({ ...pacoteVazio(), ...p, itens: lista(p.itens) }));
    x.adicionais = lista(o.adicionais).map((a) => ({ nome: "", descricao: "", valor: "", max: 10, ...a }));
    x.observacoes = lista(o.observacoes).map((b) => ({ titulo: "", texto: "", ...b }));
    return x;
  }

  /* ---------- Carregar ---------- */
  async function carregar() {
    const avisos = P.$(".avisos", secao);
    P.limparAvisos(avisos);
    const [r, rm] = await Promise.all([
      P.lerSeguro(TABELA, (q) => q.order("atualizado_em", { ascending: false })),
      P.ler("marcas")
    ]);
    if (r.erro) P.avisar(avisos, r.erro.replace(/banco\.sql/g, "orcamentos.sql"));
    lista = r.dados.map(arrumar);
    marcas = rm.dados.filter((m) => m.nome && !m.exemplo);
    desenharLista();
  }

  /* =========================================================
     LISTA DOS ORÇAMENTOS
     ========================================================= */
  function desenharLista() {
    atual = null;
    sujo = false;
    const alvo = P.$("#oc-conteudo", secao);
    const conta = (s) => lista.filter((o) => o.status === s).length;
    const termo = busca.toLowerCase();
    const visiveis = lista.filter((o) => (filtro === "todos" || o.status === filtro) &&
      (!termo || [o.marca, o.titulo, o.destaque, o.contato_nome].some((c) => String(c || "").toLowerCase().includes(termo))));
    const numero = (rotulo, valor, sub) => `<div class="numero"><p class="numero-rotulo">${rotulo}</p><p class="numero-valor">${P.esc(valor)}</p>${sub ? `<p class="numero-sub">${P.esc(sub)}</p>` : ""}</div>`;

    alvo.innerHTML = `
      <div class="numeros" style="--colunas:4">
        ${numero("Orçamentos", P.inteiro(lista.length), conta("Rascunho") ? P.plural(conta("Rascunho"), "rascunho", "rascunhos") : "")}
        ${numero("A marca abriu", P.inteiro(lista.filter((o) => o.visualizacoes > 0).length), "pelo menos uma vez")}
        ${numero("Escolheram um pacote", P.inteiro(lista.filter((o) => o.escolha).length), "clicaram em um botão")}
        ${numero("Aprovados", P.inteiro(conta("Aprovado")), conta("Negociando") ? P.plural(conta("Negociando"), "negociando", "negociando") : "")}
      </div>
      <div class="ferramentas">
        <label class="busca"><span class="sr">Buscar</span>${P.icone("busca", "ico-p")}<input type="search" id="oc-busca" placeholder="Buscar por marca ou título" value="${P.esc(busca)}"></label>
        <div class="filtros" role="group" aria-label="Filtrar por situação">
          ${[["todos", "Todos"], ...STATUS.map(([s]) => [s, s])].map(([v, n]) =>
            `<button class="filtro" type="button" data-oc-filtro="${P.esc(v)}" aria-pressed="${filtro === v}">${P.esc(n)}<span class="qtd">${v === "todos" ? lista.length : conta(v)}</span></button>`).join("")}
        </div>
        <button class="botao botao-principal empurra" type="button" data-oc="novo">${P.icone("mais", "ico-p")}Novo orçamento</button>
      </div>
      <div class="cartao">
        ${!lista.length
          ? `<p class="vazio">Nenhum orçamento ainda. Clique em <b>Novo orçamento</b>, preencha os pacotes e as condições, e copie o link para mandar para a marca.<br>Ela abre uma página só com aquela proposta, e você fica sabendo aqui quando ela abriu e qual pacote escolheu.</p>`
          : !visiveis.length ? `<p class="vazio">Nenhum orçamento com essa busca ou filtro.</p>`
          : `<div class="tabela-rolagem"><table class="tabela">
            <thead><tr><th>Marca</th><th>Situação</th><th>Pacotes</th><th>Validade</th><th>A marca viu</th><th>Escolheu</th><th class="acoes">Ações</th></tr></thead>
            <tbody>${visiveis.map(linhaDaLista).join("")}</tbody>
          </table></div>`}
      </div>`;
  }

  function linhaDaLista(o) {
    const nomeTitulo = [o.titulo, o.destaque].filter(Boolean).join(" ");
    return `<tr class="clicavel" data-oc-abrir="${P.esc(o.id)}">
      <td><b>${P.esc(o.marca || "Sem marca")}</b>${nomeTitulo ? `<div class="mudo pequeno">${P.esc(nomeTitulo)}</div>` : ""}</td>
      <td>${P.pilula(o.status, corStatus(o.status))}${o.link_ligado ? "" : ` <span class="mudo pequeno" title="Ninguém consegue abrir o link agora">link desligado</span>`}</td>
      <td class="curta">${P.plural(o.pacotes.length, "pacote", "pacotes")}${faixa(o.pacotes) ? `<div class="mudo pequeno">${P.esc(faixa(o.pacotes))}</div>` : ""}</td>
      <td class="curta">${o.validade ? `${P.dataBR(o.validade)}<div>${textoValidade(o.validade)}</div>` : `<span class="mudo">sem prazo</span>`}</td>
      <td class="curta">${o.visualizacoes ? `${P.plural(o.visualizacoes, "vez", "vezes")}<div class="mudo pequeno">${P.esc(quandoFoi(o.visto_em))}</div>` : `<span class="mudo">ainda não</span>`}</td>
      <td class="corta">${o.escolha ? `<b>${P.esc(o.escolha)}</b><div class="mudo pequeno">${P.esc(quandoFoi(o.escolha_em))}</div>` : `<span class="mudo">-</span>`}</td>
      <td class="acoes">
        <button class="botao botao-icone" type="button" data-oc="copiar-lista" data-id="${P.esc(o.id)}" title="Copiar o link" aria-label="Copiar o link do orçamento de ${P.esc(o.marca)}">${P.icone("copiar")}</button>
        <a class="botao botao-icone" href="${P.esc(paginaDaMarca(o))}" target="_blank" rel="noopener" title="Ver como a marca vê" aria-label="Ver como a marca vê">${P.icone("olho")}</a>
        <button class="botao botao-icone" type="button" data-oc="duplicar-lista" data-id="${P.esc(o.id)}" title="Duplicar" aria-label="Duplicar o orçamento de ${P.esc(o.marca)}">${P.icone("mais")}</button>
        <button class="botao botao-icone" type="button" data-oc="apagar-lista" data-id="${P.esc(o.id)}" title="Apagar" aria-label="Apagar o orçamento de ${P.esc(o.marca)}">${P.icone("lixo")}</button>
      </td>
    </tr>`;
  }

  /* =========================================================
     EDITOR
     ========================================================= */
  function novo() {
    // Contato e condições vêm do último orçamento, para você não digitar tudo de novo
    const ultimo = lista[0];
    const base = ultimo
      ? { selo: ultimo.selo, observacoes: ultimo.observacoes, contato_titulo: ultimo.contato_titulo, contato_texto: ultimo.contato_texto,
          whatsapp: ultimo.whatsapp, email: ultimo.email, instagram: ultimo.instagram, apresentacao: ultimo.apresentacao }
      : {};
    abrirEditor(arrumar({ ...PADRAO, ...base, pacotes: [pacoteVazio()] }));
  }

  function abrirEditor(o) {
    atual = JSON.parse(JSON.stringify(arrumar(o)));
    sujo = false;
    desenharEditor();
    window.scrollTo(0, 0);
  }

  const campo = (rotulo, entrada, opc) => `<div class="campo${opc && opc.largo ? " largo" : ""}"><label${opc && opc.para ? ` for="${opc.para}"` : ""}>${rotulo}</label>${entrada}${opc && opc.ajuda ? `<span class="campo-ajuda">${opc.ajuda}</span>` : ""}</div>`;
  const texto = (nome, valor, extra) => `<input id="oc-${nome}" data-c="${nome}" type="text" value="${P.esc(valor)}"${extra || ""}>`;

  function desenharEditor() {
    const o = atual;
    const alvo = P.$("#oc-conteudo", secao);
    alvo.innerHTML = `
      <div class="oc-barra">
        <button class="botao" type="button" data-oc="voltar">${P.icone("esq", "ico-p")}Todos os orçamentos</button>
        <div class="oc-barra-titulo">
          <b id="oc-nome">${P.esc(o.marca || "Novo orçamento")}</b>
          <span class="oc-sujo pequeno" id="oc-sujo"${sujo ? "" : " hidden"}>alterações não salvas</span>
        </div>
        <div class="grupo-botoes empurra">
          ${o.id ? `<button class="botao" type="button" data-oc="duplicar">${P.icone("mais", "ico-p")}Duplicar</button>` : ""}
          <button class="botao" type="button" data-oc="ver">${P.icone("olho", "ico-p")}Ver como a marca vê</button>
          <button class="botao botao-principal" type="button" data-oc="salvar">${P.icone("check", "ico-p")}Salvar</button>
        </div>
      </div>

      <div class="oc-editor">
        <div class="oc-form">
          <section class="cartao">
            <div class="cartao-topo"><h2>Para quem é</h2></div>
            <div class="cartao-corpo grade-campos">
              ${campo("Marca *", texto("marca", o.marca, ` list="oc-marcas" required autocomplete="off"`) +
                `<datalist id="oc-marcas">${marcas.map((m) => `<option value="${P.esc(m.nome)}">`).join("")}</datalist>`,
                { para: "oc-marca", ajuda: "Escolha da sua base de marcas ou escreva. Aparece no topo da página." })}
              ${campo("Situação", `<select id="oc-status" data-c="status">${STATUS.map(([s]) => `<option${s === o.status ? " selected" : ""}>${s}</option>`).join("")}</select>`,
                { para: "oc-status", ajuda: "Só você vê. Ajuda a organizar a lista." })}
              ${campo("Nome de quem vai receber", texto("contato_nome", o.contato_nome), { para: "oc-contato_nome", ajuda: "Opcional. Aparece como \"Oi, Fulana!\" na página." })}
              ${campo("E-mail da marca", `<input id="oc-contato_email" data-c="contato_email" type="email" value="${P.esc(o.contato_email)}">`, { para: "oc-contato_email", ajuda: "Só você vê." })}
              ${campo("WhatsApp da marca", `<input id="oc-contato_telefone" data-c="contato_telefone" type="tel" value="${P.esc(o.contato_telefone)}">`, { para: "oc-contato_telefone", ajuda: "Só você vê." })}
            </div>
          </section>

          <section class="cartao">
            <div class="cartao-topo"><h2>Capa da página</h2></div>
            <div class="cartao-corpo grade-campos">
              ${campo("Etiqueta pequena", texto("selo", o.selo), { para: "oc-selo", ajuda: "Ex.: Proposta comercial · UGC" })}
              ${campo("Validade da proposta", `<input id="oc-validade" data-c="validade" type="date" value="${P.esc(o.validade ? String(o.validade).slice(0, 10) : "")}">`,
                { para: "oc-validade", ajuda: "A página mostra \"válida até\". Depois da data, ela avisa que venceu." })}
              ${campo("Título", texto("titulo", o.titulo), { para: "oc-titulo", ajuda: "Ex.: Pacotes" })}
              ${campo("Parte do título em destaque", texto("destaque", o.destaque), { para: "oc-destaque", ajuda: "Ex.: Black Friday. Aparece grifado, embaixo do título." })}
              ${campo("Texto de apresentação", `<textarea id="oc-apresentacao" data-c="apresentacao">${P.esc(o.apresentacao)}</textarea>`, { para: "oc-apresentacao", largo: true })}
              <div class="campo largo">
                <span class="campo-rotulo">Cor de destaque</span>
                <div class="oc-cor">
                  <label class="au-ligar"><input type="checkbox" data-c="cor_ativa"${o.cor_ativa ? " checked" : ""}>Usar a cor da marca</label>
                  <input type="color" data-c="cor" value="${P.esc(/^#[0-9a-f]{6}$/i.test(o.cor) ? o.cor : "#a7ebf2")}" aria-label="Cor da marca">
                  <span class="campo-ajuda">Desligado, a página usa o azul do seu site.</span>
                </div>
              </div>
            </div>
          </section>

          <section class="cartao">
            <div class="cartao-topo"><h2>Pacotes</h2>
              <button class="botao" type="button" data-oc="add-pacote">${P.icone("mais", "ico-p")}Novo pacote</button>
            </div>
            <div class="cartao-corpo">
              <div class="oc-lista" id="oc-pacotes">${htmlPacotes()}</div>
              <p class="mudo pequeno" style="margin-top:10px">Preencha o valor sem desconto e o valor final: a porcentagem de desconto aparece sozinha. Sem desconto, deixe o primeiro vazio. Sem valor nenhum, aparece "sob consulta".</p>
            </div>
          </section>

          <section class="cartao">
            <div class="cartao-topo"><h2>Adicionais</h2>
              <button class="botao" type="button" data-oc="add-adicional">${P.icone("mais", "ico-p")}Novo adicional</button>
            </div>
            <div class="cartao-corpo">
              <div class="oc-lista" id="oc-adicionais">${htmlAdicionais()}</div>
              <p class="mudo pequeno" style="margin-top:10px">Coisas que a marca pode somar a qualquer pacote: gancho extra, entrega expressa, mais tempo de anúncio, arquivo bruto... Na página, ela escolhe a quantidade de cada um, vê o total junto do pacote, e o que ela escolher vai na mensagem do WhatsApp e aparece aqui no painel.</p>
            </div>
          </section>

          <section class="cartao">
            <div class="cartao-topo"><h2>Condições e observações</h2>
              <div class="grupo-botoes">
                <button class="botao" type="button" data-oc="obs-padrao">${P.icone("recarregar", "ico-p")}Textos padrão</button>
                <button class="botao" type="button" data-oc="add-obs">${P.icone("mais", "ico-p")}Nova observação</button>
              </div>
            </div>
            <div class="cartao-corpo">
              <div class="oc-lista" id="oc-obs">${htmlObservacoes()}</div>
              <p class="mudo pequeno" style="margin-top:10px">Prazos, rodadas de ajuste, direitos de uso, forma de pagamento. Os textos padrão são sugestões: confira antes de mandar.</p>
            </div>
          </section>

          <section class="cartao">
            <div class="cartao-topo"><h2>Contato no fim da página</h2></div>
            <div class="cartao-corpo grade-campos">
              ${campo("Título", texto("contato_titulo", o.contato_titulo), { para: "oc-contato_titulo", largo: true })}
              ${campo("Texto", `<textarea id="oc-contato_texto" data-c="contato_texto">${P.esc(o.contato_texto)}</textarea>`, { para: "oc-contato_texto", largo: true })}
              ${campo("Seu WhatsApp", texto("whatsapp", o.whatsapp, ` inputmode="tel"`), { para: "oc-whatsapp", ajuda: "Com DDD. Os botões dos pacotes abrem conversa com este número." })}
              ${campo("Seu e-mail", `<input id="oc-email" data-c="email" type="email" value="${P.esc(o.email)}">`, { para: "oc-email" })}
              ${campo("Seu Instagram", texto("instagram", o.instagram), { para: "oc-instagram", ajuda: "Sem o @." })}
            </div>
          </section>

          <section class="cartao">
            <div class="cartao-topo"><h2>Só para você</h2></div>
            <div class="cartao-corpo grade-campos">
              ${campo("Anotações", `<textarea id="oc-notas" data-c="notas">${P.esc(o.notas)}</textarea>`,
                { para: "oc-notas", largo: true, ajuda: "Nunca aparece para a marca. Ex.: o que ela pediu, quanto ela disse que tem de verba, quando cobrar resposta." })}
            </div>
          </section>
        </div>

        <aside class="oc-lado" id="oc-lado">${htmlLado()}</aside>
      </div>`;
  }

  function htmlLado() {
    const o = atual;
    const totalPacotes = o.pacotes.filter((p) => p.nome).length;
    if (!o.id) {
      return `<div class="rt-link-caixa"><b>O link para a marca</b>
        <p class="mudo pequeno">Salve o orçamento para gerar o link. Depois é só copiar e mandar.</p>
        <button class="botao botao-principal" type="button" data-oc="salvar">${P.icone("check", "ico-p")}Salvar e gerar o link</button></div>
        ${htmlResumo(totalPacotes)}`;
    }
    return `
      <div class="rt-link-caixa">
        <b>O link para a marca</b>
        <p class="rt-link-texto" id="oc-link">${P.esc(endereco(o))}</p>
        <div class="grupo-botoes">
          <button class="botao botao-principal" type="button" data-oc="copiar">${P.icone("copiar", "ico-p")}Copiar o link</button>
          <button class="botao" type="button" data-oc="ligar">${P.icone(o.link_ligado ? "olho-fechado" : "olho", "ico-p")}${o.link_ligado ? "Desligar" : "Ligar"}</button>
          <button class="botao botao-perigo" type="button" data-oc="token" title="O link antigo para de funcionar">${P.icone("recarregar", "ico-p")}Link novo</button>
        </div>
        <p class="mudo pequeno">${o.link_ligado ? "A página mostra a última versão salva." : "Link desligado: ninguém consegue abrir agora."}</p>
      </div>
      <div class="cartao">
        <div class="cartao-topo"><h2>O que a marca fez</h2></div>
        <div class="cartao-corpo">
          <div class="oc-dado"><span>Abriu o link</span><b>${o.visualizacoes ? P.plural(o.visualizacoes, "vez", "vezes") : "ainda não"}</b></div>
          ${o.visto_em ? `<div class="oc-dado"><span>Última vez</span><b>${P.esc(quandoFoi(o.visto_em))}</b></div>` : ""}
          ${o.escolha
            ? `<div class="oc-escolha">Clicou em <b>${P.esc(o.escolha)}</b> ${P.esc(quandoFoi(o.escolha_em))}. Confira se a mensagem chegou no seu WhatsApp.</div>`
            : `<p class="mudo pequeno" style="margin-top:8px">Quando a marca clicar em um pacote, ele aparece aqui.</p>`}
        </div>
      </div>
      ${htmlResumo(totalPacotes)}`;
  }

  function htmlResumo(totalPacotes) {
    const o = atual;
    return `<div class="cartao"><div class="cartao-topo"><h2>Resumo</h2></div><div class="cartao-corpo">
      <div class="oc-dado"><span>Pacotes</span><b>${P.inteiro(totalPacotes)}</b></div>
      ${faixa(o.pacotes) ? `<div class="oc-dado"><span>Valores</span><b>${P.esc(faixa(o.pacotes))}</b></div>` : ""}
      <div class="oc-dado"><span>Adicionais</span><b>${P.inteiro(o.adicionais.filter((a) => a.nome).length)}</b></div>
      <div class="oc-dado"><span>Validade</span><b>${o.validade ? P.dataBR(o.validade) : "sem prazo"}</b></div>
    </div></div>`;
  }

  /* ---------- Os itens que se repetem: pacotes, adicionais, observações ---------- */
  const botoesDoItem = (tipo, i, total, duplicar) => `
    <div class="grupo-botoes empurra">
      <button class="botao botao-icone" type="button" data-oc="sobe-${tipo}" data-i="${i}" title="Subir" aria-label="Subir"${i === 0 ? " disabled" : ""}>${P.icone("subir")}</button>
      <button class="botao botao-icone" type="button" data-oc="desce-${tipo}" data-i="${i}" title="Descer" aria-label="Descer"${i === total - 1 ? " disabled" : ""}>${P.icone("baixar")}</button>
      ${duplicar ? `<button class="botao botao-icone" type="button" data-oc="dup-${tipo}" data-i="${i}" title="Duplicar" aria-label="Duplicar">${P.icone("copiar")}</button>` : ""}
      <button class="botao botao-icone" type="button" data-oc="del-${tipo}" data-i="${i}" title="Apagar" aria-label="Apagar">${P.icone("lixo")}</button>
    </div>`;

  function htmlPacotes() {
    const ps = atual.pacotes;
    if (!ps.length) return `<p class="vazio">Nenhum pacote. Clique em "Novo pacote".</p>`;
    return ps.map((p, i) => {
      const id = (k) => `oc-p${i}-${k}`;
      const pct = desconto(p);
      return `<div class="oc-item${p.destaque ? " destacado" : ""}" data-pacote="${i}">
        <div class="oc-item-topo">
          <span class="oc-num">${String(i + 1).padStart(2, "0")}</span>
          <b class="oc-item-nome">${P.esc(p.nome || "Pacote sem nome")}</b>
          ${botoesDoItem("pacote", i, ps.length, true)}
        </div>
        <div class="grade-campos">
          ${campo("Nome do pacote", `<input id="${id("nome")}" data-p="nome" type="text" value="${P.esc(p.nome)}" placeholder="Ex.: Funil completo">`, { para: id("nome") })}
          <label class="campo campo-marcar" for="${id("destaque")}"><input id="${id("destaque")}" data-p="destaque" type="checkbox"${p.destaque ? " checked" : ""}>Marcar como "mais escolhido"</label>
          ${campo("Descrição", `<textarea id="${id("descricao")}" data-p="descricao" placeholder="Ex.: 3 vídeos para cobrir a campanha inteira: antes, durante e a última chamada.">${P.esc(p.descricao)}</textarea>`, { para: id("descricao"), largo: true })}
          ${campo("O que está incluso", `<textarea id="${id("itens")}" data-p="itens" placeholder="3 vídeos UGC&#10;2 ganchos extras&#10;Legenda pronta para postar">${P.esc(p.itens.join("\n"))}</textarea>`,
            { para: id("itens"), largo: true, ajuda: "Um item por linha. Cada linha vira um tique na página." })}
          ${campo("Valor sem desconto (R$)", `<input id="${id("valor_cheio")}" data-p="valor_cheio" type="number" min="0" step="0.01" inputmode="decimal" value="${P.num(p.valor_cheio) || ""}">`, { para: id("valor_cheio"), ajuda: "Opcional. Aparece riscado." })}
          ${campo("Valor final (R$)", `<input id="${id("valor")}" data-p="valor" type="number" min="0" step="0.01" inputmode="decimal" value="${P.num(p.valor) || ""}">`,
            { para: id("valor"), ajuda: `<span class="oc-desconto" data-desconto${pct ? "" : " hidden"}>${pct}% de desconto</span>` })}
          ${campo("Prazo de entrega", `<input id="${id("prazo")}" data-p="prazo" type="text" value="${P.esc(p.prazo)}" placeholder="Ex.: 7 dias úteis">`, { para: id("prazo") })}
          ${campo("Direito de uso", `<input id="${id("uso")}" data-p="uso" type="text" value="${P.esc(p.uso)}" placeholder="Ex.: 3 meses de anúncio">`, { para: id("uso") })}
          ${campo("Texto do botão", `<input id="${id("botao")}" data-p="botao" type="text" value="${P.esc(p.botao)}" placeholder="Quero o ${P.esc(p.nome || "pacote")}">`,
            { para: id("botao"), largo: true, ajuda: "Opcional. O botão abre o seu WhatsApp com uma mensagem pronta dizendo qual pacote a marca escolheu." })}
        </div>
      </div>`;
    }).join("");
  }

  function htmlAdicionais() {
    const xs = atual.adicionais;
    if (!xs.length) return `<p class="vazio">Nenhum adicional. Eles são opcionais.</p>`;
    return xs.map((a, i) => {
      const id = (k) => `oc-a${i}-${k}`;
      return `<div class="oc-item" data-adicional="${i}">
        <div class="oc-item-topo"><b class="oc-item-nome">${P.esc(a.nome || "Adicional sem nome")}</b>${botoesDoItem("adicional", i, xs.length, false)}</div>
        <div class="grade-campos">
          ${campo("Nome", `<input id="${id("nome")}" data-a="nome" type="text" value="${P.esc(a.nome)}" placeholder="Ex.: Gancho extra">`, { para: id("nome") })}
          ${campo("Valor", `<input id="${id("valor")}" data-a="valor" type="text" value="${P.esc(a.valor)}" placeholder="Ex.: R$ 35, ou +30%">`,
            { para: id("valor"), ajuda: "Em reais (R$ 35) ou porcentagem (+30%, calculada sobre cada pacote), a página faz a conta sozinha conforme a quantidade." })}
          ${campo("Quantidade máxima", `<input id="${id("max")}" data-a="max" type="number" min="0" max="99" step="1" inputmode="numeric" value="${P.num(a.max)}">`,
            { para: id("max"), ajuda: "Até quantos a marca pode escolher. 1 vira um liga/desliga. 0 tira a escolha de quantidade." })}
          ${campo("Descrição", `<input id="${id("descricao")}" data-a="descricao" type="text" value="${P.esc(a.descricao)}" placeholder="Ex.: Uma abertura diferente para testar no anúncio">`, { para: id("descricao"), largo: true })}
        </div>
      </div>`;
    }).join("");
  }

  function htmlObservacoes() {
    const xs = atual.observacoes;
    if (!xs.length) return `<p class="vazio">Nenhuma observação. Clique em "Textos padrão" para começar com prazo, uso e pagamento.</p>`;
    return xs.map((b, i) => {
      const id = (k) => `oc-o${i}-${k}`;
      return `<div class="oc-item" data-obs="${i}">
        <div class="oc-item-topo"><b class="oc-item-nome">${P.esc(b.titulo || "Observação sem título")}</b>${botoesDoItem("obs", i, xs.length, false)}</div>
        <div class="grade-campos">
          ${campo("Título", `<input id="${id("titulo")}" data-o="titulo" type="text" value="${P.esc(b.titulo)}" placeholder="Ex.: Pagamento">`, { para: id("titulo"), largo: true })}
          ${campo("Texto", `<textarea id="${id("texto")}" data-o="texto">${P.esc(b.texto)}</textarea>`, { para: id("texto"), largo: true })}
        </div>
      </div>`;
    }).join("");
  }

  /* ---------- Ler o que está na tela para dentro do "atual" ---------- */
  function valorDe(el) {
    if (el.type === "checkbox") return el.checked;
    if (el.type === "number") return el.value === "" ? 0 : P.num(el.value);
    if (el.type === "date") return el.value || null;
    return el.value.trim();
  }

  function lerEditor() {
    const ed = P.$(".oc-editor", secao);
    if (!ed || !atual) return;
    P.$$("[data-c]", ed).forEach((el) => { atual[el.dataset.c] = valorDe(el); });
    atual.pacotes = P.$$("[data-pacote]", ed).map((card) => {
      const p = {};
      P.$$("[data-p]", card).forEach((el) => { p[el.dataset.p] = valorDe(el); });
      p.itens = String(p.itens || "").split("\n").map((s) => s.trim()).filter(Boolean);
      return { ...pacoteVazio(), ...p };
    });
    atual.adicionais = P.$$("[data-adicional]", ed).map((card) => {
      const a = {};
      P.$$("[data-a]", card).forEach((el) => { a[el.dataset.a] = valorDe(el); });
      return a;
    });
    atual.observacoes = P.$$("[data-obs]", ed).map((card) => {
      const b = {};
      P.$$("[data-o]", card).forEach((el) => { b[el.dataset.o] = valorDe(el); });
      return b;
    });
  }

  function marcarSujo() {
    sujo = true;
    const aviso = P.$("#oc-sujo", secao);
    if (aviso) aviso.hidden = false;
  }

  function redesenharItens(tipo) {
    const alvos = { pacote: ["#oc-pacotes", htmlPacotes], adicional: ["#oc-adicionais", htmlAdicionais], obs: ["#oc-obs", htmlObservacoes] };
    const [sel, fn] = alvos[tipo];
    P.$(sel, secao).innerHTML = fn();
    P.$("#oc-lado", secao).innerHTML = htmlLado();
  }

  /* ---------- Gravar ---------- */
  function paraGravar() {
    const v = {};
    CAMPOS.forEach((c) => { v[c] = atual[c]; });
    // Linhas totalmente vazias não vão para o banco
    v.pacotes = atual.pacotes.filter((p) => p.nome || p.descricao || p.itens.length || P.num(p.valor));
    v.adicionais = atual.adicionais.filter((a) => a.nome || a.valor);
    v.observacoes = atual.observacoes.filter((b) => b.titulo || b.texto);
    v.whatsapp = String(v.whatsapp || "").replace(/\D/g, "");
    v.instagram = String(v.instagram || "").trim().replace(/^@/, "");
    v.atualizado_em = new Date().toISOString();
    return v;
  }

  async function salvar() {
    lerEditor();
    if (!atual.marca) {
      P.toast("Escreva o nome da marca antes de salvar.", "erro");
      P.$("#oc-marca", secao)?.focus();
      return false;
    }
    const v = paraGravar();
    try {
      const consulta = atual.id
        ? banco.from(TABELA).update(v).eq("id", atual.id).select().single()
        : banco.from(TABELA).insert(v).select().single();
      const { data, error } = await consulta;
      if (error) { P.toast(erroDaTabela(error), "erro"); return false; }
      const novoAgora = !atual.id;
      atual = arrumar(data);
      const pos = lista.findIndex((x) => x.id === atual.id);
      if (pos >= 0) lista.splice(pos, 1);
      lista.unshift(arrumar(data));
      sujo = false;
      const rolagem = window.scrollY;
      desenharEditor();
      window.scrollTo(0, rolagem);
      P.toast(novoAgora ? "Orçamento salvo. O link já está pronto aqui do lado." : "Orçamento salvo. A página da marca já mostra a mudança.");
      return true;
    } catch (e) {
      P.toast(erroDaTabela(e), "erro");
      return false;
    }
  }

  async function atualizarSoIsto(valores, msg) {
    const erro = await P.gravar(TABELA, "atualizar", valores, atual.id);
    if (erro) { P.toast(erro.replace(/banco\.sql/g, "orcamentos.sql"), "erro"); return false; }
    Object.assign(atual, valores);
    const naLista = lista.find((x) => x.id === atual.id);
    if (naLista) Object.assign(naLista, valores);
    P.$("#oc-lado", secao).innerHTML = htmlLado();
    if (msg) P.toast(msg);
    return true;
  }

  async function copiar(o) {
    const link = endereco(o);
    let ok = true;
    try { await navigator.clipboard.writeText(link); } catch (e) { ok = false; }
    if (!ok) { prompt("Copie o link:", link); return; }
    // Copiou o link de um rascunho: é porque vai mandar
    if (o.status === "Rascunho") {
      const erro = await P.gravar(TABELA, "atualizar", { status: "Enviado" }, o.id);
      if (!erro) {
        o.status = "Enviado";
        if (atual && atual.id === o.id) { atual.status = "Enviado"; const sel = P.$("#oc-status", secao); if (sel) sel.value = "Enviado"; }
        P.toast("Link copiado. Marquei como Enviado.");
        if (!atual) desenharLista();
        return;
      }
    }
    P.toast("Link copiado.");
  }

  async function duplicar(o) {
    const copia = {};
    CAMPOS.forEach((c) => { copia[c] = o[c]; });
    copia.status = "Rascunho";
    copia.atualizado_em = new Date().toISOString();
    try {
      const { data, error } = await banco.from(TABELA).insert(copia).select().single();
      if (error) { P.toast(erroDaTabela(error), "erro"); return; }
      lista.unshift(arrumar(data));
      abrirEditor(data);
      P.toast("Cópia criada, com link novo. Troque a marca e ajuste os valores.");
    } catch (e) { P.toast(erroDaTabela(e), "erro"); }
  }

  async function apagar(o) {
    if (!confirm(`Apagar o orçamento de "${o.marca || "sem marca"}"? O link para de funcionar e isso não tem volta.`)) return;
    const erro = await P.gravar(TABELA, "apagar", null, o.id);
    if (erro) { P.toast(erro, "erro"); return; }
    lista = lista.filter((x) => x.id !== o.id);
    P.toast("Orçamento apagado.");
    desenharLista();
  }

  /* ---------- Cliques ---------- */
  async function aoClicar(e) {
    const filtroBotao = e.target.closest("[data-oc-filtro]");
    if (filtroBotao) { filtro = filtroBotao.dataset.ocFiltro; desenharLista(); return; }

    const botao = e.target.closest("[data-oc]");
    if (!botao) {
      // Clique na linha da lista abre o editor (menos nos botões e links da linha)
      const linha = e.target.closest("[data-oc-abrir]");
      if (linha && !e.target.closest("a, button")) {
        const o = lista.find((x) => x.id === linha.dataset.ocAbrir);
        if (o) abrirEditor(o);
      }
      return;
    }
    const acao = botao.dataset.oc;
    const doId = () => lista.find((x) => x.id === botao.dataset.id);
    const i = Number(botao.dataset.i);

    if (acao === "novo") return novo();
    if (acao === "copiar-lista") return doId() && copiar(doId());
    if (acao === "duplicar-lista") return doId() && duplicar(doId());
    if (acao === "apagar-lista") return doId() && apagar(doId());

    if (!atual) return;
    if (acao === "voltar") {
      if (sujo && !confirm("Você tem alterações que não foram salvas. Sair mesmo assim?")) return;
      return carregar();
    }
    if (acao === "salvar") return salvar();
    if (acao === "duplicar") {
      if (sujo && !(await salvar())) return;
      return duplicar(atual);
    }
    if (acao === "ver") {
      // Abre a janela antes de salvar, senão o navegador bloqueia
      const janela = window.open("about:blank", "_blank");
      if (sujo || !atual.id) {
        if (!(await salvar())) { if (janela) janela.close(); return; }
      }
      if (janela) janela.location = paginaDaMarca(atual);
      return;
    }
    if (acao === "copiar") return copiar(atual);
    if (acao === "ligar") return atualizarSoIsto({ link_ligado: !atual.link_ligado }, atual.link_ligado ? "Link desligado." : "Link no ar.");
    if (acao === "token") {
      if (!confirm("Gerar um link novo? O link antigo para de funcionar na hora, inclusive para quem já recebeu.")) return;
      const bytes = new Uint8Array(16);
      crypto.getRandomValues(bytes);
      return atualizarSoIsto({ token: [...bytes].map((b) => b.toString(16).padStart(2, "0")).join("") }, "Link novo gerado. O antigo parou de funcionar.");
    }

    // Itens que se repetem
    const m = acao.match(/^(add|del|sobe|desce|dup)-(pacote|adicional|obs)$/);
    if (m) {
      const [, verbo, tipo] = m;
      if (verbo === "del" && !confirm("Apagar este item?")) return;
      lerEditor();
      const campoDe = { pacote: "pacotes", adicional: "adicionais", obs: "observacoes" }[tipo];
      const xs = atual[campoDe];
      if (verbo === "add") xs.push(tipo === "pacote" ? pacoteVazio() : tipo === "adicional" ? { nome: "", descricao: "", valor: "", max: 10 } : { titulo: "", texto: "" });
      if (verbo === "del") xs.splice(i, 1);
      if (verbo === "dup") xs.splice(i + 1, 0, JSON.parse(JSON.stringify(xs[i])));
      if (verbo === "sobe" && i > 0) [xs[i - 1], xs[i]] = [xs[i], xs[i - 1]];
      if (verbo === "desce" && i < xs.length - 1) [xs[i + 1], xs[i]] = [xs[i], xs[i + 1]];
      redesenharItens(tipo);
      marcarSujo();
      if (verbo === "add") {
        const cards = P.$$(tipo === "pacote" ? "[data-pacote]" : tipo === "adicional" ? "[data-adicional]" : "[data-obs]", secao);
        const ultimo = cards[cards.length - 1];
        if (ultimo) { ultimo.scrollIntoView({ block: "center", behavior: "smooth" }); P.$("input, textarea", ultimo)?.focus({ preventScroll: true }); }
      }
      return;
    }
    if (acao === "obs-padrao") {
      lerEditor();
      const titulos = atual.observacoes.map((b) => b.titulo.toLowerCase());
      const faltam = OBS_PADRAO.filter((b) => !titulos.includes(b.titulo.toLowerCase()));
      if (!faltam.length) { P.toast("Os textos padrão já estão aqui."); return; }
      atual.observacoes.push(...JSON.parse(JSON.stringify(faltam)));
      redesenharItens("obs");
      marcarSujo();
      P.toast(`Acrescentei ${P.plural(faltam.length, "texto padrão", "textos padrão")}. Confira se combinam com esta proposta.`);
    }
  }

  /* ---------- Digitação: marca alteração e atualiza o que depende do campo ---------- */
  function aoDigitar(e) {
    const el = e.target;
    if (el.id === "oc-busca") {
      busca = el.value.trim();
      const pos = el.selectionStart;
      desenharLista();
      const nova = P.$("#oc-busca", secao);
      nova.focus();
      nova.setSelectionRange(pos, pos);
      return;
    }
    if (!atual || !el.closest(".oc-editor")) return;
    marcarSujo();
    if (el.dataset.c === "marca") P.$("#oc-nome", secao).textContent = el.value.trim() || "Novo orçamento";
    const card = el.closest("[data-pacote], [data-adicional], [data-obs]");
    if (card && (el.dataset.p === "nome" || el.dataset.a === "nome" || el.dataset.o === "titulo")) {
      P.$(".oc-item-nome", card).textContent = el.value.trim() || "Sem nome";
    }
    if (card && (el.dataset.p === "valor" || el.dataset.p === "valor_cheio")) {
      const pct = desconto({ valor: P.$("[data-p=valor]", card).value, valor_cheio: P.$("[data-p=valor_cheio]", card).value });
      const selo = P.$("[data-desconto]", card);
      selo.hidden = !pct;
      selo.textContent = `${pct}% de desconto`;
    }
  }

  function aoMudar(e) {
    const el = e.target;
    if (!atual || !el.closest(".oc-editor")) return;
    marcarSujo();
    if (el.dataset.p === "destaque") el.closest("[data-pacote]").classList.toggle("destacado", el.checked);
    // Escolheu uma marca da base: puxa o e-mail e o WhatsApp dela, se ainda estiverem vazios
    if (el.dataset.c === "marca") {
      const m = marcas.find((x) => x.nome.trim().toLowerCase() === el.value.trim().toLowerCase());
      if (!m) return;
      const email = P.$("#oc-contato_email", secao), tel = P.$("#oc-contato_telefone", secao);
      if (email && !email.value && m.email) email.value = m.email;
      if (tel && !tel.value && m.telefone) tel.value = P.primeiroTelefone(m.telefone) || m.telefone;
    }
  }
})();
