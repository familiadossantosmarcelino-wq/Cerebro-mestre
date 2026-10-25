// Orquestração do Cérebro Mestre: Claude e GPT dividem o trabalho, executam
// cada um a sua parte, complementam a parte do outro e entregam UMA resposta.
//
//   1. Análise   — as duas IAs leem a demanda e dizem como atacariam e onde são fortes.
//   2. Plano     — o coordenador junta as duas análises e divide as partes.
//   3. Execução  — cada IA faz a(s) sua(s) parte(s) em paralelo, com pesquisa web.
//   4. Complemento cruzado — cada IA lê a parte da outra e acrescenta/corrige.
//   5. Síntese   — o coordenador funde tudo numa resposta final única.
//
// Se uma IA falhar numa etapa, a outra assume — a resposta não trava.

export const NOMES = { claude: "Claude", gpt: "GPT" };
const outra = (ia) => (ia === "claude" ? "gpt" : "claude");

// ------------------------------------------------------------------ provedores

class ErroAPI extends Error {
  constructor(msg, status) {
    super(msg);
    this.status = status;
  }
}

async function postJSON(url, cabecalhos, corpo, sinal) {
  const r = await fetch(url, {
    method: "POST",
    headers: { "content-type": "application/json", ...cabecalhos },
    body: JSON.stringify(corpo),
    signal: sinal,
  });
  const dados = await r.json().catch(() => ({}));
  if (!r.ok) {
    const msg = dados?.error?.message || `HTTP ${r.status}`;
    throw new ErroAPI(msg, r.status);
  }
  return dados;
}

function listarFontes(fontes) {
  const unicas = [...new Map(fontes.filter((f) => f.url).map((f) => [f.url, f])).values()];
  if (!unicas.length) return "";
  return "\n\n**Fontes consultadas:**\n" + unicas.map((f) => `- [${f.titulo || f.url}](${f.url})`).join("\n");
}

async function chamarClaude(cfg, { sistema, mensagem, pesquisar, sinal }) {
  const corpo = {
    model: cfg.modeloClaude,
    max_tokens: 16000,
    system: sistema,
    output_config: { effort: "high" },
    // Se o filtro de segurança recusar, a própria API refaz no modelo recomendado.
    fallbacks: "default",
    messages: [{ role: "user", content: mensagem }],
  };
  if (pesquisar) corpo.tools = [{ type: "web_search_20260209", name: "web_search", max_uses: 5 }];

  const cabecalhos = {
    "x-api-key": cfg.chaveClaude,
    "anthropic-version": "2023-06-01",
    "anthropic-beta": "server-side-fallback-2026-07-01",
    "anthropic-dangerous-direct-browser-access": "true",
  };

  let conteudo = [];
  let resp;
  // pause_turn: a pesquisa longa pausou; reenviar o que veio faz a API continuar.
  for (let i = 0; i < 4; i++) {
    resp = await postJSON("https://api.anthropic.com/v1/messages", cabecalhos, corpo, sinal);
    conteudo = conteudo.concat(resp.content || []);
    if (resp.stop_reason !== "pause_turn") break;
    corpo.messages = [corpo.messages[0], { role: "assistant", content: conteudo }];
  }
  if (resp.stop_reason === "refusal") {
    throw new ErroAPI(`Claude recusou (${resp.stop_details?.category || "sem categoria"})`, 200);
  }

  const blocos = conteudo.filter((b) => b.type === "text");
  const fontes = blocos.flatMap((b) => (b.citations || []).map((c) => ({ url: c.url, titulo: c.title })));
  return blocos.map((b) => b.text).join("") + listarFontes(fontes);
}

async function chamarGPT(cfg, { sistema, mensagem, pesquisar, sinal }) {
  const corpo = { model: cfg.modeloGPT, instructions: sistema, input: mensagem };
  if (pesquisar) corpo.tools = [{ type: "web_search" }];
  const cabecalhos = { authorization: `Bearer ${cfg.chaveGPT}` };
  const url = "https://api.openai.com/v1/responses";

  let resp;
  try {
    resp = await postJSON(url, cabecalhos, corpo, sinal);
  } catch (e) {
    // Modelo sem suporte a pesquisa web: tenta de novo sem a ferramenta.
    if (!pesquisar || e.status !== 400) throw e;
    delete corpo.tools;
    resp = await postJSON(url, cabecalhos, corpo, sinal);
  }

  const partes = (resp.output || [])
    .filter((o) => o.type === "message")
    .flatMap((o) => o.content || [])
    .filter((c) => c.type === "output_text");
  const fontes = partes.flatMap((p) =>
    (p.annotations || []).filter((a) => a.type === "url_citation").map((a) => ({ url: a.url, titulo: a.title })),
  );
  return partes.map((p) => p.text).join("") + listarFontes(fontes);
}

function simulador(ia) {
  return async (_cfg, { sistema, mensagem }) => {
    await new Promise((r) => setTimeout(r, 400 + Math.random() * 600));
    if (sistema.includes("COORDENADOR") && mensagem.includes("JSON")) {
      return '```json\n{"entendimento":"Demanda simulada.","partes":[' +
        '{"titulo":"Fundamentos técnicos","responsavel":"claude","instrucoes":"Explique a base técnica."},' +
        '{"titulo":"Normas e dados de mercado","responsavel":"gpt","instrucoes":"Levante normas e referências."}],' +
        '"formato_final":"Relatório técnico"}\n```';
    }
    return `**[${NOMES[ia]} — modo simulação]**\n\nTexto de exemplo para testar o fluxo.\n\n- FATO: item exemplo\n- SUPOSIÇÃO: item exemplo`;
  };
}

function provedor(cfg, ia) {
  if (cfg.simular) return simulador(ia);
  return ia === "claude" ? chamarClaude : chamarGPT;
}

// ------------------------------------------------------------------ prompts

function regras(cfg) {
  return `Você faz parte do "Cérebro Mestre": Claude e GPT trabalhando JUNTOS, como uma
equipe, para entregar ao usuário a melhor resposta possível. Não há disputa entre
vocês: cada um contribui com o que tem de melhor e o resultado é um só.

Perfil do usuário: ${cfg.perfil || "não informado"}

Regras:
- Português do Brasil, tom técnico, direto e explicativo.
- Não invente fatos, dados, normas ou fontes. Se não souber, diga.
- Diferencie claramente FATO de SUPOSIÇÃO.
- Priorize respostas práticas e aplicáveis.`;
}

function contextoBase(entrada) {
  let t = "";
  if (entrada.contextoProjeto) t += `CONTEXTO DO PROJETO "${entrada.projeto}":\n${entrada.contextoProjeto}\n\n`;
  if (entrada.historico?.length) {
    t += "PERGUNTAS ANTERIORES NESTE PROJETO (resumo):\n";
    for (const h of entrada.historico) t += `- P: ${h.pergunta}\n  R: ${h.resposta.slice(0, 1200)}\n`;
    t += "\n";
  }
  return t + `DEMANDA DO USUÁRIO:\n${entrada.pergunta}\n`;
}

function extrairJSON(texto) {
  const ini = texto.indexOf("{");
  const fim = texto.lastIndexOf("}");
  if (ini < 0 || fim <= ini) return null;
  try {
    return JSON.parse(texto.slice(ini, fim + 1));
  } catch {
    return null;
  }
}

function normalizarPlano(plano) {
  const padrao = {
    entendimento: "",
    formato_final: "",
    partes: [
      { titulo: "Análise técnica e fundamentos", responsavel: "claude", instrucoes: "Desenvolva a base técnica da resposta." },
      { titulo: "Pesquisa de normas, dados e referências práticas", responsavel: "gpt", instrucoes: "Levante normas, dados e exemplos práticos." },
    ],
  };
  if (!plano || !Array.isArray(plano.partes) || !plano.partes.length) return padrao;
  plano.partes = plano.partes.slice(0, 4).map((p) => ({
    titulo: String(p.titulo || "Parte"),
    responsavel: p.responsavel === "gpt" ? "gpt" : "claude",
    instrucoes: String(p.instrucoes || ""),
  }));
  // Garante que as duas IAs participem.
  const usadas = new Set(plano.partes.map((p) => p.responsavel));
  if (usadas.size === 1 && plano.partes.length > 1) {
    const ultima = plano.partes[plano.partes.length - 1];
    ultima.responsavel = outra(ultima.responsavel);
  }
  return plano;
}

// ------------------------------------------------------------------ fluxo

/**
 * Executa o fluxo completo.
 * @param {object} cfg       configurações (chaves, modelos, coordenador, ...)
 * @param {object} entrada   {pergunta, projeto, contextoProjeto, historico}
 * @param {(etapa) => void} aoAtualizar  recebe {id, titulo, ia, status, texto}
 */
export async function resolver(cfg, entrada, aoAtualizar, sinal) {
  const base = contextoBase(entrada);
  const coord = cfg.coordenador === "gpt" ? "gpt" : "claude";

  // Chama a IA pedida; se falhar, a outra assume a mesma tarefa.
  // Em etapas opcionais (análise, complemento) não há substituta: a etapa é pulada.
  async function executar(id, titulo, ia, sistema, mensagem, pesquisar = false, substituir = true) {
    aoAtualizar({ id, titulo, ia, status: "rodando", texto: "" });
    try {
      const texto = await provedor(cfg, ia)(cfg, { sistema, mensagem, pesquisar, sinal });
      aoAtualizar({ id, titulo, ia, status: "ok", texto });
      return { ia, texto };
    } catch (e) {
      if (sinal?.aborted) throw e;
      if (!substituir) {
        aoAtualizar({ id, titulo, ia, status: "erro", texto: `${NOMES[ia]} falhou (${e.message}). Etapa pulada.` });
        throw e;
      }
      const substituta = outra(ia);
      const aviso = `${NOMES[ia]} falhou (${e.message}). ${NOMES[substituta]} assumiu esta etapa.`;
      aoAtualizar({ id, titulo, ia: substituta, status: "rodando", texto: aviso });
      try {
        const texto = await provedor(cfg, substituta)(cfg, { sistema, mensagem, pesquisar, sinal });
        aoAtualizar({ id, titulo, ia: substituta, status: "ok", texto: `> ${aviso}\n\n${texto}` });
        return { ia: substituta, texto };
      } catch (e2) {
        aoAtualizar({ id, titulo, ia: substituta, status: "erro", texto: `${aviso}\nTambém falhou: ${e2.message}` });
        throw new Error(`As duas IAs falharam em "${titulo}": ${e.message} | ${e2.message}`);
      }
    }
  }

  // 1. Análise — as duas em paralelo.
  const pedidoAnalise = (ia) =>
    `${base}\nANTES de resolver, analise a demanda em no máximo 200 palavras:
1. O que realmente está sendo pedido (e o que está implícito).
2. Como você dividiria o trabalho em 2 a 4 frentes.
3. Em quais frentes você (${NOMES[ia]}) é mais forte, e onde o colega (${NOMES[outra(ia)]}) tende a ser melhor. Seja honesto.`;
  const analises = await Promise.allSettled(
    ["claude", "gpt"].map((ia) => executar(`analise-${ia}`, "Análise inicial", ia, regras(cfg), pedidoAnalise(ia), false, false)),
  );
  const textoAnalises = analises
    .map((r, i) => (r.status === "fulfilled" ? `ANÁLISE DO ${NOMES[["claude", "gpt"][i]].toUpperCase()}:\n${r.value.texto}` : ""))
    .filter(Boolean)
    .join("\n\n");

  // 2. Plano — o coordenador divide as partes.
  const sistemaCoord = regras(cfg) + "\n\nSeu papel agora: COORDENADOR da equipe.";
  const pedidoPlano = `${base}\n${textoAnalises}\n
Com base nas duas análises, divida o trabalho. Responda SOMENTE com um JSON:
{"entendimento": "o que o usuário precisa, em 1-2 frases",
 "partes": [{"titulo": "...", "responsavel": "claude" ou "gpt", "instrucoes": "o que exatamente produzir"}],
 "formato_final": "como a resposta final deve ser organizada"}
Regras: 2 a 4 partes, sem sobreposição; as duas IAs com pelo menos uma parte;
atribua cada parte a quem declarou ser mais forte nela.`;
  const rPlano = await executar("plano", "Divisão do trabalho", coord, sistemaCoord, pedidoPlano);
  const plano = normalizarPlano(extrairJSON(rPlano.texto));
  const resumoPlano =
    `Entendimento: ${plano.entendimento}\n` +
    plano.partes.map((p, i) => `${i + 1}. ${p.titulo} → ${NOMES[p.responsavel]}: ${p.instrucoes}`).join("\n");
  aoAtualizar({
    id: "plano",
    titulo: "Divisão do trabalho",
    ia: rPlano.ia,
    status: "ok",
    texto:
      (plano.entendimento ? `**Entendimento:** ${plano.entendimento}\n\n` : "") +
      plano.partes.map((p) => `- **${p.titulo}** → ${NOMES[p.responsavel]}  \n  ${p.instrucoes}`).join("\n"),
  });

  // 3. Execução — partes em paralelo, com pesquisa web.
  const resultados = await Promise.all(
    plano.partes.map((p, i) =>
      executar(
        `parte-${i}`,
        p.titulo,
        p.responsavel,
        regras(cfg) + `\n\nSeu papel agora: responsável pela parte "${p.titulo}".`,
        `${base}\nPLANO DA EQUIPE:\n${resumoPlano}\n\nSUA PARTE: "${p.titulo}"\n${p.instrucoes}\n
Produza somente a sua parte, com profundidade técnica. Pesquise na web quando precisar de
normas, dados ou referências atuais e cite as fontes. Marque FATO e SUPOSIÇÃO quando relevante.`,
        cfg.pesquisaWeb,
      ).then((r) => ({ ...r, titulo: p.titulo })),
    ),
  );

  // 4. Complemento cruzado — cada IA lê o que a outra produziu.
  let complementos = [];
  if (cfg.complemento) {
    const porIA = (ia) => resultados.filter((r) => r.ia === ia);
    const tarefas = ["claude", "gpt"]
      .filter((ia) => porIA(outra(ia)).length)
      .map((ia) => {
        const doColega = porIA(outra(ia)).map((r) => `### ${r.titulo}\n${r.texto}`).join("\n\n");
        const meu = porIA(ia).map((r) => `### ${r.titulo}\n${r.texto}`).join("\n\n") || "(nenhuma)";
        return executar(
          `complemento-${ia}`,
          `Complementa o trabalho do ${NOMES[outra(ia)]}`,
          ia,
          regras(cfg) + "\n\nSeu papel agora: COMPLEMENTAR o trabalho do colega.",
          `${base}\nPLANO:\n${resumoPlano}\n\nSUA PARTE:\n${meu}\n\nPARTE DO COLEGA (${NOMES[outra(ia)]}):\n${doColega}\n
Leia a parte do colega e contribua — não é para aprovar nem reprovar:
- acrescente o que ficou faltando e que você sabe;
- corrija o que estiver errado, com justificativa (e fonte, se houver);
- aponte onde a parte dele e a sua se conectam ou entram em conflito.
Seja objetivo; não reescreva o que já está bom. Se não houver nada a acrescentar, diga apenas "Sem complementos".`,
          false,
          false,
        ).catch(() => null);
      });
    complementos = (await Promise.all(tarefas)).filter(Boolean);
  }

  // 5. Síntese — uma resposta final única.
  const material =
    resultados.map((r) => `### ${r.titulo} (por ${NOMES[r.ia]})\n${r.texto}`).join("\n\n") +
    (complementos.length
      ? "\n\n## COMPLEMENTOS CRUZADOS\n" + complementos.map((c) => `### Por ${NOMES[c.ia]}\n${c.texto}`).join("\n\n")
      : "");
  const final = await executar(
    "sintese",
    "Resposta final",
    coord,
    regras(cfg) + "\n\nSeu papel agora: redigir a RESPOSTA FINAL ÚNICA da equipe.",
    `${base}\nPLANO:\n${resumoPlano}\nFormato desejado: ${plano.formato_final || "o mais útil para a demanda"}\n
MATERIAL PRODUZIDO PELA EQUIPE:\n${material}\n
Funda tudo numa única resposta, como se fosse escrita por um só especialista:
1. Comece com a resposta direta (3 a 5 linhas).
2. Desenvolva com a melhor parte de cada contribuição, sem repetições.
3. Incorpore as correções dos complementos. Onde houve divergência, diga qual posição foi adotada e por quê.
4. Termine com "Pontos a verificar" (o que depende de confirmação em campo, norma ou fabricante) e as fontes citadas.
Não descreva o processo interno da equipe, exceto nas divergências.`,
  );

  return { resposta: final.texto, plano, resultados, complementos };
}
