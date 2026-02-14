/**
 * Webhook Testing Helper
 * Use this to test webhook implementation without waiting for real NOWPayments callbacks
 * 
 * Run with: node helpers/webhookTestHelper.js
 */

import axios from "axios";
import crypto from "crypto";
import dotenv from "dotenv";

// Load environment variables
dotenv.config();

// Configuration
const SERVER_URL = process.env.SERVER_URL || "http://localhost:5000";
const IPN_SECRET = process.env.NOWPAYMENTS_IPN_SECRET || "test_secret";

// Test scenarios
const testScenarios = {
  successfulPayment: {
    name: "✅ Successful Payment (Premium Tier)",
    payload: {
      order_id: `subscription_test_premium_${Date.now()}`,
      payment_id: `payment_test_${Date.now()}`,
      payment_status: "finished",
      price_amount: 15,
      price_currency: "USD",
      pay_currency: "USDT",
      outcome_at: new Date().toISOString(),
      invoice_id: `inv_test_${Date.now()}`,
      purchase_id: `purchase_test_${Date.now()}`,
    },
  },
  basicTierPayment: {
    name: "💎 Basic Tier Payment (5 USDT)",
    payload: {
      order_id: `subscription_test_basic_${Date.now()}`,
      payment_id: `payment_test_${Date.now()}`,
      payment_status: "finished",
      price_amount: 5,
      price_currency: "USD",
      pay_currency: "USDT",
      outcome_at: new Date().toISOString(),
    },
  },
  proTierPayment: {
    name: "👑 Pro Tier Payment (30 USDT)",
    payload: {
      order_id: `subscription_test_pro_${Date.now()}`,
      payment_id: `payment_test_${Date.now()}`,
      payment_status: "finished",
      price_amount: 30,
      price_currency: "USD",
      pay_currency: "USDT",
      outcome_at: new Date().toISOString(),
    },
  },
  failedPayment: {
    name: "❌ Failed Payment",
    payload: {
      order_id: `subscription_test_failed_${Date.now()}`,
      payment_id: `payment_test_${Date.now()}`,
      payment_status: "failed",
      price_amount: 15,
      price_currency: "USD",
      pay_currency: "USDT",
      outcome_at: new Date().toISOString(),
    },
  },
  expiredPayment: {
    name: "⏱️ Expired Payment",
    payload: {
      order_id: `subscription_test_expired_${Date.now()}`,
      payment_id: `payment_test_${Date.now()}`,
      payment_status: "expired",
      price_amount: 15,
      price_currency: "USD",
      pay_currency: "USDT",
      outcome_at: new Date().toISOString(),
    },
  },
  confirmingPayment: {
    name: "⏳ Confirming Payment (Not Activated)",
    payload: {
      order_id: `subscription_test_confirming_${Date.now()}`,
      payment_id: `payment_test_${Date.now()}`,
      payment_status: "confirming",
      price_amount: 15,
      price_currency: "USD",
      pay_currency: "USDT",
      outcome_at: new Date().toISOString(),
    },
  },
};

/**
 * Generate HMAC-SHA512 signature
 */
function generateSignature(payload, secret) {
  const dataString = JSON.stringify(payload);
  const signature = crypto
    .createHmac("sha512", secret)
    .update(dataString)
    .digest("hex");
  return signature;
}

/**
 * Send test webhook
 */
async function sendTestWebhook(scenarioName, payload, secret) {
  try {
    const signature = generateSignature(payload, secret);

    console.log("\n" + "=".repeat(70));
    console.log(`📤 Sending Test Webhook: ${scenarioName}`);
    console.log("=".repeat(70));
    console.log("\n📋 Payload:");
    console.log(JSON.stringify(payload, null, 2));
    console.log("\n🔐 Signature:", signature.substring(0, 20) + "...");

    const response = await axios.post(
      `${SERVER_URL}/api/payments/webhook`,
      payload,
      {
        headers: {
          "Content-Type": "application/json",
          "X-Signature": signature,
        },
      }
    );

    console.log("\n✅ Success Response:");
    console.log("Status:", response.status);
    console.log("Data:", response.data);
    return true;
  } catch (error) {
    console.log("\n❌ Error Response:");
    if (error.response) {
      console.log("Status:", error.response.status);
      console.log("Data:", error.response.data);
    } else {
      console.log("Error:", error.message);
    }
    return false;
  }
}

/**
 * Run all tests
 */
async function runAllTests() {
  console.log("\n");
  console.log("╔══════════════════════════════════════════════════════════════════╗");
  console.log("║          🔔 WEBHOOK TESTING HELPER - ProNet Payments             ║");
  console.log("╚══════════════════════════════════════════════════════════════════╝");

  console.log(`\n🎯 Server: ${SERVER_URL}`);
  console.log(`🔑 IPN Secret: ${IPN_SECRET.substring(0, 10)}...`);

  // Test signature verification first
  console.log("\n\n1️⃣  Testing Signature Verification...");
  const testPayload = { test: "data" };
  const validSignature = generateSignature(testPayload, IPN_SECRET);
  const invalidSignature = "invalid_signature_12345";

  try {
    // Test with invalid signature
    console.log("   Testing with invalid signature...");
    try {
      await axios.post(`${SERVER_URL}/api/payments/webhook`, testPayload, {
        headers: {
          "X-Signature": invalidSignature,
        },
      });
      console.log("   ⚠️  Server accepted invalid signature (SECURITY ISSUE!)");
    } catch (error) {
      if (error.response?.status === 401) {
        console.log("   ✅ Server rejected invalid signature (Good!)");
      }
    }

    // Test with valid signature
    console.log("   Testing with valid signature...");
    const response = await axios.post(
      `${SERVER_URL}/api/payments/webhook`,
      testPayload,
      {
        headers: {
          "X-Signature": validSignature,
        },
      }
    );
    console.log("   ✅ Server accepted valid signature");
  } catch (error) {
    console.log("   ❌ Error:", error.message);
  }

  // Run test scenarios
  console.log("\n\n2️⃣  Running Test Scenarios...");
  let passed = 0;
  let failed = 0;

  for (const [key, scenario] of Object.entries(testScenarios)) {
    const success = await sendTestWebhook(
      scenario.name,
      scenario.payload,
      IPN_SECRET
    );
    if (success) passed++;
    else failed++;

    // Small delay between requests
    await new Promise((resolve) => setTimeout(resolve, 500));
  }

  // Summary
  console.log("\n" + "=".repeat(70));
  console.log("📊 TEST SUMMARY");
  console.log("=".repeat(70));
  console.log(`✅ Passed: ${passed}`);
  console.log(`❌ Failed: ${failed}`);
  console.log(`📈 Total: ${passed + failed}`);
  console.log("=".repeat(70));

  if (failed === 0) {
    console.log("\n🎉 All tests passed! Webhooks are working correctly.");
  } else {
    console.log(
      "\n⚠️  Some tests failed. Check server logs and webhook configuration."
    );
  }
}

/**
 * Run single test scenario
 */
async function runSingleTest(scenarioKey) {
  const scenario = testScenarios[scenarioKey];
  if (!scenario) {
    console.log(`❌ Unknown scenario: ${scenarioKey}`);
    console.log(
      "Available scenarios:",
      Object.keys(testScenarios).join(", ")
    );
    return;
  }

  await sendTestWebhook(scenario.name, scenario.payload, IPN_SECRET);
}

// Main execution
const args = process.argv.slice(2);
const scenario = args[0];

if (scenario === "--all" || !scenario) {
  runAllTests();
} else {
  runSingleTest(scenario);
}

// Export for use in other modules
export { generateSignature, sendTestWebhook, testScenarios };
