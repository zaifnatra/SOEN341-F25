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
  const { email, username, password, role } = req.body;
  try {
    const existing = await usersCollection.findOne({ email });
    if (existing) {
      return res.send("Email already exists.");
    }

    if (!role) {
      return res.status(400).send("Role is required.");
    }

    //Storing values
    const newUser = { email, username, password, role };
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

    // Block non-adminn/organ from creating events
    if (!["organizer", "admin"].includes(req.session.user.role)) {
      return res.status(403).json({ message: "Only organizers and admins can create events." });
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
      organizer, // <-- now uses logged-in organizer
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

// Get events created by the logged-in organizer, including QR code images
app.get('/my-events', requireLogin, async (req, res) => {
  try {
    const organizerEmail = req.session.user.email;
    const myEvents = await eventsCollection
      .find({ organizer: organizerEmail })
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



/* ---------------- SERVER ---------------- */
const PORT = process.env.PORT || 3000;
app.listen(PORT, () => {
  console.log(`Server running at http://localhost:${PORT}`);
});
