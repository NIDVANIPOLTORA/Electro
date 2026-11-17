const API = "/api";
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
    const active = c.id === category;
    b.className =
      "border rounded-full px-3.5 py-2 cursor-pointer " +
      (active
        ? "bg-dark text-white border-dark"
        : "bg-white border-gray-300 text-[#1d2330]");
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
    card.className =
      "bg-white rounded-[14px] p-[18px] flex flex-col gap-2 shadow-[0_1px_3px_rgba(0,0,0,0.08)]";

    const icon = document.createElement("div");
    icon.className = "text-[42px]";
    icon.textContent = p.icon;

    const h = document.createElement("h3");
    h.className = "m-0 text-base font-bold";
    h.textContent = p.name;

    const d = document.createElement("p");
    d.className = "m-0 text-muted text-sm flex-1";
    d.textContent = p.desc;

    const price = document.createElement("div");
    price.className = "font-bold text-lg";
    price.textContent = money(p.price) + " ₽";

    const btn = document.createElement("button");
    btn.className = "bg-accent border-0 rounded-lg px-3.5 py-2.5 font-semibold cursor-pointer";
    btn.textContent = "В корзину";
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
    li.className = "flex justify-between gap-2 py-2 border-b border-[#eee] text-sm";

    const name = document.createElement("span");
    name.textContent = `${p.name} × ${qty}`;

    const ctr = document.createElement("span");
    ctr.className = "flex items-center gap-1";

    const btnClass = "border border-gray-300 bg-white rounded-md cursor-pointer px-2 py-0.5";

    const minus = document.createElement("button");
    minus.className = btnClass;
    minus.textContent = "−";
    minus.onclick = () => { cart[id] = qty - 1; if (cart[id] <= 0) delete cart[id]; saveCart(); };

    const plus = document.createElement("button");
    plus.className = btnClass;
    plus.textContent = "+";
    plus.onclick = () => { cart[id] = Math.min(qty + 1, 99); saveCart(); };

    ctr.append(minus, plus);
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
  if (!items.length) {
    msg.className = "msg min-h-[20px] text-sm text-[#b42318]";
    msg.textContent = "Корзина пуста";
    return;
  }
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
    msg.className = "msg min-h-[20px] text-sm text-[#067647]";
    msg.textContent = `Заказ №${data.id} оформлен на сумму ${money(data.total)} ₽`;
    e.target.reset();
  } else {
    msg.className = "msg min-h-[20px] text-sm text-[#b42318]";
    msg.textContent = data.error || "Ошибка";
  }
});

init();