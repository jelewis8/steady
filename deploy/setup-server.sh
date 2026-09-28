#!/usr/bin/env bash
# One-time setup for a fresh Ubuntu 22.04/24.04 DigitalOcean droplet.
# Run as root:   bash setup-server.sh
# Prerequisite: an A record for steady.example.com pointing at this droplet's IP.
set -euo pipefail

DOMAIN="steady.example.com"
DEPLOY_USER="steady"

echo "==> Installing Caddy (official repository)"
apt-get update -y
apt-get install -y debian-keyring debian-archive-keyring apt-transport-https curl ufw
curl -1sLf 'https://dl.cloudsmith.io/public/caddy/stable/gpg.key' | gpg --dearmor -o /usr/share/keyrings/caddy-stable-archive-keyring.gpg
curl -1sLf 'https://dl.cloudsmith.io/public/caddy/stable/debian.deb.txt' > /etc/apt/sources.list.d/caddy-stable.list
apt-get update -y
apt-get install -y caddy

echo "==> Creating deploy user and web root"
id -u "$DEPLOY_USER" >/dev/null 2>&1 || adduser --disabled-password --gecos "" "$DEPLOY_USER"
mkdir -p /var/www/steady/releases
chown -R "$DEPLOY_USER":"$DEPLOY_USER" /var/www/steady
if [ -f /root/.ssh/authorized_keys ]; then
  mkdir -p /home/$DEPLOY_USER/.ssh
  cp /root/.ssh/authorized_keys /home/$DEPLOY_USER/.ssh/authorized_keys
  chown -R $DEPLOY_USER:$DEPLOY_USER /home/$DEPLOY_USER/.ssh
  chmod 700 /home/$DEPLOY_USER/.ssh && chmod 600 /home/$DEPLOY_USER/.ssh/authorized_keys
fi

echo "==> Firewall: SSH + HTTP + HTTPS only"
ufw allow OpenSSH
ufw allow 80/tcp
ufw allow 443/tcp
ufw allow 443/udp   # HTTP/3
ufw --force enable

echo "==> Placeholder page until the first deploy"
mkdir -p /var/www/steady/releases/placeholder
echo '<!doctype html><title>Steady</title><p>Steady is being deployed.</p>' > /var/www/steady/releases/placeholder/index.html
ln -sfn /var/www/steady/releases/placeholder /var/www/steady/current
chown -h "$DEPLOY_USER":"$DEPLOY_USER" /var/www/steady/current

echo "==> Caddy config"
if [ -f ./Caddyfile ]; then cp ./Caddyfile /etc/caddy/Caddyfile; fi
caddy validate --config /etc/caddy/Caddyfile
systemctl enable --now caddy
systemctl reload caddy

echo
echo "Done. Now run deploy/deploy.ps1 from your Windows machine."
echo "Check: https://$DOMAIN"
