require('dotenv').config();
const express       = require('express');
const cors          = require('cors');
const path          = require('path');
const { connectDB } = require('./db');

const app = express();

app.use(cors({
  origin: '*',
  methods: ['GET', 'POST', 'PATCH', 'DELETE', 'OPTIONS'],
  allowedHeaders: ['Content-Type'],
}));

app.use(express.json());

// Connect DB on every request (no-op after first connect)
app.use(async (_req, _res, next) => {
  try { await connectDB(); next(); }
  catch (err) { next(err); }
});

// API Routes
app.get('/api/health', (_req, res) => res.json({ status: 'ok', time: new Date() }));
app.use('/api/products', require('./routes/products'));
app.use('/api/orders',   require('./routes/orders'));

// Serve frontend
app.use(express.static(path.join(__dirname, 'public')));
app.get('*', (_req, res) => {
  res.sendFile(path.join(__dirname, 'public', 'index.html'));
});

// Local dev server
if (process.env.NODE_ENV !== 'production') {
  const PORT = process.env.PORT || 3000;
  app.listen(PORT, () => console.log(`🚀 http://localhost:${PORT}`));
}

module.exports = app;
