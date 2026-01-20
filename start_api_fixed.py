#!/usr/bin/env python3
"""
Startup script for ML Optimization API
Handles the ml-optimization directory name issue
"""

import sys
import os
from pathlib import Path

# Get project root
project_root = Path(__file__).parent.absolute()
ml_opt_path = project_root / "ml-optimization"

# Add both project root and ml-optimization to path
sys.path.insert(0, str(project_root))
sys.path.insert(0, str(ml_opt_path))

# Change to project root
os.chdir(project_root)

# Create a workaround: add ml-optimization to sys.path and import directly
import importlib.util

# Load the main module directly
main_path = ml_opt_path / "api" / "main.py"
spec = importlib.util.spec_from_file_location("ml_optimization.api.main", main_path)
main_module = importlib.util.module_from_spec(spec)

# We need to set up the module path manually
sys.modules['ml_optimization'] = type(sys)('ml_optimization')
sys.modules['ml_optimization.api'] = type(sys)('ml_optimization.api')
sys.modules['ml_optimization.api.main'] = main_module

# Now load the routes modules
routes_path = ml_opt_path / "api" / "routes"
for route_file in ['optimization_routes', 'metrics_routes', 'recommendation_routes']:
    route_path = routes_path / f"{route_file}.py"
    if route_path.exists():
        route_spec = importlib.util.spec_from_file_location(
            f"ml_optimization.api.routes.{route_file}",
            route_path
        )
        route_module = importlib.util.module_from_spec(route_spec)
        sys.modules[f'ml_optimization.api.routes.{route_file}'] = route_module
        spec.loader.exec_module(route_module)

# Now execute the main module
spec.loader.exec_module(main_module)

# Get the app
app = main_module.app

if __name__ == "__main__":
    import uvicorn
    
    print("=" * 60)
    print("Starting ML Optimization API")
    print("=" * 60)
    print(f"Project root: {project_root}")
    print("=" * 60)
    print("\nAPI will be available at:")
    print("  - API: http://localhost:8000")
    print("  - Docs: http://localhost:8000/docs")
    print("  - Health: http://localhost:8000/health")
    print("\nStarting server...\n")
    
    uvicorn.run(
        app,
        host="0.0.0.0",
        port=8000,
        reload=False,  # Disable reload to avoid import issues
        log_level="info"
    )



