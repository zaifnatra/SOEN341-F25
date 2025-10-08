fetch('/session-status')
  .then(res => res.json())
  .then(data => {
    const container = document.getElementById('auth-btn-container');
    if (data.loggedIn) {
      container.innerHTML = `
        <a href="/logout" class="signout">SIGN OUT</a>
      `;
    } else {
      container.innerHTML = `
        <a href="signin.html" class="signout">SIGN IN</a>
      `;
    }
    if (data.logoutMessage) {
      alert(data.logoutMessage);
    }
  });