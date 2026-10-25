// Configuração do seu projeto Firebase (Console do Firebase → Configurações do
// projeto → Seus apps → Web → "firebaseConfig"). Esses dados não são secretos:
// quem protege os projetos é o login e as regras do Firestore (firestore.rules).
//
// Enquanto estiver null, o app funciona só neste aparelho, sem nuvem.
export const FIREBASE_CONFIG = null;

// Exemplo de como fica depois de preenchido:
// export const FIREBASE_CONFIG = {
//   apiKey: "AIza...",
//   authDomain: "cerebro-mestre-xxxx.firebaseapp.com",
//   projectId: "cerebro-mestre-xxxx",
//   storageBucket: "cerebro-mestre-xxxx.appspot.com",
//   messagingSenderId: "1234567890",
//   appId: "1:1234567890:web:abc123",
// };
