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