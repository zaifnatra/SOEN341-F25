const express = require('express');
require('dotenv').config();
const path = require('path');
const session = require('express-session');
const bodyParser = require('body-parser');
const { MongoClient, ServerApiVersion } = require('mongodb');
const QRCode = require('qrcode');
const archiver = require("archiver");
const { ObjectId } = require("mongodb");
const { Buffer } = require("buffer");
const PDFDocument = require('pdfkit');

//saving the QR codes to local direcotry
const QR_CODES_DIR = path.join(__dirname, "qrcodes");
const app = express();

// interest recommendation prompts
const EVENT_CATEGORIES = ['Academic', 'Social', 'Workshop', 'Sports', 'Career', 'Arts', 'Other'];

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

//function that handles creating an account 
app.post('/createAccount', async (req, res) => {
  // --- FIX: Added 'interests' to be read from req.body ---
  const { email, username, password, interests: rawInterests } = req.body;

  try {
    const existing = await usersCollection.findOne({ email });
    if (existing) {
      // Return JSON instead of rendering another page
      return res.json({ success: false, message: "Email already exists. Please use another email." });
    }

    const existingUsername = await usersCollection.findOne({ username });
    if (existingUsername) {
      return res.json({ success: false, message: "Username already taken. Please choose another one." });
    }

    // Normalize interests
    let interests = [];
    if (rawInterests == null) {
      interests = [];
    } else if (Array.isArray(rawInterests)) {
      interests = rawInterests.map(String).map(s => s.trim()).filter(Boolean);
    } else {
      // handle single string or comma-separated values
      interests = String(rawInterests)
        .split(',')
        .map(s => s.trim())
        .filter(Boolean);
    }

    const newUser = { email, username, password, role: "student", interests: interests || [] };
    await usersCollection.insertOne(newUser);
    console.log("New User created:", newUser);

    res.json({ success: true, message: "Account created successfully." });
  } catch (error) {
    console.error("Error creating user:", error);
    res.status(500).json({ success: false, message: "Error creating account." });
  }
});

//handles logging in
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

//handles logging out
app.get('/logout', (req, res) => {
  req.session.logoutMessage = "You have been logged out.";
  req.session.user = null;
  req.session.destroy(() => {
    res.redirect('/signin.html');
  });
});

//handles express session
app.get('/session-status', (req, res) => {
  const loggedIn = !!req.session.user;
  const logoutMessage = req.session.logoutMessage || null;
  req.session.logoutMessage = null;
  res.json({ loggedIn, logoutMessage });
});

//redirect to main.html after signing in successfully
app.get('/main.html', (req, res) => {
  if (!req.session.user) {
    return res.redirect('/signin.html');
  }
  res.sendFile(path.join(__dirname, 'frontend', 'main.html'));
});

//debugging in terminal that lists user accounts found in mongodb 
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

//getting the account of the logged in user
app.get('/user-profile', async (req, res) => {
  if (req.session && req.session.user) {
    try {
      const user = await usersCollection.findOne({ _id: new ObjectId(req.session.user.id) });
      if (!user) return res.status(404).json({ error: "User not found" });

      // Normalize interests to an array if it's a string (persist fix)
      let interests = user.interests;
      if (typeof interests === 'string') {
        interests = interests.split(',').map(s => s.trim()).filter(Boolean);
        await usersCollection.updateOne({ _id: user._id }, { $set: { interests } });
      } else if (!Array.isArray(interests)) {
        interests = [];
      }

      // Return normalized profile once
      const { username, email, role } = user;
      res.json({
        username,
        email,
        role,
        interests: interests || [],
        favoritedEvents: user.favoritedEvents || []
      });

    } catch (error) {
      console.error("Error fetching user profile:", error);
      res.status(500).json({ error: "Server error" });
    }
  } else {
    res.status(401).json({ error: "Not logged in" });
  }
});

// Add this route after your '/user-profile' route
app.post('/api/update-interests', requireLogin, async (req, res) => {
    // normalize incoming interests to an array
  const raw = req.body.interests;
  let interests;
  if (Array.isArray(raw)) {
    interests = raw.map(String).map(s => s.trim()).filter(Boolean);
  } else if (typeof raw === 'string' && raw.trim()) {
    interests = raw.split(',').map(s => s.trim()).filter(Boolean);
  } else {
    interests = [];
  }

  try {
    const result = await usersCollection.updateOne(
      { _id: new ObjectId(req.session.user.id) },
      { $set: { interests } }
    );
    if (result.matchedCount === 0) return res.status(404).json({ success: false, message: "User not found." });

    // keep session in sync so frontend shows updates immediately
    req.session.user.interests = interests;

    res.json({ success: true, message: "Interests updated." });
  } catch (err) {
    console.error("Error updating interests:", err);
    res.status(500).json({ success: false, message: "Server error." });
  }
});

// Add this route to get details for a single event
app.get('/api/event/:id', requireLogin, async (req, res) => {
  try {
    const eventId = req.params.id;
    if (!ObjectId.isValid(eventId)) {
      return res.status(400).json({ message: "Invalid event ID." });
    }

    const event = await eventsCollection.findOne({ _id: new ObjectId(eventId) });

    if (!event) {
      return res.status(404).json({ message: "Event not found." });
    }
    
    // Send back all the details we need for the payment page
    res.json({
      _id: event._id,
      title: event.title,
      price: event.price,
      date: event.date,
      endDate: event.endDate,
      time: event.time
    });

  } catch (error) {
    console.error("Error fetching single event:", error);
    res.status(500).json({ message: "Server error." });
  }
});

// Add this route after your '/events' route
app.get('/api/recommendations', requireLogin, async (req, res) => {
  try {
    const userId = req.session.user.id;
    const user = await usersCollection.findOne({ _id: new ObjectId(userId) });

    if (!user) {
      return res.status(404).json({ message: "User not found" });
    }

    const today = new Date().toISOString().split('T')[0];
    let recommendedEvents = [];

    const declaredInterests = user.interests || [];
    const favoritedEventIds = (user.favoritedEvents || []).map(id => new ObjectId(id));

    // --- NEW LOGIC: Find categories from favorited events ---
    let favoritedCategories = [];
    if (favoritedEventIds.length > 0) {
      const favoritedEvents = await eventsCollection.find({
        _id: { $in: favoritedEventIds }
      }).project({ type: 1 }).toArray();
      
      // Get all unique categories from their favorites
      favoritedCategories = [...new Set(favoritedEvents.map(event => event.type))];
    }

    // Combine declared interests with interests from favorites
    const combinedInterests = [...new Set([...declaredInterests, ...favoritedCategories])];
    
    // Filter out "Other" if other specific interests exist
    let finalInterests = combinedInterests;
    if (finalInterests.length > 1) {
      finalInterests = finalInterests.filter(interest => interest !== 'Other');
    }

    const hasSpecificInterests = finalInterests.length > 0 && !(finalInterests.length === 1 && finalInterests[0] === 'Other');

    if (hasSpecificInterests) {
      // --- Case 1: Show events matching their combined interests ---
      const interestRegex = finalInterests.map(interest => new RegExp(`^${interest}$`, 'i'));

      recommendedEvents = await eventsCollection.find({
        type: { $in: interestRegex },
        date: { $gte: today },
        _id: { $nin: favoritedEventIds } // Don't recommend events they ALREADY favorited
      }).toArray();

    } else {
      // --- Case 2: No interests or "Other" selected ---
      recommendedEvents = await eventsCollection.find({
      date: { $gte: today }
      })
      .sort({ remainingTickets: 1 })
      .limit(10)
      .toArray();
    }

    res.json(recommendedEvents);

  } catch (error) {
    console.error("Error fetching recommendations:", error);
    res.status(500).json({ message: "Server error." });
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

app.get('/recommended', requireLogin, (req, res) => {
  res.sendFile(path.join(__dirname, 'frontend', 'recommended.html'));
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

//handles when a student account makes a request to become an organizer account
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

//handles when admin approves of student account request to become an organizer account
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
        if (typeof event.organizer === "string") updatedOrganizers = [event.organizer, user.username];
        else if (Array.isArray(event.organizer)) updatedOrganizers = [...new Set([...event.organizer, user.username])];
        else updatedOrganizers = [user.username];

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

//when an organizer request gets rejected by admin
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

//creating an event
app.post('/createEvent', async (req, res) => {
  // --- 1. Read new fields from req.body ---
  const { title, description, date, time, endDate, location, capacity, type, paymentStatus, price } = req.body;

  if (!title || !date || !time || !location) {
    return res.status(400).json({ message: "Missing required fields." });
  }

  try {
    // Ensure only logged-in users can create events
    if (!req.session.user) {
      return res.status(403).json({ message: "You must be logged in to create events." });
    }

    const organizer = req.session.user.username;

    const existing = await eventsCollection.findOne({ title });
    if (existing) {
      return res.status(400).json({ message: "Event title already exists." });
    }

    // --- 2. Ensure capacity is a number ---
    const numCapacity = parseInt(capacity) || 0;
    
    // Generate dynamic QR codes
    const qrCodes = [];
    for (let i = 1; i <= numCapacity; i++) {
      const qrData = `${title} - ${i}/${numCapacity}`;
      const qrImage = await QRCode.toDataURL(qrData);
      qrCodes.push({ code: qrData, image: qrImage, scanned: false });
    }

    // --- 3. Add new fields to the newEvent object ---
    const newEvent = {
      title,
      organizer: [organizer],
      description,
      date, // This is the Start Date
      time, // This can be "All Day"
      endDate: endDate || null, // NEW
      location,
      capacity: numCapacity,
      type: type,
      paymentStatus: paymentStatus,
      price: price || null, // NEW
      qrCodes,
      scannedTickets: 0,
      attendanceRate: 0,
      remainingTickets: numCapacity,
      scans: []
    };

    const insertResult = await eventsCollection.insertOne(newEvent);
    console.log("New event added:", newEvent);

    res.status(201).json({ message: "Event created successfully!" });
  } catch (error) {
    console.error("Error creating event:", error);
    res.status(500).json({ message: "Server error creating event." });
  }
});

//gets all the events to display on events page
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

//shows which events the student has signed up to
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

//downloading qr code
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

//handles ticket validation and ensures that the same ticket can't be scanned twice
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

    // Prevent joining event over capacity (no subtraction)
    const remainingBefore = Number.isInteger(event.remainingTickets)
      ? event.remainingTickets
      : (event.capacity - (event.scannedTickets || 0));

      if (remainingBefore <= 0) {
      return res.json({ valid: false, message: "Event is already at full capacity." });
    }
    
    // Mark QR as scanned
    const markResult = await eventsCollection.updateOne(
      { _id: new ObjectId(event._id), "qrCodes.code": qrData, "qrCodes.scanned": false },
      { $set: { "qrCodes.$.scanned": true } }
    );

// record scan timestamp and increment counts atomically
   const now = new Date().toISOString();
   await eventsCollection.updateOne(
     { _id: new ObjectId(event._id) },
     {
       $inc: { scannedTickets: 1 },
       $push: { scans: now },
       $set: {
         remainingTickets: event.capacity - ((event.scannedTickets || 0) + 1),
         attendanceRate: ((event.scannedTickets || 0) + 1) / event.capacity * 100
       }
     }
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

// Export attendee list CSV for a single event
app.get("/export-event-csv/:eventId", requireLogin, async (req, res) => {
  try {
    const eventId = req.params.eventId.trim();
    if (!ObjectId.isValid(eventId)) return res.status(400).send("Invalid event ID");

    const event = await eventsCollection.findOne({ _id: new ObjectId(eventId) });
    if (!event) return res.status(404).send("Event not found");

    // Only allow organizers of the event to export
    const organizerEmail = req.session.user.email;
    const isOrganizer = Array.isArray(event.organizer)
      ? event.organizer.includes(organizerEmail)
       : event.organizer === organizerEmail;

    if (!isOrganizer) return res.status(403).send("Unauthorized");

    // Build CSV: attendee email, ticket status
    const csvRows = [["Email", "Ticket Status"]];
    event.qrCodes.forEach((qr) => {
      if (qr.assignedTo) {
        csvRows.push([
          qr.assignedTo,
          qr.scanned ? "attended" : "did not attend"
        ]);
      }
    });

    const csvContent = csvRows.map((r) => r.join(",")).join("\n");
    res.setHeader("Content-Type", "text/csv");
    res.setHeader("Content-Disposition", `attachment; filename="${event.title.replace(/\s+/g, "_")}_attendees.csv"`);
    res.send(csvContent);

  } catch (err) {
    console.error("Error exporting event CSV:", err);
    res.status(500).send("Server error exporting CSV");
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

//favoriting toggle
app.post('/api/toggle-favorite', requireLogin, async (req, res) => {
  const { eventId } = req.body;
  const userId = req.session.user.id;

  if (!eventId) {
    return res.status(400).json({ success: false, message: "Missing event ID." });
  }

  try {
    const user = await usersCollection.findOne({ _id: new ObjectId(userId) });
    if (!user) {
      return res.status(404).json({success: false, message: "User not found."})
    }
    const favorites = user.favoritedEvents || [];

    let isFavorited;

    // Check if the event is already favorited
    if (favorites.includes(eventId)) {
      // It is favorited, so REMOVE it
      await usersCollection.updateOne(
        { _id: new ObjectId(userId) },
        { $pull: { favoritedEvents: eventId } }
      );
      isFavorited = false;
    } else {
      // It's not favorited, so ADD it
      await usersCollection.updateOne(
        { _id: new ObjectId(userId) },
        { $addToSet: { favoritedEvents: eventId } } // $addToSet prevents duplicates
      );
      isFavorited = true;
    }

    res.json({ success: true, isFavorited: isFavorited });

  } catch (error) {
    console.error("Error toggling favorite:", error);
    res.status(500).json({ success: false, message: "Server error." });
  }
});

// my fav
// Add this new route near your other API routes
app.get('/api/my-favorites', requireLogin, async (req, res) => {
  try {
    const user = await usersCollection.findOne({ _id: new ObjectId(req.session.user.id) });
    
    // --- THIS IS THE FIX ---
    if (!user) {
      // This stops the crash if the user's session is invalid
      return res.json([]); // Just return an empty list
    }
    // --- END OF FIX ---

    const favoritedEventIds = (user.favoritedEvents || []).map(id => new ObjectId(id));

    if (favoritedEventIds.length === 0) {
      // User has no favorites, just return an empty array
      return res.json([]);
    }

    // Fetch the full event details for all favorited IDs
    const favoritedEvents = await eventsCollection.find({
      _id: { $in: favoritedEventIds }
    }).toArray();
    
    res.json(favoritedEvents);

  } catch (error) {
    console.error("Error fetching favorited events:", error);
    res.status(500).json({ message: "Server error." });
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
    doc.moveDown(1.5); // FIX: Was "Readability.moveDown"

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
  } // FIX: Was "After }"
});



/* ---------------- SERVER ---------------- */
const PORT = process.env.PORT || 3000;
app.listen(PORT, () => {
  console.log(`Server running at http://localhost:${PORT}`);
});