import fcntl
import hmac
import json
import os
import re
from datetime import datetime, timezone

from flask import Flask, jsonify, request
from flask_cors import CORS
from werkzeug.middleware.proxy_fix import ProxyFix

app = Flask(__name__)
# за nginx стоит один прокси-сервер
app.wsgi_app = ProxyFix(app.wsgi_app, x_for=1, x_proto=1, x_host=1)
CORS(app)

SHOP_NAME = os.environ.get("SHOP_NAME", "ЭлектроМир (dev)")
DATA_DIR = os.environ.get("DATA_DIR", "data")
ADMIN_PASSWORD_FILE = os.environ.get("ADMIN_PASSWORD_FILE", "secrets/admin_password.txt")
ORDERS_FILE = os.path.join(DATA_DIR, "orders.json")
LOCK_FILE = os.path.join(DATA_DIR, "orders.lock")

CATEGORIES = [
    {"id": "cables", "name": "Кабели и провода"},
    {"id": "switches", "name": "Розетки и выключатели"},
    {"id": "breakers", "name": "Автоматика и защита"},
    {"id": "lighting", "name": "Освещение"},
    {"id": "tools", "name": "Инструмент"},
]

PRODUCTS = [
    {"id": 1, "category": "cables", "icon": "🔌", "name": "Кабель ВВГнг-LS 3x1.5, 100 м", "price": 5990, "desc": "Силовой кабель для освещения и розеточных групп"},
    {"id": 2, "category": "cables", "icon": "🔌", "name": "Кабель ВВГнг-LS 3x2.5, 100 м", "price": 8790, "desc": "Силовой кабель для розеточных линий"},
    {"id": 3, "category": "cables", "icon": "🧵", "name": "Провод ПуГВ 1x4, 50 м", "price": 3150, "desc": "Монтажный гибкий провод для щитов"},
    {"id": 4, "category": "switches", "icon": "🔘", "name": "Розетка с заземлением, белая", "price": 189, "desc": "Скрытая установка, 16 А, 250 В"},
    {"id": 5, "category": "switches", "icon": "💡", "name": "Выключатель двухклавишный", "price": 220, "desc": "Скрытая установка, 10 А, белый"},
    {"id": 6, "category": "switches", "icon": "🔌", "name": "Розетка USB двойная", "price": 790, "desc": "Две розетки и два порта USB для зарядки"},
    {"id": 7, "category": "breakers", "icon": "⚡", "name": "Автоматический выключатель 16 А, 1P", "price": 245, "desc": "Характеристика C, на DIN-рейку"},
    {"id": 8, "category": "breakers", "icon": "⚡", "name": "Автоматический выключатель 25 А, 1P", "price": 265, "desc": "Характеристика C, на DIN-рейку"},
    {"id": 9, "category": "breakers", "icon": "🛡️", "name": "УЗО 40 А / 30 мА", "price": 1390, "desc": "Защита от утечек тока, 2 полюса"},
    {"id": 10, "category": "lighting", "icon": "💡", "name": "Лампа светодиодная E27, 12 Вт", "price": 130, "desc": "Нейтральный белый свет 4000 К"},
    {"id": 11, "category": "lighting", "icon": "🔦", "name": "Светильник LED панель 36 Вт", "price": 1250, "desc": "Потолочная панель 600x600 мм"},
    {"id": 12, "category": "tools", "icon": "🔧", "name": "Мультиметр цифровой", "price": 990, "desc": "Измерение напряжения, тока и сопротивления"},
    {"id": 13, "category": "tools", "icon": "🪛", "name": "Набор отверток диэлектрических, 7 шт.", "price": 1890, "desc": "Изолированные до 1000 В"},
    {"id": 14, "category": "tools", "icon": "✂️", "name": "Стриппер для снятия изоляции", "price": 650, "desc": "Автоматический, сечение 0.2-6 мм²"},
]
PRODUCTS_BY_ID = {p["id"]: p for p in PRODUCTS}

PHONE_RE = re.compile(r"^[0-9+()\-\s]{5,20}$")


def read_orders():
    if not os.path.exists(ORDERS_FILE):
        return []
    with open(ORDERS_FILE, encoding="utf-8") as f:
        return json.load(f)


def add_order(order):
    """Сохраняет заказ в файл. Блокировка нужна, так как работают 2 процесса Gunicorn."""
    os.makedirs(DATA_DIR, exist_ok=True)
    with open(LOCK_FILE, "w") as lock:
        fcntl.flock(lock, fcntl.LOCK_EX)
        orders = read_orders()
        order["id"] = len(orders) + 1
        orders.append(order)
        tmp = ORDERS_FILE + ".tmp"
        with open(tmp, "w", encoding="utf-8") as f:
            json.dump(orders, f, ensure_ascii=False, indent=2)
        os.replace(tmp, ORDERS_FILE)
    return order


def read_admin_password():
    try:
        with open(ADMIN_PASSWORD_FILE, encoding="utf-8") as f:
            return f.read().strip()
    except OSError:
        return None


@app.get("/api/health")
def health():
    return jsonify({"status": "ok"})


@app.get("/api/info")
def info():
    return jsonify({
        "shop": SHOP_NAME,
        "secret_loaded": read_admin_password() is not None,
        "scheme": request.scheme,
        "host": request.host,
    })


@app.get("/api/categories")
def categories():
    return jsonify(CATEGORIES)


@app.get("/api/products")
def products():
    category = request.args.get("category")
    items = [p for p in PRODUCTS if not category or p["category"] == category]
    return jsonify(items)


@app.get("/api/products/<int:product_id>")
def product(product_id):
    item = PRODUCTS_BY_ID.get(product_id)
    if item is None:
        return jsonify({"error": "Товар не найден"}), 404
    return jsonify(item)


@app.post("/api/orders")
def create_order():
    data = request.get_json(silent=True) or {}
    name = str(data.get("name", "")).strip()
    phone = str(data.get("phone", "")).strip()
    raw_items = data.get("items")

    if not (2 <= len(name) <= 80):
        return jsonify({"error": "Укажите имя (от 2 до 80 символов)"}), 400
    if not PHONE_RE.match(phone):
        return jsonify({"error": "Укажите корректный телефон"}), 400
    if not isinstance(raw_items, list) or not raw_items or len(raw_items) > 50:
        return jsonify({"error": "Корзина пуста"}), 400

    items, total = [], 0
    for row in raw_items:
        try:
            pid, qty = int(row["id"]), int(row["qty"])
        except (KeyError, TypeError, ValueError):
            return jsonify({"error": "Неверный состав заказа"}), 400
        product = PRODUCTS_BY_ID.get(pid)
        if product is None or not (1 <= qty <= 99):
            return jsonify({"error": "Неверный товар или количество"}), 400
        # цена берется на сервере, а не из запроса
        items.append({"id": pid, "name": product["name"], "price": product["price"], "qty": qty})
        total += product["price"] * qty

    order = add_order({
        "name": name,
        "phone": phone,
        "items": items,
        "total": total,
        "created": datetime.now(timezone.utc).isoformat(timespec="seconds"),
    })
    return jsonify({"id": order["id"], "total": total}), 201


@app.get("/api/admin/orders")
def admin_orders():
    expected = read_admin_password()
    if expected is None:
        return jsonify({"error": "Пароль администратора не настроен"}), 503
    given = request.headers.get("X-Admin-Password", "")
    if not hmac.compare_digest(given.encode(), expected.encode()):
        return jsonify({"error": "Неверный пароль"}), 401
    return jsonify(list(reversed(read_orders())))


if __name__ == "__main__":
    app.run(host="0.0.0.0", port=5000, debug=True)
