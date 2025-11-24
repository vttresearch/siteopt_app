#!/bin/bash
set -e

# Help function
show_help() {
    echo "Usage: ./build.sh [OPTIONS]"
    echo ""
    echo "Options:"
    echo "  --clean       Clean build artifacts (node_modules, dist, staticfiles) before building."
    echo "  --clean-only  Clean build artifacts and exit without building."
    echo "  --no-cache    Build Docker image without using cache."
    echo "  --help        Show this help message."
    echo ""
}

# Function to clean artifacts
clean() {
    echo "Cleaning build artifacts..."
    
    if [ -d "staticfiles" ]; then
        echo "Removing staticfiles..."
        rm -rf staticfiles
    fi

    if [ -d "siteoptapp/frontend/dist" ]; then
        echo "Removing frontend dist..."
        rm -rf siteoptapp/frontend/dist
    fi

    if [ -d "siteoptapp/frontend/node_modules" ]; then
        echo "Removing node_modules..."
        rm -rf siteoptapp/frontend/node_modules
    fi

    echo "Removing __pycache__ directories..."
    find . -type d -name "__pycache__" -exec rm -rf {} + 2>/dev/null || true

    echo "Clean complete."
}

# Parse arguments
CLEAN=false
CLEAN_ONLY=false
NO_CACHE=false

for arg in "$@"
do
    case $arg in
        --clean)
        CLEAN=true
        shift
        ;;
        --clean-only)
        CLEAN_ONLY=true
        shift
        ;;
        --no-cache)
        NO_CACHE=true
        shift
        ;;
        --help)
        show_help
        exit 0
        ;;
        *)
        # unknown option
        ;;
    esac
done

# Execute clean if requested
if [ "$CLEAN" = true ] || [ "$CLEAN_ONLY" = true ]; then
    clean
fi

# Exit if only cleaning was requested
if [ "$CLEAN_ONLY" = true ]; then
    exit 0
fi

echo "Starting build process..."

# 0. Setup Python Environment
# Check for .venv and activate if present
if [ -z "$VIRTUAL_ENV" ]; then
    if [ -d ".venv" ]; then
        echo "Activating virtual environment (.venv)..."
        source .venv/bin/activate
    else
        echo "Note: No active virtual environment detected and .venv not found."
        echo "Using system python: $(which python)"
    fi
fi

# 1. Python dependencies
echo "----------------------------------------------------------------"
echo "Step 1: Installing Python dependencies..."
echo "----------------------------------------------------------------"
pip install -r requirements.txt

# 2. Frontend dependencies and build
echo "----------------------------------------------------------------"
echo "Step 2: Building frontend..."
echo "----------------------------------------------------------------"
cd siteoptapp/frontend

if [ ! -d "node_modules" ]; then
    echo "Installing npm packages..."
    npm install
else
    echo "node_modules exists, skipping npm install (use --clean to force reinstall)"
fi

echo "Running npm build..."
npm run build

# Return to root
cd ../..

# 3. Collect static
echo "----------------------------------------------------------------"
echo "Step 3: Collecting static files..."
echo "----------------------------------------------------------------"
python manage.py collectstatic --noinput

# 4. Docker build
echo "----------------------------------------------------------------"
echo "Step 4: Building Docker image..."
echo "----------------------------------------------------------------"

DOCKER_ARGS=""
if [ "$NO_CACHE" = true ]; then
    echo "Building with --no-cache..."
    DOCKER_ARGS="--no-cache"
fi

docker build $DOCKER_ARGS -t siteopt-web .

echo "----------------------------------------------------------------"
echo "Build complete!"
echo "Run the container with:"
echo "  docker run --rm -p 5000:5000 siteopt-web"
echo "----------------------------------------------------------------"
