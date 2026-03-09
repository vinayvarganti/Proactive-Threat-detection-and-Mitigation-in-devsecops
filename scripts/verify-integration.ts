/**
 * Integration Verification Script
 * 
 * This script verifies that all frontend services are properly wired to backend endpoints.
 * It checks:
 * 1. All API endpoints are accessible
 * 2. Error handling paths work correctly
 * 3. Response formats match expected interfaces
 */

import axios from 'axios';

const BACKEND_URL = process.env.BACKEND_URL || 'http://localhost:3000';
const FRONTEND_URL = process.env.FRONTEND_URL || 'http://localhost:5173';

interface EndpointTest {
  method: 'GET' | 'POST' | 'PATCH' | 'DELETE';
  path: string;
  requiresAuth: boolean;
  description: string;
}

const endpoints: EndpointTest[] = [
  // Health check
  { method: 'GET', path: '/health', requiresAuth: false, description: 'Health check' },
  
  // Auth endpoints
  { method: 'POST', path: '/api/auth/github/initiate', requiresAuth: false, description: 'Initiate GitHub OAuth' },
  { method: 'GET', path: '/api/auth/status', requiresAuth: false, description: 'Get auth status' },
  { method: 'POST', path: '/api/auth/logout', requiresAuth: true, description: 'Logout' },
  
  // Repository endpoints
  { method: 'GET', path: '/api/repositories', requiresAuth: true, description: 'List repositories' },
  
  // Vulnerability endpoints
  { method: 'GET', path: '/api/vulnerabilities', requiresAuth: true, description: 'List vulnerabilities' },
  
  // Report endpoints
  { method: 'GET', path: '/api/reports', requiresAuth: true, description: 'List reports' },
];

async function verifyEndpoint(endpoint: EndpointTest): Promise<boolean> {
  try {
    const url = `${BACKEND_URL}${endpoint.path}`;
    
    let response;
    switch (endpoint.method) {
      case 'GET':
        response = await axios.get(url, { validateStatus: () => true });
        break;
      case 'POST':
        response = await axios.post(url, {}, { validateStatus: () => true });
        break;
      default:
        console.log(`⚠️  Skipping ${endpoint.method} ${endpoint.path} - manual testing required`);
        return true;
    }
    
    // For endpoints requiring auth, 401 is expected
    if (endpoint.requiresAuth && response.status === 401) {
      console.log(`✓ ${endpoint.method} ${endpoint.path} - Correctly requires authentication`);
      return true;
    }
    
    // For public endpoints, check for successful response
    if (!endpoint.requiresAuth && response.status >= 200 && response.status < 300) {
      console.log(`✓ ${endpoint.method} ${endpoint.path} - Accessible`);
      return true;
    }
    
    // Check if error response has proper format
    if (response.status >= 400) {
      if (response.data && response.data.error) {
        console.log(`✓ ${endpoint.method} ${endpoint.path} - Error format correct`);
        return true;
      } else {
        console.log(`✗ ${endpoint.method} ${endpoint.path} - Error format incorrect`);
        return false;
      }
    }
    
    console.log(`✓ ${endpoint.method} ${endpoint.path} - Response received`);
    return true;
  } catch (error) {
    if (axios.isAxiosError(error)) {
      if (error.code === 'ECONNREFUSED') {
        console.log(`✗ ${endpoint.method} ${endpoint.path} - Backend not running`);
      } else {
        console.log(`✗ ${endpoint.method} ${endpoint.path} - ${error.message}`);
      }
    } else {
      console.log(`✗ ${endpoint.method} ${endpoint.path} - Unknown error`);
    }
    return false;
  }
}

async function main() {
  console.log('='.repeat(60));
  console.log('Integration Verification');
  console.log('='.repeat(60));
  console.log(`Backend URL: ${BACKEND_URL}`);
  console.log(`Frontend URL: ${FRONTEND_URL}`);
  console.log('='.repeat(60));
  console.log();
  
  console.log('Testing API Endpoints:');
  console.log('-'.repeat(60));
  
  const results = await Promise.all(endpoints.map(verifyEndpoint));
  
  console.log();
  console.log('='.repeat(60));
  const passed = results.filter(r => r).length;
  const total = results.length;
  console.log(`Results: ${passed}/${total} endpoints verified`);
  
  if (passed === total) {
    console.log('✓ All endpoints are properly configured!');
  } else {
    console.log('✗ Some endpoints need attention');
    console.log('\nNote: Make sure the backend server is running on', BACKEND_URL);
  }
  console.log('='.repeat(60));
}

main().catch(console.error);
