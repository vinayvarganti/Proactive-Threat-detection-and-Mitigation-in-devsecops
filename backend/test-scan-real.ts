// Test real scanning functionality
import 'dotenv/config';
import * as path from 'path';
import { ScanOrchestrator } from './src/services/ScanOrchestrator';

async function testScan() {
  console.log('=== Testing Real Scanner Integration ===\n');
  console.log('Environment:');
  console.log(`MOCK_SCANNERS: ${process.env.MOCK_SCANNERS}`);
  console.log(`GITLEAKS_PATH: ${process.env.GITLEAKS_PATH}`);
  console.log(`SEMGREP_PATH: ${process.env.SEMGREP_PATH}\n`);
  
  // Test scanning the backend directory
  const testPath = path.resolve(__dirname, 'src');
  console.log(`Scanning directory: ${testPath}\n`);
  
  const orchestrator = new ScanOrchestrator();
  
  try {
    const report = await orchestrator.scanRepository(testPath);
    
    console.log('=== Scan Results ===');
    console.log(`Total vulnerabilities found: ${report.summary.total}`);
    console.log(`Scan duration: ${report.scanDuration}ms\n`);
    
    console.log('Scanner Results:');
    console.log(`  Semgrep: ${report.scannerResults.semgrep.success ? '✓' : '✗'} (${report.scannerResults.semgrep.count} findings)`);
    console.log(`  Trivy: ${report.scannerResults.trivy.success ? '✓' : '✗'} (${report.scannerResults.trivy.count} findings)`);
    console.log(`  Gitleaks: ${report.scannerResults.gitleaks.success ? '✓' : '✗'} (${report.scannerResults.gitleaks.count} findings)`);
    
    if (report.scannerResults.semgrep.error) console.log(`  Semgrep error: ${report.scannerResults.semgrep.error}`);
    if (report.scannerResults.trivy.error) console.log(`  Trivy error: ${report.scannerResults.trivy.error}`);
    if (report.scannerResults.gitleaks.error) console.log(`  Gitleaks error: ${report.scannerResults.gitleaks.error}`);
    
    console.log('\nSeverity breakdown:');
    console.log(`  Critical: ${report.summary.bySeverity.critical}`);
    console.log(`  High: ${report.summary.bySeverity.high}`);
    console.log(`  Medium: ${report.summary.bySeverity.medium}`);
    console.log(`  Low: ${report.summary.bySeverity.low}`);
    
    if (report.vulnerabilities.length > 0) {
      console.log('\nSample vulnerabilities:');
      report.vulnerabilities.slice(0, 3).forEach((vuln, i) => {
        console.log(`\n${i + 1}. ${vuln.title}`);
        console.log(`   Scanner: ${vuln.scanner}`);
        console.log(`   Severity: ${vuln.severity}`);
        console.log(`   File: ${vuln.filePath}:${vuln.lineNumber}`);
      });
    }
    
  } catch (error) {
    console.error('Scan failed:', error);
  }
}

testScan();
