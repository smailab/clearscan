#!/usr/bin/env bash
# Oracle Cloud VM에 앱 배포 (이 PC에서 실행)
# 사용: bash deploy/oci/deploy.sh <서버 IP 또는 도메인>   (web 폴더에서)
# 1) Node용 빌드 → 2) 묶어서 전송 → 3) 서버에서 DB 마이그레이션 → 4) 새 버전으로 전환·재시작 → 5) 상태 확인
set -euo pipefail
HOST="${1:?서버 IP 또는 도메인을 넣어 주세요}"
KEY="${OCI_SSH_KEY:-$HOME/.ssh/orae_oci}"
SSH="ssh -i $KEY -o StrictHostKeyChecking=accept-new ubuntu@$HOST"
REL="$(date +%Y%m%d-%H%M%S)"
OUT=".deploy/$REL"

echo "▶ 빌드 (Node 서버용)"
BUILD_TARGET=node npx next build > .deploy-build.log 2>&1 || { tail -30 .deploy-build.log; exit 1; }

echo "▶ 묶기"
rm -rf .deploy && mkdir -p "$OUT/.next"
cp -r .next/standalone/. "$OUT/"
cp -r .next/static "$OUT/.next/static"
cp -r public "$OUT/public"
cp -r migrations "$OUT/migrations"
cp scripts/migrate-sqlite.mjs "$OUT/migrate-sqlite.mjs"
tar -czf ".deploy/$REL.tgz" -C "$OUT" .

echo "▶ 전송"
scp -i "$KEY" -o StrictHostKeyChecking=accept-new ".deploy/$REL.tgz" "ubuntu@$HOST:/tmp/orae-$REL.tgz"

echo "▶ 서버에서 설치 · 마이그레이션 · 전환"
$SSH "sudo bash -s" <<EOF
set -euo pipefail
D=/opt/orae/releases/$REL
mkdir -p \$D && tar -xzf /tmp/orae-$REL.tgz -C \$D && rm -f /tmp/orae-$REL.tgz
chown -R orae:orae \$D
sudo -u orae node \$D/migrate-sqlite.mjs /var/lib/orae/orae.db \$D/migrations
ln -sfn \$D /opt/orae/current
systemctl restart orae
# 오래된 버전은 최근 3개만 남긴다
ls -1dt /opt/orae/releases/* | tail -n +4 | xargs -r rm -rf
for i in \$(seq 1 20); do curl -fs -o /dev/null http://127.0.0.1:3000/ && break; sleep 1; done
curl -s -o /dev/null -w "서버 응답: %{http_code}\n" http://127.0.0.1:3000/
EOF
rm -rf .deploy .deploy-build.log
echo "✔ 배포 완료 ($REL)"
