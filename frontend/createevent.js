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

   

    // Read from the two different dropdown IDs

    const type = document.getElementById("event-category").value;

    const paymentStatus = document.getElementById("event-payment-status").value;



    // Update the validation check

    if (!title || !date || !time || !location || !capacity || type === "Select a Category" || paymentStatus === "FREE OR PAID event") {

      alert("⚠️ Please fill in all required fields, including category and price type!");

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

        // --- THIS BLOCK IS NOW FIXED ---

        body: JSON.stringify({

          title,

          description,

          date,

          time,

          location,

          capacity,

          type: type,

          paymentStatus: paymentStatus

        }),

      });



      const data = await response.json();



      if (response.ok) {

        alert("🎉 Event created successfully!");

        console.log("Server response:", data);

        window.location.href = "/eventspage"; // Redirect to events page

      } else {

        alert("Error creating event: " + data.message);

        console.error("Server error:", data);

      }

    } catch (error) {

      console.error("Error sending event data:", error);

      alert("Could not connect to the server.");

    }

  });

}



// Load My Registered Events

document.addEventListener("DOMContentLoaded", async () => {

  const eventsContainer = document.getElementById("my-events-list");

  if (!eventsContainer) return;



  try {

    const response = await fetch("/my-signedup-events");

    const events = await response.json();



    if (events.length === 0) {

      eventsContainer.innerHTML = "<p>You haven't signed up for any events yet.</p>";

      return;

    }



    eventsContainer.innerHTML = events

      .map(

        (event, index) => `

      <div class="event-card" id="event-card-${index}" style="border: 1px solid #ccc; padding: 20px; margin: 15px; border-radius: 10px;">

        <h3>${event.title}</h3>

        <p><strong>Date:</strong> ${event.date} | <strong>Time:</strong> ${event.time}</p>

        <p><strong>Location:</strong> ${event.location}</p>

        <p><strong>Type:</strong> ${event.type}</p>

        <p>${event.description}</p>

        <div style="margin-top: 15px;">

          <button class="fancy-btn remove-btn" data-eventid="${event._id}" data-index="${index}">

            Remove

          </button>

          <button class="fancy-btn save-calendar-btn"

            data-title="${event.title}"

            data-date="${event.date}"

            data-time="${event.time}"

            data-location="${event.location}">

            Save to Calendar

          </button>

          <button class="fancy-btn ticket-btn" data-eventid="${event._id}">

            Receive Digital Ticket

          </button>

        </div>

      </div>

    `

      )

      .join("");



    // Remove event functionality

    document.querySelectorAll(".remove-btn").forEach((btn) => {

      btn.addEventListener("click", async (e) => {

        const eventId = e.target.dataset.eventid;

        const index = e.target.dataset.index;



        try {

          const res = await fetch("/remove-signedup-event", {

            method: "POST",

            headers: { "Content-Type": "application/json" },

            body: JSON.stringify({ eventId }),

          });



          const data = await res.json();



          if (data.success) {

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



    // Save to Google Calendar functionality

    document.querySelectorAll(".save-calendar-btn").forEach((btn) => {

      btn.addEventListener("click", (e) => {

        const title = e.target.dataset.title;

        const date = e.target.dataset.date;

        const time = e.target.dataset.time;

        const location = e.target.dataset.location;



        const start = new Date(`${date}T${time}`);

        if (isNaN(start)) {

          alert("Invalid date or time format for this event.");

          return;

        }



        const end = new Date(start.getTime() + 60 * 60 * 1000);



        const startStr = start.toISOString().replace(/[-:]/g, "").split(".")[0] + "Z";

        const endStr = end.toISOString().replace(/[-:]/g, "").split(".")[0] + "Z";



        const gcalUrl =

          `https://calendar.google.com/calendar/render?action=TEMPLATE` +

          `&text=${encodeURIComponent(title)}` +

          `&dates=${startStr}/${endStr}` +

          `&details=${encodeURIComponent(title + " at " + location)}` +

          `&location=${encodeURIComponent(location)}`;



        window.open(gcalUrl, "_blank");

      });

    });



    // Receive Digital Ticket functionality

    document.querySelectorAll(".ticket-btn").forEach((btn) => {

      btn.addEventListener("click", async (e) => {

        const eventId = e.target.dataset.eventid;

        try {

          const response = await fetch(`/generate-ticket/${eventId}`);

          if (!response.ok) {

            alert("Failed to generate ticket.");

            return;

          }



          // Get PDF blob and download

          const blob = await response.blob();

          const url = window.URL.createObjectURL(blob);

          const a = document.createElement("a");

          a.href = url;

          a.download = "ticket.pdf";

          a.click();

          window.URL.revokeObjectURL(url);

        } catch (error) {

          console.error("Error generating ticket:", error);

          alert("Error generating your digital ticket.");

        }

      });

    });

  } catch (error) {

    console.error("Failed to load events:", error);

    eventsContainer.innerHTML = "<p>Error loading your events. Please try again later.</p>";

  }

});