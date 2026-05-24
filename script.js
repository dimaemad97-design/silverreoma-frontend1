// =============================================
// SILVERREOMA — Frontend JS (API-Integrated)
// =============================================

const API = 'https://silverreoma-backend1-mecn.vercel.app/api';

let currentUser = null;
let allProducts = [];
let activeCategory = 'all';

// ---- Helpers ----
const getToken = () => localStorage.getItem('sr_token');
const setToken = t => localStorage.setItem('sr_token', t);
const clearToken = () => localStorage.removeItem('sr_token');

async function api(endpoint, opts = {}) {
  const headers = { ...(opts.headers || {}) };
  const token = getToken();
  if (token) headers['Authorization'] = `Bearer ${token}`;
  // Don't set Content-Type for FormData (multer needs multipart boundary)
  if (!(opts.body instanceof FormData)) headers['Content-Type'] = 'application/json';

  const res = await fetch(`${API}${endpoint}`, { ...opts, headers });
  const data = await res.json();
  if (!res.ok) throw new Error(data.error || 'حدث خطأ');
  return data;
}

// ---- Toast ----
function showToast(msg, type = 'success') {
  const c = document.getElementById('toast-container');
  const t = document.createElement('div');
  t.className = `toast toast-${type}`;
  t.textContent = msg;
  c.appendChild(t);
  setTimeout(() => t.remove(), 3000);
}

// ---- Modals ----
function openModal(id) {
  document.getElementById(id).classList.add('open');
  document.body.style.overflow = 'hidden';
}
function closeModal(id) {
  document.getElementById(id).classList.remove('open');
  document.body.style.overflow = '';
}

// ---- Navbar scroll effect ----
window.addEventListener('scroll', () => {
  document.getElementById('navbar').classList.toggle('scrolled', window.scrollY > 50);
});

function goHome() {
  window.scrollTo({ top: 0, behavior: 'smooth' });
}

let mobileOpen = false;
function toggleMobileMenu() {
  mobileOpen = !mobileOpen;
  document.getElementById('nav-links').classList.toggle('open', mobileOpen);
  document.getElementById('nav-actions').classList.toggle('open', mobileOpen);
}

// =============================================
// AUTH
// =============================================
async function handleLogin(e) {
  e.preventDefault();
  clearToken(); // clear any stale session
  const email = document.getElementById('loginEmail').value.trim();
  const password = document.getElementById('loginPassword').value;
  try {
    const data = await api('/auth/login', { method: 'POST', body: JSON.stringify({ email, password }) });
    setToken(data.token);
    currentUser = data.user;
    closeModal('loginModal');
    onAuthChange();
    showToast(`مرحباً ${data.user.name}`);
  } catch (err) { showToast(err.message, 'error'); }
}

async function handleRegister(e) {
  e.preventDefault();
  const name = document.getElementById('regName').value.trim();
  const email = document.getElementById('regEmail').value.trim();
  const password = document.getElementById('regPassword').value;
  try {
    const data = await api('/auth/register', { method: 'POST', body: JSON.stringify({ name, email, password }) });
    setToken(data.token);
    currentUser = data.user;
    closeModal('registerModal');
    onAuthChange();
    showToast(`مرحباً ${data.user.name}`);
  } catch (err) { showToast(err.message, 'error'); }
}

function logout() {
  clearToken();
  currentUser = null;
  onAuthChange();
  updateCartUI([], 0);
  showToast('تم تسجيل الخروج');
}

async function restoreSession() {
  if (!getToken()) return;
  try {
    const data = await api('/auth/profile');
    currentUser = data.user;
  } catch { clearToken(); }
}

function onAuthChange() {
  renderNav();
  if (currentUser) loadCart();
}

function renderNav() {
  const el = document.getElementById('nav-actions');
  if (currentUser) {
    el.innerHTML = `
      <span class="user-greeting">مرحباً، ${currentUser.name}</span>
      <button class="nav-btn" onclick="openModal('ordersModal'); loadMyOrders();">طلباتي</button>
      ${currentUser.role === 'admin' ? '<button class="nav-btn btn-admin" onclick="openAdminDashboard()">لوحة التحكم</button>' : ''}
      <button class="nav-btn" onclick="logout()">خروج</button>
    `;
  } else {
    el.innerHTML = `
      <button class="nav-btn" onclick="openModal('loginModal')">دخول</button>
      <button class="nav-btn" onclick="openModal('registerModal')">حساب جديد</button>
    `;
  }
}

// =============================================
// PRODUCTS
// =============================================
const CATEGORY_LABELS = {
  bracelets: 'أساور', necklaces: 'قلادات', rings: 'خواتم',
  men_bracelets: 'رجالي', sets: 'أطقم', earrings: 'حلق'
};

async function loadProducts() {
  try {
    allProducts = await api('/products');
    renderProducts();
  } catch (err) {
    console.error(err);
  }
}

function renderProducts() {
  const grid = document.getElementById('products-grid');
  const empty = document.getElementById('empty-state');
  const searchVal = (document.getElementById('searchInput')?.value || '').toLowerCase();

  let filtered = allProducts;
  if (activeCategory !== 'all') {
    filtered = filtered.filter(p => p.category === activeCategory);
  }
  if (searchVal) {
    filtered = filtered.filter(p =>
      p.name.toLowerCase().includes(searchVal) ||
      (p.description || '').toLowerCase().includes(searchVal)
    );
  }

  if (filtered.length === 0) {
    grid.innerHTML = '';
    empty.style.display = 'block';
    return;
  }
  empty.style.display = 'none';

  grid.innerHTML = filtered.map((p, i) => `
    <div class="product-card" style="animation-delay:${Math.min(i * 0.05, 0.4)}s" onclick="viewProduct(${p.id})">
      <div class="card-img-wrap">
        ${p.image ? `<img src="${p.image}" alt="${p.name}" loading="lazy">` : '<div class="no-img">◇</div>'}
        <span class="card-category">${CATEGORY_LABELS[p.category] || p.category}</span>
      </div>
      <div class="card-body">
        <div class="card-name">${p.name}</div>
        <div class="card-desc">${p.description || 'فضة عيار ٩٢٥ — طلاء روديوم'}</div>
        <div class="card-bottom">
          <span class="card-price">${Number(p.price).toLocaleString()} <small>د.ع</small></span>
          <button class="card-buy" onclick="event.stopPropagation(); addToCart(${p.id})">أضف للسلة</button>
        </div>
      </div>
    </div>
  `).join('');
}

function showCategory(cat) {
  activeCategory = cat;
  document.querySelectorAll('.nav-link').forEach(l => l.classList.toggle('active', l.dataset.cat === cat));
  renderProducts();
  document.getElementById('shop-section').scrollIntoView({ behavior: 'smooth' });
}

function searchProducts() { renderProducts(); }

function viewProduct(id) {
  const p = allProducts.find(x => x.id === id);
  if (!p) return;
  document.getElementById('product-view-content').innerHTML = `
    ${p.image ? `<img src="${p.image}" class="pv-image" alt="${p.name}">` : '<div class="pv-image no-img" style="aspect-ratio:1;border-radius:8px;">◇</div>'}
    <div class="pv-name">${p.name}</div>
    <div class="pv-desc">${p.description || 'فضة عيار ٩٢٥ — طلاء روديوم'}</div>
    <div class="pv-price">${Number(p.price).toLocaleString()} د.ع</div>
    <button class="pv-buy" onclick="addToCart(${p.id}); closeModal('productViewModal');">أضف للسلة</button>
  `;
  openModal('productViewModal');
}

// =============================================
// CART
// =============================================
function openCart() {
  document.getElementById('cart-drawer').classList.add('open');
  document.getElementById('cart-overlay').classList.add('open');
}
function closeCart() {
  document.getElementById('cart-drawer').classList.remove('open');
  document.getElementById('cart-overlay').classList.remove('open');
}

async function addToCart(productId) {
  if (!currentUser) { showToast('يرجى تسجيل الدخول أولاً', 'error'); openModal('loginModal'); return; }
  try {
    const data = await api('/cart', { method: 'POST', body: JSON.stringify({ product_id: productId }) });
    updateCartUI(data.items, data.total);
    showToast('تمت الإضافة للسلة');
    // Badge pop
    document.getElementById('cart-count').classList.add('has-items');
    setTimeout(() => document.getElementById('cart-count').classList.remove('has-items'), 300);
  } catch (err) { showToast(err.message, 'error'); }
}

async function loadCart() {
  if (!currentUser) return;
  try {
    const data = await api('/cart');
    updateCartUI(data.items, data.total);
  } catch {}
}

async function removeFromCart(productId) {
  try {
    const data = await api(`/cart/${productId}`, { method: 'DELETE' });
    updateCartUI(data.items, data.total);
  } catch (err) { showToast(err.message, 'error'); }
}

async function updateQty(productId, qty) {
  try {
    const data = await api(`/cart/${productId}`, { method: 'PUT', body: JSON.stringify({ quantity: qty }) });
    updateCartUI(data.items, data.total);
  } catch (err) { showToast(err.message, 'error'); }
}

function updateCartUI(items, total) {
  const badge = document.getElementById('cart-count');
  const body = document.getElementById('cart-items');
  const footer = document.getElementById('cart-footer');
  const totalEl = document.getElementById('cart-total');

  const count = items.reduce((s, i) => s + i.quantity, 0);
  badge.textContent = count;

  if (items.length === 0) {
    body.innerHTML = '<p class="empty-cart-msg">السلة فارغة</p>';
    footer.style.display = 'none';
    return;
  }

  footer.style.display = 'block';
  totalEl.textContent = `${Number(total).toLocaleString()} د.ع`;

  body.innerHTML = items.map(item => `
    <div class="cart-item">
      ${item.image ? `<img src="${item.image}" class="cart-item-img" alt="">` : '<div class="cart-item-img no-img" style="font-size:20px;">◇</div>'}
      <div class="cart-item-info">
        <div class="cart-item-name">${item.name}</div>
        <div class="cart-item-price">${(item.price * item.quantity).toLocaleString()} د.ع</div>
        <div class="cart-item-controls">
          <button class="qty-btn" onclick="updateQty(${item.product_id}, ${item.quantity - 1})">−</button>
          <span class="qty-num">${item.quantity}</span>
          <button class="qty-btn" onclick="updateQty(${item.product_id}, ${item.quantity + 1})">+</button>
          <button class="cart-item-remove" onclick="removeFromCart(${item.product_id})">حذف</button>
        </div>
      </div>
    </div>
  `).join('');
}

// =============================================
// CHECKOUT
// =============================================
function openCheckoutModal() {
  closeCart();
  // Pre-fill checkout summary
  const body = document.getElementById('cart-items');
  const items = body.querySelectorAll('.cart-item');
  openModal('checkoutModal');
  updateCheckoutSummary();
}

async function updateCheckoutSummary() {
  try {
    const data = await api('/cart');
    const el = document.getElementById('checkout-summary');
    if (data.items.length === 0) { el.innerHTML = '<p>السلة فارغة</p>'; return; }
    el.innerHTML = `
      ${data.items.map(i => `<div class="summary-row"><span>${i.name} × ${i.quantity}</span><span>${(i.price * i.quantity).toLocaleString()} د.ع</span></div>`).join('')}
      <div class="summary-total"><span>المجموع</span><span>${Number(data.total).toLocaleString()} د.ع</span></div>
    `;
  } catch {}
}

function togglePayment() {
  const method = document.querySelector('input[name="payMethod"]:checked').value;
  document.getElementById('card-fields').style.display = method === 'card' ? 'block' : 'none';
  document.getElementById('opt-cash').classList.toggle('selected', method === 'cash');
  document.getElementById('opt-card').classList.toggle('selected', method === 'card');
}

async function handleCheckout(e) {
  e.preventDefault();
  const btn = document.getElementById('checkout-submit-btn');
  btn.disabled = true;
  btn.innerHTML = '<span class="spinner"></span>';

  const method = document.querySelector('input[name="payMethod"]:checked').value;
  const payload = {
    payment_method: method,
    customer_name: document.getElementById('coName').value.trim(),
    customer_phone: document.getElementById('coPhone').value.trim(),
    customer_address: document.getElementById('coAddress').value.trim(),
    notes: document.getElementById('coNotes').value.trim(),
  };
  if (method === 'card') {
    payload.card_number = document.getElementById('coCardNum').value.trim();
    payload.card_name = document.getElementById('coCardName').value.trim();
    payload.card_expiry = document.getElementById('coCardExp').value;
    payload.card_cvv = document.getElementById('coCardCVV').value.trim();
    if (!payload.card_number || payload.card_number.length < 4) {
      showToast('رقم البطاقة غير صالح', 'error');
      btn.disabled = false; btn.textContent = 'تأكيد الطلب'; return;
    }
  }

  try {
    const data = await api('/orders/checkout', { method: 'POST', body: JSON.stringify(payload) });
    closeModal('checkoutModal');
    updateCartUI([], 0);
    showToast(data.message);
    document.getElementById('checkoutForm').reset();
    document.getElementById('card-fields').style.display = 'none';
  } catch (err) {
    showToast(err.message, 'error');
  } finally {
    btn.disabled = false; btn.textContent = 'تأكيد الطلب';
  }
}

// =============================================
// MY ORDERS
// =============================================
async function loadMyOrders() {
  const el = document.getElementById('orders-list');
  el.innerHTML = '<p style="text-align:center;padding:30px;color:#b5a899;">جاري التحميل...</p>';
  try {
    const orders = await api('/orders');
    if (orders.length === 0) { el.innerHTML = '<p style="text-align:center;padding:30px;color:#b5a899;">لا توجد طلبات سابقة</p>'; return; }
    el.innerHTML = orders.map(o => renderOrderCard(o, false)).join('');
  } catch (err) { el.innerHTML = `<p style="color:red;">${err.message}</p>`; }
}

function renderOrderCard(o, isAdmin = false) {
  const statusMap = {
    pending: ['بانتظار الموافقة', 'status-pending'],
    confirmed: ['مؤكد', 'status-confirmed'],
    rejected: ['مرفوض', 'status-rejected'],
    shipped: ['تم الشحن', 'status-shipped'],
    delivered: ['تم التوصيل', 'status-delivered'],
  };
  const [statusText, statusClass] = statusMap[o.status] || ['غير معروف', ''];

  return `
    <div class="${isAdmin ? 'admin-order-card' : 'order-card'}">
      <div class="order-header">
        <div>
          <span class="order-id">طلب #${o.id}</span>
          <span class="order-date" style="margin-right:12px;">${new Date(o.created_at).toLocaleDateString('ar-IQ', { year: 'numeric', month: 'long', day: 'numeric', hour: '2-digit', minute: '2-digit' })}</span>
        </div>
        <span class="order-status-badge ${statusClass}">${statusText}</span>
      </div>
      ${isAdmin ? `
        <div class="admin-order-meta">
          <strong>الزبون:</strong> ${o.user_name} (${o.user_email})<br>
          <strong>الاسم:</strong> ${o.customer_name || '—'} &nbsp;|&nbsp; <strong>الهاتف:</strong> ${o.customer_phone || '—'}<br>
          <strong>العنوان:</strong> ${o.customer_address || '—'}
          ${o.notes ? `<br><strong>ملاحظات:</strong> ${o.notes}` : ''}
        </div>
      ` : ''}
      <div class="order-items-list">
        ${o.items.map(i => `<div class="order-item-row"><span>${i.name} × ${i.quantity}</span><span>${(i.price * i.quantity).toLocaleString()} د.ع</span></div>`).join('')}
      </div>
      <div class="order-footer">
        <span class="order-total">${Number(o.total).toLocaleString()} د.ع</span>
        <span class="order-payment">${o.payment_method === 'cash' ? '💵 كاش' : '💳 بطاقة'}${o.card_last_four ? ` (****${o.card_last_four})` : ''}</span>
      </div>
      ${isAdmin ? renderAdminActions(o) : ''}
    </div>
  `;
}

function renderAdminActions(o) {
  const btns = [];
  if (o.status === 'pending') {
    btns.push(`<button class="btn-confirm" onclick="adminUpdateOrder(${o.id}, 'confirmed')">✓ تأكيد</button>`);
    btns.push(`<button class="btn-reject" onclick="adminUpdateOrder(${o.id}, 'rejected')">✗ رفض</button>`);
  }
  if (o.status === 'confirmed') {
    btns.push(`<button class="btn-ship" onclick="adminUpdateOrder(${o.id}, 'shipped')">📦 شحن</button>`);
  }
  if (o.status === 'shipped') {
    btns.push(`<button class="btn-deliver" onclick="adminUpdateOrder(${o.id}, 'delivered')">✓ تم التوصيل</button>`);
  }
  if (btns.length === 0) return '';
  return `<div class="admin-order-actions">${btns.join('')}</div>`;
}

// =============================================
// ADMIN DASHBOARD
// =============================================
async function openAdminDashboard() {
  openModal('adminModal');
  loadAdminStats();
  loadAdminProducts();
  loadAdminOrders();
}

function switchAdminTab(tab, btn) {
  document.querySelectorAll('.admin-panel').forEach(p => p.style.display = 'none');
  document.querySelectorAll('.admin-tab').forEach(t => t.classList.remove('active'));
  document.getElementById(`admin-tab-${tab}`).style.display = 'block';
  btn.classList.add('active');
}

async function loadAdminStats() {
  try {
    const s = await api('/orders/admin/stats');
    document.getElementById('admin-stats').innerHTML = `
      <div class="stat-card"><span class="stat-num">${s.total_products}</span><span class="stat-label">المنتجات</span></div>
      <div class="stat-card"><span class="stat-num">${s.total_orders}</span><span class="stat-label">الطلبات</span></div>
      <div class="stat-card"><span class="stat-num">${s.pending_orders}</span><span class="stat-label">بانتظار الموافقة</span></div>
      <div class="stat-card"><span class="stat-num">${Number(s.total_revenue).toLocaleString()}</span><span class="stat-label">الإيرادات (د.ع)</span></div>
      <div class="stat-card"><span class="stat-num">${s.total_users}</span><span class="stat-label">العملاء</span></div>
    `;
  } catch {}
}

async function loadAdminProducts() {
  try {
    const products = await api('/products');
    const el = document.getElementById('admin-products-list');
    if (products.length === 0) {
      el.innerHTML = '<p style="text-align:center;padding:30px;color:#b5a899;">لا توجد منتجات — أضف منتجك الأول!</p>';
      return;
    }
    el.innerHTML = products.map(p => `
      <div class="admin-product-card">
        ${p.image ? `<img src="${p.image}" alt="${p.name}">` : '<div class="no-img" style="aspect-ratio:1;">◇</div>'}
        <div class="apc-body">
          <div class="apc-name">${p.name}</div>
          <div class="apc-price">${Number(p.price).toLocaleString()} د.ع</div>
          <div class="apc-actions">
            <button class="apc-btn apc-btn-del" onclick="adminDeleteProduct(${p.id})">حذف</button>
          </div>
        </div>
      </div>
    `).join('');
  } catch {}
}

async function loadAdminOrders() {
  const el = document.getElementById('admin-orders-list');
  el.innerHTML = '<p style="text-align:center;padding:30px;color:#b5a899;">جاري التحميل...</p>';
  try {
    const orders = await api('/orders/admin/all');
    if (orders.length === 0) { el.innerHTML = '<p style="text-align:center;padding:30px;color:#b5a899;">لا توجد طلبات بعد</p>'; return; }
    el.innerHTML = orders.map(o => renderOrderCard(o, true)).join('');
  } catch (err) { el.innerHTML = `<p style="color:red;">${err.message}</p>`; }
}

async function adminUpdateOrder(orderId, status) {
  try {
    const data = await api(`/orders/admin/${orderId}/status`, {
      method: 'PUT', body: JSON.stringify({ status })
    });
    showToast(data.message);
    loadAdminOrders();
    loadAdminStats();
  } catch (err) { showToast(err.message, 'error'); }
}

async function adminDeleteProduct(id) {
  if (!confirm('هل أنت متأكد من حذف هذا المنتج؟')) return;
  try {
    await api(`/products/${id}`, { method: 'DELETE' });
    showToast('تم حذف المنتج');
    loadAdminProducts();
    loadAdminStats();
    loadProducts();
  } catch (err) { showToast(err.message, 'error'); }
}

// ---- Image source toggle ----
let imageSource = 'file'; // 'file' or 'url'

function switchImageSource(src, btn) {
  imageSource = src;
  document.querySelectorAll('.img-toggle-btn').forEach(b => b.classList.remove('active'));
  btn.classList.add('active');
  document.getElementById('img-src-file').style.display = src === 'file' ? 'block' : 'none';
  document.getElementById('img-src-url').style.display = src === 'url' ? 'block' : 'none';
  clearImagePreview();
}

function previewImage(input) {
  const file = input.files[0];
  if (!file) { clearImagePreview(); return; }
  const reader = new FileReader();
  reader.onload = e => showPreview(e.target.result);
  reader.readAsDataURL(file);
}

function previewUrl(url) {
  if (!url.trim()) { clearImagePreview(); return; }
  showPreview(url.trim());
}

function showPreview(src) {
  const box = document.getElementById('img-preview');
  const img = document.getElementById('img-preview-el');
  img.src = src;
  img.onerror = () => { box.style.display = 'none'; };
  img.onload = () => { box.style.display = 'block'; };
}

function clearImagePreview() {
  document.getElementById('img-preview').style.display = 'none';
  document.getElementById('img-preview-el').src = '';
  document.getElementById('apImage').value = '';
  document.getElementById('apImageUrl').value = '';
}

async function handleAddProduct(e) {
  e.preventDefault();
  const form = new FormData();
  form.append('name', document.getElementById('apName').value.trim());
  form.append('price', document.getElementById('apPrice').value);
  form.append('category', document.getElementById('apCategory').value);
  form.append('description', document.getElementById('apDesc').value.trim());

  if (imageSource === 'file') {
    const fileInput = document.getElementById('apImage');
    if (fileInput.files[0]) form.append('image', fileInput.files[0]);
  } else {
    const url = document.getElementById('apImageUrl').value.trim();
    if (url) form.append('image_url', url);
  }

  try {
    await api('/products', { method: 'POST', body: form });
    showToast('تمت إضافة المنتج');
    document.getElementById('addProductForm').reset();
    clearImagePreview();
    imageSource = 'file';
    document.querySelectorAll('.img-toggle-btn')[0].classList.add('active');
    document.querySelectorAll('.img-toggle-btn')[1].classList.remove('active');
    document.getElementById('img-src-file').style.display = 'block';
    document.getElementById('img-src-url').style.display = 'none';
    loadAdminProducts();
    loadAdminStats();
    loadProducts();
  } catch (err) { showToast(err.message, 'error'); }
}

// =============================================
// INIT
// =============================================
document.addEventListener('DOMContentLoaded', async () => {
  renderNav();
  await restoreSession();
  renderNav();
  loadProducts();
  if (currentUser) loadCart();
});
