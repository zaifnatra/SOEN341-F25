document.addEventListener("DOMContentLoaded", async () => {
  const eventsTableBody = document.getElementById("events-table-body");
  const exportCsvButton = document.getElementById("export-csv-button");

  let organizerEmail = null;
  let userData = null;

  // Fetch organizer session info
  try {
    const sessionRes = await fetch("/user-profile", { credentials: "include" });
    if (!sessionRes.ok) throw new Error("Not logged in");
    userData = await sessionRes.json();
    organizerEmail = userData.email;
  } catch (err) {
    console.error("Error fetching user profile:", err);
    eventsTableBody.innerHTML = `<tr><td colspan="7">You must be logged in to view this page.</td></tr>`;
    return;
  }

  // Fetch all events and filter those linked to this organizer
  try {
    const res = await fetch("/events", { credentials: "include" });
    if (!res.ok) throw new Error("Failed to fetch events");
    const events = await res.json();

   const myEvents = events.filter((e) => {
  if (Array.isArray(e.organizer)) {
    return e.organizer.includes(organizerEmail) || e.organizer.includes(userData.username);
  }
  return e.organizer === organizerEmail || e.organizer === userData.username;
});


    if (myEvents.length === 0) {
      eventsTableBody.innerHTML = `<tr><td colspan="7">No events found for ${organizerEmail}.</td></tr>`;
      return;
    }

    // Build table rows
    eventsTableBody.innerHTML = "";
    myEvents.forEach((event) => {
  const ticketsIssued = event.capacity || 0;
  const attended = event.scannedTickets || 0;
  const attendanceRate =
    ticketsIssued > 0
      ? ((attended / ticketsIssued) * 100).toFixed(1) + "%"
      : "0%";

  const row = document.createElement("tr");
  row.innerHTML = `
    <td>${event.title}</td>
    <td>${ticketsIssued}</td>
    <td>${attendanceRate}</td>
    <td>${event.remainingTickets ?? (event.capacity - attended)}</td>
    <td>
      <button class="download-qr-btn" data-event-id="${event._id}">Download QR Codes</button>
    </td>
  `;
  eventsTableBody.appendChild(row);
});


    // Attach listeners to all "Download QR Codes" buttons
    document.querySelectorAll(".download-qr-btn").forEach((btn) => {
      btn.addEventListener("click", async (e) => {
        const eventId = e.target.getAttribute("data-event-id");
        await downloadQRCodes(eventId);
      });
    });

    // Export CSV
    exportCsvButton.addEventListener("click", () => exportToCSV(myEvents));
  } catch (error) {
    console.error("Error loading events:", error);
    eventsTableBody.innerHTML = `<tr><td colspan="7">Error loading events data.</td></tr>`;
  }
});

// Helper function: Export events as CSV
function exportToCSV(events) {
  if (!events || events.length === 0) return alert("No data to export.");

  const headers = [
    "Event",
    "Tickets Issued",
    "Attended",
    "Attendance Rate",
    "Capacity",
    "Remaining",
  ];
const rows = events.map((e) => {
  const ticketsIssued = e.capacity;
  const attended = e.scannedTickets || 0;
  const attendanceRate = e.attendanceRate
    ? e.attendanceRate.toFixed(1) + "%"
    : "0%";

  return [
    e.title,
    ticketsIssued,
    attended,
    attendanceRate,
    e.capacity,
    e.remainingTickets,
  ].join(",");
});


  const csvContent = [headers.join(","), ...rows].join("\n");
  const blob = new Blob([csvContent], { type: "text/csv;charset=utf-8;" });
  const url = URL.createObjectURL(blob);
  const link = document.createElement("a");
  link.href = url;
  link.download = "organizer_events.csv";
  link.click();
  URL.revokeObjectURL(url);
}

// Helper function: Download QR Codes for a specific event
async function downloadQRCodes(eventId) {
  try {
    const res = await fetch(`/download-qrcodes/${eventId}`, { credentials: "include" });
    if (!res.ok) throw new Error("Failed to download QR codes");

    // Determine if multiple QR codes (ZIP) or single (PNG)
    const contentType = res.headers.get("Content-Type");
    const blob = await res.blob();
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;

    if (contentType.includes("zip")) {
      a.download = `event_${eventId}_qrcodes.zip`;
    } else {
      a.download = `event_${eventId}_qrcode.png`;
    }

    a.click();
    URL.revokeObjectURL(url);
  } catch (err) {
    console.error("Error downloading QR codes:", err);
    alert("Unable to download QR codes. Please try again later.");
  }
}
