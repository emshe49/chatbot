const { spawn } = require('child_process');
const path = require('path');

const isWindows = process.platform === 'win32';

// ANSI colors for clean log separation
const colors = {
  reset: '\x1b[0m',
  bold: '\x1b[1m',
  backend: '\x1b[36m',   // Cyan
  frontend: '\x1b[32m',  // Green
  chatbot: '\x1b[33m',   // Yellow
  error: '\x1b[31m',     // Red
  system: '\x1b[35m',    // Magenta
  dim: '\x1b[2m'
};

const args = process.argv.slice(2);
const isMernOnly = args.includes('--mern');
const isChatbotOnly = args.includes('--chatbot');

const rootDir = __dirname;

const allServices = [
  {
    name: 'BACKEND',
    color: colors.backend,
    cwd: path.join(rootDir, 'FYP-Dashboard-Mern', 'Backend'),
    command: isWindows ? 'npm.cmd' : 'npm',
    args: ['start'],
    description: 'Express Server (Port 5000)'
  },
  {
    name: 'FRONTEND',
    color: colors.frontend,
    cwd: path.join(rootDir, 'FYP-Dashboard-Mern', 'Frontend'),
    command: isWindows ? 'npm.cmd' : 'npm',
    args: ['start'],
    description: 'React Dashboard (Port 3000)'
  },
  {
    name: 'CHATBOT',
    color: colors.chatbot,
    cwd: path.join(rootDir, 'UniversityChatbotFinal'),
    command: 'python',
    args: ['app.py'],
    description: 'Python FastAPI Chatbot (Port 8000)'
  }
];

let activeServices = allServices;
if (isMernOnly) {
  activeServices = allServices.filter(s => s.name !== 'CHATBOT');
} else if (isChatbotOnly) {
  activeServices = allServices.filter(s => s.name === 'CHATBOT');
}

console.log(`${colors.bold}${colors.system}====================================================${colors.reset}`);
console.log(`${colors.bold}${colors.system}   FYP Chatbot & Dashboard - Multi-Service Runner   ${colors.reset}`);
console.log(`${colors.bold}${colors.system}====================================================${colors.reset}`);
activeServices.forEach(s => {
  console.log(`  ${s.color}* [${s.name}]${colors.reset} ${s.description} ${colors.dim}(${path.relative(rootDir, s.cwd)})${colors.reset}`);
});
console.log(`${colors.bold}${colors.system}----------------------------------------------------${colors.reset}`);
console.log(`${colors.dim}Press Ctrl+C at any time to terminate all services.${colors.reset}\n`);

const runningProcesses = [];
let isShuttingDown = false;

function prefixStream(stream, name, color, isError = false) {
  if (!stream) return;
  let buffer = '';
  stream.on('data', (chunk) => {
    buffer += chunk.toString();
    const lines = buffer.split(/\r?\n/);
    buffer = lines.pop(); // keep remainder
    for (const line of lines) {
      if (line.trim().length > 0) {
        const streamColor = isError ? colors.error : color;
        console.log(`${streamColor}[${name}]${colors.reset} ${line}`);
      }
    }
  });
  stream.on('end', () => {
    if (buffer.trim().length > 0) {
      const streamColor = isError ? colors.error : color;
      console.log(`${streamColor}[${name}]${colors.reset} ${buffer}`);
    }
  });
}

function killProcess(childProc) {
  if (!childProc || !childProc.pid) return;
  if (isWindows) {
    try {
      spawn('taskkill', ['/pid', childProc.pid.toString(), '/T', '/F'], { stdio: 'ignore' });
    } catch (e) {
      // fallback
      try { childProc.kill(); } catch (err) {}
    }
  } else {
    try {
      process.kill(-childProc.pid);
    } catch (e) {
      try { childProc.kill(); } catch (err) {}
    }
  }
}

function shutdown(exitCode = 0) {
  if (isShuttingDown) return;
  isShuttingDown = true;
  console.log(`\n${colors.system}[SYSTEM] Stopping all running services...${colors.reset}`);
  for (const p of runningProcesses) {
    killProcess(p);
  }
  setTimeout(() => {
    console.log(`${colors.system}[SYSTEM] All services stopped.${colors.reset}`);
    process.exit(exitCode);
  }, 800);
}

process.on('SIGINT', () => shutdown(0));
process.on('SIGTERM', () => shutdown(0));
process.on('exit', () => shutdown(0));

// Spawn all active services
activeServices.forEach((service) => {
  try {
    const child = spawn(service.command, service.args, {
      cwd: service.cwd,
      shell: true,
      env: { ...process.env, FORCE_COLOR: '1' }
    });

    runningProcesses.push(child);

    prefixStream(child.stdout, service.name, service.color, false);
    prefixStream(child.stderr, service.name, service.color, true);

    child.on('error', (err) => {
      console.error(`${colors.error}[${service.name}] Failed to start: ${err.message}${colors.reset}`);
    });

    child.on('close', (code) => {
      if (!isShuttingDown) {
        console.log(`${service.color}[${service.name}] Process exited with code ${code}${colors.reset}`);
      }
    });
  } catch (err) {
    console.error(`${colors.error}[${service.name}] Failed to spawn: ${err.message}${colors.reset}`);
  }
});
