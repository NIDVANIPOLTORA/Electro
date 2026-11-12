## Переменные окружения и секреты
- SHOP_NAME — название магазина (deploy/.env)
- DATA_DIR — папка с заказами (задана в Dockerfile)
- ADMIN_PASSWORD_FILE — путь к секрету (задан в docker-compose.yml)
- секрет admin_password — файл deploy/secrets/admin_password.txt

## Первый запуск (в папке deploy)
cd certs
mkcert -cert-file electro.localhost.pem -key-file electro.localhost-key.pem electro.localhost
cd ..
docker compose up --build -d
docker compose ps
docker compose logs backend

Сайт: https://electro.localhost  Админка: https://electro.localhost/admin.html

Остановка: `docker compose down` (заказы в томе сохраняются).
