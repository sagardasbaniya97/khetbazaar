require('dotenv').config();
const { MongoClient } = require('mongodb');

const URI = process.env.MONGO_URI;
const DB_NAME = process.env.DB_NAME || 'khetbazaar';

let client;
let db;

async function connectDB() {
  if (db) return db;

  try {
    client = new MongoClient(URI, {
      useNewUrlParser: true,
      useUnifiedTopology: true,
    });

    await client.connect();
    db = client.db(DB_NAME);

    console.log(`✅ MongoDB connected → ${DB_NAME}`);
    return db;
  } catch (err) {
    console.error("❌ MongoDB connection failed:", err);
    process.exit(1);
  }
}

function getDb() {
  if (!db) {
    throw new Error("DB not initialized. Call connectDB() first.");
  }
  return db;
}

module.exports = { connectDB, getDb };