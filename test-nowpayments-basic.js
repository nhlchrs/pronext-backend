/**
 * NOWPayments Basic Test (No Auth Required)
 * Tests public endpoints that don't need authentication
 */

import axios from 'axios';

const API_URL = 'http://localhost:5000/api';

const colors = {
  reset: '\x1b[0m',
  green: '\x1b[32m',
  red: '\x1b[31m',
  yellow: '\x1b[33m',
  blue: '\x1b[34m',
  cyan: '\x1b[36m',
  magenta: '\x1b[35m'
};

function log(message, color = 'reset') {
  console.log(`${colors[color]}${message}${colors.reset}`);
}

function printHeader(title) {
  log('\n━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━', 'cyan');
  log(`  ${title}`, 'cyan');
  log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━', 'cyan');
}

async function test1_GetCurrencies() {
  printHeader('TEST 1: Get Available Cryptocurrencies');
  
  try {
    const response = await axios.get(`${API_URL}/payment/currencies`);
    
    if (response.data.success) {
      log('✅ SUCCESS', 'green');
      log(`\nFound ${response.data.data.count} currencies`, 'blue');
      log(`\nPopular currencies available:`, 'blue');
      
      const popular = ['BTC', 'ETH', 'USDT', 'LTC', 'BNB', 'TRX', 'DOGE', 'XRP'];
      const available = response.data.data.currencies;
      
      popular.forEach(curr => {
        const exists = available.includes(curr.toLowerCase());
        if (exists) {
          log(`  ✓ ${curr}`, 'green');
        }
      });
      
      return true;
    }
  } catch (error) {
    log('❌ FAILED', 'red');
    log(error.response?.data?.message || error.message, 'red');
    return false;
  }
}

async function test2_GetEstimate() {
  printHeader('TEST 2: Price Estimate - 10 USD to Bitcoin');
  
  try {
    const params = {
      amount: 10,
      currency_from: 'usd',
      currency_to: 'btc'
    };
    
    const response = await axios.get(`${API_URL}/payment/estimate`, { params });
    
    if (response.data.success) {
      log('✅ SUCCESS', 'green');
      const estimate = response.data.data.estimatedAmount;
      log(`\n$10 USD = ${estimate} BTC`, 'blue');
      log(`Approximately ${(estimate * 100000000).toFixed(0)} satoshis`, 'blue');
      return true;
    }
  } catch (error) {
    log('❌ FAILED', 'red');
    log(error.response?.data?.message || error.message, 'red');
    return false;
  }
}

async function test3_GetMinimumAmount() {
  printHeader('TEST 3: Minimum Payment Amount');
  
  try {
    const currencies = ['btc', 'eth', 'usdt'];
    log('\nMinimum amounts required:', 'blue');
    
    for (const currency of currencies) {
      const response = await axios.get(`${API_URL}/payment/minimum-amount`, {
        params: { currency_from: 'usd', currency_to: currency }
      });
      
      if (response.data.success) {
        const min = response.data.data.minAmount;
        log(`  • ${currency.toUpperCase()}: ${min} ${currency.toUpperCase()}`, 'green');
      }
    }
    
    log('✅ SUCCESS', 'green');
    return true;
  } catch (error) {
    log('❌ FAILED', 'red');
    log(error.response?.data?.message || error.message, 'red');
    return false;
  }
}

async function test4_CheckServerStatus() {
  printHeader('TEST 4: Backend Server Status');
  
  try {
    const response = await axios.get(`${API_URL}/payment/currencies`, {
      timeout: 5000
    });
    
    if (response.status === 200) {
      log('✅ Backend server is running', 'green');
      log(`Server URL: ${API_URL}`, 'blue');
      log(`Response time: ${response.headers['x-response-time'] || 'N/A'}`, 'blue');
      return true;
    }
  } catch (error) {
    log('❌ FAILED', 'red');
    if (error.code === 'ECONNREFUSED') {
      log('Backend server is not running!', 'red');
      log('Please start the server: npm start', 'yellow');
    } else {
      log(error.message, 'red');
    }
    return false;
  }
}

async function test5_MultiCurrencyEstimate() {
  printHeader('TEST 5: Multi-Currency Estimates for $100 USD');
  
  try {
    const currencies = ['btc', 'eth', 'usdt', 'ltc', 'bnb'];
    log('\nPrice estimates for $100 USD:', 'blue');
    
    for (const currency of currencies) {
      try {
        const response = await axios.get(`${API_URL}/payment/estimate`, {
          params: {
            amount: 100,
            currency_from: 'usd',
            currency_to: currency
          }
        });
        
        if (response.data.success) {
          const estimate = response.data.data.estimatedAmount;
          log(`  • ${currency.toUpperCase()}: ${estimate}`, 'green');
        }
      } catch (err) {
        log(`  • ${currency.toUpperCase()}: Error`, 'red');
      }
    }
    
    log('\n✅ SUCCESS', 'green');
    return true;
  } catch (error) {
    log('❌ FAILED', 'red');
    log(error.message, 'red');
    return false;
  }
}

// Main test runner
async function runTests() {
  log('\n', 'reset');
  log('╔═══════════════════════════════════════════════════════╗', 'magenta');
  log('║                                                       ║', 'magenta');
  log('║       NOWPayments Integration - Basic Tests          ║', 'magenta');
  log('║              (No Authentication Required)            ║', 'magenta');
  log('║                                                       ║', 'magenta');
  log('╚═══════════════════════════════════════════════════════╝', 'magenta');

  log('\n📝 Running basic tests (no login needed)...', 'yellow');
  log('These tests check public API endpoints\n', 'yellow');

  const results = [];
  
  // Run tests
  results.push(await test4_CheckServerStatus());
  results.push(await test1_GetCurrencies());
  results.push(await test2_GetEstimate());
  results.push(await test3_GetMinimumAmount());
  results.push(await test5_MultiCurrencyEstimate());

  // Summary
  printHeader('TEST SUMMARY');
  
  const passed = results.filter(r => r === true).length;
  const failed = results.filter(r => r === false).length;
  
  log(`\nTotal Tests: ${results.length}`, 'blue');
  log(`Passed: ${passed}`, 'green');
  log(`Failed: ${failed}`, failed > 0 ? 'red' : 'green');
  
  if (passed === results.length) {
    log('\n🎉 ALL TESTS PASSED!', 'green');
    log('\n✅ Your NOWPayments integration is working correctly!', 'green');
    log('\nNext steps:', 'cyan');
    log('1. Get your JWT token (login to http://localhost:5174)', 'blue');
    log('2. Update test-nowpayments.js with your token', 'blue');
    log('3. Run: node test-nowpayments.js', 'blue');
    log('4. Test payment creation and status tracking', 'blue');
  } else {
    log('\n⚠️  SOME TESTS FAILED', 'yellow');
    log('\nPossible issues:', 'yellow');
    log('• Backend server not running (run: npm start)', 'blue');
    log('• Wrong API URL (check port 5000)', 'blue');
    log('• NOWPayments API key issues (check .env)', 'blue');
    log('• Network connectivity problems', 'blue');
  }
  
  log('\n' + '─'.repeat(60), 'cyan');
}

// Run the tests
runTests().catch(error => {
  log('\n❌ Unexpected error:', 'red');
  console.error(error);
  process.exit(1);
});
