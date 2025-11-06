// Verify UI content and data display
import { config } from 'dotenv';
import { fileURLToPath } from 'node:url';
import { dirname, join } from 'node:path';

// Load .env file
const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);
config({ path: join(__dirname, '.env') });

console.log('🔍 MEXC Sniper Bot UI Verification');
console.log('=====================================');

function checkIndicators(content, indicators, label) {
  console.log(`\n${label}`);
  let found = 0;
  for (const indicator of indicators) {
    const exists = content.includes(indicator);
    if (exists) {
      found += 1;
    }
    console.log(`   ${exists ? '✅' : '❌'} ${indicator}`);
  }
  return found;
}

function analyzeContent(dashboardResponse) {
  // Check for React app indicators
  const hasReact = dashboardResponse.content.includes('react') || 
                  dashboardResponse.content.includes('next') ||
                  dashboardResponse.content.includes('__next');
  console.log('⚛️  React/Next.js detected:', hasReact ? '✅ Yes' : '❌ No');
  
  // Check for 404 errors
  const has404 = dashboardResponse.content.includes('404') || 
                dashboardResponse.content.includes('not found');
  console.log('🚫 404 Error detected:', has404 ? '❌ Yes' : '✅ No');
  
  return { hasReact, has404 };
}

async function verifyUI() {
  try {
    // Test main page
    console.log('\n📱 Testing Main Page...');
    const homeResponse = await fetchPageContent('http://localhost:3001/');
    console.log('✅ Home page accessible:', homeResponse.title);
    console.log('📊 Home page content length:', homeResponse.content.length, 'characters');
    
    // Test dashboard page
    console.log('\n📊 Testing Dashboard Page...');
    const dashboardResponse = await fetchPageContent('http://localhost:3001/dashboard');
    console.log('✅ Dashboard accessible:', dashboardResponse.title);
    console.log('📊 Dashboard content length:', dashboardResponse.content.length, 'characters');
    
    // Analyze content
    const { hasReact, has404 } = analyzeContent(dashboardResponse);
    
    // Check for mock data indicators
    const mockDataIndicators = [
      'mockStats',
      'mockRecentActivity', 
      'totalTrades: 247',
      'successRate: 94.2',
      'PEPEUSDT',
      'BTCUSDT'
    ];
    
    const mockDataFound = checkIndicators(
      dashboardResponse.content, 
      mockDataIndicators, 
      '🎭 Checking for Mock Data Display:'
    );
    
    console.log(`📈 Mock Data Score: ${mockDataFound}/${mockDataIndicators.length} indicators found`);
    
    // Check for real data integration points
    const realDataIndicators = [
      'fetchDashboardData',
      'api/trpc/',
      'useQuery',
      'trpc',
      'real-time',
      'live data'
    ];
    
    const realDataFound = checkIndicators(
      dashboardResponse.content, 
      realDataIndicators, 
      '🔗 Checking for Real Data Integration:'
    );
    
    console.log(`🔗 Real Data Integration Score: ${realDataFound}/${realDataIndicators.length} indicators found`);
    
    // Summary
    console.log('\n📋 VERIFICATION SUMMARY:');
    console.log('========================');
    console.log(`🏠 Home Page: ${homeResponse.title} ✅`);
    console.log(`📊 Dashboard: ${dashboardResponse.title} ${has404 ? '❌ (404 Error)' : '✅'}`);
    console.log(`⚛️  Framework: React/Next.js ${hasReact ? '✅' : '❌'}`);
    console.log(`🎭 Mock Data: ${mockDataFound > 0 ? '✅ Detected' : '❌ Not found'}`);
    console.log(`🔗 Real Data Integration: ${realDataFound > 0 ? '✅ Partial' : '❌ Missing'}`);
    
    // Test API endpoints
    console.log('\n🌐 Testing API Endpoints...');
    await testAPIEndpoints();
    
  } catch (error) {
    console.error('❌ Verification failed:', error);
  }
}

// Extract title regex - define at module level for performance
const titleRegex = /<title>([^<]*)<\/title>/;

async function fetchPageContent(url) {
  const response = await fetch(url);
  const content = await response.text();
  
  const titleMatch = content.match(titleRegex);
  const title = titleMatch ? titleMatch[1] : 'No title found';
  
  return { title, content };
}

async function testAPIEndpoints() {
  try {
    // Test health check endpoint
    console.log('   🔍 Testing health check...');
    const healthResponse = await fetch('http://localhost:3001/api/trpc/healthCheck', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ "0": { "json": null } })
    });
    
    if (healthResponse.ok) {
      const healthData = await healthResponse.text();
      console.log('   ✅ Health check:', healthData.includes('healthy') ? 'Working' : 'Issues detected');
    } else {
      console.log('   ❌ Health check failed:', healthResponse.status);
    }
    
    // Test MEXC API directly (as we verified earlier)
    console.log('   🔍 Testing MEXC API connectivity...');
    const mexcResponse = await fetch('https://api.mexc.com/api/v3/time');
    if (mexcResponse.ok) {
      const mexcData = await mexcResponse.json();
      console.log('   ✅ MEXC API: Connected (Server time:', mexcData.serverTime, ')');
    } else {
      console.log('   ❌ MEXC API failed:', mexcResponse.status);
    }
    
  } catch (error) {
    console.log('   ❌ API testing failed:', error.message);
  }
}

verifyUI().then(() => {
  console.log('\n✅ UI verification completed');
}).catch(console.error);
