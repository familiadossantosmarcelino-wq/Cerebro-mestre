// Sincronização na nuvem usando um repositório PRIVADO do GitHub como armazenamento.
//
// Estrutura no repositório de dados:
//   projetos/<nome-do-projeto>-<id>/projeto.json   ← dados completos (o app lê este)
//   projetos/<nome-do-projeto>-<id>/projeto.md     ← o mesmo projeto, legível no GitHub
//   config.enc.json                                 ← chaves de API cifradas com a sua senha
//   excluidos.json                                  ← ids de projetos excluídos (vale para todos os aparelhos)
//
// Cada aparelho guarda uma cópia local e, ao sincronizar, as duas versões são
// mescladas: registros novos de qualquer aparelho são somados, nada se sobrescreve.

const API = "https://api.github.com";

// ------------------------------------------------------------------ texto ↔ base64 (UTF-8)

function paraBase64(texto) {
  const bytes = new TextEncoder().encode(texto);
  let bin = "";
  for (let i = 0; i < bytes.length; i += 0x8000) bin += String.fromCharCode(...bytes.subarray(i, i + 0x8000));
  return btoa(bin);
}
function deBase64(b64) {
  const bin = atob(b64.replace(/\s/g, ""));
  return new TextDecoder().decode(Uint8Array.from(bin, (c) => c.charCodeAt(0)));
}

// ------------------------------------------------------------------ GitHub

export class ErroNuvem extends Error {
  constructor(msg, status) {
    super(msg);
    this.status = status;
  }
}

export class Nuvem {
  constructor({ token, repo }) {
    this.token = token.trim();
    this.repo = repo.trim().replace(/^https:\/\/github\.com\//, "").replace(/\.git$|\/$/g, "");
    this.fila = Promise.resolve();
  }

  async req(metodo, caminho, corpo) {
    let r;
    try {
      r = await fetch(`${API}/repos/${this.repo}${caminho}`, {
        method: metodo,
        cache: "no-store",
        headers: {
          authorization: `Bearer ${this.token}`,
          accept: "application/vnd.github+json",
          ...(corpo ? { "content-type": "application/json" } : {}),
        },
        body: corpo ? JSON.stringify(corpo) : undefined,
      });
    } catch {
      throw new ErroNuvem("sem conexão com a internet", 0);
    }
    if (r.status === 404 && metodo === "GET") return null;
    const dados = r.status === 204 ? {} : await r.json().catch(() => ({}));
    if (!r.ok) {
      const msg = { 401: "token inválido ou expirado", 403: "token sem permissão neste repositório", 404: "repositório não encontrado" }[r.status];
      throw new ErroNuvem(msg || dados.message || `HTTP ${r.status}`, r.status);
    }
    return dados;
  }

  // Escritas no mesmo repositório precisam ser uma de cada vez (senão o GitHub recusa).
  emSerie(fn) {
    const p = this.fila.then(fn);
    this.fila = p.catch(() => {});
    return p;
  }

  async testar() {
    const r = await this.req("GET", "");
    if (!r) throw new ErroNuvem("repositório não encontrado (confira o nome e o acesso do token)", 404);
    if (!r.private) throw new ErroNuvem("o repositório de dados precisa ser PRIVADO", 0);
    if (r.permissions && !r.permissions.push) throw new ErroNuvem("o token não tem permissão de escrita", 403);
    return r;
  }

  async ler(caminho) {
    const r = await this.req("GET", `/contents/${caminho}`);
    if (!r) return null;
    if (Array.isArray(r)) return { lista: r };
    let conteudo = r.content;
    // Arquivos acima de 1 MB vêm sem conteúdo: busca pelo blob.
    if (!conteudo && r.sha) conteudo = (await this.req("GET", `/git/blobs/${r.sha}`)).content;
    return { texto: deBase64(conteudo || ""), sha: r.sha };
  }

  async gravar(caminho, texto, mensagem) {
    for (let tentativa = 0; tentativa < 3; tentativa++) {
      const atual = await this.req("GET", `/contents/${caminho}`);
      if (atual && !Array.isArray(atual) && atual.content && deBase64(atual.content) === texto) return;
      try {
        await this.req("PUT", `/contents/${caminho}`, {
          message: mensagem,
          content: paraBase64(texto),
          ...(atual?.sha ? { sha: atual.sha } : {}),
        });
        return;
      } catch (e) {
        if (e.status !== 409 && e.status !== 422) throw e;
        await new Promise((r) => setTimeout(r, 600 * (tentativa + 1)));
      }
    }
    throw new ErroNuvem(`conflito ao gravar ${caminho}`, 409);
  }

  async apagar(caminho, mensagem) {
    const atual = await this.req("GET", `/contents/${caminho}`);
    if (!atual?.sha) return;
    await this.req("DELETE", `/contents/${caminho}`, { message: mensagem, sha: atual.sha });
  }

  async listarProjetos() {
    const raiz = await this.ler("projetos");
    if (!raiz?.lista) return [];
    const pastas = raiz.lista.filter((x) => x.type === "dir");
    const lidos = await Promise.all(
      pastas.map(async (d) => {
        try {
          return await this.lerProjeto(d.name);
        } catch {
          return null;
        }
      }),
    );
    return lidos.filter(Boolean);
  }

  // Os métodos abaixo não entram na fila sozinhos: quem chama usa emSerie().
  async lerProjeto(pasta) {
    const arq = await this.ler(`projetos/${pasta}/projeto.json`);
    return arq?.texto ? { ...JSON.parse(arq.texto), pasta } : null;
  }

  async salvarProjeto(projeto, markdownProjeto) {
    const base = `projetos/${projeto.pasta}`;
    await this.gravar(`${base}/projeto.json`, JSON.stringify(canonico(projeto), null, 1), `Atualiza ${projeto.nome}`);
    await this.gravar(`${base}/projeto.md`, markdownProjeto, `Atualiza ${projeto.nome} (texto)`);
  }

  async apagarProjeto(projeto) {
    const base = `projetos/${projeto.pasta}`;
    await this.apagar(`${base}/projeto.json`, `Exclui ${projeto.nome}`);
    await this.apagar(`${base}/projeto.md`, `Exclui ${projeto.nome} (texto)`);
  }

  async lerExcluidos() {
    const arq = await this.ler("excluidos.json");
    return arq?.texto ? JSON.parse(arq.texto) : [];
  }

  salvarExcluidos(ids) {
    return this.gravar("excluidos.json", JSON.stringify(ids), "Atualiza lista de projetos excluídos");
  }

  async lerConfig() {
    const arq = await this.ler("config.enc.json");
    return arq?.texto ? JSON.parse(arq.texto) : null;
  }

  salvarConfig(cifrado) {
    return this.gravar("config.enc.json", JSON.stringify(cifrado), "Atualiza configurações");
  }
}

// ------------------------------------------------------------------ mescla

// Formato fixo do que vai para a nuvem (sem campos só locais).
export function canonico(p) {
  return {
    id: p.id,
    pasta: p.pasta,
    nome: p.nome,
    objetivo: p.objetivo,
    criado: p.criado,
    atualizado: p.atualizado || p.criado,
    removidas: [...new Set(p.removidas || [])].sort(),
    entradas: p.entradas,
  };
}

// Junta a versão deste aparelho com a da nuvem. Registros são somados;
// nome/objetivo ficam com a versão editada por último; apagados não voltam.
export function mesclar(local, remoto) {
  if (!local) return { ...remoto, sincronizado: true };
  if (!remoto) return local;
  const removidas = new Set([...(local.removidas || []), ...(remoto.removidas || [])]);
  const meta = (local.atualizado || local.criado) >= (remoto.atualizado || remoto.criado) ? local : remoto;
  const porId = new Map();
  for (const e of [...remoto.entradas, ...local.entradas]) {
    const ja = porId.get(e.id);
    porId.set(e.id, ja?.etapas && !e.etapas ? ja : e);
  }
  const entradas = [...porId.values()].filter((e) => !removidas.has(e.id)).sort((a, b) => a.data.localeCompare(b.data));
  return {
    ...canonico({ ...meta, removidas: [...removidas], entradas }),
    pasta: remoto.pasta || local.pasta,
    sincronizado: true,
  };
}

export const iguais = (a, b) => JSON.stringify(canonico(a)) === JSON.stringify(canonico(b));

// ------------------------------------------------------------------ cifra das chaves

async function derivar(senha, sal) {
  const base = await crypto.subtle.importKey("raw", new TextEncoder().encode(senha), "PBKDF2", false, ["deriveKey"]);
  return crypto.subtle.deriveKey(
    { name: "PBKDF2", salt: sal, iterations: 250000, hash: "SHA-256" },
    base,
    { name: "AES-GCM", length: 256 },
    false,
    ["encrypt", "decrypt"],
  );
}

const b64 = (bytes) => btoa(String.fromCharCode(...new Uint8Array(bytes)));
const deB64 = (s) => Uint8Array.from(atob(s), (c) => c.charCodeAt(0));

export async function cifrar(objeto, senha) {
  const sal = crypto.getRandomValues(new Uint8Array(16));
  const iv = crypto.getRandomValues(new Uint8Array(12));
  const chave = await derivar(senha, sal);
  const dados = await crypto.subtle.encrypt({ name: "AES-GCM", iv }, chave, new TextEncoder().encode(JSON.stringify(objeto)));
  return { v: 1, sal: b64(sal), iv: b64(iv), dados: b64(dados) };
}

export async function decifrar(pacote, senha) {
  try {
    const chave = await derivar(senha, deB64(pacote.sal));
    const claro = await crypto.subtle.decrypt({ name: "AES-GCM", iv: deB64(pacote.iv) }, chave, deB64(pacote.dados));
    return JSON.parse(new TextDecoder().decode(claro));
  } catch {
    throw new ErroNuvem("senha das chaves incorreta", 0);
  }
}
