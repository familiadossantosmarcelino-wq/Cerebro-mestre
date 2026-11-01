// Só as funções do Firebase que o app usa. Gera app/vendor/firebase.js:
//   npm i firebase@10.12.2 esbuild@0.21.5
//   npx esbuild ferramentas/firebase-entrada.js --bundle --format=esm --minify --outfile=app/vendor/firebase.js
export { initializeApp } from "firebase/app";
export {
  getAuth,
  connectAuthEmulator,
  onAuthStateChanged,
  GoogleAuthProvider,
  signInWithPopup,
  signInWithEmailAndPassword,
  createUserWithEmailAndPassword,
  sendPasswordResetEmail,
  signOut,
} from "firebase/auth";
export {
  initializeFirestore,
  connectFirestoreEmulator,
  persistentLocalCache,
  persistentMultipleTabManager,
  doc,
  collection,
  getDoc,
  getDocs,
  setDoc,
  deleteDoc,
  writeBatch,
  onSnapshot,
} from "firebase/firestore";
