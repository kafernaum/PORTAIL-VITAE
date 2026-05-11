# Déploiement VPS — Portail Vitae Publica

Ce document décrit la mise en production de l'application sur un VPS Linux (Debian/Ubuntu) avec le sous-domaine `portail.vitae-publica.tech` pointant vers le serveur.

---

## 🚀 Installation automatique (recommandée)

Un script unique qui installe Docker + Caddy + l'app + HTTPS + pare-feu :

```bash
# 1. Cloner le dépôt sur le VPS
sudo git clone <votre-repo> /opt/portail-vitae
cd /opt/portail-vitae

# 2. Lancer l'installation (interactif)
sudo bash deploy/install.sh

# OU non-interactif (CI / scripté)
sudo DOMAIN=portail.vitae-publica.tech \
     EMAIL=ops@vitae-publica.tech \
     ADMIN_PASSWORD='un-mot-de-passe-fort' \
     bash deploy/install.sh
```

Le script `deploy/install.sh` est **idempotent** : vous pouvez le relancer pour mettre à jour le code ou la configuration sans casser l'existant. Il :

- détecte / installe Docker CE + Compose plugin si absents,
- détecte / installe Caddy (reverse-proxy avec HTTPS automatique via Let's Encrypt),
- synchronise le code dans `/opt/portail-vitae` (ou `INSTALL_DIR`),
- génère un `.env` sécurisé (mot de passe admin aléatoire si non fourni, `chmod 600`),
- construit et démarre les conteneurs avec `docker compose`,
- attend que l'API `/api/health` réponde (timeout 90 s + logs en cas d'échec),
- écrit un bloc géré dans `/etc/caddy/Caddyfile` (entre marqueurs, donc remplaçable sans toucher au reste),
- configure UFW (22/80/443 ouverts, 8006 reste local).

**Pré-requis** :

1. VPS Debian 11/12 ou Ubuntu 22.04/24.04 avec accès `sudo`.
2. Enregistrement DNS A/AAAA `portail.vitae-publica.tech` → IP du VPS (sans cela Let's Encrypt échouera).
3. Le code source (clone Git du dépôt) accessible sur la machine.

À la fin, le script affiche l'URL, le mot de passe admin et les commandes utiles.

---

## Installation manuelle

### Option 1 — Docker Compose

```bash
git clone <votre-repo> /opt/portail-vitae
cd /opt/portail-vitae

cat > .env <<EOF
DOMAIN=portail.vitae-publica.tech
NEXT_PUBLIC_BASE_URL=https://portail.vitae-publica.tech
ADMIN_PASSWORD=changez-ce-mot-de-passe-immediatement
EOF
chmod 600 .env

docker compose up -d --build

curl -s http://127.0.0.1:8006/api/health
# => {"ok":true,"service":"vitae-publica"}
```

L'application écoute sur `127.0.0.1:8006` (non exposée publiquement). MongoDB tourne dans son propre conteneur avec un volume persistant `mongo_data`.

### Option 2 — Déploiement natif (sans Docker)

```bash
# Node.js 20 + MongoDB 7
curl -fsSL https://deb.nodesource.com/setup_20.x | sudo bash -
sudo apt install -y nodejs mongodb-org

sudo systemctl enable --now mongod

# Application
git clone <votre-repo> /opt/portail-vitae
cd /opt/portail-vitae
yarn install
yarn build

# .env
cat > .env <<EOF
MONGO_URL=mongodb://127.0.0.1:27017
DB_NAME=vitae_publica
PORT=8006
ADMIN_PASSWORD=changez-ce-mot-de-passe-immediatement
NEXT_PUBLIC_BASE_URL=https://portail.vitae-publica.tech
EOF
```

Lancement persistant avec **systemd** :

```ini
# /etc/systemd/system/portail-vitae.service
[Unit]
Description=Portail Vitae Publica
After=network.target mongod.service

[Service]
Type=simple
WorkingDirectory=/opt/portail-vitae
EnvironmentFile=/opt/portail-vitae/.env
ExecStart=/usr/bin/yarn start
Restart=on-failure
User=www-data

[Install]
WantedBy=multi-user.target
```

```bash
sudo systemctl daemon-reload
sudo systemctl enable --now portail-vitae
```

---

## Reverse-proxy + HTTPS (manuel)

### Avec Caddy (le plus simple — HTTPS automatique)

```bash
sudo cp deploy/Caddyfile /etc/caddy/Caddyfile
sudo systemctl reload caddy
```

### Avec Nginx + Certbot

```bash
sudo cp deploy/nginx.conf /etc/nginx/sites-available/portail-vitae
sudo ln -s /etc/nginx/sites-available/portail-vitae /etc/nginx/sites-enabled/
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

## Mise à jour de l'application

```bash
cd /opt/portail-vitae
sudo git pull
sudo bash deploy/install.sh   # idempotent : rebuild + redémarrage propre
```

