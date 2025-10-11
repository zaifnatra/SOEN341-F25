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

fetch('/user-profile')
  .then(res => {
    if (!res.ok) throw new Error("Not logged in");
    return res.json();
  })
  .then(user => {
    document.getElementById('profile-name').textContent = user.username;
    document.getElementById('profile-email').textContent = user.email;
    document.getElementById('profile-role').textContent = user.role;
  })
  .catch(() => {
    document.getElementById('profile-name').textContent = "Name";
    document.getElementById('profile-email').textContent = "Email";
    document.getElementById('profile-role').textContent = "Role";
  });

  sessionStorage.removeItem("userRole");

