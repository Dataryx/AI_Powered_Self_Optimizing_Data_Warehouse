import sys
import os
from pathlib import Path

# Add project root to path
project_root = Path(r'C:\Indominus\College (CSUF)\4th Semester\Final Project\AI-Powered-Self_Optimizing_Data_Warehouse')
sys.path.insert(0, str(project_root))

# Import using importlib to handle ml-optimization directory name
import importlib.util

# Load main module
ml_opt_path = project_root / 'ml-optimization' / 'api' / 'main.py'
spec = importlib.util.spec_from_file_location('main', ml_opt_path)
main_module = importlib.util.module_from_spec(spec)

# Set up module structure
sys.modules['ml_optimization'] = type(sys)('ml_optimization')
sys.modules['ml_optimization.api'] = type(sys)('ml_optimization.api')

# Load route modules first
routes_path = project_root / 'ml-optimization' / 'api' / 'routes'
for route_name in ['optimization_routes', 'metrics_routes', 'recommendation_routes']:
    route_file = routes_path / f'{route_name}.py'
    if route_file.exists():
        route_spec = importlib.util.spec_from_file_location(f'ml_optimization.api.routes.{route_name}', route_file)
        route_module = importlib.util.module_from_spec(route_spec)
        sys.modules[f'ml_optimization.api.routes.{route_name}'] = route_module
        if route_spec.loader:
            route_spec.loader.exec_module(route_module)

# Now load main
if spec.loader:
    spec.loader.exec_module(main_module)

# Get app and run
app = main_module.app

import uvicorn
print('Starting ML Optimization API on http://localhost:8000')
uvicorn.run(app, host='0.0.0.0', port=8000, log_level='info')
