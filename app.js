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
      <div class="card">
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