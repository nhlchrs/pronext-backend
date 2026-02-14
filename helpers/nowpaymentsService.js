/**
 * NOWPayments Integration Service
 * Handles all NOWPayments API calls and payment processing
 */

import axios from "axios";
import logger from "./logger.js";

const nowLogger = logger.module("NOWPAYMENTS");

class NOWPaymentsService {
  constructor() {
    // Check if sandbox mode is enabled
    const isSandbox = process.env.NOWPAYMENTS_SANDBOX_MODE === 'true';
    this.baseUrl = isSandbox 
      ? "https://api-sandbox.nowpayments.io/v1"  // Sandbox API (test mode)
      : "https://api.nowpayments.io/v1";         // Production API (real money)
    this.isSandbox = isSandbox;
    this._apiKey = null;
    this._ipnSecret = null;
    this._initialized = false;
  }

  // Lazy load API keys on first use
  _ensureInitialized() {
    if (!this._initialized) {
      this._apiKey = process.env.NOWPAYMENTS_API_KEY || "";
      this._ipnSecret = process.env.NOWPAYMENTS_IPN_SECRET || "";
      this._initialized = true;
      
      if (!this._apiKey) {
        nowLogger.warn("NOWPayments API key not configured in environment variables");
      } else {
        const mode = this.isSandbox ? "🧪 SANDBOX (TEST)" : "🔴 PRODUCTION (LIVE)";
        nowLogger.success(`NOWPayments initialized in ${mode} mode`);
        nowLogger.info(`API Endpoint: ${this.baseUrl}`);
      }
    }
  }

  get apiKey() {
    this._ensureInitialized();
    return this._apiKey;
  }

  get ipnSecret() {
    this._ensureInitialized();
    return this._ipnSecret;
  }

  /**
   * Get available currencies
   * GET /v1/currencies
   */
  async getAvailableCurrencies() {
    try {
      nowLogger.start("Fetching available currencies from NOWPayments");
      
      const response = await axios.get(`${this.baseUrl}/currencies`, {
        headers: {
          "x-api-key": this.apiKey,
        },
      });

      nowLogger.success("Available currencies fetched", { count: response.data.length });
      return response.data;
    } catch (error) {
      nowLogger.error("Error fetching currencies", error.message);
      throw error;
    }
  }

  /**
   * Get estimated price
   * GET /v1/estimate?amount=100&currency_from=USD&currency_to=BTC
   */
  async getEstimatedPrice(amount, currencyFrom, currencyTo) {
    try {
      nowLogger.debug("Fetching price estimate", { amount, currencyFrom, currencyTo });
      
      const response = await axios.get(
        `${this.baseUrl}/estimate?amount=${amount}&currency_from=${currencyFrom}&currency_to=${currencyTo}`,
        {
          headers: {
            "x-api-key": this.apiKey,
          },
        }
      );

      nowLogger.success("Price estimate fetched", { estimatedAmount: response.data.estimated_amount });
      return response.data;
    } catch (error) {
      nowLogger.error("Error fetching price estimate", error.message);
      throw error;
    }
  }

  /**
   * Create a payment invoice
   * POST /v1/invoice
   * 
   * @param {Object} paymentData
   * @returns {Promise} Payment invoice data
   */
  async createPaymentInvoice(paymentData) {
    try {
      const {
        price_amount,
        price_currency,
        pay_currency,
        order_id,
        order_description,
        ipn_callback_url,
        success_url,
        cancel_url,
        customer_email,
      } = paymentData;

      nowLogger.start("Creating payment invoice", { orderId: order_id, amount: price_amount });

      // Prepare payload
      const payload = {
        price_amount,
        price_currency,
        pay_currency,
        order_id,
        order_description,
        ipn_callback_url,
        success_url,
        cancel_url,
        customer_email,
      };

      const response = await axios.post(`${this.baseUrl}/invoice`, payload, {
        headers: {
          "x-api-key": this.apiKey,
          "Content-Type": "application/json",
        },
      });

      nowLogger.success("Payment invoice created", {
        invoiceId: response.data.id,
        orderId: order_id,
        paymentUrl: response.data.invoice_url,
      });

      return response.data;
    } catch (error) {
      nowLogger.error("Error creating payment invoice", error.response?.data || error.message);
      throw error;
    }
  }

  /**
   * Get payment status by invoice ID
   * GET /v1/invoice/:id
   */
  async getInvoiceStatus(invoiceId) {
    try {
      nowLogger.debug("Fetching invoice status", { invoiceId });
      
      const response = await axios.get(`${this.baseUrl}/invoice/${invoiceId}`, {
        headers: {
          "x-api-key": this.apiKey,
        },
      });

      nowLogger.success("Invoice status fetched", {
        invoiceId,
        status: response.data.status,
      });

      return response.data;
    } catch (error) {
      nowLogger.error("Error fetching invoice status", error.message);
      throw error;
    }
  }

  /**
   * Create a payment order
   * POST /v1/payment
   * 
   * @param {Object} paymentData
   * @returns {Promise} Payment data with payment ID
   */
  async createPayment(paymentData) {
    try {
      const {
        price_amount,
        price_currency,
        pay_currency,
        order_id,
        order_description,
        ipn_callback_url,
        customer_email,
      } = paymentData;

      nowLogger.start("Creating payment order", { orderId: order_id, amount: price_amount });

      const payload = {
        price_amount,
        price_currency,
        pay_currency,
        order_id,
        order_description,
        ipn_callback_url,
        customer_email,
      };

      const response = await axios.post(`${this.baseUrl}/payment`, payload, {
        headers: {
          "x-api-key": this.apiKey,
          "Content-Type": "application/json",
        },
      });

      nowLogger.success("Payment order created", {
        paymentId: response.data.payment_id,
        orderId: order_id,
        payAddress: response.data.pay_address,
      });

      return response.data;
    } catch (error) {
      nowLogger.error("Error creating payment order", error.response?.data || error.message);
      throw error;
    }
  }

  /**
   * Get payment status by payment ID
   * GET /v1/payment/:id
   */
  async getPaymentStatus(paymentId) {
    try {
      nowLogger.debug("Fetching payment status", { paymentId });
      
      const response = await axios.get(`${this.baseUrl}/payment/${paymentId}`, {
        headers: {
          "x-api-key": this.apiKey,
        },
      });

      nowLogger.success("Payment status fetched", {
        paymentId,
        status: response.data.payment_status,
        receivedAmount: response.data.received_amount,
      });

      return response.data;
    } catch (error) {
      nowLogger.error("Error fetching payment status", error.message);
      throw error;
    }
  }

  /**
   * Get all payments (with pagination)
   * GET /v1/payments?limit=10&offset=0
   */
  async getAllPayments(limit = 10, offset = 0) {
    try {
      nowLogger.start("Fetching all payments", { limit, offset });
      
      const response = await axios.get(
        `${this.baseUrl}/payments?limit=${limit}&offset=${offset}`,
        {
          headers: {
            "x-api-key": this.apiKey,
          },
        }
      );

      nowLogger.success("Payments fetched", { count: response.data.data?.length });
      return response.data;
    } catch (error) {
      nowLogger.error("Error fetching payments", error.message);
      throw error;
    }
  }

  /**
   * Get minimum payment amount
   * GET /v1/min-amount?currency_from=USD&currency_to=BTC
   */
  async getMinimumAmount(currencyFrom, currencyTo) {
    try {
      nowLogger.debug("Fetching minimum amount", { currencyFrom, currencyTo });
      
      const response = await axios.get(
        `${this.baseUrl}/min-amount/${currencyFrom}/${currencyTo}`,
        {
          headers: {
            "x-api-key": this.apiKey,
          },
        }
      );

      nowLogger.success("Minimum amount fetched", { minAmount: response.data.min_amount });
      return response.data;
    } catch (error) {
      nowLogger.error("Error fetching minimum amount", error.message);
      throw error;
    }
  }

  /**
   * Verify IPN signature
   * Validates that the webhook callback is genuine from NOWPayments
   */
  verifyIPNSignature(data, signature) {
    try {
      nowLogger.debug("Verifying IPN signature");
      
      // Create hash from data
      const crypto = require("crypto");
      // If data is already a string (raw body), use it directly
      // Otherwise, stringify it (for backward compatibility)
      const dataString = typeof data === 'string' ? data : JSON.stringify(data);
      const hash = crypto
        .createHmac("sha512", this.ipnSecret)
        .update(dataString)
        .digest("hex");

      const isValid = hash === signature;
      
      if (isValid) {
        nowLogger.success("IPN signature verified");
      } else {
        nowLogger.warn("IPN signature verification failed", {
          expectedHash: hash.substring(0, 20) + "...",
          receivedSignature: signature.substring(0, 20) + "...",
        });
      }
      
      return isValid;
    } catch (error) {
      nowLogger.error("Error verifying IPN signature", error.message);
      return false;
    }
  }

  /**
   * Get payment by order ID
   * GET /v1/payment?order_id=YOUR_ORDER_ID
   */
  async getPaymentByOrderId(orderId) {
    try {
      nowLogger.debug("Fetching payment by order ID", { orderId });
      
      const response = await axios.get(`${this.baseUrl}/payment?order_id=${orderId}`, {
        headers: {
          "x-api-key": this.apiKey,
        },
      });

      nowLogger.success("Payment fetched by order ID", { orderId, paymentId: response.data.payment_id });
      return response.data;
    } catch (error) {
      nowLogger.error("Error fetching payment by order ID", error.message);
      throw error;
    }
  }

  /**
   * Get exchange rate
   * GET /v1/exchange-rate/:from/:to
   */
  async getExchangeRate(from, to) {
    try {
      nowLogger.debug("Fetching exchange rate", { from, to });
      
      const response = await axios.get(`${this.baseUrl}/exchange-rate/${from}/${to}`, {
        headers: {
          "x-api-key": this.apiKey,
        },
      });

      nowLogger.success("Exchange rate fetched", { 
        from, 
        to, 
        rate: response.data.estimated_rate 
      });

      return response.data;
    } catch (error) {
      nowLogger.error("Error fetching exchange rate", error.message);
      throw error;
    }
  }

  /**
   * Create a payout (withdrawal) to user's crypto wallet
   * POST /v1/payout
   * @param {object} payoutData - Payout details
   * @returns {Promise<object>} - Payout response with id and status
   */
  async createPayout(payoutData) {
    try {
      const { address, currency, amount, ipn_callback_url } = payoutData;
      
      nowLogger.debug("Creating payout", { address: address?.substring(0, 10) + '...', currency, amount });
      
      const response = await axios.post(
        `${this.baseUrl}/payout`,
        {
          withdrawals: [{
            address,
            currency,
            amount,
            ipn_callback_url
          }]
        },
        {
          headers: {
            "x-api-key": this.apiKey,
            "Content-Type": "application/json",
          },
        }
      );

      nowLogger.success("Payout created successfully", { 
        payoutId: response.data.id,
        batchWithdrawalId: response.data.withdrawals?.[0]?.batch_withdrawal_id
      });
      
      return response.data;
    } catch (error) {
      nowLogger.error("Error creating payout", {
        message: error.message,
        response: error.response?.data
      });
      throw error;
    }
  }

  /**
   * Get payout status
   * GET /v1/payout/:id
   * @param {string} payoutId - Payout ID
   * @returns {Promise<object>} - Payout status details
   */
  async getPayoutStatus(payoutId) {
    try {
      nowLogger.debug("Fetching payout status", { payoutId });
      
      const response = await axios.get(
        `${this.baseUrl}/payout/${payoutId}`,
        {
          headers: {
            "x-api-key": this.apiKey,
          },
        }
      );

      nowLogger.success("Payout status fetched", { 
        payoutId,
        status: response.data.status 
      });
      
      return response.data;
    } catch (error) {
      nowLogger.error("Error fetching payout status", error.message);
      throw error;
    }
  }
}

// Export singleton instance
export default new NOWPaymentsService();
