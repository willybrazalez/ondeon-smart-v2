const { execSync } = require('child_process');
const path = require('path');

const SERVER_ENDPOINT = 'http://127.0.0.1:7242/ingest/387fb109-3d75-4d24-b454-7d123dcb5eaa';
const sessionId = 'debug-session';
const runId = process.env.RUN_ID || `run-${Date.now()}`;

const args = process.argv.slice(2);
const dmgPath = args[0];
const appPath = args[1];

function logEvent({ hypothesisId, location, message, data }) {
  // #region agent log
  fetch(SERVER_ENDPOINT, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      sessionId,
      runId,
      hypothesisId,
      location,
      message,
      data,
      timestamp: Date.now()
    })
  }).catch(() => {});
  // #endregion
}

function run(cmd) {
  try {
    const out = execSync(cmd, { encoding: 'utf8', stdio: ['ignore', 'pipe', 'pipe'] });
    return { ok: true, out: out.trim() };
  } catch (error) {
    const stdout = error.stdout ? String(error.stdout).trim() : '';
    const stderr = error.stderr ? String(error.stderr).trim() : '';
    return { ok: false, out: [stdout, stderr].filter(Boolean).join('\n') };
  }
}

logEvent({
  hypothesisId: 'A',
  location: 'scripts/build-diagnostics.cjs:32',
  message: 'Inputs received',
  data: { dmgPath, appPath }
});

if (!dmgPath || !appPath) {
  logEvent({
    hypothesisId: 'A',
    location: 'scripts/build-diagnostics.cjs:40',
    message: 'Missing arguments',
    data: { dmgPath, appPath }
  });
  process.exit(1);
}

const dmgAbs = path.resolve(dmgPath);
const appAbs = path.resolve(appPath);

logEvent({
  hypothesisId: 'A',
  location: 'scripts/build-diagnostics.cjs:51',
  message: 'Resolved paths',
  data: { dmgAbs, appAbs }
});

const stapler = run(`xcrun stapler validate "${dmgAbs}"`);
logEvent({
  hypothesisId: 'B',
  location: 'scripts/build-diagnostics.cjs:58',
  message: 'Stapler validate',
  data: { ok: stapler.ok, output: stapler.out.slice(0, 1000) }
});

const spctlDmg = run(`spctl --assess --type open --verbose=4 "${dmgAbs}"`);
logEvent({
  hypothesisId: 'C',
  location: 'scripts/build-diagnostics.cjs:65',
  message: 'spctl DMG',
  data: { ok: spctlDmg.ok, output: spctlDmg.out.slice(0, 1000) }
});

const spctlApp = run(`spctl --assess --verbose=4 "${appAbs}"`);
logEvent({
  hypothesisId: 'C',
  location: 'scripts/build-diagnostics.cjs:72',
  message: 'spctl App',
  data: { ok: spctlApp.ok, output: spctlApp.out.slice(0, 1000) }
});

const xattrApp = run(`xattr -l "${appAbs}" | grep -i quarantine || true`);
logEvent({
  hypothesisId: 'D',
  location: 'scripts/build-diagnostics.cjs:79',
  message: 'xattr quarantine',
  data: { ok: xattrApp.ok, output: xattrApp.out.slice(0, 1000) }
});

const codesign = run(`codesign -dv --verbose=4 "${appAbs}" 2>&1`);
logEvent({
  hypothesisId: 'E',
  location: 'scripts/build-diagnostics.cjs:86',
  message: 'codesign',
  data: { ok: codesign.ok, output: codesign.out.slice(0, 1000) }
});

logEvent({
  hypothesisId: 'A',
  location: 'scripts/build-diagnostics.cjs:92',
  message: 'Diagnostics complete',
  data: { dmgAbs, appAbs }
});
