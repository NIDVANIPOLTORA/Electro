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

  if (!r.ok) {
    msg.className = "msg min-h-[20px] text-sm text-[#b42318]";
    msg.textContent = data.error || "Ошибка";
    return;
  }

  msg.className = "msg min-h-[20px] text-sm text-[#067647]";
  msg.textContent = data.length ? `Заказов: ${data.length}` : "Заказов пока нет";

  const table = document.createElement("table");
  table.className = "w-full border-collapse bg-white rounded-xl overflow-hidden";

  const head = table.insertRow();
  ["№", "Дата", "Клиент", "Состав", "Сумма"].forEach((t) => {
    const th = document.createElement("th");
    th.className =
      "text-left px-3 py-2.5 border-b border-[#eee] text-sm align-top bg-[#f2f4f7] font-semibold";
    th.textContent = t;
    head.appendChild(th);
  });

  data.forEach((o) => {
    const row = table.insertRow();
    const cellClass = "text-left px-3 py-2.5 border-b border-[#eee] text-sm align-top";

    let c = row.insertCell();
    c.className = cellClass;
    c.textContent = o.id;

    c = row.insertCell();
    c.className = cellClass;
    c.textContent = o.created.replace("T", " ").replace("+00:00", " UTC");

    c = row.insertCell();
    c.className = cellClass;
    c.textContent = `${o.name}, ${o.phone}`;

    c = row.insertCell();
    c.className = cellClass;
    c.textContent = o.items.map((i) => `${i.name} × ${i.qty}`).join("; ");

    c = row.insertCell();
    c.className = cellClass;
    c.textContent = money(o.total) + " ₽";
  });

  box.appendChild(table);
});