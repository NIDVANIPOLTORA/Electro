const API = "/api"; // тот же адрес, что и у сайта: запросы идут через nginx
const CART_KEY = "electro-cart";

let products = [];
let cart = loadCart();
let category = "";

function loadCart() {
  try { return JSON.parse(localStorage.getItem(CART_KEY)) || {}; } catch { return {}; }
}
function saveCart() {
  try { localStorage.setItem(CART_KEY, JSON.stringify(cart)); } catch {}
  renderCart();
}
const money = (n) => n.toLocaleString("ru-RU");

async function getJSON(url) {
  const r = await fetch(API + url);
  if (!r.ok) throw new Error("Ошибка загрузки");
  return r.json();
}

async function init() {
  try {
    const info = await getJSON("/info");
    document.getElementById("info").textContent =
      `${info.scheme}://${info.host} · секрет подключен: ${info.secret_loaded}`;
    const cats = await getJSON("/categories");
    renderChips(cats);
    products = await getJSON("/products");
    renderGrid();
    renderCart();
  } catch (e) {
    document.getElementById("grid").textContent = "Не удалось загрузить каталог";
  }
}

function renderChips(cats) {
  const box = document.getElementById("chips");
  box.innerHTML = "";
  [{ id: "", name: "Все" }, ...cats].forEach((c) => {
    const b = document.createElement("button");
    b.className = "chip" + (c.id === category ? " active" : "");
    b.textContent = c.name;
    b.onclick = () => { category = c.id; renderChips(cats); renderGrid(); };
    box.appendChild(b);
  });
}

function renderGrid() {
  const grid = document.getElementById("grid");
  grid.innerHTML = "";
  products.filter((p) => !category || p.category === category).forEach((p) => {
    const card = document.createElement("div");
    card.className = "card";
    const icon = document.createElement("div"); icon.className = "icon"; icon.textContent = p.icon;
    const h = document.createElement("h3"); h.textContent = p.name;
    const d = document.createElement("p"); d.textContent = p.desc;
    const price = document.createElement("div"); price.className = "price"; price.textContent = money(p.price) + " ₽";
    const btn = document.createElement("button"); btn.className = "primary"; btn.textContent = "В корзину";
    btn.onclick = () => { cart[p.id] = Math.min((cart[p.id] || 0) + 1, 99); saveCart(); };
    card.append(icon, h, d, price, btn);
    grid.appendChild(card);
  });
}

function renderCart() {
  const list = document.getElementById("cart-list");
  list.innerHTML = "";
  let total = 0, count = 0;
  Object.entries(cart).forEach(([id, qty]) => {
    const p = products.find((x) => x.id === Number(id));
    if (!p) return;
    total += p.price * qty; count += qty;
    const li = document.createElement("li");
    const name = document.createElement("span"); name.textContent = `${p.name} × ${qty}`;
    const ctr = document.createElement("span");
    const minus = document.createElement("button"); minus.textContent = "−";
    minus.onclick = () => { cart[id] = qty - 1; if (cart[id] <= 0) delete cart[id]; saveCart(); };
    const plus = document.createElement("button"); plus.textContent = "+";
    plus.onclick = () => { cart[id] = Math.min(qty + 1, 99); saveCart(); };
    ctr.append(minus, " ", plus);
    li.append(name, ctr);
    list.appendChild(li);
  });
  document.getElementById("cart-total").textContent = money(total);
  document.getElementById("cart-count").textContent = count;
}

document.getElementById("cart-btn").onclick = () => { document.getElementById("cart").hidden = false; };
document.getElementById("cart-close").onclick = () => { document.getElementById("cart").hidden = true; };

document.getElementById("order-form").addEventListener("submit", async (e) => {
  e.preventDefault();
  const msg = document.getElementById("msg");
  const items = Object.entries(cart).map(([id, qty]) => ({ id: Number(id), qty }));
  if (!items.length) { msg.className = "msg err"; msg.textContent = "Корзина пуста"; return; }
  const r = await fetch(API + "/orders", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      name: document.getElementById("f-name").value,
      phone: document.getElementById("f-phone").value,
      items,
    }),
  });
  const data = await r.json();
  if (r.ok) {
    cart = {}; saveCart();
    msg.className = "msg ok";
    msg.textContent = `Заказ №${data.id} оформлен на сумму ${money(data.total)} ₽`;
    e.target.reset();
  } else {
    msg.className = "msg err";
    msg.textContent = data.error || "Ошибка";
  }
});

init();
