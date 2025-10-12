document.addEventListener("DOMContentLoaded", async () => {
  const dashboardLink = document.getElementById("dashboard-link");
  if (!dashboardLink) return;

  // Disable link until ready
  dashboardLink.style.pointerEvents = "none";
  dashboardLink.style.opacity = "0.6";

  // Try sessionStorage first (faster, persists across reloads)
  let userRole = sessionStorage.getItem("userRole");

  async function getUserRoleFromServer() {
    const res = await fetch("/user-profile", { credentials: "include" });
    if (!res.ok) throw new Error("Not logged in");
    const data = await res.json();
    sessionStorage.setItem("userRole", data.role || "student");
    return data.role || "student";
  }

  try {
    if (!userRole) userRole = await getUserRoleFromServer();

    let dashboardHref = "/account";
    if (userRole === "organizer") dashboardHref = "/organizerdashboard";
    else if (userRole === "admin") dashboardHref = "/admindashboard";

    dashboardLink.href = dashboardHref;
    dashboardLink.style.pointerEvents = "auto";
    dashboardLink.style.opacity = "1";
  } catch (err) {
    console.warn("Role detection failed:", err);
    dashboardLink.style.display = "none";
  }
});
