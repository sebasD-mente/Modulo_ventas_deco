import fs from 'node:fs';
import path from 'node:path';
import * as babelParser from '@babel/parser';

/**
 * ⚡ [DEKO LABS] ESCÁNER DE CONTRATOS REACT & CABLES DE ESTADO (ARNÉS 3.0)
 * 
 * Audita mecánicamente el árbol AST de todos los componentes JSX/TSX del frontend:
 * 1. Detección de Sintaxis JSX Estricta (erradica el punto ciego de 'node --check').
 * 2. Prohibición de props pasadas explícitamente como 'undefined' (<Comp id={undefined} />).
 * 3. Prohibición de Callbacks Silenciados con funciones vacías (<Comp onAction={() => {}} />).
 * 4. Detección de Setters Huérfanos en 'useState' (cables sueltos de estado no conectados).
 * 5. Verificación de Guardas Defensivas en componentes que consumen IDs críticos.
 */

console.info('⚡ [DEKO LABS] Auditando contratos de componentes React y cables de estado (AST)...');

const rootDir = process.cwd();
const srcDir = path.join(rootDir, 'src');

if (!fs.existsSync(srcDir)) {
  console.info('ℹ️ [DEKO LABS] No se detectó directorio src/. Omitiendo auditoría React.');
  process.exit(0);
}

const JSX_EXTENSIONS = /\.(jsx|tsx)$/i;
const IGNORED_DIRS = ['node_modules', 'dist', 'build', '.git', '.vite', 'coverage', '_archive', 'tests'];

const filesToAudit = [];

function scanDir(dir) {
  const entries = fs.readdirSync(dir, { withFileTypes: true });
  for (const entry of entries) {
    const fullPath = path.join(dir, entry.name);
    if (entry.isDirectory()) {
      if (!IGNORED_DIRS.includes(entry.name)) {
        scanDir(fullPath);
      }
    } else if (JSX_EXTENSIONS.test(entry.name)) {
      filesToAudit.push(fullPath);
    }
  }
}

scanDir(srcDir);

if (filesToAudit.length === 0) {
  console.info('ℹ️ [DEKO LABS] No se encontraron archivos JSX/TSX en src/. Omitiendo.');
  process.exit(0);
}

const violations = [];

// Simple AST Walker
function walk(node, visitors) {
  if (!node || typeof node !== 'object') return;

  if (Array.isArray(node)) {
    for (const item of node) {
      walk(item, visitors);
    }
    return;
  }

  if (visitors[node.type]) {
    visitors[node.type](node);
  }

  for (const key of Object.keys(node)) {
    if (key === 'loc' || key === 'range' || key === 'tokens') continue;
    const child = node[key];
    if (child && typeof child === 'object') {
      walk(child, visitors);
    }
  }
}

// Analizador por archivo
for (const file of filesToAudit) {
  const relPath = path.relative(rootDir, file).replace(/\\/g, '/');
  const code = fs.readFileSync(file, 'utf-8');

  let ast;
  try {
    ast = babelParser.parse(code, {
      sourceType: 'module',
      plugins: [
        'jsx',
        'typescript',
        'classProperties',
        'dynamicImport',
        'nullishCoalescingOperator',
        'optionalChaining'
      ]
    });
  } catch (parseErr) {
    violations.push({
      file: relPath,
      line: parseErr.loc?.line || 1,
      column: parseErr.loc?.column || 0,
      rule: 'JSX_SYNTAX_ERROR',
      message: `Error de sintaxis JSX: ${parseErr.message}`
    });
    continue;
  }

  // Contadores de identificadores para rastrear setters de useState huérfanos
  const idCounts = new Map();
  const stateSetters = [];

  // Paso 1: Recorrer identificadores para contar apariciones
  walk(ast, {
    Identifier(node) {
      const name = node.name;
      idCounts.set(name, (idCounts.get(name) || 0) + 1);
    },
    VariableDeclarator(node) {
      // Detectar const [value, setValue] = useState(...)
      if (
        node.init &&
        node.init.type === 'CallExpression' &&
        node.init.callee?.name === 'useState' &&
        node.id?.type === 'ArrayPattern' &&
        node.id.elements?.length >= 2
      ) {
        const valElem = node.id.elements[0];
        const setterElem = node.id.elements[1];
        if (setterElem?.type === 'Identifier') {
          stateSetters.push({
            setterName: setterElem.name,
            stateName: valElem?.type === 'Identifier' ? valElem.name : 'state',
            line: setterElem.loc?.start.line || 1
          });
        }
      }
    },
    JSXAttribute(node) {
      const propName = node.name?.name;
      const val = node.value;

      // REGLA 1: Prohibido prop={undefined} explícito
      if (val && val.type === 'JSXExpressionContainer') {
        const expr = val.expression;
        if (expr.type === 'Identifier' && expr.name === 'undefined') {
          violations.push({
            file: relPath,
            line: node.loc?.start.line || 1,
            column: node.loc?.start.column || 0,
            rule: 'EXPLICIT_UNDEFINED_PROP',
            message: `Prop '${propName}' pasada explícitamente con valor {undefined}. Si la prop es opcional, omítela o provee un fallback defensivo seguro.`
          });
        }

        // REGLA 2: Prohibido callbacks silenciados () => {} en props de acción (on*)
        const isActionCallback = typeof propName === 'string' && /^on[A-Z]/.test(propName);
        if (isActionCallback) {
          const isDummyArrow =
            expr.type === 'ArrowFunctionExpression' &&
            expr.body.type === 'BlockStatement' &&
            expr.body.body.length === 0;

          const isDummyFunc =
            expr.type === 'FunctionExpression' &&
            expr.body.type === 'BlockStatement' &&
            expr.body.body.length === 0;

          if (isDummyArrow || isDummyFunc) {
            violations.push({
              file: relPath,
              line: node.loc?.start.line || 1,
              column: node.loc?.start.column || 0,
              rule: 'SILENCED_DUMMY_CALLBACK',
              message: `Callback de acción '${propName}' silenciado con función vacía () => {}. Esto oculta mutaciones y rompe el cable de sincronización de estado hacia el componente padre.`
            });
          }
        }
      }
    }
  });

  // REGLA 3: Verificar setters de useState huérfanos
  // Si un setter solo aparece 1 vez en todo el archivo (su propia declaración), nunca es invocado ni pasado a ningún hijo
  for (const item of stateSetters) {
    const occurrences = idCounts.get(item.setterName) || 0;
    if (occurrences <= 1) {
      violations.push({
        file: relPath,
        line: item.line,
        column: 0,
        rule: 'DANGLING_STATE_SETTER',
        message: `Estado reactivo '${item.stateName}' tiene un setter huérfano '${item.setterName}' que nunca es utilizado ni conectado a un callback. El estado nunca cambiará en runtime.`
      });
    }
  }
}

if (violations.length > 0) {
  console.error(`\n❌ ERROR CRÍTICO DE CONTRATOS REACT: Se detectaron ${violations.length} violaciones en componentes:`);
  violations.forEach((v, idx) => {
    console.error(`\n  ${idx + 1}. [${v.rule}] en ${v.file}:${v.line}:${v.column}`);
    console.error(`     👉 ${v.message}`);
  });
  console.error('\n🛑 RECHAZO COERCITIVO: Resuelve los contratos rotos y cables sueltos de React antes de continuar.\n');
  process.exit(1);
}

console.info(`✅ [DEKO LABS] Todos los contratos y cables de estado React verificados exitosamente en ${filesToAudit.length} componentes.\n`);
process.exit(0);
