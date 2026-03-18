#!/bin/bash
echo "Starting RETRODEX V2..."
cd "$(dirname "$0")/.."
python3 -m http.server 8080 &
sleep 1
open http://localhost:8080/prototype_v2/launcher.html 2>/dev/null || \
  xdg-open http://localhost:8080/prototype_v2/launcher.html 2>/dev/null || \
  echo "Open http://localhost:8080/prototype_v2/launcher.html in your browser"
wait
