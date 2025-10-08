const express = require('express');
require('dotenv').config();
const path = require('path');
const session = require('express-session');
const bodyParser = require('body-parser');
const { MongoClient, ServerApiVersion } = require('mongodb');

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

// Static files
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

async function connectToMongo() {
  try {
    await client.connect();
    const db = client.db("CampusTicketing");
    usersCollection = db.collection("users");
    console.log(" Connected to MongoDB");

    //  Log existing users on startup
    const existingUsers = await usersCollection.find().toArray();
    console.log(` ${existingUsers.length} user(s) currently in the database:`);
    console.log(existingUsers);

  } catch (error) {
    console.error(" MongoDB connection error:", error);
  }
}
connectToMongo();

/* ---------------- ROUTES ---------------- */

// Server main page
app.get('/', (req, res) => {
  res.sendFile(path.join(__dirname, 'frontend', 'index.html'));
});

// Server login page
app.get('/signin', (req, res) => {
  res.sendFile(path.join(__dirname, 'frontend', 'signin.html'));
});

// Handle signup
app.post('/createAccount', async (req, res) => {
  const { email, username, password } = req.body;

  try {
    // Prevent duplicate emails
    const existing = await usersCollection.findOne({ email });
    if (existing) {
      return res.send("Email already exists.");
    }

    const newUser = {
      email,
      username,
      password //  In production, hash this!
    };

    await usersCollection.insertOne(newUser);
    console.log(" User created:", newUser);

    // Redirect to login page
    res.redirect('/signin.html');

  } catch (error) {
    console.error("Error creating user:", error);
    res.status(500).send("Error creating account.");
  }
});

// Handle login (username + password + role)
app.post('/login', async (req, res) => {
  const { username, password} = req.body;

  try {
    const user = await usersCollection.findOne({ username, password});
    if (!user) {
      return res.json({ success: false, message: "Invalid username, password." });
    }

    // Start session
    req.session.user = {
      id: user._id,
      email: user.email,
      username: user.username
    };

    // Successful login
    res.json({ success: true });
  } catch (error) {
    console.error("Error logging in:", error);
    res.status(500).json({ success: false, message: "Server error. Please try again." });
  }
});

// Protected example route
app.get('/main.html', (req, res) => {
  if (!req.session.user) {
    return res.redirect('/signin.html');
  }
  res.sendFile(path.join(__dirname, 'frontend', 'main.html'));
});

// Debug route: List users in terminal
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

// Logout
app.get('/logout', (req, res) => {
  req.session.logoutMessage = "You have been logged out.";
  req.session.user = null;
  req.session.destroy(() => {
    res.redirect('/signin.html');
  });
});

// Check session status
app.get('/session-status', (req, res) => {
  const loggedIn = !!req.session.user;
  const logoutMessage = req.session.logoutMessage || null;
  req.session.logoutMessage = null; // Clear after sending
  res.json({ loggedIn, logoutMessage });
});

// Start server
const PORT = process.env.PORT || 3000;
app.listen(PORT, () => {
  console.log(`Server running at http://localhost:${PORT}`);
});

