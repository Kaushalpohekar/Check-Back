const express = require('express');
const cors = require('cors');
const router = require('./routes');
const fs = require('fs');
const bodyParser = require('body-parser');
const https = require('https');

const privateKey = fs.readFileSync('/etc/letsencrypt/live/senso.senselive.in/privkey.pem', 'utf8');
const fullchain = fs.readFileSync('/etc/letsencrypt/live/senso.senselive.in/fullchain.pem', 'utf8');
const credentials = { key: privateKey, cert: fullchain };

const app = express();

const port = 9000;


app.use(cors());
app.use(express.json({ limit: '5000mb' }));
app.use(bodyParser.json());
//app.use(SA.log);

// Use the router for handling routes
//app.use(router);
app.use('/elkem-checklist', router);
app.get('/elkem-checklist/test', (req, res) => {
  console.log('Received GET request to /api/example');
  res.send('Response from Node.js server');
});


const httpsServer = https.createServer(credentials, app);

httpsServer.listen(9000, () => {
  console.log(`HTTPS server listening on port ${port}`);
});
