/* YOULAB landing — каталог, фильтры, корзина, оформление заказа */

const CONFIG = {
  telegram: "a_dmi77",       // username без @ — куда приходят заказы и корпоративные заявки
  pageSize: 12,            // сколько карточек показывать за раз
  hitsCount: 4,            // сколько хитов на главной
};

const fmt = (n) => n.toLocaleString("ru-RU") + " ₽";
let PRODUCTS = [];
let activeCategory = "Все";
let shown = CONFIG.pageSize;
const cart = JSON.parse(localStorage.getItem("youlab_cart") || "{}");

async function init() {
  const res = await fetch("data/products.json");
  PRODUCTS = (await res.json()).filter((p) => p.image);
  document.getElementById("statProducts").textContent = PRODUCTS.length + "+";
  renderChips();
  renderHits();
  renderCatalog();
  updateCartUI();
  const tg = CONFIG.telegram ? `https://t.me/${CONFIG.telegram}` : "#";
  for (const id of ["tgCorpBtn", "tgFooter", "botBtn"]) document.getElementById(id).href = tg;
  if (window.sb) {
    const { data: { session } } = await sb.auth.getSession();
    if (session) document.getElementById("loginLink").textContent = "Кабинет";
  }
  handleDeepLink();
}

// Прямая ссылка на товар: ?p=SLUG — открыть каталог и подсветить набор
function handleDeepLink() {
  const slug = new URLSearchParams(location.search).get("p");
  if (!slug) return;
  const prod = PRODUCTS.find((p) => p.slug === slug);
  if (!prod) return;
  activeCategory = "Все";
  const idx = PRODUCTS.filter((p) => true).indexOf(prod);
  shown = Math.max(shown, PRODUCTS.length);   // показать все, чтобы товар точно был в сетке
  renderChips();
  renderCatalog();
  const el = document.getElementById("p-" + slug);
  if (el) {
    el.scrollIntoView({ behavior: "smooth", block: "center" });
    el.classList.add("card-highlight");
    setTimeout(() => el.classList.remove("card-highlight"), 4000);
  }
}

function renderChips() {
  const cats = ["Все", ...new Set(PRODUCTS.map((p) => p.category))];
  const box = document.getElementById("chips");
  box.innerHTML = "";
  for (const cat of cats) {
    const b = document.createElement("button");
    b.className = "chip" + (cat === activeCategory ? " active" : "");
    b.textContent = cat;
    b.onclick = () => { activeCategory = cat; shown = CONFIG.pageSize; renderChips(); renderCatalog(); };
    box.appendChild(b);
  }
}

function card(p, anchor) {
  const el = document.createElement("div");
  el.className = "card";
  if (anchor) el.id = "p-" + p.slug;
  el.innerHTML = `
    <div class="card-img">${p.image ? `<img src="data/${p.image}" alt="${p.name}" loading="lazy">` : `<span class="no-photo">фото скоро</span>`}</div>
    <div class="card-cat">${p.category}</div>
    <div class="card-name">${p.name}</div>
    <div class="card-bottom">
      <span class="card-price">${p.price ? fmt(p.price) : "по запросу"}</span>
      <button class="card-add" data-sku="${p.sku}">В корзину</button>
    </div>`;
  el.querySelector(".card-add").onclick = (e) => addToCart(p.sku, e.target);
  return el;
}

function renderHits() {
  const grid = document.getElementById("hitsGrid");
  grid.innerHTML = "";
  [...PRODUCTS].sort((a, b) => (b.q3_orders || 0) - (a.q3_orders || 0))
    .slice(0, CONFIG.hitsCount).forEach((p) => grid.appendChild(card(p)));
}

function renderCatalog() {
  const grid = document.getElementById("catalogGrid");
  grid.innerHTML = "";
  const list = PRODUCTS.filter((p) => activeCategory === "Все" || p.category === activeCategory);
  list.slice(0, shown).forEach((p) => grid.appendChild(card(p, true)));
  const more = document.getElementById("moreBtn");
  more.hidden = list.length <= shown;
  more.onclick = () => { shown += CONFIG.pageSize; renderCatalog(); };
}

/* --- Корзина --- */
function addToCart(sku, btn) {
  cart[sku] = (cart[sku] || 0) + 1;
  saveCart();
  if (btn) {
    btn.textContent = "Добавлено";
    btn.classList.add("added");
    setTimeout(() => { btn.textContent = "В корзину"; btn.classList.remove("added"); }, 1200);
  }
}

function saveCart() {
  localStorage.setItem("youlab_cart", JSON.stringify(cart));
  updateCartUI();
}

function cartEntries() {
  return Object.entries(cart)
    .map(([sku, qty]) => ({ p: PRODUCTS.find((x) => x.sku === sku), qty }))
    .filter((e) => e.p);
}

function updateCartUI() {
  const count = Object.values(cart).reduce((s, q) => s + q, 0);
  const badge = document.getElementById("cartCount");
  badge.hidden = count === 0;
  badge.textContent = count;

  const body = document.getElementById("cartItems");
  const entries = cartEntries();
  if (!entries.length) {
    body.innerHTML = `<p class="cart-empty">Корзина пуста — загляните в каталог</p>`;
    document.getElementById("cartFoot").hidden = true;
    document.getElementById("checkoutForm").hidden = true;
    return;
  }
  document.getElementById("cartFoot").hidden = false;
  body.innerHTML = "";
  let total = 0;
  for (const { p, qty } of entries) {
    total += (p.price || 0) * qty;
    const row = document.createElement("div");
    row.className = "cart-item";
    row.innerHTML = `
      ${p.image ? `<img src="data/${p.image}" alt="">` : `<div style="width:64px;height:64px;border-radius:10px;background:var(--gray-bg)"></div>`}
      <div class="cart-item-info">
        <div class="cart-item-name">${p.name}</div>
        <div class="cart-item-price">${p.price ? fmt(p.price) : "цена по запросу"}</div>
        <div class="qty">
          <button data-a="-">−</button><span>${qty}</span><button data-a="+">+</button>
        </div>
      </div>
      <button class="cart-item-remove" aria-label="Удалить">×</button>`;
    row.querySelector('[data-a="-"]').onclick = () => { cart[p.sku] > 1 ? cart[p.sku]-- : delete cart[p.sku]; saveCart(); };
    row.querySelector('[data-a="+"]').onclick = () => { cart[p.sku]++; saveCart(); };
    row.querySelector(".cart-item-remove").onclick = () => { delete cart[p.sku]; saveCart(); };
    body.appendChild(row);
  }
  document.getElementById("cartTotal").textContent = fmt(total);
}

/* --- Drawer --- */
const drawer = document.getElementById("cartDrawer");
const backdrop = document.getElementById("drawerBackdrop");
function openDrawer() { drawer.classList.add("open"); backdrop.hidden = false; }
function closeDrawer() { drawer.classList.remove("open"); backdrop.hidden = true; }
document.getElementById("cartBtn").onclick = openDrawer;
document.getElementById("drawerClose").onclick = closeDrawer;
backdrop.onclick = closeDrawer;

/* --- Оформление --- */
document.getElementById("checkoutBtn").onclick = () => {
  document.getElementById("checkoutForm").hidden = false;
  document.getElementById("checkoutBtn").hidden = true;
};

async function saveOrderToAccount(f) {
  if (!window.sb) return;
  try {
    const { data: { session } } = await sb.auth.getSession();
    if (!session) return;
    const items = cartEntries().map(({ p, qty }) => ({ sku: p.sku, name: p.name, qty, price: p.price || 0 }));
    const total = items.reduce((s, i) => s + i.price * i.qty, 0);
    await sb.from("orders").insert({
      user_id: session.user.id, items, total,
      name: f.get("name"), phone: f.get("phone"), email: f.get("email"),
      address: f.get("address"), comment: f.get("comment") || "",
    });
  } catch (err) {
    console.warn("Заказ не сохранился в кабинет:", err);
  }
}

document.getElementById("checkoutForm").onsubmit = (e) => {
  e.preventDefault();
  const f = new FormData(e.target);
  saveOrderToAccount(f);
  const lines = cartEntries().map(({ p, qty }) =>
    `• ${p.name} ×${qty}${p.price ? ` — ${fmt(p.price * qty)}` : ""}`);
  const total = cartEntries().reduce((s, { p, qty }) => s + (p.price || 0) * qty, 0);
  const text = [
    "Новый заказ с сайта YOULAB", "",
    ...lines, "",
    `Итого: ${fmt(total)}`, "",
    `Имя: ${f.get("name")}`,
    `Телефон: ${f.get("phone")}`,
    `Email: ${f.get("email")}`,
    `Адрес: ${f.get("address")}`,
    f.get("comment") ? `Комментарий: ${f.get("comment")}` : "",
  ].filter(Boolean).join("\n");

  if (CONFIG.telegram) {
    window.open(`https://t.me/${CONFIG.telegram}?text=${encodeURIComponent(text)}`, "_blank");
  } else {
    alert("Заказ сформирован:\n\n" + text + "\n\n(укажите telegram в CONFIG, чтобы заказы уходили вам)");
  }
};

init();
