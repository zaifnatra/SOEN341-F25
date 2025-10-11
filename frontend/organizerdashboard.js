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
    eventsTableBody.innerHTML = `<tr><td colspan="6">You must be logged in to view this page.</td></tr>`;
    return;
  }

  // Fetch all events and filter those linked to this organizer
  try {
    const res = await fetch("/events", { credentials: "include" });
    if (!res.ok) throw new Error("Failed to fetch events");
    const events = await res.json();

    const myEvents = events.filter(e => 
      e.organizer === organizerEmail || e.organizer === userData.username
    );

    if (myEvents.length === 0) {
      eventsTableBody.innerHTML = `<tr><td colspan="6">No events found for ${organizerEmail}.</td></tr>`;
      return;
    }

    // Build table rows
    eventsTableBody.innerHTML = "";
    myEvents.forEach(event => {
      const ticketsIssued = (event.scannedTickets?.length || 0) + (event.unscannedTickets?.length || 0);
      const attended = event.scannedTickets?.length || 0;
      const attendanceRate = ticketsIssued > 0 ? ((attended / ticketsIssued) * 100).toFixed(1) + "%" : "0%";

      const row = document.createElement("tr");
      row.innerHTML = `
        <td>${event.title}</td>
        <td>${ticketsIssued}</td>
        <td>${attended}</td>
        <td>${attendanceRate}</td>
        <td>${event.capacity}</td>
        <td>${event.remainingTickets}</td>
      `;
      eventsTableBody.appendChild(row);
    });

    // Export CSV
    exportCsvButton.addEventListener("click", () => exportToCSV(myEvents));

  } catch (error) {
    console.error("Error loading events:", error);
    eventsTableBody.innerHTML = `<tr><td colspan="6">Error loading events data.</td></tr>`;
  }
});

// Helper function
function exportToCSV(events) {
  if (!events || events.length === 0) return alert("No data to export.");

  const headers = ["Event", "Tickets Issued", "Attended", "Attendance Rate", "Capacity", "Remaining"];
  const rows = events.map(e => {
    const ticketsIssued = (e.scannedTickets?.length || 0) + (e.unscannedTickets?.length || 0);
    const attended = e.scannedTickets?.length || 0;
    const attendanceRate = ticketsIssued > 0 ? ((attended / ticketsIssued) * 100).toFixed(1) + "%" : "0%";
    return [
      e.title,
      ticketsIssued,
      attended,
      attendanceRate,
      e.capacity,
      e.remainingTickets
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
