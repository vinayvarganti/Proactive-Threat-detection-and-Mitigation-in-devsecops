// Test script to verify scanners are working
const { exec } = require('child_process');
const { promisify } = require('util');
const execAsync = promisify(exec);

async function testScanner(name, command) {
  console.log(`\nTesting ${name}...`);
  try {
    const { stdout, stderr } = await execAsync(command, { timeout: 10000 });
    console.log(`✓ ${name} is working!`);
    if (stdout) console.log(`Output: ${stdout.substring(0, 200)}`);
    return true;
  } catch (error) {
    console.log(`✗ ${name} failed: ${error.message}`);
    return false;
  }
}

async function main() {
  console.log('=== Scanner Integration Test ===\n');
  
  const results = {
    gitleaks: await testScanner('Gitleaks', '"D:/Major Project/tools/gitleaks/gitleaks.exe" version'),
    semgrep: await testScanner('Semgrep', 'semgrep --version'),
    trivy: await testScanner('Trivy', 'trivy --version')
  };
  
  console.log('\n=== Results ===');
  console.log(`Gitleaks: ${results.gitleaks ? '✓ Working' : '✗ Not working'}`);
  console.log(`Semgrep: ${results.semgrep ? '✓ Working' : '✗ Not working'}`);
  console.log(`Trivy: ${results.trivy ? '✓ Working' : '✗ Not working'}`);
  
  const workingCount = Object.values(results).filter(Boolean).length;
  console.log(`\n${workingCount}/3 scanners are working`);
}

main();
