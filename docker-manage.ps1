# Script de gerenciamento do Docker - BuildStock (Windows PowerShell)
# Uso: .\docker-manage.ps1 [comando]

param(
    [Parameter(Position=0)]
    [string]$Command = "help",
    
    [Parameter(Position=1)]
    [string]$Arg1 = ""
)

# Funções auxiliares
function Print-Success {
    param([string]$Message)
    Write-Host "✓ $Message" -ForegroundColor Green
}

function Print-Error {
    param([string]$Message)
    Write-Host "✗ $Message" -ForegroundColor Red
}

function Print-Info {
    param([string]$Message)
    Write-Host "ℹ $Message" -ForegroundColor Blue
}

function Print-Warning {
    param([string]$Message)
    Write-Host "⚠ $Message" -ForegroundColor Yellow
}

# Comandos
function Start-Containers {
    Print-Info "Iniciando containers..."
    docker-compose up -d
    Print-Success "Containers iniciados!"
    Get-Status
}

function Stop-Containers {
    Print-Info "Parando containers..."
    docker-compose down
    Print-Success "Containers parados!"
}

function Restart-Containers {
    Print-Info "Reiniciando containers..."
    docker-compose restart
    Print-Success "Containers reiniciados!"
    Get-Status
}

function Build-Images {
    Print-Info "Fazendo build das imagens..."
    docker-compose build --no-cache
    Print-Success "Build concluído!"
}

function Rebuild-All {
    Print-Info "Rebuild completo (build + restart)..."
    docker-compose down
    docker-compose build --no-cache
    docker-compose up -d
    Print-Success "Rebuild concluído!"
    Get-Status
}

function Get-Status {
    Print-Info "Status dos containers:"
    docker-compose ps
}

function Get-Logs {
    param([string]$Service = "")
    
    if ($Service -eq "") {
        Print-Info "Mostrando logs de todos os serviços..."
        docker-compose logs -f
    } else {
        Print-Info "Mostrando logs do serviço: $Service"
        docker-compose logs -f $Service
    }
}

function Backup-Database {
    $BackupFile = "backup-$(Get-Date -Format 'yyyyMMdd-HHmmss').sqlite3"
    Print-Info "Fazendo backup do banco de dados..."
    docker cp estoque-backend:/app/data/db.sqlite3 ".\$BackupFile"
    Print-Success "Backup salvo em: $BackupFile"
}

function Restore-Database {
    param([string]$BackupFile)
    
    if ($BackupFile -eq "") {
        Print-Error "Uso: .\docker-manage.ps1 restore <arquivo-backup>"
        exit 1
    }
    
    if (-not (Test-Path $BackupFile)) {
        Print-Error "Arquivo não encontrado: $BackupFile"
        exit 1
    }
    
    Print-Warning "Isso irá substituir o banco de dados atual!"
    $confirmation = Read-Host "Deseja continuar? (s/N)"
    
    if ($confirmation -eq 's' -or $confirmation -eq 'S') {
        Print-Info "Restaurando backup..."
        docker cp $BackupFile estoque-backend:/app/data/db.sqlite3
        docker-compose restart backend
        Print-Success "Backup restaurado!"
    } else {
        Print-Info "Operação cancelada."
    }
}

function Clean-Resources {
    Print-Warning "Isso irá remover containers, volumes e imagens!"
    $confirmation = Read-Host "Deseja continuar? (s/N)"
    
    if ($confirmation -eq 's' -or $confirmation -eq 'S') {
        Print-Info "Limpando recursos..."
        docker-compose down -v
        docker system prune -f
        Print-Success "Limpeza concluída!"
    } else {
        Print-Info "Operação cancelada."
    }
}

function Open-Shell {
    param([string]$Service = "backend")
    
    Print-Info "Abrindo shell no container: $Service"
    docker-compose exec $Service sh
}

function Open-Database {
    Print-Info "Abrindo SQLite no banco de dados..."
    docker-compose exec backend sqlite3 /app/data/db.sqlite3
}

function Show-Help {
    Write-Host @"
BuildStock - Gerenciamento Docker

Uso:
  .\docker-manage.ps1 [comando] [opções]

Comandos:
  start              Iniciar containers
  stop               Parar containers
  restart            Reiniciar containers
  build              Build das imagens
  rebuild            Rebuild completo (down + build + up)
  status             Ver status dos containers
  logs [serviço]     Ver logs (backend, frontend ou todos)
  backup             Fazer backup do banco de dados
  restore <arquivo>  Restaurar backup do banco
  clean              Limpar containers, volumes e imagens
  shell [serviço]    Abrir shell no container (padrão: backend)
  db                 Abrir SQLite no banco de dados
  help               Mostrar esta ajuda

Exemplos:
  .\docker-manage.ps1 start                    # Iniciar sistema
  .\docker-manage.ps1 logs backend             # Ver logs do backend
  .\docker-manage.ps1 backup                   # Fazer backup
  .\docker-manage.ps1 restore backup.sqlite3   # Restaurar backup
  .\docker-manage.ps1 shell frontend           # Shell no frontend

URLs:
  Frontend:  http://localhost
  Backend:   http://localhost:5000
  API Docs:  http://localhost:5000/api/summary

"@ -ForegroundColor Cyan
}

# Main
switch ($Command.ToLower()) {
    "start" {
        Start-Containers
    }
    "stop" {
        Stop-Containers
    }
    "restart" {
        Restart-Containers
    }
    "build" {
        Build-Images
    }
    "rebuild" {
        Rebuild-All
    }
    "status" {
        Get-Status
    }
    "logs" {
        Get-Logs -Service $Arg1
    }
    "backup" {
        Backup-Database
    }
    "restore" {
        Restore-Database -BackupFile $Arg1
    }
    "clean" {
        Clean-Resources
    }
    "shell" {
        if ($Arg1 -eq "") { $Arg1 = "backend" }
        Open-Shell -Service $Arg1
    }
    "db" {
        Open-Database
    }
    "help" {
        Show-Help
    }
    default {
        Print-Error "Comando desconhecido: $Command"
        Write-Host ""
        Show-Help
        exit 1
    }
}
