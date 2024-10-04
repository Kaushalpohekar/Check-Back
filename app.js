const express = require('express');
const cors = require('cors');
const router = require('./routes');
// const { startCronJobs } = require('./Cronjobs/shift');

const app = express();
const port = 4000;

// Middleware to enable CORS
app.use(cors());

// Middleware to parse JSON bodies
app.use(express.json({ limit: '5000mb' }));

// Middleware to parse URL-encoded bodies
app.use(express.urlencoded({ extended: true }));

// Use the router for handling routes
app.use(router);

// Default route
app.get('/', (req, res) => {
  console.log('GET request received!');
  res.send('Server is running');
});

//startCronJobs();

// Start the server
app.listen(port, () => {
  console.log(`Server running on port ${port}`);
});

