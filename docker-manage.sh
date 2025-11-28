#!/bin/bash

# Script de gerenciamento do Docker - BuildStock
# Uso: ./docker-manage.sh [comando]

set -e

# Cores para output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m' # No Color

# Funções auxiliares
print_success() {
    echo -e "${GREEN}✓ $1${NC}"
}

print_error() {
    echo -e "${RED}✗ $1${NC}"
}

print_info() {
    echo -e "${BLUE}ℹ $1${NC}"
}

print_warning() {
    echo -e "${YELLOW}⚠ $1${NC}"
}

# Comandos
cmd_start() {
    print_info "Iniciando containers..."
    docker-compose up -d
    print_success "Containers iniciados!"
    cmd_status
}

cmd_stop() {
    print_info "Parando containers..."
    docker-compose down
    print_success "Containers parados!"
}

cmd_restart() {
    print_info "Reiniciando containers..."
    docker-compose restart
    print_success "Containers reiniciados!"
    cmd_status
}

cmd_build() {
    print_info "Fazendo build das imagens..."
    docker-compose build --no-cache
    print_success "Build concluído!"
}

cmd_rebuild() {
    print_info "Rebuild completo (build + restart)..."
    docker-compose down
    docker-compose build --no-cache
    docker-compose up -d
    print_success "Rebuild concluído!"
    cmd_status
}

cmd_status() {
    print_info "Status dos containers:"
    docker-compose ps
}

cmd_logs() {
    SERVICE=${1:-}
    if [ -z "$SERVICE" ]; then
        print_info "Mostrando logs de todos os serviços..."
        docker-compose logs -f
    else
        print_info "Mostrando logs do serviço: $SERVICE"
        docker-compose logs -f "$SERVICE"
    fi
}

cmd_backup() {
    BACKUP_FILE="backup-$(date +%Y%m%d-%H%M%S).sqlite3"
    print_info "Fazendo backup do banco de dados..."
    docker cp estoque-backend:/app/data/db.sqlite3 "./$BACKUP_FILE"
    print_success "Backup salvo em: $BACKUP_FILE"
}

cmd_restore() {
    BACKUP_FILE=$1
    if [ -z "$BACKUP_FILE" ]; then
        print_error "Uso: $0 restore <arquivo-backup>"
        exit 1
    fi
    
    if [ ! -f "$BACKUP_FILE" ]; then
        print_error "Arquivo não encontrado: $BACKUP_FILE"
        exit 1
    fi
    
    print_warning "Isso irá substituir o banco de dados atual!"
    read -p "Deseja continuar? (s/N) " -n 1 -r
    echo
    if [[ $REPLY =~ ^[Ss]$ ]]; then
        print_info "Restaurando backup..."
        docker cp "$BACKUP_FILE" estoque-backend:/app/data/db.sqlite3
        docker-compose restart backend
        print_success "Backup restaurado!"
    else
        print_info "Operação cancelada."
    fi
}

cmd_clean() {
    print_warning "Isso irá remover containers, volumes e imagens!"
    read -p "Deseja continuar? (s/N) " -n 1 -r
    echo
    if [[ $REPLY =~ ^[Ss]$ ]]; then
        print_info "Limpando recursos..."
        docker-compose down -v
        docker system prune -f
        print_success "Limpeza concluída!"
    else
        print_info "Operação cancelada."
    fi
}

cmd_shell() {
    SERVICE=${1:-backend}
    print_info "Abrindo shell no container: $SERVICE"
    docker-compose exec "$SERVICE" sh
}

cmd_db() {
    print_info "Abrindo SQLite no banco de dados..."
    docker-compose exec backend sqlite3 /app/data/db.sqlite3
}

cmd_help() {
    cat << EOF
${BLUE}BuildStock - Gerenciamento Docker${NC}

${GREEN}Uso:${NC}
  $0 [comando] [opções]

${GREEN}Comandos:${NC}
  ${YELLOW}start${NC}              Iniciar containers
  ${YELLOW}stop${NC}               Parar containers
  ${YELLOW}restart${NC}            Reiniciar containers
  ${YELLOW}build${NC}              Build das imagens
  ${YELLOW}rebuild${NC}            Rebuild completo (down + build + up)
  ${YELLOW}status${NC}             Ver status dos containers
  ${YELLOW}logs [serviço]${NC}     Ver logs (backend, frontend ou todos)
  ${YELLOW}backup${NC}             Fazer backup do banco de dados
  ${YELLOW}restore <arquivo>${NC}  Restaurar backup do banco
  ${YELLOW}clean${NC}              Limpar containers, volumes e imagens
  ${YELLOW}shell [serviço]${NC}    Abrir shell no container (padrão: backend)
  ${YELLOW}db${NC}                 Abrir SQLite no banco de dados
  ${YELLOW}help${NC}               Mostrar esta ajuda

${GREEN}Exemplos:${NC}
  $0 start                    # Iniciar sistema
  $0 logs backend             # Ver logs do backend
  $0 backup                   # Fazer backup
  $0 restore backup.sqlite3   # Restaurar backup
  $0 shell frontend           # Shell no frontend

${GREEN}URLs:${NC}
  Frontend:  ${BLUE}http://localhost${NC}
  Backend:   ${BLUE}http://localhost:5000${NC}
  API Docs:  ${BLUE}http://localhost:5000/api/summary${NC}

EOF
}

# Main
COMMAND=${1:-help}
shift || true

case "$COMMAND" in
    start)
        cmd_start
        ;;
    stop)
        cmd_stop
        ;;
    restart)
        cmd_restart
        ;;
    build)
        cmd_build
        ;;
    rebuild)
        cmd_rebuild
        ;;
    status)
        cmd_status
        ;;
    logs)
        cmd_logs "$@"
        ;;
    backup)
        cmd_backup
        ;;
    restore)
        cmd_restore "$@"
        ;;
    clean)
        cmd_clean
        ;;
    shell)
        cmd_shell "$@"
        ;;
    db)
        cmd_db
        ;;
    help|--help|-h)
        cmd_help
        ;;
    *)
        print_error "Comando desconhecido: $COMMAND"
        echo
        cmd_help
        exit 1
        ;;
esac
