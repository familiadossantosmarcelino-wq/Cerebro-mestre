import { resolver, NOMES } from "./cerebro.js";
import { markdown } from "./markdown.js";

const $ = (s) => document.querySelector(s);

// ------------------------------------------------------------------ armazenamento local

const PADRAO = {
  chaveClaude: "",
  chaveGPT: "",
  modeloClaude: "claude-opus-5-5",
  modeloGPT: "gpt-5",
  coordenador: "claude",
  pesquisaWeb: true,
  complemento: true,
  simular: false,
  perfil: "Engenheiro mecânico, inspetor de manutenção. Quer respostas diretas, técnicas e bem fundamentadas.",
};

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
  } catch {
    /* armazenamento indisponível: segue sem salvar */
  }
}

let cfg = { ...PADRAO, ...ler("cerebro.cfg", {}) };
let contextos = ler("cerebro.contextos", {});
let historico = ler("cerebro.historico", []);
let controle = null;
let ultima = null;

const projetoAtual = () => $("#projeto").value.trim() || "geral";

// ------------------------------------------------------------------ interface

function atualizarAviso() {
  const faltam = [];
  if (!cfg.chaveClaude) faltam.push("Claude");
  if (!cfg.chaveGPT) faltam.push("GPT");
  $("#aviso-modo").textContent = cfg.simular
    ? "Modo simulação ativo"
    : faltam.length
      ? `Falta chave: ${faltam.join(" e ")} (⚙️)`
      : "";
}

function atualizarProjetos() {
  const nomes = new Set(["geral", ...Object.keys(contextos), ...historico.map((h) => h.projeto)]);
  $("#lista-projetos").innerHTML = [...nomes].map((n) => `<option value="${n.replace(/"/g, "&quot;")}">`).join("");
}

function desenharEtapa({ id, titulo, ia, status, texto }) {
  let el = document.getElementById(`etapa-${id}`);
  if (!el) {
    el = document.createElement("li");
    el.id = `etapa-${id}`;
    el.innerHTML = `<details><summary><span class="selo"></span><span class="titulo"></span><span class="estado"></span></summary><div class="md"></div></details>`;
    $("#etapas").appendChild(el);
  }
  el.className = `etapa ${ia} ${status}`;
  el.querySelector(".selo").textContent = NOMES[ia];
  el.querySelector(".titulo").textContent = titulo;
  el.querySelector(".estado").textContent = { rodando: "trabalhando…", ok: "pronto", erro: "falhou" }[status];
  el.querySelector(".md").innerHTML = texto ? markdown(texto) : "";
}

function mostrarResposta(texto) {
  $("#resposta").innerHTML = markdown(texto);
}

async function executar() {
  const pergunta = $("#pergunta").value.trim();
  if (!pergunta) return $("#pergunta").focus();
  if (!cfg.simular && (!cfg.chaveClaude || !cfg.chaveGPT)) {
    alert("Configure as duas chaves de API (⚙️) ou ative o modo simulação.");
    return abrirConfig();
  }

  const projeto = projetoAtual();
  const entrada = {
    pergunta,
    projeto,
    contextoProjeto: contextos[projeto] || "",
    historico: historico.filter((h) => h.projeto === projeto).slice(0, 3),
  };

  $("#resultado").hidden = false;
  $("#etapas").innerHTML = "";
  $("#bastidores").open = true;
  $("#resposta").innerHTML = '<p class="dica">As IAs estão trabalhando… acompanhe abaixo.</p>';
  $("#btn-resolver").disabled = true;
  $("#btn-parar").hidden = false;
  controle = new AbortController();

  const etapas = {};
  try {
    const r = await resolver(cfg, entrada, (e) => {
      etapas[e.id] = e;
      desenharEtapa(e);
    }, controle.signal);
    mostrarResposta(r.resposta);
    $("#bastidores").open = false;
    ultima = { id: Date.now(), data: new Date().toISOString(), projeto, pergunta, resposta: r.resposta, etapas: Object.values(etapas) };
    historico = [ultima, ...historico].slice(0, 30);
    gravar("cerebro.historico", historico);
    atualizarProjetos();
  } catch (e) {
    $("#resposta").innerHTML = markdown(
      controle.signal.aborted ? "Interrompido." : `**Não foi possível concluir.**\n\n${e.message}\n\nVerifique as chaves e os modelos em ⚙️.`,
    );
  } finally {
    $("#btn-resolver").disabled = false;
    $("#btn-parar").hidden = true;
    controle = null;
  }
}

function abrirEntrada(h) {
  ultima = h;
  $("#projeto").value = h.projeto;
  $("#pergunta").value = h.pergunta;
  $("#resultado").hidden = false;
  $("#etapas").innerHTML = "";
  (h.etapas || []).forEach(desenharEtapa);
  $("#bastidores").open = false;
  mostrarResposta(h.resposta);
}

// ------------------------------------------------------------------ diálogos

function abrirConfig() {
  const f = $("#dlg-config form");
  for (const [k, v] of Object.entries(cfg)) {
    if (!f.elements[k]) continue;
    if (f.elements[k].type === "checkbox") f.elements[k].checked = v;
    else f.elements[k].value = v;
  }
  f.elements.contextoProjeto.value = contextos[projetoAtual()] || "";
  $("#dlg-config").showModal();
}

$("#dlg-config").addEventListener("close", () => {
  if ($("#dlg-config").returnValue !== "salvar") return;
  const f = $("#dlg-config form");
  for (const k of Object.keys(PADRAO)) {
    const el = f.elements[k];
    cfg[k] = el.type === "checkbox" ? el.checked : el.value.trim();
  }
  cfg.modeloClaude ||= PADRAO.modeloClaude;
  cfg.modeloGPT ||= PADRAO.modeloGPT;
  gravar("cerebro.cfg", cfg);
  const ctx = f.elements.contextoProjeto.value.trim();
  if (ctx) contextos[projetoAtual()] = ctx;
  else delete contextos[projetoAtual()];
  gravar("cerebro.contextos", contextos);
  atualizarAviso();
  atualizarProjetos();
});

function abrirHistorico() {
  const ul = $("#lista-historico");
  ul.innerHTML = historico.length ? "" : '<li class="dica">Nada ainda.</li>';
  for (const h of historico) {
    const li = document.createElement("li");
    const b = document.createElement("button");
    b.innerHTML = `<span class="tag"></span><span class="q"></span><span class="d"></span>`;
    b.querySelector(".tag").textContent = h.projeto;
    b.querySelector(".q").textContent = h.pergunta;
    b.querySelector(".d").textContent = new Date(h.data).toLocaleString("pt-BR");
    b.onclick = () => {
      $("#dlg-historico").close();
      abrirEntrada(h);
    };
    li.appendChild(b);
    ul.appendChild(li);
  }
  $("#dlg-historico").showModal();
}

// ------------------------------------------------------------------ eventos

$("#btn-resolver").onclick = executar;
$("#btn-parar").onclick = () => controle?.abort();
$("#pergunta").addEventListener("keydown", (e) => {
  if (e.key === "Enter" && (e.ctrlKey || e.metaKey)) executar();
});
$("#btn-config").onclick = abrirConfig;
$("#btn-historico").onclick = abrirHistorico;
$("#btn-fechar-historico").onclick = () => $("#dlg-historico").close();
$("#btn-limpar-historico").onclick = () => {
  if (!confirm("Apagar todo o histórico deste aparelho?")) return;
  historico = [];
  gravar("cerebro.historico", historico);
  abrirHistorico();
};
$("#btn-copiar").onclick = async () => {
  if (!ultima) return;
  await navigator.clipboard.writeText(ultima.resposta);
  $("#btn-copiar").textContent = "Copiado ✓";
  setTimeout(() => ($("#btn-copiar").textContent = "Copiar"), 1500);
};
$("#btn-baixar").onclick = () => {
  if (!ultima) return;
  const conteudo = `# ${ultima.pergunta}\n\n_Projeto: ${ultima.projeto} — ${new Date(ultima.data).toLocaleString("pt-BR")}_\n\n${ultima.resposta}\n`;
  const a = document.createElement("a");
  a.href = URL.createObjectURL(new Blob([conteudo], { type: "text/markdown" }));
  a.download = `cerebro-${ultima.projeto}-${ultima.id}.md`;
  a.click();
  URL.revokeObjectURL(a.href);
};

$("#projeto").value = ler("cerebro.projeto", "geral");
$("#projeto").addEventListener("change", () => gravar("cerebro.projeto", projetoAtual()));
atualizarAviso();
atualizarProjetos();

if ("serviceWorker" in navigator) navigator.serviceWorker.register("sw.js").catch(() => {});
