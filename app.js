// =============================================
// 🔑 YOUR API KEY — paste your key below
// =============================================
const API_KEY = "793ab0cf"; // <-- Replace this!

// =============================================
// 🗄️ Cache — stores past searches in memory
// so we don't repeat the same API call twice
// =============================================
const cache = {};

// =============================================
// 🔍 Main search function
// Called when the user clicks the Search button
// =============================================
async function searchMovie() {
  // Step 1: Read what the user typed
  const query = document.getElementById("searchInput").value.trim();

  // Step 2: Get the elements we'll update
  const resultsDiv = document.getElementById("results");
  const errorDiv = document.getElementById("error-msg");

  // Step 3: Clear previous results and errors
  resultsDiv.innerHTML = "";
  errorDiv.textContent = "";

  // Step 4: Don't search if input is empty
  if (!query) {
    errorDiv.textContent = "Please type a movie name first.";
    return;
  }

  // Step 5: Check the cache — did we search this before?
  if (cache[query]) {
    console.log("Loaded from cache:", query);
    displayResults(cache[query]);
    return; // Skip the API call entirely
  }

  // Step 6: Show a loading message while we wait for the API
  resultsDiv.innerHTML = `
  <div class="spinner-container">
    <div class="spinner"></div>
  </div>
`;

  // Step 7: Make the API call (inside try/catch for error handling)
  try {
    // Build the URL with our search query and API key
    const url = `https://www.omdbapi.com/?s=${encodeURIComponent(query)}&apikey=${API_KEY}`;

    // fetch() sends the HTTP GET request and waits for a response
    const response = await fetch(url);

    // If the network itself failed (no internet, server down)
    if (!response.ok) {
      throw new Error("Network error. Please check your internet connection.");
    }

    // Convert the raw response into a JavaScript object (JSON parsing)
    const data = await response.json();

    // Step 8: OMDB returns Response:"False" if no movies found
    if (data.Response === "False") {
      resultsDiv.innerHTML = "";
      errorDiv.textContent = `No results found for "${query}". Try another name!`;
      return;
    }

    // Step 9: Save result to cache for next time
    cache[query] = data.Search;
    console.log("Fetched from API:", data.Search);

    // Step 10: Display the movies
    displayResults(data.Search);

  } catch (error) {
    // If anything goes wrong, show a friendly error
    resultsDiv.innerHTML = "";
    errorDiv.textContent = `Error: ${error.message}`;
  }
}

// =============================================
// 🎴 Display the movie cards on the page
// =============================================
function displayResults(movies) {
  const resultsDiv = document.getElementById("results");

  // Map over each movie and create an HTML card for it
  resultsDiv.innerHTML = movies.map(movie => {
    // Use a placeholder image if no poster is available
    const poster = movie.Poster !== "N/A"
      ? movie.Poster
      : "https://via.placeholder.com/160x230?text=No+Image";

    return `
      <div class="card" onclick="openModal('${movie.imdbID}')">
        <img src="${poster}" alt="${movie.Title}" />
        <div class="card-info">
          <h3>${movie.Title}</h3>
          <p>${movie.Year}</p>
        </div>
      </div>
    `;
  }).join(""); // join() turns the array of strings into one big HTML string
}

// =============================================
// ⌨️  Allow pressing Enter key to search
// =============================================
document.getElementById("searchInput").addEventListener("keydown", function (e) {
  if (e.key === "Enter") {
    searchMovie();
  }
});
// =============================================
// 🎬 Open Modal with full movie details
// =============================================
async function openModal(imdbID) {

  // Show the overlay immediately
  document.getElementById("modal-overlay").classList.remove("hidden");

  // Show loading state inside modal while fetching
  document.getElementById("modal-title").textContent = "Loading...";
  document.getElementById("modal-plot").textContent = "";
  document.getElementById("modal-poster").src = "";
  document.getElementById("modal-director").textContent = "";
  document.getElementById("modal-cast").textContent = "";
  document.getElementById("modal-genre").textContent = "";
  document.getElementById("modal-imdb").textContent = "";
  document.getElementById("modal-year").textContent = "";
  document.getElementById("modal-rated").textContent = "";
  document.getElementById("modal-runtime").textContent = "";

  try {
    // Fetch full movie details using IMDB ID
    // Notice we use "i=" instead of "s=" — this gets ONE movie's full details
    const url = `https://www.omdbapi.com/?i=${imdbID}&apikey=${API_KEY}`;
    const response = await fetch(url);
    const movie = await response.json();

    // Fill in all the details
    document.getElementById("modal-title").textContent = movie.Title;
    document.getElementById("modal-plot").textContent = movie.Plot;
    document.getElementById("modal-director").textContent = movie.Director;
    document.getElementById("modal-cast").textContent = movie.Actors;
    document.getElementById("modal-genre").textContent = movie.Genre;
    document.getElementById("modal-imdb").textContent = movie.imdbRating;
    document.getElementById("modal-year").textContent = movie.Year;
    document.getElementById("modal-rated").textContent = movie.Rated;
    document.getElementById("modal-runtime").textContent = movie.Runtime;

    // Set poster image
    document.getElementById("modal-poster").src = movie.Poster !== "N/A"
      ? movie.Poster
      : "https://via.placeholder.com/200x300?text=No+Image";

  } catch (error) {
    document.getElementById("modal-title").textContent = "Failed to load details.";
  }
}

// =============================================
// ❌ Close the Modal
// =============================================
function closeModal() {
  document.getElementById("modal-overlay").classList.add("hidden");
}

// Close modal if user clicks outside the modal box
document.getElementById("modal-overlay").addEventListener("click", function(e) {
  if (e.target === this) {
    closeModal();
  }
});

// Close modal with Escape key
document.addEventListener("keydown", function(e) {
  if (e.key === "Escape") {
    closeModal();
  }
});