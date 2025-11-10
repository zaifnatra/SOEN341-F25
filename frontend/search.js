// searchRedirect.js
document.addEventListener("DOMContentLoaded", () => {
  // handle search on homepage: only go to events if logged in, otherwise go to signin
  const searchInput = document.getElementById('eventSearchInput');
  const searchIcon = document.getElementById('searchIcon');

  function doSearch() {
    const query = (searchInput && searchInput.value || '').trim();
    if (!query) return;

    fetch('/session-status')
      .then(res => {
        if (!res.ok) throw new Error('no-session-route');
        return res.json();
      })
      .then(data => {
        if (data.loggedIn) {
          // user signed in -> go to events page (pass query)
          const url = `/eventspage?search=${encodeURIComponent(query)}`;
          window.location.href = url;
        } else {
          // not signed in -> send to signin (optionally preserve intended target)
          const redirect = `/eventspage?search=${encodeURIComponent(query)}`;
          window.location.href = `/signin.html?redirect=${encodeURIComponent(redirect)}`;
        }
      })
      .catch(() => {
        // fallback: send to signin
        window.location.href = `/signin.html`;
      });
  }

  if (searchIcon) searchIcon.addEventListener('click', doSearch);
  if (searchInput) {
    searchInput.addEventListener('keydown', (e) => {
      if (e.key === 'Enter') {
        e.preventDefault();
        doSearch();
      }
    });
  }
});
