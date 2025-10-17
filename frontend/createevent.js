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
