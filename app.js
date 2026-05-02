// Import the functions you need from the SDKs you need
import { initializeApp } from "firebase/app";
// TODO: Add SDKs for Firebase products that you want to use
// https://firebase.google.com/docs/web/setup#available-libraries

// Your web app's Firebase configuration
const firebaseConfig = {
  apiKey: "AIzaSyBzCB1i-Hi2bPZMIUYgpLP9n5Av13So3Tk",
  authDomain: "screenseek-1d47d.firebaseapp.com",
  projectId: "screenseek-1d47d",
  storageBucket: "screenseek-1d47d.firebasestorage.app",
  messagingSenderId: "241573468806",
  appId: "1:241573468806:web:249a0fcfba5d5eeb6b0f07"
};

// Initialize Firebase
const app = initializeApp(firebaseConfig);
import { initializeApp } from "https://www.gstatic.com/firebasejs/10.7.1/firebase-app.js";
import { getAuth, GoogleAuthProvider, signInWithPopup, createUserWithEmailAndPassword, signInWithEmailAndPassword, signOut, onAuthStateChanged } from "https://www.gstatic.com/firebasejs/10.7.1/firebase-auth.js";
import { getFirestore, doc, setDoc, getDoc, updateDoc, arrayUnion, arrayRemove } from "https://www.gstatic.com/firebasejs/10.7.1/firebase-firestore.js";

const firebaseConfig = {
  apiKey: "YOUR_API_KEY",
  authDomain: "YOUR_AUTH_DOMAIN",
  projectId: "YOUR_PROJECT_ID",
  storageBucket: "YOUR_STORAGE_BUCKET",
  messagingSenderId: "YOUR_SENDER_ID",
  appId: "YOUR_APP_ID"
};

const app  = initializeApp(firebaseConfig);
const auth = getAuth(app);
const db   = getFirestore(app);

// =============================================
// 🎬 OMDB API KEY
// =============================================
const API_KEY = "your_omdb_key_here"; // ← Replace!

// =============================================
// 🗄️ STATE
// =============================================
let currentQuery  = "";
let currentPage   = 1;
let currentFilter = "movie";
let totalResults  = 0;
let currentMovie  = null;
let suggestTimer  = null;
let currentUser   = null;
let userFavs      = [];
let userWatchLater= [];
const cache       = {};

// =============================================
// 🔑 AUTH STATE LISTENER
// =============================================
onAuthStateChanged(auth, async (user) => {
  currentUser = user;
  if (user) {
    document.getElementById("authLoggedOut").classList.add("hidden");
    document.getElementById("authLoggedIn").classList.remove("hidden");
    document.getElementById("userGreeting").textContent = `👋 ${user.displayName || user.email.split("@")[0]}`;
    await loadUserData();
    closeAuthModal();
  } else {
    document.getElementById("authLoggedOut").classList.remove("hidden");
    document.getElementById("authLoggedIn").classList.add("hidden");
    userFavs = [];
    userWatchLater = [];
  }
});

// =============================================
// 👤 LOAD USER DATA FROM FIRESTORE
// =============================================
async function loadUserData() {
  if (!currentUser) return;
  try {
    const ref  = doc(db, "users", currentUser.uid);
    const snap = await getDoc(ref);
    if (snap.exists()) {
      userFavs       = snap.data().favourites  || [];
      userWatchLater = snap.data().watchLater  || [];
    } else {
      await setDoc(ref, { favourites: [], watchLater: [] });
    }
  } catch(e) { console.error(e); }
}

// =============================================
// 🔐 AUTH MODAL
// =============================================
let authMode = "login";

function openAuthModal(mode = "login") {
  authMode = mode;
  document.getElementById("auth-overlay").classList.remove("hidden");
  updateAuthUI();
}

function closeAuthModal() {
  document.getElementById("auth-overlay").classList.add("hidden");
  document.getElementById("authError").textContent = "";
}

function updateAuthUI() {
  const isSignup = authMode === "signup";
  document.getElementById("authTitle").textContent       = isSignup ? "Sign Up" : "Login";
  document.getElementById("authSubmitBtn").textContent   = isSignup ? "Create Account" : "Login";
  document.getElementById("authSwitchText").textContent  = isSignup ? "Login" : "Sign Up";
  document.getElementById("authName").classList.toggle("hidden", !isSignup);
  const switchEl = document.querySelector(".auth-switch");
  switchEl.childNodes[0].textContent = isSignup ? "Already have an account? " : "Don't have an account? ";
}

function toggleAuthMode() {
  authMode = authMode === "login" ? "signup" : "login";
  updateAuthUI();
}

async function submitAuth() {
  const email    = document.getElementById("authEmail").value.trim();
  const password = document.getElementById("authPassword").value;
  const errEl    = document.getElementById("authError");
  errEl.textContent = "";

  if (!email || !password) { errEl.textContent = "Please fill all fields."; return; }

  try {
    if (authMode === "signup") {
      await createUserWithEmailAndPassword(auth, email, password);
    } else {
      await signInWithEmailAndPassword(auth, email, password);
    }
  } catch(e) {
    errEl.textContent = e.message.replace("Firebase: ","").replace(/\(.*\)/,"");
  }
}

async function loginWithGoogle() {
  try {
    const provider = new GoogleAuthProvider();
    await signInWithPopup(auth, provider);
  } catch(e) {
    document.getElementById("authError").textContent = "Google login failed. Try again.";
  }
}

async function logoutUser() {
  await signOut(auth);
}

window.openAuthModal   = openAuthModal;
window.closeAuthModal  = closeAuthModal;
window.toggleAuthMode  = toggleAuthMode;
window.submitAuth      = submitAuth;
window.loginWithGoogle = loginWithGoogle;
window.logoutUser      = logoutUser;

// =============================================
// 🧭 PAGE NAVIGATION
// =============================================
function showPage(page) {
  document.querySelectorAll(".page").forEach(p => p.classList.add("hidden"));
  document.querySelectorAll(".nav-btn").forEach(b => b.classList.remove("active"));
  document.getElementById(`page-${page}`).classList.remove("hidden");
  document.getElementById(`nav-${page}`)?.classList.add("active");

  if (page === "trending")   loadTrending("movie", document.querySelector("#page-trending .filter-btn"));
  if (page === "watchlater") renderWatchLater();
  if (page === "favourites") renderFavourites();
}
window.showPage = showPage;

// =============================================
// 🎬 POSTER WALL
// =============================================
const WALL_TERMS = ["action","drama","comedy","thriller","horror","romance","adventure","crime"];

async function buildPosterWall() {
  const cols = Array.from({length:7}, (_,i) => document.getElementById(`col${i+1}`));
  let posters = [];
  for (const term of WALL_TERMS) {
    try {
      const r = await fetch(`https://www.omdbapi.com/?s=${term}&type=movie&apikey=${API_KEY}`);
      const d = await r.json();
      if (d.Search) d.Search.forEach(m => { if (m.Poster && m.Poster !== "N/A") posters.push(m.Poster); });
    } catch(e) {}
  }
  posters = posters.sort(() => Math.random() - 0.5);
  cols.forEach((col, i) => {
    const items = Array.from({length:8}, (_,j) => posters[(i*8+j) % posters.length]);
    col.innerHTML = [...items,...items].map(src => `<img class="poster-thumb" src="${src}" loading="lazy"/>`).join("");
  });
}

// =============================================
// 🌟 POPULAR (Home Page)
// =============================================
const POP_MOVIES  = ["Avengers","Batman","Spider-Man","Inception","Interstellar","Joker"];
const POP_SERIES  = ["Breaking Bad","Game of Thrones","Stranger Things","The Crown","Squid Game","Sherlock"];

async function loadPopular() {
  await loadPopularGrid("popularGrid",      POP_MOVIES,  "movie");
  await loadPopularGrid("popularSeriesGrid",POP_SERIES,  "series");
}

async function loadPopularGrid(gridId, terms, type) {
  const grid = document.getElementById(gridId);
  grid.innerHTML = `<div class="spinner-container"><div class="spinner"></div></div>`;
  let movies = [];
  for (const term of terms) {
    try {
      const r = await fetch(`https://www.omdbapi.com/?s=${encodeURIComponent(term)}&type=${type}&apikey=${API_KEY}`);
      const d = await r.json();
      if (d.Search) d.Search.slice(0,2).forEach(m => { if (!movies.find(x => x.imdbID === m.imdbID)) movies.push(m); });
    } catch(e) {}
  }
  grid.innerHTML = movies.length ? movies.map(buildCard).join("") : `<div class="empty-state"><p>Could not load.</p></div>`;
  observeCards(grid);
}

// =============================================
// 🔥 TRENDING PAGE
// =============================================
const TREND_MOVIES  = ["top gun","black panther","dune","oppenheimer","avatar","barbie","guardians","thor"];
const TREND_SERIES  = ["wednesday","the last of us","house of dragon","euphoria","loki","andor","rings of power","yellowstone"];

async function loadTrending(type, btn) {
  document.querySelectorAll("#page-trending .filter-btn").forEach(b => b.classList.remove("active"));
  if (btn) btn.classList.add("active");
  const grid = document.getElementById("trendingGrid");
  grid.innerHTML = `<div class="spinner-container"><div class="spinner"></div></div>`;
  const terms = type === "movie" ? TREND_MOVIES : TREND_SERIES;
  let movies = [];
  for (const term of terms) {
    try {
      const r = await fetch(`https://www.omdbapi.com/?s=${encodeURIComponent(term)}&type=${type}&apikey=${API_KEY}`);
      const d = await r.json();
      if (d.Search) d.Search.slice(0,2).forEach(m => { if (!movies.find(x => x.imdbID === m.imdbID)) movies.push(m); });
    } catch(e) {}
  }
  grid.innerHTML = movies.length ? movies.map(buildCard).join("") : `<div class="empty-state"><div class="empty-icon">🎬</div><p>Nothing found.</p></div>`;
  observeCards(grid);
}
window.loadTrending = loadTrending;

// =============================================
// 🔍 SEARCH (fixed — filter doesn't override)
// =============================================
async function searchMovie() {
  const query   = document.getElementById("searchInput").value.trim();
  const resDiv  = document.getElementById("results");
  const errDiv  = document.getElementById("error-msg");
  const heading = document.getElementById("resultsHeading");

  hideSuggestions();
  errDiv.textContent = "";

  if (!query) { errDiv.textContent = "Please type a movie name."; return; }

  // Save query separately from filter
  currentQuery = query;
  currentPage  = 1;

  heading.textContent = `Results for "${query}"`;
  resDiv.innerHTML    = `<div class="spinner-container"><div class="spinner"></div></div>`;

  await doSearch(query, currentPage);
}
window.searchMovie = searchMovie;

async function doSearch(query, page) {
  const resDiv  = document.getElementById("results");
  const errDiv  = document.getElementById("error-msg");
  const key     = `${query}||${currentFilter}||${page}`;

  if (cache[key]) { displayResults(cache[key].movies, cache[key].total); return; }

  try {
    // Build URL — filter is SEPARATE from query, applied only as a param
    let url = `https://www.omdbapi.com/?s=${encodeURIComponent(query)}&page=${page}&apikey=${API_KEY}`;
    if (currentFilter) url += `&type=${currentFilter}`;

    const r = await fetch(url);
    const d = await r.json();

    if (d.Response === "False") {
      // Auto-retry with shorter query if no results
      const shorter = query.split(" ")[0];
      if (shorter !== query) {
        const r2 = await fetch(`https://www.omdbapi.com/?s=${encodeURIComponent(shorter)}&page=${page}&apikey=${API_KEY}${currentFilter ? `&type=${currentFilter}` : ""}`);
        const d2 = await r2.json();
        if (d2.Response !== "False" && d2.Search) {
          document.getElementById("resultsHeading").textContent = `Showing results for "${shorter}"`;
          totalResults = parseInt(d2.totalResults);
          cache[key] = { movies: d2.Search, total: totalResults };
          displayResults(d2.Search, totalResults);
          return;
        }
      }
      resDiv.innerHTML = `<div class="empty-state"><div class="empty-icon">🔍</div><p>No results for "${query}".<br/>Try a different title or remove the filter.</p></div>`;
      document.getElementById("pagination").classList.add("hidden");
      return;
    }

    totalResults = parseInt(d.totalResults);
    cache[key] = { movies: d.Search, total: totalResults };
    displayResults(d.Search, totalResults);

  } catch(e) {
    resDiv.innerHTML = `<div class="empty-state"><p>Error: ${e.message}</p></div>`;
  }
}

function displayResults(movies, total) {
  const resDiv  = document.getElementById("results");
  const pagDiv  = document.getElementById("pagination");
  resDiv.innerHTML = movies.map(buildCard).join("");
  observeCards(resDiv);
  const totalPages = Math.ceil(total / 10);
  if (totalPages > 1) {
    pagDiv.classList.remove("hidden");
    document.getElementById("pageInfo").textContent = `Page ${currentPage} of ${totalPages}`;
    document.getElementById("prevBtn").disabled = currentPage === 1;
    document.getElementById("nextBtn").disabled = currentPage === totalPages;
  } else {
    pagDiv.classList.add("hidden");
  }
}

// Filter sets the type but does NOT trigger a new search by itself
function setFilter(type, btn) {
  currentFilter = type;
  document.querySelectorAll("#page-search .filter-btn").forEach(b => b.classList.remove("active"));
  btn.classList.add("active");
  // Only re-search if there's already an active query
  if (currentQuery) { currentPage = 1; doSearch(currentQuery, 1); }
}
window.setFilter = setFilter;

// Home hero search → go to search page
function heroSearch() {
  const q = document.getElementById("heroSearchInput").value.trim();
  if (!q) return;
  document.getElementById("searchInput").value = q;
  showPage("search");
  searchMovie();
}
window.heroSearch = heroSearch;

// =============================================
// 📄 PAGINATION
// =============================================
function changePage(dir) {
  currentPage += dir;
  doSearch(currentQuery, currentPage);
  window.scrollTo({ top: 0, behavior: "smooth" });
}
window.changePage = changePage;

// =============================================
// 💡 SUGGESTIONS
// =============================================
document.getElementById("searchInput").addEventListener("input", function() {
  clearTimeout(suggestTimer);
  const q = this.value.trim();
  if (q.length < 2) { hideSuggestions(); return; }
  suggestTimer = setTimeout(() => fetchSuggestions(q), 350);
});

async function fetchSuggestions(query) {
  try {
    let url = `https://www.omdbapi.com/?s=${encodeURIComponent(query)}&apikey=${API_KEY}`;
    if (currentFilter) url += `&type=${currentFilter}`;
    const r = await fetch(url);
    const d = await r.json();
    if (d.Response === "False" || !d.Search) { hideSuggestions(); return; }
    showSuggestions(d.Search.slice(0, 6));
  } catch(e) { hideSuggestions(); }
}

function showSuggestions(movies) {
  const box = document.getElementById("suggestions");
  box.innerHTML = movies.map(m => {
    const poster = m.Poster !== "N/A" ? m.Poster : "https://via.placeholder.com/36x52?text=?";
    return `<div class="suggestion-item" onclick="selectSuggestion('${m.Title.replace(/'/g,"\\'")}','${m.imdbID}')">
      <img src="${poster}" loading="lazy"/>
      <div><div class="suggestion-title">${m.Title}</div><div class="suggestion-year">${m.Year} · ${m.Type}</div></div>
    </div>`;
  }).join("");
  box.classList.add("show");
}

function hideSuggestions() {
  const box = document.getElementById("suggestions");
  box.classList.remove("show");
  box.innerHTML = "";
}

function selectSuggestion(title, imdbID) {
  document.getElementById("searchInput").value = title;
  hideSuggestions();
  openModal(imdbID);
}
window.selectSuggestion = selectSuggestion;

document.addEventListener("click", e => {
  if (!document.getElementById("searchBox")?.contains(e.target)) hideSuggestions();
});

document.getElementById("searchInput").addEventListener("keydown", e => {
  if (e.key === "Enter")  { hideSuggestions(); searchMovie(); }
  if (e.key === "Escape") hideSuggestions();
});

// =============================================
// 🃏 BUILD CARD
// =============================================
function buildCard(movie) {
  const poster = movie.Poster !== "N/A" ? movie.Poster : "https://via.placeholder.com/155x230?text=No+Image";
  return `<div class="card" onclick="openModal('${movie.imdbID}')">
    <img src="${poster}" alt="${movie.Title}" loading="lazy"/>
    <div class="card-info">
      <h3>${movie.Title}</h3>
      <p>${movie.Year}</p>
    </div>
  </div>`;
}

// =============================================
// 👁️ SCROLL ANIMATION
// =============================================
function observeCards(container) {
  const obs = new IntersectionObserver((entries) => {
    entries.forEach((en, i) => {
      if (en.isIntersecting) {
        setTimeout(() => en.target.classList.add("visible"), i * 60);
        obs.unobserve(en.target);
      }
    });
  }, { threshold: 0.1 });
  container.querySelectorAll(".card").forEach(c => obs.observe(c));
}

// =============================================
// 🎬 OPEN MODAL
// =============================================
async function openModal(imdbID) {
  document.getElementById("modal-overlay").classList.remove("hidden");
  const fields = ["modal-title","modal-plot","modal-director","modal-cast","modal-genre","modal-year","modal-rated","modal-runtime","modal-type"];
  fields.forEach(id => document.getElementById(id).textContent = id === "modal-title" ? "Loading..." : "");
  document.getElementById("modal-imdb").innerHTML    = "";
  document.getElementById("modal-trailer").innerHTML = "";
  document.getElementById("modal-poster").src        = "";
  document.getElementById("modal-justwatch").classList.add("hidden");

  try {
    const r     = await fetch(`https://www.omdbapi.com/?i=${imdbID}&apikey=${API_KEY}`);
    const movie = await r.json();
    currentMovie = movie;

    document.getElementById("modal-title").textContent    = movie.Title;
    document.getElementById("modal-plot").textContent     = movie.Plot;
    document.getElementById("modal-director").textContent = movie.Director;
    document.getElementById("modal-cast").textContent     = movie.Actors;
    document.getElementById("modal-genre").textContent    = movie.Genre;
    document.getElementById("modal-year").textContent     = movie.Year;
    document.getElementById("modal-rated").textContent    = movie.Rated;
    document.getElementById("modal-runtime").textContent  = movie.Runtime;
    document.getElementById("modal-type").textContent     = movie.Type;
    document.getElementById("modal-poster").src           = movie.Poster !== "N/A" ? movie.Poster : "https://via.placeholder.com/200x300?text=No+Image";

    document.getElementById("modal-imdb").innerHTML = `
      <div class="stars-container">
        <div class="stars">${generateStars(movie.imdbRating)}</div>
        <span class="rating-text">${movie.imdbRating}/10</span>
        <span class="rating-votes">(${movie.imdbVotes} votes)</span>
      </div>`;

    // JustWatch link
    const jwQuery = encodeURIComponent(movie.Title);
    const jwLink  = document.getElementById("modal-justwatch");
    jwLink.href   = `https://www.justwatch.com/in/search?q=${jwQuery}`;
    jwLink.classList.remove("hidden");

    // Favourites button
    const isFav = currentUser ? userFavs.includes(movie.imdbID) : false;
    const favBtn = document.getElementById("modal-fav-btn");
    favBtn.textContent = isFav ? "❤️ Remove Favourite" : "❤️ Favourite";
    favBtn.classList.toggle("active", isFav);

    // Watch Later button
    const isWL = currentUser ? userWatchLater.includes(movie.imdbID) : false;
    const wlBtn = document.getElementById("modal-watch-btn");
    wlBtn.textContent = isWL ? "✅ In Watch Later" : "🕐 Watch Later";
    wlBtn.classList.toggle("active", isWL);

    loadTrailer(movie.Title, movie.Year);

  } catch(e) {
    document.getElementById("modal-title").textContent = "Failed to load.";
  }
}
window.openModal = openModal;

function closeModal() { document.getElementById("modal-overlay").classList.add("hidden"); }
window.closeModal = closeModal;

document.getElementById("modal-overlay").addEventListener("click", function(e) { if (e.target === this) closeModal(); });
document.addEventListener("keydown", e => { if (e.key === "Escape") closeModal(); });

// =============================================
// ❤️ FAVOURITES
// =============================================
async function toggleFavourite() {
  if (!currentUser) { openAuthModal("login"); return; }
  if (!currentMovie) return;

  const id  = currentMovie.imdbID;
  const ref = doc(db, "users", currentUser.uid);
  const isFav = userFavs.includes(id);

  if (isFav) {
    await updateDoc(ref, { favourites: arrayRemove(id) });
    userFavs = userFavs.filter(x => x !== id);
  } else {
    await updateDoc(ref, { favourites: arrayUnion(id) });
    userFavs.push(id);
  }

  const favBtn = document.getElementById("modal-fav-btn");
  const nowFav = userFavs.includes(id);
  favBtn.textContent = nowFav ? "❤️ Remove Favourite" : "❤️ Favourite";
  favBtn.classList.toggle("active", nowFav);
}
window.toggleFavourite = toggleFavourite;

async function renderFavourites() {
  const grid = document.getElementById("favouritesGrid");
  if (!currentUser) {
    grid.innerHTML = `<div class="empty-state"><div class="empty-icon">🔒</div><p>Please login to see your favourites.</p></div>`;
    return;
  }
  if (!userFavs.length) {
    grid.innerHTML = `<div class="empty-state"><div class="empty-icon">❤️</div><p>No favourites yet. Click ❤️ on any movie!</p></div>`;
    return;
  }
  grid.innerHTML = `<div class="spinner-container"><div class="spinner"></div></div>`;
  const movies = await fetchByIds(userFavs);
  grid.innerHTML = movies.map(buildCard).join("");
  observeCards(grid);
}

// =============================================
// 🕐 WATCH LATER
// =============================================
async function toggleWatchLater() {
  if (!currentUser) { openAuthModal("login"); return; }
  if (!currentMovie) return;

  const id  = currentMovie.imdbID;
  const ref = doc(db, "users", currentUser.uid);
  const isWL = userWatchLater.includes(id);

  if (isWL) {
    await updateDoc(ref, { watchLater: arrayRemove(id) });
    userWatchLater = userWatchLater.filter(x => x !== id);
  } else {
    await updateDoc(ref, { watchLater: arrayUnion(id) });
    userWatchLater.push(id);
  }

  const wlBtn = document.getElementById("modal-watch-btn");
  const nowWL = userWatchLater.includes(id);
  wlBtn.textContent = nowWL ? "✅ In Watch Later" : "🕐 Watch Later";
  wlBtn.classList.toggle("active", nowWL);
}
window.toggleWatchLater = toggleWatchLater;

async function renderWatchLater() {
  const grid = document.getElementById("watchlaterGrid");
  const sub  = document.getElementById("watchlaterSub");
  if (!currentUser) {
    grid.innerHTML = `<div class="empty-state"><div class="empty-icon">🔒</div><p>Please login to see your watch list.</p></div>`;
    return;
  }
  if (!userWatchLater.length) {
    grid.innerHTML = `<div class="empty-state"><div class="empty-icon">🕐</div><p>Nothing added yet. Click 🕐 on any movie!</p></div>`;
    return;
  }
  sub.textContent = `${userWatchLater.length} title${userWatchLater.length > 1 ? "s" : ""} saved`;
  grid.innerHTML = `<div class="spinner-container"><div class="spinner"></div></div>`;
  const movies = await fetchByIds(userWatchLater);
  grid.innerHTML = movies.map(buildCard).join("");
  observeCards(grid);
}

// =============================================
// 🔗 FETCH MOVIES BY IMDB IDs
// =============================================
async function fetchByIds(ids) {
  const movies = [];
  for (const id of ids) {
    try {
      const r = await fetch(`https://www.omdbapi.com/?i=${id}&apikey=${API_KEY}`);
      const d = await r.json();
      if (d.Response !== "False") movies.push(d);
    } catch(e) {}
  }
  return movies;
}

// =============================================
// ⭐ STARS
// =============================================
function generateStars(rating) {
  const num = parseFloat(rating);
  if (isNaN(num)) return `<span class="rating-text">N/A</span>`;
  let html = "";
  for (let i = 1; i <= 10; i++) {
    if (i <= Math.floor(num))                        html += `<span class="star full">★</span>`;
    else if (i === Math.ceil(num) && num%1 >= 0.5)   html += `<span class="star half">★</span>`;
    else                                              html += `<span class="star empty">★</span>`;
  }
  return html;
}

// =============================================
// 🎥 TRAILER
// =============================================
function loadTrailer(title, year) {
  const div = document.getElementById("modal-trailer");
  const known = {
    "Inception":"YoHD9XEInc0","Interstellar":"zSWdZVtXT7E",
    "The Dark Knight":"EXeTwQWrcwY","Avengers: Endgame":"TcMBFSGVi1c",
    "Spider-Man: No Way Home":"JfVOs4VSpmA","Parasite":"5xH0HfJHsaY",
    "Dune":"n9xhJrPXop4","Oppenheimer":"uYPbbksJxIg","Barbie":"pBk4NYhaKZg",
  };
  const id    = known[title];
  const query = encodeURIComponent(`${title} ${year} official trailer`);
  div.innerHTML = id
    ? `<p class="modal-label">Trailer</p>
       <iframe src="https://www.youtube.com/embed/${id}" allowfullscreen
         allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture">
       </iframe>`
    : `<p class="modal-label">Trailer</p>
       <a href="https://www.youtube.com/results?search_query=${query}" target="_blank"
          style="color:var(--accent2);font-size:0.95rem;text-decoration:none;letter-spacing:1px;">
         🎬 Watch Trailer on YouTube →
       </a>`;
}

// =============================================
// 🚀 INIT
// =============================================
buildPosterWall();
loadPopular();