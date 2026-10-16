#!/usr/bin/env bash
# Oracle Cloud VM(Oracle Linux 9) 최초 설정 — 한 번만 실행
# 사용: sudo bash setup-ol9.sh <도메인>
# 스왑 · Node 24 · Nginx · Let's Encrypt(certbot) · systemd 서비스(orae) · firewalld · SELinux
set -euo pipefail
DOMAIN="${1:?도메인을 넣어 주세요 (예: orae.example.com)}"

# 메모리가 작은 무료 VM(약 1GB 미만) 대비 스왑 2GB
if ! swapon --show | grep -q /swapfile; then
  fallocate -l 2G /swapfile && chmod 600 /swapfile && mkswap /swapfile >/dev/null && swapon /swapfile
  grep -q '^/swapfile' /etc/fstab || echo '/swapfile none swap sw 0 0' >> /etc/fstab
fi

# 메모리가 작아 dnf가 멈추지 않도록: 설치하는 동안 OCI 에이전트를 잠시 멈추고, 필요한 저장소만 쓴다
systemctl stop oracle-cloud-agent oracle-cloud-agent-updater tuned 2>/dev/null || true
DNF="dnf -y --setopt=install_weak_deps=False --disablerepo=ol9_UEKR8,ol9_ksplice,ol9_oci_included,ol9_addons"

# 패키지: Nginx, SQLite
$DNF install nginx sqlite tar curl policycoreutils-python-utils python3-pip

# certbot은 EPEL 대신 가벼운 Python 가상환경에 설치
if [ ! -x /opt/certbot/bin/certbot ]; then
  python3 -m venv /opt/certbot
  /opt/certbot/bin/pip install --quiet --upgrade pip
  /opt/certbot/bin/pip install --quiet certbot certbot-nginx
  ln -sf /opt/certbot/bin/certbot /usr/local/bin/certbot
fi

# Node.js 24 (NodeSource)
if ! command -v node >/dev/null || [ "$(node -p 'process.versions.node.split(".")[0]')" -lt 24 ]; then
  curl -fsSL https://rpm.nodesource.com/setup_24.x | bash -
  $DNF install nodejs
fi

# 실행 계정과 폴더
id orae >/dev/null 2>&1 || useradd --system --home-dir /opt/orae --shell /sbin/nologin orae
mkdir -p /opt/orae/releases /var/lib/orae /etc/orae
chown -R orae:orae /opt/orae /var/lib/orae
chmod 750 /var/lib/orae

# 환경 변수 파일 (비밀 값은 여기에만)
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
MemoryMax=600M
NoNewPrivileges=true
ProtectSystem=strict
ReadWritePaths=/var/lib/orae
PrivateTmp=true

[Install]
WantedBy=multi-user.target
EOF
systemctl daemon-reload
systemctl enable orae >/dev/null 2>&1

# Nginx → Node(127.0.0.1:3000)
cat > /etc/nginx/conf.d/orae.conf <<EOF
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
# SELinux: Nginx가 로컬 Node(3000)로 프록시하도록 허용
setsebool -P httpd_can_network_connect 1
nginx -t
systemctl enable --now nginx >/dev/null 2>&1
systemctl reload nginx

# 방화벽: HTTP/HTTPS 허용
firewall-cmd --permanent --add-service=http --add-service=https >/dev/null
firewall-cmd --reload >/dev/null

systemctl start oracle-cloud-agent oracle-cloud-agent-updater tuned 2>/dev/null || true
echo "설정 완료 — node $(node -v), $(nginx -v 2>&1)"
