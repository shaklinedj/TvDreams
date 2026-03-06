param(
  [string]$MySqlHost = "localhost",
  [int]$MySqlPort = 3306,
  [string]$MySqlRootUser = "root",
  [string]$MySqlRootPassword = "",
  [string]$MySqlDatabase = "cms_usuarios_jules",
  [string]$MySqlAppUser = "cms_user",
  [string]$MySqlAppPassword = "pru5e@hu",
  [ValidateSet("dev", "prod")]
  [string]$Mode = "dev",
  [switch]$InstallPrereqs,
  [switch]$SkipServerStart
)

$ErrorActionPreference = "Stop"

function Write-Step {
  param([string]$Message)
  Write-Host "`n==> $Message" -ForegroundColor Cyan
}

function Ensure-Command {
  param(
    [string]$CommandName,
    [string]$InstallHint
  )

  if (-not (Get-Command $CommandName -ErrorAction SilentlyContinue)) {
    throw "No se encontro '$CommandName'. $InstallHint"
  }
}

function Find-MySqlExe {
  $cmd = Get-Command mysql -ErrorAction SilentlyContinue
  if ($cmd) {
    return $cmd.Source
  }

  $commonPaths = @(
    "C:\Program Files\MySQL\MySQL Server 8.0\bin\mysql.exe",
    "C:\Program Files\MySQL\MySQL Server 8.4\bin\mysql.exe",
    "C:\Program Files\MariaDB 11.0\bin\mysql.exe",
    "C:\Program Files\MariaDB 10.11\bin\mysql.exe"
  )

  foreach ($p in $commonPaths) {
    if (Test-Path $p) {
      return $p
    }
  }

  return $null
}

function Start-MySqlServiceIfPresent {
  $serviceCandidates = @("MySQL80", "MySQL", "MySQL57", "MariaDB")
  foreach ($svcName in $serviceCandidates) {
    $svc = Get-Service -Name $svcName -ErrorAction SilentlyContinue
    if ($svc) {
      if ($svc.Status -ne "Running") {
        Write-Step "Iniciando servicio $svcName"
        Start-Service -Name $svcName
      }
      return
    }
  }

  Write-Host "No se encontro servicio MySQL/MariaDB con nombre conocido. Continuando..." -ForegroundColor Yellow
}

function Set-EnvVarInFile {
  param(
    [string]$Path,
    [string]$Key,
    [string]$Value
  )

  $escapedKey = [Regex]::Escape($Key)
  $content = Get-Content $Path -Raw

  if ($content -match "(?m)^$escapedKey=") {
    $content = [Regex]::Replace($content, "(?m)^$escapedKey=.*$", "$Key=$Value")
  } else {
    if (-not $content.EndsWith("`n")) {
      $content += "`n"
    }
    $content += "$Key=$Value`n"
  }

  Set-Content -Path $Path -Value $content -Encoding utf8
}

function Invoke-MySqlScript {
  param(
    [string]$MySqlExe,
    [string]$ScriptPath
  )

  $args = @(
    "-h", $MySqlHost,
    "-P", "$MySqlPort",
    "-u", $MySqlRootUser
  )

  if ($MySqlRootPassword -ne "") {
    $args += "-p$MySqlRootPassword"
  }

  $args += @("-e", "source `"$ScriptPath`";")

  & $MySqlExe @args
  if ($LASTEXITCODE -ne 0) {
    throw "Fallo al ejecutar script SQL: $ScriptPath"
  }
}

function Test-MySqlLogin {
  param(
    [string]$MySqlExe,
    [string]$User,
    [string]$Password,
    [string]$Database
  )

  $args = @(
    "-h", $MySqlHost,
    "-P", "$MySqlPort",
    "-u", $User,
    "-D", $Database,
    "-e", "SELECT COUNT(*) AS total_tables FROM information_schema.tables WHERE table_schema = '$Database';"
  )

  if ($Password -ne "") {
    $args += "-p$Password"
  }

  & $MySqlExe @args
  if ($LASTEXITCODE -ne 0) {
    throw "No se pudo validar login de app MySQL con el usuario '$User'."
  }
}

Set-Location $PSScriptRoot

if ($InstallPrereqs) {
  Write-Step "Instalando prerequisitos con winget (si faltan)"
  $winget = Get-Command winget -ErrorAction SilentlyContinue
  if (-not $winget) {
    throw "No se encontro winget. Instala App Installer de Microsoft o instala Node/MySQL manualmente."
  }

  if (-not (Get-Command node -ErrorAction SilentlyContinue)) {
    winget install -e --id OpenJS.NodeJS.LTS --accept-source-agreements --accept-package-agreements
  }

  $mysqlCmd = Find-MySqlExe
  if (-not $mysqlCmd) {
    winget install -e --id Oracle.MySQL --accept-source-agreements --accept-package-agreements
  }

  # Refresh PATH so newly installed tools are available in this same shell session.
  $machinePath = [System.Environment]::GetEnvironmentVariable("Path", "Machine")
  $userPath = [System.Environment]::GetEnvironmentVariable("Path", "User")
  $env:Path = "$machinePath;$userPath"
}

Write-Step "Validando herramientas base"
Ensure-Command -CommandName "node" -InstallHint "Ejecuta este script con -InstallPrereqs o instala Node.js 18+ (LTS)."
Ensure-Command -CommandName "npm" -InstallHint "Ejecuta este script con -InstallPrereqs o instala npm junto con Node.js."

Write-Step "Buscando cliente MySQL"
$mysqlExe = Find-MySqlExe
if (-not $mysqlExe) {
  throw "No se encontro mysql.exe. Instala MySQL Server (incluyendo cliente CLI) y reintenta."
}
Write-Host "Usando MySQL CLI: $mysqlExe"

Start-MySqlServiceIfPresent

Write-Step "Preparando archivo .env"
$envPath = Join-Path $PSScriptRoot ".env"
$envExamplePath = Join-Path $PSScriptRoot ".env.example"

if (-not (Test-Path $envPath)) {
  if (Test-Path $envExamplePath) {
    Copy-Item $envExamplePath $envPath
  } else {
    New-Item -ItemType File -Path $envPath | Out-Null
  }
}

Set-EnvVarInFile -Path $envPath -Key "MYSQL_HOST" -Value $MySqlHost
Set-EnvVarInFile -Path $envPath -Key "MYSQL_PORT" -Value "$MySqlPort"
Set-EnvVarInFile -Path $envPath -Key "MYSQL_USER" -Value $MySqlAppUser
Set-EnvVarInFile -Path $envPath -Key "MYSQL_PASSWORD" -Value $MySqlAppPassword
Set-EnvVarInFile -Path $envPath -Key "MYSQL_DATABASE" -Value $MySqlDatabase

Write-Step "Instalando dependencias Node"
npm install
if ($LASTEXITCODE -ne 0) {
  throw "npm install fallo."
}

Write-Step "Creando base de datos, usuario y permisos"
Invoke-MySqlScript -MySqlExe $mysqlExe -ScriptPath (Join-Path $PSScriptRoot "database/setup-database.sql")

Write-Step "Creando tablas y datos iniciales"
Invoke-MySqlScript -MySqlExe $mysqlExe -ScriptPath (Join-Path $PSScriptRoot "database/full-schema.sql")

Write-Step "Verificando acceso con usuario de aplicacion"
Test-MySqlLogin -MySqlExe $mysqlExe -User $MySqlAppUser -Password $MySqlAppPassword -Database $MySqlDatabase

Write-Step "Creando directorios requeridos"
node scripts/setup-dirs.js
if ($LASTEXITCODE -ne 0) {
  throw "No se pudieron crear directorios requeridos."
}

if (-not $SkipServerStart) {
  if ($Mode -eq "prod") {
    Write-Step "Build de frontend"
    npm run build
    if ($LASTEXITCODE -ne 0) {
      throw "npm run build fallo."
    }

    Write-Step "Iniciando servidor en modo produccion"
    npm run start
  } else {
    Write-Step "Iniciando en modo desarrollo (frontend + backend)"
    npm run dev
  }
} else {
  Write-Step "Inicializacion completa (arranque omitido por parametro)"
  Write-Host "Para iniciar en desarrollo: npm run dev"
  Write-Host "Para iniciar en produccion: npm run build && npm run start"
}
