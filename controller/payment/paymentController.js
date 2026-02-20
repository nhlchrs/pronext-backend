/**
 * NOWPayments Controller
 * Handles all payment-related endpoints
 */

import nowpaymentsService from "../../helpers/nowpaymentsService.js";
import paymentModel from "../../models/paymentModel.js";
import userModel from "../../models/authModel.js";
import { generatePurchaseCommissions } from "../../helpers/commissionService.js";
import {
  ErrorResponse,
  successResponse,
  notFoundResponse,
  successResponseWithData,
} from "../../helpers/apiResponse.js";
import logger from "../../helpers/logger.js";

const paymentLogger = logger.module("PAYMENT_CONTROLLER");

/**
 * Get available cryptocurrencies and payment methods
 * GET /api/payments/currencies
 */
export const getAvailableCurrencies = async (req, res) => {
  try {
    paymentLogger.start("Fetching available currencies");

    const currencies = await nowpaymentsService.getAvailableCurrencies();

    paymentLogger.success("Currencies retrieved", { count: currencies.length });
    return successResponseWithData(res, currencies, "Available currencies retrieved successfully");
  } catch (error) {
    paymentLogger.error("Error fetching currencies", error);
    return ErrorResponse(res, "Failed to fetch available currencies", 500);
  }
};

/**
 * Get price estimate
 * POST /api/payments/estimate
 * Body: { amount: 100, currency_from: "USD", currency_to: "BTC" }
 */
export const getPriceEstimate = async (req, res) => {
  try {
    const { amount, currency_from, currency_to } = req.body;

    paymentLogger.start("Getting price estimate", {
      amount,
      from: currency_from,
      to: currency_to,
    });

    if (!amount || !currency_from || !currency_to) {
      paymentLogger.warn("Missing required fields for price estimate");
      return ErrorResponse(res, "Amount, currency_from, and currency_to are required");
    }

    const estimate = await nowpaymentsService.getEstimatedPrice(
      amount,
      currency_from,
      currency_to
    );

    paymentLogger.success("Price estimate calculated", {
      estimatedAmount: estimate.estimated_amount,
    });

    return successResponseWithData(res, estimate, "Price estimate calculated successfully");
  } catch (error) {
    paymentLogger.error("Error calculating price estimate", error);
    return ErrorResponse(res, "Failed to calculate price estimate", 500);
  }
};

/**
 * Create payment invoice
 * POST /api/payments/invoice
 * Body: {
 *   price_amount: 100,
 *   price_currency: "USD",
 *   pay_currency: "BTC",
 *   order_id: "order_123",
 *   order_description: "Product purchase",
 *   customer_email: "user@example.com"
 * }
 */
export const createPaymentInvoice = async (req, res) => {
  try {
    const {
      price_amount,
      price_currency,
      pay_currency,
      order_id,
      order_description,
      customer_email,
    } = req.body;

    paymentLogger.start("Creating payment invoice", { orderId: order_id });

    // Validation
    if (!price_amount || !price_currency || !pay_currency || !order_id) {
      paymentLogger.warn("Missing required fields for invoice creation");
      return ErrorResponse(res, "Missing required payment fields");
    }

    // Get user from request
    const userId = req.user?._id;
    const userEmail = customer_email || req.user?.email;

    // Prepare callback URLs
    const baseUrl = process.env.BASE_URL || "http://localhost:5000";
    const ipn_callback_url = `${baseUrl}/api/payments/webhook`;
    const success_url = `${baseUrl}/payment-success`;
    const cancel_url = `${baseUrl}/payment-cancel`;

    const paymentData = {
      price_amount,
      price_currency,
      pay_currency,
      order_id,
      order_description,
      ipn_callback_url,
      success_url,
      cancel_url,
      customer_email: userEmail,
    };

    // Create invoice on NOWPayments
    const invoice = await nowpaymentsService.createPaymentInvoice(paymentData);

    // Save payment record to database
    const paymentRecord = await new paymentModel({
      userId,
      invoiceId: invoice.id,
      orderId: order_id,
      amount: price_amount,
      currency: price_currency,
      payCurrency: pay_currency,
      description: order_description,
      status: "pending",
      provider: "nowpayments",
      invoiceUrl: invoice.invoice_url,
      metadata: {
        createdAt: new Date(),
        invoiceData: invoice,
      },
    }).save();

    paymentLogger.success("Payment invoice created and saved to database", {
      invoiceId: invoice.id,
      orderId: order_id,
    });

    return successResponseWithData(
      res,
      {
        invoiceId: invoice.id,
        orderId: order_id,
        paymentUrl: invoice.invoice_url,
        amount: price_amount,
        currency: price_currency,
      },
      "Payment invoice created successfully"
    );
  } catch (error) {
    paymentLogger.error("Error creating payment invoice", error);
    return ErrorResponse(res, "Failed to create payment invoice", 500);
  }
};

/**
 * Create payment order
 * POST /api/payments/order
 */
export const createPaymentOrder = async (req, res) => {
  try {
    const {
      price_amount,
      price_currency,
      pay_currency,
      order_id,
      order_description,
    } = req.body;

    paymentLogger.start("Creating payment order", { orderId: order_id });

    if (!price_amount || !price_currency || !pay_currency || !order_id) {
      return ErrorResponse(res, "Missing required payment fields");
    }

    const userId = req.user?._id;
    const ipn_callback_url = `${process.env.BASE_URL || "http://localhost:5000"}/api/payments/webhook`;

    const paymentData = {
      price_amount,
      price_currency,
      pay_currency,
      order_id,
      order_description,
      ipn_callback_url,
      customer_email: req.user?.email,
    };

    // Create payment on NOWPayments
    const payment = await nowpaymentsService.createPayment(paymentData);

    // Save payment record
    const paymentRecord = await new paymentModel({
      userId,
      paymentId: payment.payment_id,
      orderId: order_id,
      amount: price_amount,
      currency: price_currency,
      payCurrency: pay_currency,
      description: order_description,
      status: "pending",
      provider: "nowpayments",
      walletAddress: payment.pay_address,
      metadata: {
        createdAt: new Date(),
        paymentData: payment,
      },
    }).save();

    paymentLogger.success("Payment order created", {
      paymentId: payment.payment_id,
      walletAddress: payment.pay_address,
    });

    return successResponseWithData(
      res,
      {
        paymentId: payment.payment_id,
        orderId: order_id,
        walletAddress: payment.pay_address,
        amount: price_amount,
        currency: price_currency,
        payCurrency: pay_currency,
      },
      "Payment order created successfully"
    );
  } catch (error) {
    paymentLogger.error("Error creating payment order", error);
    return ErrorResponse(res, "Failed to create payment order", 500);
  }
};

/**
 * Get invoice status
 * GET /api/payments/invoice/:invoiceId
 */
export const getInvoiceStatus = async (req, res) => {
  try {
    const { invoiceId } = req.params;

    paymentLogger.debug("Fetching invoice status", { invoiceId });

    if (!invoiceId) {
      return ErrorResponse(res, "Invoice ID is required");
    }

    const invoice = await nowpaymentsService.getInvoiceStatus(invoiceId);

    // Update database record if exists
    const paymentRecord = await paymentModel.findOne({ invoiceId });
    if (paymentRecord) {
      paymentRecord.status = invoice.status;
      paymentRecord.lastChecked = new Date();
      await paymentRecord.save();
    }

    paymentLogger.success("Invoice status retrieved", { invoiceId, status: invoice.status });

    return successResponseWithData(res, invoice, "Invoice status retrieved successfully");
  } catch (error) {
    paymentLogger.error("Error fetching invoice status", error);
    return ErrorResponse(res, "Failed to fetch invoice status", 500);
  }
};

/**
 * Get payment status
 * GET /api/payments/status/:paymentId
 */
export const getPaymentStatus = async (req, res) => {
  try {
    const { paymentId } = req.params;

    paymentLogger.debug("Fetching payment status", { paymentId });

    if (!paymentId) {
      return ErrorResponse(res, "Payment ID is required");
    }

    const payment = await nowpaymentsService.getPaymentStatus(paymentId);

    // Update database record
    const paymentRecord = await paymentModel.findOne({ paymentId });
    if (paymentRecord) {
      paymentRecord.status = payment.payment_status;
      paymentRecord.receivedAmount = payment.received_amount;
      paymentRecord.receivedCurrency = payment.received_currency;
      paymentRecord.lastChecked = new Date();
      await paymentRecord.save();

      // If payment confirmed, update user subscription
      if (payment.payment_status === "finished") {
        await userModel.findByIdAndUpdate(paymentRecord.userId, {
          subscriptionStatus: true,
          subscriptionEndDate: new Date(Date.now() + 30 * 24 * 60 * 60 * 1000), // 30 days
        });
        paymentLogger.success("User subscription activated", { userId: paymentRecord.userId });
      }
    }

    paymentLogger.success("Payment status retrieved", {
      paymentId,
      status: payment.payment_status,
    });

    return successResponseWithData(res, payment, "Payment status retrieved successfully");
  } catch (error) {
    paymentLogger.error("Error fetching payment status", error);
    return ErrorResponse(res, "Failed to fetch payment status", 500);
  }
};

/**
 * Get all user payments
 * GET /api/payments/my-payments
 */
export const getUserPayments = async (req, res) => {
  try {
    const userId = req.user._id;
    const { page = 1, limit = 10 } = req.query;

    paymentLogger.start("Fetching user payments", { userId, page, limit });

    const skip = (page - 1) * limit;

    const payments = await paymentModel
      .find({ userId })
      .sort({ createdAt: -1 })
      .limit(limit * 1)
      .skip(skip);

    const total = await paymentModel.countDocuments({ userId });

    paymentLogger.success("User payments retrieved", {
      userId,
      count: payments.length,
      total,
    });

    return successResponseWithData(
      res,
      {
        payments,
        pagination: {
          total,
          page: parseInt(page),
          limit: parseInt(limit),
          pages: Math.ceil(total / limit),
        },
      },
      "User payments retrieved successfully"
    );
  } catch (error) {
    paymentLogger.error("Error fetching user payments", error);
    return ErrorResponse(res, "Failed to fetch payments", 500);
  }
};

/**
 * Webhook for NOWPayments IPN callbacks
 * POST /api/payments/webhook
 * Handles payment status updates and subscription activation
 */
export const handleIPNCallback = async (req, res) => {
  try {
    // Extract webhook payload
    const {
      order_id,
      payment_id,
      payment_status,
      price_amount,
      pay_currency,
      outcome_at,
      purchase_id,
      invoice_id,
    } = req.body;
    const signature = req.headers["x-signature"];

    paymentLogger.start("Received IPN webhook callback", {
      orderId: order_id,
      paymentId: payment_id,
      status: payment_status,
      amount: price_amount,
      currency: pay_currency,
    });

    // 🔐 Verify signature first (security check)
    // Use raw body if available, otherwise use parsed body
    const dataForSignature = req.rawBody || req.body;
    if (!signature || !nowpaymentsService.verifyIPNSignature(dataForSignature, signature)) {
      paymentLogger.warn("❌ Invalid IPN signature - rejecting webhook", {
        orderId: order_id,
        paymentId: payment_id,
        hasRawBody: !!req.rawBody,
      });
      return ErrorResponse(res, "Invalid signature", 401);
    }

    // Find payment record
    const paymentRecord = await paymentModel.findOne({
      $or: [
        { orderId: order_id },
        { paymentId: payment_id },
        { invoiceId: invoice_id },
      ],
    });

    if (!paymentRecord) {
      paymentLogger.warn("⚠️ Payment record not found for webhook", {
        orderId: order_id,
        paymentId: payment_id,
      });
      // Return 200 OK anyway (webhook might be retried)
      return successResponse(res, "Payment record not found in system");
    }

    // Update payment status
    paymentRecord.status = payment_status;
    paymentRecord.paymentId = payment_id || paymentRecord.paymentId;
    paymentRecord.lastUpdated = new Date(outcome_at || Date.now());
    await paymentRecord.save();

    paymentLogger.info("📝 Payment record updated", {
      userId: paymentRecord.userId,
      orderId: order_id,
      status: payment_status,
    });

    // ✅ PAYMENT SUCCESSFUL - Activate Subscription
    if (payment_status === "finished") {
      // Determine subscription tier based on amount paid
      let subscriptionTier = "Basic";
      let durationDays = 360; // Default 1 year
      const amount = price_amount || paymentRecord.priceAmount;

      if (amount >= 100) {
        subscriptionTier = "Enterprise";
        durationDays = 720; // 2 years
      } else if (amount >= 30) {
        subscriptionTier = "Pro";
        durationDays = 360; // 1 year
      } else if (amount >= 20) {
        subscriptionTier = "Test";
        durationDays = 7; // 7 days for testing
      } else if (amount >= 15) {
        subscriptionTier = "Premium";
        durationDays = 180; // 6 months
      } else if (amount >= 10) {
        subscriptionTier = "Basic";
        durationDays = 30; // 1 month
      } else {
        // Less than $10 - don't activate subscription
        paymentLogger.warn("Payment amount too low for subscription", {
          amount,
          orderId: order_id,
        });
        return successResponse(res, "Payment recorded but amount insufficient for subscription");
      }

      // Update user subscription
      const updatedUser = await userModel.findByIdAndUpdate(
        paymentRecord.userId,
        {
          subscriptionStatus: true,
          subscriptionTier: subscriptionTier,
          subscriptionExpiryDate: new Date(Date.now() + durationDays * 24 * 60 * 60 * 1000),
          lastPaymentDate: new Date(),
          subscriptionActivatedDate: new Date(),
        },
        { new: true }
      );

      paymentLogger.success("✅ SUBSCRIPTION ACTIVATED VIA WEBHOOK", {
        userId: paymentRecord.userId,
        email: updatedUser?.email,
        orderId: order_id,
        paymentId: payment_id,
        tier: subscriptionTier,
        durationDays: durationDays,
        amount: amount,
        currency: pay_currency,
        expiryDate: updatedUser?.subscriptionExpiryDate,
      });

      // Generate commissions for referrers and upline
      try {
        const commissions = await generatePurchaseCommissions(
          paymentRecord.userId,
          amount,
          paymentRecord._id
        );

        paymentLogger.success("💰 Commissions generated for purchase", {
          userId: paymentRecord.userId,
          commissionsCount: commissions.length,
          totalCommissions: commissions.reduce((sum, c) => sum + c.netAmount, 0),
        });
      } catch (commissionError) {
        paymentLogger.error("⚠️ Error generating commissions", commissionError);
        // Don't fail the webhook if commission generation fails
      }

      // Add PV to binary tree (94.5 PV per $135 subscription)
      try {
        const { addPVToLeg } = await import('../../helpers/binaryMatchingService.js');
        const TeamMember = (await import('../../models/teamModel.js')).default;
        
        const buyer = await TeamMember.findOne({ userId: paymentRecord.userId });
        if (buyer && buyer.sponsorId && buyer.position !== 'main') {
          const pvAmount = 94.5; // Standard PV for $135 package
          await addPVToLeg(buyer.sponsorId, buyer.position, pvAmount);
          
          paymentLogger.success("✅ PV added to binary tree", {
            sponsorId: buyer.sponsorId,
            position: buyer.position,
            pvAmount,
            userId: paymentRecord.userId
          });
        }
      } catch (pvError) {
        paymentLogger.error("⚠️ Error adding PV to binary tree", pvError);
        // Don't fail the webhook if PV addition fails
      }

      // TODO: Send email notification to user about subscription activation
      // notificationService.sendSubscriptionActivationEmail(updatedUser.email, subscriptionTier);
    }

    // ❌ PAYMENT FAILED
    if (payment_status === "failed") {
      paymentLogger.warn("❌ Payment failed via webhook", {
        orderId: order_id,
        paymentId: payment_id,
        userId: paymentRecord.userId,
      });
      // TODO: Send email notification to user about payment failure
      // notificationService.sendPaymentFailureEmail(paymentRecord.userId);
    }

    // ⏱️ PAYMENT EXPIRED
    if (payment_status === "expired") {
      paymentLogger.warn("⏱️ Payment expired via webhook", {
        orderId: order_id,
        paymentId: payment_id,
        userId: paymentRecord.userId,
      });
      // TODO: Send email notification to user about payment expiry
    }

    // Return 200 OK to acknowledge webhook was processed
    return successResponse(res, "Webhook processed successfully");
  } catch (error) {
    paymentLogger.error("❌ Error processing webhook", error);
    // Return 200 OK even on error (to prevent webhook retries)
    return successResponse(res, "Webhook received and queued for processing");
  }
};

/**
 * Get minimum payment amount
 * GET /api/payments/minimum-amount?from=USD&to=BTC
 */
export const getMinimumAmount = async (req, res) => {
  try {
    const { from = "USD", to = "BTC" } = req.query;

    paymentLogger.debug("Fetching minimum amount", { from, to });

    const minimumAmount = await nowpaymentsService.getMinimumAmount(from, to);

    return successResponseWithData(
      res,
      minimumAmount,
      "Minimum amount retrieved successfully"
    );
  } catch (error) {
    paymentLogger.error("Error fetching minimum amount", error);
    return ErrorResponse(res, "Failed to fetch minimum amount", 500);
  }
};

/**
 * Get exchange rate
 * GET /api/payments/exchange-rate?from=USD&to=BTC
 */
export const getExchangeRate = async (req, res) => {
  try {
    const { from = "USD", to = "BTC" } = req.query;

    paymentLogger.debug("Fetching exchange rate", { from, to });

    const exchangeRate = await nowpaymentsService.getExchangeRate(from, to);

    return successResponseWithData(res, exchangeRate, "Exchange rate retrieved successfully");
  } catch (error) {
    paymentLogger.error("Error fetching exchange rate", error);
    return ErrorResponse(res, "Failed to fetch exchange rate", 500);
  }
};

/**
 * Get payment by order ID
 * GET /api/payments/order/:orderId
 */
export const getPaymentByOrderId = async (req, res) => {
  try {
    const { orderId } = req.params;

    paymentLogger.debug("Fetching payment by order ID", { orderId });

    if (!orderId) {
      return ErrorResponse(res, "Order ID is required");
    }

    // First try to get from database
    let paymentRecord = await paymentModel.findOne({ orderId });

    if (paymentRecord) {
      return successResponseWithData(res, paymentRecord, "Payment found successfully");
    }

    // If not in database, fetch from NOWPayments API
    const payment = await nowpaymentsService.getPaymentByOrderId(orderId);

    paymentLogger.success("Payment retrieved by order ID", { orderId });

    return successResponseWithData(res, payment, "Payment retrieved successfully");
  } catch (error) {
    paymentLogger.error("Error fetching payment by order ID", error);
    return ErrorResponse(res, "Failed to fetch payment", 500);
  }
};

/**
 * Get admin dashboard - payment statistics
 * GET /api/payments/admin/statistics
 */
export const getPaymentStatistics = async (req, res) => {
  try {
    paymentLogger.start("Fetching payment statistics");

    const [
      totalPayments,
      totalAmount,
      completedPayments,
      pendingPayments,
      failedPayments,
      paymentsByProvider,
    ] = await Promise.all([
      paymentModel.countDocuments(),
      paymentModel.aggregate([
        {
          $group: {
            _id: null,
            total: { $sum: "$amount" },
          },
        },
      ]),
      paymentModel.countDocuments({ status: "finished" }),
      paymentModel.countDocuments({ status: "pending" }),
      paymentModel.countDocuments({ status: "failed" }),
      paymentModel.aggregate([
        {
          $group: {
            _id: "$provider",
            count: { $sum: 1 },
          },
        },
      ]),
    ]);

    const statistics = {
      totalPayments,
      totalAmount: totalAmount[0]?.total || 0,
      completedPayments,
      pendingPayments,
      failedPayments,
      paymentsByProvider: paymentsByProvider.reduce((acc, item) => {
        acc[item._id] = item.count;
        return acc;
      }, {}),
    };

    paymentLogger.success("Payment statistics retrieved", statistics);

    return successResponseWithData(
      res,
      statistics,
      "Payment statistics retrieved successfully"
    );
  } catch (error) {
    paymentLogger.error("Error fetching payment statistics", error);
    return ErrorResponse(res, "Failed to fetch statistics", 500);
  }
};

/**
 * Create subscription payment
 * POST /api/payments/subscribe
 * Body: {
 *   subscriptionTier: "Premium",  // Basic, Premium, Pro
 *   pay_currency: "USDT"  // USDT, BTC, ETH, etc.
 * }
 */
export const createSubscriptionPayment = async (req, res) => {
  try {
    const { planType, amount, currency = "usd", pay_currency = "btc" } = req.body;
    let payCurrency = pay_currency;
    
    // Map plan types to amounts if not provided
    const planPrices = {
      "test": 20,
      "monthly": 29.99,
      "quarterly": 79.99,
      "yearly": 299.99,
      "annual": 135,
      "Basic": 5,
      "Premium": 15,
      "Pro": 30,
    };
    
    const planDescription = {
      "test": "Test Plan - 7 Days",
      "monthly": "Monthly Subscription - 30 Days",
      "quarterly": "Quarterly Subscription - 90 Days",
      "yearly": "Yearly Subscription - 365 Days",
      "annual": "Annual Package - 360 Days",
      "Basic": "Basic Subscription - 30 Days",
      "Premium": "Premium Subscription - 30 Days",
      "Pro": "Pro Subscription - 30 Days",
    };
    
    const finalAmount = amount || planPrices[planType] || 15;
    const finalDescription = planDescription[planType] || "Subscription Payment";
    
    paymentLogger.start("Creating subscription payment", {
      plan: planType,
      amount: finalAmount,
      payCurrency: payCurrency,
    });

    // Validate subscription plan
    if (!planPrices[planType]) {
      paymentLogger.warn("Invalid plan type", { plan: planType });
      return ErrorResponse(res, "Invalid subscription plan");
    }

    const userId = req.user?._id;
    const userEmail = req.user?.email;

    if (!userId || !userEmail) {
      paymentLogger.warn("User not authenticated for subscription payment");
      return ErrorResponse(res, "User must be authenticated to purchase subscription", 401);
    }

    const order_id = `subscription_${userId}_${planType}_${Date.now()}`;

    // Normalize currency to lowercase and convert generic 'usdt' to network-specific
    payCurrency = payCurrency.toLowerCase();
    
    // Convert generic 'usdt' to BSC network variant
    if (payCurrency === 'usdt') {
      payCurrency = 'usdtbsc';
      paymentLogger.info("Converting generic USDT to USDTBSC for compatibility", {
        original: 'usdt',
        converted: 'usdtbsc'
      });
    }

    const paymentData = {
      price_amount: finalAmount,
      price_currency: currency.toUpperCase(),
      pay_currency: payCurrency.toUpperCase(),
      order_id: order_id,
      order_description: finalDescription,
      ipn_callback_url: `${process.env.BASE_URL || "http://localhost:5000"}/api/payments/webhook`,
      customer_email: userEmail,
    };

    // Create invoice on NOWPayments
    let invoice;
    try {
      invoice = await nowpaymentsService.createPaymentInvoice(paymentData);
      
      paymentLogger.success("Invoice created successfully", {
        invoiceId: invoice.id,
        orderId: order_id,
        amount: finalAmount,
        currency: payCurrency.toUpperCase(),
      });
    } catch (apiError) {
      paymentLogger.error("Failed to create payment invoice", {
        error: apiError.response?.data || apiError.message,
        amount: finalAmount,
        currency: payCurrency,
      });
      
      // Don't fallback to BTC - just throw the error so user can see what went wrong
      throw apiError;
    }

    // Save subscription payment record
    const paymentRecord = await new paymentModel({
      user: userId,
      type: "subscription",
      amount: finalAmount,
      status: "pending",
      transactionId: invoice.id,
      metadata: {
        invoiceId: invoice.id,
        orderId: order_id,
        currency: "USD",
        payCurrency: payCurrency,
        description: finalDescription,
        provider: "nowpayments",
        invoiceUrl: invoice.invoice_url,
        subscriptionPlan: planType,
        invoiceData: invoice,
      },
    }).save();

    paymentLogger.success("Subscription payment invoice created", {
      userId,
      plan: planType,
      invoiceId: invoice.id,
    });

    return successResponseWithData(
      res,
      "Invoice created successfully - opening payment page",
      {
        invoiceId: invoice.id,
        orderId: order_id,
        invoiceUrl: invoice.invoice_url,
        paymentUrl: invoice.invoice_url,
        subscriptionPlan: planType,
        subscriptionType: planType,
        amount: finalAmount,
        currency: currency.toUpperCase(),
        payCurrency: payCurrency.toUpperCase(),
        walletAddress: invoice.pay_address || null,
      }
    );
  } catch (error) {
    paymentLogger.error("Error creating subscription payment", error);
    const errorMessage = error.response?.data?.message || error.message || "Failed to create subscription payment";
    return ErrorResponse(res, errorMessage, 500);
  }
};
