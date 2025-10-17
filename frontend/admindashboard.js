function showTab(tabId, event) {
  document.querySelectorAll('.content').forEach(c => c.classList.remove('active'));
  document.querySelectorAll('.tab').forEach(t => t.classList.remove('active'));
  document.getElementById(tabId).classList.add('active');
  if(event) event.target.classList.add('active');
}

async function loadPendingOrganizers() {
  try {
    const res = await fetch("/pending-organizers");
    const pending = await res.json();

    const tbody = document
      .getElementById("pending-organizers-table")
      .querySelector("tbody");
    tbody.innerHTML = "";

    pending.forEach(req => {
      const tr = document.createElement("tr");

      tr.innerHTML = `
        <td>${req.username || "N/A"}</td>
        <td>${req.email || "N/A"}</td>
        <td>${req.type || "N/A"}</td>
        <td>${req.eventId || "-"}</td>
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
