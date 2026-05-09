import { initializeApp } from "https://www.gstatic.com/firebasejs/10.12.5/firebase-app.js";
import { getAuth } from "https://www.gstatic.com/firebasejs/10.12.5/firebase-auth.js";
import { getFirestore } from "https://www.gstatic.com/firebasejs/10.12.5/firebase-firestore.js";
import { getStorage } from "https://www.gstatic.com/firebasejs/10.12.5/firebase-storage.js";

export const firebaseConfig = {
  apiKey: "REPLACE_WITH_FIREBASE_API_KEY",
  authDomain: "REPLACE_WITH_PROJECT_ID.firebaseapp.com",
  projectId: "REPLACE_WITH_PROJECT_ID",
  storageBucket: "REPLACE_WITH_PROJECT_ID.appspot.com",
  messagingSenderId: "REPLACE_WITH_MESSAGING_SENDER_ID",
  appId: "REPLACE_WITH_FIREBASE_APP_ID"
};

export const firebaseReady = !Object.values(firebaseConfig).some((value) =>
  String(value).startsWith("REPLACE_WITH")
);

export const app = firebaseReady ? initializeApp(firebaseConfig) : null;
export const auth = firebaseReady ? getAuth(app) : null;
export const db = firebaseReady ? getFirestore(app) : null;
export const storage = firebaseReady ? getStorage(app) : null;

export function assertFirebaseReady() {
  if (!firebaseReady) {
    throw new Error(
      "Firebase config missing. Open firebase.js and replace the REPLACE_WITH_* values."
    );
  }
}

export function showFirebaseSetupWarning() {
  if (firebaseReady) return;
  const warning = document.createElement("div");
  warning.className = "setup-warning";
  warning.innerHTML = `
    <strong>Configuration Firebase manquante.</strong>
    Ouvre <code>firebase.js</code>, colle la configuration Web App Firebase,
    puis recharge cette page.
  `;
  document.body.prepend(warning);
}
