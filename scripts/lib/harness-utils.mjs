import { existsSync, statSync } from 'node:fs';
import { access, mkdir, readFile, writeFile } from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

export const HARNESS_ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..', '..');
export const FEATURE_LIST_SCHEMA_PATH = path.join(HARNESS_ROOT, 'scripts', 'feature-list.schema.json');
export const SUBSYSTEMS = ['instructions', 'state', 'verification', 'scope', 'lifecycle'];
export const CANONICAL_FEATURE_STATUSES = ['not-started', 'in-progress', 'blocked', 'done'];
const ALLOWED_FEATURE_STATUSES = new Set([
  ...CANONICAL_FEATURE_STATUSES,
  'not_started',
  'in_progress',
  'passing'
]);

export function parseArgs(argv) {
  const args = { _: [] };
  for (let i = 0; i < argv.length; i += 1) {
    const token = argv[i];
    if (!token.startsWith('--')) {
      args._.push(token);
      continue;
    }
    const [rawKey, inlineValue] = token.slice(2).split('=', 2);
    const key = rawKey.replace(/-([a-z])/g, (_, letter) => letter.toUpperCase());
    if (inlineValue !== undefined) {
      args[key] = inlineValue;
    } else if (argv[i + 1] && !argv[i + 1].startsWith('--')) {
      args[key] = argv[i + 1];
      i += 1;
    } else {
      args[key] = true;
    }
  }
  return args;
}

export async function exists(filePath) {
  try {
    await access(filePath);
    return true;
  } catch {
    return false;
  }
}

export async function readText(filePath) {
  return readFile(filePath, 'utf8');
}

export async function readJson(filePath) {
  return JSON.parse(await readText(filePath));
}

export async function writeText(filePath, contents) {
  await mkdir(path.dirname(filePath), { recursive: true });
  await writeFile(filePath, contents, 'utf8');
}

export function scoreHarness(files, root = process.cwd()) {
  const byPath = new Map(files.map((file) => [file.path, file.content]));
  const allText = files.map((file) => `${file.path}\n${file.content}`).join('\n\n');
  const agents = byPath.get('AGENTS.md') || byPath.get('CLAUDE.md') || '';
  const featureList = byPath.get('feature_list.json') || byPath.get('feature-list.json') || '';
  const progress = byPath.get('progress.md') || '';
  const init = byPath.get('init.sh') || '';
  const handoff = byPath.get('session-handoff.md') || '';

  const checks = {
    instructions: [
      hasFile(byPath, ['AGENTS.md', 'CLAUDE.md'], 'Agent instruction file exists'),
      structuredHas(agents, ['Startup Workflow', 'Before writing code'], 'Startup workflow documented'),
      structuredHas(agents, ['Definition of Done', 'done only when'], 'Definition of done documented'),
      structuredHas(agents, ['Verification Commands', './init.sh', 'test', 'verify'], 'Verification commands discoverable'),
      structuredHas(agents, ['feature_list.json', 'progress.md'], 'State artifacts routed from instructions')
    ],
    state: [
      hasFile(byPath, ['feature_list.json', 'feature-list.json'], 'Feature tracker exists'),
      jsonFeatureList(featureList, root, 'Feature tracker has structured tasks, enforces Pass-State Gating, and verifies physical deliverables on disk'),
      hasFile(byPath, ['progress.md'], 'Progress log exists'),
      structuredHas(progress, ['Current State', 'What', 'Next'], 'Progress log supports restart'),
      structuredHas(handoff || progress, ['Blockers', 'Files', 'Next Session'], 'Handoff captures blockers/files/next step')
    ],
    verification: [
      hasFile(byPath, ['init.sh'], 'Verification entrypoint exists'),
      textHas(init, ['set -e', 'set -euo pipefail'], 'Verification fails fast'),
      textHas(init + agents, ['test', 'pytest', 'vitest', 'cargo test', 'go test', 'dotnet test'], 'Test command documented'),
      textHas(init + agents, ['build', 'type', 'lint', 'compile'], 'Static/build check documented'),
      textHas(allText, ['Evidence', 'Verification Evidence', 'command and output'], 'Verification evidence is recorded')
    ],
    scope: [
      wipLimitCheck(agents, featureList, 'One-feature-at-a-time rule exists and WIP <= 1 enforced in feature_list.json'),
      dagDependencyCheck(featureList, 'Feature dependencies are tracked and strict sequential DAG order is respected (no skipping tasks)'),
      explicitStatusCheck(agents, featureList, 'Feature status is explicit'),
      structuredHas(agents, ['Stay in scope', 'scope'], 'Scope boundary documented'),
      structuredHas(agents, ['Definition of Done'], 'Completion gate limits scope closure')
    ],
    lifecycle: [
      hasFile(byPath, ['init.sh'], 'Startup script exists'),
      structuredHas(agents, ['End of Session', 'Before ending'], 'End-of-session procedure exists'),
      hasFile(byPath, ['session-handoff.md'], 'Session handoff template exists'),
      structuredHas(progress + '\n' + handoff, ['Last Updated', 'Current Objective', 'Recommended Next Step'], 'Session restart markers exist'),
      textHas(agents + init, ['restartable', 'clean', 'Next steps'], 'Clean restart path documented')
    ]
  };

  const subsystems = Object.fromEntries(Object.entries(checks).map(([name, subsystemChecks]) => {
    const passed = subsystemChecks.filter((check) => check.pass).length;
    const score = Math.max(1, Math.round((passed / subsystemChecks.length) * 5));
    return [name, {
      score,
      passed,
      total: subsystemChecks.length,
      checks: subsystemChecks
    }];
  }));

  const total = Object.values(subsystems).reduce((sum, item) => sum + item.score, 0);
  const overall = Math.round((total / (SUBSYSTEMS.length * 5)) * 100);
  const ranked = Object.entries(subsystems).sort((a, b) => a[1].score - b[1].score);
  const bottleneck = ranked[0][1].score === 5 ? null : ranked[0][0];
  return { overall, bottleneck, subsystems };
}

function hasFile(byPath, names, message) {
  return { pass: names.some((name) => byPath.has(name)), message };
}

function textHas(text, needles, message) {
  const lower = text.toLowerCase();
  return { pass: needles.some((needle) => lower.includes(needle.toLowerCase())), message };
}

function structuredText(markdown) {
  const kept = [];
  let inFence = false;
  for (const raw of markdown.split(/\r?\n/)) {
    const line = raw.trim();
    if (/^(```|~~~)/.test(line)) { inFence = !inFence; continue; }
    if (inFence) { kept.push(line); continue; }
    if (!line) continue;
    const isHeading = /^#{1,6}\s/.test(line);
    const isList = /^([-*+]|\d+\.)\s/.test(line);
    const isTable = line.startsWith('|');
    const isBoldLead = /^\*\*[^*]+\*\*/.test(line);
    if (isHeading || isList || isTable || isBoldLead) kept.push(line);
  }
  return kept.join('\n');
}

function structuredHas(markdown, needles, message) {
  return textHas(structuredText(markdown), needles, message);
}

export function findDependencyCycle(features) {
  if (!Array.isArray(features)) return null;
  const depsById = new Map();
  for (const f of features) {
    if (f && typeof f.id === 'string' && f.id.trim().length > 0) {
      depsById.set(f.id, Array.isArray(f.dependencies) ? f.dependencies : []);
    }
  }
  const color = new Map(); // 0 = unvisited, 1 = visiting, 2 = visited
  const trail = [];

  function dfs(nodeId) {
    color.set(nodeId, 1);
    trail.push(nodeId);
    for (const depId of depsById.get(nodeId) || []) {
      if (!depsById.has(depId)) continue;
      const state = color.get(depId) || 0;
      if (state === 1) {
        const idx = trail.indexOf(depId);
        return [...trail.slice(idx >= 0 ? idx : 0), depId];
      }
      if (state === 0) {
        const cycle = dfs(depId);
        if (cycle) return cycle;
      }
    }
    trail.pop();
    color.set(nodeId, 2);
    return null;
  }

  for (const id of depsById.keys()) {
    if ((color.get(id) || 0) === 0) {
      const cycle = dfs(id);
      if (cycle) return cycle;
    }
  }
  return null;
}

export function validateFeatureListObject(parsed, root = process.cwd()) {
  if (!parsed || typeof parsed !== 'object' || Array.isArray(parsed)) {
    return { valid: false, reason: 'feature_list.json root must be a JSON object' };
  }
  if (parsed.project !== undefined && (typeof parsed.project !== 'string' || parsed.project.trim().length === 0)) {
    return { valid: false, reason: 'project field must be a non-empty string when present' };
  }
  if (!Array.isArray(parsed.features) || parsed.features.length === 0) {
    return { valid: false, reason: 'feature_list.json must contain at least 1 feature' };
  }

  const seenIds = new Set();
  for (const f of parsed.features) {
    if (!f || typeof f !== 'object' || typeof f.id !== 'string' || f.id.trim().length === 0) {
      return { valid: false, reason: 'every feature must define a non-empty string id' };
    }
    if (seenIds.has(f.id)) {
      return { valid: false, reason: `duplicate feature id '${f.id}'` };
    }
    seenIds.add(f.id);
  }

  for (const feature of parsed.features) {
    const label = feature.name ?? feature.title;
    const hasBaseFields = typeof label === 'string'
      && label.trim().length > 0
      && typeof feature.description === 'string'
      && feature.description.trim().length > 0
      && typeof feature.status === 'string'
      && ALLOWED_FEATURE_STATUSES.has(feature.status)
      && Array.isArray(feature.dependencies)
      && feature.dependencies.every((depId) => typeof depId === 'string' && depId !== feature.id && seenIds.has(depId))
      && Array.isArray(feature.required_files)
      && feature.required_files.length > 0
      && feature.required_files.every((relPath) => typeof relPath === 'string' && relPath.trim().length > 0)
      && Array.isArray(feature.verification)
      && feature.verification.length > 0
      && feature.verification.every((step) => typeof step === 'string' && step.trim().length > 0);
    if (!hasBaseFields) {
      return { valid: false, reason: `feature '${feature.id}' is missing required fields, uses an invalid status, or references an unknown dependency` };
    }

    if (feature.area !== undefined && (typeof feature.area !== 'string' || feature.area.trim().length === 0)) {
      return { valid: false, reason: `feature '${feature.id}' area must be a non-empty string when provided` };
    }
    if (feature.user_visible_behavior !== undefined && (typeof feature.user_visible_behavior !== 'string' || feature.user_visible_behavior.trim().length === 0)) {
      return { valid: false, reason: `feature '${feature.id}' user_visible_behavior must be a non-empty string when provided` };
    }
    if (feature.notes !== undefined && typeof feature.notes !== 'string') {
      return { valid: false, reason: `feature '${feature.id}' notes must be a string when provided` };
    }
    if (feature.priority !== undefined) {
      const validPriority = (typeof feature.priority === 'string' && feature.priority.trim().length > 0)
        || Number.isInteger(feature.priority);
      if (!validPriority) {
        return { valid: false, reason: `feature '${feature.id}' priority must be a non-empty string or integer` };
      }
    }

    const isPassingOrDone = feature.status === 'done' || feature.status === 'passing';
    const hasEvidenceIfDone = !isPassingOrDone || (typeof feature.evidence === 'string' && feature.evidence.trim().length > 0);
    if (!hasEvidenceIfDone) {
      return { valid: false, reason: `feature '${feature.id}' is marked done without verification evidence` };
    }

    const hasPhysicalFilesIfDone = !isPassingOrDone || feature.required_files.every((relPath) => {
      const full = path.join(root, relPath);
      return existsSync(full) && statSync(full).size > 0;
    });
    if (!hasPhysicalFilesIfDone) {
      return { valid: false, reason: `feature '${feature.id}' is marked done with missing or empty required_files on disk` };
    }
  }

  const cycle = findDependencyCycle(parsed.features);
  if (cycle) {
    return { valid: false, reason: `circular dependency detected in DAG: ${cycle.join(' -> ')}` };
  }

  return { valid: true, reason: null };
}

function jsonFeatureList(text, root, message) {
  try {
    const parsed = JSON.parse(text);
    const check = validateFeatureListObject(parsed, root);
    if (!check.valid) {
      return { pass: false, message: `${message} (ERROR: ${check.reason})` };
    }
    return { pass: true, message };
  } catch {
    return { pass: false, message };
  }
}

function explicitStatusCheck(agentsMarkdown, featureListText, message) {
  if (!textHas(agentsMarkdown + featureListText, ['status'], message).pass) {
    return { pass: false, message };
  }
  if (!featureListText) {
    return { pass: false, message };
  }
  try {
    const parsed = JSON.parse(featureListText);
    if (!Array.isArray(parsed.features) || parsed.features.length === 0) {
      return { pass: false, message };
    }
    const allStatusesValid = parsed.features.every(
      (feature) => typeof feature.status === 'string' && ALLOWED_FEATURE_STATUSES.has(feature.status)
    );
    return { pass: allStatusesValid, message };
  } catch {
    return { pass: false, message };
  }
}

export function dagDependencyCheck(featureListText, message) {
  try {
    const parsed = JSON.parse(featureListText);
    if (!Array.isArray(parsed.features) || parsed.features.length === 0) {
      return { pass: false, message };
    }
    const seenIds = new Set();
    for (const f of parsed.features) {
      if (!f || typeof f.id !== 'string' || f.id.trim().length === 0 || seenIds.has(f.id)) {
        return { pass: false, message };
      }
      seenIds.add(f.id);
    }
    for (const f of parsed.features) {
      if (!Array.isArray(f.dependencies) || !f.dependencies.every((d) => typeof d === 'string' && d !== f.id && seenIds.has(d))) {
        return { pass: false, message };
      }
    }
    if (findDependencyCycle(parsed.features)) {
      return { pass: false, message };
    }
    const statusById = new Map(parsed.features.map((f) => [f.id, f.status]));
    const dagRespected = parsed.features.every((feature) => {
      const isStartedOrDone = feature.status === 'in-progress'
        || feature.status === 'in_progress'
        || feature.status === 'active'
        || feature.status === 'done'
        || feature.status === 'passing';
      if (!isStartedOrDone) return true;
      return feature.dependencies.every((depId) => {
        const depStatus = statusById.get(depId);
        return depStatus === 'done' || depStatus === 'passing';
      });
    });
    return { pass: dagRespected, message };
  } catch {
    return { pass: false, message };
  }
}

function wipLimitCheck(agentsMarkdown, featureListText, message) {
  const hasRule = structuredHas(agentsMarkdown, ['One feature at a time', 'one-feature-at-a-time'], message).pass;
  if (!hasRule) return { pass: false, message };
  if (!featureListText) return { pass: true, message };
  try {
    const parsed = JSON.parse(featureListText);
    if (!Array.isArray(parsed.features)) return { pass: false, message };
    const activeCount = parsed.features.filter((f) =>
      f.status === 'in-progress' || f.status === 'in_progress' || f.status === 'active'
    ).length;
    return { pass: activeCount <= 1, message };
  } catch {
    return { pass: false, message };
  }
}

export async function loadHarnessFiles(root) {
  const candidates = [
    'AGENTS.md',
    'CLAUDE.md',
    'feature_list.json',
    'feature-list.json',
    'progress.md',
    'session-handoff.md',
    'init.sh'
  ];
  const files = [];
  for (const candidate of candidates) {
    const fullPath = path.join(root, candidate);
    if (await exists(fullPath)) {
      files.push({ path: candidate, content: await readText(fullPath) });
    }
  }
  return files;
}

export function formatScoreReport(result, root = '.') {
  const lines = [
    `Harness validation for ${root}`,
    `Overall: ${result.overall}/100`,
    `Bottleneck: ${result.bottleneck ?? 'none — all subsystems at full score'}`,
    ''
  ];

  for (const [name, subsystem] of Object.entries(result.subsystems)) {
    lines.push(`${name}: ${subsystem.score}/5 (${subsystem.passed}/${subsystem.total})`);
    for (const check of subsystem.checks) {
      lines.push(`  ${check.pass ? 'PASS' : 'FAIL'} ${check.message}`);
    }
    lines.push('');
  }
  return lines.join('\n');
}

export function htmlReport(result, title = 'Harness Assessment') {
  const rows = Object.entries(result.subsystems).map(([name, subsystem]) => {
    const checks = subsystem.checks.map((check) =>
      `<li class="${check.pass ? 'pass' : 'fail'}">${check.pass ? 'PASS' : 'FAIL'} ${escapeHtml(check.message)}</li>`
    ).join('');
    return `<section>
      <h2>${escapeHtml(name)} <span>${subsystem.score}/5</span></h2>
      <ul>${checks}</ul>
    </section>`;
  }).join('\n');

  return `<!doctype html>
<html lang="es">
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width, initial-scale=1">
  <title>${escapeHtml(title)}</title>
  <style>
    body { font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", sans-serif; margin: 32px; color: #172026; background: #f7f8fa; }
    main { max-width: 960px; margin: 0 auto; }
    header { margin-bottom: 24px; }
    h1 { margin: 0 0 8px; font-size: 32px; }
    .summary { display: flex; gap: 16px; flex-wrap: wrap; margin: 20px 0; }
    .metric { background: white; border: 1px solid #d9dee5; border-radius: 8px; padding: 16px 18px; min-width: 180px; }
    .metric strong { display: block; font-size: 28px; margin-top: 4px; }
    section { background: white; border: 1px solid #d9dee5; border-radius: 8px; margin: 14px 0; padding: 16px 18px; }
    h2 { margin: 0 0 10px; font-size: 20px; display: flex; justify-content: space-between; }
    ul { margin: 0; padding-left: 20px; }
    li { margin: 6px 0; }
    .pass { color: #126c43; }
    .fail { color: #a23020; }
  </style>
</head>
<body>
  <main>
    <header>
      <h1>${escapeHtml(title)}</h1>
      <p>Reporte de validación de los 5 subsistemas del arnés.</p>
      <div class="summary">
        <div class="metric">Puntaje Total<strong>${result.overall}/100</strong></div>
        <div class="metric">Cuello de Botella<strong>${escapeHtml(result.bottleneck ?? 'ninguno')}</strong></div>
      </div>
    </header>
    ${rows}
  </main>
</body>
</html>
`;
}

function escapeHtml(value) {
  return String(value)
    .replaceAll('&', '&amp;')
    .replaceAll('<', '&lt;')
    .replaceAll('>', '&gt;')
    .replaceAll('"', '&quot;')
    .replaceAll("'", '&#39;');
}
