#!/usr/bin/env node
import { spawnSync } from 'node:child_process';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { formatScoreReport, scoreHarness } from './lib/harness-utils.mjs';

const SCRIPT_FILE = fileURLToPath(import.meta.url);
export const REPO_ROOT = path.resolve(path.dirname(SCRIPT_FILE), '..');
const SAFE_ENV_TEMPLATES = new Set(['.env.example', '.env.sample', '.env.template']);
const WRITE_EDIT_TOOLS = new Set(['write_file', 'edit_file', 'write', 'edit', 'multiedit', 'create_file', 'replace_file_content', 'multi_replace_file_content']);
const COMMAND_TOOLS = new Set(['run_command', 'bash', 'execute_command', 'shell']);
const SEND_MESSAGE_TOOLS = new Set(['send_message', 'sendmessage']);
const WRAPPER_VERBS = new Set(['bash', 'sh', 'zsh', 'dash', 'ksh', 'cmd', 'pwsh', 'powershell', 'eval', 'iex', 'invoke-expression', 'psql', 'mysql', 'sqlite3', 'sqlcmd']);
const EXPLICIT_CHECKER_ID_RE = /(?:^|[-_:])(checker|evaluator|evaluador|independent-checker)(?:$|[-_:\d])/i;
const CHECKER_ROLE_RE = /\b(checker|evaluator|evaluador|independent-checker|inspector)\b/i;
const CHECKER_PROMPT_RE = /\b(?:eres\s+el\s+(?:\*\*)?(?:agente\s+)?(?:\*\*)?(?:checker|evaluador|inspector\s+independiente)|you\s+are\s+(?:the|an)\s+(?:independent\s+)?(?:checker|evaluator)|(?:act[uú]a|actuar)\s+como\s+(?:un\s+|el\s+)?(?:sub-?agente\s+|agente\s+)?(?:independent\s+)?(?:checker|evaluador))\b|(?:^|\n)\s*(?:#+\s*)?(?:tu\s+rol|rol|role)\s*:\s*(?:\*\*)?(?:agente\s+)?(?:independent[-_\s]*)?(?:checker|evaluador|evaluator)\b|(?:^|\n)\s*#\s*checker\s+agent\s+prompt\b/im;
const REAUDIT_MESSAGE_RE = /\b(?:re-?audit\w*|re-?evalu\w*|volver\s+a\s+auditar|volver\s+a\s+calificar|segunda\s+pasada|sigue\s+checker-prompt\.md)\b|\b(?:audita(?:r)?|califica(?:r)?|punt[uú]a(?:r)?|rellena(?:r)?|actualiza(?:r)?|eval[uú]a(?:r)?|revisa(?:r)?)\b[\s\S]{0,120}\bevaluator-rubric\.md\b/i;
export const redPenReason = (error, why, fix) => `ERROR: ${error}\nPOR QUÉ: ${why}\nSOLUCIÓN (FIX): ${fix}`;

export function resolveTargetRoot(payload = {}, env = process.env) {
  const envRoot = typeof env.HARNESS_TARGET_ROOT === 'string' ? env.HARNESS_TARGET_ROOT.trim() : '';
  if (envRoot && fs.existsSync(path.resolve(envRoot))) return path.resolve(envRoot);
  const ws = Array.isArray(payload?.workspacePaths) ? String(payload.workspacePaths[0] || '').trim() : '';
  if (ws && fs.existsSync(ws) && ['init.sh', 'AGENTS.md', 'feature_list.json'].some((f) => fs.existsSync(path.join(path.resolve(ws), f)))) return path.resolve(ws);
  return REPO_ROOT;
}

export function resolveBashConfig(env = process.env, platform = process.platform) {
  if (platform === 'win32') {
    const cands = [env.GIT_BASH_PATH, 'C:\\Program Files\\Git\\bin\\bash.exe', 'C:\\Program Files (x86)\\Git\\bin\\bash.exe', env.LOCALAPPDATA ? path.join(env.LOCALAPPDATA, 'Programs', 'Git', 'bin', 'bash.exe') : ''].filter(Boolean);
    const hit = cands.find((c) => fs.existsSync(c));
    if (hit) return { bashBin: hit, extraPathDirs: [path.join(path.resolve(path.dirname(hit), '..'), 'bin'), path.join(path.resolve(path.dirname(hit), '..'), 'usr', 'bin')].filter((d) => fs.existsSync(d)) };
  }
  return { bashBin: 'bash', extraPathDirs: [] };
}

export function readStdinPayload() {
  if (process.stdin.isTTY) return { ok: true, empty: true, payload: {} };
  let raw = '';
  try { raw = fs.readFileSync(0, 'utf8'); } catch (err) { return err && ['EBADF', 'EINVAL', 'EOF', 'EAGAIN'].includes(err.code) ? { ok: true, empty: true, payload: {} } : { ok: false, empty: false, payload: {}, parseError: String(err?.message || err) }; }
  if (!raw.trim()) return { ok: true, empty: true, payload: {} };
  try {
    const parsed = JSON.parse(raw.trim());
    return parsed && typeof parsed === 'object' && !Array.isArray(parsed) ? { ok: true, empty: false, payload: parsed } : { ok: false, empty: false, payload: {}, parseError: 'stdin root JSON must be an object' };
  } catch (err) { return { ok: false, empty: false, payload: {}, parseError: String(err?.message || err) }; }
}

export function extractToolContext(payload = {}, stdinEmpty = false, env = process.env) {
  const tc = payload?.toolCall || payload?.preToolHookArgs?.toolCall || payload?.toolHookArgs?.toolCall || null;
  const toolName = String(tc?.name ?? payload?.toolName ?? payload?.tool_name ?? '').trim(), lowerName = toolName.toLowerCase();
  let args = tc?.args ?? tc?.arguments ?? payload?.toolArgs ?? payload?.tool_input ?? payload?.input ?? {};
  if (typeof args === 'string') { try { args = JSON.parse(args); } catch { args = {}; } }
  if (!args || typeof args !== 'object') args = {};
  const targetPaths = ['Path', 'TargetFile', 'AbsolutePath', 'file_path', 'path', 'target_file', 'filePath', 'File'].map((k) => (typeof args[k] === 'string' ? args[k].trim() : '')).filter(Boolean);
  const cmdKey = ['CommandLine', 'command', 'cmd', 'Command'].find((k) => typeof args[k] === 'string' && args[k].trim());
  let commandLine = cmdKey ? args[cmdKey] : '', isWriteEdit = WRITE_EDIT_TOOLS.has(lowerName), isCommand = COMMAND_TOOLS.has(lowerName);
  const recipient = String(args.Recipient ?? args.recipient ?? args.to ?? args.conversationId ?? '').trim();
  const message = String(args.Message ?? args.message ?? args.content ?? '').trim(), isSendMessage = SEND_MESSAGE_TOOLS.has(lowerName);
  if ((stdinEmpty || !toolName) && typeof env.TOOL_TARGET_PATH === 'string' && env.TOOL_TARGET_PATH.trim()) { isWriteEdit = true; targetPaths.push(env.TOOL_TARGET_PATH.trim()); }
  if ((stdinEmpty || !toolName) && typeof env.TOOL_COMMAND === 'string' && env.TOOL_COMMAND.trim()) { isCommand = true; if (!commandLine) commandLine = env.TOOL_COMMAND; }
  return { toolName, lowerName, args, isWriteEdit, isCommand, isSendMessage, targetPaths, commandLine, recipient, message };
}

export function isProtectedTargetPath(rawPath) {
  if (typeof rawPath !== 'string' || !rawPath.trim()) return { blocked: false, reason: null };
  const segments = rawPath.trim().replace(/\\/g, '/').split('/').filter((s) => s && s !== '.');
  for (let i = 0; i < segments.length; i += 1) {
    const lower = segments[i].toLowerCase();
    if (lower === '.git') return { blocked: true, category: '.git/**', target: rawPath };
    if (lower === 'node_modules') return { blocked: true, category: 'node_modules/**', target: rawPath };
    if ((lower === '.env' || lower.startsWith('.env.')) && !(i === segments.length - 1 && SAFE_ENV_TEMPLATES.has(lower))) return { blocked: true, category: '.env / .env.*', target: rawPath };
  }
  return { blocked: false, reason: null };
}

function splitTopClauses(cmd) {
  const out = [];
  let cur = '', quote = '', depth = 0;
  for (let i = 0; i < cmd.length; i += 1) {
    const ch = cmd[i];
    if (quote === "'") { cur += ch; if (ch === "'") quote = ''; continue; }
    if (ch === '\\' && i + 1 < cmd.length) { cur += ch + cmd[++i]; continue; }
    if (quote === '"') { cur += ch; if (ch === '"') quote = ''; continue; }
    if (ch === "'" || ch === '"') { quote = ch; cur += ch; continue; }
    if (ch === '(') { depth += 1; cur += ch; continue; }
    if (ch === ')' && depth > 0) { depth -= 1; cur += ch; continue; }
    const fdRedir = ch === '&' && (cmd[i - 1] === '>' || cmd[i - 1] === '<' || cmd[i + 1] === '>');
    if (depth === 0 && !fdRedir && (ch === ';' || ch === '\n' || ch === '&' || ch === '|')) {
      let sep = ch;
      if ((ch === '&' || ch === '|') && cmd[i + 1] === ch) sep += cmd[++i];
      if (cur.trim()) out.push({ text: cur.trim(), sep });
      cur = ''; continue;
    }
    cur += ch;
  }
  if (cur.trim()) out.push({ text: cur.trim(), sep: '' });
  return out;
}

function unwrapOuterParens(s) {
  if (!s.startsWith('(') || !s.endsWith(')')) return null;
  let quote = '', depth = 0;
  for (let i = 0; i < s.length; i += 1) {
    const ch = s[i];
    if (quote === "'") { if (ch === "'") quote = ''; continue; }
    if (ch === '\\' && i + 1 < s.length) { i += 1; continue; }
    if (quote === '"') { if (ch === '"') quote = ''; continue; }
    if (ch === "'" || ch === '"') { quote = ch; continue; }
    if (ch === '(') depth += 1;
    else if (ch === ')' && --depth === 0) return i === s.length - 1 ? s.slice(1, -1).trim() : null;
  }
  return null;
}

function collectActiveClauses(raw, depth = 0) {
  if (typeof raw !== 'string' || !raw.trim() || depth > 5) return [];
  const clauses = [];
  for (const m of raw.replace(/'[^']*'/g, "''").matchAll(/\$\(([^)]+)\)|`([^`]+)`/g)) clauses.push(...collectActiveClauses(m[1] || m[2], depth + 1));
  const parts = splitTopClauses(raw);
  for (let idx = 0; idx < parts.length; idx += 1) {
    const seg = parts[idx].text.trim(), inner = unwrapOuterParens(seg);
    if (inner !== null) { clauses.push(...collectActiveClauses(inner, depth + 1)); continue; }
    if (parts[idx].sep === '|' && /^(?:'[^']*'|"(?:\\.|[^"\\])*")$/.test(seg) && parts[idx + 1]) {
      const nextVerb = (parts[idx + 1].text.match(/^\S+/) || [''])[0].replace(/\\/g, '/').split('/').pop().toLowerCase().replace(/\.exe$/, '');
      if (!WRAPPER_VERBS.has(nextVerb)) continue;
    }
    const stripped = seg.replace(/^\{\s+/, '').replace(/\s*\}\s*$/, '').replace(/^(?:(?:[A-Za-z_]\w*=\S+|env|sudo|command|nohup|&)\s+)+/i, '');
    const verb = (stripped.match(/^([^\s"']+)/) || ['', ''])[1].replace(/\\/g, '/').split('/').pop().toLowerCase().replace(/\.exe$/, '');
    if (['echo', 'printf', 'write-output', 'write-host'].includes(verb)) clauses.push(stripped.replace(/'[^']*'|"(?:\\.|[^"\\])*"/g, '""'));
    else if (verb === 'git' && /\bcommit\b/i.test(stripped)) clauses.push(stripped.replace(/(-[a-zA-Z]*m|--message(?:=|\s+))\s*(?:'[^']*'|"(?:\\.|[^"\\])*")/g, '$1 ""'));
    else if (WRAPPER_VERBS.has(verb)) {
      for (const qm of stripped.matchAll(/'([^']*)'|"((?:\\.|[^"\\])*)"/g)) clauses.push(...collectActiveClauses(qm[1] !== undefined ? qm[1] : qm[2].replace(/\\"/g, '"'), depth + 1));
      const tail = stripped.replace(/^\S+\s+(?:(?:-\w+|\/[ckq]|--(?:command|execute))\s+)*/i, '');
      if (tail && tail !== stripped && !/^['"]/.test(tail)) clauses.push(...collectActiveClauses(tail, depth + 1));
    } else clauses.push(stripped);
  }
  return clauses;
}

const DESTRUCTIVE_CHECKS = [
  ['rm -rf', (s) => /\brm(?:\.exe)?\b/i.test(s) && (/(?:^|\s)-[a-z]*(?:r[a-z]*f|f[a-z]*r)[a-z]*(?=\s|$)/i.test(s) || (/(?:^|\s)(?:-[a-z]*r[a-z]*|--recursive)(?=\s|$)/i.test(s) && /(?:^|\s)(?:-[a-z]*f[a-z]*|--force)(?=\s|$)/i.test(s)))],
  ['Remove-Item -Recurse -Force', (s) => /\bRemove-Item\b/i.test(s) && /(?:^|\s)-Recurse(?=\s|$)/i.test(s) && /(?:^|\s)-Force(?=\s|$)/i.test(s)],
  ['git reset --hard', (s) => /\bgit(?:\.exe)?\b.*\breset\b.*(?:^|\s)--hard(?=\s|$)/i.test(s)],
  ['git push --force / -f', (s) => /\bgit(?:\.exe)?\b.*\bpush\b.*(?:^|\s)(?:--force|-[a-zA-Z]*f[a-zA-Z]*)(?=\s|$)/.test(s)],
  ['git clean -fd / -fdx', (s) => /\bgit(?:\.exe)?\b.*\bclean\b/i.test(s) && (/(?:^|\s)-[a-z]*(?:f[a-z]*d|d[a-z]*f)[a-z]*(?=\s|$)/i.test(s) || (/(?:^|\s)(?:-[a-z]*f[a-z]*|--force)(?=\s|$)/i.test(s) && /(?:^|\s)-[a-z]*d[a-z]*(?=\s|$)/i.test(s)))],
  ['DROP TABLE', (s) => /\bDROP\s+TABLE\b/i.test(s)],
  ['DROP DATABASE', (s) => /\bDROP\s+DATABASE\b/i.test(s)],
  ['TRUNCATE', (s) => /\bTRUNCATE\s+TABLE\b/i.test(s) || /\bTRUNCATE\s+(?!-)[A-Za-z_"`\[][\w"`\[\].]*\s*$/i.test(s)],
  ['DELETE FROM sin WHERE', (s) => /\bDELETE\s+FROM\b/i.test(s) && !/\bWHERE\b/i.test(s)],
  ['prisma destructivo (migrate reset / --force-reset / --accept-data-loss)', (s) => /\bprisma(?:\.exe|\.cmd)?\b/i.test(s) && (/\bmigrate\s+reset\b/i.test(s) || (/\bdb\s+push\b/i.test(s) && /(?:^|\s)--(?:force-reset|accept-data-loss)(?=\s|$)/i.test(s)))]
];

export function detectDestructiveCommand(rawCommand) {
  for (const seg of collectActiveClauses(rawCommand)) for (const [rule, matches] of DESTRUCTIVE_CHECKS) if (matches(seg)) return { blocked: true, rule };
  return { blocked: false, rule: null };
}

export function isCheckerSession(payload = {}) {
  if (payload?.isChecker === true) return true;
  const role = String(payload?.role ?? payload?.agentRole ?? payload?.subagentRole ?? payload?.agentType ?? payload?.subagentType ?? '').trim();
  if (role && !['user', 'assistant', 'system', 'tool', 'model'].includes(role.toLowerCase()) && CHECKER_ROLE_RE.test(role)) return true;
  const convId = String(payload?.conversationId ?? '').trim();
  if (EXPLICIT_CHECKER_ID_RE.test(convId) && /^(?:checker|evaluator|evaluador|independent-checker)/i.test(convId)) return true;
  if (CHECKER_PROMPT_RE.test(String(payload?.lastUserInput ?? ''))) return true;
  const tp = payload?.transcriptPath;
  if (typeof tp === 'string' && tp.trim() && fs.existsSync(tp)) {
    try {
      for (const [i, line] of fs.readFileSync(tp, 'utf8').split(/\r?\n/).filter(Boolean).slice(0, 5).entries()) {
        let obj = null; try { obj = JSON.parse(line); } catch { obj = null; }
        if (!obj) { if (i === 0 && CHECKER_PROMPT_RE.test(line)) return true; break; }
        if (obj.type === 'PLANNER_RESPONSE' || String(obj.role || '').toLowerCase() === 'assistant') break;
        if (CHECKER_PROMPT_RE.test([obj.content, obj.prompt, obj.message, obj.text, obj.userInput?.userResponse].filter(Boolean).join('\n'))) return true;
      }
    } catch { /* ignore */ }
  }
  return false;
}

const classifyInvokeSpec = (spec) => {
  const nonChecker = /"(?:TypeName|typeName|Role|role)"\s*:\s*"(?:\\")?(?:research\w*|explor\w*|worker|maker|coder|flutter_a11y\w*|image-generator)/i.test(spec);
  return !nonChecker && (CHECKER_ROLE_RE.test(spec) || CHECKER_PROMPT_RE.test(spec) || /checker-prompt\.md|evaluator-rubric\.md/i.test(spec)) ? 'checker' : 'non-checker';
};

export function isSendMessageToChecker(payload = {}, recipient = '', message = '') {
  if (EXPLICIT_CHECKER_ID_RE.test(recipient)) return { blocked: true, detail: `Recipient '${recipient}' es una instancia Checker` };
  const checkerMode = isCheckerSession(payload), tp = payload?.transcriptPath;
  let kind = 'unknown', parentSender = '';
  if (recipient && typeof tp === 'string' && tp.trim() && fs.existsSync(tp)) {
    try {
      const lines = fs.readFileSync(tp, 'utf8').split(/\r?\n/).filter(Boolean);
      if (lines[0] && /SYSTEM_MESSAGE/.test(lines[0])) {
        let first = lines[0]; try { first = String(JSON.parse(first)?.content || first); } catch { /* raw */ }
        parentSender = (first.match(/\bsender=(?!system\b)([^\s"'<>\\]+)/i) || ['', ''])[1];
      }
      if (parentSender && recipient === parentSender) return { blocked: false, detail: null };
      for (let i = 0; i < lines.length; i += 1) {
        const line = lines[i], isPassive = /"type"\s*:\s*"(?:SYSTEM_MESSAGE|GENERIC|TOOL_RESPONSE|USER_INPUT)"/i.test(line);
        if (!isPassive && /\binvoke_?subagent\b|"invokeSubagent"\s*:/i.test(line)) {
          let step = null; try { step = JSON.parse(line); } catch { step = null; }
          if (Array.isArray(step?.tool_calls)) {
            for (let k = 0; k < step.tool_calls.length; k += 1) {
              const tc = step.tool_calls[k], resp = lines[i + 1 + k] || '';
              if (/^invoke_?subagent$/i.test(String(tc?.name || '')) && (JSON.stringify(tc).includes(recipient) || (/"type"\s*:\s*"(?:GENERIC|TOOL_RESPONSE)"/i.test(resp) && resp.includes(recipient)))) kind = classifyInvokeSpec(JSON.stringify(tc));
            }
          } else if (line.includes(recipient) || (Boolean(lines[i + 1]?.includes(recipient)) && !/\binvoke_?subagent\b/i.test(lines[i + 1] || ''))) kind = classifyInvokeSpec(line);
          if (kind === 'checker') break;
        } else if (kind === 'unknown' && i > 0 && recipient !== parentSender && /SYSTEM_MESSAGE/.test(line) && (line.includes(`sender=${recipient}`) || line.includes(`Subagent ${recipient}`)) && /\b(?:ACEPTAR|REVISAR|BLOQUEAR)\b/.test(line) && /\b(?:[0-9]|1[0-2])\s*\/\s*12\b/.test(line)) {
          kind = 'checker'; break;
        }
      }
    } catch { /* ignore */ }
  }
  if (checkerMode) return kind === 'checker' ? { blocked: true, detail: `Recipient '${recipient}' es Checker` } : { blocked: false, detail: null };
  if (REAUDIT_MESSAGE_RE.test(message)) return { blocked: true, detail: 'Solicitud de re-auditoría en sesión existente' };
  return kind === 'checker' ? { blocked: true, detail: `Recipient '${recipient}' corresponde a un Checker previo en transcriptPath` } : { blocked: false, detail: null };
}

export function evaluatePreToolUse(stdinState, env = process.env) {
  if (!stdinState.ok) return { decision: 'deny', reason: redPenReason(`JSON inválido en stdin (${stdinState.parseError}).`, 'Fail-Closed prohíbe auto-aprobar entradas corruptas.', 'Envía un objeto JSON válido por stdin.') };
  const ctx = extractToolContext(stdinState.payload, stdinState.empty, env);
  for (const target of ctx.isWriteEdit ? ctx.targetPaths : []) {
    const c = isProtectedTargetPath(target);
    if (c.blocked) return { decision: 'deny', reason: redPenReason(`Escritura bloqueada en '${c.target}' (${c.category}).`, 'docs/SECURITY.md prohíbe editar .git/**, node_modules/** o .env/.env.*.', 'Usa .env.example / .env.sample / .env.template o solicita autorización al usuario.') };
  }
  if (ctx.isCommand && ctx.commandLine) {
    const c = detectDestructiveCommand(ctx.commandLine);
    if (c.blocked) return { decision: 'deny', reason: redPenReason(`Comando destructivo bloqueado ('${c.rule}').`, 'docs/SECURITY.md prohíbe borrados recursivos forzados, reescrituras destructivas Git o borrados SQL masivos.', 'Usa alternativas seguras como git restore --worktree --staged . o DELETE FROM ... WHERE ....') };
  }
  if (ctx.isSendMessage) {
    const c = isSendMessageToChecker(stdinState.payload, ctx.recipient, ctx.message);
    if (c.blocked) return { decision: 'deny', reason: redPenReason(`Reutilización de Checker vía send_message bloqueada (${c.detail}).`, 'AGENTS.md exige 1 Checker = 1 sola auditoría (one-shot / zero-inheritance).', 'Lanza una instancia invoke_subagent completamente nueva con ventana virgen.') };
  }
  return { decision: 'allow' };
}

export function executePostToolUse(stdinState, env = process.env) {
  if (!stdinState.ok) return {};
  const targetRoot = resolveTargetRoot(stdinState.payload, env);
  for (const rawTarget of extractToolContext(stdinState.payload, stdinState.empty, env).targetPaths) {
    if (!rawTarget.toLowerCase().endsWith('.json')) continue;
    const fullPath = path.isAbsolute(rawTarget) ? rawTarget : path.resolve(targetRoot, rawTarget);
    if (!fs.existsSync(fullPath)) continue;
    try { JSON.parse(fs.readFileSync(fullPath, 'utf8')); } catch (err) {
      process.stderr.write(`[PostToolUse JSON] ${redPenReason(`JSON inválido en '${rawTarget}' (${err.message}).`, 'Un JSON corrupto rompe validadores y esquemas del arnés.', `Corrige la sintaxis JSON en '${rawTarget}'.`)}\n`);
    }
  }
  return {};
}

export function evaluateStopGate(stdinState, env = process.env) {
  if (!stdinState.ok) return { decision: 'continue', reason: redPenReason(`JSON inválido en stdin (${stdinState.parseError}).`, 'Fail-Closed prohíbe cerrar turno con payload corrupto.', 'Envía un objeto JSON válido por stdin.') };
  const payload = stdinState.payload || {}, reason = typeof payload.terminationReason === 'string' ? payload.terminationReason.trim() : '';
  if ((reason && reason !== 'NO_TOOL_CALL') || payload.fullyIdle === false || isCheckerSession(payload)) return { decision: 'stop' };
  const targetRoot = resolveTargetRoot(payload, env);
  const files = ['AGENTS.md', 'CLAUDE.md', 'feature_list.json', 'feature-list.json', 'progress.md', 'session-handoff.md', 'init.sh'].filter((f) => fs.existsSync(path.join(targetRoot, f))).map((f) => ({ path: f, content: fs.readFileSync(path.join(targetRoot, f), 'utf8') }));
  const scoreRes = scoreHarness(files, targetRoot);
  if (scoreRes.overall < 100) return { decision: 'continue', reason: redPenReason(`Puntaje del arnés ${scoreRes.overall}/100 (< 100).`, 'La Puerta 2 exige 100/100 (WIP <= 1, DAG y Pass-State Gating) antes de detenerse.', `Corrige las fallas:\n${formatScoreReport(scoreRes, targetRoot).slice(-900)}`) };
  if (fs.existsSync(path.join(targetRoot, '.git'))) {
    const gitRes = spawnSync('git', ['status', '--porcelain'], { cwd: targetRoot, encoding: 'utf8', timeout: 5000 });
    if (gitRes.status === 0 && gitRes.stdout.trim() === '') return { decision: 'stop' };
  }
  const { bashBin, extraPathDirs } = resolveBashConfig(env);
  const childEnv = extraPathDirs.length ? { ...env, PATH: [...extraPathDirs, env.PATH || env.Path || ''].filter(Boolean).join(path.delimiter) } : { ...env };
  const initRes = spawnSync(bashBin, ['./init.sh'], { cwd: targetRoot, env: childEnv, encoding: 'utf8', timeout: 55000 });
  if (initRes.status !== 0) return { decision: 'continue', reason: redPenReason(`Fallo al ejecutar './init.sh' en Stop (exit ${initRes.status ?? 1}).`, 'AGENTS.md prohíbe cerrar turno con puertas rotas.', `Repara el error y verifica './init.sh':\n${[initRes.stdout, initRes.stderr].filter(Boolean).join('\n').trim().slice(-900)}`) };
  return { decision: 'stop' };
}

export function runCli(argv = process.argv.slice(2), env = process.env) {
  const cmd = String(argv[0] || '').trim().toLowerCase(), stdinState = readStdinPayload();
  if (cmd === 'pre-tool-use' || cmd === 'pretooluse') { process.stdout.write(`${JSON.stringify(evaluatePreToolUse(stdinState, env))}\n`); return 0; }
  if (cmd === 'post-tool-use' || cmd === 'posttooluse') { process.stdout.write(`${JSON.stringify(executePostToolUse(stdinState, env))}\n`); return 0; }
  if (cmd === 'stop') { process.stdout.write(`${JSON.stringify(evaluateStopGate(stdinState, env))}\n`); return 0; }
  process.stdout.write(`${JSON.stringify({ decision: 'deny', reason: redPenReason(`Subcomando desconocido '${argv[0] || ''}'.`, 'Solo se admiten pre-tool-use, post-tool-use y stop.', 'Usa node ../scripts/harness-hooks.mjs <evento>.') })}\n`);
  return 1;
}

if (process.argv[1] && path.resolve(process.argv[1]) === SCRIPT_FILE) { process.exitCode = runCli(); }
