#!/usr/bin/env bash
set -euo pipefail

ROOT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
cd "$ROOT_DIR"

red_pen_error() {
  local err="$1"
  local why="$2"
  local fix="$3"
  echo "ERROR: $err"
  echo "POR QUÉ: $why"
  echo "SOLUCIÓN (FIX): $fix"
  exit 1
}

echo "--- [Vigilante Arquitectónico] 1. Verificando Mapa de Dominios y Modelo de 6 Capas en ARCHITECTURE.md ---"
if [ ! -f "ARCHITECTURE.md" ]; then
  red_pen_error \
    "No se encontró 'ARCHITECTURE.md' en la raíz del proyecto." \
    "El arnés requiere un mapa explícito de dominios y el flujo direccional de 6 capas para evitar código espagueti." \
    "Crea 'ARCHITECTURE.md' en la raíz con las secciones 'Mapa de Dominios', 'Modelo Estricto de Capas' y 'Reglas Duras de Dependencia'."
fi

for section in "Mapa de Dominios" "Modelo Estricto de Capas" "Reglas Duras de Dependencia" "Capability Seams" "Interfaces Transversales" "Puntos Calientes Actuales" "Types" "Config" "Repo" "Service" "Runtime" "UI"; do
  if ! grep -Fq "$section" "ARCHITECTURE.md"; then
    red_pen_error \
      "Falta la sección o capa obligatoria '$section' dentro de 'ARCHITECTURE.md'." \
      "El modelo arquitectónico de OpenAI y DeepSeek exige documentar el mapa de dominios, el flujo de 6 capas (Types -> Config -> Repo -> Service -> Runtime -> UI), Capability Seams, Interfaces Transversales y Puntos Calientes Actuales." \
      "Añade '$section' en 'ARCHITECTURE.md' respetando la estructura canónica del arnés."
  fi
done

echo "--- [Vigilante Arquitectónico] 2. Verificando Flujo Direccional de Capas (Prohibido ir hacia atrás o saltar capas) ---"
# Verificación sobre las capas actuales del arnés (scripts/lib = Repo/Service vs scripts/validate-harness.mjs y scripts/harness-hooks.mjs = Runtime)
for lib_file in scripts/lib/*.mjs; do
  [ -e "$lib_file" ] || continue
  if grep -Eq "validate-harness\.mjs|harness-hooks\.mjs|process\.exit\(" "$lib_file"; then
    red_pen_error \
      "Violación de capa en '$lib_file': una capa inferior (Repo/Service en scripts/lib/) importa de Runtime ('validate-harness.mjs' / 'harness-hooks.mjs') o invoca 'process.exit('." \
      "La Regla Dura #1 de ARCHITECTURE.md prohíbe dependencias hacia atrás (Repo/Service nunca puede depender de Runtime)." \
      "Elimina la referencia a Runtime o 'process.exit(' en '$lib_file' y devuelve un objeto de resultado para que la capa Runtime decida el código de salida."
  fi
done

# Verificación mecánica precisa en Node.js para módulos de aplicación en src/ y server/ (Fullstack Dual + 6 Capas Canónicas)
if [ -d "src" ] || [ -d "server" ]; then
  layer_violation="$(node -e '
    const fs = require("node:fs");
    const path = require("node:path");

    const FORBIDDEN_BY_LAYER = {
      types: new Set(["config", "repo", "service", "runtime", "ui"]),
      config: new Set(["repo", "service", "runtime", "ui"]),
      repo: new Set(["service", "runtime", "ui"]),
      service: new Set(["runtime", "ui"]),
      runtime: new Set(["ui"]),
      ui: new Set(["config", "repo"])
    };
    const ALL_LAYERS = new Set(Object.keys(FORBIDDEN_BY_LAYER));
    const LAYER_SEG_RE = /(^|\/)(types|config|repo|service|runtime|ui)(\/|$)/;
    const CODE_EXT_RE = /\.(?:[cm]?js|tsx?|jsx|py)$/i;
    const JS_CODE_EXT_RE = /\.(?:[cm]?js|tsx?|jsx)$/i;
    const SKIP_DIRS = new Set(["node_modules", ".git", "dist", "build", "__pycache__"]);

    const SRC_LAYER_RANKS = {
      utils: 1,
      services: 2,
      hooks: 3,
      context: 4,
      components: 5,
      "App.jsx / main.jsx": 6
    };

    const SERVER_LAYER_RANKS = {
      validators: 1,
      config: 2,
      services: 3,
      middleware: 4,
      controllers: 5,
      routes: 6,
      "index.js": 7
    };

    function stripJsComments(code) {
      let out = "", i = 0, quote = "";
      while (i < code.length) {
        const ch = code[i], next = code[i + 1];
        if (quote) {
          out += ch;
          if (ch === "\\" && i + 1 < code.length) { out += code[++i]; }
          else if (ch === quote) { quote = ""; }
          i += 1;
          continue;
        }
        if (ch === "\"" || ch === "\x27" || ch === "`") { quote = ch; out += ch; i += 1; continue; }
        if (ch === "/" && next === "/") {
          while (i < code.length && code[i] !== "\n") i += 1;
          continue;
        }
        if (ch === "/" && next === "*") {
          i += 2;
          while (i < code.length && !(code[i] === "*" && code[i + 1] === "/")) {
            if (code[i] === "\n") out += "\n";
            i += 1;
          }
          i += 2;
          continue;
        }
        out += ch;
        i += 1;
      }
      return out;
    }

    function stripPyComments(code) {
      return code
        .replace(/\"\"\"[\s\S]*?\"\"\"|\x27\x27\x27[\s\S]*?\x27\x27\x27/g, "")
        .split(/\r?\n/)
        .map((line) => {
          let out = "", q = "";
          for (let i = 0; i < line.length; i += 1) {
            const ch = line[i];
            if (q) { out += ch; if (ch === "\\" && i + 1 < line.length) out += line[++i]; else if (ch === q) q = ""; continue; }
            if (ch === "\"" || ch === "\x27") { q = ch; out += ch; continue; }
            if (ch === "#") break;
            out += ch;
          }
          return out;
        })
        .join("\n");
    }

    function extractSpecifiers(code, ext) {
      const specs = [];
      if (ext === ".py") {
        const clean = stripPyComments(code);
        for (const m of clean.matchAll(/^\s*from\s+(\.+[A-Za-z0-9_.]*|src(?:\.[A-Za-z0-9_]+)*)\s+import\s+([^\n;]+)/gm)) {
          const mod = m[1];
          const names = m[2].replace(/[()]/g, "").split(",").map((s) => s.trim().split(/\s+as\s+/)[0].trim()).filter(Boolean);
          if (mod === "src") {
            for (const n of names) specs.push("src/" + n.replace(/\./g, "/"));
          } else if (mod.startsWith("src.")) {
            specs.push(mod.replace(/\./g, "/"));
          } else if (mod.startsWith(".")) {
            const dots = (mod.match(/^\.+/) || [""])[0].length;
            const rest = mod.slice(dots).replace(/\./g, "/");
            const prefix = dots === 1 ? "./" : "../".repeat(dots - 1);
            if (rest) specs.push(prefix + rest);
            else for (const n of names) specs.push(prefix + n);
          }
        }
        for (const m of clean.matchAll(/^\s*import\s+([^\n;]+)/gm)) {
          for (const item of m[1].split(",")) {
            const mod = item.trim().split(/\s+as\s+/)[0].trim();
            if (mod.startsWith("src.")) specs.push(mod.replace(/\./g, "/"));
          }
        }
      } else {
        const clean = stripJsComments(code);
        for (const m of clean.matchAll(/\b(?:import|export)\s+(?:type\s+)?(?:[^;\x27"`]*?\s+from\s+)[\x27"]([^\x27"]+)[\x27"]/g)) specs.push(m[1]);
        for (const m of clean.matchAll(/\bimport\s+[\x27"]([^\x27"]+)[\x27"]/g)) specs.push(m[1]);
        for (const m of clean.matchAll(/\b(?:import|require)\s*\(\s*[\x27"]([^\x27"]+)[\x27"]\s*\)/g)) specs.push(m[1]);
      }
      return specs;
    }

    function walkFiles(dir, pred = CODE_EXT_RE, out = []) {
      if (!fs.existsSync(dir) || !fs.statSync(dir).isDirectory()) return out;
      for (const entry of fs.readdirSync(dir, { withFileTypes: true })) {
        if (SKIP_DIRS.has(entry.name)) continue;
        const full = path.join(dir, entry.name);
        if (entry.isDirectory()) walkFiles(full, pred, out);
        else if (entry.isFile() && pred.test(entry.name)) out.push(full);
      }
      return out;
    }

    if (fs.existsSync("src") && fs.statSync("src").isDirectory()) {
      for (const [sourceLayer, forbiddenSet] of Object.entries(FORBIDDEN_BY_LAYER)) {
        const layerDir = path.join("src", sourceLayer);
        if (!fs.existsSync(layerDir) || !fs.statSync(layerDir).isDirectory()) continue;
        for (const filePath of walkFiles(layerDir, CODE_EXT_RE)) {
          const relFromSrc = path.relative("src", path.dirname(filePath)).replace(/\\/g, "/");
          const specs = extractSpecifiers(fs.readFileSync(filePath, "utf8"), path.extname(filePath).toLowerCase());
          for (const rawSpec of specs) {
            const spec = rawSpec.trim().replace(/\\/g, "/").split(/[?#]/)[0];
            const isInternal = /^(?:\.\/|\.\.\/|@\/|~\/|src\/|\.\.?$)/.test(spec);
            if (!isInternal) continue;
            let normalized = "";
            if (spec.startsWith(".")) {
              normalized = path.posix.normalize(path.posix.join(relFromSrc, spec)).replace(/^(?:\.\.\/)+(?:src\/)?/, "");
            } else {
              normalized = path.posix.normalize(spec.replace(/^(?:@\/|~\/|src\/)/, ""));
            }
            if (!LAYER_SEG_RE.test(normalized) && !LAYER_SEG_RE.test(spec)) continue;
            const segs = normalized.split("/").filter(Boolean);
            const targetLayer = ALL_LAYERS.has(segs[0]) ? segs[0] : (segs.find((s) => ALL_LAYERS.has(s)) || "");
            if (targetLayer && targetLayer !== sourceLayer && forbiddenSet.has(targetLayer)) {
              const kind = sourceLayer === "ui" ? "CANONICAL_UI_SKIP" : "CANONICAL_BACKWARD";
              console.log([kind, filePath.replace(/\\/g, "/"), sourceLayer, targetLayer, rawSpec].join("|"));
              process.exit(0);
            }
          }
        }
      }
    }

    const rootDir = process.cwd();
    const PROBE_EXTS = ["", ".js", ".mjs", ".cjs", ".jsx", ".ts", ".tsx", "/index.js", "/index.mjs", "/index.jsx", "/index.ts", "/index.tsx"];

    function resolveRepoTarget(sourceRel, rawSpec) {
      const sp = rawSpec.trim().replace(/\\/g, "/").split(/[?#]/)[0];
      if (!/^(?:\.\/|\.\.\/|@\/|~\/|@server\/|\/?(?:src|server)\/|\.\.?$)/.test(sp)) return null;
      let cand = "";
      if (sp.startsWith(".")) {
        const abs = path.resolve(rootDir, path.dirname(sourceRel), sp);
        const rel = path.relative(rootDir, abs).replace(/\\/g, "/");
        if (rel.startsWith("..")) {
          const stripped = sp.replace(/^(?:\.\.\/)+/, "");
          if (/^(?:src|server)(?:\/|$)/.test(stripped)) cand = path.posix.normalize(stripped);
          else return null;
        } else {
          cand = rel;
        }
      } else if (sp.startsWith("@/") || sp.startsWith("~/")) {
        cand = path.posix.normalize("src/" + sp.slice(2));
      } else if (sp.startsWith("@server/")) {
        cand = path.posix.normalize("server/" + sp.slice(8));
      } else if (sp.startsWith("/")) {
        cand = path.posix.normalize(sp.slice(1));
      } else {
        cand = path.posix.normalize(sp);
      }
      for (const ext of PROBE_EXTS) {
        const probe = cand + ext;
        if (fs.existsSync(probe) && fs.statSync(probe).isFile()) return probe;
      }
      return cand;
    }

    function getSrcLayer(rel) {
      const segs = rel.split("/").filter(Boolean);
      if (segs[0] !== "src" || segs.length < 2) return null;
      if (segs.length === 2 && /^(?:App|main)(?:\.[cm]?[jt]sx?)?$/i.test(segs[1])) return "App.jsx / main.jsx";
      return Object.prototype.hasOwnProperty.call(SRC_LAYER_RANKS, segs[1]) ? segs[1] : null;
    }

    function getServerLayer(rel) {
      const segs = rel.split("/").filter(Boolean);
      if (segs[0] !== "server" || segs.length < 2) return null;
      if (segs.length === 2 && /^index(?:\.[cm]?[jt]sx?)?$/i.test(segs[1])) return "index.js";
      return Object.prototype.hasOwnProperty.call(SERVER_LAYER_RANKS, segs[1]) ? segs[1] : null;
    }

    for (const filePath of [...walkFiles("src", JS_CODE_EXT_RE), ...walkFiles("server", JS_CODE_EXT_RE)]) {
      const sourceRel = filePath.replace(/\\/g, "/");
      const sourceTree = sourceRel.split("/")[0];
      const specs = extractSpecifiers(fs.readFileSync(filePath, "utf8"), path.extname(filePath).toLowerCase());

      for (const rawSpec of specs) {
        const targetRel = resolveRepoTarget(sourceRel, rawSpec);
        if (!targetRel) continue;
        const targetTree = targetRel.split("/")[0];

        if ((sourceTree === "src" && targetTree === "server") || (sourceTree === "server" && targetTree === "src")) {
          console.log(["CROSS_STACK", sourceRel, sourceTree, targetTree, rawSpec, targetRel].join("|"));
          process.exit(0);
        }

        if (sourceTree === "src" && targetTree === "src") {
          const sLayer = getSrcLayer(sourceRel);
          const tLayer = getSrcLayer(targetRel);
          if (sLayer && tLayer && SRC_LAYER_RANKS[sLayer] < SRC_LAYER_RANKS[tLayer]) {
            console.log(["SRC_BACKWARD", sourceRel, sLayer + " (" + SRC_LAYER_RANKS[sLayer] + ")", tLayer + " (" + SRC_LAYER_RANKS[tLayer] + ")", rawSpec, targetRel].join("|"));
            process.exit(0);
          }
        }

        if (sourceTree === "server" && targetTree === "server") {
          const sLayer = getServerLayer(sourceRel);
          const tLayer = getServerLayer(targetRel);
          if (!sLayer || !tLayer) continue;
          const tupleKey = sourceRel + "->" + targetRel;
          if (SERVER_LAYER_RANKS[sLayer] < SERVER_LAYER_RANKS[tLayer]) {
            console.log(["SERVER_BACKWARD", sourceRel, sLayer + " (" + SERVER_LAYER_RANKS[sLayer] + ")", tLayer + " (" + SERVER_LAYER_RANKS[tLayer] + ")", rawSpec, tupleKey].join("|"));
            process.exit(0);
          } else if (sLayer === "controllers" && tLayer === "config") {
            console.log(["SERVER_SKIP_CONFIG", sourceRel, "controllers (5)", "config (2)", rawSpec, tupleKey].join("|"));
            process.exit(0);
          }
        }
      }
    }
  ')"
  if [ -n "$layer_violation" ]; then
    IFS="|" read -r v_kind v_file v_src v_dst v_spec v_extra <<< "$layer_violation"
    case "$v_kind" in
      "CANONICAL_UI_SKIP")
        red_pen_error \
          "Salto ilegal de capas en '$v_file': la capa UI ('src/ui/') importa '$v_spec' hacia '$v_dst'." \
          "La Regla Dura #2 de ARCHITECTURE.md permite a UI consumir contratos puros de Types ('src/types/'), pero prohíbe saltar Service/Runtime para acceder directamente a Config o Repo." \
          "Enruta el acceso a datos o configuración desde 'src/ui/' a través de un servicio o adaptador expuesto en 'src/service/' o 'src/runtime/'."
        ;;
      "CANONICAL_BACKWARD")
        red_pen_error \
          "Violación direccional en '$v_file': la capa '$v_src' ('src/$v_src/') importa '$v_spec' desde una capa superior ('$v_dst')." \
          "La Regla Dura #1 de ARCHITECTURE.md exige respetar estrictamente el flujo 'Types -> Config -> Repo -> Service -> Runtime -> UI' sin dependencias hacia atrás." \
          "Elimina la importación '$v_spec' en '$v_file' o invierte la dependencia mediante contratos puros en 'src/types/'."
        ;;
      "CROSS_STACK")
        red_pen_error \
          "Violación de aislamiento Fullstack en '$v_file': el árbol '$v_src/' importa directamente '$v_spec' ('$v_extra') desde '$v_dst/'." \
          "ARCHITECTURE.md impone aislamiento Fullstack de 0 tolerancia entre Frontend ('src/') y Backend ('server/')." \
          "Elimina el import cruzado '$v_spec' en '$v_file' y comunica 'src/' con 'server/' exclusivamente mediante contratos HTTP/JSON o SSE."
        ;;
      "SRC_BACKWARD")
        red_pen_error \
          "Violación direccional Frontend en '$v_file': la capa '$v_src' importa '$v_spec' ('$v_extra') desde una capa superior '$v_dst'." \
          "ARCHITECTURE.md exige orden direccional estricto en 'src/': utils (1) -> services (2) -> hooks (3) -> context (4) -> components (5) -> App.jsx / main.jsx (6)." \
          "Extrae la lógica compartida a una capa igual o inferior en 'src/' o invierte la dependencia mediante props/callbacks sin importar desde capas superiores."
        ;;
      "SERVER_BACKWARD")
        red_pen_error \
          "Violación direccional Backend en '$v_file': la capa '$v_src' importa '$v_spec' desde una capa superior '$v_dst' (tupla '$v_extra'; 0 excepciones permitidas)." \
          "ARCHITECTURE.md exige orden direccional estricto sin excepciones en 'server/': validators (1) -> config (2) -> services (3) -> middleware (4) -> controllers (5) -> routes (6) -> index.js (7)." \
          "Mueve la dependencia hacia una capa inferior o inyecta el colaborador desde Runtime respetando el flujo unidireccional de capas."
        ;;
      "SERVER_SKIP_CONFIG")
        red_pen_error \
          "Salto ilegal de capas Backend en '$v_file': '$v_src' importa directamente '$v_spec' hacia '$v_dst' (tupla '$v_extra'; 0 excepciones permitidas)." \
          "ARCHITECTURE.md prohíbe sin excepciones que controladores en 'server/controllers/' salten 'server/services/' para acoplarse directamente a 'server/config/*' (prisma/env)." \
          "Encapsula el acceso a Prisma o configuración dentro de un servicio en 'server/services/' y consúmelo desde '$v_file'."
        ;;
    esac
  fi
fi

echo "--- [Vigilante Arquitectónico] 3. Verificando Invariantes de Auto-Memoria (Gotcha #1 y #15) ---"
if [ -f "memory/INDEX.md" ]; then
  index_lines="$(wc -l < "memory/INDEX.md" | tr -d '[:space:]')"
  index_bytes="$(wc -c < "memory/INDEX.md" | tr -d '[:space:]')"
  if [ "$index_lines" -gt 200 ] || [ "$index_bytes" -gt 25600 ]; then
    red_pen_error \
      "'memory/INDEX.md' excede el límite estricto ($index_lines líneas / $index_bytes bytes; máximo permitido: 200 líneas o 25600 bytes)." \
      "Gotcha #1: Superar las 200 líneas o 25 KB provoca truncamiento silencioso del índice de memoria al cargarse en el contexto del agente." \
      "Mueve las explicaciones detalladas a archivos dentro de 'memory/topics/*.md' y deja únicamente 1 línea de gancho por tema en 'memory/INDEX.md'."
  fi

  if [ -d "memory/topics" ]; then
    for topic_file in memory/topics/*.md; do
      [ -e "$topic_file" ] || continue
      topic_name="$(basename "$topic_file")"
      if ! grep -Fq "$topic_name" "memory/INDEX.md"; then
        red_pen_error \
          "Archivo de memoria huérfano detectado: '$topic_file' no está enlazado en 'memory/INDEX.md'." \
          "Gotcha #15 (Invariante de Guardado en Dos Pasos): Todo archivo creado en 'memory/topics/' debe tener su gancho de 1 línea registrado en 'memory/INDEX.md'." \
          "Añade un enlace de 1 línea hacia 'topics/$topic_name' en la sección 'Temas Activos' de 'memory/INDEX.md' o elimina el archivo huérfano."
      fi
    done
  fi
fi

echo "--- [Vigilante Arquitectónico] 4. Verificando Cero Enlaces Muertos en Required Artifacts, Observabilidad Dual, Seguridad, Loop Engineering, Graph Engineering y Limpieza de Archivos Temporales ---"
for obs_file in "docs/RELIABILITY.md" "sprint-contract.md" "evaluator-rubric.md" "docs/QUALITY_SCORE.md" "docs/SECURITY.md" "goal.md" "maker-prompt.md" "checker-prompt.md" "loop-state.md" "graph.md" "docs/GOTCHAS.md"; do
  if [ -f "$obs_file" ]; then
    case "$obs_file" in
      "docs/RELIABILITY.md")
        if ! grep -Fq "correlationId" "$obs_file"; then
          red_pen_error \
            "Falta el campo obligatorio 'correlationId' en 'docs/RELIABILITY.md'." \
            "El estándar de Observabilidad de Runtime de ARCHITECTURE.md exige trazabilidad de principio a fin en los logs JSON estructurados." \
            "Documenta el esquema JSON con 'timestamp', 'level', 'component', 'action', 'durationMs', 'input', 'output'/'error' y 'correlationId' en 'docs/RELIABILITY.md'."
        fi
        ;;
      "evaluator-rubric.md")
        if ! grep -Fq "zero-inheritance" "$obs_file" || ! grep -Fqi "one-shot" "$obs_file"; then
          red_pen_error \
            "Falta la regla de aislamiento 'zero-inheritance' o la cláusula 'one-shot' en 'evaluator-rubric.md'." \
            "La regla de separación Maker-Checker de AGENTS.md prohíbe estrictamente autoaprobarse en la misma sesión o reutilizar un Evaluador previo vía send_message." \
            "Incluye las cláusulas de aislamiento 'zero-inheritance' y 'one-shot' junto a la tabla de 0 a 12 puntos en 'evaluator-rubric.md'."
        fi
        ;;
      "docs/QUALITY_SCORE.md")
        if ! grep -Fq "Estudios de Ablación" "$obs_file"; then
          red_pen_error \
            "Falta la sección 'Estudios de Ablación' en 'docs/QUALITY_SCORE.md'." \
            "La Observabilidad de Proceso a Largo Plazo exige llevar un registro empírico de simplificación del arnés junto al semáforo de salud A-D." \
            "Añade la tabla 'Registro de Simplificación del Arnés (Estudios de Ablación)' en 'docs/QUALITY_SCORE.md'."
        fi
        ;;
      "docs/SECURITY.md")
        for sec_term in "Write-Select-Compress-Isolate" "Fail-Closed" "Model-Visible Means Logged"; do
          if ! grep -Fq "$sec_term" "$obs_file"; then
            red_pen_error \
              "Falta el concepto obligatorio '$sec_term' dentro de 'docs/SECURITY.md'." \
              "La arquitectura de seguridad del arnés (AGENTS.md y ARCHITECTURE.md) exige documentar las 4 operaciones del presupuesto de contexto, el modelo Fail-Closed con clasificación por llamada y el principio Model-Visible Means Logged." \
              "Añade la sección correspondiente a '$sec_term' en 'docs/SECURITY.md'."
          fi
        done
        ;;
      "goal.md")
        for goal_term in "Circuit Breakers" "Candado 1" "Candado 2" "Candado 3" "Candado 4"; do
          if ! grep -Fq "$goal_term" "$obs_file"; then
            red_pen_error \
              "Falta el candado o sección obligatoria '$goal_term' dentro de 'goal.md'." \
              "La especificación de Loop Engineering de AGENTS.md prohíbe loops sin un Disyuntor de 4 Candados (Max Rounds, Budget/Time, Stagnation y Anti-Oscillation A<->B)." \
              "Añade '$goal_term' en la sección 'Circuit Breakers' de 'goal.md'."
          fi
        done
        ;;
      "maker-prompt.md")
        for maker_term in "Fair game" "Implementation Summary"; do
          if ! grep -Fq "$maker_term" "$obs_file"; then
            red_pen_error \
              "Falta el término obligatorio '$maker_term' dentro de 'maker-prompt.md'." \
              "El protocolo Maker-Checker (goal.md y sprint-contract.md) exige que el Agente Maker opere dentro de 'Fair game' y entregue un reporte estructurado al Checker." \
              "Añade '$maker_term' en 'maker-prompt.md'."
          fi
        done
        if ! grep -Fqi "one-shot" "$obs_file"; then
          red_pen_error \
            "Falta la cláusula 'one-shot' dentro de 'maker-prompt.md'." \
            "La invariante One-Shot Ephemeral Checker de AGENTS.md prohíbe reutilizar sub-agentes Evaluadores vía send_message y exige lanzar una instancia nueva por auditoría." \
            "Añade la exigencia 'one-shot' (prohibición de send_message a Checkers previos) en 'maker-prompt.md'."
        fi
        ;;
      "checker-prompt.md")
        if ! grep -Fq "zero-inheritance" "$obs_file" || ! grep -Fqi "one-shot" "$obs_file"; then
          red_pen_error \
            "Falta la cláusula 'zero-inheritance' o 'one-shot' dentro de 'checker-prompt.md'." \
            "La separación Maker-Checker (AGENTS.md y evaluator-rubric.md) exige que el Agente Checker audite en una instancia efímera de un solo uso (one-shot) sin compartir historial con el Maker ni ofrecer re-auditoría." \
            "Añade las exigencias 'zero-inheritance' y 'one-shot' en 'checker-prompt.md'."
        fi
        ;;
      "loop-state.md")
        if ! grep -Fq "Ratchet" "$obs_file"; then
          red_pen_error \
            "Falta el mecanismo 'Ratchet' (Trinquete) dentro de 'loop-state.md'." \
            "La especificación de Loop Engineering (goal.md) exige rastrear el avance del trinquete y el monitor de disyuntores entre rondas en 'loop-state.md'." \
            "Incluye el seguimiento de 'Net Passing Checks (Ratchet)' en 'loop-state.md'."
        fi
        ;;
      "graph.md")
        for graph_term in "research" "implement" "verify" "human_approval" "merge" "error_layer" "Coordinator" "Fork" "Swarm"; do
          if ! grep -Fq "$graph_term" "$obs_file"; then
            red_pen_error \
              "Falta el nodo, campo o patrón obligatorio '$graph_term' dentro de 'graph.md'." \
              "La especificación de Ingeniería de Grafos (AGENTS.md y ARCHITECTURE.md) exige definir el grafo de 5 nodos (research -> implement -> verify -> human_approval -> merge), el routing condicional por 'error_layer' y los 3 patrones Multi-Agente (Coordinator, Fork, Swarm)." \
              "Añade la especificación de '$graph_term' en 'graph.md'."
          fi
        done
        ;;
      "docs/GOTCHAS.md")
        for gotcha_term in "15 Gotchas" "structuredHas" "Estudios de Ablación"; do
          if ! grep -Fq "$gotcha_term" "$obs_file"; then
            red_pen_error \
              "Falta la sección o término obligatorio '$gotcha_term' dentro de 'docs/GOTCHAS.md'." \
              "El estándar de verificación del arnés (AGENTS.md) exige documentar la tabla de los 15 Gotchas críticos de producción, la regla 'structuredHas' de las 25 verificaciones y el protocolo de Estudios de Ablación." \
              "Añade '$gotcha_term' en 'docs/GOTCHAS.md'."
          fi
        done
        ;;
    esac
  fi
done

if [ -f ".agents/skills/maker-checker/SKILL.md" ]; then
  if ! node -e '
    const fs = require("node:fs");
    const text = fs.readFileSync(".agents/skills/maker-checker/SKILL.md", "utf8");
    const match = text.match(/^---\r?\n([\s\S]*?)\r?\n---/);
    if (!match) process.exit(1);
    const descLine = match[1].split(/\r?\n/).find((l) => l.trim().startsWith("description:"));
    if (!descLine) process.exit(1);
    const desc = descLine.replace(/^description:\s*/, "").trim().replace(/^["\x27]|["\x27]$/g, "");
    if (desc.length === 0 || desc.length > 150) process.exit(1);
  ' >/dev/null 2>&1; then
    red_pen_error \
      "La descripción en el frontmatter de '.agents/skills/maker-checker/SKILL.md' no existe o supera los 150 caracteres." \
      "Gotcha #12: El catálogo de Skills trunca las descripciones a ~150 caracteres; si es más larga, el agente nunca activa la Skill." \
      "Acorta el campo 'description' del frontmatter YAML en '.agents/skills/maker-checker/SKILL.md' a <= 150 caracteres colocando las palabras clave disparadoras al inicio."
  fi
  if ! grep -Fqi "one-shot" ".agents/skills/maker-checker/SKILL.md"; then
    red_pen_error \
      "Falta la cláusula 'one-shot' dentro de '.agents/skills/maker-checker/SKILL.md'." \
      "El protocolo Maker-Checker exige instancias Checker efímeras de un solo uso (one-shot) y prohíbe reutilizar un Evaluador vía send_message." \
      "Documenta la regla 'one-shot' y la prohibición de send_message hacia Checkers previos en '.agents/skills/maker-checker/SKILL.md'."
  fi
fi

if [ ! -f ".agents/hooks.json" ] || [ ! -s "scripts/harness-hooks.mjs" ]; then
  red_pen_error \
    "Falta '.agents/hooks.json' o el runner ejecutable 'scripts/harness-hooks.mjs' (o está vacío)." \
    "El modelo Fail-Closed de docs/SECURITY.md exige hooks nativos reales respaldados por 'scripts/harness-hooks.mjs' para ejecutar en Windows, macOS y Linux desde cwd = .agents/." \
    "Crea o restaura '.agents/hooks.json' y 'scripts/harness-hooks.mjs' siguiendo el contrato stdin/stdout JSON de Antigravity."
fi

if ! node --check "scripts/harness-hooks.mjs" >/dev/null 2>&1; then
  red_pen_error \
    "Error de sintaxis JavaScript en 'scripts/harness-hooks.mjs'." \
    "Un fallo de sintaxis en el runner de hooks rompe PreToolUse, PostToolUse y Stop en tiempo de ejecución." \
    "Ejecuta 'node --check scripts/harness-hooks.mjs' y corrige cualquier error de sintaxis ESM."
fi

hooks_lines="$(wc -l < "scripts/harness-hooks.mjs" | tr -d '[:space:]')"
if [ "$hooks_lines" -gt 280 ]; then
  red_pen_error \
    "'scripts/harness-hooks.mjs' excede el tope máximo de concisión ($hooks_lines líneas; máximo permitido: 280 líneas)." \
    "El runner de hooks debe mantenerse ligero, legible y libre de sobre-ingeniería para arrancar en milisegundos en cada llamada." \
    "Simplifica 'scripts/harness-hooks.mjs' para mantenerlo en <= 280 líneas conservando sus garantías de seguridad."
fi

if ! node -e '
  const fs = require("node:fs");
  const parsed = JSON.parse(fs.readFileSync(".agents/hooks.json", "utf8"));
  if (!parsed || typeof parsed !== "object" || Array.isArray(parsed)) process.exit(1);

  const forbiddenRootKeys = new Set([
    "$schema", "project", "securityModel", "classificationPolicy",
    "auditPrinciple", "protectedPaths", "hooks"
  ]);
  const allowedGroupKeys = new Set([
    "enabled", "SessionStart", "PreToolUse", "PostToolUse",
    "PreInvocation", "PostInvocation", "Stop"
  ]);
  const allowedHandlerKeys = new Set(["type", "command", "timeout"]);

  const groupNames = Object.keys(parsed);
  if (groupNames.length === 0) process.exit(1);
  if (groupNames.some((k) => forbiddenRootKeys.has(k))) process.exit(1);

  const matchesTool = (matcher, tool) => {
    if (matcher === "*" || matcher === "") return true;
    try {
      return new RegExp(matcher).test(tool);
    } catch {
      return false;
    }
  };

  const isValidHandler = (h, expectedSubcmd) => {
    if (!h || typeof h !== "object" || Array.isArray(h)) return false;
    if (!Object.keys(h).every((k) => allowedHandlerKeys.has(k))) return false;
    if (h.type !== undefined && h.type !== "command") return false;
    if (typeof h.command !== "string" || !h.command.includes("../scripts/harness-hooks.mjs")) return false;
    if (!new RegExp("\\b" + expectedSubcmd + "\\b").test(h.command)) return false;
    if (h.timeout !== undefined && (!Number.isInteger(h.timeout) || h.timeout <= 0)) return false;
    return true;
  };

  let preEntries = [];
  let postEntries = [];
  let stopEntries = [];

  for (const name of groupNames) {
    const group = parsed[name];
    if (!group || typeof group !== "object" || Array.isArray(group)) process.exit(1);
    if (!Object.keys(group).every((k) => allowedGroupKeys.has(k))) process.exit(1);
    if (group.enabled !== undefined && typeof group.enabled !== "boolean") process.exit(1);
    if (group.enabled === false) continue;

    if (group.PreToolUse !== undefined) {
      if (!Array.isArray(group.PreToolUse)) process.exit(1);
      preEntries.push(...group.PreToolUse);
    }
    if (group.PostToolUse !== undefined) {
      if (!Array.isArray(group.PostToolUse)) process.exit(1);
      postEntries.push(...group.PostToolUse);
    }
    if (group.Stop !== undefined) {
      if (!Array.isArray(group.Stop)) process.exit(1);
      stopEntries.push(...group.Stop);
    }
  }

  if (preEntries.length === 0 || postEntries.length === 0 || stopEntries.length === 0) {
    process.exit(1);
  }

  for (const entry of preEntries) {
    if (!entry || typeof entry !== "object" || Array.isArray(entry)) process.exit(1);
    if (!Object.keys(entry).every((k) => k === "matcher" || k === "hooks")) process.exit(1);
    if (typeof entry.matcher !== "string" || !Array.isArray(entry.hooks) || entry.hooks.length === 0) process.exit(1);
    if (!entry.hooks.every((h) => isValidHandler(h, "pre-tool-use"))) process.exit(1);
  }

  for (const reqTool of ["write_file", "edit_file", "run_command", "send_message"]) {
    if (!preEntries.some((e) => matchesTool(e.matcher, reqTool))) process.exit(1);
  }

  for (const entry of postEntries) {
    if (!entry || typeof entry !== "object" || Array.isArray(entry)) process.exit(1);
    if (!Object.keys(entry).every((k) => k === "matcher" || k === "hooks")) process.exit(1);
    if (typeof entry.matcher !== "string" || !Array.isArray(entry.hooks) || entry.hooks.length === 0) process.exit(1);
    if (!entry.hooks.every((h) => isValidHandler(h, "post-tool-use"))) process.exit(1);
  }

  for (const reqTool of ["write_file", "edit_file"]) {
    if (!postEntries.some((e) => matchesTool(e.matcher, reqTool))) process.exit(1);
  }

  // Stop en Antigravity es Plano (Flat): lista directa de handlers sin matcher ni hooks anidados
  if (!stopEntries.every((h) => isValidHandler(h, "stop"))) {
    process.exit(1);
  }
' >/dev/null 2>&1; then
  red_pen_error \
    "El archivo '.agents/hooks.json' no cumple el contrato nativo real de Antigravity (PreToolUse/PostToolUse agrupados con matcher+hooks, Stop plano e invocación a '../scripts/harness-hooks.mjs')." \
    "Antigravity parsea '.agents/hooks.json' bajo codificación protojson estricta desde cwd = .agents/ (rechazando campos raíz ajenos como '\$schema' o 'hooks' y exigiendo Stop plano sin 'matcher')." \
    "Define un grupo raíz (ej. 'harness-safety-gate') con 'PreToolUse' (cubriendo write_file, edit_file, run_command y send_message), 'PostToolUse' (agrupado) y 'Stop' (lista plana de handlers) invocando 'node ../scripts/harness-hooks.mjs <evento>'."
fi

while IFS= read -r artifact_path; do
  artifact_path="${artifact_path%$'\r'}"
  [ -z "$artifact_path" ] && continue
  if [ ! -e "$artifact_path" ]; then
    red_pen_error \
      "Enlace muerto en AGENTS.md: el artefacto requerido '$artifact_path' no existe físicamente en disco." \
      "La regla Anti-Doc Bloat prohíbe enlazar documentos en AGENTS.md antes de que hayan sido creados con información real." \
      "Crea el archivo '$artifact_path' con contenido real o retira el enlace prematuro de la sección 'Required Artifacts' en 'AGENTS.md'."
  fi
done < <(awk '/^## Required Artifacts/{flag=1; next} /^## /{flag=0} flag && /^- `[^`]+`/{sub(/^- `/, ""); sub(/`.*$/, ""); print}' AGENTS.md)

if [ ! -f "scripts/feature-list.schema.json" ]; then
  red_pen_error \
    "Falta el archivo de esquema 'scripts/feature-list.schema.json'." \
    "El arnés exige un JSON Schema canónico con los 4 estados (not-started, in-progress, blocked, done), soporte para area/user_visible_behavior y Pass-State Gating." \
    "Crea o restaura 'scripts/feature-list.schema.json' siguiendo el estándar Draft-07 del arnés."
fi

if ! node -e '
  const fs = require("node:fs");
  const schema = JSON.parse(fs.readFileSync("scripts/feature-list.schema.json", "utf8"));
  const itemsSchema = schema?.properties?.features?.items;
  const itemProps = itemsSchema?.properties;
  const itemsRequired = itemsSchema?.required;
  const baseRequired = ["id", "name", "description", "status", "dependencies", "required_files", "verification"];
  if (!Array.isArray(itemsRequired) || !baseRequired.every((req) => itemsRequired.includes(req))) {
    process.exit(1);
  }
  const statusEnum = itemProps?.status?.enum;
  const canonical = ["not-started", "in-progress", "blocked", "done"];
  if (!Array.isArray(statusEnum) || statusEnum.length !== 4 || !canonical.every((s) => statusEnum.includes(s))) {
    process.exit(1);
  }
  if (!itemProps?.area || !itemProps?.user_visible_behavior) {
    process.exit(1);
  }
  if (fs.existsSync("feature_list.json")) {
    const data = JSON.parse(fs.readFileSync("feature_list.json", "utf8"));
    const allowedRoot = new Set(Object.keys(schema.properties || {}));
    const allowedItem = new Set(Object.keys(itemProps));
    if (!data || typeof data !== "object" || Array.isArray(data) || !Array.isArray(data.features) || data.features.length === 0) {
      process.exit(1);
    }
    if (!Object.keys(data).every((k) => allowedRoot.has(k))) process.exit(1);
    const idRe = new RegExp(itemProps.id.pattern);
    for (const f of data.features) {
      if (!f || typeof f !== "object" || Array.isArray(f)) process.exit(1);
      if (!Object.keys(f).every((k) => allowedItem.has(k))) process.exit(1);
      if (!baseRequired.every((req) => f[req] !== undefined)) process.exit(1);
      if (typeof f.id !== "string" || !idRe.test(f.id)) process.exit(1);
      if (!statusEnum.includes(f.status)) process.exit(1);
      if (f.status === "done" && (typeof f.evidence !== "string" || f.evidence.trim().length === 0)) process.exit(1);
    }
  }
' >/dev/null 2>&1; then
  red_pen_error \
    "Violación de esquema entre 'scripts/feature-list.schema.json' y 'feature_list.json'." \
    "El rastreador de tareas debe exigir los 7 campos obligatorios en items.required, los 4 estados canónicos (not-started, in-progress, blocked, done), area/user_visible_behavior y evidencia no vacía en 'done'." \
    "Verifica que 'scripts/feature-list.schema.json' conserve items.required completo + los 4 estados y que 'feature_list.json' cumpla estrictamente ese esquema."
fi

echo "--- [Vigilante Arquitectónico] 5. Escáner de Higiene y Estado Limpio (cleanup-scanner: .gitignore, secretos, artefactos y árbol fuente) ---"
if [ ! -f ".gitignore" ]; then
  red_pen_error \
    "Violación estructural: no se encontró '.gitignore' en la raíz del proyecto." \
    "La Dimensión 4 de clean-state-checklist.md y docs/SECURITY.md exigen proteger secretos (.env*), overrides locales (*.local.md), dependencias (node_modules/), builds (dist/, build/) y temporales (*.tmp, *.bak, *.swp)." \
    "Crea un archivo '.gitignore' en la raíz que ignore .env*, *.local.md, node_modules/, dist/, build/, *.tmp, *.bak y *.swp."
fi

for gitignore_req in '\.env' '\*\.local\.md' 'node_modules' 'dist' 'build' '\*\.tmp' '\*\.bak' '\*\.swp'; do
  if ! grep -Eq "^[[:space:]]*${gitignore_req}" ".gitignore"; then
    red_pen_error \
      "Cobertura incompleta en '.gitignore': falta una regla que proteja el patrón '${gitignore_req}'." \
      "Un '.gitignore' incompleto expone secretos, configuraciones locales (Gotcha #2), artefactos de build o archivos de intercambio del editor." \
      "Añade la entrada correspondiente a '${gitignore_req}' dentro de '.gitignore'."
  fi
done

while IFS= read -r env_file; do
  [ -z "$env_file" ] && continue
  env_base="$(basename "$env_file")"
  case "$env_base" in
    .env.example|.env.sample|.env.template) continue ;;
  esac
  if [ -d ".git" ] && command -v git >/dev/null 2>&1; then
    if git ls-files --error-unmatch "$env_file" >/dev/null 2>&1 || ! git check-ignore -q "$env_file"; then
      red_pen_error \
        "Archivo de entorno sensible '$env_file' detectado en el árbol sin cobertura efectiva de '.gitignore' (o rastreado en Git)." \
        "docs/SECURITY.md y el escáner de estado limpio prohíben versionar o dejar desprotegidos archivos '.env*' que pueden contener secretos." \
        "Asegúrate de que '$env_file' esté cubierto por '.gitignore' y retíralo del índice de Git con 'git rm --cached $env_file' (usa '.env.example' para plantillas sin secretos)."
    fi
  elif grep -Eq "^[[:space:]]*!${env_base//./\\.}[[:space:]]*$" ".gitignore"; then
    red_pen_error \
      "Archivo de entorno sensible '$env_file' está explícitamente des-ignorado ('!$env_base') en '.gitignore'." \
      "docs/SECURITY.md prohíbe exponer archivos '.env*' reales fuera de las plantillas seguras (.env.example, .env.sample, .env.template)." \
      "Elimina la excepción '!$env_base' de '.gitignore' o renombra la plantilla sin secretos a '.env.example'."
  fi
done < <(find . -maxdepth 4 -type f \( -name ".env" -o -name ".env.*" \) -not -path "./.git/*" -not -path "./node_modules/*" 2>/dev/null || true)

temp_files="$(find . -maxdepth 4 -type f \( -name "*.tmp" -o -name "*.bak" -o -name "*.swp" -o -name "*~" \) -not -path "./.git/*" -not -path "./node_modules/*" -not -path "./dist/*" -not -path "./build/*" 2>/dev/null || true)"
if [ -n "$temp_files" ]; then
  red_pen_error \
    "Se detectaron archivos temporales, de respaldo o swap en el repositorio: $temp_files" \
    "La Dimensión 4 de clean-state-checklist.md prohíbe dejar artefactos temporales (*.tmp, *.bak, *.swp, *~) que contaminen la siguiente sesión." \
    "Elimina los archivos temporales listados ('rm <archivo>') antes de ejecutar la verificación."
fi

for src_tree in "src" "lib" "app"; do
  if [ -d "$src_tree" ]; then
    src_logs="$(find "$src_tree" -maxdepth 4 -type f -name "*.log" -not -path "*/node_modules/*" 2>/dev/null || true)"
    if [ -n "$src_logs" ]; then
      red_pen_error \
        "Se detectaron archivos de log de depuración dentro del árbol de código fuente ('$src_tree/'): $src_logs" \
        "El escáner de limpieza prohíbe mezclar trazas '*.log' con módulos de código fuente en 'src/', 'lib/' o 'app/'." \
        "Elimina los archivos '*.log' de '$src_tree/' y dirige los logs de runtime a stdout o a un directorio externo ignorado."
    fi
  fi
done

session_artifacts="$(find . -maxdepth 1 -type f \( -name "WIP.md" -o -name "IN_PROGRESS.md" -o -name "scratch.*" -o -name "debug.*" -o -name "temp.*" -o -name "test-manual.*" \) 2>/dev/null || true)"
if [ -n "$session_artifacts" ]; then
  red_pen_error \
    "Se detectaron artefactos de sesión incompleta o depuración manual en la raíz: $session_artifacts" \
    "clean-state-checklist.md exige canalizar el estado únicamente en 'progress.md', 'feature_list.json' y 'session-handoff.md', sin dejar archivos 'WIP.md', 'IN_PROGRESS.md', 'scratch.*', 'debug.*' o 'temp.*'." \
    "Transfiere cualquier nota relevante a 'progress.md' o 'session-handoff.md' y elimina los artefactos temporales de la raíz."
fi

for build_in_src in "src/dist" "src/build" "lib/dist" "lib/build" "app/dist" "app/build"; do
  if [ -d "$build_in_src" ]; then
    red_pen_error \
      "Violación estructural crítica: directorio de salida compilada '$build_in_src/' mezclado dentro del árbol fuente." \
      "Mezclar artefactos compilados ('dist/' o 'build/') dentro de 'src/', 'lib/' o 'app/' contamina las búsquedas del agente y rompe los límites de capas." \
      "Elimina '$build_in_src/' y configura la herramienta de compilación para emitir salidas en 'dist/' o 'build/' en la raíz del proyecto."
  fi
done

nested_nm="$(find . -mindepth 2 -maxdepth 4 -type d -name "node_modules" -not -path "./node_modules/*" -not -path "./.git/*" 2>/dev/null || true)"
if [ -n "$nested_nm" ]; then
  red_pen_error \
    "Violación estructural crítica: directorio 'node_modules' anidado detectado fuera de la raíz: $nested_nm" \
    "Tener 'node_modules' dentro de 'src/', 'lib/', 'app/' o 'tests/' genera resoluciones de dependencias fantasma y ensucia el árbol fuente." \
    "Elimina los directorios 'node_modules' anidados y gestiona las dependencias desde la raíz del proyecto."
fi

for common_dir in "src" "lib" "app" "test" "tests" "docs"; do
  if [ -d "$common_dir" ] && [ -z "$(ls -A "$common_dir" 2>/dev/null)" ]; then
    red_pen_error \
      "Directorio vacío residual detectado: '$common_dir/'." \
      "El escáner de higiene de sesión marca directorios vacíos como trabajo incompleto o estructura fantasma que desorienta a la siguiente sesión." \
      "Elimina el directorio vacío '$common_dir/' o incorpora los archivos reales correspondientes al alcance activo."
  fi
done

echo "OK: Límites arquitectónicos, invariantes de 6 capas, Auto-Memoria, Seguridad e higiene estructural verificados sin violaciones."
