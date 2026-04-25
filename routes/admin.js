const router     = require('express').Router();
const { getDb }  = require('../db');
const bcrypt     = require('bcryptjs');
const jwt        = require('jsonwebtoken');

const JWT_SECRET    = process.env.JWT_SECRET || 'khetbazaar_secret_change_me';
const SUPER_EMAIL   = process.env.SUPER_ADMIN_EMAIL    || 'sagardasbaniya97@gmail.com';
const SUPER_PASS    = process.env.SUPER_ADMIN_PASSWORD || 'Admin@123';

function col() { return getDb().collection('admins'); }

/* ── Seed super admin on first run ───────────────────────────── */
async function seedSuperAdmin() {
  try {
    const db = getDb();
    const existing = await db.collection('admins').findOne({ email: SUPER_EMAIL.toLowerCase() });
    if (!existing) {
      const hashed = await bcrypt.hash(SUPER_PASS, 10);
      await db.collection('admins').insertOne({
        name:        'Super Admin',
        email:       SUPER_EMAIL.toLowerCase(),
        password:    hashed,
        role:        'superadmin',
        createdAt:   new Date().toISOString(),
      });
      console.log('✅ Super admin created:', SUPER_EMAIL);
    }
  } catch (err) {
    console.error('❌ Super admin seed failed:', err.message);
  }
}

/* ── Middleware: verify admin JWT ────────────────────────────── */
function adminAuth(req, res, next) {
  const auth = req.headers.authorization;
  if (!auth || !auth.startsWith('Bearer '))
    return res.status(401).json({ error: 'Admin not logged in.' });
  try {
    const decoded = jwt.verify(auth.split(' ')[1], JWT_SECRET);
    if (decoded.role !== 'admin' && decoded.role !== 'superadmin')
      return res.status(403).json({ error: 'Access denied. Admins only.' });
    req.admin = decoded;
    next();
  } catch {
    res.status(401).json({ error: 'Admin session expired. Please login again.' });
  }
}

/* ── Middleware: verify super admin only ─────────────────────── */
function superAdminAuth(req, res, next) {
  adminAuth(req, res, () => {
    if (req.admin.role !== 'superadmin')
      return res.status(403).json({ error: 'Only Super Admin can do this.' });
    next();
  });
}

/* ── POST /api/admin/login ───────────────────────────────────── */
router.post('/login', async (req, res) => {
  try {
    const { email, password } = req.body;
    if (!email || !password)
      return res.status(400).json({ error: 'Email and password are required.' });

    // Seed super admin if not exists yet
    await seedSuperAdmin();

    const admin = await col().findOne({ email: email.toLowerCase() });
    if (!admin)
      return res.status(401).json({ error: 'Invalid email or password.' });

    const match = await bcrypt.compare(password, admin.password);
    if (!match)
      return res.status(401).json({ error: 'Invalid email or password.' });

    const token = jwt.sign(
      { adminId: String(admin._id), email: admin.email, role: admin.role, name: admin.name },
      JWT_SECRET,
      { expiresIn: '7d' }
    );

    res.json({
      token,
      admin: { name: admin.name, email: admin.email, role: admin.role },
    });
  } catch (err) { res.status(500).json({ error: err.message }); }
});

/* ── GET /api/admin/me  (protected) ─────────────────────────── */
router.get('/me', adminAuth, (req, res) => {
  res.json({ name: req.admin.name, email: req.admin.email, role: req.admin.role });
});

/* ── GET /api/admin/list  (super admin only) ─────────────────── */
router.get('/list', superAdminAuth, async (req, res) => {
  try {
    const admins = await col().find({}, { projection: { password: 0 } }).toArray();
    res.json(admins);
  } catch (err) { res.status(500).json({ error: err.message }); }
});

/* ── POST /api/admin/add  (super admin only) ─────────────────── */
router.post('/add', superAdminAuth, async (req, res) => {
  try {
    const { name, email, password } = req.body;
    if (!name || !email || !password)
      return res.status(400).json({ error: 'Name, email and password are required.' });
    if (password.length < 6)
      return res.status(400).json({ error: 'Password must be at least 6 characters.' });

    const existing = await col().findOne({ email: email.toLowerCase() });
    if (existing)
      return res.status(409).json({ error: 'This email is already an admin.' });

    const hashed = await bcrypt.hash(password, 10);
    await col().insertOne({
      name:      name.trim(),
      email:     email.toLowerCase().trim(),
      password:  hashed,
      role:      'admin',
      createdAt: new Date().toISOString(),
    });

    res.status(201).json({ message: `Admin "${name}" added successfully.` });
  } catch (err) { res.status(500).json({ error: err.message }); }
});

/* ── DELETE /api/admin/remove/:id  (super admin only) ───────── */
router.delete('/remove/:id', superAdminAuth, async (req, res) => {
  try {
    const { ObjectId } = require('mongodb');
    const oid = new ObjectId(req.params.id);
    const admin = await col().findOne({ _id: oid });
    if (!admin) return res.status(404).json({ error: 'Admin not found.' });
    if (admin.role === 'superadmin')
      return res.status(403).json({ error: 'Cannot remove Super Admin.' });
    await col().deleteOne({ _id: oid });
    res.json({ message: 'Admin removed successfully.' });
  } catch (err) { res.status(500).json({ error: err.message }); }
});

module.exports = router;
module.exports.adminAuth = adminAuth;
