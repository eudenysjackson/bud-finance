// bud-emulator-connect.js — Bud Finance
// Conecta o Firebase SDK aos emulators locais quando BUD_USE_EMULATOR === true.
//
// COMO USAR:
//   Adicione este import NO TOPO de cada módulo JS (depois do init do Firebase):
//
//     import { connectEmulators } from './bud-emulator-connect.js';
//     connectEmulators(auth, db);
//
// Este arquivo é um ES Module (type="module").
// Não faz nada em produção (BUD_USE_EMULATOR === false).

import { connectAuthEmulator }      from 'https://www.gstatic.com/firebasejs/10.8.1/firebase-auth.js';
import { connectFirestoreEmulator } from 'https://www.gstatic.com/firebasejs/10.8.1/firebase-firestore.js';

// Guarda flags para não conectar duas vezes (erro se chamar connectXEmulator() mais de uma vez)
var _authConnected      = false;
var _firestoreConnected = false;

/**
 * Conecta auth e db aos emulators se estiver em localhost.
 * @param {import('firebase/auth').Auth}           auth
 * @param {import('firebase/firestore').Firestore} db
 */
export function connectEmulators(auth, db) {
  if (!window.BUD_USE_EMULATOR) return;

  try {
    if (auth && !_authConnected) {
      connectAuthEmulator(auth, 'http://127.0.0.1:9099', { disableWarnings: false });
      _authConnected = true;
      console.info('[Bud DEV] Auth conectado ao emulator :9099');
    }
  } catch (e) {
    console.warn('[Bud DEV] Auth emulator já conectado ou erro:', e.message);
  }

  try {
    if (db && !_firestoreConnected) {
      connectFirestoreEmulator(db, '127.0.0.1', 8080);
      _firestoreConnected = true;
      console.info('[Bud DEV] Firestore conectado ao emulator :8080');
    }
  } catch (e) {
    console.warn('[Bud DEV] Firestore emulator já conectado ou erro:', e.message);
  }
}
