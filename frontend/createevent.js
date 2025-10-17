// createevent.js

//Input Field Behaviour - Ticket Capacity
const capacityInput = document.getElementById("event-capacity");
if (capacityInput) {
  // Allow only digits 0–9
  capacityInput.addEventListener("keypress", (event) => {
    if (!/[0-9]/.test(event.key)) {
      event.preventDefault();
    }
  });

  // Block paste and drag-drop of non-numeric text
  capacityInput.addEventListener("paste", (event) => {
    const pasted = event.clipboardData.getData("text");
    if (!/^\d+$/.test(pasted)) event.preventDefault();
  });

  capacityInput.addEventListener("drop", (event) => {
    const dropped = event.dataTransfer.getData("text");
    if (!/^\d+$/.test(dropped)) event.preventDefault();
  });
}

//Event Creation Process
const createBtn = document.getElementById("create-btn");

if (createBtn) {
  createBtn.addEventListener("click", async function () {
    const title = document.getElementById("event-title").value.trim();
    const description = document.getElementById("event-description").value.trim();
    const date = document.getElementById("event-date").value;
    const time = document.getElementById("event-time").value;
    const location = document.getElementById("event-location").value.trim();
    const capacity = document.getElementById("event-capacity").value;
    const type = document.getElementById("event-type").value;

    //Block empty required fields
    if (!title || !date || !time || !location || !capacity || !type) {
      alert("⚠️ Please fill in all required fields!");
      return;
    }

    // Block invalid ticket capacities
    if (capacity <= 0) {
    alert("⚠️ Ticket capacity must be greater than 0!");
    return;
    }


    //Block Past Dates
    const selectedDate = new Date(date);
    const today = new Date();
    today.setHours(0, 0, 0, 0);
    if (selectedDate < today) {
    alert("⚠️ You cannot select a past date for the event!");
    return;
    }

    try {
      const response = await fetch("/createEvent", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          title,
          description,
          date,
          time,
          location,
          capacity,
          type,
        }),
      });

      const data = await response.json();

      if (response.ok) {
        alert("🎉 Event created successfully!");
        console.log("Server response:", data);
        window.location.href = "events.html";
      } else {
        alert("Error creating event: " + data.message);
        console.error("Server error:", data);
      }
    } catch (error) {
      console.error("Error sending event data:", error);
      alert(" Could not connect to the server.");
    }
  });
}
document.addEventListener("DOMContentLoaded", async () => {
  const eventsContainer = document.getElementById("my-events-list");

  try {
    const response = await fetch("/my-signedup-events");
    const events = await response.json();

    if (events.length === 0) {
      eventsContainer.innerHTML = "<p>You haven't signed up for any events yet.</p>";
      return;
    }

    eventsContainer.innerHTML = events.map((event, index) => `
      <div class="event-card" id="event-card-${index}" style="border: 1px solid #ccc; padding: 10px; margin: 10px;">
        <h3>${event.title}</h3>
        <p><strong>Date:</strong> ${event.date} | <strong>Time:</strong> ${event.time}</p>
        <p><strong>Location:</strong> ${event.location}</p>
        <p><strong>Type:</strong> ${event.type}</p>
        <p>${event.description}</p>
        <button class="remove-btn" data-eventid="${event._id}" data-index="${index}" style="margin-top: 10px; background-color: red; color: white; border: none; padding: 5px 10px; cursor: pointer;">
          Remove
        </button>
      </div>
    `).join("");

    // Add click event listeners
    document.querySelectorAll(".remove-btn").forEach(btn => {
      btn.addEventListener("click", async (e) => {
        const eventId = e.target.dataset.eventid;
        const index = e.target.dataset.index;

        try {
          const res = await fetch("/remove-signedup-event", {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ eventId })
          });

          const data = await res.json();

          if (data.success) {
            // Remove card from UI
            const card = document.getElementById(`event-card-${index}`);
            if (card) card.remove();
            alert(data.message);
          } else {
            alert("Error: " + data.message);
          }
        } catch (err) {
          console.error("Remove event failed:", err);
          alert("Server error. Could not remove the event.");
        }
      });
    });

  } catch (error) {
    console.error("Failed to load events:", error);
    eventsContainer.innerHTML = "<p>Error loading your events. Please try again later.</p>";
  }
});
