import { resolver, NOMES } from "./cerebro.js";
import { markdown } from "./markdown.js";
import { Nuvem, mesclar, iguais, cifrar, decifrar } from "./nuvem.js";

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
  t.normalize("NFD").replace(/[\u0300-\u036f]/g, "").toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, "") || "projeto";

let cfg = { ...PADRAO, ...ler("cerebro.cfg", {}) };
let projetos = ler("cerebro.projetos", null);
if (!projetos) {
  projetos = INICIAIS.map((p) => ({ ...p, criado: DATA_INICIAL, atualizado: DATA_INICIAL, entradas: [] }));
  gravar("cerebro.projetos", projetos);
}
// Cada projeto tem uma pasta própria na nuvem.
for (const p of projetos) p.pasta ||= p.id.startsWith("inicial-") ? `${nomeArquivo(p.nome)}` : `${nomeArquivo(p.nome)}-${p.id}`;
let excluidos = ler("cerebro.excluidos", []);
let conexao = ler("cerebro.nuvem", { token: "", repo: "", senha: "" });

// Guarda os bastidores só das últimas respostas de cada projeto, para não lotar a memória.
function salvarProjetos() {
  for (const p of projetos) p.entradas.forEach((e, i) => i < p.entradas.length - 5 && delete e.etapas);
  gravar("cerebro.projetos", projetos);
}

// Toda alteração num projeto passa por aqui: salva no aparelho e manda para a nuvem.
function alterou(p, { meta = false } = {}) {
  if (meta) p.atualizado = new Date().toISOString();
  p.pendente = true;
  salvarProjetos();
  enviarProjeto(p);
}

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

// Redesenha depois de uma sincronização sem mexer no que você está digitando.
function redesenhar() {
  if (controle) return;
  const id = atual?.id;
  atual = id ? projetos.find((p) => p.id === id) : null;
  if (id && !atual) return (location.hash = "#/");
  atual ? telaProjeto() : telaProjetos();
}

function telaProjetos() {
  const faltam = [!cfg.chaveClaude && "Claude", !cfg.chaveGPT && "GPT"].filter(Boolean);
  $("#aviso-modo").textContent = cfg.simular
    ? "Modo simulação ativo: as respostas são de teste."
    : faltam.length
      ? `Configure a chave de API do ${faltam.join(" e do ")} em ⚙️.`
      : "";
  const ul = $("#lista-projetos");
  ul.innerHTML = projetos.length ? "" : '<li class="dica">Nenhum projeto ainda.</li>';
  for (const p of [...projetos].sort((a, b) => ultimaData(b).localeCompare(ultimaData(a)))) {
    const li = document.createElement("li");
    li.innerHTML = `<a><strong></strong><span class="resumo"></span><span class="meta"></span></a>`;
    $("a", li).href = `#/p/${p.id}`;
    $("strong", li).textContent = p.nome;
    $(".resumo", li).textContent = p.objetivo.split("\n")[0];
    $(".meta", li).textContent = p.entradas.length
      ? `${p.entradas.length} ${p.entradas.length === 1 ? "registro" : "registros"} · ${new Date(ultimaData(p)).toLocaleDateString("pt-BR")}`
      : "Ainda não iniciado";
    ul.appendChild(li);
  }
}

const ultimaData = (p) => p.entradas.at(-1)?.data || p.criado;

function telaProjeto() {
  $("#p-nome").textContent = atual.nome;
  $("#p-objetivo").innerHTML = markdown(atual.objetivo || "_Sem objetivo definido. Toque em Editar._");
  const linha = $("#linha");
  linha.innerHTML = "";
  if (!atual.entradas.length) {
    linha.innerHTML = `<li class="vazio"><p>Projeto ainda não iniciado.</p><button class="primario" id="btn-iniciar">Analisar e estruturar o projeto</button></li>`;
    $("#btn-iniciar").onclick = () => enviar(pedidoInicial(atual), "Analisar e estruturar o projeto");
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
    atual.entradas = atual.entradas.filter((x) => x !== e);
    atual.removidas = [...(atual.removidas || []), e.id];
    alterou(atual);
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
    const alvo = projetos.find((p) => p.id === projeto.id) || projeto;
    alvo.entradas.push(registro);
    alterou(alvo);
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
    if (!confirm(`Excluir "${p.nome}" e todo o seu conteúdo? Faça um backup antes, se precisar.`)) return;
    projetos = projetos.filter((x) => x !== p);
    excluidos = [...excluidos, p.id];
    gravar("cerebro.excluidos", excluidos);
    salvarProjetos();
    sincronizar();
    location.hash = "#/";
    return;
  }
  if (dlg.returnValue !== "salvar") return;
  const nome = f.elements.nome.value.trim();
  const objetivo = f.elements.objetivo.value.trim();
  if (!nome) return;
  if (p) {
    Object.assign(p, { nome, objetivo });
    alterou(p, { meta: true });
    rota();
  } else {
    const id = novoId();
    const agora = new Date().toISOString();
    const novo = { id, pasta: `${nomeArquivo(nome)}-${id}`, nome, objetivo, criado: agora, atualizado: agora, entradas: [] };
    projetos.push(novo);
    alterou(novo);
    location.hash = `#/p/${novo.id}`;
    // Projeto novo já começa sendo analisado.
    setTimeout(() => atual === novo && enviar(pedidoInicial(novo), "Analisar e estruturar o projeto"), 50);
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
  f.elements.token.value = conexao.token;
  f.elements.repo.value = conexao.repo;
  f.elements.senha.value = conexao.senha;
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
  // apagaria as chaves da nuvem com campos vazios.
  if (JSON.stringify(Object.keys(PADRAO).map((k) => cfg[k])) !== antes) cfg.atualizado = new Date().toISOString();
  gravar("cerebro.cfg", cfg);

  const nova = { token: f.elements.token.value.trim(), repo: f.elements.repo.value.trim(), senha: f.elements.senha.value };
  const mudou = JSON.stringify(nova) !== JSON.stringify(conexao);
  conexao = nova;
  gravar("cerebro.nuvem", conexao);
  if (mudou) conectar();
  else enviarConfig();
  if (!atual) telaProjetos();
});

// ------------------------------------------------------------------ nuvem

let nuvem = null;

function estado(tipo, texto) {
  const b = $("#btn-nuvem");
  b.dataset.estado = tipo;
  b.title = texto;
  $("#nuvem-texto").textContent = { ok: "Sincronizado", rodando: "Sincronizando…", erro: "Falha", offline: "Offline", desligada: "Sem nuvem" }[tipo];
}

// Uma conexão por vez: abrir o app e voltar para ele ao mesmo tempo não duplica o trabalho.
let conectando = null;
function conectar() {
  conectando ||= abrirConexao().finally(() => (conectando = null));
  return conectando;
}

async function abrirConexao() {
  nuvem = null;
  if (!conexao.token || !conexao.repo) return estado("desligada", "Nuvem desligada. Configure em ⚙️ para usar em vários aparelhos.");
  const n = new Nuvem(conexao);
  estado("rodando", "Conectando…");
  try {
    await n.testar();
  } catch (e) {
    return estado(e.status === 0 && !navigator.onLine ? "offline" : "erro", `Nuvem: ${e.message}`);
  }
  nuvem = n;
  await receberConfig();
  await sincronizar();
}

// Chaves e preferências vão cifradas com a sua senha; sem senha, não sobem.
async function receberConfig() {
  if (!nuvem || !conexao.senha) return;
  try {
    const pacote = await nuvem.lerConfig();
    if (!pacote) return enviarConfig();
    const remoto = await decifrar(pacote, conexao.senha);
    if ((remoto.atualizado || "") > (cfg.atualizado || "")) {
      cfg = { ...cfg, ...remoto };
      gravar("cerebro.cfg", cfg);
      if (!atual) telaProjetos();
    } else if ((remoto.atualizado || "") < (cfg.atualizado || "")) enviarConfig();
  } catch (e) {
    estado("erro", `Configurações da nuvem: ${e.message}`);
  }
}

function enviarConfig() {
  if (!nuvem || !conexao.senha) return;
  nuvem.emSerie(async () => nuvem.salvarConfig(await cifrar(cfg, conexao.senha))).catch((e) => estado("erro", `Nuvem: ${e.message}`));
}

function enviarProjeto(p) {
  if (!nuvem) return;
  estado("rodando", "Enviando…");
  nuvem
    .emSerie(async () => {
      const antes = JSON.stringify(p.entradas.map((e) => e.id));
      const remoto = await nuvem.lerProjeto(p.pasta);
      if (remoto) Object.assign(p, mesclar(p, remoto));
      if (!remoto || !iguais(p, remoto)) await nuvem.salvarProjeto(p, arquivoProjeto(p));
      p.pendente = false;
      p.sincronizado = true;
      salvarProjetos();
      return antes !== JSON.stringify(p.entradas.map((e) => e.id));
    })
    .then((mudou) => {
      estado("ok", `Sincronizado às ${new Date().toLocaleTimeString("pt-BR")}`);
      if (mudou && atual === p) redesenhar();
    })
    .catch((e) => estado(e.status === 0 ? "offline" : "erro", `Ficou salvo neste aparelho e sobe depois. (${e.message})`));
}

let sincronizando = null;
function sincronizar() {
  if (!nuvem) return Promise.resolve();
  if (sincronizando) return sincronizando;
  estado("rodando", "Sincronizando…");
  sincronizando = nuvem
    .emSerie(async () => {
      const antes = JSON.stringify(projetos.map((p) => [p.id, p.nome, p.objetivo, p.entradas.map((e) => e.id)]));
      // Lista de excluídos fica na nuvem: excluir num aparelho vale para todos.
      const naNuvem = await nuvem.lerExcluidos();
      const apagados = new Set([...naNuvem, ...excluidos]);
      if (apagados.size > naNuvem.length) await nuvem.salvarExcluidos([...apagados]);
      let remotos = await nuvem.listarProjetos();
      for (const r of remotos.filter((x) => apagados.has(x.id))) await nuvem.apagarProjeto(r);
      remotos = remotos.filter((x) => !apagados.has(x.id));
      excluidos = [];
      gravar("cerebro.excluidos", excluidos);

      const resultado = [];
      for (const l of projetos.filter((x) => !apagados.has(x.id))) {
        const r = remotos.find((x) => x.id === l.id);
        if (!r) {
          // Já esteve na nuvem e sumiu: foi excluído em outro aparelho.
          if (l.sincronizado && !l.pendente) continue;
          await nuvem.salvarProjeto(l, arquivoProjeto(l));
        } else {
          Object.assign(l, mesclar(l, r));
          if (!iguais(l, r)) await nuvem.salvarProjeto(l, arquivoProjeto(l));
        }
        l.pendente = false;
        l.sincronizado = true;
        resultado.push(l);
      }
      for (const r of remotos) {
        if (!resultado.some((p) => p.id === r.id)) resultado.push({ ...r, sincronizado: true });
      }
      projetos = resultado;
      salvarProjetos();
      return antes !== JSON.stringify(projetos.map((p) => [p.id, p.nome, p.objetivo, p.entradas.map((e) => e.id)]));
    })
    .then((mudou) => {
      estado("ok", `Sincronizado às ${new Date().toLocaleTimeString("pt-BR")}`);
      if (mudou) redesenhar();
    })
    .catch((e) => estado(e.status === 0 ? "offline" : "erro", `Ficou salvo neste aparelho e sobe depois. (${e.message})`))
    .finally(() => (sincronizando = null));
  return sincronizando;
}

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
    const dados = JSON.parse(await arq.text());
    for (const p of dados.projetos || []) p.pasta ||= `${nomeArquivo(p.nome || "projeto")}-${p.id}`;
    if (!Array.isArray(dados.projetos)) throw new Error("arquivo sem projetos");
    const ids = new Set(projetos.map((p) => p.id));
    const novos = dados.projetos.filter((p) => p.id && p.nome && Array.isArray(p.entradas) && !ids.has(p.id));
    projetos.push(...novos);
    novos.forEach((p) => alterou(p));
    alert(`${novos.length} projeto(s) restaurado(s). Projetos que já existiam foram mantidos como estão.`);
    telaProjetos();
  } catch (e) {
    alert(`Backup inválido: ${e.message}`);
  }
};

$("#btn-nuvem").onclick = () => (nuvem ? sincronizar() : conectar());

window.addEventListener("hashchange", rota);
rota();

// Sincroniza ao abrir, ao voltar para o app, quando a internet volta e a cada 2 minutos.
conectar();
document.addEventListener("visibilitychange", () => document.visibilityState === "visible" && (nuvem ? sincronizar() : conectar()));
window.addEventListener("online", () => (nuvem ? sincronizar() : conectar()));
setInterval(() => document.visibilityState === "visible" && nuvem && !controle && sincronizar(), 120000);

if ("serviceWorker" in navigator) navigator.serviceWorker.register("sw.js").catch(() => {});
