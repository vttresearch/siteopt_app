#!/bin/bash

echo "Starting SiteOpt with auto-detection of reverse proxy configuration"

# Run the original entrypoint
exec /app/docker-entrypoint.sh
