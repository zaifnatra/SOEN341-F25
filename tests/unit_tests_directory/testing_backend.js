// Import Node's assert module for testing
const assert = require("assert");

// Unit Test #5 - Ticket claim fails when event is sold out (Student)
/* Pure helper to simulate a simple ticket claim on the backend */
function claimTicketIfAvailable(eventState) {
  if (eventState.remainingTickets <= 0) {
    // Sold out: do not change anything
    return {
      success: false,
      remainingTickets: eventState.remainingTickets,
    };
  }

  // Ticket can be claimed: decrement remainingTickets by 1
  return {
    success: true,
    remainingTickets: eventState.remainingTickets - 1,
  };
}

/* Actual unit test function */
(function testTicketClaimFailsWhenSoldOut() {
  // Sold-out event
  const soldOutEvent = {
    capacity: 100,
    remainingTickets: 0,
  };

  const soldOutResult = claimTicketIfAvailable(soldOutEvent);

  // Must fail and not change remainingTickets
  assert.strictEqual(soldOutResult.success, false);
  assert.strictEqual(soldOutResult.remainingTickets, 0);

  // Event that still has tickets left
  const almostSoldOutEvent = {
    capacity: 100,
    remainingTickets: 1,
  };

  const claimResult = claimTicketIfAvailable(almostSoldOutEvent);

  // Must succeed and decrement remainingTickets by 1
  assert.strictEqual(claimResult.success, true);
  assert.strictEqual(claimResult.remainingTickets, 0);

  console.log("testTicketClaimFailsWhenSoldOut: PASS");
})();


// Unit Test #6 - New event initializes capacity, remainingTickets, and QR codes (Organizer)
/* Pure helper to simulate backend event creation */
function createNewEvent(payload, organizerName) {
  const capacityNum = Number(payload.capacity);

  return {
    name: payload.name,
    date: payload.date,
    time: payload.time,
    location: payload.location,
    capacity: capacityNum,
    remainingTickets: capacityNum,
    organizer: organizerName,
    // simple QR structure for the test
    qrCodes: Array.from({ length: capacityNum }, (_, index) => ({
      code: `QR-${index + 1}`,
      scanned: false,
    })),
  };
}

/* Actual unit test function */
(function testNewEventInitialization() {
  const payload = {
    name: "Engineering Gala",
    date: "2025-10-15",
    time: "18:00",
    location: "Hall Building",
    capacity: 3,
  };

  const organizerName = "Test Organizer";
  const event = createNewEvent(payload, organizerName);

  // Field mapping
  assert.strictEqual(event.name, payload.name);
  assert.strictEqual(event.date, payload.date);
  assert.strictEqual(event.time, payload.time);
  assert.strictEqual(event.location, payload.location);
  assert.strictEqual(event.organizer, organizerName);

  // Capacity and remainingTickets
  assert.strictEqual(event.capacity, 3);
  assert.strictEqual(event.remainingTickets, 3);

  // QR codes initialization
  assert.ok(Array.isArray(event.qrCodes));
  assert.strictEqual(event.qrCodes.length, 3);

  event.qrCodes.forEach((qr, index) => {
    assert.strictEqual(qr.scanned, false);
    // Ensure each code is non-empty
    assert.ok(typeof qr.code === "string");
    assert.notStrictEqual(qr.code.trim(), "");
  });

  console.log("testNewEventInitialization: PASS");
})();


// Unit Test #7 - Ticket claim: no duplicates and correct counts (Organizer)
/* Helper to simulate backend ticket-claim logic */
function claimTicketOnce(state, userId) {
  // If user already has a ticket, reject
  if (state.tickets.some((t) => t.userId === userId)) {
    return {
      success: false,
      message: "Duplicate claim",
      ticketsIssued: state.ticketsIssued,
      remainingTickets: state.remainingTickets,
    };
  }

  // If sold out, reject
  if (state.remainingTickets <= 0) {
    return {
      success: false,
      message: "Sold out",
      ticketsIssued: state.ticketsIssued,
      remainingTickets: state.remainingTickets,
    };
  }

  // Otherwise, issue new ticket
  const newTicket = { userId: userId, scanned: false };
  const newTickets = [...state.tickets, newTicket];

  return {
    success: true,
    message: "Ticket claimed",
    tickets: newTickets,
    ticketsIssued: state.ticketsIssued + 1,
    remainingTickets: state.remainingTickets - 1,
  };
}

/* Actual unit test function */
(function testTicketClaimNoDuplicatesAndCounts() {
  const initialState = {
    tickets: [],
    ticketsIssued: 0,
    remainingTickets: 2,
  };

  // First claim by user "U1" should succeed
  const firstClaim = claimTicketOnce(initialState, "U1");
  assert.strictEqual(firstClaim.success, true);
  assert.strictEqual(firstClaim.ticketsIssued, 1);
  assert.strictEqual(firstClaim.remainingTickets, 1);
  assert.strictEqual(firstClaim.tickets.length, 1);

  // Second claim by same user "U1" should fail (duplicate)
  const secondClaim = claimTicketOnce(
    {
      tickets: firstClaim.tickets,
      ticketsIssued: firstClaim.ticketsIssued,
      remainingTickets: firstClaim.remainingTickets,
    },
    "U1"
  );
  assert.strictEqual(secondClaim.success, false);
  assert.strictEqual(secondClaim.message, "Duplicate claim");
  assert.strictEqual(secondClaim.ticketsIssued, 1);
  assert.strictEqual(secondClaim.remainingTickets, 1);

  // Another user "U2" should succeed
  const thirdClaim = claimTicketOnce(
    {
      tickets: firstClaim.tickets,
      ticketsIssued: firstClaim.ticketsIssued,
      remainingTickets: firstClaim.remainingTickets,
    },
    "U2"
  );
  assert.strictEqual(thirdClaim.success, true);
  assert.strictEqual(thirdClaim.ticketsIssued, 2);
  assert.strictEqual(thirdClaim.remainingTickets, 0);

  // Sold-out state should reject any further claim
  const soldOutClaim = claimTicketOnce(
    {
      tickets: thirdClaim.tickets,
      ticketsIssued: thirdClaim.ticketsIssued,
      remainingTickets: thirdClaim.remainingTickets,
    },
    "U3"
  );
  assert.strictEqual(soldOutClaim.success, false);
  assert.strictEqual(soldOutClaim.message, "Sold out");

  console.log("testTicketClaimNoDuplicatesAndCounts: PASS");
})();


// Unit Test #8 - Analytics invariants per event (Admin)
/* Helper to check analytics invariants */
function analyticsInvariantsHold(stats) {
  const capacity = Number(stats.capacity);
  const ticketsIssued = Number(stats.ticketsIssued);
  const attendance = Number(stats.attendance);

  // Basic non-negative checks
  if (capacity < 0 || ticketsIssued < 0 || attendance < 0) return false;

  // TicketsIssued <= Capacity
  if (ticketsIssued > capacity) return false;

  // Attendance <= TicketsIssued
  if (attendance > ticketsIssued) return false;

  // RemainingCapacity = Capacity - TicketsIssued >= 0
  const remainingCapacity = capacity - ticketsIssued;
  if (remainingCapacity < 0) return false;

  return true;
}

/* Actual unit test function */
(function testAnalyticsInvariants() {
  // 1) Valid stats
  const validStats = {
    capacity: 100, // reminder: testing values only. Not from DB.
    ticketsIssued: 80,
    attendance: 50,
  };
  assert.strictEqual(analyticsInvariantsHold(validStats), true);

  // 2) TicketsIssued > Capacity (invalid)
  const tooManyTickets = {
    capacity: 100,
    ticketsIssued: 120,
    attendance: 50,
  };
  assert.strictEqual(analyticsInvariantsHold(tooManyTickets), false);

  // 3) Attendance > TicketsIssued (invalid)
  const tooMuchAttendance = {
    capacity: 100,
    ticketsIssued: 60,
    attendance: 70,
  };
  assert.strictEqual(analyticsInvariantsHold(tooMuchAttendance), false);

  // 4) Negative remaining capacity
  const negativeRemaining = {
    capacity: 50,
    ticketsIssued: 60,
    attendance: 40,
  };
  assert.strictEqual(analyticsInvariantsHold(negativeRemaining), false);

  console.log("testAnalyticsInvariants: PASS");
})();


// Unit Test #9 - Ticket validation rejects already scanned tickets (Admin)
/* Helper simulating backend QR validation logic */
function validateTicket(event, qrCode) {
  const ticket = event.qrCodes.find((t) => t.code === qrCode);

  if (!ticket) {
    return { success: false, message: "Invalid QR code" };
  }

  if (ticket.scanned) {
    return { success: false, message: "Ticket already scanned" };
  }

  // Mark as scanned and increase attendance
  ticket.scanned = true;
  event.attendance += 1;
  return { success: true, message: "Ticket valid" };
}

/* Actual unit test function */
(function testTicketValidationRejectsScanned() {
  // Fake event setup
  const event = {
    name: "Engineering Gala",
    capacity: 3,
    attendance: 0,
    qrCodes: [
      { code: "QR-1", scanned: false },
      { code: "QR-2", scanned: false },
      { code: "QR-3", scanned: false },
    ],
  };

  // First scan should succeed
  const firstScan = validateTicket(event, "QR-1");
  assert.strictEqual(firstScan.success, true);
  assert.strictEqual(firstScan.message, "Ticket valid");
  assert.strictEqual(event.qrCodes[0].scanned, true);
  assert.strictEqual(event.attendance, 1);

  // Second scan of same ticket should fail
  const secondScan = validateTicket(event, "QR-1");
  assert.strictEqual(secondScan.success, false);
  assert.strictEqual(secondScan.message, "Ticket already scanned");
  assert.strictEqual(event.attendance, 1); // attendance unchanged

  // Nonexistent QR code
  const invalidScan = validateTicket(event, "QR-999");
  assert.strictEqual(invalidScan.success, false);
  assert.strictEqual(invalidScan.message, "Invalid QR code");
  assert.strictEqual(event.attendance, 1);

  console.log("testTicketValidationRejectsScanned: PASS");
})();


// Unit Test #10 and #11 - Recommendations (personalized + default)
/* Helper simulating backend recommendation logic */
function recommendEvents(user, events, currentDateStr) {
  const hasInterests =
    Array.isArray(user.interests) && user.interests.length > 0;
  const hasFavorites =
    Array.isArray(user.favoriteEventIds) && user.favoriteEventIds.length > 0;

  // Personalized branch: use interests and favorites
  if (hasInterests || hasFavorites) {
    return events.filter((event) => {
      const matchInterest =
        hasInterests && user.interests.includes(event.category);
      const matchFavorite =
        hasFavorites && user.favoriteEventIds.includes(event.id);
      return matchInterest || matchFavorite;
    });
  }

  // Default branch: upcoming events only (date >= currentDateStr)
  return events.filter((event) => event.date >= currentDateStr);
}

/* Personalized recommendations respect user interests/history */
(function testPersonalizedRecommendationsUseInterestsAndHistory() {
  const user = {
    interests: ["Social"],
    favoriteEventIds: [2],
  };

  const events = [
    {
      id: 1,
      name: "Engineering Gala",
      category: "Social",
      date: "2025-10-10",
    },
    {
      id: 2,
      name: "Career Fair",
      category: "Career",
      date: "2025-10-12",
    },
    {
      id: 3,
      name: "Math Talk",
      category: "Academic",
      date: "2025-10-15",
    },
  ];

  const recs = recommendEvents(user, events, "2025-10-01");
  const recIds = recs.map((e) => e.id);

  // Should recommend:
  // - Social events (id 1) via interests
  // - Favorite event (id 2) via history
  assert.strictEqual(recs.length, 2);
  assert.ok(recIds.includes(1));
  assert.ok(recIds.includes(2));

  // Every recommended event must either match an interest or be a favorite
  recs.forEach((event) => {
    const matchInterest = user.interests.includes(event.category);
    const matchFavorite = user.favoriteEventIds.includes(event.id);
    assert.ok(matchInterest || matchFavorite);
  });

  console.log(
    "testPersonalizedRecommendationsUseInterestsAndHistory: PASS"
  );
})();

/* New user gets default upcoming/trending events */
(function testDefaultRecommendationsForNewUser() {
  const newUser = {
    interests: [],
    favoriteEventIds: [],
  };

  const events = [
    {
      id: 1,
      name: "Past Event",
      category: "Social",
      date: "2025-09-01",
    },
    {
      id: 2,
      name: "Upcoming Social",
      category: "Social",
      date: "2025-10-15",
    },
    {
      id: 3,
      name: "Upcoming Academic",
      category: "Academic",
      date: "2025-11-01",
    },
  ];

  const currentDate = "2025-10-10";
  const recs = recommendEvents(newUser, events, currentDate);

  // Should only return events on or after currentDate
  assert.strictEqual(recs.length, 2);
  recs.forEach((event) => {
    assert.ok(event.date >= currentDate);
  });

  console.log("testDefaultRecommendationsForNewUser: PASS");
})();
