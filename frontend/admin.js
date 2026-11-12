const money = (n) => n.toLocaleString("ru-RU");

document.getElementById("login").addEventListener("submit", async (e) => {
  e.preventDefault();
  const msg = document.getElementById("msg");
  const box = document.getElementById("orders");
  box.innerHTML = "";
  const r = await fetch("/api/admin/orders", {
    headers: { "X-Admin-Password": document.getElementById("pwd").value },
  });
  const data = await r.json();
  if (!r.ok) { msg.className = "msg err"; msg.textContent = data.error || "Ошибка"; return; }
  msg.className = "msg ok";
  msg.textContent = data.length ? `Заказов: ${data.length}` : "Заказов пока нет";

  const table = document.createElement("table");
  const head = table.insertRow();
  ["№", "Дата", "Клиент", "Состав", "Сумма"].forEach((t) => {
    const th = document.createElement("th"); th.textContent = t; head.appendChild(th);
  });
  data.forEach((o) => {
    const row = table.insertRow();
    row.insertCell().textContent = o.id;
    row.insertCell().textContent = o.created.replace("T", " ").replace("+00:00", " UTC");
    row.insertCell().textContent = `${o.name}, ${o.phone}`;
    row.insertCell().textContent = o.items.map((i) => `${i.name} × ${i.qty}`).join("; ");
    row.insertCell().textContent = money(o.total) + " ₽";
  });
  box.appendChild(table);
});
