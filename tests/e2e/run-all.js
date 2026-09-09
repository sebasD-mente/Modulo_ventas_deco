/**
 * Unified E2E Test Runner for Deko EventSales
 * Executes 4-Tier Opaque-Box Test Architecture
 */
import { spawn } from 'child_process';
import path from 'path';
import { fileURLToPath } from 'url';
import { BASE_URL, apiRequest } from './test-helpers.js';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const TIERS = [
  {
    tier: 'TIER 1',
    name: 'Feature Coverage (>=5 per feature)',
    file: 'tier1-features.test.js',
    scope: 'Auth, POS Sales, Catalog Sync, Cloud Storage, Health Observability',
  },
  {
    tier: 'TIER 2',
    name: 'Boundary & Corner Cases',
    file: 'tier2-boundary.test.js',
    scope: 'Auth boundaries, Missing fields, Negative numbers, Length limits, Enums, Concurrency',
  },
  {
    tier: 'TIER 3',
    name: 'Cross-Feature Combinations',
    file: 'tier3-combinations.test.js',
    scope: 'Auth+Sale, Catalog+Search+POS, Upload+Receipt, Sale+KPIs, Split Payment',
  },
  {
    tier: 'TIER 4',
    name: 'Real-World Scenarios',
    file: 'tier4-scenarios.test.js',
    scope: 'Full Day Event Lifecycle (Booth Opening -> Catalog -> Sales -> KPIs -> Audit -> Cash Closing)',
  },
  {
    tier: 'TIER 5',
    name: 'Multimodal AI Sales & Intelligent Assistant',
    file: 'tier5-ai-sales.test.js',
    scope: 'AI Chat Guardrails, Natural Language Sales Dictation, Draft Extractor, POS Assembling, Real-time Metrics',
  },
];

const colors = {
  reset: '\x1b[0m',
  bright: '\x1b[1m',
  dim: '\x1b[2m',
  cyan: '\x1b[36m',
  green: '\x1b[32m',
  yellow: '\x1b[33m',
  red: '\x1b[31m',
  magenta: '\x1b[35m',
};

function logHeader(text) {
  console.log(`\n${colors.bright}${colors.cyan}${'='.repeat(80)}${colors.reset}`);
  console.log(`${colors.bright}${colors.cyan}  ${text}${colors.reset}`);
  console.log(`${colors.bright}${colors.cyan}${'='.repeat(80)}${colors.reset}\n`);
}

function runTier(tierConfig) {
  return new Promise((resolve) => {
    const filePath = path.resolve(__dirname, tierConfig.file);
    const startTime = Date.now();

    console.log(
      `${colors.bright}${colors.magenta}▶ [RUNNING ${tierConfig.tier}]${colors.reset} ${tierConfig.name}`
    );
    console.log(`${colors.dim}  Scope: ${tierConfig.scope}${colors.reset}`);

    const child = spawn(process.execPath, ['--test', filePath], {
      stdio: 'inherit',
      env: process.env,
    });

    child.on('close', (code) => {
      const duration = ((Date.now() - startTime) / 1000).toFixed(2);
      if (code === 0) {
        console.log(
          `${colors.green}✔ [PASSED ${tierConfig.tier}]${colors.reset} (${duration}s)\n`
        );
        resolve({ tier: tierConfig.tier, name: tierConfig.name, passed: true, duration });
      } else {
        console.error(
          `${colors.red}✖ [FAILED ${tierConfig.tier}]${colors.reset} with exit code ${code} (${duration}s)\n`
        );
        resolve({ tier: tierConfig.tier, name: tierConfig.name, passed: false, duration });
      }
    });

    child.on('error', (err) => {
      console.error(`${colors.red}✖ Error spawning test tier:${colors.reset}`, err);
      resolve({ tier: tierConfig.tier, name: tierConfig.name, passed: false, error: err.message });
    });
  });
}

async function main() {
  logHeader('DEKO EVENTSALES — 4-TIER E2E TEST SUITE RUNNER');
  console.log(`Target Server: ${colors.yellow}${BASE_URL}${colors.reset}`);
  console.log(`Node Runtime:  ${colors.yellow}${process.version}${colors.reset}`);
  console.log(`Timestamp:     ${colors.yellow}${new Date().toISOString()}${colors.reset}\n`);

  // Check health of target server before beginning, auto-start if not running
  let spawnedServer = null;
  try {
    const health = await apiRequest('/health');
    if (!health.ok) {
      console.warn(
        `${colors.yellow}⚠️ Warning: Target server at ${BASE_URL} returned status ${health.status}.${colors.reset}`
      );
    } else {
      console.log(`${colors.green}✔ Live Server Health Confirmed:${colors.reset}`, health.body);
    }
  } catch (err) {
    console.log(`${colors.yellow}ℹ Server is not currently running. Auto-starting server instance for test execution...${colors.reset}`);
    const serverPath = path.resolve(__dirname, '../../server/index.js');
    spawnedServer = spawn(process.execPath, [serverPath], {
      stdio: 'pipe',
      env: process.env,
    });

    // Wait for server /health to respond (up to 10 seconds)
    let ready = false;
    for (let i = 0; i < 20; i++) {
      await new Promise((r) => setTimeout(r, 500));
      try {
        const check = await apiRequest('/health');
        if (check.ok) {
          ready = true;
          console.log(`${colors.green}✔ Auto-started server is active and healthy.${colors.reset}`);
          break;
        }
      } catch (e) {
        // keep polling
      }
    }

    if (!ready) {
      console.error(`${colors.red}❌ Failed to start server at ${BASE_URL}.${colors.reset}`);
      if (spawnedServer) spawnedServer.kill('SIGTERM');
      process.exit(1);
    }
  }

  const results = [];
  const suiteStartTime = Date.now();

  for (const tierConfig of TIERS) {
    const result = await runTier(tierConfig);
    results.push(result);
  }

  const totalDuration = ((Date.now() - suiteStartTime) / 1000).toFixed(2);
  const passedCount = results.filter((r) => r.passed).length;
  const failedCount = results.filter((r) => !r.passed).length;

  logHeader('E2E TEST SUITE EXECUTION SUMMARY');

  results.forEach((r) => {
    const icon = r.passed ? `${colors.green}✔ PASS${colors.reset}` : `${colors.red}✖ FAIL${colors.reset}`;
    console.log(`  ${icon}  [${r.tier}] ${r.name.padEnd(45)} (${r.duration}s)`);
  });

  console.log(`\n${colors.bright}Summary:${colors.reset} Total Tiers: ${results.length} | Passed: ${colors.green}${passedCount}${colors.reset} | Failed: ${failedCount > 0 ? colors.red + failedCount + colors.reset : '0'} | Duration: ${totalDuration}s`);

  if (spawnedServer) {
    console.log(`${colors.dim}Shutting down auto-started test server...${colors.reset}`);
    spawnedServer.kill('SIGTERM');
  }

  if (failedCount === 0) {
    console.log(`\n${colors.bright}${colors.green}🎉 ALL 4 TIERS OF E2E TEST SUITE PASSED SUCCESSFULLY!${colors.reset}\n`);
    process.exit(0);
  } else {
    console.error(`\n${colors.bright}${colors.red}❌ ${failedCount} TEST TIER(S) FAILED. CHECK LOGS ABOVE.${colors.reset}\n`);
    process.exit(1);
  }
}

main().catch((err) => {
  console.error('Fatal runner error:', err);
  process.exit(1);
});
