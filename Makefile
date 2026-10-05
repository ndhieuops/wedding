# Lệnh tắt cho Docker. Chạy `make help` để xem danh sách.
COMPOSE ?= docker compose
STAMP := $(shell date +%Y%m%d-%H%M%S)

.PHONY: help up up-https down logs restart build test shell backup restore-hint dev

help: ## Hiện danh sách lệnh
	@grep -E '^[a-zA-Z_-]+:.*?## ' $(MAKEFILE_LIST) | awk 'BEGIN {FS = ":.*?## "}; {printf "  \033[36m%-12s\033[0m %s\n", $$1, $$2}'

.env:
	@cp .env.example .env
	@sed -i.bak "s/^SESSION_SECRET=.*/SESSION_SECRET=$$(openssl rand -hex 32 2>/dev/null || head -c 32 /dev/urandom | od -An -tx1 | tr -d ' \n')/" .env && rm -f .env.bak
	@echo "→ Đã tạo .env (nhớ đổi ADMIN_PASSWORD và BASE_URL)"

up: .env ## Build & chạy (http://localhost:3000)
	$(COMPOSE) up -d --build
	@echo "→ Mở http://localhost:$${HOST_PORT:-3000}"

up-https: .env ## Chạy kèm Caddy HTTPS (cần DOMAIN trong .env)
	$(COMPOSE) --profile https up -d --build

down: ## Dừng ứng dụng (dữ liệu vẫn được giữ)
	$(COMPOSE) --profile https down

logs: ## Xem log
	$(COMPOSE) logs -f --tail=200 app

restart: ## Khởi động lại (VD: sau khi thêm mẫu thiệp)
	$(COMPOSE) restart app

build: ## Build image production
	$(COMPOSE) build app

test: ## Chạy toàn bộ test trong Docker
	docker build --target test -t wedding-studio:test .

shell: ## Mở shell trong container
	$(COMPOSE) exec app sh

backup: ## Sao lưu toàn bộ dữ liệu (DB + ảnh) ra ./backups
	@mkdir -p backups
	$(COMPOSE) exec app node scripts/backup.js
	docker run --rm --volumes-from $$($(COMPOSE) ps -q app) -v "$$(pwd)/backups:/backup" busybox tar czf /backup/data-$(STAMP).tgz -C /data .
	@echo "→ backups/data-$(STAMP).tgz"

restore-hint: ## Hướng dẫn khôi phục
	@echo "1) make down"
	@echo "2) docker run --rm -v wedding-studio_wedding-data:/data -v \"$$(pwd)/backups:/backup\" busybox sh -c 'rm -rf /data/* && tar xzf /backup/<file>.tgz -C /data'"
	@echo "3) make up"

dev: ## Chạy môi trường phát triển (không Docker)
	npm install && npm run build && npm run dev
