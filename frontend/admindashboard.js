function showTab(tabId) {
      document.querySelectorAll('.content').forEach(c => c.classList.remove('active'));
      document.querySelectorAll('.tab').forEach(t => t.classList.remove('active'));
      document.getElementById(tabId).classList.add('active');
      event.target.classList.add('active');
    }
    function approveRow(button) {
      let row = button.closest("tr");
      alert("Organizer approved & notified");
      row.remove();
    }
    function rejectRow(button) {
      let row = button.closest("tr");
      alert("Organizer rejected");
      row.remove();
    }