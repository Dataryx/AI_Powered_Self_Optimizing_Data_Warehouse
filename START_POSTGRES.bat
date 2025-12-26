@echo off
REM Quick script to start PostgreSQL and create schemas

echo Starting PostgreSQL...
docker-compose up -d postgres

echo Waiting for PostgreSQL to be ready...
timeout /t 10 /nobreak

echo Creating database schemas...
python scripts\data-warehouse\create_schemas.py

echo.
echo Done! Check output above for any errors.
pause

