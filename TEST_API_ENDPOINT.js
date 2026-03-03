/**
 * Test the /api/commission/breakdown endpoint
 * This simulates what the frontend does
 */

const testAPI = async () => {
  try {
    console.log('🧪 Testing Commission Breakdown API Endpoint');
    console.log('═══════════════════════════════════════════════════════════════\n');
    
    // You need to get a valid token first
    console.log('⚠️  To test this properly, you need a valid JWT token.');
    console.log('');
    console.log('Steps to test:');
    console.log('1. Login to the frontend and get your token from localStorage');
    console.log('2. Replace TOKEN_HERE below with your actual token');
    console.log('3. Run this script with Node.js');
    console.log('');
    console.log('Or test directly with curl:');
    console.log('');
    console.log('curl -X GET "http://localhost:5000/api/commission/breakdown" \\');
    console.log('  -H "Authorization: Bearer YOUR_TOKEN_HERE" \\');
    console.log('  -H "Content-Type: application/json"');
    console.log('');
    console.log('Expected Response:');
    console.log(JSON.stringify({
      success: true,
      message: "Commission breakdown retrieved successfully",
      breakdown: {
        direct_bonus: 20.25,
        level_income: 0,
        binary_bonus: 0,
        reward_bonus: 0
      },
      period: {
        startDate: "2026-02-28T18:30:00.000Z",
        endDate: "2026-03-31T18:29:59.999Z"
      }
    }, null, 2));
    console.log('');
    console.log('═══════════════════════════════════════════════════════════════');
    console.log('');
    console.log('🔧 TROUBLESHOOTING STEPS:');
    console.log('');
    console.log('1. ✅ Verify backend server is running:');
    console.log('   cd pronext-backend');
    console.log('   npm start');
    console.log('');
    console.log('2. ✅ Check backend logs for API call:');
    console.log('   Look for: "Fetching commission breakdown"');
    console.log('');
    console.log('3. ✅ Verify frontend is calling correct URL:');
    console.log('   Open browser console (F12)');
    console.log('   Check Network tab for /commission/breakdown request');
    console.log('');
    console.log('4. ✅ Check frontend console logs:');
    console.log('   Look for: "💰 Commission Breakdown Response:"');
    console.log('');
    console.log('5. ✅ Verify .env.local in frontend has:');
    console.log('   VITE_API_URL=http://localhost:5000/api');
    console.log('');
    console.log('═══════════════════════════════════════════════════════════════');
    
  } catch (error) {
    console.error('❌ Error:', error.message);
  }
};

testAPI();
