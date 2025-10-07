// events.js


// Save event to localStorage
function saveEvent(event) {
 let events = JSON.parse(localStorage.getItem("events")) || [];
 events.push(event);
 localStorage.setItem("events", JSON.stringify(events));
}


// event creation
const createBtn = document.getElementById("create-btn");
if (createBtn) {
 createBtn.addEventListener("click", function () {
   const title = document.getElementById("event-title").value;
   const description = document.getElementById("event-description").value;
   const date = document.getElementById("event-date").value;
   const time = document.getElementById("event-time").value;  
   const location = document.getElementById("event-location").value;
   const capacity = document.getElementById("event-capacity").value;
   const type = document.getElementById("event-type").value;


   if (!title || !date || !time || !location) {
     alert("Please fill in the required fields!");
     return;
   }


   const newEvent = {
     title,
     description,
     date,
     time,  
     location,
     capacity,
     type,
   };


   saveEvent(newEvent);
   alert("Event created successfully!");
   window.location.href = "events.html"; // redirect to events page
 });
}


// load events into events.html
function loadEvents() {
 let events = JSON.parse(localStorage.getItem("events")) || [];
 const eventsList = document.getElementById("events-list");


 if (eventsList) {
   eventsList.innerHTML = "";
   events.forEach((ev) => {
     const card = document.createElement("div");
     card.classList.add("event-card");
     card.innerHTML = `
       <h3>${ev.title}</h3>
       <p><strong>Date:</strong> ${ev.date}</p>
       <p><strong>Time:</strong> ${ev.time}</p>   
       <p><strong>Location:</strong> ${ev.location}</p>
       <p>${ev.description}</p>
       <p><strong>Tickets:</strong> ${ev.capacity} | ${ev.type}</p>
       <button class="signup-btn">Sign Up</button>
     `;
     eventsList.appendChild(card);
   });
 }
}


window.onload = loadEvents;