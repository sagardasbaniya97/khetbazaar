const router     = require('express').Router();
const { getDb }  = require('../db');
const bcrypt     = require('bcryptjs');
const jwt        = require('jsonwebtoken');

const JWT_SECRET = process.env.JWT_SECRET || 'khetbazaar_secret_change_me';

function col() { return getDb().collection('users'); }

/* ── Middleware: verify JWT ───────────────────────────────────── */
function authMiddleware(req, res, next) {
  const auth = req.headers.authorization;
  if (!auth || !auth.startsWith('Bearer '))
    return res.status(401).json({ error: 'Not logged in. Please login first.' });
  try {
    req.user = jwt.verify(auth.split(' ')[1], JWT_SECRET);
    next();
  } catch {
    res.status(401).json({ error: 'Session expired. Please login again.' });
  }
}

/* ── POST /api/users/signup ───────────────────────────────────── */
router.post('/signup', async (req, res) => {
  try {
    const { name, email, password, phone } = req.body;

    if (!name || !email || !password)
      return res.status(400).json({ error: 'Name, email and password are required.' });

    if (password.length < 6)
      return res.status(400).json({ error: 'Password must be at least 6 characters.' });

    const existing = await col().findOne({ email: email.toLowerCase() });
    if (existing)
      return res.status(409).json({ error: 'This email is already registered. Please login.' });

    const hashed = await bcrypt.hash(password, 10);
    const doc = {
      name:      name.trim(),
      email:     email.toLowerCase().trim(),
      password:  hashed,
      phone:     phone?.trim() || '',
      createdAt: new Date().toISOString(),
    };

    const result = await col().insertOne(doc);
    const token  = jwt.sign({ userId: String(result.insertedId), email: doc.email }, JWT_SECRET, { expiresIn: '7d' });

    res.status(201).json({
      token,
      user: { name: doc.name, email: doc.email, phone: doc.phone },
    });
  } catch (err) { res.status(500).json({ error: err.message }); }
});

/* ── POST /api/users/login ────────────────────────────────────── */
router.post('/login', async (req, res) => {
  try {
    const { email, password } = req.body;
    if (!email || !password)
      return res.status(400).json({ error: 'Email and password are required.' });

    const user = await col().findOne({ email: email.toLowerCase() });
    if (!user)
      return res.status(401).json({ error: 'Invalid email or password.' });

    const match = await bcrypt.compare(password, user.password);
    if (!match)
      return res.status(401).json({ error: 'Invalid email or password.' });

    const token = jwt.sign({ userId: String(user._id), email: user.email }, JWT_SECRET, { expiresIn: '7d' });

    res.json({
      token,
      user: { name: user.name, email: user.email, phone: user.phone },
    });
  } catch (err) { res.status(500).json({ error: err.message }); }
});

/* ── GET /api/users/me  (protected) ──────────────────────────── */
router.get('/me', authMiddleware, async (req, res) => {
  try {
    const { ObjectId } = require('mongodb');
    const user = await col().findOne(
      { _id: new ObjectId(req.user.userId) },
      { projection: { password: 0 } }
    );
    if (!user) return res.status(404).json({ error: 'User not found.' });
    res.json(user);
  } catch (err) { res.status(500).json({ error: err.message }); }
});

/* ── PATCH /api/users/me  (protected) ────────────────────────── */
router.patch('/me', authMiddleware, async (req, res) => {
  try {
    const { ObjectId } = require('mongodb');
    const { name, phone } = req.body;
    const update = {};
    if (name)  update.name  = name.trim();
    if (phone) update.phone = phone.trim();
    await col().updateOne({ _id: new ObjectId(req.user.userId) }, { $set: update });
    res.json({ message: 'Profile updated.' });
  } catch (err) { res.status(500).json({ error: err.message }); }
});

module.exports = router;
module.exports.authMiddleware = authMiddleware;
