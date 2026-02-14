/**
 * Check NOWPayments Available Currencies and Minimums
 * Run with: node check-nowpayments-minimums.js
 */

import axios from "axios";
import dotenv from "dotenv";

dotenv.config();

const API_KEY = process.env.NOWPAYMENTS_API_KEY;
const IS_SANDBOX = process.env.NOWPAYMENTS_SANDBOX_MODE === 'true';
const BASE_URL = IS_SANDBOX 
  ? "https://api-sandbox.nowpayments.io/v1"
  : "https://api.nowpayments.io/v1";

console.log("\n╔══════════════════════════════════════════════════════╗");
console.log("║   🔍 NOWPayments Currency & Minimum Check           ║");
console.log("╚══════════════════════════════════════════════════════╝\n");

console.log(`🌐 Mode: ${IS_SANDBOX ? '🧪 SANDBOX' : '🔴 PRODUCTION'}`);
console.log(`🔗 API: ${BASE_URL}`);
console.log(`🔑 API Key: ${API_KEY ? API_KEY.substring(0, 10) + '...' : 'NOT SET'}\n`);

async function checkCurrencies() {
  try {
    console.log("📋 Step 1: Fetching available currencies...\n");
    
    const response = await axios.get(`${BASE_URL}/currencies`, {
      headers: {
        "x-api-key": API_KEY
      }
    });
    
    const currencies = response.data.currencies || response.data;
    console.log(`✅ Found ${currencies.length} currencies\n`);
    
    // Check for USDT variants
    const usdtVariants = currencies.filter(c => c.toLowerCase().includes('usdt'));
    console.log("💵 USDT Variants Available:");
    usdtVariants.forEach(c => console.log(`   • ${c}`));
    
    return currencies;
  } catch (error) {
    console.error("❌ Error fetching currencies:", error.response?.data || error.message);
    return [];
  }
}

async function checkMinimums() {
  try {
    console.log("\n💰 Step 2: Checking minimum amounts for USDT...\n");
    
    const testCurrencies = ['usdt', 'usdterc20', 'usdttrc20', 'usdtbsc'];
    
    for (const currency of testCurrencies) {
      try {
        const response = await axios.get(
          `${BASE_URL}/min-amount?currency_from=usd&currency_to=${currency}`,
          {
            headers: {
              "x-api-key": API_KEY
            }
          }
        );
        
        const minAmount = response.data.min_amount;
        console.log(`   ${currency.toUpperCase().padEnd(12)} - Minimum: $${minAmount}`);
      } catch (error) {
        console.log(`   ${currency.toUpperCase().padEnd(12)} - ❌ ${error.response?.data?.message || 'Not available'}`);
      }
    }
  } catch (error) {
    console.error("❌ Error checking minimums:", error.response?.data || error.message);
  }
}

async function testEstimate() {
  try {
    console.log("\n🧮 Step 3: Testing $3 USD → USDT estimate...\n");
    
    const response = await axios.post(
      `${BASE_URL}/estimate`,
      {
        amount: 3,
        currency_from: 'usd',
        currency_to: 'usdt'
      },
      {
        headers: {
          "x-api-key": API_KEY,
          "Content-Type": "application/json"
        }
      }
    );
    
    console.log("✅ Estimate successful:");
    console.log(`   $3 USD = ${response.data.estimated_amount} USDT`);
    console.log(`   Currency: ${response.data.currency_to}`);
  } catch (error) {
    console.error("❌ Estimate failed:", error.response?.data || error.message);
  }
}

async function testInvoiceCreation() {
  try {
    console.log("\n📝 Step 4: Testing invoice creation with $10 USDT...\n");
    console.log("   (Using $10 to ensure we're above any minimums)\n");
    
    const testPayload = {
      price_amount: 10,
      price_currency: 'USD',
      pay_currency: 'USDT',
      order_id: `test_${Date.now()}`,
      order_description: 'Test invoice creation',
      ipn_callback_url: 'https://example.com/webhook'
    };
    
    console.log("   Payload:", JSON.stringify(testPayload, null, 2));
    
    const response = await axios.post(
      `${BASE_URL}/invoice`,
      testPayload,
      {
        headers: {
          "x-api-key": API_KEY,
          "Content-Type": "application/json"
        }
      }
    );
    
    console.log("\n✅ Invoice created successfully!");
    console.log(`   Invoice ID: ${response.data.id}`);
    console.log(`   Pay Amount: ${response.data.pay_amount} ${response.data.pay_currency}`);
    console.log(`   Payment URL: ${response.data.invoice_url}`);
  } catch (error) {
    console.error("\n❌ Invoice creation failed:");
    console.error("   Error:", error.response?.data || error.message);
  }
}

// Run all checks
async function runAllChecks() {
  if (!API_KEY) {
    console.error("❌ ERROR: NOWPAYMENTS_API_KEY not found in .env file!\n");
    return;
  }
  
  await checkCurrencies();
  await checkMinimums();
  await testEstimate();
  await testInvoiceCreation();
  
  console.log("\n" + "=".repeat(60));
  console.log("✅ Diagnostic complete!");
  console.log("=".repeat(60));
  console.log("\n💡 Recommendations:");
  console.log("   • If USDT minimum is > $3, increase test plan price");
  console.log("   • Try different USDT variants (TRC20, ERC20, BSC)");
  console.log("   • Check if API key supports all currencies");
  console.log("   • Contact NOWPayments support if issues persist\n");
}

runAllChecks().catch(console.error);
