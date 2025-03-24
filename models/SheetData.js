// models/SheetData.js
const mongoose = require('mongoose');

// We use an empty schema with { strict: false } so that any keys can be stored.
// Each document will represent one row of your Google Sheet.
const sheetDataSchema = new mongoose.Schema({}, { strict: false });

module.exports = mongoose.model('SheetData', sheetDataSchema);
