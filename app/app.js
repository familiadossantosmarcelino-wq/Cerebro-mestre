import { resolver, NOMES } from "./cerebro.js";
import { markdown } from "./markdown.js";
import * as nuvem from "./nuvem.js";

const $ = (s, raiz = document) => raiz.querySelector(s);

// ------------------------------------------------------------------ dados

const PADRAO = {
  chaveClaude: "",
  chaveGPT: "",
  modeloClaude: "claude-opus-5-5",
  modeloGPT: "gpt-5",
  coordenador: "claude",
  pesquisaWeb: true,
  complemento: true,
  simular: false,
  perfil: "Engenheiro mecânico, inspetor de manutenção. Quer respostas diretas, técnicas e fáceis de aplicar em campo.",
};

// Projetos iniciais: só nome e um rascunho do objetivo, para o usuário completar.
// Ids fixos: o mesmo projeto inicial criado em dois aparelhos vira um só na nuvem.
const DATA_INICIAL = "2026-01-01T00:00:00.000Z";
const INICIAIS = [
  {
    id: "inicial-padrinhos",
    nome: "Padrinhos de Máquinas",
    objetivo:
      "Programa em que cada máquina tem um padrinho responsável por acompanhar sua condição, cuidados básicos e anomalias.\n\n(Complete: área/planta, quais máquinas, quem serão os padrinhos, o que se espera deles, como medir o resultado.)",
  },
  {
    id: "inicial-oms",
    nome: "Preenchimento de OMs em Campo",
    objetivo:
      "Padronizar e facilitar o preenchimento das ordens de manutenção (OMs) em campo, para que as informações cheguem completas e corretas.\n\n(Complete: sistema usado (SAP PM, outro), problemas atuais no preenchimento, quem preenche, campos obrigatórios.)",
  },
];
const inicialSemUso = (p) => p.id.startsWith("inicial-") && !p.entradas.length && (p.atualizado || p.criado) === DATA_INICIAL;

function ler(chave, padrao) {
  try {
    const v = localStorage.getItem(chave);
    return v ? JSON.parse(v) : padrao;
  } catch {
    return padrao;
  }
}
function gravar(chave, valor) {
  try {
    localStorage.setItem(chave, JSON.stringify(valor));
    return true;
  } catch {
    alert("Não consegui salvar neste aparelho (memória cheia ou bloqueada). Faça um backup.");
    return false;
  }
}

const novoId = () => Date.now().toString(36) + Math.random().toString(36).slice(2, 6);
const nomeArquivo = (t) =>
  t.normalize("NFD").replace(/[̀-ͯ]/g, "").toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, "") || "projeto";

let cfg = { ...PADRAO, ...ler("cerebro.cfg", {}) };
let locais = ler("cerebro.projetos", null);
if (!locais) {
  locais = INICIAIS.map((p) => ({ ...p, criado: DATA_INICIAL, atualizado: DATA_INICIAL, entradas: [] }));
  gravar("cerebro.projetos", locais);
}

// Sem login, os projetos vivem só neste aparelho. Com login, vivem na nuvem
// (o Firestore mantém uma cópia no aparelho para funcionar sem internet).
let usuario = null;
let projetos = locais;

function salvarLocais() {
  for (const p of locais) p.entradas.forEach((e, i) => i < p.entradas.length - 5 && delete e.etapas);
  gravar("cerebro.projetos", locais);
}

const erroNuvem = (msg) => estado("erro", `Nuvem: ${msg}`);

// Todas as alterações passam por aqui. A tela muda na hora; a nuvem confirma depois.
const dados = {
  criarProjeto(p) {
    projetos.push(p);
    usuario ? nuvem.salvarProjeto(p, erroNuvem) : salvarLocais();
  },
  editarProjeto(p, campos) {
    Object.assign(p, campos, { atualizado: new Date().toISOString() });
    usuario ? nuvem.salvarProjeto(p, erroNuvem) : salvarLocais();
  },
  excluirProjeto(p) {
    projetos.splice(projetos.indexOf(p), 1);
    usuario ? nuvem.excluirProjeto(p.id, erroNuvem) : salvarLocais();
  },
  adicionarEntrada(p, e) {
    p.entradas.push(e);
    usuario ? nuvem.salvarEntrada(p.id, e, erroNuvem) : salvarLocais();
  },
  apagarEntrada(p, e) {
    p.entradas = p.entradas.filter((x) => x !== e);
    usuario ? nuvem.apagarEntrada(p.id, e.id, erroNuvem) : salvarLocais();
  },
};

let atual = null;
let controle = null;

// ------------------------------------------------------------------ telas

function rota() {
  const m = location.hash.match(/^#\/p\/(.+)$/);
  atual = m ? projetos.find((p) => p.id === m[1]) : null;
  $("#tela-projetos").hidden = !!atual;
  $("#tela-projeto").hidden = !atual;
  $("#pergunta").value = "";
  atual ? telaProjeto() : telaProjetos();
  window.scrollTo(0, 0);
}

// Redesenha quando chegam dados da nuvem, sem mexer no que você está digitando.
function redesenhar() {
  if (controle) return;
  const id = location.hash.match(/^#\/p\/(.+)$/)?.[1];
  atual = id ? projetos.find((p) => p.id === id) : null;
  if (id && !atual && usuario && !carregou) return; // projeto ainda chegando da nuvem
  if (id && !atual) return (location.hash = "#/");
  $("#tela-projetos").hidden = !!atual;
  $("#tela-projeto").hidden = !atual;
  atual ? telaProjeto() : telaProjetos();
}
let carregou = false;

const ultimaData = (p) => p.entradas.at(-1)?.data || p.criado;

function telaProjetos() {
  const faltam = [!cfg.chaveClaude && "Claude", !cfg.chaveGPT && "GPT"].filter(Boolean);
  $("#aviso-modo").textContent = cfg.simular
    ? "Modo simulação ativo: as respostas são de teste."
    : faltam.length
      ? `Configure a chave de API do ${faltam.join(" e do ")} em ⚙️.`
      : "";
  $("#aviso-local").hidden = !nuvem.nuvemDisponivel || !!usuario;
  const ul = $("#lista-projetos");
  ul.innerHTML = projetos.length ? "" : '<li class="dica">Nenhum projeto ainda.</li>';
  for (const p of [...projetos].sort((a, b) => ultimaData(b).localeCompare(ultimaData(a)))) {
    const li = document.createElement("li");
    li.innerHTML = `<a><strong></strong><span class="resumo"></span><span class="meta"></span></a>`;
    $("a", li).href = `#/p/${p.id}`;
    $("strong", li).textContent = p.nome;
    $(".resumo", li).textContent = (p.objetivo || "").split("\n")[0];
    $(".meta", li).textContent = p.entradas.length
      ? `${p.entradas.length} ${p.entradas.length === 1 ? "registro" : "registros"} · ${new Date(ultimaData(p)).toLocaleDateString("pt-BR")}`
      : "Ainda não iniciado";
    ul.appendChild(li);
  }
}

function telaProjeto() {
  $("#p-nome").textContent = atual.nome;
  $("#p-objetivo").innerHTML = markdown(atual.objetivo || "_Sem objetivo definido. Toque em Editar._");
  const linha = $("#linha");
  linha.innerHTML = "";
  if (!atual.entradas.length) {
    linha.innerHTML = `<li class="vazio"><p>Projeto ainda não iniciado.</p><button class="primario" id="btn-iniciar">Analisar e estruturar o projeto</button></li>`;
    $("#btn-iniciar").onclick = () => enviar(pedidoInicial(), "Analisar e estruturar o projeto");
  }
  for (const e of atual.entradas) linha.appendChild(desenharEntrada(e));
}

function pedidoInicial() {
  return `Analise este projeto e entregue a estrutura inicial: objetivo em uma frase, escopo, etapas de implantação, o que precisa ser produzido (documentos, formulários, checklists, indicadores), riscos e os próximos passos práticos. Se faltar informação importante, liste as perguntas que preciso responder.`;
}

function desenharEntrada(e) {
  const li = $("#tpl-entrada").content.firstElementChild.cloneNode(true);
  li.id = `e-${e.id}`;
  $(".pedido", li).textContent = e.pergunta;
  $(".resposta", li).innerHTML = e.resposta ? markdown(e.resposta) : '<p class="dica">Trabalhando… acompanhe em "Como foi feito".</p>';
  (e.etapas || []).forEach((et) => desenharEtapa(li, et));
  $(".bastidores", li).hidden = !(e.etapas || []).length && !!e.resposta;
  $(".copiar", li).onclick = async (ev) => {
    await navigator.clipboard.writeText(e.resposta || "");
    ev.target.textContent = "Copiado ✓";
    setTimeout(() => (ev.target.textContent = "Copiar"), 1500);
  };
  $(".apagar", li).onclick = () => {
    if (!confirm("Apagar este registro do projeto?")) return;
    dados.apagarEntrada(atual, e);
    telaProjeto();
  };
  return li;
}

function desenharEtapa(li, { id, titulo, ia, status, texto }) {
  let el = $(`[data-etapa="${id}"]`, li);
  if (!el) {
    el = document.createElement("li");
    el.dataset.etapa = id;
    el.innerHTML = `<details><summary><span class="selo"></span><span class="titulo"></span><span class="estado"></span></summary><div class="md"></div></details>`;
    $(".etapas", li).appendChild(el);
  }
  el.className = `etapa ${ia} ${status}`;
  $(".selo", el).textContent = NOMES[ia];
  $(".titulo", el).textContent = titulo;
  $(".estado", el).textContent = { rodando: "trabalhando…", ok: "pronto", erro: "falhou" }[status];
  $(".md", el).innerHTML = texto ? markdown(texto) : "";
}

// ------------------------------------------------------------------ envio

// `rotulo` é o que aparece na tela e no arquivo; `pergunta` é o que vai para as IAs.
async function enviar(pergunta, rotulo) {
  pergunta = (pergunta || "").trim();
  if (!pergunta || controle) return;
  if (!cfg.simular && (!cfg.chaveClaude || !cfg.chaveGPT)) {
    alert("Configure as duas chaves de API (⚙️) ou ative o modo simulação.");
    return abrirConfig();
  }

  const projeto = atual;
  const entrada = {
    pergunta,
    projeto: projeto.nome,
    contextoProjeto: projeto.objetivo,
    historico: projeto.entradas.filter((e) => e.resposta).slice(-4),
  };
  const registro = { id: novoId(), data: new Date().toISOString(), pergunta: rotulo || pergunta, resposta: "", etapas: [] };

  $(".vazio")?.remove();
  const li = desenharEntrada(registro);
  $(".bastidores", li).open = true;
  $("#linha").appendChild(li);
  li.scrollIntoView({ behavior: "smooth", block: "start" });
  $("#pergunta").value = "";
  $("#btn-resolver").disabled = true;
  $("#btn-parar").hidden = false;
  controle = new AbortController();

  const etapas = {};
  try {
    const r = await resolver(cfg, entrada, (et) => {
      etapas[et.id] = et;
      desenharEtapa(li, et);
    }, controle.signal);
    registro.resposta = r.resposta;
    registro.etapas = Object.values(etapas);
    // A lista pode ter sido atualizada pela nuvem enquanto as IAs trabalhavam.
    dados.adicionarEntrada(projetos.find((p) => p.id === projeto.id) || projeto, registro);
    $(".resposta", li).innerHTML = markdown(r.resposta);
    $(".bastidores", li).open = false;
  } catch (e) {
    $(".resposta", li).innerHTML = markdown(
      controle.signal.aborted ? "Interrompido." : `**Não foi possível concluir.** ${e.message}\n\nConfira as chaves e os modelos em ⚙️.`,
    );
    if (!rotulo) $("#pergunta").value = pergunta;
  } finally {
    $("#btn-resolver").disabled = false;
    $("#btn-parar").hidden = true;
    controle = null;
  }
}

// ------------------------------------------------------------------ arquivos

function baixar(nome, conteudo, tipo) {
  const a = document.createElement("a");
  a.href = URL.createObjectURL(new Blob([conteudo], { type: tipo }));
  a.download = nome;
  a.click();
  setTimeout(() => URL.revokeObjectURL(a.href), 1000);
}

function arquivoProjeto(p) {
  const data = (d) => new Date(d).toLocaleString("pt-BR");
  let md = `# ${p.nome}\n\n_Criado em ${data(p.criado)} · atualizado em ${data(ultimaData(p))}_\n\n## Objetivo\n\n${p.objetivo}\n`;
  for (const e of p.entradas) md += `\n---\n\n## ${e.pergunta}\n\n_${data(e.data)}_\n\n${e.resposta}\n`;
  return md;
}

// ------------------------------------------------------------------ diálogos

function abrirProjeto(p) {
  const f = $("#dlg-projeto form");
  f.elements.nome.value = p?.nome || "";
  f.elements.objetivo.value = p?.objetivo || "";
  $("#dlg-projeto-titulo").textContent = p ? "Editar projeto" : "Novo projeto";
  $("#dlg-projeto-dica").hidden = !!p;
  $("#btn-excluir").hidden = !p;
  $("#dlg-projeto").dataset.id = p?.id || "";
  $("#dlg-projeto").showModal();
}

$("#dlg-projeto").addEventListener("close", () => {
  const dlg = $("#dlg-projeto");
  const f = $("form", dlg);
  const p = projetos.find((x) => x.id === dlg.dataset.id);
  if (dlg.returnValue === "excluir" && p) {
    if (!confirm(`Excluir "${p.nome}" e todo o seu conteúdo?`)) return;
    dados.excluirProjeto(p);
    location.hash = "#/";
    return;
  }
  if (dlg.returnValue !== "salvar") return;
  const nome = f.elements.nome.value.trim();
  const objetivo = f.elements.objetivo.value.trim();
  if (!nome) return;
  if (p) {
    dados.editarProjeto(p, { nome, objetivo });
    rota();
  } else {
    const agora = new Date().toISOString();
    const novo = { id: novoId(), nome, objetivo, criado: agora, atualizado: agora, entradas: [] };
    dados.criarProjeto(novo);
    location.hash = `#/p/${novo.id}`;
    // Projeto novo já começa sendo analisado.
    setTimeout(() => atual?.id === novo.id && enviar(pedidoInicial(), "Analisar e estruturar o projeto"), 50);
  }
});

function abrirConfig() {
  const f = $("#dlg-config form");
  for (const [k, v] of Object.entries(cfg)) {
    const el = f.elements[k];
    if (!el) continue;
    if (el.type === "checkbox") el.checked = v;
    else el.value = v;
  }
  desenharConta();
  $("#dlg-config").showModal();
}

$("#dlg-config").addEventListener("close", () => {
  if ($("#dlg-config").returnValue !== "salvar") return;
  const f = $("#dlg-config form");
  const antes = JSON.stringify(Object.keys(PADRAO).map((k) => cfg[k]));
  for (const k of Object.keys(PADRAO)) {
    const el = f.elements[k];
    cfg[k] = el.type === "checkbox" ? el.checked : el.value.trim();
  }
  cfg.modeloClaude ||= PADRAO.modeloClaude;
  cfg.modeloGPT ||= PADRAO.modeloGPT;
  // Só marca como "mais nova" se algo mudou de fato; senão um aparelho novo
  // sobrescreveria as chaves da nuvem com campos vazios.
  if (JSON.stringify(Object.keys(PADRAO).map((k) => cfg[k])) !== antes) {
    cfg.atualizado = new Date().toISOString();
    if (usuario) nuvem.salvarConfig(soConfig(), cfg.atualizado, erroNuvem);
  }
  gravar("cerebro.cfg", cfg);
  if (!atual) telaProjetos();
});

const soConfig = () => Object.fromEntries(Object.keys(PADRAO).map((k) => [k, cfg[k]]));

// ------------------------------------------------------------------ conta e nuvem

function estado(tipo, texto) {
  const b = $("#btn-nuvem");
  b.hidden = !nuvem.nuvemDisponivel;
  b.dataset.estado = tipo;
  b.title = texto;
  $("#nuvem-texto").textContent = { ok: "Sincronizado", rodando: "Enviando…", erro: "Falha", offline: "Offline", entrar: "Entrar" }[tipo];
}

function desenharConta() {
  $("#conta").hidden = !nuvem.nuvemDisponivel;
  $("#conta-texto").textContent = usuario
    ? `Conectado como ${usuario.email}. Seus projetos aparecem em todos os aparelhos em que você entrar com esta conta.`
    : "Sem login: os projetos ficam só neste aparelho.";
  $("#btn-conta-entrar").hidden = !!usuario;
  $("#btn-conta-sair").hidden = !usuario;
}

function abrirLogin() {
  $("#login-erro").textContent = "";
  $("#dlg-login").showModal();
}

async function tentar(acao) {
  $("#login-erro").textContent = "";
  try {
    await acao();
    $("#dlg-login").close();
  } catch (e) {
    $("#login-erro").textContent = nuvem.mensagemErro(e);
  }
}

$("#btn-google").onclick = () => tentar(nuvem.entrarGoogle);
$("#form-email").onsubmit = (ev) => {
  ev.preventDefault();
  const f = ev.target;
  const acao = ev.submitter?.value === "criar" ? nuvem.criarConta : nuvem.entrarEmail;
  tentar(() => acao(f.elements.email.value.trim(), f.elements.senha.value));
};
$("#btn-esqueci").onclick = async () => {
  const email = $("#form-email").elements.email.value.trim();
  if (!email) return ($("#login-erro").textContent = "Digite seu e-mail acima.");
  try {
    await nuvem.recuperarSenha(email);
    $("#login-erro").textContent = "Enviamos um e-mail para você criar uma nova senha.";
  } catch (e) {
    $("#login-erro").textContent = nuvem.mensagemErro(e);
  }
};
$("#btn-fechar-login").onclick = () => $("#dlg-login").close();
$("#btn-conta-entrar").onclick = () => {
  $("#dlg-config").close();
  abrirLogin();
};
$("#btn-conta-sair").onclick = async () => {
  if (!confirm("Sair da conta neste aparelho? Seus projetos continuam salvos na nuvem.")) return;
  await nuvem.sair();
  desenharConta();
};
$("#btn-nuvem").onclick = () => (usuario ? abrirConfig() : abrirLogin());
$("#btn-aviso-entrar").onclick = abrirLogin;

nuvem
  .iniciarNuvem({
    async aoUsuario(u) {
      usuario = u;
      carregou = false;
      if (u) {
        estado("rodando", "Conectando…");
        // Primeira vez com esta conta neste aparelho: leva o que já existia aqui.
        const chave = `cerebro.migrado.${u.uid}`;
        if (!ler(chave, false)) {
          await nuvem.migrar(locais, inicialSemUso).catch((e) => erroNuvem(nuvem.mensagemErro(e)));
          gravar(chave, true);
        }
      } else {
        projetos = locais;
        estado("entrar", "Entre para usar seus projetos no celular, tablet e computador.");
        carregou = true;
      }
      desenharConta();
      redesenhar();
    },
    aoProjetos(lista) {
      projetos = lista;
      carregou = true;
      redesenhar();
    },
    aoConfig(remoto, atualizadoRemoto, soDoCache) {
      if (remoto && atualizadoRemoto > (cfg.atualizado || "")) {
        cfg = { ...cfg, ...remoto, atualizado: atualizadoRemoto };
        gravar("cerebro.cfg", cfg);
        if (!atual) telaProjetos();
      } else if (!soDoCache && cfg.atualizado && cfg.atualizado > atualizadoRemoto) {
        nuvem.salvarConfig(soConfig(), cfg.atualizado, erroNuvem);
      }
    },
    aoEstado: estado,
  })
  .catch((e) => estado("erro", `Nuvem: ${nuvem.mensagemErro(e)}`));

// ------------------------------------------------------------------ eventos

$("#btn-config").onclick = abrirConfig;
$("#btn-novo").onclick = () => abrirProjeto(null);
$("#btn-editar").onclick = () => abrirProjeto(atual);
$("#btn-arquivo").onclick = () => baixar(`${nomeArquivo(atual.nome)}.md`, arquivoProjeto(atual), "text/markdown");
$("#btn-resolver").onclick = () => enviar($("#pergunta").value);
$("#btn-parar").onclick = () => controle?.abort();
$("#pergunta").addEventListener("keydown", (e) => {
  if (e.key === "Enter" && (e.ctrlKey || e.metaKey)) enviar($("#pergunta").value);
});

$("#btn-backup").onclick = () => {
  const dia = new Date().toISOString().slice(0, 10);
  baixar(`cerebro-backup-${dia}.json`, JSON.stringify({ versao: 1, projetos }, null, 2), "application/json");
};
$("#arq-backup").onchange = async (ev) => {
  const arq = ev.target.files[0];
  ev.target.value = "";
  if (!arq) return;
  try {
    const lidos = JSON.parse(await arq.text());
    if (!Array.isArray(lidos.projetos)) throw new Error("arquivo sem projetos");
    const ids = new Set(projetos.map((p) => p.id));
    const novos = lidos.projetos.filter((p) => p.id && p.nome && Array.isArray(p.entradas) && !ids.has(p.id));
    for (const p of novos) {
      const novo = { ...p, entradas: [] };
      dados.criarProjeto(novo);
      for (const e of p.entradas) dados.adicionarEntrada(novo, e);
    }
    alert(`${novos.length} projeto(s) restaurado(s). Projetos que já existiam foram mantidos como estão.`);
    telaProjetos();
  } catch (e) {
    alert(`Backup inválido: ${e.message}`);
  }
};

estado("entrar", "Entre para usar seus projetos no celular, tablet e computador.");
window.addEventListener("hashchange", rota);
rota();

if ("serviceWorker" in navigator) navigator.serviceWorker.register("sw.js").catch(() => {});
