# Docker Setup Guide

This guide provides detailed information about the Docker infrastructure setup for the AI-Powered Self-Optimizing Data Warehouse.

## Overview

The project uses Docker Compose to orchestrate multiple services:
- PostgreSQL (Data Warehouse)
- Redis (Caching Layer)
- Adminer (Database Management UI)
- pgAdmin (Alternative Database UI)
- Apache Airflow (ETL Orchestration) - Development only

## Docker Compose Files

### docker-compose.yml
Main orchestration file with base services:
- PostgreSQL
- Redis
- Adminer
- pgAdmin

### docker-compose.dev.yml
Development overrides that add:
- Apache Airflow (Webserver + Scheduler)

### docker-compose.prod.yml
Production overrides (to be configured):
- Enhanced security
- Resource limits
- Production-ready configurations

## Services Overview

### PostgreSQL Service

**Image**: `postgres:15-alpine`

**Configuration**:
- Database: `datawarehouse`
- User: `postgres` (configurable via env)
- Port: `5432` (configurable)
- Data persistence: Docker volume `postgres_data`
- Custom config: `postgresql.conf` mounted

**Initialization Scripts**:
1. `01-create-databases.sql` - Creates Airflow database
2. `02-create-schemas.sql` - Creates Bronze, Silver, Gold schemas
3. `03-create-extensions.sql` - Installs PostgreSQL extensions

**Health Check**:
- Uses `pg_isready` to verify database readiness
- Runs every 10 seconds
- Timeout: 5 seconds
- Retries: 5 times

**Volumes**:
- `postgres_data`: Persistent data storage
- `./infrastructure/docker/postgres/init-scripts`: Initialization scripts
- `./infrastructure/docker/postgres/postgresql.conf`: PostgreSQL configuration

### Redis Service

**Image**: `redis:7-alpine`

**Configuration**:
- Port: `6379` (configurable)
- Memory limit: 256MB (configurable in redis.conf)
- Eviction policy: `allkeys-lru`
- Persistence: Disabled (cache-only)

**Health Check**:
- Uses `redis-cli ping`
- Runs every 10 seconds

**Volumes**:
- `redis_data`: Persistent data storage
- `./infrastructure/docker/redis/redis.conf`: Redis configuration

### Adminer Service

**Image**: `adminer:latest`

**Configuration**:
- Port: `8080` (configurable)
- Lightweight database management UI
- Connects to PostgreSQL automatically

**Access**:
- URL: http://localhost:8080
- System: PostgreSQL
- Server: `postgres`
- Username: `postgres`
- Password: (from POSTGRES_PASSWORD env)

### pgAdmin Service

**Image**: `dpage/pgadmin4:latest`

**Configuration**:
- Port: `5050` (configurable)
- Full-featured PostgreSQL administration tool
- Email: `admin@example.com` (configurable)
- Password: `admin` (configurable)

**Access**:
- URL: http://localhost:5050
- Email: (from PGADMIN_EMAIL env)
- Password: (from PGADMIN_PASSWORD env)

### Apache Airflow (Development Only)

**Image**: `apache/airflow:2.7.0`

**Services**:
- `airflow-webserver`: Web UI on port 8081
- `airflow-scheduler`: Task scheduler
- `airflow-init`: Initialization service

**Configuration**:
- Executor: `LocalExecutor`
- Database: Separate PostgreSQL database (`airflow`)
- DAGs folder: `./etl/dags`
- Logs folder: `./etl/logs`

**Access**:
- URL: http://localhost:8081
- Username: `airflow`
- Password: `airflow`

## Network Configuration

All services are connected via a bridge network named `dw_network`. This allows:
- Service discovery by container name
- Internal communication without exposing ports
- Isolation from other Docker networks

## Volumes

### Named Volumes
- `postgres_data`: PostgreSQL data directory
- `redis_data`: Redis data directory
- `pgadmin_data`: pgAdmin configuration and data
- `airflow_data`: Airflow database and metadata (dev only)

### Bind Mounts
- Initialization scripts: `./infrastructure/docker/postgres/init-scripts`
- Configuration files: Various config files in `infrastructure/docker/`
- DAGs: `./etl/dags` (dev only)
- Logs: `./etl/logs` (dev only)

## Environment Variables

Create a `.env` file in the project root:

```env
# PostgreSQL
POSTGRES_USER=postgres
POSTGRES_PASSWORD=postgres
POSTGRES_DB=datawarehouse
POSTGRES_PORT=5432

# Redis
REDIS_PORT=6379

# Adminer
ADMINER_PORT=8080

# pgAdmin
PGADMIN_EMAIL=admin@example.com
PGADMIN_PASSWORD=admin
PGADMIN_PORT=5050
```

## Starting Services

### Base Services Only

```bash
docker-compose up -d
```

Or using Makefile:

```bash
make start
```

### Development Environment (with Airflow)

```bash
docker-compose -f docker-compose.yml -f docker-compose.dev.yml up -d
```

Or using Makefile:

```bash
make dev
```

## Stopping Services

```bash
docker-compose down
```

To also remove volumes (⚠️ deletes data):

```bash
docker-compose down -v
```

## Viewing Logs

### All Services
```bash
docker-compose logs -f
```

### Specific Service
```bash
docker-compose logs -f postgres
docker-compose logs -f redis
docker-compose logs -f airflow-scheduler
```

## Health Checks

### Manual Health Check
```bash
docker-compose ps
```

All services should show "healthy" status.

### Using Makefile
```bash
make health
```

### Individual Service Checks

**PostgreSQL**:
```bash
docker-compose exec postgres pg_isready -U postgres
```

**Redis**:
```bash
docker-compose exec redis redis-cli ping
```

**Airflow**:
- Check webserver: http://localhost:8081
- Check scheduler logs: `docker-compose logs airflow-scheduler`

## Troubleshooting

### Services Won't Start

1. **Check Docker Desktop is running**
   ```bash
   docker info
   ```

2. **Check port conflicts**
   ```bash
   # Windows
   netstat -ano | findstr :5432
   
   # Linux/Mac
   lsof -i :5432
   ```

3. **Check disk space**
   ```bash
   docker system df
   ```

4. **View logs**
   ```bash
   docker-compose logs
   ```

### Database Connection Issues

1. **Verify PostgreSQL is healthy**
   ```bash
   docker-compose exec postgres pg_isready -U postgres
   ```

2. **Check PostgreSQL logs**
   ```bash
   docker-compose logs postgres
   ```

3. **Test connection**
   ```bash
   docker-compose exec postgres psql -U postgres -d datawarehouse
   ```

### Volume Issues

1. **List volumes**
   ```bash
   docker volume ls
   ```

2. **Inspect volume**
   ```bash
   docker volume inspect ai-powered-self_optimizing_data_warehouse_postgres_data
   ```

3. **Remove volume** (⚠️ deletes data)
   ```bash
   docker volume rm ai-powered-self_optimizing_data_warehouse_postgres_data
   ```

### Network Issues

1. **List networks**
   ```bash
   docker network ls
   ```

2. **Inspect network**
   ```bash
   docker network inspect ai-powered-self_optimizing_data_warehouse_dw_network
   ```

3. **Remove network**
   ```bash
   docker network rm ai-powered-self_optimizing_data_warehouse_dw_network
   ```

### Airflow Issues

1. **Check Airflow initialization**
   ```bash
   docker-compose logs airflow-init
   ```

2. **Restart Airflow services**
   ```bash
   docker-compose restart airflow-webserver airflow-scheduler
   ```

3. **Reset Airflow database** (⚠️ deletes all Airflow data)
   ```bash
   docker-compose down -v
   docker-compose -f docker-compose.yml -f docker-compose.dev.yml up -d airflow-init
   ```

## Performance Tuning

### PostgreSQL

Edit `infrastructure/docker/postgres/postgresql.conf`:

```conf
shared_buffers = 256MB          # Adjust based on available RAM
effective_cache_size = 1GB      # Adjust based on available RAM
work_mem = 16MB                 # Adjust based on concurrent queries
maintenance_work_mem = 128MB    # Adjust based on available RAM
```

Restart PostgreSQL after changes:
```bash
docker-compose restart postgres
```

### Redis

Edit `infrastructure/docker/redis/redis.conf`:

```conf
maxmemory 256mb                 # Adjust based on available RAM
maxmemory-policy allkeys-lru    # LRU eviction policy
```

Restart Redis after changes:
```bash
docker-compose restart redis
```

## Backup and Restore

### Backup PostgreSQL

```bash
docker-compose exec postgres pg_dump -U postgres datawarehouse > backup.sql
```

Or using Makefile:
```bash
make db-backup
```

### Restore PostgreSQL

```bash
docker-compose exec -T postgres psql -U postgres datawarehouse < backup.sql
```

Or using Makefile:
```bash
make db-restore
```

## Cleanup

### Remove All Containers and Volumes

```bash
docker-compose down -v
```

Or using Makefile:
```bash
make clean
```

### Remove Everything (including images)

```bash
docker-compose down -v --rmi all
```

### Prune Docker System

Remove unused resources:
```bash
docker system prune -a
```

⚠️ **Warning**: This removes all unused Docker resources system-wide!

## Production Considerations

For production deployment, consider:

1. **Security**:
   - Use strong passwords
   - Enable SSL/TLS
   - Restrict network access
   - Use secrets management

2. **Resource Limits**:
   - Set CPU and memory limits
   - Monitor resource usage
   - Scale horizontally if needed

3. **Persistence**:
   - Use managed database services
   - Regular backups
   - Disaster recovery plan

4. **Monitoring**:
   - Set up logging aggregation
   - Monitor service health
   - Alert on failures

5. **High Availability**:
   - Multiple replicas
   - Load balancing
   - Failover mechanisms

## Additional Resources

- [Docker Documentation](https://docs.docker.com/)
- [Docker Compose Documentation](https://docs.docker.com/compose/)
- [PostgreSQL Docker Image](https://hub.docker.com/_/postgres)
- [Redis Docker Image](https://hub.docker.com/_/redis)
- [Airflow Docker Documentation](https://airflow.apache.org/docs/apache-airflow/stable/start/docker.html)


