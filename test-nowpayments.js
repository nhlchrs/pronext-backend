/**
 * NOWPayments Quick Test Script
 * Run this to test your NOWPayments integration
 */

import axios from 'axios';

const API_URL = 'http://localhost:5000/api';

// REPLACE THIS with your actual JWT token after logging in
const TOKEN = 'YOUR_JWT_TOKEN_HERE';

const colors = {
  reset: '\x1b[0m',
  green: '\x1b[32m',
  red: '\x1b[31m',
  yellow: '\x1b[33m',
  blue: '\x1b[34m',
  cyan: '\x1b[36m'
};

function log(message, color = 'reset') {
  console.log(`${colors[color]}${message}${colors.reset}`);
}

async function test1_GetCurrencies() {
  log('\n━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━', 'cyan');
  log('TEST 1: Get Available Currencies', 'cyan');
  log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━', 'cyan');
  
  try {
    const response = await axios.get(`${API_URL}/payment/currencies`);
    
    if (response.data.success) {
      log('✅ SUCCESS', 'green');
      log(`Found ${response.data.data.count} currencies`, 'blue');
      log(`Sample currencies: ${response.data.data.currencies.slice(0, 10).join(', ')}`, 'blue');
      return true;
    }
  } catch (error) {
    log('❌ FAILED', 'red');
    log(error.response?.data?.message || error.message, 'red');
    return false;
  }
}

async function test2_GetEstimate() {
  log('\n━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━', 'cyan');
  log('TEST 2: Get Price Estimate (10 USD to BTC)', 'cyan');
  log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━', 'cyan');
  
  try {
    const response = await axios.post(`${API_URL}/payment/estimate`, {
      amount: 10,
      currency_from: 'usd',
      currency_to: 'btc'
    });
    
    if (response.data.success) {
      log('✅ SUCCESS', 'green');
      log(`10 USD = ${response.data.data.estimated_amount} BTC`, 'blue');
      return true;
    }
  } catch (error) {
    log('❌ FAILED', 'red');
    log(error.response?.data?.message || error.message, 'red');
    return false;
  }
}

async function test3_GetMinimumAmount() {
  log('\n━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━', 'cyan');
  log('TEST 3: Get Minimum Payment Amount', 'cyan');
  log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━', 'cyan');
  
  try {
    const response = await axios.get(`${API_URL}/payment/minimum-amount?from=usd&to=btc`);
    
    if (response.data.success) {
      log('✅ SUCCESS', 'green');
      log(`Minimum amount: ${response.data.data.min_amount} BTC`, 'blue');
      return true;
    }
  } catch (error) {
    log('❌ FAILED', 'red');
    log(error.response?.data?.message || error.message, 'red');
    return false;
  }
}

async function test4_CreateInvoice() {
  log('\n━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━', 'cyan');
  log('TEST 4: Create Payment Invoice', 'cyan');
  log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━', 'cyan');
  
  if (TOKEN === 'YOUR_JWT_TOKEN_HERE') {
    log('⚠️  SKIPPED: Please set your JWT token in the script', 'yellow');
    log('   1. Login to your app', 'yellow');
    log('   2. Get token from localStorage or API response', 'yellow');
    log('   3. Replace TOKEN variable at top of this file', 'yellow');
    return false;
  }
  
  try {
    const response = await axios.post(`${API_URL}/payment/create-invoice`, {
      price_amount: 10,
      price_currency: 'usd',
      pay_currency: 'btc',
      order_description: 'Test Payment from Script'
    }, {
      headers: { Authorization: `Bearer ${TOKEN}` }
    });
    
    if (response.data.success) {
      log('✅ SUCCESS', 'green');
      log('\n📋 PAYMENT DETAILS:', 'blue');
      log(`   Invoice ID: ${response.data.data.id}`, 'blue');
      log(`   Payment URL: ${response.data.data.invoice_url}`, 'blue');
      log(`   Pay Amount: ${response.data.data.pay_amount} ${response.data.data.pay_currency.toUpperCase()}`, 'blue');
      log(`   Pay Address: ${response.data.data.pay_address}`, 'blue');
      log(`   Status: ${response.data.data.payment_status}`, 'blue');
      
      log('\n💡 Next steps:', 'yellow');
      log(`   1. Open this URL in browser: ${response.data.data.invoice_url}`, 'yellow');
      log(`   2. Complete the payment`, 'yellow');
      log(`   3. Check status with: GET /api/payment/status/${response.data.data.id}`, 'yellow');
      
      return response.data.data.id;
    }
  } catch (error) {
    log('❌ FAILED', 'red');
    log(error.response?.data?.message || error.message, 'red');
    
    if (error.response?.status === 401) {
      log('\n⚠️  Authentication failed. Please check your JWT token.', 'yellow');
    }
    
    return false;
  }
}

async function test5_CheckStatus(paymentId) {
  if (!paymentId) {
    log('\n⚠️  TEST 5 SKIPPED: No payment ID from previous test', 'yellow');
    return false;
  }
  
  log('\n━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━', 'cyan');
  log('TEST 5: Check Payment Status', 'cyan');
  log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━', 'cyan');
  
  try {
    const response = await axios.get(`${API_URL}/payment/status/${paymentId}`, {
      headers: { Authorization: `Bearer ${TOKEN}` }
    });
    
    if (response.data.success) {
      log('✅ SUCCESS', 'green');
      log(`Status: ${response.data.data.payment_status}`, 'blue');
      log(`Created: ${response.data.data.created_at}`, 'blue');
      return true;
    }
  } catch (error) {
    log('❌ FAILED', 'red');
    log(error.response?.data?.message || error.message, 'red');
    return false;
  }
}

async function runAllTests() {
  log('\n╔══════════════════════════════════════════════╗', 'cyan');
  log('║   NOWPayments Integration Test Suite        ║', 'cyan');
  log('╚══════════════════════════════════════════════╝', 'cyan');
  
  log(`\n🔗 Testing API: ${API_URL}`, 'blue');
  log(`🔑 Token configured: ${TOKEN !== 'YOUR_JWT_TOKEN_HERE' ? 'Yes' : 'No'}`, 'blue');
  
  const results = [];
  
  // Test 1
  const test1Result = await test1_GetCurrencies();
  results.push({ name: 'Get Currencies', passed: test1Result });
  
  // Test 2
  const test2Result = await test2_GetEstimate();
  results.push({ name: 'Get Estimate', passed: test2Result });
  
  // Test 3
  const test3Result = await test3_GetMinimumAmount();
  results.push({ name: 'Get Minimum Amount', passed: test3Result });
  
  // Test 4
  const paymentId = await test4_CreateInvoice();
  results.push({ name: 'Create Invoice', passed: !!paymentId });
  
  // Wait a bit before checking status
  if (paymentId) {
    log('\n⏳ Waiting 2 seconds before checking status...', 'yellow');
    await new Promise(resolve => setTimeout(resolve, 2000));
  }
  
  // Test 5
  const test5Result = await test5_CheckStatus(paymentId);
  results.push({ name: 'Check Status', passed: test5Result });
  
  // Summary
  log('\n╔══════════════════════════════════════════════╗', 'cyan');
  log('║              TEST SUMMARY                    ║', 'cyan');
  log('╚══════════════════════════════════════════════╝', 'cyan');
  
  const passed = results.filter(r => r.passed).length;
  const total = results.length;
  
  results.forEach(result => {
    const icon = result.passed ? '✅' : '❌';
    const color = result.passed ? 'green' : 'red';
    log(`${icon} ${result.name}`, color);
  });
  
  log(`\n📊 Results: ${passed}/${total} tests passed`, passed === total ? 'green' : 'yellow');
  
  if (passed === total) {
    log('\n🎉 ALL TESTS PASSED! NOWPayments integration is working correctly!', 'green');
  } else {
    log('\n⚠️  Some tests failed. Check the errors above.', 'yellow');
  }
  
  log('\n💡 To complete full testing:', 'blue');
  log('   1. Update TOKEN variable with your JWT', 'blue');
  log('   2. Run this script again', 'blue');
  log('   3. Open the payment URL and complete a test payment', 'blue');
  log('   4. Verify webhook callback is received', 'blue');
}

// Run tests
runAllTests().catch(error => {
  log('\n❌ Fatal error:', 'red');
  console.error(error);
  process.exit(1);
});
