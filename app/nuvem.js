// Nuvem com Firebase: login com Google (ou e-mail) e os dados sincronizados
// entre celular, tablet e computador, inclusive sem internet (o Firestore guarda
// tudo no aparelho e envia sozinho quando o sinal volta).
//
// Estrutura no Firestore (cada usuário só enxerga a própria pasta):
//   usuarios/{uid}                                   ← configurações (chaves de API, modelos, perfil)
//   usuarios/{uid}/projetos/{projeto}                ← nome, objetivo, datas
//   usuarios/{uid}/projetos/{projeto}/entradas/{id}  ← cada pedido e resposta

import { FIREBASE_CONFIG } from "./firebase-config.js";

const EMULADOR = new URLSearchParams(location.search).has("emulador");
const CONFIG = EMULADOR ? { apiKey: "demo", authDomain: "localhost", projectId: "demo-cerebro" } : FIREBASE_CONFIG;

export const nuvemDisponivel = !!CONFIG;

let fb, auth, db, uid;
let ouvintes = [];

const MENSAGENS = {
  "auth/invalid-credential": "e-mail ou senha incorretos",
  "auth/wrong-password": "e-mail ou senha incorretos",
  "auth/user-not-found": "conta não encontrada",
  "auth/email-already-in-use": "já existe conta com esse e-mail; use Entrar",
  "auth/weak-password": "senha fraca: use pelo menos 6 caracteres",
  "auth/invalid-email": "e-mail inválido",
  "auth/popup-closed-by-user": "login cancelado",
  "auth/popup-blocked": "o navegador bloqueou a janela de login; libere pop-ups para este site",
  "auth/unauthorized-domain": "este endereço não está autorizado no Firebase (Authentication → Settings → Authorized domains)",
  "auth/network-request-failed": "sem conexão com a internet",
};
export const mensagemErro = (e) => MENSAGENS[e?.code] || e?.message || String(e);

/**
 * Liga a nuvem. Os callbacks recebem:
 *  aoUsuario(usuario | null), aoProjetos(lista), aoConfig(config, atualizado, soDoCache), aoEstado(tipo, texto)
 */
export async function iniciarNuvem({ aoUsuario, aoProjetos, aoConfig, aoEstado }) {
  if (!CONFIG) return;
  fb = await import("./vendor/firebase.js");
  const app = fb.initializeApp(CONFIG);
  auth = fb.getAuth(app);
  db = fb.initializeFirestore(app, {
    localCache: fb.persistentLocalCache({ tabManager: fb.persistentMultipleTabManager() }),
  });
  if (EMULADOR) {
    fb.connectAuthEmulator(auth, "http://localhost:9099", { disableWarnings: true });
    fb.connectFirestoreEmulator(db, "localhost", 8080);
  }

  fb.onAuthStateChanged(auth, async (usuario) => {
    ouvintes.forEach((parar) => parar());
    ouvintes = [];
    uid = usuario?.uid || null;
    // Espera o app terminar de levar os projetos do aparelho antes de ler a nuvem,
    // senão a lista aparece vazia por um instante.
    await aoUsuario(usuario ? { uid, email: usuario.email, nome: usuario.displayName } : null);
    if (usuario && uid === usuario.uid) observar({ aoProjetos, aoConfig, aoEstado });
  });
}

// ------------------------------------------------------------------ leitura em tempo real

function observar({ aoProjetos, aoConfig, aoEstado }) {
  const projetos = new Map(); // id -> projeto
  const pendentes = new Map(); // ouvinte -> tem gravação aguardando servidor
  const deCache = new Map();

  // Só redesenha quando os registros de todos os projetos já chegaram,
  // para a lista não piscar "Ainda não iniciado" antes da hora.
  const avisar = () => {
    if ([...projetos.values()].some((p) => !p.carregado)) return;
    const lista = [...projetos.values()].map(({ carregado, ...p }) => ({ ...p, entradas: [...p.entradas] }));
    aoProjetos(lista);
  };
  const situacao = (chave, meta) => {
    pendentes.set(chave, meta.hasPendingWrites);
    deCache.set(chave, meta.fromCache);
    if ([...pendentes.values()].some(Boolean)) {
      aoEstado(navigator.onLine ? "rodando" : "offline", navigator.onLine ? "Enviando…" : "Sem internet: salvo no aparelho, envia quando o sinal voltar.");
    } else if (!navigator.onLine) {
      aoEstado("offline", "Sem internet: mostrando o que está salvo no aparelho.");
    } else {
      aoEstado("ok", `Sincronizado às ${new Date().toLocaleTimeString("pt-BR")}`);
    }
  };
  const erro = (e) => aoEstado("erro", `Nuvem: ${mensagemErro(e)}`);

  const pastaUsuario = fb.doc(db, "usuarios", uid);
  ouvintes.push(
    fb.onSnapshot(pastaUsuario, { includeMetadataChanges: true }, (snap) => {
      situacao("usuario", snap.metadata);
      const d = snap.data();
      aoConfig(d?.config || null, d?.configAtualizado || "", snap.metadata.fromCache);
    }, erro),
  );

  const entradasOuvidas = new Map(); // projeto -> parar
  ouvintes.push(() => entradasOuvidas.forEach((parar) => parar()));

  ouvintes.push(
    fb.onSnapshot(fb.collection(pastaUsuario, "projetos"), { includeMetadataChanges: true }, (snap) => {
      situacao("projetos", snap.metadata);
      const vistos = new Set();
      snap.forEach((d) => {
        vistos.add(d.id);
        const anterior = projetos.get(d.id);
        projetos.set(d.id, { id: d.id, ...d.data(), entradas: anterior?.entradas || [], carregado: !!anterior?.carregado });
        if (!entradasOuvidas.has(d.id)) {
          entradasOuvidas.set(
            d.id,
            fb.onSnapshot(fb.collection(pastaUsuario, "projetos", d.id, "entradas"), { includeMetadataChanges: true }, (s) => {
              situacao(`entradas-${d.id}`, s.metadata);
              const p = projetos.get(d.id);
              if (!p) return;
              p.entradas = s.docs.map((x) => ({ id: x.id, ...x.data() })).sort((a, b) => a.data.localeCompare(b.data));
              p.carregado = true;
              avisar();
            }, erro),
          );
        }
      });
      for (const id of [...projetos.keys()]) {
        if (vistos.has(id)) continue;
        projetos.delete(id);
        entradasOuvidas.get(id)?.();
        entradasOuvidas.delete(id);
        pendentes.delete(`entradas-${id}`);
      }
      avisar();
    }, erro),
  );
}

// ------------------------------------------------------------------ login

export const entrarGoogle = () => fb.signInWithPopup(auth, new fb.GoogleAuthProvider());
export const entrarEmail = (email, senha) => fb.signInWithEmailAndPassword(auth, email, senha);
export const criarConta = (email, senha) => fb.createUserWithEmailAndPassword(auth, email, senha);
export const recuperarSenha = (email) => fb.sendPasswordResetEmail(auth, email);
export const sair = () => fb.signOut(auth);

// ------------------------------------------------------------------ gravação
// As gravações não esperam o servidor: com o aparelho offline elas ficam na fila
// do Firestore e a tela já mostra o resultado na hora.

const projetoRef = (id) => fb.doc(db, "usuarios", uid, "projetos", id);
const entradaRef = (pid, eid) => fb.doc(db, "usuarios", uid, "projetos", pid, "entradas", eid);
const semEsperar = (promessa, aoErro) => promessa.catch((e) => aoErro?.(mensagemErro(e)));

export function salvarProjeto(p, aoErro) {
  const { nome, objetivo, criado, atualizado } = p;
  return semEsperar(fb.setDoc(projetoRef(p.id), { nome, objetivo, criado, atualizado: atualizado || criado }, { merge: true }), aoErro);
}

export function salvarEntrada(pid, e, aoErro) {
  const { id, ...dados } = e;
  return semEsperar(fb.setDoc(entradaRef(pid, id), JSON.parse(JSON.stringify(dados))), aoErro);
}

export const apagarEntrada = (pid, eid, aoErro) => semEsperar(fb.deleteDoc(entradaRef(pid, eid)), aoErro);

export async function excluirProjeto(pid, aoErro) {
  try {
    const entradas = await fb.getDocs(fb.collection(db, "usuarios", uid, "projetos", pid, "entradas"));
    const lote = fb.writeBatch(db);
    entradas.forEach((d) => lote.delete(d.ref));
    lote.delete(projetoRef(pid));
    semEsperar(lote.commit(), aoErro);
  } catch (e) {
    aoErro?.(mensagemErro(e));
  }
}

export function salvarConfig(config, atualizado, aoErro) {
  return semEsperar(fb.setDoc(fb.doc(db, "usuarios", uid), { config, configAtualizado: atualizado }, { merge: true }), aoErro);
}

// Primeiro login neste aparelho: leva para a nuvem o que já existia aqui.
// Os projetos iniciais só sobem se a conta ainda não tem nada (conta nova).
export async function migrar(projetosLocais, ehInicialSemUso) {
  const pasta = fb.doc(db, "usuarios", uid);
  const existente = await fb.getDoc(pasta).catch(() => null);
  const contaNova = !existente?.exists();
  if (contaNova) await fb.setDoc(pasta, { criado: new Date().toISOString() }, { merge: true });
  for (const p of projetosLocais) {
    if (!contaNova && ehInicialSemUso(p)) continue;
    salvarProjeto(p);
    for (const e of p.entradas) salvarEntrada(p.id, e);
  }
}
