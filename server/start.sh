#!/bin/bash
# Starts the twitter-radio API server with a keep-alive loop: if the server
# crashes it restarts in 5s. Does NOT survive a reboot — rerun this after one.
# Usage: bash /root/Claude-5/server/start.sh
cd "$(dirname "$0")"
if pgrep -f 'node src/server.js' > /dev/null; then
  echo "already running (pid $(pgrep -f 'node src/server.js'))"
  exit 0
fi
setsid nohup bash -c 'while true; do
  node src/server.js >> server.log 2>&1
  echo "[keepalive] server exited ($(date)), restarting in 5s" >> server.log
  sleep 5
done' > /dev/null 2>&1 &
sleep 1
echo "started (pid $(pgrep -f 'node src/server.js'))"
