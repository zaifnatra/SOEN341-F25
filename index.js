const express = require('express');
require('dotenv').config();
const path = require('path');
const session = require('express-session');
const bodyParser = require('body-parser');
const { MongoClient, ServerApiVersion } = require('mongodb');
const { v4: uuidv4 } = require('uuid'); //DUMMY QR CODE
const QRCode = require('qrcode'); //DUMMY QR CODE

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

    const newUser = { email, username, password };
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

    const organizer = req.session.user.email || req.session.user.username;

    const existing = await eventsCollection.findOne({ title });
    if (existing) {
      return res.status(400).json({ message: "Event title already exists." });
    }

    // Generate dynamic QR codes
    const qrCodes = [];
    for (let i = 0; i < capacity; i++) {
      const qrData = uuidv4();
      const qrImage = await QRCode.toDataURL(qrData);
      qrCodes.push({ code: qrData, image: qrImage });
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
      scannedTickets: [],
      unscannedTickets: [],
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


//express route for organizer dashboard
app.get('/organizerdashboard', requireLogin, (req, res) => {
  res.sendFile(path.join(__dirname, 'frontend', 'organizerdashboard.html'));
});

// DEBUG route: show only event titles and organizer fields
app.get('/debug-events', async (req, res) => {
  try {
    const events = await eventsCollection.find({}, { projection: { title: 1, organizer: 1 } }).toArray();
    res.json(events);
  } catch (error) {
    console.error("Error fetching debug events:", error);
    res.status(500).json({ message: "Error fetching debug data." });
  }
});


/* ---------------- SERVER ---------------- */
const PORT = process.env.PORT || 3000;
app.listen(PORT, () => {
  console.log(`Server running at http://localhost:${PORT}`);
});
