#!/usr/bin/env bash
# SocialAiDigital (SocialIQ) setup on a server that already runs other apps. Safe to re-run.
#
#   bash deploy/socialaidigital/server-bootstrap.sh
#
# Only creates/overwrites SocialIQ paths. It does not install Node/PM2/nginx, does not touch
# other nginx sites, other PM2 processes, or /etc/letsencrypt.
#
# Env overrides:
#   DEPLOY_USER=ubuntu    owner of the SocialIQ directories and PM2 process
#   API_PORT=5600         must match PORT in the API .env
set -euo pipefail

DEPLOY_USER="${DEPLOY_USER:-ubuntu}"
API_PORT="${API_PORT:-5600}"
SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
STATIC_DIR=/var/www/socialaidigital
API_DIR=/var/www/socialaidigital-api/server
CERT_DIR=/etc/ssl/socialaidigital
SITE=socialaidigital.com.conf

echo "==> Checking prerequisites..."
for cmd in node npm pm2 nginx; do
  command -v "$cmd" >/dev/null 2>&1 || { echo "FATAL: $cmd is not installed."; exit 1; }
done
node -v

if ss -ltn "( sport = :${API_PORT} )" | grep -q LISTEN; then
  if ! pm2 describe socialaidigital-api >/dev/null 2>&1; then
    echo "FATAL: port ${API_PORT} is already used by another process. Pick another API_PORT."
    exit 1
  fi
fi

echo "==> Directories..."
sudo mkdir -p "${STATIC_DIR}" "${API_DIR}/logs" "${CERT_DIR}"
sudo chown -R "${DEPLOY_USER}:${DEPLOY_USER}" "${STATIC_DIR}" /var/www/socialaidigital-api
sudo cp "${SCRIPT_DIR}/ecosystem.config.cjs" /var/www/socialaidigital-api/ecosystem.config.cjs
sudo chown "${DEPLOY_USER}:${DEPLOY_USER}" /var/www/socialaidigital-api/ecosystem.config.cjs

if [ ! -f "${API_DIR}/.env" ]; then
  echo "WARN: ${API_DIR}/.env is missing. Create it from env/production.env.example before the first deploy."
fi

echo "==> Nginx site..."
if sudo test -f "${CERT_DIR}/origin.pem" && sudo test -f "${CERT_DIR}/origin.key"; then
  sudo chmod 600 "${CERT_DIR}/origin.key"
  sudo cp "${SCRIPT_DIR}/nginx/${SITE}" "/etc/nginx/sites-available/${SITE}"
  sudo ln -sf "/etc/nginx/sites-available/${SITE}" "/etc/nginx/sites-enabled/${SITE}"
  if sudo nginx -t; then
    sudo systemctl reload nginx
    echo "Site enabled: www.socialaidigital.com"
  else
    echo "FATAL: nginx -t failed. Removing the SocialIQ site so other sites keep working."
    sudo rm -f "/etc/nginx/sites-enabled/${SITE}"
    sudo nginx -t && sudo systemctl reload nginx
    exit 1
  fi
else
  echo "WARN: ${CERT_DIR}/origin.pem or origin.key not found. Save the Cloudflare Origin"
  echo "      Certificate there (see RUNBOOK.md), then re-run this script."
fi

echo "==> Bootstrap complete. Next: .env, Atlas allowlist, GitHub secrets, then run the deploy workflow."
