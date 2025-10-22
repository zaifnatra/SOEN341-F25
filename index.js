const express = require('express');
require('dotenv').config();
const path = require('path');
const session = require('express-session');
const bodyParser = require('body-parser');
const { MongoClient, ServerApiVersion } = require('mongodb');
const QRCode = require('qrcode'); //DUMMY QR CODE
const archiver = require("archiver");
const { ObjectId } = require("mongodb");
const { Buffer } = require("buffer");
const PDFDocument = require('pdfkit');

// Directory where QR codes are saved
const QR_CODES_DIR = path.join(__dirname, "qrcodes");
const app = express();

// Middleware
app.use(bodyParser.urlencoded({ extended: true }));
app.use(express.json());

app.use(session({
  secret: process.env.SESSION_SECRET,
  resave: false,
  saveUninitialized: true,
  cookie: { secure: false }
}));

// Serve static frontend files
app.use(express.static(path.join(__dirname, 'frontend')));

// MongoDB connection
const uri = process.env.MONGO_URI;
const client = new MongoClient(uri, {
  serverApi: {
    version: ServerApiVersion.v1,
    strict: true,
    deprecationErrors: true
  }
});

let usersCollection;
let eventsCollection;

async function connectToMongo() {
  try {
    await client.connect();
    const db = client.db("CampusTicketing");
    usersCollection = db.collection("users");
    eventsCollection = db.collection("events");
    console.log("Connected to MongoDB");

    const existingUsers = await usersCollection.find().toArray();
    console.log(`${existingUsers.length} user(s) currently in the database.`);
  } catch (error) {
    console.error("MongoDB connection error:", error);
  }
}
connectToMongo();

/* ---------------- MAIN ROUTES ---------------- */

app.get('/', (req, res) => {
  res.sendFile(path.join(__dirname, 'frontend', 'index.html'));
});

app.get('/signin', (req, res) => {
  res.sendFile(path.join(__dirname, 'frontend', 'signin.html'));
});

/* ---------------- USER ROUTES ---------------- */

app.post('/createAccount', async (req, res) => {
  const { email, username, password } = req.body;
  try {
    const existing = await usersCollection.findOne({ email });
    if (existing) {
      return res.send("Email already exists.");
    }

    const newUser = { email, username, password, role: "student" };
    await usersCollection.insertOne(newUser);
    console.log("New User created:", newUser);

    res.redirect('/signin.html');
  } catch (error) {
    console.error("Error creating user:", error);
    res.status(500).send("Error creating account.");
  }
});

app.post('/login', async (req, res) => {
  const { username, password } = req.body;
  try {
    const user = await usersCollection.findOne({ username, password });
    if (!user) {
      return res.json({ success: false, message: "Invalid username or password." });
    }

    req.session.user = {
      id: user._id,
      email: user.email,
      username: user.username,
      role: user.role || "student" //default role is student
    };

    res.json({ success: true });
  } catch (error) {
    console.error("Error logging in:", error);
    res.status(500).json({ success: false, message: "Server error." });
  }
});

app.get('/logout', (req, res) => {
  req.session.logoutMessage = "You have been logged out.";
  req.session.user = null;
  req.session.destroy(() => {
    res.redirect('/signin.html');
  });
});

app.get('/session-status', (req, res) => {
  const loggedIn = !!req.session.user;
  const logoutMessage = req.session.logoutMessage || null;
  req.session.logoutMessage = null;
  res.json({ loggedIn, logoutMessage });
});

app.get('/main.html', (req, res) => {
  if (!req.session.user) {
    return res.redirect('/signin.html');
  }
  res.sendFile(path.join(__dirname, 'frontend', 'main.html'));
});

app.get('/listUsers', async (req, res) => {
  try {
    const users = await usersCollection.find().toArray();
    console.log(" Existing users in MongoDB:");
    console.log(users);
    res.send(`Check the terminal — found ${users.length} user(s).`);
  } catch (error) {
    console.error("Error retrieving users:", error);
    res.status(500).send("Error retrieving users.");
  }
});

app.get('/user-profile', (req, res) => {
  if (req.session && req.session.user) {
    // Only send safe fields
    const { username, email, role } = req.session.user;
    res.json({ username, email, role });
  } else {
    res.status(401).json({ error: "Not logged in" });
  }
});

// Middleware to protect pages that require login
function requireLogin(req, res, next) {
  if (!req.session.user) {
    return res.redirect('/signin.html');
  }
  next();
}

// Protected pages (must be logged in)
app.get('/account', requireLogin, (req, res) => {
  res.sendFile(path.join(__dirname, 'frontend', 'account.html'));
});

app.get('/eventspage', requireLogin, (req, res) => {
  res.sendFile(path.join(__dirname, 'frontend', 'events.html'));
});

app.get('/admindashboard', requireLogin, (req, res) => {
  res.sendFile(path.join(__dirname, 'frontend', 'admindashboard.html'));
});

app.post('/request-organizer', async (req, res) => {
  if (!req.session.user) {
    return res.status(401).json({ message: "Not logged in" });
  }

  const { requests } = req.body; // array of { type, eventId }
  const userId = req.session.user.id;

  if (!requests || !Array.isArray(requests) || requests.length === 0) {
    return res.status(400).json({ message: "No requests provided." });
  }

  try {
    const user = await usersCollection.findOne({ _id: new ObjectId(userId) });

    if (!user.organizerRequests) {
      user.organizerRequests = [];
    }

    // Add each request as a separate entry
    requests.forEach(reqItem => {
      user.organizerRequests.push({
        type: reqItem.type,
        eventId: reqItem.eventId || null,
        status: "pending",
        submittedAt: new Date()
      });
    });

    await usersCollection.updateOne(
      { _id: new ObjectId(userId) },
      { $set: { organizerRequests: user.organizerRequests } }
    );

    res.json({ message: "Organizer requests submitted!" });
  } catch (err) {
    console.error(err);
    res.status(500).json({ message: "Server error submitting requests" });
  }
});


app.get('/pending-organizers', async (req, res) => {
  try {
    // Flatten each request into individual objects for admin dashboard
    const users = await usersCollection.find({ "organizerRequests.status": "pending" }).toArray();
    const pendingRequests = [];

    users.forEach(user => {
      if (Array.isArray(user.organizerRequests)) {
        user.organizerRequests.forEach(reqItem => {
          if (reqItem.status === "pending") {
            pendingRequests.push({
              userId: user._id,
              username: user.username,
              email: user.email,
              type: reqItem.type,
              eventId: reqItem.eventId,
              submittedAt: reqItem.submittedAt
            });
          }
        });
      }
    });

    res.json(pendingRequests);
  } catch (err) {
    console.error(err);
    res.status(500).json({ message: "Error retrieving pending requests" });
  }
});


app.post('/approve-organizer', async (req, res) => {
  const { userId, eventId } = req.body; // eventId identifies which request to approve
  try {
    const user = await usersCollection.findOne({ _id: new ObjectId(userId) });
    if (!user || !user.organizerRequests) {
      return res.status(404).json({ message: "Request not found" });
    }

    const requestIndex = user.organizerRequests.findIndex(r =>
      r.status === "pending" && r.eventId === (eventId || null)
    );

    if (requestIndex === -1) return res.status(404).json({ message: "Request not found" });

    const request = user.organizerRequests[requestIndex];

    // Update role
    const newRole = "organizer";
    await usersCollection.updateOne(
      { _id: new ObjectId(userId) },
      {
        $set: {
          role: newRole,
          [`organizerRequests.${requestIndex}.status`]: "approved"
        }
      }
    );

    // If it's linked to an existing event, update event organizers
    if (request.type === "existing" && request.eventId) {
      const event = await eventsCollection.findOne({ _id: new ObjectId(request.eventId) });
      if (event) {
        let updatedOrganizers = [];
        if (typeof event.organizer === "string") updatedOrganizers = [event.organizer, user.email];
        else if (Array.isArray(event.organizer)) updatedOrganizers = [...new Set([...event.organizer, user.email])];
        else updatedOrganizers = [user.email];

        await eventsCollection.updateOne(
          { _id: new ObjectId(request.eventId) },
          { $set: { organizer: updatedOrganizers } }
        );
      }
    }

    res.json({ message: "Approved" });
  } catch (err) {
    console.error(err);
    res.status(500).json({ message: "Approval failed" });
  }
});


app.post('/reject-organizer', async (req, res) => {
  const { userId, eventId } = req.body;
  try {
    const user = await usersCollection.findOne({ _id: new ObjectId(userId) });
    if (!user || !user.organizerRequests) return res.status(404).json({ message: "Request not found" });

    const requestIndex = user.organizerRequests.findIndex(r =>
      r.status === "pending" && r.eventId === (eventId || null)
    );
    if (requestIndex === -1) return res.status(404).json({ message: "Request not found" });

    await usersCollection.updateOne(
      { _id: new ObjectId(userId) },
      { $set: { [`organizerRequests.${requestIndex}.status`]: "rejected" } }
    );

    res.json({ message: "Rejected" });
  } catch (err) {
    console.error(err);
    res.status(500).json({ message: "Rejection failed" });
  }
});



/* ---------------- EVENT ROUTES ---------------- */

app.post('/createEvent', async (req, res) => {
  const { title, description, date, time, location, capacity, type } = req.body;

  if (!title || !date || !time || !location) {
    return res.status(400).json({ message: "Missing required fields." });
  }

  try {
    // Ensure only logged-in users can create events
    if (!req.session.user) {
      return res.status(403).json({ message: "You must be logged in to create events." });
    }

    const organizer = req.session.user.email || req.session.user.username;

    const existing = await eventsCollection.findOne({ title });
    if (existing) {
      return res.status(400).json({ message: "Event title already exists." });
    }

    // Generate dynamic QR codes
    const qrCodes = [];
    for (let i = 1; i <= capacity; i++) {
      const qrData = `${title} - ${i}/${capacity}`;
      const qrImage = await QRCode.toDataURL(qrData);
      qrCodes.push({ code: qrData, image: qrImage, scanned: false });
    }

    const newEvent = {
      title,
      organizer: [organizer],
      description,
      date,
      time,
      location,
      capacity: parseInt(capacity),
      type,
      qrCodes,
      scannedTickets: 0,
      attendanceRate: 0,
      remainingTickets: parseInt(capacity)
    };

    const insertResult = await eventsCollection.insertOne(newEvent);
    console.log("New event added:", newEvent);

    res.status(201).json({ message: "Event created successfully!" });
  } catch (error) {
    console.error("Error creating event:", error);
    res.status(500).json({ message: "Server error creating event." });
  }
});


app.get('/events', async (req, res) => {
  try {
    const events = await eventsCollection.find().toArray();
    console.log("Returning events:", events.length);
    res.json(events);
  } catch (error) {
    console.error("Error fetching events:", error);
    res.status(500).json({ message: "Error retrieving events." });
  }
});

// Delete an event (admin only)
app.delete("/delete-event/:eventId", async (req, res) => {
  try {
    if (!req.session.user || req.session.user.role !== "admin") {
      return res.status(403).json({ message: "Unauthorized: admin only." });
    }

    const eventId = req.params.eventId;
    if (!ObjectId.isValid(eventId)) {
      return res.status(400).json({ message: "Invalid event ID." });
    }

    const result = await eventsCollection.deleteOne({ _id: new ObjectId(eventId) });

    if (result.deletedCount === 0) {
      return res.status(404).json({ message: "Event not found." });
    }

    res.json({ message: "Event deleted successfully." });
  } catch (error) {
    console.error("Error deleting event:", error);
    res.status(500).json({ message: "Server error deleting event." });
  }
});


app.get('/my-events', requireLogin, async (req, res) => {
  try {
    const organizerEmail = req.session.user.email;
    const myEvents = await eventsCollection
      .find({ organizer: { $in: [organizerEmail] } })
      .project({
        title: 1,
        date: 1,
        location: 1,
        qrCodes: { code: 1, image: 1, scanned: 1 }
      })
      .toArray();

    res.json(myEvents);
  } catch (error) {
    console.error("Error fetching organizer events:", error);
    res.status(500).json({ message: "Error fetching your events." });
  }
});

app.get("/download-qrcodes/:eventId", async (req, res) => {
  try {
    const eventId = req.params.eventId.trim();
    console.log("[QR DOWNLOAD] Requested for eventId:", eventId);

    if (!ObjectId.isValid(eventId)) {
      return res.status(400).send("Invalid event ID.");
    }

    const event = await eventsCollection.findOne({ _id: new ObjectId(eventId) });
    if (!event) {
      return res.status(404).send("Event not found.");
    }

    const qrCodes = event.qrCodes || [];
    if (qrCodes.length === 0) {
      return res.status(404).send("No QR codes available for this event.");
    }

    // Prepare ZIP
    const zipFileName = `${event.title.replace(/\s+/g, "_")}_QRCodes.zip`;
    res.setHeader("Content-Disposition", `attachment; filename=${zipFileName}`);
    res.setHeader("Content-Type", "application/zip");

    const archive = archiver("zip", { zlib: { level: 9 } });
    archive.pipe(res);

    qrCodes.forEach((qr, index) => {
      // qr.image is a base64 Data URL: "data:image/png;base64,..."
      const base64Data = qr.image.split(",")[1];
      const buffer = Buffer.from(base64Data, "base64");
      const fileName = `${event.title.replace(/\s+/g, "_")}_ticket_${index + 1}.png`;
      archive.append(buffer, { name: fileName });
    });

    archive.finalize();
  } catch (err) {
    console.error("[QR DOWNLOAD ERROR]", err);
    res.status(500).send("Failed to prepare QR codes ZIP.");
  }
});

app.post('/validate-ticket', async (req, res) => {
  try {
    const { qrData } = req.body; // text from decoded QR
    if (!qrData) {
      return res.status(400).json({ valid: false, message: "No QR data provided." });
    }

    // Find the event that contains this QR code
    const event = await eventsCollection.findOne({ 
      "qrCodes.code": qrData 
    });

    if (!event) {
      return res.json({ valid: false, message: "Ticket not found." });
    }

    // Find the specific ticket in array
    const ticket = event.qrCodes.find(q => q.code === qrData);

    if (ticket.scanned) {
      return res.json({ valid: false, message: "Ticket has already been used." });
    }
    
        // Mark QR as scanned
    await eventsCollection.updateOne(
      { _id: new ObjectId(event._id), "qrCodes.code": qrData },
      { $set: { "qrCodes.$.scanned": true } }
    );
        // Increment scannedTickets count
    const updatedScannedCount = (event.scannedTickets || 0) + 1;
    const newRemaining = event.capacity - updatedScannedCount;
    const newAttendanceRate = (updatedScannedCount / event.capacity) * 100;

    await eventsCollection.updateOne(
      { _id: new ObjectId(event._id) },
      {
        $set: {
          scannedTickets: updatedScannedCount,
          remainingTickets: newRemaining,
          attendanceRate: newAttendanceRate
        }
      }
    );

    res.json({
      valid: true,
      message: "Ticket is valid.",
      eventTitle: event.title
    });

  } catch (error) {
    console.error("Error validating ticket:", error);
    res.status(500).json({ valid: false, message: "Server error during validation." });
  }
});

//express route for organizer dashboard
app.get('/organizerdashboard', requireLogin, (req, res) => {
  res.sendFile(path.join(__dirname, 'frontend', 'organizerdashboard.html'));
});


/* ---------------- ADMIN USER MANAGEMENT ---------------- */

// Fetch all users (for the Organizations tab)
app.get("/all-users", async (req, res) => {
  try {
    const users = await usersCollection.find({}, { projection: { password: 0 } }).toArray(); // hide passwords
    res.json(users);
  } catch (error) {
    console.error("Error fetching users:", error);
    res.status(500).json({ message: "Error retrieving users." });
  }
});

// Delete a specific user by ID
app.delete("/delete-user/:userId", async (req, res) => {
  try {
    const userId = req.params.userId;
    const result = await usersCollection.deleteOne({ _id: new ObjectId(userId) });

    if (result.deletedCount === 1) {
      res.json({ success: true, message: "User deleted successfully." });
    } else {
      res.status(404).json({ success: false, message: "User not found." });
    }
  } catch (error) {
    console.error("Error deleting user:", error);
    res.status(500).json({ success: false, message: "Error deleting user." });
  }
});

/* ---------------- STUDENT EVENT MANAGEMENT ---------------- */
// Student signs up for an event
app.post('/signup-event', requireLogin, async (req, res) => {
  try {
    const { eventId } = req.body;
    const userEmail = req.session.user.email;

    if (!eventId) {
      return res.status(400).json({ success: false, message: "Missing event ID." });
    }

    const event = await eventsCollection.findOne({ _id: new ObjectId(eventId) });
    if (!event) {
      return res.status(404).json({ success: false, message: "Event not found." });
    }

    // Check if event still has space
    if (event.remainingTickets <= 0) {
      return res.status(400).json({ success: false, message: "Event is full." });
    }

    // Prevent duplicate signups
    const user = await usersCollection.findOne({ email: userEmail });
    const myEvents = user.myEvents || [];
    if (myEvents.includes(eventId)) {
      return res.status(400).json({ success: false, message: "You already signed up for this event." });
    }

    // Find an unused QR code (scanned = false and not assigned)
    const availableQr = event.qrCodes.find(q => !q.assignedTo && !q.scanned);
    if (!availableQr) {
      return res.status(400).json({ success: false, message: "No available QR codes." });
    }

    // Mark QR as assigned to this user
    await eventsCollection.updateOne(
      { _id: new ObjectId(eventId), "qrCodes.code": availableQr.code },
      { $set: { "qrCodes.$.assignedTo": userEmail } }
    );

    // Add event to user's list
    await usersCollection.updateOne(
      { email: userEmail },
      {
        $addToSet: { myEvents: eventId },
        $push: { assignedTickets: { eventId, qrCode: availableQr.code } }
      }
    );

    // Update remaining tickets
    await eventsCollection.updateOne(
      { _id: new ObjectId(eventId) },
      { $inc: { remainingTickets: -1 } }
    );

    res.json({ success: true, message: `Signed up for ${event.title}`, qrCode: availableQr.code });
  } catch (error) {
    console.error("Error signing up for event:", error);
    res.status(500).json({ success: false, message: "Server error signing up for event." });
  }
});
// Get all events a logged-in user signed up for
app.get('/my-signedup-events', requireLogin, async (req, res) => {
  try {
    const userEmail = req.session.user.email;

    // Get user's signed-up event IDs
    const user = await usersCollection.findOne({ email: userEmail });
    if (!user || !user.myEvents || user.myEvents.length === 0) {
      return res.json([]);
    }

    // Fetch event details for each ID
    const eventIds = user.myEvents.map(id => new ObjectId(id));
    const events = await eventsCollection
      .find({ _id: { $in: eventIds } })
      .project({
        title: 1,
        date: 1,
        time: 1,
        location: 1,
        description: 1,
        type: 1
      })
      .toArray();

    res.json(events);
  } catch (error) {
    console.error("Error fetching signed-up events:", error);
    res.status(500).json({ message: "Error fetching your events." });
  }
});

// Remove signed-up event
app.post('/remove-signedup-event', requireLogin, async (req, res) => {
  try {
    const { eventId } = req.body;
    const userEmail = req.session.user.email;

    if (!eventId) {
      return res.status(400).json({ success: false, message: "Missing event ID." });
    }

    const user = await usersCollection.findOne({ email: userEmail });
    if (!user || !user.myEvents || !user.myEvents.includes(eventId)) {
      return res.status(404).json({ success: false, message: "Event not found in your list." });
    }

    // Remove event from user's myEvents
    await usersCollection.updateOne(
      { email: userEmail },
      { $pull: { myEvents: eventId } }
    );

    // Increment the remaining tickets for the event
    await eventsCollection.updateOne(
      { _id: new ObjectId(eventId) },
      { $inc: { remainingTickets: 1 } }
    );

    res.json({ success: true, message: "Successfully removed from your events." });
  } catch (error) {
    console.error("Error removing event:", error);
    res.status(500).json({ success: false, message: "Server error." });
  }
});

app.get('/generate-ticket/:eventId', async (req, res) => {
  try {
    const eventId = req.params.eventId.trim();
    const userEmail = req.session.user?.email || "unknown@concordia.ca";

    const event = await eventsCollection.findOne({ _id: new ObjectId(eventId) });
    if (!event) return res.status(404).send('Event not found');

    // Find the QR code assigned to this user
    const assignedQr = event.qrCodes.find(q => q.assignedTo === userEmail);
    if (!assignedQr) {
      return res.status(400).send("No ticket found for this user.");
    }

    const qrCodeDataUrl = assignedQr.image;

    const doc = new PDFDocument({ size: "A4", margin: 50 });
    res.setHeader("Content-Type", "application/pdf");
    res.setHeader("Content-Disposition", `attachment; filename="ticket_${event.title}.pdf"`);
    doc.pipe(res);

    doc.fontSize(22).text("Concordia University Campus Event Ticket", { align: "center" });
    doc.moveDown(1.5);

    doc.fontSize(16).text(`Event: ${event.title}`);
    doc.text(`Date: ${event.date}`);
    doc.text(`Location: ${event.location}`);
    doc.text(`Registered To: ${userEmail}`);
    doc.text(`QR Code ID: ${assignedQr.code}`);
    doc.moveDown(1.5);

    // Embed assigned QR code image
    const qrImage = qrCodeDataUrl.replace(/^data:image\/png;base64,/, "");
    const qrBuffer = Buffer.from(qrImage, "base64");
    doc.image(qrBuffer, { fit: [150, 150], align: "center" });

    doc.moveDown(2);
    doc.fontSize(10).text("Please present this QR code at event entry.", { align: "center" });

    doc.end();
  } catch (err) {
    console.error('Error generating ticket:', err);
    res.status(500).send('Server error generating ticket.');
  }
});



/* ---------------- SERVER ---------------- */
const PORT = process.env.PORT || 3000;
app.listen(PORT, () => {
  console.log(`Server running at http://localhost:${PORT}`);
});
