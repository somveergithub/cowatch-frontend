#!/bin/bash
# ─────────────────────────────────────────────────────────────────────────────
# deploy-frontend.sh  —  Build React app and serve via Nginx on EC2
#
# Run on EC2:  bash /opt/cowatch-frontend/deploy-frontend.sh
# ─────────────────────────────────────────────────────────────────────────────
set -e

echo "========================================="
echo " Co-Watch Frontend — Build & Deploy"
echo "========================================="

# ── 1. Install Node.js (if not present) ──────────────────────────────────────
if ! command -v node &> /dev/null; then
  echo "[1/4] Installing Node.js 20..."
  curl -fsSL https://deb.nodesource.com/setup_20.x | sudo -E bash -
  sudo apt install -y nodejs
else
  echo "[1/4] Node.js $(node -v) already installed."
fi

# ── 2. Install dependencies and build ────────────────────────────────────────
echo "[2/4] Installing npm dependencies..."
cd /opt/cowatch-frontend
npm install --silent

echo "[3/4] Building React app..."
npm run build

# ── 3. Copy build to Nginx web root ──────────────────────────────────────────
echo "[4/4] Deploying to Nginx..."
sudo mkdir -p /var/www/cowatch
sudo cp -r build/* /var/www/cowatch/
sudo chown -R www-data:www-data /var/www/cowatch

# ── 4. Update Nginx config to serve React + proxy API ────────────────────────
sudo tee /etc/nginx/sites-available/cowatch > /dev/null <<'EOF'
server {
    listen 80;
    server_name _;

    client_max_body_size 2G;

    # Serve React app
    root /var/www/cowatch;
    index index.html;

    # React Router — serve index.html for all frontend routes
    location / {
        try_files $uri $uri/ /index.html;
    }

    # Proxy API requests to FastAPI
    location /api/ {
        proxy_pass         http://127.0.0.1:8000;
        proxy_http_version 1.1;
        proxy_set_header   Host $host;
        proxy_set_header   X-Real-IP $remote_addr;
        proxy_set_header   X-Forwarded-For $proxy_add_x_forwarded_for;
    }

    # Proxy Socket.io WebSocket
    location /socket.io/ {
        proxy_pass         http://127.0.0.1:8000;
        proxy_http_version 1.1;
        proxy_set_header   Upgrade $http_upgrade;
        proxy_set_header   Connection "upgrade";
        proxy_set_header   Host $host;
        proxy_read_timeout 3600s;
        proxy_send_timeout 3600s;
    }
}
EOF

sudo nginx -t && sudo systemctl reload nginx

echo ""
echo "========================================="
echo " Frontend deployed!"
echo "========================================="
EC2_IP=$(curl -s http://169.254.169.254/latest/meta-data/public-ipv4)
echo " App: http://${EC2_IP}"
echo "========================================="
