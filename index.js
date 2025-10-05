const express = require('express');
const path = require('path');
const app = express();

//static files throughout front end
app.use(express.static(path.join(__dirname, 'frontend')));

// main page
app.get('/', (req, res) => {
    res.sendFile(path.join(__dirname, 'frontend', 'index.html'));
});

// starting the server
const PORT = process.env.PORT || 3000;
app.listen(PORT, () => {
    console.log(`Server is running on http://localhost:${PORT}`);
});