
    //Block Past Dates
    const selectedDate = new Date(date);
    const today = new Date();
    today.setHours(0, 0, 0, 0);
    if (selectedDate < today) {
    alert("⚠️ You cannot select a past date for the event!");
    return;
    }

