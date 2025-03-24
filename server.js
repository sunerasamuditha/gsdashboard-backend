require('dotenv').config();

const express = require('express');
const cors = require('cors');
const fs = require('fs');
const readline = require('readline');
const mongoose = require('mongoose');

// Import your Google Sheets functions and OAuth client from your file.
const { getSheetData, oAuth2Client, TOKEN_PATH, SCOPES } = require('./googleSheets');

// Import the Mongoose model for sheet data.
const SheetData = require('./models/SheetData');

const app = express();
const PORT = process.env.PORT || 3001;

// Allow cross-origin requests.
app.use(cors());
// Enable parsing of JSON bodies (if needed).
app.use(express.json());
// Serve static files (your front-end) from the "public" folder.
app.use(express.static('public'));

// Connect to MongoDB using the connection string from the environment variable.
const MONGO_URI = process.env.MONGO_URI || 'mongodb://localhost:27017/googleSheetsData';
mongoose.connect(MONGO_URI, { useNewUrlParser: true, useUnifiedTopology: true })
  .then(() => console.log('Connected to MongoDB!'))
  .catch((err) => console.error('Error connecting to MongoDB:', err));

// Google Sheet configuration.
const SPREADSHEET_ID = '1jnPdM23eEXtY9uPWHwj8fOHAmCVg2I0LCta9kyYPBlo';
const RANGES = [
  'Dashboard!K9:R36',   // Overall district data
  'Dashboard!B6:I18',   // Overall national stats
  'Dashboard!K53:R80',  // Remedial Teaching district data
  'Dashboard!B50:I61',  // Remedial Teaching national stats
  'Dashboard!K99:R126', // Paper Seminars district data
  'Dashboard!B96:I107'  // Paper Seminars national stats
];

/**
 * Helper function: If there is no valid OAuth token, initiate the OAuth flow.
 */
function getNewToken(oAuth2Client) {
  return new Promise((resolve, reject) => {
    const authUrl = oAuth2Client.generateAuthUrl({
      access_type: 'offline',
      scope: SCOPES,
    });
    console.log('Authorize this app by visiting this URL:', authUrl);
    const rl = readline.createInterface({
      input: process.stdin,
      output: process.stdout,
    });
    rl.question('Enter the code from that page here: ', async (code) => {
      rl.close();
      try {
        const { tokens } = await oAuth2Client.getToken(code);
        oAuth2Client.setCredentials(tokens);
        fs.writeFileSync(TOKEN_PATH, JSON.stringify(tokens, null, 2));
        console.log('Token stored at', TOKEN_PATH);
        resolve();
      } catch (error) {
        console.error('Error retrieving access token:', error);
        reject(error);
      }
    });
  });
}

/**
 * Middleware to ensure that a valid OAuth token is set before handling API requests.
 */
async function ensureAuth(req, res, next) {
  try {
    if (!fs.existsSync(TOKEN_PATH)) {
      console.log('OAuth token not found. Please authenticate first.');
      await getNewToken(oAuth2Client);
    } else {
      const tokenContent = fs.readFileSync(TOKEN_PATH, 'utf8').trim();
      if (!tokenContent) {
        console.log('Token file is empty. Re-authenticating...');
        await getNewToken(oAuth2Client);
      } else {
        try {
          const token = JSON.parse(tokenContent);
          oAuth2Client.setCredentials(token);
        } catch (err) {
          console.log('Existing token is invalid JSON. Re-authenticating...');
          await getNewToken(oAuth2Client);
        }
      }
    }
    next();
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
}

/**
 * API Endpoint: GET /api/sheet-data  
 * Fetch data from Google Sheets for all instances and return it as JSON.
 */
app.get('/api/sheet-data', ensureAuth, async (req, res) => {
  try {
    const data = await getSheetData(SPREADSHEET_ID, RANGES);
    if (data.length !== 6) {
      throw new Error('Failed to fetch all required ranges');
    }
    const structuredData = {
      overall: {
        districtData: data[0],      // K9:R36
        nationalStats: data[1]      // B6:I18
      },
      remedialTeaching: {
        districtData: data[2],      // K50:P80
        nationalStats: data[3]      // B50:I61
      },
      paperSeminars: {
        districtData: data[4],      // K96:P126
        nationalStats: data[5]      // B96:I107
      }
    };
    res.json(structuredData);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

/**
 * API Endpoint: POST /api/sheet-data/save  
 * Fetch data from Google Sheets, transform it, and save it to MongoDB.
 */
app.post('/api/sheet-data/save', ensureAuth, async (req, res) => {
  try {
    // Fetch data from Google Sheets (using only the original range for this endpoint).
    const sheetDataArray = await getSheetData(SPREADSHEET_ID, ['Dashboard!K9:R36']);
    if (!sheetDataArray || sheetDataArray.length < 2) {
      return res.status(400).json({ error: 'Not enough data to save.' });
    }
    const headers = sheetDataArray[0][0]; // First range's headers
    const rows = sheetDataArray[0].slice(1);
    const docs = rows.map(row => {
      let doc = {};
      headers.forEach((header, index) => {
        doc[header] = row[index] || null;
      });
      return doc;
    });
    await SheetData.insertMany(docs);
    res.json({ message: 'Data saved to database successfully!', count: docs.length });
  } catch (error) {
    console.error('Error saving data to MongoDB:', error);
    res.status(500).json({ error: error.message });
  }
});

/**
 * API Endpoint: GET /api/sheet-data/all  
 * Retrieve all stored data from MongoDB.
 */
app.get('/api/sheet-data/all', async (req, res) => {
  try {
    const storedData = await SheetData.find({});
    res.json({ data: storedData });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// Start the Express server.
app.listen(PORT, () => {
  console.log(`Server is running on port ${PORT}`);
});