.PHONY: help init-local start stop restart clean logs ps status health

# Default target
help:
	@echo "AI-Powered Self-Optimizing Data Warehouse - Common Commands"
	@echo ""
	@echo "Setup:"
	@echo "  make init-local          Initialize local development environment"
	@echo "  make start               Start all Docker services"
	@echo "  make stop                Stop all Docker services"
	@echo "  make restart             Restart all Docker services"
	@echo "  make clean               Remove all containers, volumes, and images"
	@echo ""
	@echo "Development:"
	@echo "  make dev                 Start development environment (with Airflow)"
	@echo "  make logs                View logs from all services"
	@echo "  make ps                  List running containers"
	@echo "  make status              Check service health status"
	@echo "  make health              Run health checks"
	@echo ""
	@echo "Database:"
	@echo "  make db-connect          Connect to PostgreSQL database"
	@echo "  make db-backup           Backup database"
	@echo "  make db-restore          Restore database from backup"
	@echo ""
	@echo "Data Generation:"
	@echo "  make generate-data       Generate synthetic data"
	@echo "  make load-data           Load data into Bronze layer"
	@echo ""
	@echo "Testing:"
	@echo "  make test                Run all tests"
	@echo "  make test-unit           Run unit tests"
	@echo "  make test-integration    Run integration tests"

# Initialize local environment
init-local:
	@echo "Initializing local development environment..."
	python -m venv venv || true
	@echo "Virtual environment created. Activate it with:"
	@echo "  source venv/bin/activate  # On Linux/Mac"
	@echo "  venv\\Scripts\\activate      # On Windows"
	@echo ""
	@echo "Then install dependencies:"
	@echo "  pip install -r requirements.txt"

# Start services
start:
	docker-compose up -d
	@echo "Services started. Waiting for health checks..."
	@sleep 5
	@make status

# Start development environment
dev:
	docker-compose -f docker-compose.yml -f docker-compose.dev.yml up -d
	@echo "Development environment started. Waiting for health checks..."
	@sleep 10
	@make status

# Stop services
stop:
	docker-compose down

# Restart services
restart: stop start

# Clean everything
clean:
	docker-compose down -v --rmi all
	@echo "All containers, volumes, and images removed"

# View logs
logs:
	docker-compose logs -f

# List containers
ps:
	docker-compose ps

# Check status
status:
	@echo "=== Service Status ==="
	@docker-compose ps
	@echo ""
	@echo "=== Health Checks ==="
	@docker-compose exec -T postgres pg_isready -U postgres || echo "PostgreSQL: Not ready"
	@docker-compose exec -T redis redis-cli ping || echo "Redis: Not ready"

# Health checks
health:
	@bash infrastructure/scripts/health-check.sh

# Database operations
db-connect:
	docker-compose exec postgres psql -U postgres -d datawarehouse

db-backup:
	@echo "Creating database backup..."
	docker-compose exec postgres pg_dump -U postgres datawarehouse > backups/datawarehouse_$(shell date +%Y%m%d_%H%M%S).sql
	@echo "Backup created"

db-restore:
	@echo "Restoring database from backup..."
	@read -p "Enter backup filename: " filename; \
	docker-compose exec -T postgres psql -U postgres datawarehouse < backups/$$filename

# Data warehouse setup
create-schemas:
	@echo "Creating all data warehouse schemas..."
	python scripts/data-warehouse/create_schemas.py

create-schemas-psql:
	@echo "Creating all data warehouse schemas using psql..."
	psql -h localhost -U postgres -d datawarehouse -f scripts/data-warehouse/create_all_schemas.sql

# Data generation
generate-data:
	@echo "Generating synthetic data..."
	cd data-generator && python main.py

load-data:
	@echo "Loading data into Bronze layer..."
	cd data-generator && python main.py --load

generate-load: create-schemas load-data
	@echo "Schemas created and data loaded successfully!"

# Testing
test:
	pytest tests/ -v

test-unit:
	pytest tests/unit/ -v

test-integration:
	pytest tests/integration/ -v


