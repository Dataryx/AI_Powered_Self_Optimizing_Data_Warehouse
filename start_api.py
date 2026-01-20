#!/usr/bin/env python3
"""
Startup script for ML Optimization API
Sets up the Python path correctly and starts the server
"""

import sys
import os
from pathlib import Path

# Add project root to Python path
project_root = Path(__file__).parent.absolute()
sys.path.insert(0, str(project_root))

# Change to project root directory
os.chdir(project_root)

# Now import and run
if __name__ == "__main__":
    import uvicorn
    from ml_optimization.api.main import app
    
    print("=" * 60)
    print("Starting ML Optimization API")
    print("=" * 60)
    print(f"Project root: {project_root}")
    print(f"Python path includes: {project_root}")
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
        reload=True,
        log_level="info"
    )



