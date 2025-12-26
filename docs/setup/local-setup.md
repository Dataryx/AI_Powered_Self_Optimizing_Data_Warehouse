# Local Development Setup Guide

This guide will help you set up the AI-Powered Self-Optimizing Data Warehouse on your local machine.

## Prerequisites

Before you begin, ensure you have the following installed:

### Required Software

1. **Docker Desktop**
   - Download from: https://www.docker.com/products/docker-desktop
   - Version: 4.0+ recommended
   - Ensure Docker Desktop is running before proceeding

2. **Python 3.10 or higher**
   - Download from: https://www.python.org/downloads/
   - Verify installation: `python --version`

3. **Node.js 18 or higher** (for monitoring dashboard)
   - Download from: https://nodejs.org/
   - Verify installation: `node --version`

4. **Git**
   - Download from: https://git-scm.com/downloads
   - Verify installation: `git --version`

### Optional but Recommended

- **VS Code** with extensions:
  - Python
  - Docker
  - PostgreSQL
  - GitLens
- **pgAdmin** or **DBeaver** for database management
- **Postman** or **curl** for API testing

## Step-by-Step Setup

### Step 1: Clone the Repository

```bash
git clone <repository-url>
cd AI-Powered-Self_Optimizing_Data_Warehouse
```

### Step 2: Create Python Virtual Environment

Create a virtual environment to isolate project dependencies:

**On Windows:**
```powershell
python -m venv venv
venv\Scripts\activate
```

**On Linux/Mac:**
```bash
python3 -m venv venv
source venv/bin/activate
```

You should see `(venv)` in your terminal prompt.

### Step 3: Install Python Dependencies

```bash
pip install --upgrade pip
pip install -r requirements.txt
```

### Step 4: Configure Environment Variables

Create a `.env` file in the project root:

```bash
cp .env.example .env
```

Edit `.env` with your configuration:

```env
# PostgreSQL Configuration
POSTGRES_USER=postgres
POSTGRES_PASSWORD=postgres
POSTGRES_DB=datawarehouse
POSTGRES_PORT=5432

# Redis Configuration
REDIS_PORT=6379

# Adminer (Database UI)
ADMINER_PORT=8080

# pgAdmin Configuration
PGADMIN_EMAIL=admin@example.com
PGADMIN_PASSWORD=admin
PGADMIN_PORT=5050

# Airflow Configuration (Development)
AIRFLOW_UID=50000
AIRFLOW_GID=50000
```

**Important**: Change default passwords in production!

### Step 5: Start Docker Services

Start the base services (PostgreSQL, Redis, Adminer):

```bash
docker-compose up -d
```

Or use the Makefile:

```bash
make start
```

Wait for services to be healthy (about 30 seconds):

```bash
docker-compose ps
```

All services should show "healthy" status.

### Step 6: Verify Database Connection

Test the database connection:

```bash
# Using Docker
docker-compose exec postgres psql -U postgres -d datawarehouse

# Or using Makefile
make db-connect
```

You should see a PostgreSQL prompt. Type `\dt` to list tables (should be empty initially).

Exit with `\q`.

### Step 7: Verify Schemas are Created

Check that Bronze, Silver, and Gold schemas exist:

```sql
SELECT schema_name 
FROM information_schema.schemata 
WHERE schema_name IN ('bronze', 'silver', 'gold');
```

All three schemas should be listed.

### Step 8: Install Node.js Dependencies (for Dashboard)

```bash
cd monitoring-dashboard
npm install
cd ..
```

### Step 9: (Optional) Start Development Environment with Airflow

For ETL development, start the full development environment:

```bash
docker-compose -f docker-compose.yml -f docker-compose.dev.yml up -d
```

This will start:
- PostgreSQL
- Redis
- Adminer
- pgAdmin
- Airflow Webserver (port 8081)
- Airflow Scheduler

Access Airflow UI at: http://localhost:8081
- Username: `airflow`
- Password: `airflow`

## Accessing Services

### Database Access

1. **psql Command Line**
   ```bash
   make db-connect
   ```

2. **Adminer Web UI**
   - URL: http://localhost:8080
   - System: PostgreSQL
   - Server: postgres
   - Username: postgres
   - Password: postgres
   - Database: datawarehouse

3. **pgAdmin Web UI**
   - URL: http://localhost:5050
   - Email: admin@example.com
   - Password: admin

   To connect to PostgreSQL in pgAdmin:
   - Right-click "Servers" → Create → Server
   - Name: Data Warehouse
   - Host: postgres
   - Port: 5432
   - Username: postgres
   - Password: postgres

### Redis Access

```bash
docker-compose exec redis redis-cli
```

## Common Commands

### Using Makefile

```bash
make help              # Show all available commands
make start             # Start all services
make stop              # Stop all services
make restart           # Restart services
make logs              # View logs
make status            # Check service status
make health            # Run health checks
make db-connect        # Connect to database
make clean             # Remove all containers and volumes
```

### Using Docker Compose Directly

```bash
docker-compose up -d           # Start services
docker-compose down            # Stop services
docker-compose logs -f         # Follow logs
docker-compose ps              # List containers
docker-compose exec postgres psql -U postgres -d datawarehouse
```

## Troubleshooting

### Port Already in Use

If you get a "port already in use" error:

1. Find what's using the port:
   ```bash
   # Windows
   netstat -ano | findstr :5432
   
   # Linux/Mac
   lsof -i :5432
   ```

2. Either:
   - Stop the conflicting service, or
   - Change the port in `.env` file

### Docker Services Not Starting

1. Check Docker Desktop is running
2. Check logs: `docker-compose logs`
3. Check disk space: Docker needs several GB
4. Restart Docker Desktop

### Database Connection Issues

1. Verify PostgreSQL is running: `docker-compose ps`
2. Check PostgreSQL logs: `docker-compose logs postgres`
3. Test connection: `docker-compose exec postgres pg_isready -U postgres`

### Virtual Environment Issues

If you have issues with the virtual environment:

```bash
# Deactivate and remove
deactivate
rm -rf venv  # or rmdir /s venv on Windows

# Recreate
python -m venv venv
source venv/bin/activate  # or venv\Scripts\activate on Windows
pip install -r requirements.txt
```

### Permission Issues (Linux/Mac)

If you get permission errors:

```bash
# Fix Docker permissions (if needed)
sudo usermod -aG docker $USER
# Log out and log back in

# Fix file permissions
sudo chown -R $USER:$USER .
```

## Next Steps

Once your environment is set up:

1. **Generate Sample Data**: See Week 2 documentation
2. **Run ETL Pipelines**: See Week 3 documentation
3. **Create Gold Layer**: See Week 4 documentation

## Development Workflow

1. **Start services**: `make start` or `make dev`
2. **Make code changes**
3. **Test locally**
4. **Commit changes**: `git commit -m "Description"`
5. **Stop services when done**: `make stop`

## IDE Setup (VS Code)

Recommended VS Code settings (`.vscode/settings.json`):

```json
{
  "python.defaultInterpreterPath": "${workspaceFolder}/venv/bin/python",
  "python.linting.enabled": true,
  "python.linting.pylintEnabled": true,
  "python.formatting.provider": "black",
  "editor.formatOnSave": true,
  "files.exclude": {
    "**/__pycache__": true,
    "**/*.pyc": true
  }
}
```

## Resources

- [PostgreSQL Documentation](https://www.postgresql.org/docs/)
- [Docker Documentation](https://docs.docker.com/)
- [Airflow Documentation](https://airflow.apache.org/docs/)
- [Project Documentation](./README.md)


