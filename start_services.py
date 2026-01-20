#!/usr/bin/env python3
"""
Simple startup script for the Data Warehouse services
Handles the ml-optimization directory name issue properly
"""

import sys
import os
from pathlib import Path

# Get project root
project_root = Path(__file__).parent.absolute()
ml_opt_dir = project_root / "ml-optimization"

# Add to Python path
sys.path.insert(0, str(project_root))
sys.path.insert(0, str(ml_opt_dir))

# Set up module structure manually
import importlib.util

# Create fake modules for the import path
class FakeModule:
    def __init__(self, name):
        self.__name__ = name
        self.__path__ = []
        self.__file__ = None
        self.__spec__ = None

# Set up the module hierarchy
sys.modules['ml_optimization'] = FakeModule('ml_optimization')
sys.modules['ml_optimization.api'] = FakeModule('ml_optimization.api')
sys.modules['ml_optimization.api.routes'] = FakeModule('ml_optimization.api.routes')
sys.modules['ml_optimization.utils'] = FakeModule('ml_optimization.utils')

# Load utils module first (needed by warehouse_routes)
utils_dir = ml_opt_dir / "utils"
db_utils_path = utils_dir / "db_utils.py"
if db_utils_path.exists():
    spec = importlib.util.spec_from_file_location(
        "ml_optimization.utils.db_utils",
        db_utils_path
    )
    if spec and spec.loader:
        db_utils_module = importlib.util.module_from_spec(spec)
        sys.modules['ml_optimization.utils.db_utils'] = db_utils_module
        spec.loader.exec_module(db_utils_module)

# Load route modules
routes_dir = ml_opt_dir / "api" / "routes"
route_files = [
    'optimization_routes', 
    'metrics_routes', 
    'recommendation_routes', 
    'warehouse_routes',
    'monitoring_routes',  # New routes
    'storage_routes',
    'alert_routes'
]
for route_file in route_files:
    route_path = routes_dir / f"{route_file}.py"
    if route_path.exists():
        spec = importlib.util.spec_from_file_location(
            f"ml_optimization.api.routes.{route_file}",
            route_path
        )
        if spec and spec.loader:
            module = importlib.util.module_from_spec(spec)
            sys.modules[f'ml_optimization.api.routes.{route_file}'] = module
            spec.loader.exec_module(module)

# Now load main
main_path = ml_opt_dir / "api" / "main.py"
spec = importlib.util.spec_from_file_location("ml_optimization.api.main", main_path)
if spec and spec.loader:
    main_module = importlib.util.module_from_spec(spec)
    sys.modules['ml_optimization.api.main'] = main_module
    spec.loader.exec_module(main_module)
    app = main_module.app
    
    # Run the server
    import uvicorn
    print("=" * 60)
    print("ML Optimization API")
    print("=" * 60)
    print("Starting server on http://localhost:8000")
    print("API Docs: http://localhost:8000/docs")
    print("=" * 60)
    print()
    
    uvicorn.run(
        app,
        host="0.0.0.0",
        port=8000,
        log_level="info"
    )
else:
    print("ERROR: Could not load main module")
    sys.exit(1)

