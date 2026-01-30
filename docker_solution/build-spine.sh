#!/bin/bash
set -e

# Resolve repo root (parent of docker_solution)
ROOT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"

# Help function
show_help() {
    echo "Usage: ./build-spine.sh [OPTIONS]"
    echo ""
    echo "Build script for SiteOpt Web Interface with integrated Spine Toolbox"
    echo "Note: This may take 15-30 minutes due to Julia package installation"
    echo ""
    echo "Options:"
    echo "  --clean       Clean build artifacts (node_modules, dist, staticfiles) before building."
    echo "  --clean-only  Clean build artifacts and exit without building."
    echo "  --no-cache    Build Docker image without using cache."
    echo "  --spine-toolbox-version <tag>  Spine-Toolbox git tag (default: 0.10.5)."
    echo "  --help        Show this help message."
    echo ""
}

# Function to clean artifacts
clean() {
    echo "Cleaning build artifacts..."
    
    if [ -d "$ROOT_DIR/staticfiles" ]; then
        echo "Removing staticfiles..."
        rm -rf "$ROOT_DIR/staticfiles"
    fi

    if [ -d "$ROOT_DIR/siteoptapp/frontend/dist" ]; then
        echo "Removing frontend dist..."
        rm -rf "$ROOT_DIR/siteoptapp/frontend/dist"
    fi

    if [ -d "$ROOT_DIR/siteoptapp/frontend/node_modules" ]; then
        echo "Removing node_modules..."
        rm -rf "$ROOT_DIR/siteoptapp/frontend/node_modules"
    fi

    echo "Removing __pycache__ directories..."
    find "$ROOT_DIR" -type d -name "__pycache__" -exec rm -rf {} + 2>/dev/null || true

    echo "Clean complete."
}

# Parse arguments
CLEAN=false
CLEAN_ONLY=false
NO_CACHE=false
SPINE_TOOLBOX_VERSION="0.10.5"

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
        --spine-toolbox-version)
        SPINE_TOOLBOX_VERSION="$2"
        shift
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
    if [ -d "$ROOT_DIR/.venv" ]; then
        echo "Activating virtual environment (.venv)..."
        source "$ROOT_DIR/.venv/bin/activate"
    else
        echo "Note: No active virtual environment detected and .venv not found."
        echo "Using system python: $(which python)"
    fi
fi

# 1. Python dependencies
echo "----------------------------------------------------------------"
echo "Step 1: Installing Python dependencies..."
echo "----------------------------------------------------------------"
pip install -r "$ROOT_DIR/requirements.txt"

# 2. Frontend dependencies and build
echo "----------------------------------------------------------------"
echo "Step 2: Building frontend..."
echo "----------------------------------------------------------------"
cd "$ROOT_DIR/siteoptapp/frontend"

if [ ! -d "node_modules" ]; then
    echo "Installing npm packages..."
    npm install
else
    echo "node_modules exists, skipping npm install (use --clean to force reinstall)"
fi

echo "Running npm build..."
npm run build

# Return to root
cd "$ROOT_DIR"

# 3. Collect static
echo "----------------------------------------------------------------"
echo "Step 3: Collecting static files..."
echo "----------------------------------------------------------------"
python manage.py collectstatic --noinput

# 4. Docker build
echo "----------------------------------------------------------------"
echo "Step 4: Building Docker image with Spine Toolbox..."
echo "----------------------------------------------------------------"
echo "Note: Julia package installation may take 15-30 minutes..."

DOCKER_ARGS="--build-arg SPINE_TOOLBOX_VERSION=${SPINE_TOOLBOX_VERSION}"
if [ "$NO_CACHE" = true ]; then
    echo "Building with --no-cache..."
    DOCKER_ARGS="${DOCKER_ARGS} --no-cache"
fi

docker build $DOCKER_ARGS -f "$ROOT_DIR/docker_solution/Dockerfile.spine" -t siteopt-web-spine:latest "$ROOT_DIR"

echo "----------------------------------------------------------------"
echo "Build complete!"
echo ""
echo "To run with docker-compose:"
echo "  docker-compose -f docker_solution/docker-compose.spine.yml up -d"
echo ""
echo "Or run manually:"
echo "  docker run -d --init --shm-size=2g -p 5000:5000 --name siteopt-web-spine siteopt-web-spine:latest"
echo ""
echo "Access the web interface at: http://localhost:5000"
echo "----------------------------------------------------------------"
