
function showMessage(text, color = "#28a745", duration = 3000) {
  const msg = document.createElement("div");
  msg.textContent = text;
  msg.style.position = "fixed";
  msg.style.top = "20px";
  msg.style.left = "50%";
  msg.style.transform = "translateX(-50%)";
  msg.style.background = color;
  msg.style.color = "white";
  msg.style.padding = "10px 25px";
  msg.style.borderRadius = "8px";
  msg.style.fontWeight = "bold";
  msg.style.boxShadow = "0 4px 8px rgba(0,0,0,0.2)";
  msg.style.zIndex = "1000";
  msg.style.transition = "opacity 0.3s ease";
  document.body.appendChild(msg);

  setTimeout(() => {
    msg.style.opacity = "0";
    setTimeout(() => msg.remove(), 300);
  }, duration);
}

window.addEventListener("DOMContentLoaded", () => {
  const params = new URLSearchParams(window.location.search);
  const title = params.get("title") || "Unknown Event";
  const date = params.get("date") || "TBA";
  const price = params.get("price") || "0.00";

  document.getElementById("eventName").textContent = title;
  document.getElementById("eventDate").textContent = date;
  document.getElementById("eventPrice").textContent = price;
});

document.getElementById("paymentForm").addEventListener("submit", async (e) => {
  e.preventDefault();

  const name = document.getElementById("name").value.trim();
  const cardNumber = document.getElementById("cardNumber").value.replace(/\s+/g, "");
  const expiry = document.getElementById("expiry").value.trim();
  const cvv = document.getElementById("cvv").value.trim();
  const params = new URLSearchParams(window.location.search);
  const eventId = params.get("eventId");

 
  if (!/^[A-Za-z]+ [A-Za-z]+$/.test(name)) {
    showMessage("Please enter your full name (first and last).", "#d9534f");
    return;
  }

  if (!/^\d{16}$/.test(cardNumber)) {
    showMessage("Card number must be 16 digits (no spaces or negatives).", "#d9534f");
    return;
  }

  if (!/^(0[1-9]|1[0-2])\/\d{2}$/.test(expiry)) {
    showMessage("Expiry date must be in MM/YY format.", "#d9534f");
    return;
  }

  const [month, year] = expiry.split("/").map(Number);
  const currentDate = new Date();
  const currentMonth = currentDate.getMonth() + 1;
  const currentYear = currentDate.getFullYear() % 100;

  if (year < currentYear || (year === currentYear && month < currentMonth)) {
    showMessage("Card has expired. Please use a valid card.", "#d9534f");
    return;
  }

  if (!/^\d{3}$/.test(cvv)) {
    showMessage("CVV must be exactly 3 digits.", "#d9534f");
    return;
  }

  if (!eventId) {
    showMessage("Missing event ID.", "#d9534f");
    return;
  }

  showMessage("Processing payment...", "#0275d8", 1500);
  const paymentSuccess = true; // simulate payment

  if (paymentSuccess) {
    try {
      const res = await fetch("/signup-event", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ eventId })
      });

      const data = await res.json();
      if (res.ok && data.success) {
        showMessage("✅ Payment successful! Event added to My Events.", "#28a745", 1500);
        setTimeout(() => {
          window.location.href = "MyEvents.html";
        }, 1500);
      } else {
        showMessage(data.message || "Error adding event.", "#d9534f");
      }
    } catch (err) {
      console.error("Error adding paid event:", err);
      showMessage("Payment succeeded, but registration failed.", "#f0ad4e");
    }
  } else {
    showMessage("Payment failed. Please try again.", "#d9534f");
  }
});

document.getElementById("cardNumber").addEventListener("input", (e) => {
  let value = e.target.value.replace(/\D/g, "").substring(0, 16);
  e.target.value = value.replace(/(.{4})/g, "$1 ").trim();
});
