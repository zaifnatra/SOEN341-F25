function showTab(tabId, event) {
  
  document.querySelectorAll('.content').forEach(c => c.classList.remove('active'));
  document.querySelectorAll('.tab').forEach(t => t.classList.remove('active'));
  document.getElementById(tabId).classList.add('active');
  if(event) event.target.classList.add('active');

  // Load content dynamically
  if (tabId === "oversight") loadPendingOrganizers();
  if (tabId === "analytics") loadAnalytics();
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

// Trigger loading pending organizers when the "Oversight" tab is opened
document.addEventListener("DOMContentLoaded", loadPendingOrganizers);

async function loadAnalytics() {
  try {
    const res = await fetch("/events");
    if (!res.ok) throw new Error("Failed to fetch events");
    const events = await res.json();

    // helper: count scans in [start, end] using event.scans (ISO strings)
    function countScansInRange(e, start, end) {
      if (Array.isArray(e.scans) && e.scans.length) {
        return e.scans.reduce((cnt, ts) => {
          const d = new Date(ts);
          return d.toString() !== "Invalid Date" && d >= start && d <= end ? cnt + 1 : cnt;
        }, 0);
      }
      return 0; // cannot attribute total scannedTickets to windows without timestamps
    }

    // totals: use scannedTickets as a priority, but tolerate scans[]
    const totalEvents = events.length;
    const totalTicketsIssued = events.reduce((sum, e) => {
      const scansLen = Array.isArray(e.scans) ? e.scans.length : 0;
      const scannedCount = typeof e.scannedTickets === 'number'
        ? Math.max(e.scannedTickets, scansLen) // prefer recorded scannedTickets, but keep scans as sanity-check
        : scansLen;
      return sum + scannedCount;
    }, 0);

    // trend unit and anchored 'now' (5min/hour(if hour is wanted replace logic accordinly)/day)
    const TREND_UNIT = "5min";
    const msPerUnit = TREND_UNIT === "5min" ? 5 * 60 * 1000 : 24 * 60 * 60 * 1000;
    let now = new Date();
    const lastStart = new Date(now.getTime() - msPerUnit);
    const prevStart = new Date(now.getTime() - 2 * msPerUnit);

    const lastTickets = events.reduce((sum, e) => sum + countScansInRange(e, lastStart, now), 0);
    const prevTickets = events.reduce((sum, e) => sum + countScansInRange(e, prevStart, lastStart - 1), 0);

    // compute trend (safe handling of prev==0)
    let trendPercent = "N/A", trendColor = "gray";
    if (prevTickets === 0) {
      trendPercent = lastTickets === 0 ? "0%" : "—";
    } else {
      const change = Math.round(((lastTickets - prevTickets) / prevTickets) * 100);
      trendPercent = (change >= 0 ? "+" : "") + change + "%";
      trendColor = change >= 0 ? "green" : "red";
    }

    // update DOM safely (guards omitted for brevity in this snippet)
    document.getElementById("total-events").textContent = totalEvents;
    document.getElementById("tickets-issued").textContent = totalTicketsIssued;
    const trendElem = document.getElementById("participation-trend");
    trendElem.textContent = `${trendPercent} (last ${TREND_UNIT})`;
    trendElem.style.color = trendColor;
    

    // populate events table with total + recent counts
    const table = document.getElementById("name-and-tickets-claimed");
    if (table) {
      let tbody = table.querySelector("tbody") || table.appendChild(document.createElement("tbody"));
      tbody.innerHTML = "";
       events.forEach(e => {
        const scansLen = Array.isArray(e.scans) ? e.scans.length : 0;
        const total = typeof e.scannedTickets === 'number'
          ? Math.max(e.scannedTickets, scansLen)   // scannedTickets is authoritative
          : scansLen;
        const recent = countScansInRange(e, lastStart, now);
        const tr = document.createElement("tr");
        tr.innerHTML = `<td>${e.title || "N/A"}</td><td>${total} (${recent} recent)</td>`;
        tbody.appendChild(tr);
      });
    }
  } catch (err) {
    console.error("Error loading analytics:", err);
  }
}

// Trigger loading analytics when the "Analytics" tab is opened
document.addEventListener("DOMContentLoaded", () => {
  loadAnalytics();
  // refresh analytics every 5 minutes (300000 ms) — shorten to 30s for faster tests if needed
  setInterval(loadAnalytics, 5 * 60 * 1000);
});
