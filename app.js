const API_KEY = "793ab0cf"; 

// =============================================
// 🗄️ State
// =============================================
const cache = {};
let currentQuery   = "";
let currentPage    = 1;
let currentFilter  = "movie";
let totalResults   = 0;
let currentMovie   = null;
let suggestTimer   = null;
let favourites     = JSON.parse(localStorage.getItem("screenseek-favs") || "[]");

// Popular searches to show on homepage
const POPULAR_SEARCHES = [
  "Avengers", "Batman", "Spider-Man",
  "Inception", "Interstellar", "Joker"
];

// =============================================
// 🎬 POSTER WALL — fetch real posters for bg
// =============================================
const WALL_SEARCHES = [
  "action","drama","comedy","thriller","horror",
  "romance","sci-fi","adventure"
];

async function buildPosterWall() {
  const cols = [
    document.getElementById("col1"),
    document.getElementById("col2"),
    document.getElementById("col3"),
    document.getElementById("col4"),
    document.getElementById("col5"),
    document.getElementById("col6"),
    document.getElementById("col7"),
  ];

  let allPosters = [];

  // Fetch posters from multiple genres
  for (let i = 0; i < WALL_SEARCHES.length; i++) {
    try {
      const r = await fetch(`https://www.omdbapi.com/?s=${WALL_SEARCHES[i]}&type=movie&apikey=${API_KEY}`);
      const d = await r.json();
      if (d.Search) {
        d.Search.forEach(m => {
          if (m.Poster && m.Poster !== "N/A") allPosters.push(m.Poster);
        });
      }
    } catch(e) {}
  }

  // Shuffle posters
  allPosters = allPosters.sort(() => Math.random() - 0.5);

  // Fill each column — duplicate for seamless loop
  cols.forEach((col, i) => {
    const colPosters = [];
    for (let j = 0; j < 8; j++) {
      colPosters.push(allPosters[(i * 8 + j) % allPosters.length]);
    }
    // Duplicate for seamless infinite scroll
    const doubled = [...colPosters, ...colPosters];
    col.innerHTML = doubled.map(src => `
      <img class="poster-thumb" src="${src}" alt="" loading="lazy"/>
    `).join("");
  });
}

// =============================================
// 🌟 POPULAR MOVIES on Homepage
// =============================================
async function loadPopular() {
  const grid = document.getElementById("popularGrid");
  grid.innerHTML = `<div class="spinner-container"><div class="spinner"></div></div>`;

  let movies = [];
  for (let term of POPULAR_SEARCHES) {
    try {
      const r = await fetch(`https://www.omdbapi.com/?s=${term}&type=${currentFilter || "movie"}&apikey=${API_KEY}`);
      const d = await r.json();
      if (d.Search) {
        d.Search.slice(0, 2).forEach(m => {
          if (!movies.find(x => x.imdbID === m.imdbID)) movies.push(m);
        });
      }
    } catch(e) {}
  }

  if (movies.length === 0) {
    grid.innerHTML = `<p style="color:var(--text2); grid-column:1/-1">Could not load popular movies.</p>`;
    return;
  }

  grid.innerHTML = movies.map(m => buildCard(m)).join("");
  observeCards(grid);
}

// =============================================
// 🔍 SEARCH
// =============================================
async function searchMovie() {
  const query = document.getElementById("searchInput").value.trim();
  const resultsDiv  = document.getElementById("results");
  const errorDiv    = document.getElementById("error-msg");
  const resultsSection = document.getElementById("resultsSection");
  const popularSection = document.getElementById("popularSection");
  const heading     = document.getElementById("resultsHeading");

  hideSuggestions();
  errorDiv.textContent = "";

  if (!query) { errorDiv.textContent = "Please type a movie name."; return; }

  currentQuery = query;
  popularSection.classList.add("hidden");
  resultsSection.classList.remove("hidden");
  heading.textContent = `Results for "${query}"`;
  resultsDiv.innerHTML = `<div class="spinner-container"><div class="spinner"></div></div>`;

  const key = `${query}-${currentFilter}-${currentPage}`;
  if (cache[key]) {
    displayResults(cache[key].movies, cache[key].total);
    return;
  }

  try {
    let url = `https://www.omdbapi.com/?s=${encodeURIComponent(query)}&page=${currentPage}&apikey=${API_KEY}`;
    if (currentFilter) url += `&type=${currentFilter}`;

    const r = await fetch(url);
    if (!r.ok) throw new Error("Network error.");
    const d = await r.json();

    if (d.Response === "False") {
      resultsDiv.innerHTML = "";
      errorDiv.textContent = `No results for "${query}". Try something else!`;
      document.getElementById("pagination").classList.add("hidden");
      return;
    }

    totalResults = parseInt(d.totalResults);
    cache[key] = { movies: d.Search, total: totalResults };
    displayResults(d.Search, totalResults);

  } catch(e) {
    resultsDiv.innerHTML = "";
    errorDiv.textContent = `Error: ${e.message}`;
  }
}

// =============================================
// 🎴 DISPLAY RESULTS
// =============================================
function displayResults(movies, total) {
  const resultsDiv = document.getElementById("results");
  const pagination = document.getElementById("pagination");

  resultsDiv.innerHTML = movies.map(m => buildCard(m)).join("");
  observeCards(resultsDiv);

  const totalPages = Math.ceil(total / 10);
  if (totalPages > 1) {
    pagination.classList.remove("hidden");
    document.getElementById("pageInfo").textContent = `Page ${currentPage} of ${totalPages}`;
    document.getElementById("prevBtn").disabled = currentPage === 1;
    document.getElementById("nextBtn").disabled = currentPage === totalPages;
  } else {
    pagination.classList.add("hidden");
  }
}

// =============================================
// 🃏 BUILD CARD HTML
// =============================================
function buildCard(movie) {
  const poster = movie.Poster !== "N/A"
    ? movie.Poster
    : "https://via.placeholder.com/160x234?text=No+Image";
  return `
    <div class="card" onclick="openModal('${movie.imdbID}')">
      <img src="${poster}" alt="${movie.Title}" loading="lazy"/>
      <div class="card-info">
        <h3>${movie.Title}</h3>
        <p>${movie.Year}</p>
      </div>
    </div>`;
}

// =============================================
// 🔭 SCROLL ANIMATION
// =============================================
function observeCards(container) {
  const cards = container.querySelectorAll(".card");
  const observer = new IntersectionObserver((entries) => {
    entries.forEach((entry, i) => {
      if (entry.isIntersecting) {
        setTimeout(() => entry.target.classList.add("visible"), i * 60);
        observer.unobserve(entry.target);
      }
    });
  }, { threshold: 0.1 });
  cards.forEach(c => observer.observe(c));
}

// =============================================
// 💡 SUGGESTIONS DROPDOWN
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
    return `
      <div class="suggestion-item" onclick="selectSuggestion('${m.Title}', '${m.imdbID}')">
        <img src="${poster}" alt="${m.Title}" loading="lazy"/>
        <div class="suggestion-info">
          <div class="suggestion-title">${m.Title}</div>
          <div class="suggestion-year">${m.Year} · ${m.Type}</div>
        </div>
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

// Close suggestions when clicking outside
document.addEventListener("click", function(e) {
  if (!document.getElementById("searchBox").contains(e.target)) hideSuggestions();
});

// =============================================
// 📄 PAGINATION
// =============================================
function changePage(dir) {
  currentPage += dir;
  searchMovie();
  window.scrollTo({ top: 0, behavior: "smooth" });
}

// =============================================
// 🔵 FILTER
// =============================================
function setFilter(type, btn) {
  currentFilter = type;
  document.querySelectorAll(".filter-btn").forEach(b => b.classList.remove("active"));
  btn.classList.add("active");
  if (currentQuery) { currentPage = 1; searchMovie(); }
  else loadPopular();
}

// =============================================
// 🎬 OPEN MODAL
// =============================================
async function openModal(imdbID) {
  document.getElementById("modal-overlay").classList.remove("hidden");
  document.getElementById("modal-title").textContent   = "Loading...";
  document.getElementById("modal-plot").textContent    = "";
  document.getElementById("modal-poster").src          = "";
  document.getElementById("modal-director").textContent= "";
  document.getElementById("modal-cast").textContent    = "";
  document.getElementById("modal-genre").textContent   = "";
  document.getElementById("modal-imdb").innerHTML      = "";
  document.getElementById("modal-year").textContent    = "";
  document.getElementById("modal-rated").textContent   = "";
  document.getElementById("modal-runtime").textContent = "";
  document.getElementById("modal-trailer").innerHTML   = "";

  try {
    const r = await fetch(`https://www.omdbapi.com/?i=${imdbID}&apikey=${API_KEY}`);
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

    document.getElementById("modal-poster").src = movie.Poster !== "N/A"
      ? movie.Poster
      : "https://via.placeholder.com/200x300?text=No+Image";

    document.getElementById("modal-imdb").innerHTML = `
      <div class="stars-container">
        <div class="stars">${generateStars(movie.imdbRating)}</div>
        <span class="rating-text">${movie.imdbRating}/10</span>
        <span class="rating-votes">(${movie.imdbVotes} votes)</span>
      </div>`;

    const isFav = favourites.some(f => f.imdbID === movie.imdbID);
    const favBtn = document.getElementById("modal-fav-btn");
    favBtn.textContent = isFav ? "❤️ Remove from Favourites" : "❤️ Add to Favourites";
    favBtn.classList.toggle("active", isFav);

    loadTrailer(movie.Title, movie.Year);

  } catch(e) {
    document.getElementById("modal-title").textContent = "Failed to load.";
  }
}

// =============================================
// ❌ CLOSE MODAL
// =============================================
function closeModal() {
  document.getElementById("modal-overlay").classList.add("hidden");
}

document.getElementById("modal-overlay").addEventListener("click", function(e) {
  if (e.target === this) closeModal();
});

document.addEventListener("keydown", e => {
  if (e.key === "Escape") closeModal();
});

// =============================================
// ⭐ STARS
// =============================================
function generateStars(rating) {
  const num = parseFloat(rating);
  if (isNaN(num)) return `<span class="rating-text">N/A</span>`;
  let html = "";
  for (let i = 1; i <= 10; i++) {
    if (i <= Math.floor(num))                      html += `<span class="star full">★</span>`;
    else if (i === Math.ceil(num) && num%1 >= 0.5) html += `<span class="star half">★</span>`;
    else                                            html += `<span class="star empty">★</span>`;
  }
  return html;
}

// =============================================
// ❤️ FAVOURITES
// =============================================
function toggleFavourite() {
  if (!currentMovie) return;
  const idx = favourites.findIndex(f => f.imdbID === currentMovie.imdbID);
  if (idx === -1) {
    favourites.push({ imdbID: currentMovie.imdbID, Title: currentMovie.Title, Year: currentMovie.Year, Poster: currentMovie.Poster });
  } else {
    favourites.splice(idx, 1);
  }
  localStorage.setItem("screenseek-favs", JSON.stringify(favourites));
  const isFav = favourites.some(f => f.imdbID === currentMovie.imdbID);
  const btn = document.getElementById("modal-fav-btn");
  btn.textContent = isFav ? "❤️ Remove from Favourites" : "❤️ Add to Favourites";
  btn.classList.toggle("active", isFav);
  renderFavourites();
}

function toggleFavourites() {
  const sec = document.getElementById("favouritesSection");
  sec.classList.toggle("hidden");
  if (!sec.classList.contains("hidden")) renderFavourites();
}

function renderFavourites() {
  const grid = document.getElementById("favouritesGrid");
  if (!favourites.length) {
    grid.innerHTML = `<p style="color:var(--text2);grid-column:1/-1">No favourites yet!</p>`;
    return;
  }
  grid.innerHTML = favourites.map(m => buildCard(m)).join("");
  observeCards(grid);
}

// =============================================
// 🎥 TRAILER
// =============================================
async function loadTrailer(title, year) {
  const div = document.getElementById("modal-trailer");
  div.innerHTML = `<p style="color:var(--text2);font-size:0.85rem;margin-top:16px">Loading trailer...</p>`;
  const known = {
    "Inception":"YoHD9XEInc0","Interstellar":"zSWdZVtXT7E",
    "The Dark Knight":"EXeTwQWrcwY","Avengers: Endgame":"TcMBFSGVi1c",
    "Spider-Man: No Way Home":"JfVOs4VSpmA","The Shawshank Redemption":"6hB3S9bIaco",
    "Parasite":"5xH0HfJHsaY","Dune":"n9xhJrPXop4",
    "Oppenheimer":"uYPbbksJxIg","Barbie":"pBk4NYhaKZg",
  };
  const videoId = known[title] || null;
  const query = encodeURIComponent(`${title} ${year} official trailer`);
  if (videoId) {
    div.innerHTML = `
      <p class="modal-label">Trailer</p>
      <iframe src="https://www.youtube.com/embed/${videoId}" allowfullscreen
        allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture">
      </iframe>`;
  } else {
    div.innerHTML = `
      <p class="modal-label">Trailer</p>
      <a href="https://www.youtube.com/results?search_query=${query}"
         target="_blank"
         style="color:var(--accent2);font-size:0.95rem;text-decoration:none;letter-spacing:1px;">
        🎬 Watch Trailer on YouTube →
      </a>`;
  }
}

// =============================================
// 🌙 THEME
// =============================================
function toggleTheme() {
  document.body.classList.toggle("light");
  document.querySelector(".theme-toggle").textContent =
    document.body.classList.contains("light") ? "🌙" : "☀️";
}

// =============================================
// ⌨️ ENTER KEY
// =============================================
document.getElementById("searchInput").addEventListener("keydown", e => {
  if (e.key === "Enter") { hideSuggestions(); searchMovie(); }
  if (e.key === "Escape") hideSuggestions();
});

// =============================================
// 🚀 INIT — run on page load
// =============================================
buildPosterWall();
loadPopular();