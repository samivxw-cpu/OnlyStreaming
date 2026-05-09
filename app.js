import { auth, firebaseReady, showFirebaseSetupWarning } from "./firebase.js";
import { protectPage, wireLogout, getUserProfile, isAdminUser } from "./auth.js";
import {
  addFavorite,
  addMovie,
  filterMovies,
  getFavoriteIds,
  getMovie,
  getRecommendations,
  groupByCategory,
  incrementMovieViews,
  listenFavorites,
  listenMovies,
  toggleFavorite
} from "./movies.js";

const state = {
  user: null,
  movies: [],
  favoriteIds: new Set(),
  searchTerm: ""
};

function qs(selector, scope = document) {
  return scope.querySelector(selector);
}

function qsa(selector, scope = document) {
  return [...scope.querySelectorAll(selector)];
}

function escapeHtml(value = "") {
  return String(value)
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;")
    .replaceAll("'", "&#039;");
}

function setText(selector, value) {
  const el = qs(selector);
  if (el) el.textContent = value;
}

function setStatus(selector, message, type = "info") {
  const el = qs(selector);
  if (!el) return;
  el.textContent = message;
  el.dataset.type = type;
}

function fallbackImage(title) {
  const safeTitle = encodeURIComponent(title || "OnlyStreaming");
  return `data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' width='600' height='900' viewBox='0 0 600 900'%3E%3Cdefs%3E%3ClinearGradient id='g' x1='0' x2='1' y1='0' y2='1'%3E%3Cstop stop-color='%23171717'/%3E%3Cstop offset='1' stop-color='%2335090d'/%3E%3C/linearGradient%3E%3C/defs%3E%3Crect width='600' height='900' fill='url(%23g)'/%3E%3Ccircle cx='460' cy='130' r='160' fill='%23e50914' fill-opacity='.25'/%3E%3Ctext x='50%25' y='48%25' text-anchor='middle' fill='%23fff' font-family='Arial,sans-serif' font-size='54' font-weight='800'%3EOnlyStreaming%3C/text%3E%3Ctext x='50%25' y='56%25' text-anchor='middle' fill='%23b8b8b8' font-family='Arial,sans-serif' font-size='28'%3E${safeTitle}%3C/text%3E%3C/svg%3E`;
}

function movieCard(movie, { compact = false } = {}) {
  const isFavorite = state.favoriteIds.has(movie.id);
  return `
    <article class="movie-card ${compact ? "movie-card-compact" : ""}" data-movie-id="${movie.id}">
      <a class="movie-poster-link" href="video.html?id=${encodeURIComponent(movie.id)}" aria-label="Regarder ${escapeHtml(movie.title)}">
        <img src="${escapeHtml(movie.imageURL || fallbackImage(movie.title))}" alt="${escapeHtml(movie.title)}" loading="lazy">
        <span class="quality-badge">HD</span>
        <span class="play-float" aria-hidden="true">Play</span>
      </a>
      <div class="movie-card-body">
        <span class="category-pill">${escapeHtml(movie.category)}</span>
        <h3>${escapeHtml(movie.title)}</h3>
        <p>${escapeHtml(movie.description)}</p>
        <div class="card-actions">
          <a class="btn btn-small btn-primary" href="video.html?id=${encodeURIComponent(movie.id)}">Regarder</a>
          <button class="btn btn-small btn-ghost" data-favorite-toggle="${movie.id}" aria-pressed="${isFavorite}">
            ${isFavorite ? "Favori" : "+ Favori"}
          </button>
        </div>
      </div>
    </article>
  `;
}

function bindFavoriteButtons() {
  qsa("[data-favorite-toggle]").forEach((button) => {
    button.addEventListener("click", async () => {
      if (!state.user) return;
      const movieId = button.dataset.favoriteToggle;
      const movie = state.movies.find((item) => item.id === movieId) || (await getMovie(movieId));
      if (!movie) return;

      button.disabled = true;
      const isNowFavorite = await toggleFavorite(state.user.uid, movie);
      if (isNowFavorite) state.favoriteIds.add(movie.id);
      else state.favoriteIds.delete(movie.id);
      button.disabled = false;
      renderCurrentPage();
    });
  });
}

function renderHero(movies) {
  const hero = qs("#hero");
  if (!hero) return;

  const featured = [...movies].sort((a, b) => b.views - a.views)[0] || movies[0];
  if (!featured) {
    hero.innerHTML = `
      <div class="hero-empty">
        <p class="eyebrow">Catalogue vide</p>
        <h1>Ajoute ton premier film depuis l'administration.</h1>
        <a class="btn btn-primary" href="admin.html">Ouvrir l'admin</a>
      </div>
    `;
    return;
  }

  hero.style.setProperty("--hero-image", `url("${featured.imageURL || fallbackImage(featured.title)}")`);
  hero.innerHTML = `
    <div class="hero-copy">
      <p class="eyebrow">Selection OnlyStreaming</p>
      <h1>${escapeHtml(featured.title)}</h1>
      <p>${escapeHtml(featured.description)}</p>
      <div class="hero-actions">
        <a class="btn btn-primary" href="video.html?id=${encodeURIComponent(featured.id)}">Lecture</a>
        <button class="btn btn-secondary" data-favorite-toggle="${featured.id}">
          ${state.favoriteIds.has(featured.id) ? "Dans mes favoris" : "Ajouter aux favoris"}
        </button>
      </div>
    </div>
  `;
}

function renderMovieRows(movies) {
  const container = qs("#movieSections");
  if (!container) return;

  const filtered = filterMovies(movies, state.searchTerm);
  const groups = groupByCategory(filtered);
  const top = [...filtered].sort((a, b) => b.views - a.views).slice(0, 12);

  let html = "";
  if (state.searchTerm) {
    html += sectionTemplate(`Recherche: ${state.searchTerm}`, filtered);
  } else {
    html += sectionTemplate("Tendances", top.length ? top : filtered.slice(0, 12));
    Object.entries(groups).forEach(([category, items]) => {
      html += sectionTemplate(category, items);
    });
  }

  if (!filtered.length) {
    html = `
      <div class="empty-state">
        <p class="eyebrow">Aucun resultat</p>
        <h2>Essaie un autre titre ou ajoute plus de contenus.</h2>
      </div>
    `;
  }

  container.innerHTML = html;
  bindFavoriteButtons();
  bindRows();
}

function sectionTemplate(title, movies) {
  if (!movies.length) return "";
  return `
    <section class="content-section">
      <div class="section-title">
        <h2>${escapeHtml(title)}</h2>
        <span>${movies.length} titre${movies.length > 1 ? "s" : ""}</span>
      </div>
      <div class="row-shell">
        <button class="row-arrow row-arrow-left" data-row-dir="-1" aria-label="Defiler a gauche">&lsaquo;</button>
        <div class="movie-row">
          ${movies.map((movie) => movieCard(movie, { compact: true })).join("")}
        </div>
        <button class="row-arrow row-arrow-right" data-row-dir="1" aria-label="Defiler a droite">&rsaquo;</button>
      </div>
    </section>
  `;
}

function bindRows() {
  qsa(".row-shell").forEach((shell) => {
    const row = qs(".movie-row", shell);
    qsa("[data-row-dir]", shell).forEach((button) => {
      button.addEventListener("click", () => {
        row.scrollBy({
          left: Number(button.dataset.rowDir) * Math.max(row.clientWidth * 0.75, 260),
          behavior: "smooth"
        });
      });
    });
  });
}

function renderStats(movies) {
  setText("[data-total-movies]", String(movies.length));
  setText("[data-total-favorites]", String(state.favoriteIds.size));
  const categories = new Set(movies.map((movie) => movie.category));
  setText("[data-total-categories]", String(categories.size));
}

function renderCurrentPage() {
  const page = document.body.dataset.page;
  if (page === "catalog") {
    renderHero(state.movies);
    renderMovieRows(state.movies);
    renderStats(state.movies);
  }
}

function initCatalog() {
  protectPage({
    async onUser(user) {
      state.user = user;
      wireLogout();
      const profile = await getUserProfile(user.uid);
      setText("[data-user-name]", profile?.displayName || user.displayName || "Viewer");

      const admin = await isAdminUser(user.uid);
      qsa("[data-admin-only]").forEach((item) => {
        item.hidden = !admin;
      });

      state.favoriteIds = await getFavoriteIds(user.uid);
      listenMovies(
        (movies) => {
          state.movies = movies;
          renderCurrentPage();
        },
        (error) => setStatus("#catalogStatus", error.message, "error")
      );
    }
  });

  const searchInput = qs("#searchInput");
  if (searchInput) {
    searchInput.addEventListener("input", (event) => {
      state.searchTerm = event.target.value;
      renderMovieRows(state.movies);
    });
  }
}

function initFavorites() {
  protectPage({
    onUser(user) {
      state.user = user;
      wireLogout();
      listenFavorites(
        user.uid,
        (favorites) => {
          state.movies = favorites;
          state.favoriteIds = new Set(favorites.map((movie) => movie.id));
          const grid = qs("#favoritesGrid");
          if (!grid) return;
          grid.innerHTML = favorites.length
            ? favorites.map((movie) => movieCard(movie)).join("")
            : `
              <div class="empty-state full-span">
                <p class="eyebrow">Aucun favori</p>
                <h2>Ajoute des films depuis le catalogue.</h2>
                <a class="btn btn-primary" href="app.html">Explorer</a>
              </div>
            `;
          bindRemoveFavoriteButtons();
          bindFavoriteButtons();
        },
        (error) => setStatus("#favoritesStatus", error.message, "error")
      );
    }
  });
}

function bindRemoveFavoriteButtons() {
  qsa("#favoritesGrid [data-favorite-toggle]").forEach((button) => {
    button.textContent = "Retirer";
  });
}

async function initVideo() {
  protectPage({
    async onUser(user) {
      state.user = user;
      wireLogout();
      state.favoriteIds = await getFavoriteIds(user.uid);

      const movieId = new URLSearchParams(window.location.search).get("id");
      const movie = await getMovie(movieId);
      if (!movie) {
        qs("#videoDetail").innerHTML = `
          <div class="empty-state">
            <p class="eyebrow">Introuvable</p>
            <h1>Ce contenu n'existe pas ou a ete retire.</h1>
            <a class="btn btn-primary" href="app.html">Retour catalogue</a>
          </div>
        `;
        return;
      }

      state.movies = [movie];
      renderVideo(movie);
      await incrementMovieViews(movie.id);
      renderRecommendations(movie);
    }
  });
}

function renderVideo(movie) {
  const detail = qs("#videoDetail");
  if (!detail) return;

  detail.innerHTML = `
    <section class="player-shell">
      <video id="videoPlayer" controls playsinline preload="metadata" poster="${escapeHtml(movie.imageURL)}">
        <source src="${escapeHtml(movie.videoURL)}" type="video/mp4">
        Ton navigateur ne supporte pas la lecture video HTML5.
      </video>
    </section>
    <section class="video-meta">
      <div>
        <p class="eyebrow">${escapeHtml(movie.category)}</p>
        <h1>${escapeHtml(movie.title)}</h1>
        <p>${escapeHtml(movie.description)}</p>
      </div>
      <div class="video-actions">
        <a class="btn btn-secondary" href="app.html">Retour catalogue</a>
        <button class="btn btn-primary" data-favorite-toggle="${movie.id}">
          ${state.favoriteIds.has(movie.id) ? "Dans mes favoris" : "Ajouter aux favoris"}
        </button>
      </div>
    </section>
  `;

  qs("#videoPlayer")?.play().catch(() => {});
  bindFavoriteButtons();
}

async function renderRecommendations(movie) {
  const container = qs("#recommendations");
  if (!container) return;
  const recommendations = await getRecommendations(movie.category, movie.id, 8);
  container.innerHTML = recommendations.length
    ? sectionTemplate("Recommandes aussi", recommendations)
    : "";
  bindFavoriteButtons();
  bindRows();
}

function initAdmin() {
  protectPage({
    async onUser(user) {
      state.user = user;
      wireLogout();

      const admin = await isAdminUser(user.uid);
      qs("#adminGate").hidden = admin;
      qs("#adminPanel").hidden = !admin;
      if (!admin) return;

      listenMovies((movies) => renderAdminList(movies));
      wireAdminForm(user);
    }
  });
}

function wireAdminForm(user) {
  const form = qs("#movieForm");
  if (!form) return;

  form.addEventListener("submit", async (event) => {
    event.preventDefault();
    const formData = new FormData(form);
    const button = form.querySelector("button[type='submit']");
    button.disabled = true;
    setStatus("#adminStatus", "Sauvegarde en cours...");

    try {
      await addMovie(
        {
          title: formData.get("title"),
          description: formData.get("description"),
          imageURL: formData.get("imageURL"),
          videoURL: formData.get("videoURL"),
          category: formData.get("category")
        },
        user
      );
      form.reset();
      setStatus("#adminStatus", "Contenu ajoute avec succes.", "success");
    } catch (error) {
      setStatus("#adminStatus", error.message, "error");
    } finally {
      button.disabled = false;
    }
  });
}

function renderAdminList(movies) {
  const list = qs("#adminMovieList");
  if (!list) return;
  list.innerHTML = movies
    .map(
      (movie) => `
        <li>
          <img src="${escapeHtml(movie.imageURL || fallbackImage(movie.title))}" alt="">
          <div>
            <strong>${escapeHtml(movie.title)}</strong>
            <span>${escapeHtml(movie.category)} &middot; ${movie.views} vues</span>
          </div>
        </li>
      `
    )
    .join("");
}

function initIndex() {
  showFirebaseSetupWarning();
  if (!firebaseReady) return;
  auth?.currentUser ? window.location.replace("app.html") : null;
}

const page = document.body.dataset.page;
if (page === "catalog") initCatalog();
if (page === "favorites") initFavorites();
if (page === "video") initVideo();
if (page === "admin") initAdmin();
if (page === "landing") initIndex();
