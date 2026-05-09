import { auth, db, firebaseReady, showFirebaseSetupWarning } from "./firebase.js";
import {
  browserLocalPersistence,
  createUserWithEmailAndPassword,
  onAuthStateChanged,
  setPersistence,
  signInWithEmailAndPassword,
  signOut,
  updateProfile
} from "https://www.gstatic.com/firebasejs/10.12.5/firebase-auth.js";
import {
  doc,
  getDoc,
  serverTimestamp,
  setDoc
} from "https://www.gstatic.com/firebasejs/10.12.5/firebase-firestore.js";

const AUTH_PAGES = new Set(["login.html", "register.html", "", "index.html"]);

function currentPage() {
  return window.location.pathname.split("/").pop();
}

function setStatus(target, message, type = "info") {
  if (!target) return;
  target.textContent = message;
  target.dataset.type = type;
}

function authErrorMessage(error) {
  const code = error?.code || "";
  if (code.includes("email-already-in-use")) return "Cet email est deja utilise.";
  if (code.includes("invalid-email")) return "Email invalide.";
  if (code.includes("weak-password")) return "Mot de passe trop faible.";
  if (code.includes("invalid-credential") || code.includes("wrong-password")) {
    return "Email ou mot de passe incorrect.";
  }
  if (code.includes("too-many-requests")) return "Trop de tentatives. Reessaie plus tard.";
  return error?.message || "Une erreur est survenue.";
}

export function redirectIfLoggedIn(target = "app.html") {
  showFirebaseSetupWarning();
  if (!firebaseReady) return;

  onAuthStateChanged(auth, (user) => {
    if (user && AUTH_PAGES.has(currentPage())) {
      window.location.replace(target);
    }
  });
}

export function protectPage({ onUser, redirectTo = "login.html" } = {}) {
  showFirebaseSetupWarning();
  if (!firebaseReady) return () => {};

  return onAuthStateChanged(auth, async (user) => {
    if (!user) {
      window.location.replace(redirectTo);
      return;
    }

    await ensureUserProfile(user);
    if (onUser) onUser(user);
  });
}

export async function ensureUserProfile(user) {
  if (!firebaseReady || !user) return null;
  const userRef = doc(db, "users", user.uid);
  const snapshot = await getDoc(userRef);
  if (snapshot.exists()) return snapshot.data();

  const profile = {
    uid: user.uid,
    email: user.email,
    displayName: user.displayName || user.email?.split("@")[0] || "Viewer",
    createdAt: serverTimestamp(),
    updatedAt: serverTimestamp()
  };
  await setDoc(userRef, profile, { merge: true });
  return profile;
}

export async function getUserProfile(uid) {
  if (!firebaseReady || !uid) return null;
  const snapshot = await getDoc(doc(db, "users", uid));
  return snapshot.exists() ? snapshot.data() : null;
}

export async function isAdminUser(uid) {
  if (!firebaseReady || !uid) return false;
  const snapshot = await getDoc(doc(db, "admins", uid));
  return snapshot.exists();
}

export function wireAuthForms() {
  showFirebaseSetupWarning();
  if (!firebaseReady) return;

  const loginForm = document.querySelector("#loginForm");
  const registerForm = document.querySelector("#registerForm");
  const status = document.querySelector("[data-auth-status]");

  setPersistence(auth, browserLocalPersistence).catch(() => {
    setStatus(status, "Impossible de definir la session persistante.", "error");
  });

  if (loginForm) {
    loginForm.addEventListener("submit", async (event) => {
      event.preventDefault();
      const formData = new FormData(loginForm);
      const email = String(formData.get("email") || "").trim();
      const password = String(formData.get("password") || "");
      const button = loginForm.querySelector("button[type='submit']");

      button.disabled = true;
      setStatus(status, "Connexion en cours...");
      try {
        await signInWithEmailAndPassword(auth, email, password);
        window.location.replace("app.html");
      } catch (error) {
        setStatus(status, authErrorMessage(error), "error");
      } finally {
        button.disabled = false;
      }
    });
  }

  if (registerForm) {
    registerForm.addEventListener("submit", async (event) => {
      event.preventDefault();
      const formData = new FormData(registerForm);
      const displayName = String(formData.get("displayName") || "").trim();
      const email = String(formData.get("email") || "").trim();
      const password = String(formData.get("password") || "");
      const button = registerForm.querySelector("button[type='submit']");

      button.disabled = true;
      setStatus(status, "Creation du compte...");
      try {
        const credential = await createUserWithEmailAndPassword(auth, email, password);
        if (displayName) {
          await updateProfile(credential.user, { displayName });
        }
        await setDoc(doc(db, "users", credential.user.uid), {
          uid: credential.user.uid,
          email,
          displayName: displayName || email.split("@")[0],
          createdAt: serverTimestamp(),
          updatedAt: serverTimestamp()
        });
        window.location.replace("app.html");
      } catch (error) {
        setStatus(status, authErrorMessage(error), "error");
      } finally {
        button.disabled = false;
      }
    });
  }
}

export function wireLogout() {
  document.querySelectorAll("[data-logout]").forEach((button) => {
    button.addEventListener("click", async () => {
      await signOut(auth);
      window.location.replace("login.html");
    });
  });
}

if (AUTH_PAGES.has(currentPage())) {
  wireAuthForms();
  redirectIfLoggedIn();
}
