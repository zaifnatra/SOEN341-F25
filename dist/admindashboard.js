function showTab(tabId, event) {
  
  document.querySelectorAll('.content').forEach(c => c.classList.remove('active'));
  document.querySelectorAll('.tab').forEach(t => t.classList.remove('active'));
  document.getElementById(tabId).classList.add('active');
  if(event) event.target.classList.add('active');

  // Load content dynamically
  if (tabId === "oversight") loadPendingOrganizers();
  if (tabId === "management") loadAllUsers();
}


async function loadPendingOrganizers() {
  try {
    const [resPending, resEvents] = await Promise.all([
      fetch("/pending-organizers"),
      fetch("/events")
    ]);

    const pending = await resPending.json();
    let events = [];
    if (resEvents.ok) {
      events = await resEvents.json();
    }
    
    //build map of event IDs to titles
    const eventMap = {};
    events.forEach(e => {
      const id = e._id
      const name = e.title
      if (id) eventMap[id] = name || id; //fallback to ID if no title
    })

    const tbody = document
      .getElementById("pending-organizers-table")
      .querySelector("tbody");
    tbody.innerHTML = "";

    pending.forEach(req => {
      const tr = document.createElement("tr");

      const displayEventTitle = req.eventId ? (eventMap[req.eventId] || "Deleted Event") : "-";

      tr.innerHTML = `
        <td>${req.username || "N/A"}</td>
        <td>${req.email || "N/A"}</td>
        <td>${req.type || "N/A"}</td>
        <td>${displayEventTitle}</td>
        <td>${new Date(req.submittedAt).toLocaleString()}</td>
        <td>
          <button class="approve" onclick="approveOrganizer('${req.userId}','${req.eventId || ""}')">Approve</button>
          <button class="reject" onclick="rejectOrganizer('${req.userId}','${req.eventId || ""}')">Reject</button>
        </td>
      `;
      tbody.appendChild(tr);
    });

  } catch (err) {
    console.error("Error loading pending organizers:", err);
  }
}

// Load all users for Organizations tab
async function loadAllUsers() {
  try {
    const res = await fetch("/all-users");
    const users = await res.json();

    const tbody = document
      .getElementById("all-users-table")
      .querySelector("tbody");
    tbody.innerHTML = "";

    users.forEach(user => {
      const tr = document.createElement("tr");
      tr.innerHTML = `
        <td>${user.username || "N/A"}</td>
        <td>${user.email || "N/A"}</td>
        <td>${user.role || "N/A"}</td>
        <td>
          <button class="delete" onclick="deleteUser('${user._id}')">Delete</button>
        </td>
      `;
      tbody.appendChild(tr);
    });

  } catch (err) {
    console.error("Error loading users:", err);
  }
}

async function deleteUser(userId) {
  if (!confirm("Are you sure you want to delete this user?")) return;

  try {
    const res = await fetch(`/delete-user/${userId}`, { method: "DELETE" });
    const data = await res.json();
    alert(data.message);
    loadAllUsers();
  } catch (err) {
    console.error("Error deleting user:", err);
    alert("Error deleting user");
  }
}

// Trigger loading users when the "Organizations" tab is opened
document.querySelector('.tab[onclick*="management"]').addEventListener('click', loadAllUsers);

async function approveOrganizer(userId, eventId) {
  try {
    const res = await fetch("/approve-organizer", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ userId, eventId })
    });
    const data = await res.json();
    alert(data.message);
    loadPendingOrganizers();
  } catch (err) {
    console.error(err);
    alert("Error approving request");
  }
}

async function rejectOrganizer(userId, eventId) {
  try {
    const res = await fetch("/reject-organizer", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ userId, eventId })
    });
    const data = await res.json();
    alert(data.message);
    loadPendingOrganizers();
  } catch (err) {
    console.error(err);
    alert("Error rejecting request");
  }
}

document.addEventListener("DOMContentLoaded", loadPendingOrganizers);
