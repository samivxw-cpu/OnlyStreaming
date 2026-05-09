import { db, firebaseReady } from "./firebase.js";
import {
  addDoc,
  collection,
  deleteDoc,
  doc,
  getDoc,
  getDocs,
  increment,
  limit,
  onSnapshot,
  orderBy,
  query,
  serverTimestamp,
  setDoc,
  updateDoc,
  where
} from "https://www.gstatic.com/firebasejs/10.12.5/firebase-firestore.js";

const MOVIES_COLLECTION = "movies";

export function movieFromSnapshot(snapshot) {
  const data = snapshot.data();
  return {
    id: snapshot.id,
    title: data.title || "Sans titre",
    description: data.description || "",
    imageURL: data.imageURL || "",
    videoURL: data.videoURL || "",
    category: data.category || "film",
    views: Number(data.views || 0),
    createdAt: data.createdAt || null,
    titleLower: data.titleLower || String(data.title || "").toLowerCase()
  };
}

export function listenMovies(callback, onError) {
  if (!firebaseReady) return () => {};
  const moviesRef = collection(db, MOVIES_COLLECTION);

  return onSnapshot(
    moviesRef,
    (snapshot) => {
      const movies = snapshot.docs
        .map(movieFromSnapshot)
        .sort((a, b) => String(a.title).localeCompare(String(b.title)));
      callback(movies);
    },
    onError
  );
}

export async function getMovie(movieId) {
  if (!firebaseReady || !movieId) return null;
  const snapshot = await getDoc(doc(db, MOVIES_COLLECTION, movieId));
  return snapshot.exists() ? movieFromSnapshot(snapshot) : null;
}

export async function addMovie(movie, user) {
  if (!firebaseReady) throw new Error("Firebase is not configured.");
  const cleanMovie = normalizeMovie(movie);
  const ref = await addDoc(collection(db, MOVIES_COLLECTION), {
    ...cleanMovie,
    views: 0,
    createdBy: user?.uid || null,
    createdAt: serverTimestamp(),
    updatedAt: serverTimestamp()
  });
  return ref.id;
}

export async function updateMovie(movieId, patch) {
  if (!firebaseReady || !movieId) return;
  await updateDoc(doc(db, MOVIES_COLLECTION, movieId), {
    ...normalizeMovie(patch),
    updatedAt: serverTimestamp()
  });
}

export async function incrementMovieViews(movieId) {
  if (!firebaseReady || !movieId) return;
  await updateDoc(doc(db, MOVIES_COLLECTION, movieId), {
    views: increment(1),
    updatedAt: serverTimestamp()
  }).catch(() => {
    // View counters should never block playback.
  });
}

export async function getTopMovies(max = 10) {
  if (!firebaseReady) return [];
  const topQuery = query(
    collection(db, MOVIES_COLLECTION),
    orderBy("views", "desc"),
    limit(max)
  );
  const snapshot = await getDocs(topQuery);
  return snapshot.docs.map(movieFromSnapshot);
}

export async function getRecommendations(category, excludeId, max = 8) {
  if (!firebaseReady || !category) return [];
  const recommendationsQuery = query(
    collection(db, MOVIES_COLLECTION),
    where("category", "==", category),
    limit(max + 1)
  );
  const snapshot = await getDocs(recommendationsQuery);
  return snapshot.docs
    .map(movieFromSnapshot)
    .filter((movie) => movie.id !== excludeId)
    .slice(0, max);
}

export function filterMovies(movies, searchTerm) {
  const term = String(searchTerm || "").trim().toLowerCase();
  if (!term) return movies;
  return movies.filter((movie) => {
    return (
      movie.title.toLowerCase().includes(term) ||
      movie.description.toLowerCase().includes(term) ||
      movie.category.toLowerCase().includes(term)
    );
  });
}

export function groupByCategory(movies) {
  return movies.reduce((groups, movie) => {
    const key = movie.category || "film";
    if (!groups[key]) groups[key] = [];
    groups[key].push(movie);
    return groups;
  }, {});
}

export async function getFavoriteIds(uid) {
  if (!firebaseReady || !uid) return new Set();
  const snapshot = await getDocs(collection(db, "users", uid, "favorites"));
  return new Set(snapshot.docs.map((item) => item.id));
}

export function listenFavorites(uid, callback, onError) {
  if (!firebaseReady || !uid) return () => {};
  return onSnapshot(
    collection(db, "users", uid, "favorites"),
    (snapshot) => callback(snapshot.docs.map(movieFromSnapshot)),
    onError
  );
}

export async function addFavorite(uid, movie) {
  if (!firebaseReady || !uid || !movie?.id) return;
  await setDoc(doc(db, "users", uid, "favorites", movie.id), {
    title: movie.title,
    description: movie.description,
    imageURL: movie.imageURL,
    videoURL: movie.videoURL,
    category: movie.category,
    views: movie.views || 0,
    createdAt: serverTimestamp(),
    titleLower: movie.title.toLowerCase()
  });
}

export async function removeFavorite(uid, movieId) {
  if (!firebaseReady || !uid || !movieId) return;
  await deleteDoc(doc(db, "users", uid, "favorites", movieId));
}

export async function toggleFavorite(uid, movie) {
  if (!firebaseReady || !uid || !movie?.id) return false;
  const favoriteRef = doc(db, "users", uid, "favorites", movie.id);
  const snapshot = await getDoc(favoriteRef);
  if (snapshot.exists()) {
    await deleteDoc(favoriteRef);
    return false;
  }

  await addFavorite(uid, movie);
  return true;
}

function normalizeMovie(movie) {
  const title = String(movie.title || "").trim();
  const description = String(movie.description || "").trim();
  const imageURL = String(movie.imageURL || "").trim();
  const videoURL = String(movie.videoURL || "").trim();
  const category = String(movie.category || "film").trim().toLowerCase();

  if (!title || !description || !imageURL || !videoURL) {
    throw new Error("Tous les champs film sont obligatoires.");
  }

  return {
    title,
    description,
    imageURL,
    videoURL,
    category,
    titleLower: title.toLowerCase()
  };
}
