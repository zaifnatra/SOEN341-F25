document.addEventListener("DOMContentLoaded", async () => {
  const dashboardLink = document.getElementById("dashboard-link");
  const forYouLink = document.getElementById("for-you-link"); 
  const accountLink = document.getElementById("account-link")
  
  // If neither link exists (no navbar), exit quietly
  if (!dashboardLink && !forYouLink) return;

  // Disable dashboard until we know user role
  if (dashboardLink) {
    dashboardLink.style.pointerEvents = "none";
    dashboardLink.style.opacity = "0.6";
  }

  // Try reading cached userRole from sessionStorage
  let userRole = sessionStorage.getItem("userRole");

  async function getUserRoleFromServer() {
    const res = await fetch("/user-profile", { credentials: "include" });
    if (!res.ok) throw new Error("Not logged in");
    const data = await res.json();
    sessionStorage.setItem("userRole", data.role || "student");
    return data.role || "student";
  }

  try {
    // Fetch role if not cached
    if (!userRole) userRole = await getUserRoleFromServer();

    // === DASHBOARD VISIBILITY AND LINK ===
    if (dashboardLink) {
      if (userRole === "student") {
        // Students don’t have dashboards
        dashboardLink.style.display = "none";
      } else {
        // Organizers/Admins keep dashboard visible
        let dashboardHref = "/account";
        if (userRole === "organizer") dashboardHref = "/organizerdashboard";
        else if (userRole === "admin") dashboardHref = "/admindashboard";

        dashboardLink.href = dashboardHref;
        dashboardLink.style.display = "inline-block";
        dashboardLink.style.pointerEvents = "auto";
        dashboardLink.style.opacity = "1";
      }
    }

    // FOR YOU VISIBILITY
    if (forYouLink) {
      if (userRole === "student") {
        forYouLink.style.display = "inline-block";
      } else {
        forYouLink.style.display = "none";
      }
    }

    // ACCOUNT VISIBILITY
    if (accountLink) {
      if (userRole === "admin") {
        accountLink.style.display = "none";
      } else {
        accountLink.style.display = "inline-block";
      }
    }

  } catch (err) {
    console.warn("Role detection failed:", err);

    // Hide restricted links for logged-out users
    if (dashboardLink) dashboardLink.style.display = "none";
    if (forYouLink) forYouLink.style.display = "none";
  }
});
