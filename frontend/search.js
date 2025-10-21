// searchRedirect.js
document.addEventListener("DOMContentLoaded", () => {
  const searchInput = document.getElementById('eventSearchInput');
  const searchIcon = document.getElementById('searchIcon');

  function redirectToEvents() {
    const query = searchInput.value.trim();
    if (query) {
      window.location.href = `events.html?search=${encodeURIComponent(query)}`;
    } else {
      window.location.href = 'events.html';
    }
  }

  if (searchInput && searchIcon) {
    searchInput.addEventListener('keydown', (e) => {
      if (e.key === 'Enter') {
        e.preventDefault(); // Prevent form submission
        redirectToEvents();
      }
    });

    searchIcon.addEventListener('click', redirectToEvents);
  }
});
