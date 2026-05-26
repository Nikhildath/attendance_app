#!/usr/bin/env node

/**
 * Socket.IO Server Deployment Verification Script
 * 
 * Usage:
 *   Local:     node verify-deployment.js
 *   Remote:    node verify-deployment.js https://your-socket-server.onrender.com
 */

import fetch from 'node-fetch';
import readline from 'readline';
import { fileURLToPath } from 'url';
import { dirname } from 'path';
import fs from 'fs';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

const COLORS = {
  reset: '\x1b[0m',
  green: '\x1b[32m',
  red: '\x1b[31m',
  yellow: '\x1b[33m',
  blue: '\x1b[34m',
  cyan: '\x1b[36m',
};

function log(message, color = 'reset') {
  console.log(`${COLORS[color]}${message}${COLORS.reset}`);
}

function check(passed, message) {
  const status = passed ? '✅' : '❌';
  const color = passed ? 'green' : 'red';
  log(`${status} ${message}`, color);
  return passed;
}

async function verifyLocal() {
  log('\n=== LOCAL ENVIRONMENT CHECKS ===\n', 'cyan');

  let allPassed = true;

  // Check 1: .env file exists
  const envExists = fs.existsSync(process.cwd() + '/.env');
  allPassed &= check(envExists, '.env file exists');
  
  if (envExists) {
    const env = fs.readFileSync(process.cwd() + '/.env', 'utf-8');
    const hasSocket = env.includes('VITE_SOCKET_URL');
    const hasSupabaseUrl = env.includes('VITE_SUPABASE_URL');
    const hasSupabaseKey = env.includes('VITE_SUPABASE_ANON_KEY');
    
    check(hasSocket, 'VITE_SOCKET_URL is set in .env');
    check(hasSupabaseUrl, 'VITE_SUPABASE_URL is set in .env');
    check(hasSupabaseKey, 'VITE_SUPABASE_ANON_KEY is set in .env');
    
    allPassed &= hasSocket && hasSupabaseUrl && hasSupabaseKey;
  }

  // Check 2: Required files exist
  const requiredFiles = [
    'server.js',
    'package.json',
    'ecosystem.config.js',
    'render.yaml',
  ];

  log('\nChecking required files:', 'blue');
  requiredFiles.forEach(file => {
    const exists = fs.existsSync(process.cwd() + '/' + file);
    allPassed &= check(exists, `${file} exists`);
  });

  // Check 3: npm scripts
  log('\nChecking npm scripts:', 'blue');
  const packageJson = JSON.parse(fs.readFileSync(process.cwd() + '/package.json', 'utf-8'));
  const hasServerScript = packageJson.scripts['server:socket'];
  const hasStartSocketScript = packageJson.scripts['start:socket'];
  
  check(hasServerScript, 'npm script "server:socket" exists');
  check(hasStartSocketScript, 'npm script "start:socket" exists');
  
  allPassed &= hasServerScript && hasStartSocketScript;

  return allPassed;
}

async function verifyRemote(socketUrl) {
  log('\n=== REMOTE SERVER CHECKS ===\n', 'cyan');
  log(`Testing: ${socketUrl}\n`, 'yellow');

  let allPassed = true;

  try {
    // Check 1: Health endpoint
    log('Checking /health endpoint...', 'blue');
    const healthResponse = await fetch(`${socketUrl}/health`, { timeout: 5000 });
    const healthPassed = healthResponse.ok;
    
    if (healthPassed) {
      const healthData = await healthResponse.json();
      check(true, `Health endpoint responds: ${JSON.stringify(healthData)}`);
    } else {
      check(false, `Health endpoint returned ${healthResponse.status}`);
      allPassed = false;
    }
  } catch (error) {
    check(false, `Failed to reach server: ${error.message}`);
    log('   Hint: Verify Socket server is deployed and running', 'yellow');
    log('   Hint: Check FRONTEND_URL in server environment variables', 'yellow');
    allPassed = false;
  }

  // Check 2: CORS headers (for frontend connection)
  try {
    log('\nChecking CORS configuration...', 'blue');
    const corsResponse = await fetch(`${socketUrl}`, {
      method: 'OPTIONS',
      timeout: 5000,
    }).catch(() => null);
    
    if (corsResponse) {
      const corsHeaders = corsResponse.headers.get('access-control-allow-origin');
      check(corsHeaders, `CORS headers configured: ${corsHeaders}`);
    } else {
      log('   ℹ️  OPTIONS request not available (normal for Socket.IO)', 'yellow');
    }
  } catch (error) {
    log(`   ℹ️  CORS check skipped: ${error.message}`, 'yellow');
  }

  return allPassed;
}

async function interactiveTest() {
  log('\n=== INTERACTIVE CONNECTION TEST ===\n', 'cyan');
  
  const rl = readline.createInterface({
    input: process.stdin,
    output: process.stdout,
  });

  const question = (query) => new Promise(resolve => rl.question(query, resolve));

  const socketUrl = await question('Enter Socket server URL (or "skip"): ');
  
  if (socketUrl.toLowerCase() === 'skip') {
    rl.close();
    return true;
  }

  rl.close();

  return await verifyRemote(socketUrl);
}

async function main() {
  log('\n╔════════════════════════════════════════════╗', 'cyan');
  log('║  Socket.IO Deployment Verification Tool   ║', 'cyan');
  log('╚════════════════════════════════════════════╝\n', 'cyan');

  let allChecks = true;

  // Local checks
  const localPassed = await verifyLocal();
  allChecks &= localPassed;

  // Remote checks
  const args = process.argv.slice(2);
  if (args.length > 0) {
    const socketUrl = args[0];
    const remotePassed = await verifyRemote(socketUrl);
    allChecks &= remotePassed;
  } else {
    log('\n=== REMOTE SERVER CHECKS ===\n', 'cyan');
    log('Skipped (provide Socket URL as argument to test remote)', 'yellow');
    log('Usage: node verify-deployment.js https://your-socket-server.onrender.com\n', 'yellow');
    
    // Ask if user wants to test interactively
    const testInteractive = await interactiveTest();
    allChecks &= testInteractive;
  }

  // Summary
  log('\n╔════════════════════════════════════════════╗', 'cyan');
  if (allChecks) {
    log('║            ✅ All Checks Passed!          ║', 'green');
    log('╚════════════════════════════════════════════╝\n', 'green');
    process.exit(0);
  } else {
    log('║         ⚠️  Some Checks Failed            ║', 'red');
    log('╚════════════════════════════════════════════╝\n', 'red');
    
    log('Next Steps:', 'yellow');
    log('1. Fix the failed checks above', 'yellow');
    log('2. Re-run this verification script', 'yellow');
    log('3. Check DEPLOY_CHECKLIST.md for detailed help', 'yellow');
    log('4. View HOSTING_SETUP.md for platform-specific setup\n', 'yellow');
    
    process.exit(1);
  }
}

main().catch(error => {
  log(`\nUnexpected error: ${error.message}`, 'red');
  process.exit(1);
});
