#!/usr/bin/env bash
# ==============================================================================
#  Portail Vitae Publica — Script d'installation complet pour VPS Debian/Ubuntu
# ------------------------------------------------------------------------------
#  Usage (interactif) :
#     sudo bash install.sh
#
#  Usage (non-interactif / CI) :
#     sudo DOMAIN=portail.vitae-publica.tech \
#          EMAIL=ops@vitae-publica.tech \
#          ADMIN_PASSWORD='un-mot-de-passe-fort' \
#          REPO_URL=https://github.com/vous/portail-vitae.git \
#          bash install.sh
#
#  Variables d'environnement reconnues :
#     DOMAIN          (obligatoire)   Sous-domaine public, ex. portail.vitae-publica.tech
#     EMAIL           (obligatoire)   Email administrateur pour Let's Encrypt
#     ADMIN_PASSWORD  (optionnel)     Mot de passe admin du CMS. Auto-généré si absent.
#     REPO_URL        (optionnel)     URL Git du projet. Si absent et qu'on n'est pas
#                                     déjà dans le projet, on demande à l'utilisateur.
#     INSTALL_DIR     (optionnel)     Défaut : /opt/portail-vitae
#     SKIP_FIREWALL   (optionnel)     Mettre "1" pour ne pas toucher à ufw
#     SKIP_NGINX      (optionnel)     Mettre "1" pour ne pas configurer Nginx/Certbot
#     SKIP_TLS        (optionnel)     Mettre "1" pour ne PAS émettre de cert Let's Encrypt
#                                     (utile si Nginx amont/CDN gère déjà le TLS)
#
#  Le script est idempotent : vous pouvez le relancer sans casser l'existant.
# ==============================================================================

set -Eeuo pipefail

# ---------- Couleurs / log -----------------------------------------------------
RED='\033[0;31m'; GREEN='\033[0;32m'; YELLOW='\033[1;33m'; BLUE='\033[0;34m'
BOLD='\033[1m'; DIM='\033[2m'; NC='\033[0m'

step()   { echo -e "\n${BLUE}${BOLD}==>${NC} ${BOLD}$*${NC}"; }
info()   { echo -e "    ${DIM}$*${NC}"; }
ok()     { echo -e "    ${GREEN}✔${NC} $*"; }
warn()   { echo -e "    ${YELLOW}⚠${NC} $*"; }
fail()   { echo -e "\n${RED}${BOLD}✗ ÉCHEC :${NC} $*\n" >&2; exit 1; }

# Trap global pour message d'erreur clair
trap 'fail "Le script a échoué à la ligne $LINENO. Consultez la sortie ci-dessus."' ERR

# ---------- 1. Pré-requis -----------------------------------------------------
step "Pré-requis"

# Root
if [[ $EUID -ne 0 ]]; then
    fail "Ce script doit être exécuté en root (utilisez sudo)."
fi
ok "Exécution en root"

# OS
if ! [[ -f /etc/os-release ]]; then
    fail "Système non supporté (/etc/os-release introuvable)."
fi
# shellcheck disable=SC1091
. /etc/os-release
case "${ID:-}" in
    debian|ubuntu) ok "Système supporté : ${PRETTY_NAME:-$ID}" ;;
    *) fail "Système non supporté : ${ID:-inconnu}. Ce script cible Debian/Ubuntu." ;;
esac

# Architecture
ARCH=$(dpkg --print-architecture)
ok "Architecture : ${ARCH}"

# ---------- 2. Variables ------------------------------------------------------
step "Configuration"

INSTALL_DIR="${INSTALL_DIR:-/opt/portail-vitae}"
COMPOSE_PROJECT_NAME="portail-vitae"

# DOMAIN
if [[ -z "${DOMAIN:-}" ]]; then
    read -rp "    Sous-domaine public (ex. portail.vitae-publica.tech) : " DOMAIN
fi
[[ -z "$DOMAIN" ]] && fail "DOMAIN est obligatoire."
ok "Domaine     : ${DOMAIN}"

# EMAIL
if [[ -z "${EMAIL:-}" ]]; then
    read -rp "    Email administrateur (pour Let's Encrypt) : " EMAIL
fi
[[ -z "$EMAIL" ]] && fail "EMAIL est obligatoire."
ok "Email TLS   : ${EMAIL}"

# ADMIN_PASSWORD
if [[ -z "${ADMIN_PASSWORD:-}" ]]; then
    ADMIN_PASSWORD=$(tr -dc 'A-Za-z0-9!@#%^_+=' </dev/urandom | head -c 24 || true)
    GENERATED_PASSWORD=1
    ok "Mot de passe admin généré aléatoirement"
else
    GENERATED_PASSWORD=0
    ok "Mot de passe admin fourni"
fi

# Source du code
if [[ -z "${REPO_URL:-}" ]]; then
    # Si le script est lancé depuis un checkout du projet, on copie depuis là
    SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
    PROJECT_DIR="$(cd "$SCRIPT_DIR/.." && pwd)"
    if [[ -f "$PROJECT_DIR/Dockerfile" && -f "$PROJECT_DIR/docker-compose.yml" && -f "$PROJECT_DIR/package.json" ]]; then
        SOURCE_MODE="local"
        ok "Source code : copie locale depuis ${PROJECT_DIR}"
    else
        fail "Aucune source détectée. Définissez REPO_URL=<git url> ou lancez ce script depuis un clone du dépôt (deploy/install.sh)."
    fi
else
    SOURCE_MODE="git"
    ok "Source code : git clone depuis ${REPO_URL}"
fi

info "Installation dans : ${INSTALL_DIR}"

# ---------- 3. Paquets de base ------------------------------------------------
step "Mise à jour des paquets et utilitaires"
export DEBIAN_FRONTEND=noninteractive
apt-get update -y >/dev/null
apt-get install -y --no-install-recommends \
    ca-certificates curl gnupg lsb-release rsync ufw git debian-keyring debian-archive-keyring apt-transport-https >/dev/null
ok "Paquets de base installés"

# ---------- 4. Docker ---------------------------------------------------------
step "Installation de Docker"
if command -v docker >/dev/null 2>&1 && docker compose version >/dev/null 2>&1; then
    ok "Docker + Compose déjà présents ($(docker --version | awk '{print $3}' | tr -d ','))"
else
    install -m 0755 -d /etc/apt/keyrings
    if [[ ! -f /etc/apt/keyrings/docker.gpg ]]; then
        curl -fsSL "https://download.docker.com/linux/${ID}/gpg" | gpg --dearmor -o /etc/apt/keyrings/docker.gpg
        chmod a+r /etc/apt/keyrings/docker.gpg
    fi
    CODENAME=$(. /etc/os-release && echo "${VERSION_CODENAME:-$UBUNTU_CODENAME}")
    echo "deb [arch=${ARCH} signed-by=/etc/apt/keyrings/docker.gpg] https://download.docker.com/linux/${ID} ${CODENAME} stable" \
        > /etc/apt/sources.list.d/docker.list
    apt-get update -y >/dev/null
    apt-get install -y --no-install-recommends \
        docker-ce docker-ce-cli containerd.io docker-buildx-plugin docker-compose-plugin >/dev/null
    systemctl enable --now docker >/dev/null
    ok "Docker installé : $(docker --version)"
fi

# ---------- 5. Nginx + Certbot ------------------------------------------------
if [[ "${SKIP_NGINX:-0}" != "1" ]]; then
    step "Installation de Nginx + Certbot (si absents)"
    if command -v nginx >/dev/null 2>&1; then
        ok "Nginx déjà installé : $(nginx -v 2>&1)"
    else
        apt-get install -y --no-install-recommends nginx >/dev/null
        ok "Nginx installé"
    fi
    if [[ "${SKIP_TLS:-0}" != "1" ]]; then
        if command -v certbot >/dev/null 2>&1 && dpkg -s python3-certbot-nginx >/dev/null 2>&1; then
            ok "Certbot + plugin Nginx déjà présents"
        else
            apt-get install -y --no-install-recommends certbot python3-certbot-nginx >/dev/null
            ok "Certbot + plugin Nginx installés"
        fi
    fi
    systemctl enable --now nginx >/dev/null 2>&1 || true
fi

# ---------- 6. Code source ----------------------------------------------------
step "Préparation du code dans ${INSTALL_DIR}"
mkdir -p "${INSTALL_DIR}"

if [[ "$SOURCE_MODE" == "local" ]]; then
    rsync -a --delete \
        --exclude '.git/' --exclude 'node_modules/' --exclude '.next/' \
        --exclude '.env' --exclude 'deploy/install.sh' \
        "$PROJECT_DIR"/ "$INSTALL_DIR"/
    ok "Code copié depuis ${PROJECT_DIR}"
else
    if [[ -d "${INSTALL_DIR}/.git" ]]; then
        git -C "${INSTALL_DIR}" fetch --all --prune
        git -C "${INSTALL_DIR}" reset --hard origin/HEAD || git -C "${INSTALL_DIR}" pull --ff-only
        ok "Dépôt mis à jour"
    else
        # On clone dans un dossier temporaire puis on synchronise (préserve .env existant)
        TMP_CLONE=$(mktemp -d)
        git clone --depth 1 "${REPO_URL}" "${TMP_CLONE}" >/dev/null
        rsync -a --delete \
            --exclude '.env' \
            "${TMP_CLONE}"/ "${INSTALL_DIR}"/
        rm -rf "${TMP_CLONE}"
        ok "Dépôt cloné depuis ${REPO_URL}"
    fi
fi

# Sanity check : les fichiers indispensables sont bien là
for f in docker-compose.yml Dockerfile package.json; do
    [[ -f "${INSTALL_DIR}/${f}" ]] || fail "Fichier manquant après synchro : ${f}"
done
ok "Arborescence du projet validée"

# ---------- 7. Fichier .env ---------------------------------------------------
step "Configuration de l'environnement"
ENV_FILE="${INSTALL_DIR}/.env"

# Si .env existe déjà, on ne ré-écrase pas (on met juste à jour les valeurs critiques)
if [[ -f "$ENV_FILE" ]]; then
    info ".env existant détecté — mise à jour ciblée des variables"
    # Met à jour ou ajoute une variable
    upsert_env() {
        local key="$1" value="$2"
        if grep -qE "^${key}=" "$ENV_FILE"; then
            sed -i "s|^${key}=.*|${key}=${value}|" "$ENV_FILE"
        else
            echo "${key}=${value}" >> "$ENV_FILE"
        fi
    }
    upsert_env "DOMAIN" "${DOMAIN}"
    upsert_env "NEXT_PUBLIC_BASE_URL" "https://${DOMAIN}"
    # On garde l'ADMIN_PASSWORD existant sauf si l'utilisateur a explicitement fourni le sien
    if [[ "${GENERATED_PASSWORD}" == "0" ]]; then
        upsert_env "ADMIN_PASSWORD" "${ADMIN_PASSWORD}"
    else
        # Si pas d'ADMIN_PASSWORD défini dans .env, on met celui généré
        grep -qE '^ADMIN_PASSWORD=' "$ENV_FILE" || echo "ADMIN_PASSWORD=${ADMIN_PASSWORD}" >> "$ENV_FILE"
        # Lire celui actuellement en place (peut être l'ancien ou le nouveau)
        ADMIN_PASSWORD=$(grep -E '^ADMIN_PASSWORD=' "$ENV_FILE" | head -n1 | cut -d= -f2-)
        GENERATED_PASSWORD=0  # on n'affichera pas comme nouveau s'il existait déjà
    fi
else
    cat > "$ENV_FILE" <<EOF
# Généré automatiquement par install.sh le $(date -u +%Y-%m-%dT%H:%M:%SZ)
DOMAIN=${DOMAIN}
NEXT_PUBLIC_BASE_URL=https://${DOMAIN}
ADMIN_PASSWORD=${ADMIN_PASSWORD}
EOF
    chmod 600 "$ENV_FILE"
fi
chown root:root "$ENV_FILE"
chmod 600 "$ENV_FILE"
ok ".env écrit : ${ENV_FILE}"

# ---------- 8. Docker Compose : build & démarrage -----------------------------
step "Build et démarrage des conteneurs"
cd "${INSTALL_DIR}"
docker compose --project-name "${COMPOSE_PROJECT_NAME}" pull --quiet || true
docker compose --project-name "${COMPOSE_PROJECT_NAME}" up -d --build
ok "Conteneurs démarrés"

# ---------- 9. Health check ---------------------------------------------------
step "Vérification de l'API (timeout 90s)"
HEALTH_URL="http://127.0.0.1:8006/api/health"
attempt=0
until curl -fsS "$HEALTH_URL" >/dev/null 2>&1; do
    attempt=$((attempt + 1))
    if (( attempt > 30 )); then
        echo
        echo "    Logs récents :"
        docker compose --project-name "${COMPOSE_PROJECT_NAME}" logs --tail=60 || true
        fail "L'application ne répond pas sur ${HEALTH_URL} après 90s."
    fi
    printf "    En attente du démarrage... (%s/30)\r" "$attempt"
    sleep 3
done
echo
HEALTH_BODY=$(curl -fsS "$HEALTH_URL")
ok "API en ligne — ${HEALTH_BODY}"

# ---------- 10. Nginx (reverse-proxy + HTTPS via Certbot) --------------------
if [[ "${SKIP_NGINX:-0}" != "1" ]]; then
    step "Configuration de Nginx pour ${DOMAIN}"
    NGINX_AVAIL=/etc/nginx/sites-available/portail-vitae
    NGINX_ENABLED=/etc/nginx/sites-enabled/portail-vitae

    mkdir -p /etc/nginx/sites-available /etc/nginx/sites-enabled

    # On écrit un vhost HTTP minimal compatible avec le plugin Certbot --nginx,
    # qui ajoutera ensuite automatiquement le bloc HTTPS et le redirect 80→443.
    # Si la conf existe déjà, on la backup une fois puis on l'écrase.
    if [[ -f "$NGINX_AVAIL" ]]; then
        cp -n "$NGINX_AVAIL" "${NGINX_AVAIL}.bak.$(date +%s)" || true
    fi

    cat > "$NGINX_AVAIL" <<NGINXEOF
# Managed by portail-vitae install.sh — do not edit manually
server {
    listen 80;
    listen [::]:80;
    server_name ${DOMAIN};

    # Required for chunked uploads (4 MB per chunk + headroom)
    client_max_body_size 25M;

    # Performance / compression
    gzip on;
    gzip_types text/plain text/css application/json application/javascript image/svg+xml;

    # Reverse proxy vers le conteneur app sur 127.0.0.1:8006
    location / {
        proxy_pass         http://127.0.0.1:8006;
        proxy_http_version 1.1;
        proxy_set_header   Upgrade           \$http_upgrade;
        proxy_set_header   Connection        "upgrade";
        proxy_set_header   Host              \$host;
        proxy_set_header   X-Real-IP         \$remote_addr;
        proxy_set_header   X-Forwarded-For   \$proxy_add_x_forwarded_for;
        proxy_set_header   X-Forwarded-Proto \$scheme;
        proxy_read_timeout 90s;
    }

    access_log /var/log/nginx/portail-vitae.access.log;
    error_log  /var/log/nginx/portail-vitae.error.log warn;
}
NGINXEOF

    # Symlink dans sites-enabled (idempotent)
    ln -sfn "$NGINX_AVAIL" "$NGINX_ENABLED"
    ok "Vhost Nginx déposé : $NGINX_AVAIL"

    # On garde le default activé si l'utilisateur a d'autres sites — on ne le supprime PAS
    # (l'utilisateur a précisé qu'il utilise Nginx pour tout le domaine + sous-domaines)

    # Validation puis reload
    if nginx -t >/dev/null 2>&1; then
        systemctl reload nginx
        ok "Nginx rechargé (vhost HTTP actif)"
    else
        warn "Configuration Nginx invalide — détails ci-dessous :"
        nginx -t || true
        fail "Corrigez $NGINX_AVAIL puis relancez : systemctl reload nginx"
    fi

    # --- TLS via Certbot ---
    if [[ "${SKIP_TLS:-0}" != "1" ]]; then
        if [[ -d "/etc/letsencrypt/live/${DOMAIN}" ]]; then
            ok "Certificat Let's Encrypt déjà présent pour ${DOMAIN} (renouvellement géré par certbot.timer)"
        else
            step "Émission du certificat TLS Let's Encrypt pour ${DOMAIN}"
            if getent hosts "$DOMAIN" >/dev/null 2>&1; then
                if certbot --nginx \
                    --non-interactive --agree-tos --redirect \
                    -m "$EMAIL" -d "$DOMAIN"; then
                    ok "Certificat émis et bloc HTTPS configuré par Certbot"
                else
                    warn "Certbot a échoué — l'application reste accessible en HTTP. Relancez plus tard :"
                    info "  sudo certbot --nginx -d $DOMAIN --redirect -m $EMAIL --agree-tos"
                fi
            else
                warn "Le domaine ${DOMAIN} ne résout pas encore — émission Let's Encrypt sautée."
                info "Une fois le DNS propagé, lancez :"
                info "  sudo certbot --nginx -d $DOMAIN --redirect -m $EMAIL --agree-tos"
            fi
        fi
    else
        info "SKIP_TLS=1 : aucune émission de certificat (le TLS amont est probablement géré ailleurs)"
    fi
fi

# ---------- 11. Pare-feu (UFW) ------------------------------------------------
if [[ "${SKIP_FIREWALL:-0}" != "1" ]]; then
    step "Configuration du pare-feu (UFW)"
    ufw allow OpenSSH >/dev/null 2>&1 || ufw allow 22/tcp >/dev/null
    ufw allow 80/tcp  >/dev/null
    ufw allow 443/tcp >/dev/null
    if ! ufw status | grep -q "Status: active"; then
        echo "y" | ufw enable >/dev/null
    fi
    ok "UFW actif : 22, 80, 443 ouverts (8006 reste local)"
fi

# ---------- 12. Récapitulatif -------------------------------------------------
step "Installation terminée"
cat <<EOF

  ${GREEN}${BOLD}✔ Portail Vitae Publica déployé avec succès !${NC}

  ${BOLD}URL publique :${NC}    https://${DOMAIN}
  ${BOLD}Administration :${NC}  https://${DOMAIN}/admin
  ${BOLD}Mot de passe :${NC}    ${ADMIN_PASSWORD}
  ${BOLD}Dossier app :${NC}     ${INSTALL_DIR}
  ${BOLD}Fichier env :${NC}     ${ENV_FILE}

  ${DIM}Commandes utiles${NC}
    cd ${INSTALL_DIR}
    docker compose ps              # état des conteneurs
    docker compose logs -f app     # logs applicatifs en direct
    docker compose restart app     # redémarrage app
    docker compose down            # arrêt complet
    sudo nginx -t && sudo systemctl reload nginx   # recharger le reverse-proxy
    sudo certbot renew --dry-run                   # tester le renouvellement TLS

  ${DIM}Sauvegarde MongoDB${NC}
    docker compose exec mongo mongodump --db vitae_publica \\
        --archive=/tmp/vitae-\$(date +%F).archive

EOF

if [[ "${GENERATED_PASSWORD}" == "1" ]]; then
    warn "Mot de passe admin généré automatiquement — notez-le maintenant ! Il est stocké dans ${ENV_FILE} (chmod 600)."
fi

# Avertissement DNS si on n'arrive pas à résoudre le domaine
if ! getent hosts "${DOMAIN}" >/dev/null 2>&1; then
    warn "Le domaine ${DOMAIN} ne résout pas encore. Certbot ne pourra obtenir le certificat TLS qu'une fois le DNS pointé vers ce serveur (enregistrement A/AAAA)."
fi

exit 0
