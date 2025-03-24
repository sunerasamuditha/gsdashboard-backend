// index.js
const { getSheetData, oAuth2Client, TOKEN_PATH, SCOPES } = require('./googleSheets');
const fs = require('fs');
const readline = require('readline');

// Google Sheet ID and Range (modify these values as needed)
const SPREADSHEET_ID = '1jnPdM23eEXtY9uPWHwj8fOHAmCVg2I0LCta9kyYPBlo';
const RANGE = 'Dashboard!K9:R36';

/**
 * Get a new OAuth2 token if one doesn't exist or is invalid.
 * Returns a promise that resolves once the token is acquired and stored.
 * @param {google.auth.OAuth2} oAuth2Client 
 * @returns {Promise<void>}
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
        // Write token to disk with pretty-print formatting.
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
 * Authenticate and fetch data from Google Sheets.
 */
async function main() {
  try {
    let tokenValid = false;
    if (fs.existsSync(TOKEN_PATH)) {
      const tokenContent = fs.readFileSync(TOKEN_PATH, 'utf8').trim();
      if (tokenContent) {
        try {
          JSON.parse(tokenContent);
          tokenValid = true;
        } catch (e) {
          console.log('Existing token is invalid JSON. Re-authenticating...');
        }
      } else {
        console.log('Token file is empty. Re-authenticating...');
      }
    } else {
      console.log('OAuth token not found. Running authorization process...');
    }

    if (!tokenValid) {
      await getNewToken(oAuth2Client);
    }

    // Fetch data from Google Sheets after ensuring a valid token is available.
    const data = await getSheetData(SPREADSHEET_ID, RANGE);
    console.log('Fetched Data:', data);
  } catch (error) {
    console.error('Error:', error);
  }
}

main();
