#!/usr/bin/env bash
# Oracle Cloud VM(Ubuntu 24.04) 최초 설정 — 한 번만 실행
# 사용: sudo bash setup.sh <도메인>
# Node 24 · Nginx · Let's Encrypt(HTTPS) · systemd 서비스(orae) · 방화벽(80/443)
set -euo pipefail
DOMAIN="${1:?도메인을 넣어 주세요 (예: orae.example.com)}"

export DEBIAN_FRONTEND=noninteractive
apt-get update -y
apt-get install -y ca-certificates curl gnupg nginx certbot python3-certbot-nginx sqlite3 netfilter-persistent iptables-persistent

# Node.js 24 (NodeSource)
if ! command -v node >/dev/null || [ "$(node -p 'process.versions.node.split(".")[0]')" -lt 24 ]; then
  curl -fsSL https://deb.nodesource.com/setup_24.x | bash -
  apt-get install -y nodejs
fi

# 실행 계정과 폴더
id orae >/dev/null 2>&1 || useradd --system --home /opt/orae --shell /usr/sbin/nologin orae
mkdir -p /opt/orae/releases /var/lib/orae /etc/orae
chown -R orae:orae /opt/orae /var/lib/orae
chmod 750 /var/lib/orae

# 환경 변수 파일 (비밀 값은 여기에만 — 권한 600)
if [ ! -f /etc/orae/orae.env ]; then
  cat > /etc/orae/orae.env <<EOF
NODE_ENV=production
PORT=3000
HOSTNAME=127.0.0.1
DB_PATH=/var/lib/orae/orae.db
EMAIL_FROM=ORAE LONGEVITY CLUB <onboarding@resend.dev>
# RESEND_API_KEY=
EOF
fi
chown root:orae /etc/orae/orae.env
chmod 640 /etc/orae/orae.env

# systemd 서비스
cat > /etc/systemd/system/orae.service <<'EOF'
[Unit]
Description=ORAE LONGEVITY CLUB web (Next.js)
After=network.target

[Service]
Type=simple
User=orae
Group=orae
WorkingDirectory=/opt/orae/current
EnvironmentFile=/etc/orae/orae.env
ExecStart=/usr/bin/node server.js
Restart=always
RestartSec=3
NoNewPrivileges=true
ProtectSystem=strict
ReadWritePaths=/var/lib/orae
PrivateTmp=true

[Install]
WantedBy=multi-user.target
EOF
systemctl daemon-reload
systemctl enable orae >/dev/null

# Nginx → Node(127.0.0.1:3000)
cat > /etc/nginx/sites-available/orae <<EOF
server {
  listen 80;
  listen [::]:80;
  server_name ${DOMAIN};
  client_max_body_size 5m;

  location /_next/static/ {
    proxy_pass http://127.0.0.1:3000;
    expires 365d;
    add_header Cache-Control "public, max-age=31536000, immutable";
  }
  location / {
    proxy_pass http://127.0.0.1:3000;
    proxy_http_version 1.1;
    proxy_set_header Host \$host;
    proxy_set_header X-Real-IP \$remote_addr;
    proxy_set_header X-Forwarded-For \$proxy_add_x_forwarded_for;
    proxy_set_header X-Forwarded-Proto \$scheme;
    proxy_read_timeout 60s;
  }
}
EOF
ln -sf /etc/nginx/sites-available/orae /etc/nginx/sites-enabled/orae
rm -f /etc/nginx/sites-enabled/default
nginx -t
systemctl reload nginx

# Oracle Ubuntu 이미지는 iptables가 22번 외에는 막혀 있다 — 80/443 허용 (REJECT 규칙보다 앞에)
for port in 80 443; do
  iptables -C INPUT -p tcp -m state --state NEW --dport "$port" -j ACCEPT 2>/dev/null \
    || iptables -I INPUT 5 -p tcp -m state --state NEW --dport "$port" -j ACCEPT
done
netfilter-persistent save >/dev/null

echo "설정 완료. 앱을 배포한 뒤 HTTPS: sudo certbot --nginx -d ${DOMAIN} --redirect --agree-tos --register-unsafely-without-email -n"
