"""
Start Dashboard and API Services
Starts the React dashboard and FastAPI backend services.
"""

import subprocess
import sys
import os
import time
from pathlib import Path
import signal

def start_api_gateway():
    """Start the API Gateway service."""
    print("=" * 60)
    print("Starting API Gateway...")
    print("=" * 60)
    
    api_dir = Path(__file__).parent.parent / "api-gateway"
    
    # Check if dependencies are installed
    if not (api_dir / "requirements.txt").exists():
        print("ERROR: API Gateway requirements.txt not found")
        return None
    
    # Start API Gateway
    try:
        os.chdir(api_dir)
        process = subprocess.Popen(
            [sys.executable, "-m", "uvicorn", "main:app", "--host", "0.0.0.0", "--port", "8000", "--reload"],
            stdout=subprocess.PIPE,
            stderr=subprocess.PIPE,
            text=True,
            bufsize=1
        )
        print(f"✓ API Gateway started (PID: {process.pid})")
        print("  URL: http://localhost:8000")
        print("  Docs: http://localhost:8000/docs")
        return process
    except Exception as e:
        print(f"ERROR starting API Gateway: {e}")
        return None

def start_dashboard():
    """Start the React dashboard."""
    print("\n" + "=" * 60)
    print("Starting Monitoring Dashboard...")
    print("=" * 60)
    
    dashboard_dir = Path(__file__).parent.parent / "monitoring-dashboard"
    
    # Check if node_modules exists
    if not (dashboard_dir / "node_modules").exists():
        print("Installing dashboard dependencies...")
        try:
            os.chdir(dashboard_dir)
            subprocess.run(["npm", "install"], check=True)
            print("✓ Dependencies installed")
        except Exception as e:
            print(f"ERROR installing dependencies: {e}")
            return None
    
    # Start dashboard
    try:
        os.chdir(dashboard_dir)
        process = subprocess.Popen(
            ["npm", "run", "dev"],
            stdout=subprocess.PIPE,
            stderr=subprocess.PIPE,
            text=True,
            bufsize=1
        )
        print(f"✓ Dashboard started (PID: {process.pid})")
        print("  URL: http://localhost:5173 (Vite default port)")
        return process
    except Exception as e:
        print(f"ERROR starting dashboard: {e}")
        return None

def main():
    """Main function to start all services."""
    print("=" * 60)
    print("Starting Dashboard and API Services")
    print("=" * 60)
    print("\nNOTE: Services will run in this terminal.")
    print("Press Ctrl+C to stop all services.\n")
    
    processes = []
    
    try:
        # Start API Gateway
        api_process = start_api_gateway()
        if api_process:
            processes.append(api_process)
            time.sleep(3)  # Wait for API to start
        
        # Start Dashboard
        dashboard_process = start_dashboard()
        if dashboard_process:
            processes.append(dashboard_process)
        
        if processes:
            print("\n" + "=" * 60)
            print("Services Running!")
            print("=" * 60)
            print("\nPress Ctrl+C to stop all services...\n")
            
            # Wait for processes
            for process in processes:
                process.wait()
        else:
            print("\nERROR: No services started successfully")
            sys.exit(1)
            
    except KeyboardInterrupt:
        print("\n\nStopping services...")
        for process in processes:
            try:
                process.terminate()
                process.wait(timeout=5)
            except:
                process.kill()
        print("Services stopped.")
    except Exception as e:
        print(f"\nERROR: {e}")
        for process in processes:
            try:
                process.terminate()
            except:
                pass
        sys.exit(1)

if __name__ == "__main__":
    main()

