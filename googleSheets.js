const { google } = require('googleapis');
const fs = require('fs');
const path = require('path');

const SCOPES = ['https://www.googleapis.com/auth/spreadsheets.readonly'];
const TOKEN_PATH = path.join(__dirname, 'config/token.json'); // Store OAuth token

// Load client secrets from a local file.
const clientSecret = require('./config/client_secret.json');
const credentials = clientSecret.installed || clientSecret.web;
if (!credentials) {
  throw new Error("The client_secret.json file does not contain an 'installed' or 'web' property.");
}

const oAuth2Client = new google.auth.OAuth2(
  credentials.client_id,
  credentials.client_secret,
  credentials.redirect_uris[0] // Usually 'http://localhost:3000'
);

/**
 * Fetch data from Google Sheets for multiple ranges.
 * @param {string} spreadsheetId - Google Sheet ID.
 * @param {string[]} ranges - Array of cell ranges (e.g., ["Sheet1!A1:C10", "Sheet1!D1:F10"]).
 * @returns {Promise<Array>} - Array of data arrays, one for each range.
 */
async function getSheetData(spreadsheetId, ranges) {
  try {
    // Verify the token file exists and contains valid JSON.
    if (fs.existsSync(TOKEN_PATH)) {
      const tokenContent = fs.readFileSync(TOKEN_PATH, 'utf8').trim();
      if (!tokenContent) {
        throw new Error('OAuth token file is empty. Please authenticate first.');
      }
      try {
        const token = JSON.parse(tokenContent);
        oAuth2Client.setCredentials(token);
      } catch (err) {
        throw new Error('OAuth token file contains invalid JSON. Please re-authenticate.');
      }
    } else {
      throw new Error('OAuth token not found. Please authenticate first.');
    }

    const sheets = google.sheets({ version: 'v4', auth: oAuth2Client });
    const response = await sheets.spreadsheets.values.batchGet({
      spreadsheetId: spreadsheetId,
      ranges: ranges,
    });

    // Return the values for each range; if a range has no data, return an empty array.
    return response.data.valueRanges.map(vr => vr.values || []);
  } catch (error) {
    console.error('Error fetching data from Google Sheets:', error);
    throw error;
  }
}

module.exports = { getSheetData, oAuth2Client, TOKEN_PATH, SCOPES };