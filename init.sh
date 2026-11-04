#!/usr/bin/env bash
set -euo pipefail

ROOT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
cd "$ROOT_DIR"

# Comandos personalizables por proyecto (opcionales; si están vacíos se usa autodetección multi-stack).
# Configura RUN_START_COMMAND=1 para lanzar START_CMD automáticamente tras superar las 3 puertas.
INSTALL_CMD="${INSTALL_CMD:-[ -d node_modules ] || npm ci}"
VERIFY_CMD="${VERIFY_CMD:-npm test && npm run build}"
START_CMD="${START_CMD:-npm run dev}"
RUN_START_COMMAND="${RUN_START_COMMAND:-0}"

has_pkg_script() {
  local script_name="$1"
  node -e "const s = require('./package.json').scripts || {}; process.exit(Object.prototype.hasOwnProperty.call(s, process.argv[1]) && s[process.argv[1]] ? 0 : 1);" "$script_name" >/dev/null 2>&1
}

run_pm_script() {
  local pm="$1"
  local script_name="$2"
  if [ "$pm" = "npm" ]; then
    npm run "$script_name"
  else
    "$pm" run "$script_name"
  fi
}

echo "=== 1. Confirmando Directorio de Trabajo ==="
echo "Ruta actual: $PWD"

echo "=== 2. [PUERTA 1: ESTÁTICA] Archivos Críticos, Sintaxis y Límites Arquitectónicos (6 Capas) ==="
for file in "AGENTS.md" "feature_list.json" "progress.md" "session-handoff.md" "clean-state-checklist.md" "memory/INDEX.md" "ARCHITECTURE.md" "scripts/check-architecture.sh" "scripts/feature-list.schema.json" ".gitignore"; do
  if [ ! -f "$file" ]; then
    echo "ERROR: Falta el archivo crítico '$file' en el repositorio."
    echo "POR QUÉ: El agente no puede operar ni verificar límites arquitectónicos sin su sistema de registro completo."
    echo "SOLUCIÓN (FIX): Restaura o crea el archivo '$file' siguiendo la especificación de AGENTS.md y ARCHITECTURE.md antes de continuar."
    exit 1
  fi
done
echo "OK: Todos los archivos críticos del arnés están presentes."

bash scripts/check-architecture.sh
node scripts/audit-secrets.js
node scripts/verify-gemini-models.js

echo "=== 3. [PUERTA 2: COMPORTAMIENTO] Validación de los 5 Subsistemas, Regla WIP=1, DAG y Pass-State Gating ==="
if command -v node >/dev/null 2>&1 && [ -f "scripts/validate-harness.mjs" ]; then
  node scripts/validate-harness.mjs --min-score 100
else
  echo "ERROR: No se encontró Node.js o 'scripts/validate-harness.mjs'."
  echo "POR QUÉ: La Puerta 2 requiere evaluar el comportamiento de los 5 subsistemas del arnés con puntaje 100/100."
  echo "SOLUCIÓN (FIX): Verifica que Node.js esté instalado en PATH y que 'scripts/validate-harness.mjs' exista."
  exit 1
fi

echo "=== 4. [PUERTA 3: SISTEMA COMPLETO] Sincronización y Flujo End-to-End del Proyecto (Build / Lint / Test) ==="
if [ -n "$INSTALL_CMD" ]; then
  echo "=== Sincronizando dependencias personalizadas ($INSTALL_CMD) ==="
  bash -c "$INSTALL_CMD"
fi

if [ -n "$VERIFY_CMD" ]; then
  echo "=== Ejecutando verificación personalizada ($VERIFY_CMD) ==="
  bash -c "$VERIFY_CMD"
elif [ -f "package.json" ]; then
  if [ -f "pnpm-lock.yaml" ]; then
    PM="pnpm"
  elif [ -f "yarn.lock" ]; then
    PM="yarn"
  elif [ -f "bun.lock" ] || [ -f "bun.lockb" ]; then
    PM="bun"
  else
    PM="npm"
  fi

  if [ -z "$INSTALL_CMD" ]; then
    echo "=== Instalando dependencias con $PM ==="
    if [ "$PM" = "npm" ]; then
      npm install
    else
      "$PM" install
    fi
  fi

  if has_pkg_script "check"; then
    run_pm_script "$PM" "check"
  elif has_pkg_script "typecheck"; then
    run_pm_script "$PM" "typecheck"
  elif has_pkg_script "type-check"; then
    run_pm_script "$PM" "type-check"
  fi

  if has_pkg_script "lint"; then
    run_pm_script "$PM" "lint"
  fi

  if has_pkg_script "test"; then
    if [ "$PM" = "npm" ]; then
      npm test
    else
      "$PM" test
    fi
  fi

  if has_pkg_script "build"; then
    run_pm_script "$PM" "build"
  fi

  if [ -z "$START_CMD" ]; then
    if has_pkg_script "dev"; then
      START_CMD="$PM run dev"
    elif has_pkg_script "start"; then
      START_CMD="$PM start"
    fi
  fi
elif [ -f "pyproject.toml" ] || [ -f "requirements.txt" ]; then
  echo "=== Ejecutando verificación Python ==="
  PY=""
  for cand in ".venv/Scripts/python.exe" ".venv/bin/python" "venv/Scripts/python.exe" "venv/bin/python" "python3" "python"; do
    if [[ "$cand" == */* ]]; then
      [ -f "$cand" ] || continue
    else
      command -v "$cand" >/dev/null 2>&1 || continue
    fi
    if "$cand" -c "import sys" >/dev/null 2>&1; then
      PY="$cand"
      break
    fi
  done
  if [ -z "$PY" ]; then
    echo "ERROR: No se encontró un intérprete de Python funcional (.venv, venv, python3 o python)."
    echo "POR QUÉ: Se detectó 'pyproject.toml' o 'requirements.txt', pero ningún entorno virtual local ni binario global superó '\"\$cand\" -c \"import sys\"' (evitando stubs vacíos como Microsoft Store)."
    echo "SOLUCIÓN (FIX): Crea el entorno virtual del proyecto ('python -m venv .venv') o instala Python 3 real en PATH antes de ejecutar 'bash ./init.sh'."
    exit 1
  fi
  pytest_rc=0
  "$PY" -m pytest || pytest_rc=$?
  if [ "$pytest_rc" -ne 0 ] && [ "$pytest_rc" -ne 5 ]; then
    exit "$pytest_rc"
  fi
  "$PY" -m compileall -q -x '(^|/)(\.?venv|env|node_modules|build|dist|__pycache__)(/|$)' .
elif [ -f "go.mod" ]; then
  echo "=== Ejecutando verificación Go ==="
  go test ./...
elif [ -f "Cargo.toml" ]; then
  echo "=== Ejecutando verificación Rust ==="
  cargo test
elif [ -f "pom.xml" ]; then
  echo "=== Ejecutando verificación Maven ==="
  mvn test
elif [ -f "build.gradle" ] || [ -f "build.gradle.kts" ]; then
  echo "=== Ejecutando verificación Gradle ==="
  if [ -f "./gradlew" ]; then
    ./gradlew test
  else
    gradle test
  fi
elif compgen -G "*.csproj" >/dev/null || compgen -G "*.sln" >/dev/null; then
  echo "=== Ejecutando verificación .NET ==="
  dotnet test
else
  echo "OK: Sin manifiesto de aplicación adicional detectado (modo arnés base; configura INSTALL_CMD, VERIFY_CMD o START_CMD cuando añadas runtime de aplicación)."
fi

echo "=== 5. Inicialización y Verificación en 3 Puertas Completadas (CLEAN STATE) ==="
echo "Next steps (Siguientes pasos obligatorios para el Agente):"
echo "  1. Lee 'progress.md' y 'session-handoff.md' para conocer el estado verificado actual."
echo "  2. Lee 'feature_list.json' y selecciona EXACTAMENTE UNA tarea no terminada (WIP=1)."
echo "  3. Implementa solo esa tarea dentro de su alcance."
echo "  4. Re-ejecuta 'bash ./init.sh' y registra el comando y salida en 'evidence' antes de declarar victoria."

if [ -n "$START_CMD" ]; then
  echo "Startup command: $START_CMD"
  if [ "$RUN_START_COMMAND" = "1" ]; then
    echo "=== Iniciando la aplicación (RUN_START_COMMAND=1) ==="
    exec bash -c "$START_CMD"
  fi
  echo "Configura RUN_START_COMMAND=1 si deseas que init.sh lance la aplicación directamente."
elif [ "$RUN_START_COMMAND" = "1" ]; then
  echo "ERROR: Se solicitó RUN_START_COMMAND=1 pero START_CMD está vacío."
  echo "POR QUÉ: init.sh requiere un comando de inicio explícito o autodetectado para lanzar la aplicación."
  echo "SOLUCIÓN (FIX): Define START_CMD (ej. START_CMD='npm run dev' RUN_START_COMMAND=1 bash ./init.sh) antes de activar RUN_START_COMMAND=1."
  exit 1
fi
