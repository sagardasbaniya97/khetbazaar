const router       = require('express').Router();
const { ObjectId } = require('mongodb');
const { getDb }    = require('../db');

function col()   { return getDb().collection('products'); }
function toId(id) {
  try { return ObjectId.isValid(id) ? new ObjectId(id) : null; }
  catch { return null; }
}

// GET /api/products
router.get('/', async (req, res) => {
  try {
    const { category, maxPrice, search, sort } = req.query;
    const filter = {};
    if (category) filter.category = category;
    if (maxPrice)  filter.price = { $lte: Number(maxPrice) };
    if (search) {
      const re = new RegExp(search, 'i');
      filter.$or = [{ name: re }, { desc: re }, { tags: re }];
    }
    let cursor = col().find(filter);
    if (sort === 'price-asc')   cursor = cursor.sort({ price:  1 });
    else if (sort === 'price-desc') cursor = cursor.sort({ price: -1 });
    else if (sort === 'name-asc')   cursor = cursor.sort({ name:   1 });
    else                            cursor = cursor.sort({ createdAt: -1 });
    res.json(await cursor.toArray());
  } catch (err) { res.status(500).json({ error: err.message }); }
});

// GET /api/products/:id
router.get('/:id', async (req, res) => {
  try {
    const oid = toId(req.params.id);
    if (!oid) return res.status(400).json({ error: 'Invalid id' });
    const product = await col().findOne({ _id: oid });
    if (!product) return res.status(404).json({ error: 'Not found' });
    res.json(product);
  } catch (err) { res.status(500).json({ error: err.message }); }
});

// POST /api/products
router.post('/', async (req, res) => {
  try {
    const { name, category, price, stock, image, unit, desc, tags } = req.body;
    if (!name || !category || price == null || stock == null)
      return res.status(400).json({ error: 'name, category, price and stock are required.' });
    const doc = {
      name, category,
      price: Number(price), stock: Number(stock),
      image: image || '', unit: unit || 'unit',
      desc: desc || '', tags: Array.isArray(tags) ? tags : [],
      createdAt: new Date().toISOString(),
    };
    const result = await col().insertOne(doc);
    res.status(201).json({ ...doc, _id: result.insertedId });
  } catch (err) { res.status(500).json({ error: err.message }); }
});

// PATCH /api/products/:id
router.patch('/:id', async (req, res) => {
  try {
    const oid = toId(req.params.id);
    if (!oid) return res.status(400).json({ error: 'Invalid id' });
    const { $inc, ...setFields } = req.body;
    const update = {};
    if (Object.keys(setFields).length) update.$set = setFields;
    if ($inc) update.$inc = $inc;
    const result = await col().updateOne({ _id: oid }, update);
    res.json({ modifiedCount: result.modifiedCount });
  } catch (err) { res.status(500).json({ error: err.message }); }
});

// DELETE /api/products/:id
router.delete('/:id', async (req, res) => {
  try {
    const oid = toId(req.params.id);
    if (!oid) return res.status(400).json({ error: 'Invalid id' });
    const result = await col().deleteOne({ _id: oid });
    res.json({ deletedCount: result.deletedCount });
  } catch (err) { res.status(500).json({ error: err.message }); }
});

module.exports = router;
