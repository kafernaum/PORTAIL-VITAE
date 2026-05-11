# Déploiement VPS — Portail Vitae Publica

Ce document décrit la mise en production de l'application sur un VPS Linux (Debian/Ubuntu) avec le sous-domaine `portail.vitae-publica.tech` pointant vers le serveur.

## Pré-requis

1. Un VPS Linux à jour avec un utilisateur sudo.
2. Un enregistrement DNS A/AAAA `portail.vitae-publica.tech` → IP du VPS.
3. Docker + Docker Compose installés (option recommandée) **ou** Node.js 20 + MongoDB en natif.
4. Caddy **ou** Nginx + Certbot en reverse-proxy.

---

## Option 1 — Docker Compose (recommandé)

```bash
git clone <votre-repo> /opt/vitae-publica
cd /opt/vitae-publica

# 1. Variables d'environnement
cat > .env <<EOF
ADMIN_PASSWORD=changez-ce-mot-de-passe-immediatement
EOF

# 2. Build & lancement
docker compose up -d --build

# 3. Vérification
curl -s http://127.0.0.1:8006/api/health
# => {"ok":true,"service":"vitae-publica"}
```

L'application écoute sur `127.0.0.1:8006` (non exposée publiquement). MongoDB tourne dans son propre conteneur avec un volume persistant `mongo_data`.

---

## Option 2 — Déploiement natif (sans Docker)

```bash
# Node.js 20 + MongoDB 7
curl -fsSL https://deb.nodesource.com/setup_20.x | sudo bash -
sudo apt install -y nodejs mongodb-org

sudo systemctl enable --now mongod

# Application
git clone <votre-repo> /opt/vitae-publica
cd /opt/vitae-publica
yarn install
yarn build

# .env
cat > .env <<EOF
MONGO_URL=mongodb://127.0.0.1:27017
DB_NAME=vitae_publica
ADMIN_PASSWORD=changez-ce-mot-de-passe-immediatement
NEXT_PUBLIC_BASE_URL=https://portail.vitae-publica.tech
EOF
```

Le `package.json` doit avoir `"start": "next start -p 8006 -H 0.0.0.0"`. Sinon ajustez-le manuellement.

Lancement persistant avec **systemd** :

```ini
# /etc/systemd/system/vitae-publica.service
[Unit]
Description=Vitae Publica portal
After=network.target mongod.service

[Service]
Type=simple
WorkingDirectory=/opt/vitae-publica
EnvironmentFile=/opt/vitae-publica/.env
ExecStart=/usr/bin/yarn start
Restart=on-failure
User=www-data

[Install]
WantedBy=multi-user.target
```

```bash
sudo systemctl daemon-reload
sudo systemctl enable --now vitae-publica
```

---

## Reverse-proxy + HTTPS

### Avec Caddy (le plus simple — HTTPS automatique)

```bash
sudo cp deploy/Caddyfile /etc/caddy/Caddyfile
sudo systemctl reload caddy
```

### Avec Nginx + Certbot

```bash
sudo cp deploy/nginx.conf /etc/nginx/sites-available/vitae-publica
sudo ln -s /etc/nginx/sites-available/vitae-publica /etc/nginx/sites-enabled/
sudo nginx -t && sudo systemctl reload nginx

sudo apt install -y certbot python3-certbot-nginx
sudo certbot --nginx -d portail.vitae-publica.tech
```

---

## Vérifications post-déploiement

```bash
curl -s https://portail.vitae-publica.tech/api/health
# => {"ok":true,"service":"vitae-publica"}
```

Ouvrez https://portail.vitae-publica.tech puis https://portail.vitae-publica.tech/admin et connectez-vous avec le `ADMIN_PASSWORD` configuré.

## Sauvegardes MongoDB

```bash
# Docker
docker compose exec mongo mongodump --db vitae_publica --archive=/tmp/backup.archive
docker compose cp mongo:/tmp/backup.archive ./backup-$(date +%F).archive

# Natif
mongodump --db vitae_publica --archive=/var/backups/vitae-$(date +%F).archive
```

Programmez un `cron` quotidien pour automatiser.
