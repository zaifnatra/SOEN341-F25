//Unit Test #1 - Event Creation Date validation
/*Mirror existing manual validaiton*/
const assert = require("assert");
function eventCreationDateIsValid(year, month1to12, day) {
  const d = new Date(year, month1to12 - 1, day); // JS months are 0–11
  return (
    d.getFullYear() === year &&
    d.getMonth() === month1to12 - 1 &&
    d.getDate() === day
  );
}

/*Actual unit test function*/
(function testEventCreationDate() { 
  assert.ok(eventCreationDateIsValid(2025, 10, 31));
  assert.ok(eventCreationDateIsValid(2024, 2, 29)); // leap year sanity
  console.log("testEventCreationDate: PASS");
})();


// Unit Test #2 - Name filter ignores case and extra spaces
/* Helper that mirrors the intended frontend behavior*/
function filterEventsByName(events, rawQuery) {
  const normalizedQuery = rawQuery.trim().toLowerCase();
  if (!normalizedQuery) {
    return events; // nothing typed => return all events
  }

  return events.filter((event) => {
    if (typeof event.name !== "string") return false;
    return event.name.toLowerCase().includes(normalizedQuery);
  });
}

/* Actual unit test function */
(function testFilterEventsByNameCaseAndSpaces() {
  const events = [
    { name: "Engineering Gala" }, // only a representative sample is needed for testing
    { name: "Hackathon Night" },
    { name: "GALA Warmup" },
  ];

  // Baseline search
  const baseline = filterEventsByName(events, "gala");
  const baselineNames = baseline.map((e) => e.name);

  // Same search with extra spaces
  const withSpaces = filterEventsByName(events, "   gala   ");
  const withSpacesNames = withSpaces.map((e) => e.name);

  // Same search with different case
  const differentCase = filterEventsByName(events, "GaLa");
  const differentCaseNames = differentCase.map((e) => e.name);

  // All three should return the same set of event names
  assert.deepStrictEqual(withSpacesNames, baselineNames);
  assert.deepStrictEqual(differentCaseNames, baselineNames);

  // Non-matching query should return empty
  const noMatch = filterEventsByName(events, "concert");
  assert.strictEqual(noMatch.length, 0);

  console.log("testFilterEventsByNameCaseAndSpaces: PASS");
})();


// Unit Test #3 - Combined filters act as intersection (name/category/organization/date)
/* Pure helper for multi-criteria filtering (test-only)*/
function filterEvents(events, filters) {
  const nameQuery = (filters.name || "").trim().toLowerCase();

  return events.filter((event) => {
    // Name filter (substring, case-insensitive)
    if (nameQuery) {
      if (typeof event.name !== "string") return false;
      if (!event.name.toLowerCase().includes(nameQuery)) return false;
    }

    // Category filter (exact match)
    if (filters.category) {
      if (event.category !== filters.category) return false;
    }

    // Organization filter (exact match)
    if (filters.organization) {
      if (event.organization !== filters.organization) return false;
    }

    // Date filter (exact match on simple string)
    if (filters.date) {
      if (event.date !== filters.date) return false;
    }

    return true;
  });
}

/* Actual unit test function */
(function testFilterEventsCombinedFiltersIntersection() {
  const events = [
    {
      name: "Engineering Gala", // representative sample, test will run without these existingi in DB. 
      category: "Social",
      organization: "CS Society",
      date: "2025-10-10",
    },
    {
      name: "Career Fair",
      category: "Career",
      organization: "Career Center",
      date: "2025-10-10",
    },
    {
      name: "Social Hackathon",
      category: "Social",
      organization: "CS Society",
      date: "2025-11-01",
    },
  ];

  // 1) Only category filter => both Social events
  const onlyCategory = filterEvents(events, { category: "Social" });
  assert.strictEqual(onlyCategory.length, 2);

  // 2) Category + organization => still both CS Society Social events
  const categoryAndOrg = filterEvents(events, {
    category: "Social",
    organization: "CS Society",
  });
  assert.strictEqual(categoryAndOrg.length, 2);

  // 3) Category + organization + date + name => exactly one event
  const allFilters = filterEvents(events, {
    name: "gala",                // case-insensitive substring
    category: "Social",
    organization: "CS Society",
    date: "2025-10-10",
  });
  assert.strictEqual(allFilters.length, 1);
  assert.strictEqual(allFilters[0].name, "Engineering Gala");

  // 4) If any filter does not match, event is excluded
  const wrongDate = filterEvents(events, {
    name: "gala",
    category: "Social",
    organization: "CS Society",
    date: "2099-01-01",         // no event on this date
  });
  assert.strictEqual(wrongDate.length, 0);

  console.log("testFilterEventsCombinedFiltersIntersection: PASS");
})();


// Unit Test #4 - Event creation validation (required fields, capacity, date)
/* Pure helper for validating event creation form (test-only) */
function eventFormIsValid(form, currentDateStr) {
  // Normalize strings
  function isBlank(value) {
    return typeof value !== "string" || value.trim() === "";
  }

  // Required fields: name, date, time, location, capacity
  if (isBlank(form.name)) return false;
  if (isBlank(form.date)) return false;
  if (isBlank(form.time)) return false;
  if (isBlank(form.location)) return false;

  // Capacity must be a positive integer
  const capacityNum = Number(form.capacity);
  if (!Number.isInteger(capacityNum) || capacityNum <= 0) return false;

  // Date should not be in the past (ISO string comparison: YYYY-MM-DD)
  // Format bad = invalid.
  if (typeof form.date !== "string" || form.date.length !== 10) return false;
  if (form.date < currentDateStr) return false;

  return true;
}

/* Actual unit test function */
(function testEventFormValidation() {
  const today = "2025-10-10"; // fixed "current date" for deterministic tests

  // 1) Fully valid event
  const validEvent = {
    name: "Engineering Gala",
    date: "2025-10-15",
    time: "18:00",
    location: "Hall Building",
    capacity: 100,
  };
  assert.strictEqual(eventFormIsValid(validEvent, today), true);

  // 2) Missing name
  const missingName = {
    name: "   ",             // blank after trim
    date: "2025-10-15",
    time: "18:00",
    location: "Hall Building",
    capacity: 100,
  };
  assert.strictEqual(eventFormIsValid(missingName, today), false);

  // 3) Zero or negative capacity
  const zeroCapacity = {
    name: "Zero Capacity Event",
    date: "2025-10-15",
    time: "18:00",
    location: "Hall Building",
    capacity: 0,
  };
  assert.strictEqual(eventFormIsValid(zeroCapacity, today), false);

  const negativeCapacity = {
    name: "Negative Capacity Event",
    date: "2025-10-15",
    time: "18:00",
    location: "Hall Building",
    capacity: -5,
  };
  assert.strictEqual(eventFormIsValid(negativeCapacity, today), false);

  // 4) Past date
  const pastEvent = {
    name: "Old Event",
    date: "2025-09-01",
    time: "18:00",
    location: "Hall Building",
    capacity: 50,
  };
  assert.strictEqual(eventFormIsValid(pastEvent, today), false);

  // 5) Missing location
  const missingLocation = {
    name: "No Location Event",
    date: "2025-10-15",
    time: "18:00",
    location: "   ",         // blank after trim
    capacity: 50,
  };
  assert.strictEqual(eventFormIsValid(missingLocation, today), false);

  console.log("testEventFormValidation: PASS");
})();


