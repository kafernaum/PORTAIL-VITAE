#!/usr/bin/env bash
# ==============================================================================
#  Portail Vitae Publica — Script de mise à jour (upgrade)
# ------------------------------------------------------------------------------
#  À utiliser UNIQUEMENT si vous avez déjà installé l'application avec
#  deploy/install.sh. Ce script applique les améliorations sans réinstaller
#  Docker / Caddy / UFW :
#    1. Synchronise le code à jour dans ${INSTALL_DIR}
#    2. Rebuild l'image Docker (ajout de ffmpeg dans le Dockerfile)
#    3. Redémarre les conteneurs proprement (volume uploads préservé)
#    4. Vérifie ffmpeg dans le conteneur et les nouveaux endpoints d'upload
#
#  Usage (interactif) :
#     sudo bash deploy/upgrade.sh
#
#  Usage (non-interactif) :
#     sudo INSTALL_DIR=/opt/portail-vitae REPO_URL=https://github.com/.../...git \
#          bash deploy/upgrade.sh
#
#  Variables d'environnement reconnues :
#     INSTALL_DIR     (optionnel)   Défaut : /opt/portail-vitae
#     REPO_URL        (optionnel)   Si défini : git pull/clone depuis cette URL
#                                   Sinon : copie depuis le dossier où se trouve ce script
#     SKIP_REBUILD    (optionnel)   "1" pour ne pas rebuild l'image Docker
#     SKIP_HEALTH     (optionnel)   "1" pour ne pas tester les endpoints après upgrade
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

trap 'fail "Le script a échoué à la ligne $LINENO. Consultez la sortie ci-dessus."' ERR

# ---------- 1. Pré-requis -----------------------------------------------------
step "Pré-requis"

if [[ $EUID -ne 0 ]]; then
    fail "Ce script doit être exécuté en root (utilisez sudo)."
fi
ok "Exécution en root"

if ! command -v docker >/dev/null 2>&1; then
    fail "Docker n'est pas installé. Lancez d'abord deploy/install.sh."
fi
if ! docker compose version >/dev/null 2>&1; then
    fail "Docker Compose plugin manquant. Lancez d'abord deploy/install.sh."
fi
ok "Docker + Compose présents : $(docker --version | awk '{print $3}' | tr -d ',')"

INSTALL_DIR="${INSTALL_DIR:-/opt/portail-vitae}"
COMPOSE_PROJECT_NAME="portail-vitae"

if [[ ! -d "$INSTALL_DIR" ]]; then
    fail "Dossier d'installation introuvable : $INSTALL_DIR. Lancez d'abord deploy/install.sh."
fi
if [[ ! -f "$INSTALL_DIR/docker-compose.yml" ]]; then
    fail "$INSTALL_DIR ne contient pas de docker-compose.yml. Installation invalide."
fi
if [[ ! -f "$INSTALL_DIR/.env" ]]; then
    fail "$INSTALL_DIR/.env manquant. Lancez d'abord deploy/install.sh."
fi
ok "Installation détectée : $INSTALL_DIR"

# ---------- 2. État courant ---------------------------------------------------
step "État courant de l'application"
cd "$INSTALL_DIR"

CURRENT_CONTAINERS=$(docker compose --project-name "$COMPOSE_PROJECT_NAME" ps --status running -q 2>/dev/null | wc -l || echo "0")
info "Conteneurs en cours d'exécution : ${CURRENT_CONTAINERS}"

# Vérifie volume uploads préservé
if docker volume inspect "${COMPOSE_PROJECT_NAME}_uploads_data" >/dev/null 2>&1; then
    UPLOADED_FILES=$(docker run --rm -v "${COMPOSE_PROJECT_NAME}_uploads_data:/d" alpine \
        sh -c 'ls -1 /d/uploads 2>/dev/null | grep -v "^\.tmp$" | wc -l' 2>/dev/null || echo "?")
    ok "Volume uploads_data présent (~${UPLOADED_FILES} fichier(s) utilisateur)"
else
    info "Volume uploads_data sera créé au premier démarrage."
fi

# ---------- 3. Synchronisation du code ----------------------------------------
step "Synchronisation du code"

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
PROJECT_DIR="$(cd "$SCRIPT_DIR/.." && pwd)"

# Backup du Dockerfile actuel pour rollback éventuel
TS=$(date -u +%Y%m%d-%H%M%S)
cp "$INSTALL_DIR/Dockerfile" "$INSTALL_DIR/Dockerfile.bak.$TS" 2>/dev/null || true
cp "$INSTALL_DIR/docker-compose.yml" "$INSTALL_DIR/docker-compose.yml.bak.$TS" 2>/dev/null || true
ok "Backups créés : Dockerfile.bak.$TS, docker-compose.yml.bak.$TS"

if [[ -n "${REPO_URL:-}" ]]; then
    if [[ -d "$INSTALL_DIR/.git" ]]; then
        info "git pull depuis ${REPO_URL}"
        git -C "$INSTALL_DIR" fetch --all --prune
        git -C "$INSTALL_DIR" reset --hard origin/HEAD 2>/dev/null || git -C "$INSTALL_DIR" pull --ff-only
        ok "Dépôt mis à jour"
    else
        TMP_CLONE=$(mktemp -d)
        git clone --depth 1 "$REPO_URL" "$TMP_CLONE" >/dev/null
        rsync -a --exclude '.env' --exclude '/data/' "$TMP_CLONE"/ "$INSTALL_DIR"/
        rm -rf "$TMP_CLONE"
        ok "Code copié depuis $REPO_URL"
    fi
elif [[ -f "$PROJECT_DIR/Dockerfile" && -f "$PROJECT_DIR/docker-compose.yml" && -f "$PROJECT_DIR/package.json" ]]; then
    info "Copie locale depuis $PROJECT_DIR"
    rsync -a --delete \
        --exclude '.git/' --exclude 'node_modules/' --exclude '.next/' \
        --exclude '.env' --exclude '/data/' \
        --exclude 'deploy/install.sh' --exclude 'deploy/upgrade.sh' \
        "$PROJECT_DIR"/ "$INSTALL_DIR"/
    ok "Code synchronisé"
else
    fail "Aucune source détectée. Définissez REPO_URL ou lancez ce script depuis un clone à jour du dépôt."
fi

# Sanity checks : nouveaux composants présents ?
NEW_FILES=(
    "components/file-drop.jsx"
)
for f in "${NEW_FILES[@]}"; do
    if [[ ! -f "$INSTALL_DIR/$f" ]]; then
        fail "Fichier attendu manquant : $f (vous n'avez peut-être pas la dernière version du code)."
    fi
done
ok "Nouveaux composants détectés (file-drop.jsx)"

# Le Dockerfile doit contenir ffmpeg pour cette upgrade
if ! grep -q "ffmpeg" "$INSTALL_DIR/Dockerfile" 2>/dev/null; then
    warn "Le nouveau Dockerfile devrait contenir ffmpeg — vérifiez la branche."
else
    ok "Dockerfile à jour (inclut ffmpeg)"
fi

# Le docker-compose doit contenir le volume uploads_data
if ! grep -q "uploads_data" "$INSTALL_DIR/docker-compose.yml" 2>/dev/null; then
    warn "docker-compose.yml ne déclare pas uploads_data — vérifiez la branche."
else
    ok "docker-compose.yml à jour (déclare le volume uploads_data)"
fi

# ---------- 4. Migration .env (ajout UPLOAD_DIR si manquant) -----------------
step "Mise à jour de .env (non destructif)"
ENV_FILE="$INSTALL_DIR/.env"
if ! grep -qE '^UPLOAD_DIR=' "$ENV_FILE"; then
    echo "UPLOAD_DIR=/app/data/uploads" >> "$ENV_FILE"
    ok "UPLOAD_DIR ajouté dans .env"
else
    ok ".env déjà à jour"
fi
chmod 600 "$ENV_FILE"

# ---------- 5. Rebuild + redémarrage -----------------------------------------
if [[ "${SKIP_REBUILD:-0}" != "1" ]]; then
    step "Rebuild de l'image Docker (ffmpeg + nouveau code)"
    docker compose --project-name "$COMPOSE_PROJECT_NAME" build --pull app
    ok "Image rebuilte"

    step "Redémarrage des conteneurs (volumes préservés)"
    docker compose --project-name "$COMPOSE_PROJECT_NAME" up -d --force-recreate --no-deps app
    # mongo n'est pas touché : on évite --force-recreate sur le service mongo
    ok "Conteneur app recréé (mongo + volumes préservés)"

    step "Nettoyage des anciennes images orphelines"
    docker image prune -f >/dev/null 2>&1 || true
    ok "Images orphelines supprimées"
else
    warn "Rebuild ignoré (SKIP_REBUILD=1) — l'image actuelle n'aura pas ffmpeg"
fi

# ---------- 6. Vérifications post-upgrade ------------------------------------
if [[ "${SKIP_HEALTH:-0}" != "1" ]]; then
    step "Vérification — API health (timeout 90s)"
    HEALTH_URL="http://127.0.0.1:8006/api/health"
    attempt=0
    until curl -fsS "$HEALTH_URL" >/dev/null 2>&1; do
        attempt=$((attempt + 1))
        if (( attempt > 30 )); then
            echo
            docker compose --project-name "$COMPOSE_PROJECT_NAME" logs --tail=80 app || true
            fail "API ne répond pas sur $HEALTH_URL après 90 s."
        fi
        printf "    En attente de l'API... (%s/30)\r" "$attempt"
        sleep 3
    done
    echo
    ok "API en ligne — $(curl -fsS "$HEALTH_URL")"

    step "Vérification — ffmpeg disponible dans le conteneur"
    if docker compose --project-name "$COMPOSE_PROJECT_NAME" exec -T app sh -c 'command -v ffmpeg >/dev/null && ffmpeg -version 2>&1 | head -1' >/tmp/ffmpeg.check 2>&1; then
        ok "$(cat /tmp/ffmpeg.check | head -1)"
        rm -f /tmp/ffmpeg.check
    else
        warn "ffmpeg introuvable dans le conteneur — les thumbnails vidéo seront désactivés."
        cat /tmp/ffmpeg.check 2>/dev/null || true
    fi

    step "Vérification — endpoints d'upload"
    # POST sans auth doit renvoyer 401 (l'endpoint existe + sécurité ON)
    CODE=$(curl -s -o /dev/null -w "%{http_code}" -X POST "$HEALTH_URL/../uploads/init" -H "Content-Type: application/json" -d '{}')
    if [[ "$CODE" == "401" ]]; then
        ok "POST /api/uploads/init → 401 sans auth (endpoint OK, sécurité OK)"
    else
        warn "POST /api/uploads/init a répondu $CODE (attendu 401). À vérifier."
    fi

    CODE=$(curl -s -o /dev/null -w "%{http_code}" -X DELETE "http://127.0.0.1:8006/api/files/nonexistent.png")
    if [[ "$CODE" == "401" ]]; then
        ok "DELETE /api/files/... → 401 sans auth (endpoint OK)"
    else
        warn "DELETE /api/files/... a répondu $CODE (attendu 401). À vérifier."
    fi

    # Test fonctionnel complet : upload mini-vidéo + thumbnail si ffmpeg dispo
    step "Test fonctionnel — upload + thumbnail (mini-vidéo 1 chunk)"
    ADMIN_PW=$(grep -E '^ADMIN_PASSWORD=' "$ENV_FILE" | head -1 | cut -d= -f2-)
    if [[ -z "$ADMIN_PW" ]]; then
        warn "ADMIN_PASSWORD introuvable dans .env, test fonctionnel sauté"
    elif ! command -v ffmpeg >/dev/null 2>&1; then
        info "ffmpeg absent côté hôte : test fonctionnel sauté (sans impact sur la prod)"
    else
        TESTDIR=$(mktemp -d)
        ffmpeg -y -f lavfi -i testsrc=duration=2:size=320x240:rate=10 -c:v libx264 -t 2 "$TESTDIR/t.mp4" -loglevel error
        FSIZE=$(stat -c%s "$TESTDIR/t.mp4")
        INIT=$(curl -s -X POST "http://127.0.0.1:8006/api/uploads/init" \
            -H "Authorization: Bearer $ADMIN_PW" -H "Content-Type: application/json" \
            -d "{\"filename\":\"upgrade-test.mp4\",\"fileSize\":$FSIZE,\"mimeType\":\"video/mp4\"}") || true
        UPID=$(echo "$INIT" | grep -oE '"uploadId":"[^"]+"' | cut -d'"' -f4)
        if [[ -n "$UPID" ]]; then
            RES=$(curl -s -X POST "http://127.0.0.1:8006/api/uploads/chunk" \
                -H "Authorization: Bearer $ADMIN_PW" \
                -F "uploadId=$UPID" -F "chunkIndex=0" -F "chunk=@$TESTDIR/t.mp4")
            THUMB=$(echo "$RES" | grep -oE '"thumbnailUrl":"[^"]+"' | cut -d'"' -f4 || true)
            if [[ -n "$THUMB" && "$THUMB" != "null" ]]; then
                ok "Upload + thumbnail OK ($THUMB)"
            else
                warn "Upload OK mais thumbnail vide (ffmpeg peut-être pas dans le conteneur). Réponse : $RES"
            fi
            # cleanup test
            curl -s -X DELETE "http://127.0.0.1:8006/api/files/${UPID}.mp4" -H "Authorization: Bearer $ADMIN_PW" >/dev/null || true
        else
            warn "Init upload a échoué — réponse : $INIT"
        fi
        rm -rf "$TESTDIR"
    fi
fi

# ---------- 7. Récapitulatif --------------------------------------------------
step "Mise à jour terminée"
DOMAIN=$(grep -E '^DOMAIN=' "$ENV_FILE" | head -1 | cut -d= -f2- || echo "votre-domaine")
cat <<EOF

  ${GREEN}${BOLD}✔ Mise à jour appliquée avec succès !${NC}

  ${BOLD}URL publique :${NC}    https://${DOMAIN}
  ${BOLD}Administration :${NC}  https://${DOMAIN}/admin

  ${DIM}Améliorations appliquées :${NC}
    • Upload chunké (init/chunk endpoints) — images et vidéos jusqu'à 500 Mo
    • Composant FileDrop : drag & drop + bouton + barre de progression
    • Bouton "Supprimer le fichier" pour les uploads existants
    • Génération automatique de thumbnails vidéo via ffmpeg
    • Champ posterUrl côté vidéos + attribut <video poster> côté public
    • Champ imageUrl + description sur les liens (Section II Écosystème)
    • Volume Docker uploads_data pour persistance

  ${DIM}Commandes utiles${NC}
    cd ${INSTALL_DIR}
    docker compose ps                    # état des conteneurs
    docker compose logs -f app           # logs applicatifs en direct
    docker compose exec app ffmpeg -version  # vérifier ffmpeg dans le conteneur

  ${DIM}Rollback en cas de besoin${NC}
    cd ${INSTALL_DIR}
    cp Dockerfile.bak.${TS} Dockerfile
    cp docker-compose.yml.bak.${TS} docker-compose.yml
    docker compose up -d --build --force-recreate app

EOF

exit 0
