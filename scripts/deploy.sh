#!/usr/bin/env bash
set -euo pipefail

ROOT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
cd "$ROOT_DIR"

echo "TvDreams - Deploy helper script"

read -r -p "1) Edit .env now? (y/N) " EDIT_ENV
if [[ "$EDIT_ENV" =~ ^[Yy]$ ]]; then
  if [ -n "${EDITOR-}" ]; then
    $EDITOR .env
  else
    if command -v nano >/dev/null 2>&1; then
      nano .env
    else
      echo "No editor found. Please install 'nano' or set the EDITOR env var.";
      exit 1
    fi
  fi
fi

echo
echo "2) Installing dependencies (pnpm install)"
if ! command -v pnpm >/dev/null 2>&1; then
  echo "pnpm not found. Install pnpm with: npm i -g pnpm";
  read -r -p "Continue without pnpm? (y/N) " SKIP_PNPM
  if [[ ! "$SKIP_PNPM" =~ ^[Yy]$ ]]; then
    exit 1
  fi
else
  pnpm install
fi

echo
echo "3) Building frontend (pnpm run build)"
if pnpm run build; then
  echo "Build OK"
else
  echo "Build failed"; exit 1
fi

echo
echo "4) Ensure runtime data directory exists"
mkdir -p data
if [ ! -f data/recent-prizes.json ]; then
  echo "[]" > data/recent-prizes.json
  echo "Created data/recent-prizes.json"
fi

echo
echo "5) Install PM2 (global)"
if ! command -v pm2 >/dev/null 2>&1; then
  echo "Installing pm2 globally (requires sudo)..."
  sudo npm install -g pm2
else
  echo "pm2 already installed"
fi

echo
echo "6) Choose process manager: pm2 (default) or systemd unit"
read -r -p "Use systemd unit instead of pm2? (y/N) " USE_SYSTEMD
if [[ "$USE_SYSTEMD" =~ ^[Yy]$ ]]; then
  # Create systemd unit from template and install it under /etc/systemd/system
  UNIT_NAME="tvdreams.service"
  TMP_UNIT="/tmp/$UNIT_NAME"
  echo "Creating systemd unit file at $TMP_UNIT"
  cat > "$TMP_UNIT" <<EOF
[Unit]
Description=TvDreams CMS and Display Server
After=network.target

[Service]
Type=simple
WorkingDirectory=$ROOT_DIR
EnvironmentFile=-$ROOT_DIR/.env
ExecStart=/usr/bin/env pnpm run start
Restart=always
RestartSec=10
StandardOutput=syslog
StandardError=syslog
SyslogIdentifier=TvDreams

[Install]
WantedBy=multi-user.target
EOF

  echo "Installing unit to /etc/systemd/system/$UNIT_NAME (requires sudo)"
  sudo mv "$TMP_UNIT" /etc/systemd/system/$UNIT_NAME
  sudo systemctl daemon-reload
  sudo systemctl enable --now $UNIT_NAME
  echo "Systemd unit installed and started: $UNIT_NAME"
  echo "Check status with: sudo systemctl status $UNIT_NAME"
else
  echo "Starting with pm2"
  if [ -f ecosystem.config.js ]; then
    echo "Using ecosystem.config.js to start processes"
    pm2 start ecosystem.config.js --env production || true
  else
    echo "No ecosystem.config.js found. Will start using npm start script via pm2"
    pm2 start npm --name TvDreams -- start || true
  fi

  echo "Saving pm2 process list"
  pm2 save || true

  echo
  echo "Configuring pm2 startup (systemd). You may be prompted for sudo." 
  PM2_STARTUP_CMD=$(pm2 startup systemd -u $(whoami) --hp $HOME | tail -n1)
  echo "Run the following command with sudo if required to finish the pm2 startup setup:"
  echo
  echo "$PM2_STARTUP_CMD"
  echo

  echo "Useful pm2 commands:"
  echo " - Check pm2 status: pm2 status"
  echo " - View logs: pm2 logs"
fi

echo "Deployment script finished."
exit 0
