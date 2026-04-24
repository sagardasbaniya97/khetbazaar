/**
 * KhetBazaar – app.js
 * Connects to the Express/MongoDB backend via fetch().
 * Uses real product images stored in the `image` field.
 */

const API_BASE =
  window.location.hostname === 'localhost' || window.location.hostname === '127.0.0.1'
    ? 'https://khetbazaar-pgls.vercel.app/api'
    : '/api';

// ── API helpers ──────────────────────────────────────────────
async function apiFetch(path, options = {}) {
  const res = await fetch(API_BASE + path, {
    headers: { 'Content-Type': 'application/json' },
    ...options,
  });
  if (!res.ok) {
    const err = await res.json().catch(() => ({ error: res.statusText }));
    throw new Error(err.error || res.statusText);
  }
  return res.json();
}

const api = {
  getProducts:   (params = {}) => {
    const qs = new URLSearchParams(
      Object.fromEntries(Object.entries(params).filter(([, v]) => v !== '' && v != null))
    ).toString();
    return apiFetch('/products' + (qs ? '?' + qs : ''));
  },
  getProduct:    (id)         => apiFetch(`/products/${id}`),
  createProduct: (doc)        => apiFetch('/products', { method: 'POST', body: JSON.stringify(doc) }),
  updateProduct: (id, patch)  => apiFetch(`/products/${id}`, { method: 'PATCH', body: JSON.stringify(patch) }),
  deleteProduct: (id)         => apiFetch(`/products/${id}`, { method: 'DELETE' }),
  getOrders:     ()           => apiFetch('/orders'),
  createOrder:   (doc)        => apiFetch('/orders', { method: 'POST', body: JSON.stringify(doc) }),
  updateOrder:   (id, patch)  => apiFetch(`/orders/${id}`, { method: 'PATCH', body: JSON.stringify(patch) }),
};

// ── State ─────────────────────────────────────────────────────
let cart = JSON.parse(localStorage.getItem('kb_cart') || '[]');
let _productCache = {};

function saveCart()  { localStorage.setItem('kb_cart', JSON.stringify(cart)); }
function cartTotal() { return cart.reduce((s, i) => s + i.price * i.qty, 0); }
function cartCount() { return cart.reduce((s, i) => s + i.qty, 0); }

// ── Navigation ────────────────────────────────────────────────
function navigate(page) {
  document.querySelectorAll('.page').forEach(p => p.classList.remove('active'));
  document.getElementById('page-' + page)?.classList.add('active');
  document.querySelectorAll('.nav-link').forEach(a => {
    a.classList.toggle('active', a.dataset.page === page);
  });
  window.scrollTo({ top: 0, behavior: 'smooth' });
  if (page === 'shop')   renderShop();
  if (page === 'cart')   renderCart();
  if (page === 'orders') renderOrders();
  if (page === 'admin')  renderAdminProducts();
  if (page === 'home')   renderFeatured();
}

function filterAndNav(category) {
  navigate('shop');
  setTimeout(() => {
    document.getElementById('catFilter').value = category;
    applyFilters();
  }, 50);
}

// ── Toast ─────────────────────────────────────────────────────
let _toastTimer;
function showToast(msg) {
  const t = document.getElementById('toast');
  t.textContent = msg;
  t.classList.add('show');
  clearTimeout(_toastTimer);
  _toastTimer = setTimeout(() => t.classList.remove('show'), 2800);
}

// ── Image helper ──────────────────────────────────────────────
/**
 * Returns an <img> tag if the product has an image URL,
 * otherwise a fallback div with the emoji.
 */
function productImageHTML(p, extraClass = '') {
  if (p.image) {
    return `<img src="${p.image}" alt="${p.name}" class="${extraClass}"
              onerror="this.style.display='none';this.nextElementSibling.style.display='flex'"/>
            <div class="img-fallback" style="display:none">${p.emoji || '🌿'}</div>`;
  }
  return `<div class="img-fallback">${p.emoji || '🌿'}</div>`;
}

// ── Home: Featured Products ───────────────────────────────────
async function renderFeatured() {
  const grid = document.getElementById('featuredGrid');
  try {
    const products = await api.getProducts();
    products.forEach(p => { _productCache[p._id] = p; });
    const featured = products.slice(0, 8);
    grid.innerHTML = featured.map(productCard).join('');
  } catch (err) {
    grid.innerHTML = `<p style="color:var(--text-muted);padding:20px;grid-column:1/-1">
      ⚠️ Could not load products. Is the backend running?<br/><small>${err.message}</small></p>`;
  }
}

// ── Shop ──────────────────────────────────────────────────────
async function renderShop(products) {
  const grid = document.getElementById('shopGrid');
  if (!products) {
    grid.innerHTML = '<div class="loading-grid"><div class="skeleton-card"></div><div class="skeleton-card"></div><div class="skeleton-card"></div><div class="skeleton-card"></div></div>';
    try {
      products = await api.getProducts();
      products.forEach(p => { _productCache[p._id] = p; });
    } catch (err) {
      grid.innerHTML = `<p style="color:var(--text-muted);padding:20px">⚠️ Could not load products.<br/><small>${err.message}</small></p>`;
      return;
    }
  }
  document.getElementById('productCount').textContent = products.length;
  grid.innerHTML = products.length
    ? products.map(productCard).join('')
    : '<p style="color:var(--text-muted);padding:20px">No products match your filters.</p>';
}

async function applyFilters() {
  const category = document.getElementById('catFilter').value;
  const maxPrice = document.getElementById('priceFilter').value;
  const search   = document.getElementById('searchFilter').value;
  const sort     = document.getElementById('sortSelect').value;
  try {
    const products = await api.getProducts({ category, maxPrice, search, sort });
    products.forEach(p => { _productCache[p._id] = p; });
    renderShop(products);
  } catch (err) {
    showToast('⚠️ Filter failed: ' + err.message);
  }
}

function updatePriceLabel(v) { document.getElementById('priceVal').textContent = v; }

function clearFilters() {
  document.getElementById('catFilter').value    = '';
  document.getElementById('priceFilter').value  = 2000;
  document.getElementById('searchFilter').value = '';
  document.getElementById('sortSelect').value   = 'default';
  updatePriceLabel(2000);
  applyFilters();
}

// ── Product Card HTML ─────────────────────────────────────────
function productCard(p) {
  const inCart     = cart.find(c => c._id === p._id);
  const outOfStock = p.stock <= 0;
  return `
  <div class="product-card" data-id="${p._id}">
    <div class="product-img" onclick="openModal('${p._id}')">
      ${productImageHTML(p, '')}
    </div>
    <div class="product-body">
      <div class="product-cat">${p.category}</div>
      <div class="product-name" onclick="openModal('${p._id}')">${p.name}</div>
      <div class="product-desc">${(p.desc || '').slice(0, 75)}${p.desc && p.desc.length > 75 ? '…' : ''}</div>
      <div class="product-meta">
        <div>
          <span class="product-price">₹${p.price}</span>
          <span class="product-unit">/ ${p.unit || 'unit'}</span>
        </div>
        <span class="product-stock ${p.stock < 20 ? 'low' : ''}">
          ${outOfStock ? '❌ Out of stock' : p.stock < 20 ? `⚠️ Only ${p.stock}` : '✅ In stock'}
        </span>
      </div>
      <div class="product-actions">
        <button class="btn-add" onclick="addToCart('${p._id}')" ${outOfStock ? 'disabled' : ''}>
          ${inCart ? `🛒 In Cart (${inCart.qty})` : '+ Add to Cart'}
        </button>
        <button class="btn-view" onclick="openModal('${p._id}')">👁</button>
      </div>
    </div>
  </div>`;
}

// ── Cart Logic ────────────────────────────────────────────────
async function addToCart(id) {
  try {
    let product = _productCache[id];
    if (!product) { product = await api.getProduct(id); _productCache[id] = product; }
    if (!product || product.stock <= 0) return showToast('❌ Out of stock!');

    const existing = cart.find(c => c._id === id);
    if (existing) {
      if (existing.qty >= product.stock) return showToast('⚠️ Max stock reached!');
      existing.qty++;
    } else {
      cart.push({ _id: id, name: product.name, price: product.price, image: product.image || '', emoji: product.emoji || '🌿', qty: 1 });
    }
    saveCart(); updateCartBadge();
    showToast(`✅ ${product.name} added!`);
    if (document.getElementById('page-home').classList.contains('active')) renderFeatured();
    if (document.getElementById('page-shop').classList.contains('active')) applyFilters();
  } catch (err) { showToast('⚠️ ' + err.message); }
}

function removeFromCart(id) {
  cart = cart.filter(c => c._id !== id);
  saveCart(); updateCartBadge(); renderCart();
}

function changeQty(id, delta) {
  const item = cart.find(c => c._id === id);
  if (!item) return;
  const product = _productCache[id];
  item.qty = Math.max(1, Math.min(item.qty + delta, product?.stock || 999));
  saveCart(); updateCartBadge(); renderCart();
}

function updateCartBadge() {
  document.getElementById('cartBadge').textContent = cartCount();
}

// ── Cart Page ─────────────────────────────────────────────────
function renderCart() {
  const list = document.getElementById('cartList');
  if (cart.length === 0) {
    list.innerHTML = `<div class="empty-state"><div class="empty-icon">🛒</div><p>Your cart is empty.</p><button class="btn-primary" onclick="navigate('shop')">Shop Now</button></div>`;
  } else {
    list.innerHTML = cart.map(item => `
      <div class="cart-item">
        ${item.image
          ? `<img src="${item.image}" alt="${item.name}" class="cart-item-img" onerror="this.style.display='none'">`
          : `<div class="cart-item-emoji">${item.emoji}</div>`}
        <div class="cart-item-info">
          <div class="cart-item-name">${item.name}</div>
          <div class="cart-item-price">₹${item.price} × ${item.qty} = <strong>₹${item.price * item.qty}</strong></div>
        </div>
        <div class="cart-item-controls">
          <button class="qty-btn" onclick="changeQty('${item._id}',-1)">−</button>
          <span class="qty-display">${item.qty}</span>
          <button class="qty-btn" onclick="changeQty('${item._id}',1)">+</button>
        </div>
        <button class="cart-remove" onclick="removeFromCart('${item._id}')">🗑</button>
      </div>`).join('');
  }

  const subtotal = cartTotal();
  const delivery = subtotal > 0 && subtotal < 500 ? 49 : 0;
  const total    = subtotal + delivery;
  document.getElementById('subtotal').textContent = `₹${subtotal}`;
  document.getElementById('delivery').textContent = delivery === 0 ? (subtotal === 0 ? '₹0' : '🎉 Free') : `₹${delivery}`;
  document.getElementById('total').textContent    = `₹${total}`;
}

// ── Place Order ───────────────────────────────────────────────
async function placeOrder() {
  if (cart.length === 0) return showToast('❌ Cart is empty!');
  const name    = document.getElementById('buyerName').value.trim();
  const phone   = document.getElementById('buyerPhone').value.trim();
  const address = document.getElementById('buyerAddress').value.trim();
  if (!name || !phone || !address) return showToast('⚠️ Please fill all delivery details!');
  if (!/^\d{10}$/.test(phone))     return showToast('⚠️ Enter a valid 10-digit phone number!');

  const subtotal = cartTotal();
  const delivery = subtotal < 500 ? 49 : 0;

  try {
    const result = await api.createOrder({
      items: cart.map(c => ({ ...c })),
      buyer: { name, phone, address },
      subtotal, delivery, total: subtotal + delivery,
    });

    cart.forEach(item => {
      if (_productCache[item._id])
        _productCache[item._id].stock = Math.max(0, (_productCache[item._id].stock || 0) - item.qty);
    });

    cart = []; saveCart(); updateCartBadge();
    ['buyerName','buyerPhone','buyerAddress'].forEach(id => document.getElementById(id).value = '');
    showToast(`🎉 Order #${String(result._id).slice(-6).toUpperCase()} placed!`);
    renderCart();
    navigate('orders');
  } catch (err) { showToast('⚠️ Order failed: ' + err.message); }
}

// ── Orders Page ───────────────────────────────────────────────
async function renderOrders() {
  const container = document.getElementById('ordersList');
  try {
    const orders = await api.getOrders();
    if (orders.length === 0) {
      container.innerHTML = `<div class="empty-state"><div class="empty-icon">📦</div><p>No orders yet.</p><button class="btn-primary" onclick="navigate('shop')">Start Shopping</button></div>`;
      return;
    }
    container.innerHTML = orders.map(o => `
      <div class="order-card">
        <div class="order-header">
          <div>
            <div class="order-id">Order #${String(o._id).slice(-6).toUpperCase()}</div>
            <div class="order-date">${new Date(o.createdAt).toLocaleString('en-IN')}</div>
          </div>
          <span class="order-status status-${o.status.toLowerCase()}">${o.status}</span>
        </div>
        <div class="order-items-list">
          ${o.items.map(i => `
            <div class="order-item-row">
              <span>${i.emoji || ''} ${i.name} × ${i.qty}</span>
              <span>₹${i.price * i.qty}</span>
            </div>`).join('')}
        </div>
        <div class="order-total">Total: ₹${o.total} ${o.delivery === 0 ? '(Free Delivery 🎉)' : `(₹${o.delivery} delivery)`}</div>
        <div class="order-buyer">📍 ${o.buyer.name} · ${o.buyer.phone} · ${o.buyer.address}</div>
      </div>`).join('');
  } catch (err) {
    container.innerHTML = `<p style="color:var(--text-muted);padding:20px">⚠️ Could not load orders.<br/><small>${err.message}</small></p>`;
  }
}

// ── Admin: Add Product ────────────────────────────────────────
async function addProduct() {
  const name     = document.getElementById('aName').value.trim();
  const category = document.getElementById('aCategory').value;
  const price    = Number(document.getElementById('aPrice').value);
  const stock    = Number(document.getElementById('aStock').value);
  const image    = document.getElementById('aImage').value.trim();
  const unit     = document.getElementById('aUnit').value.trim()  || 'unit';
  const desc     = document.getElementById('aDesc').value.trim();
  const tags     = document.getElementById('aTags').value.split(',').map(t => t.trim()).filter(Boolean);

  if (!name || !category || !price || !stock) return showToast('⚠️ Please fill required fields!');

  try {
    const newProduct = await api.createProduct({ name, category, price, stock, image, unit, desc, tags });
    _productCache[newProduct._id] = newProduct;
    showToast(`✅ "${name}" added!`);
    ['aName','aPrice','aStock','aImage','aUnit','aDesc','aTags'].forEach(id => document.getElementById(id).value = '');
    document.getElementById('aCategory').value = '';
  } catch (err) { showToast('⚠️ ' + err.message); }
}

// ── Admin: Manage Products ────────────────────────────────────
async function renderAdminProducts() {
  const container = document.getElementById('adminProductList');
  if (!container) return;
  try {
    const products = await api.getProducts();
    products.forEach(p => { _productCache[p._id] = p; });
    container.innerHTML = `
      <table class="admin-product-table">
        <thead>
          <tr><th>Image</th><th>Name</th><th>Category</th><th>Price</th><th>Stock</th><th>Actions</th></tr>
        </thead>
        <tbody>
          ${products.map(p => `
            <tr>
              <td>${p.image
                ? `<img src="${p.image}" alt="${p.name}" class="admin-thumb" onerror="this.style.display='none'">`
                : `<span style="font-size:1.8rem">${p.emoji || '🌿'}</span>`}</td>
              <td>${p.name}</td>
              <td>${p.category}</td>
              <td>₹${p.price}</td>
              <td>${p.stock}</td>
              <td><button class="btn-danger" onclick="deleteProduct('${p._id}')">🗑 Delete</button></td>
            </tr>`).join('')}
        </tbody>
      </table>`;
  } catch (err) {
    container.innerHTML = `<p style="color:var(--text-muted)">⚠️ ${err.message}</p>`;
  }
}

async function deleteProduct(id) {
  if (!confirm('Delete this product?')) return;
  try {
    await api.deleteProduct(id);
    delete _productCache[id];
    showToast('🗑 Product deleted.');
    renderAdminProducts();
    cart = cart.filter(c => c._id !== id);
    saveCart(); updateCartBadge();
  } catch (err) { showToast('⚠️ ' + err.message); }
}

// ── Admin: All Orders ─────────────────────────────────────────
async function renderAdminOrders() {
  const container = document.getElementById('adminOrderList');
  if (!container) return;
  try {
    const orders = await api.getOrders();
    if (orders.length === 0) {
      container.innerHTML = '<p style="color:var(--text-muted);padding:20px">No orders yet.</p>';
      return;
    }
    container.innerHTML = orders.map(o => `
      <div class="order-card" style="border-left-color:var(--amber-dark)">
        <div class="order-header">
          <div>
            <div class="order-id">Order #${String(o._id).slice(-6).toUpperCase()}</div>
            <div class="order-date">${new Date(o.createdAt).toLocaleString('en-IN')}</div>
          </div>
          <select onchange="updateOrderStatus('${o._id}',this.value)"
            style="padding:6px 12px;border-radius:8px;border:1.5px solid var(--green-light);font-family:var(--font-body);font-size:0.85rem">
            <option ${o.status==='Placed'    ? 'selected' : ''}>Placed</option>
            <option ${o.status==='Shipped'   ? 'selected' : ''}>Shipped</option>
            <option ${o.status==='Delivered' ? 'selected' : ''}>Delivered</option>
          </select>
        </div>
        <div class="order-items-list">
          ${o.items.map(i=>`<div class="order-item-row"><span>${i.emoji||''} ${i.name} ×${i.qty}</span><span>₹${i.price*i.qty}</span></div>`).join('')}
        </div>
        <div class="order-total">Total: ₹${o.total}</div>
        <div class="order-buyer">👤 ${o.buyer.name} · 📱 ${o.buyer.phone}<br/>📍 ${o.buyer.address}</div>
      </div>`).join('');
  } catch (err) {
    container.innerHTML = `<p style="color:var(--text-muted)">⚠️ ${err.message}</p>`;
  }
}

async function updateOrderStatus(id, status) {
  try {
    await api.updateOrder(id, { status });
    showToast(`📦 Status updated to "${status}"`);
  } catch (err) { showToast('⚠️ ' + err.message); }
}

// ── Admin Tabs ────────────────────────────────────────────────
function switchAdminTab(tab, btn) {
  document.querySelectorAll('.admin-panel').forEach(p => p.style.display = 'none');
  document.querySelectorAll('.tab-btn').forEach(b => b.classList.remove('active'));
  document.getElementById('admin-' + tab).style.display = 'block';
  if (btn) btn.classList.add('active');
  if (tab === 'manageProducts') renderAdminProducts();
  if (tab === 'allOrders')      renderAdminOrders();
}

// ── Product Modal ─────────────────────────────────────────────
async function openModal(id) {
  try {
    const p = _productCache[id] || await api.getProduct(id);
    _productCache[p._id] = p;

    const imgHTML = p.image
      ? `<img src="${p.image}" alt="${p.name}" class="modal-hero-img"
           onerror="this.style.display='none'">`
      : `<div style="text-align:center;padding:30px;font-size:5rem;background:var(--green-pale)">${p.emoji||'🌿'}</div>`;

    document.getElementById('modalBody').innerHTML = `
      ${imgHTML}
      <div class="modal-body">
        <div class="modal-cat">${p.category}</div>
        <h2>${p.name}</h2>
        <p class="modal-desc">${p.desc || 'No description available.'}</p>
        <div class="modal-price">₹${p.price} <span style="font-size:.85rem;color:var(--text-muted);font-weight:400">/ ${p.unit||'unit'}</span></div>
        <div class="modal-stock">📦 ${p.stock > 0 ? p.stock + ' units available' : 'Out of stock'}</div>
        ${p.tags?.length ? `<div class="modal-tags">${p.tags.map(t=>`<span class="tag">#${t}</span>`).join('')}</div>` : ''}
        <button class="btn-primary" style="width:100%" onclick="addToCart('${p._id}');closeModal()" ${p.stock<=0?'disabled':''}>
          ${p.stock<=0 ? '❌ Out of Stock' : '🛒 Add to Cart'}
        </button>
      </div>`;

    // Reset scroll inside modal
    document.querySelector('.modal-card').scrollTop = 0;
    document.getElementById('modalOverlay').classList.add('open');
  } catch (err) { showToast('⚠️ ' + err.message); }
}

function closeModal() {
  document.getElementById('modalOverlay').classList.remove('open');
}

// ── Event listeners ───────────────────────────────────────────
document.getElementById('hamburger').addEventListener('click', () => {
  document.getElementById('mobileMenu').classList.toggle('open');
});

document.querySelectorAll('[data-page]').forEach(el => {
  el.addEventListener('click', e => {
    e.preventDefault();
    navigate(el.dataset.page);
    document.getElementById('mobileMenu').classList.remove('open');
  });
});

document.addEventListener('keydown', e => {
  if (e.key === 'Escape') closeModal();
});

// ── Init ──────────────────────────────────────────────────────
updateCartBadge();
navigate('home');
