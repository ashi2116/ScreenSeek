
const API_KEY = "793ab0cf"; 

// =============================================
// 🗄️ State
// =============================================
const cache = {};
let currentQuery = "";
let currentPage = 1;
let currentFilter = "movie";
let totalResults = 0;
let currentMovie = null;
let favourites = JSON.parse(localStorage.getItem("screenseek-favs") || "[]");

// =============================================
// 🎨 Theme Toggle
// =============================================
function toggleTheme() {
  document.body.classList.toggle("dark");
  const btn = document.querySelector(".theme-toggle");
  btn.textContent = document.body.classList.contains("dark") ? "☀️" : "🌙";
}

// =============================================
// 🔵 Filter
// =============================================
function setFilter(type, btn) {
  currentFilter = type;
  document.querySelectorAll(".filter-btn").forEach(b => b.classList.remove("active"));
  btn.classList.add("active");
  if (currentQuery) {
    currentPage = 1;
    searchMovie();
  }
}

// =============================================
// 🔍 Search
// =============================================
async function searchMovie() {
  const query = document.getElementById("searchInput").value.trim();
  const resultsDiv = document.getElementById("results");
  const errorDiv = document.getElementById("error-msg");
  const resultsSection = document.getElementById("results-section");
  const resultsHeading = document.getElementById("results-heading");

  errorDiv.textContent = "";
  resultsDiv.innerHTML = "";

  if (!query) {
    errorDiv.textContent = "Please type a movie name first.";
    return;
  }

  currentQuery = query;

  const cacheKey = `${query}-${currentFilter}-${currentPage}`;

  resultsSection.classList.remove("hidden");
  resultsHeading.textContent = `Results for "${query}"`;
  resultsDiv.innerHTML = `
    <div class="spinner-container">
      <div class="spinner"></div>
    </div>`;

  if (cache[cacheKey]) {
    displayResults(cache[cacheKey].movies, cache[cacheKey].total);
    return;
  }

  try {
    let url = `https://www.omdbapi.com/?s=${encodeURIComponent(query)}&page=${currentPage}&apikey=${API_KEY}`;
    if (currentFilter) url += `&type=${currentFilter}`;

    const response = await fetch(url);
    if (!response.ok) throw new Error("Network error.");
    const data = await response.json();

    if (data.Response === "False") {
      resultsDiv.innerHTML = "";
      errorDiv.textContent = `No results found for "${query}". Try something else!`;
      document.getElementById("pagination").classList.add("hidden");
      return;
    }

    totalResults = parseInt(data.totalResults);
    cache[cacheKey] = { movies: data.Search, total: totalResults };
    displayResults(data.Search, totalResults);

  } catch (error) {
    resultsDiv.innerHTML = "";
    errorDiv.textContent = `Error: ${error.message}`;
  }
}

// =============================================
// 🎴 Display Results + Scroll Animation
// =============================================
function displayResults(movies, total) {
  const resultsDiv = document.getElementById("results");
  const pagination = document.getElementById("pagination");

  resultsDiv.innerHTML = movies.map(movie => {
    const poster = movie.Poster !== "N/A"
      ? movie.Poster
      : "https://via.placeholder.com/160x230?text=No+Image";
    return `
      <div class="card" onclick="openModal('${movie.imdbID}')">
        <img src="${poster}" alt="${movie.Title}" loading="lazy"/>
        <div class="card-info">
          <h3>${movie.Title}</h3>
          <p>${movie.Year}</p>
        </div>
      </div>`;
  }).join("");

  // Scroll animation — observe each card
  observeCards();

  // Pagination
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
// 📜 Scroll Animation with IntersectionObserver
// =============================================
function observeCards() {
  const cards = document.querySelectorAll(".card");
  const observer = new IntersectionObserver((entries) => {
    entries.forEach((entry, index) => {
      if (entry.isIntersecting) {
        // Staggered delay so cards appear one by one
        setTimeout(() => {
          entry.target.classList.add("visible");
        }, index * 60);
        observer.unobserve(entry.target);
      }
    });
  }, { threshold: 0.1 });

  cards.forEach(card => observer.observe(card));
}

// =============================================
// 📄 Pagination
// =============================================
function changePage(direction) {
  currentPage += direction;
  searchMovie();
  window.scrollTo({ top: 0, behavior: "smooth" });
}

// =============================================
// 🎬 Open Modal
// =============================================
async function openModal(imdbID) {
  document.getElementById("modal-overlay").classList.remove("hidden");
  document.getElementById("modal-title").textContent = "Loading...";
  document.getElementById("modal-plot").textContent = "";
  document.getElementById("modal-poster").src = "";
  document.getElementById("modal-director").textContent = "";
  document.getElementById("modal-cast").textContent = "";
  document.getElementById("modal-genre").textContent = "";
  document.getElementById("modal-imdb").innerHTML = "";
  document.getElementById("modal-year").textContent = "";
  document.getElementById("modal-rated").textContent = "";
  document.getElementById("modal-runtime").textContent = "";
  document.getElementById("modal-trailer").innerHTML = "";

  try {
    const url = `https://www.omdbapi.com/?i=${imdbID}&apikey=${API_KEY}`;
    const response = await fetch(url);
    const movie = await response.json();

    currentMovie = movie;

    document.getElementById("modal-title").textContent = movie.Title;
    document.getElementById("modal-plot").textContent = movie.Plot;
    document.getElementById("modal-director").textContent = movie.Director;
    document.getElementById("modal-cast").textContent = movie.Actors;
    document.getElementById("modal-genre").textContent = movie.Genre;
    document.getElementById("modal-year").textContent = movie.Year;
    document.getElementById("modal-rated").textContent = movie.Rated;
    document.getElementById("modal-runtime").textContent = movie.Runtime;

    document.getElementById("modal-poster").src = movie.Poster !== "N/A"
      ? movie.Poster
      : "https://via.placeholder.com/200x300?text=No+Image";

    // Star rating
    document.getElementById("modal-imdb").innerHTML = `
      <div class="stars-container">
        <div class="stars">${generateStars(movie.imdbRating)}</div>
        <span class="rating-text">${movie.imdbRating}/10</span>
        <span class="rating-votes">(${movie.imdbVotes} votes)</span>
      </div>`;

    // Favourites button state
    const isFav = favourites.some(f => f.imdbID === movie.imdbID);
    const favBtn = document.getElementById("modal-fav-btn");
    favBtn.textContent = isFav ? "❤️ Remove from Favourites" : "❤️ Add to Favourites";
    favBtn.classList.toggle("active", isFav);

    // Trailer
    loadTrailer(movie.Title, movie.Year);

  } catch (error) {
    document.getElementById("modal-title").textContent = "Failed to load details.";
  }
}

// =============================================
// ❌ Close Modal
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
// ⭐ Star Rating
// =============================================
function generateStars(rating) {
  const num = parseFloat(rating);
  if (isNaN(num)) return `<span class="rating-text">N/A</span>`;
  let html = "";
  for (let i = 1; i <= 10; i++) {
    if (i <= Math.floor(num)) html += `<span class="star full">★</span>`;
    else if (i === Math.ceil(num) && num % 1 >= 0.5) html += `<span class="star half">★</span>`;
    else html += `<span class="star empty">★</span>`;
  }
  return html;
}

// =============================================
// ❤️ Favourites
// =============================================
function toggleFavourite() {
  if (!currentMovie) return;
  const index = favourites.findIndex(f => f.imdbID === currentMovie.imdbID);
  if (index === -1) {
    favourites.push({
      imdbID: currentMovie.imdbID,
      Title: currentMovie.Title,
      Year: currentMovie.Year,
      Poster: currentMovie.Poster
    });
  } else {
    favourites.splice(index, 1);
  }
  localStorage.setItem("screenseek-favs", JSON.stringify(favourites));

  const isFav = favourites.some(f => f.imdbID === currentMovie.imdbID);
  const favBtn = document.getElementById("modal-fav-btn");
  favBtn.textContent = isFav ? "❤️ Remove from Favourites" : "❤️ Add to Favourites";
  favBtn.classList.toggle("active", isFav);

  renderFavourites();
}

function toggleFavourites() {
  const section = document.getElementById("favourites-section");
  section.classList.toggle("hidden");
  if (!section.classList.contains("hidden")) renderFavourites();
}

function renderFavourites() {
  const grid = document.getElementById("favourites-grid");
  if (favourites.length === 0) {
    grid.innerHTML = `<p style="color:var(--text2); grid-column:1/-1">No favourites yet. Click ❤️ on any movie!</p>`;
    return;
  }
  grid.innerHTML = favourites.map(movie => {
    const poster = movie.Poster !== "N/A"
      ? movie.Poster
      : "https://via.placeholder.com/160x230?text=No+Image";
    return `
      <div class="card visible" onclick="openModal('${movie.imdbID}')">
        <img src="${poster}" alt="${movie.Title}" loading="lazy"/>
        <div class="card-info">
          <h3>${movie.Title}</h3>
          <p>${movie.Year}</p>
        </div>
      </div>`;
  }).join("");
}

// =============================================
// 🎥 YouTube Trailer
// =============================================
async function loadTrailer(title, year) {
  const trailerDiv = document.getElementById("modal-trailer");
  trailerDiv.innerHTML = `<p style="color:var(--text2); font-size:0.85rem; margin-top:16px">Loading trailer...</p>`;

  try {
    // Search YouTube for the trailer
    const query = encodeURIComponent(`${title} ${year} official trailer`);
    const searchUrl = `https://www.youtube.com/results?search_query=${query}`;

    // We embed a YouTube search result — works without API key
    const videoId = await getYouTubeVideoId(title, year);
    if (videoId) {
      trailerDiv.innerHTML = `
        <p class="modal-label">Trailer</p>
        <iframe
          src="https://www.youtube.com/embed/${videoId}"
          allowfullscreen
          allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture">
        </iframe>`;
    } else {
      trailerDiv.innerHTML = `
        <p class="modal-label">Trailer</p>
        <a href="https://www.youtube.com/results?search_query=${query}" 
           target="_blank"
           style="color:var(--accent); font-size:0.9rem; text-decoration:none;">
          🎬 Watch trailer on YouTube →
        </a>`;
    }
  } catch {
    trailerDiv.innerHTML = "";
  }
}

async function getYouTubeVideoId(title, year) {
  // Common known trailers (fallback for popular movies)
  const knownTrailers = {
    "Inception": "YoHD9XEInc0",
    "Interstellar": "zSWdZVtXT7E",
    "The Dark Knight": "EXeTwQWrcwY",
    "Avengers: Endgame": "TcMBFSGVi1c",
    "Spider-Man: No Way Home": "JfVOs4VSpmA",
    "The Shawshank Redemption": "6hB3S9bIaco",
    "Parasite": "5xH0HfJHsaY",
    "Dune": "n9xhJrPXop4",
    "Oppenheimer": "uYPbbksJxIg",
    "Barbie": "pBk4NYhaKZg",
  };

  if (knownTrailers[title]) return knownTrailers[title];
  return null; // Falls back to YouTube link
}

// =============================================
// ✨ Particle Background
// =============================================
const canvas = document.getElementById("particles-canvas");
const ctx = canvas.getContext("2d");
let particles = [];

function resizeCanvas() {
  canvas.width = window.innerWidth;
  canvas.height = window.innerHeight;
}

function createParticles() {
  particles = [];
  const count = Math.floor(window.innerWidth / 15);
  for (let i = 0; i < count; i++) {
    particles.push({
      x: Math.random() * canvas.width,
      y: Math.random() * canvas.height,
      r: Math.random() * 2 + 0.5,
      dx: (Math.random() - 0.5) * 0.4,
      dy: (Math.random() - 0.5) * 0.4,
      opacity: Math.random() * 0.5 + 0.1
    });
  }
}

function animateParticles() {
  ctx.clearRect(0, 0, canvas.width, canvas.height);
  const isDark = document.body.classList.contains("dark");
  const color = isDark ? "255,255,255" : "0,113,227";

  particles.forEach(p => {
    p.x += p.dx;
    p.y += p.dy;

    if (p.x < 0 || p.x > canvas.width) p.dx *= -1;
    if (p.y < 0 || p.y > canvas.height) p.dy *= -1;

    ctx.beginPath();
    ctx.arc(p.x, p.y, p.r, 0, Math.PI * 2);
    ctx.fillStyle = `rgba(${color}, ${p.opacity})`;
    ctx.fill();
  });

  requestAnimationFrame(animateParticles);
}

window.addEventListener("resize", () => {
  resizeCanvas();
  createParticles();
});

resizeCanvas();
createParticles();
animateParticles();

// =============================================
// ⌨️ Enter key to search
// =============================================
document.getElementById("searchInput").addEventListener("keydown", e => {
  if (e.key === "Enter") searchMovie();
});