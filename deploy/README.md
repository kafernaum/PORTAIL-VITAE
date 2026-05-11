# Déploiement VPS — Portail Vitea Publica

Ce document décrit la mise en production de l'application sur un VPS Linux (Debian/Ubuntu) avec le sous-domaine `portail.vitea-publica.tech` pointant vers le serveur.

## Pré-requis

1. Un VPS Linux à jour avec un utilisateur sudo.
2. Un enregistrement DNS A/AAAA `portail.vitea-publica.tech` → IP du VPS.
3. Docker + Docker Compose installés (option recommandée) **ou** Node.js 20 + MongoDB en natif.
4. Caddy **ou** Nginx + Certbot en reverse-proxy.

---

## Option 1 — Docker Compose (recommandé)

```bash
git clone <votre-repo> /opt/vitea-publica
cd /opt/vitea-publica

# 1. Variables d'environnement
cat > .env <<EOF
ADMIN_PASSWORD=changez-ce-mot-de-passe-immediatement
EOF

# 2. Build & lancement
docker compose up -d --build

# 3. Vérification
curl -s http://127.0.0.1:8006/api/health
# => {"ok":true,"service":"vitea-publica"}
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
git clone <votre-repo> /opt/vitea-publica
cd /opt/vitea-publica
yarn install
yarn build

# .env
cat > .env <<EOF
MONGO_URL=mongodb://127.0.0.1:27017
DB_NAME=vitea_publica
ADMIN_PASSWORD=changez-ce-mot-de-passe-immediatement
NEXT_PUBLIC_BASE_URL=https://portail.vitea-publica.tech
EOF
```

Le `package.json` doit avoir `"start": "next start -p 8006 -H 0.0.0.0"`. Sinon ajustez-le manuellement.

Lancement persistant avec **systemd** :

```ini
# /etc/systemd/system/vitea-publica.service
[Unit]
Description=Vitea Publica portal
After=network.target mongod.service

[Service]
Type=simple
WorkingDirectory=/opt/vitea-publica
EnvironmentFile=/opt/vitea-publica/.env
ExecStart=/usr/bin/yarn start
Restart=on-failure
User=www-data

[Install]
WantedBy=multi-user.target
```

```bash
sudo systemctl daemon-reload
sudo systemctl enable --now vitea-publica
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
sudo cp deploy/nginx.conf /etc/nginx/sites-available/vitea-publica
sudo ln -s /etc/nginx/sites-available/vitea-publica /etc/nginx/sites-enabled/
sudo nginx -t && sudo systemctl reload nginx

sudo apt install -y certbot python3-certbot-nginx
sudo certbot --nginx -d portail.vitea-publica.tech
```

---

## Vérifications post-déploiement

```bash
curl -s https://portail.vitea-publica.tech/api/health
# => {"ok":true,"service":"vitea-publica"}
```

Ouvrez https://portail.vitea-publica.tech puis https://portail.vitea-publica.tech/admin et connectez-vous avec le `ADMIN_PASSWORD` configuré.

## Sauvegardes MongoDB

```bash
# Docker
docker compose exec mongo mongodump --db vitea_publica --archive=/tmp/backup.archive
docker compose cp mongo:/tmp/backup.archive ./backup-$(date +%F).archive

# Natif
mongodump --db vitea_publica --archive=/var/backups/vitea-$(date +%F).archive
```

Programmez un `cron` quotidien pour automatiser.
