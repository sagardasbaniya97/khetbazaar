const router       = require('express').Router();
const { ObjectId } = require('mongodb');
const { getDb }    = require('../db');

function col()      { return getDb().collection('orders'); }
function products() { return getDb().collection('products'); }
function toId(id) {
  try { return ObjectId.isValid(id) ? new ObjectId(id) : null; }
  catch { return null; }
}

// GET /api/orders
router.get('/', async (req, res) => {
  try {
    res.json(await col().find({}).sort({ createdAt: -1 }).toArray());
  } catch (err) { res.status(500).json({ error: err.message }); }
});

// GET /api/orders/:id
router.get('/:id', async (req, res) => {
  try {
    const oid = toId(req.params.id);
    if (!oid) return res.status(400).json({ error: 'Invalid id' });
    const order = await col().findOne({ _id: oid });
    if (!order) return res.status(404).json({ error: 'Not found' });
    res.json(order);
  } catch (err) { res.status(500).json({ error: err.message }); }
});

// POST /api/orders
router.post('/', async (req, res) => {
  try {
    const { items, buyer, subtotal, delivery, total } = req.body;
    if (!items?.length || !buyer?.name || !buyer?.phone || !buyer?.address)
      return res.status(400).json({ error: 'items and full buyer details are required.' });

    for (const item of items) {
      const oid = toId(item._id);
      if (!oid) return res.status(400).json({ error: `Invalid product id: ${item._id}` });
      const product = await products().findOne({ _id: oid });
      if (!product) return res.status(404).json({ error: `Product not found: ${item._id}` });
      if (product.stock < item.qty)
        return res.status(409).json({ error: `Insufficient stock for "${product.name}". Available: ${product.stock}` });
      await products().updateOne({ _id: oid }, { $inc: { stock: -item.qty } });
    }

    const doc = {
      items, buyer,
      subtotal: Number(subtotal), delivery: Number(delivery), total: Number(total),
      status: 'Placed', createdAt: new Date().toISOString(),
    };
    const result = await col().insertOne(doc);
    res.status(201).json({ ...doc, _id: result.insertedId });
  } catch (err) { res.status(500).json({ error: err.message }); }
});

// PATCH /api/orders/:id
router.patch('/:id', async (req, res) => {
  try {
    const oid = toId(req.params.id);
    if (!oid) return res.status(400).json({ error: 'Invalid id' });
    const { status } = req.body;
    if (!['Placed', 'Shipped', 'Delivered'].includes(status))
      return res.status(400).json({ error: 'status must be Placed, Shipped or Delivered.' });
    const result = await col().updateOne({ _id: oid }, { $set: { status } });
    res.json({ modifiedCount: result.modifiedCount });
  } catch (err) { res.status(500).json({ error: err.message }); }
});

module.exports = router;
