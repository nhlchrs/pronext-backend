import sgMail from '@sendgrid/mail';
import logger from '../helpers/logger.js';

const emailLogger = logger.module('EMAIL_SERVICE');

// Initialize SendGrid - this will be called after dotenv loads
let isInitialized = false;

const initializeSendGrid = () => {
  if (isInitialized) return;
  
  const SENDGRID_API_KEY = process.env.SENDGRID_API_KEY;
  
  if (SENDGRID_API_KEY) {
    sgMail.setApiKey(SENDGRID_API_KEY);
    emailLogger.success('SendGrid initialized successfully');
    isInitialized = true;
  } else {
    emailLogger.warn('SendGrid API key not found. Email functionality will not work.');
  }
};

// Get config values
const getConfig = () => ({
  FROM_EMAIL: process.env.FROM_EMAIL || 'noreply@pronet.com',
  FROM_NAME: process.env.FROM_NAME || 'ProNet Platform'
});

/**
 * Send OTP Email using SendGrid
 * @param {string} email - Recipient email address
 * @param {string} otp - One-time password
 * @param {string} purpose - Purpose of OTP (login, register, reset-password, etc.)
 * @returns {Promise<boolean>} - Success status
 */
export const sendOtpEmail = async (email, otp, purpose = 'login') => {
  // Initialize SendGrid on first use
  initializeSendGrid();
  
  if (!email) {
    emailLogger.warn('No email provided to sendOtpEmail()');
    return false;
  }

  if (!process.env.SENDGRID_API_KEY) {
    emailLogger.error('Cannot send email: SendGrid API key not configured');
    return false;
  }

  const { FROM_EMAIL, FROM_NAME } = getConfig();

  try {
    let subject = 'Your OTP Code';
    let title = '🔐 Verification Code';
    let message = 'Your one-time password (OTP) is:';
    let validityText = 'This code is valid for <b>5 minutes</b>.';

    // Customize message based on purpose
    switch (purpose) {
      case 'register':
        subject = 'Welcome to ProNet - Verify Your Email';
        title = '👋 Welcome to ProNet!';
        message = 'Thank you for registering. Please verify your email with this OTP:';
        break;
      case 'login':
        subject = 'ProNet - Login Verification';
        title = '🔐 Login Verification';
        message = 'Your login verification code is:';
        validityText = 'This code is valid for <b>1 minute</b>.';
        break;
      case 'reset-password':
        subject = 'ProNet - Password Reset Request';
        title = '🔑 Reset Your Password';
        message = 'You requested to reset your password. Use this OTP to continue:';
        break;
      case 'admin-forgot-password':
        subject = 'ProNet Admin - Password Reset';
        title = '🔑 Admin Password Reset';
        message = 'Admin password reset requested. Your OTP is:';
        break;
      default:
        break;
    }

    const msg = {
      to: email,
      from: {
        email: FROM_EMAIL,
        name: FROM_NAME
      },
      subject: subject,
      html: `
        <!DOCTYPE html>
        <html>
        <head>
          <meta charset="UTF-8">
          <meta name="viewport" content="width=device-width, initial-scale=1.0">
          <style>
            body {
              font-family: 'Segoe UI', Tahoma, Geneva, Verdana, sans-serif;
              line-height: 1.6;
              color: #333;
              background-color: #f4f4f4;
              margin: 0;
              padding: 0;
            }
            .email-container {
              max-width: 600px;
              margin: 20px auto;
              background-color: #ffffff;
              border-radius: 10px;
              overflow: hidden;
              box-shadow: 0 4px 6px rgba(0, 0, 0, 0.1);
            }
            .email-header {
              background: linear-gradient(135deg, #667eea 0%, #764ba2 100%);
              color: #ffffff;
              padding: 30px;
              text-align: center;
            }
            .email-header h1 {
              margin: 0;
              font-size: 28px;
              font-weight: 600;
            }
            .email-body {
              padding: 40px 30px;
              text-align: center;
            }
            .email-body p {
              font-size: 16px;
              color: #555;
              margin-bottom: 20px;
            }
            .otp-box {
              background: linear-gradient(135deg, #667eea 0%, #764ba2 100%);
              color: #ffffff;
              font-size: 36px;
              font-weight: bold;
              padding: 20px 40px;
              border-radius: 10px;
              display: inline-block;
              margin: 20px 0;
              letter-spacing: 8px;
              box-shadow: 0 4px 6px rgba(102, 126, 234, 0.3);
            }
            .validity-text {
              font-size: 14px;
              color: #777;
              margin-top: 20px;
            }
            .email-footer {
              background-color: #f8f9fa;
              padding: 20px;
              text-align: center;
              font-size: 12px;
              color: #888;
              border-top: 1px solid #e0e0e0;
            }
            .warning-text {
              background-color: #fff3cd;
              border: 1px solid #ffc107;
              border-radius: 5px;
              padding: 15px;
              margin: 20px 0;
              font-size: 14px;
              color: #856404;
            }
            .brand-name {
              color: #667eea;
              font-weight: 600;
            }
          </style>
        </head>
        <body>
          <div class="email-container">
            <div class="email-header">
              <h1>${title}</h1>
            </div>
            <div class="email-body">
              <p>${message}</p>
              <div class="otp-box">${otp}</div>
              <p class="validity-text">${validityText}</p>
              <div class="warning-text">
                ⚠️ <strong>Security Notice:</strong> Never share this OTP with anyone. 
                <span class="brand-name">ProNet</span> will never ask you for this code.
              </div>
              <p>If you didn't request this code, please ignore this email or contact our support team.</p>
            </div>
            <div class="email-footer">
              <p>&copy; ${new Date().getFullYear()} ProNet Platform. All rights reserved.</p>
              <p>This is an automated email. Please do not reply to this message.</p>
            </div>
          </div>
        </body>
        </html>
      `,
      text: `${title}\n\n${message}\n\nOTP: ${otp}\n\n${validityText}\n\nIf you didn't request this, please ignore this email.`
    };

    await sgMail.send(msg);
    emailLogger.success(`OTP email sent successfully to: ${email}`, { purpose });
    return true;

  } catch (error) {
    emailLogger.error('Error sending OTP email', {
      email,
      error: error.message,
      response: error.response?.body
    });
    return false;
  }
};

/**
 * Send Welcome Email after successful registration
 * @param {string} email - Recipient email address
 * @param {string} userName - User's name
 * @returns {Promise<boolean>} - Success status
 */
export const sendWelcomeEmail = async (email, userName) => {
  initializeSendGrid();
  
  if (!email || !process.env.SENDGRID_API_KEY) {
    emailLogger.warn('Cannot send welcome email: Missing email or API key');
    return false;
  }

  const { FROM_EMAIL, FROM_NAME } = getConfig();

  try {
    const msg = {
      to: email,
      from: {
        email: FROM_EMAIL,
        name: FROM_NAME
      },
      subject: 'Welcome to ProNet Platform! 🎉',
      html: `
        <!DOCTYPE html>
        <html>
        <head>
          <meta charset="UTF-8">
          <style>
            body { font-family: Arial, sans-serif; line-height: 1.6; color: #333; }
            .container { max-width: 600px; margin: 0 auto; padding: 20px; }
            .header { background: linear-gradient(135deg, #667eea 0%, #764ba2 100%); color: white; padding: 30px; text-align: center; border-radius: 10px 10px 0 0; }
            .content { background: #f9f9f9; padding: 30px; border-radius: 0 0 10px 10px; }
            .button { display: inline-block; padding: 12px 30px; background: #667eea; color: white; text-decoration: none; border-radius: 5px; margin: 20px 0; }
          </style>
        </head>
        <body>
          <div class="container">
            <div class="header">
              <h1>Welcome to ProNet! 🎉</h1>
            </div>
            <div class="content">
              <h2>Hello ${userName}!</h2>
              <p>Thank you for joining ProNet Platform. We're excited to have you on board!</p>
              <p>Your account has been successfully created and verified. You can now access all features of our platform.</p>
              <a href="${process.env.FRONTEND_URL || 'https://pronet.com'}" class="button">Get Started</a>
              <p>If you have any questions, feel free to reach out to our support team.</p>
              <p>Best regards,<br>The ProNet Team</p>
            </div>
          </div>
        </body>
        </html>
      `
    };

    await sgMail.send(msg);
    emailLogger.success(`Welcome email sent to: ${email}`);
    return true;

  } catch (error) {
    emailLogger.error('Error sending welcome email', { email, error: error.message });
    return false;
  }
};

/**
 * Send Password Reset Confirmation Email
 * @param {string} email - Recipient email address
 * @returns {Promise<boolean>} - Success status
 */
export const sendPasswordResetConfirmation = async (email) => {
  initializeSendGrid();
  
  if (!email || !process.env.SENDGRID_API_KEY) {
    return false;
  }

  const { FROM_EMAIL, FROM_NAME } = getConfig();

  try {
    const msg = {
      to: email,
      from: {
        email: FROM_EMAIL,
        name: FROM_NAME
      },
      subject: 'ProNet - Password Changed Successfully',
      html: `
        <!DOCTYPE html>
        <html>
        <head>
          <meta charset="UTF-8">
          <style>
            body { font-family: Arial, sans-serif; line-height: 1.6; color: #333; }
            .container { max-width: 600px; margin: 0 auto; padding: 20px; background: #f9f9f9; border-radius: 10px; }
            .header { text-align: center; color: #667eea; }
          </style>
        </head>
        <body>
          <div class="container">
            <div class="header">
              <h1>✅ Password Changed Successfully</h1>
            </div>
            <p>Your password has been successfully reset.</p>
            <p>If you did not make this change, please contact our support team immediately.</p>
            <p>Best regards,<br>The ProNet Team</p>
          </div>
        </body>
        </html>
      `
    };

    await sgMail.send(msg);
    emailLogger.success(`Password reset confirmation sent to: ${email}`);
    return true;

  } catch (error) {
    emailLogger.error('Error sending password reset confirmation', { email, error: error.message });
    return false;
  }
};

/**
 * Send Payout Completion Email
 * @param {string} email - Recipient email address
 * @param {object} payoutDetails - Payout information
 * @returns {Promise<boolean>} - Success status
 */
export const sendPayoutCompletionEmail = async (email, payoutDetails) => {
  initializeSendGrid();
  
  if (!email || !process.env.SENDGRID_API_KEY) {
    emailLogger.warn('Cannot send payout email: Missing email or API key');
    return false;
  }

  const { FROM_EMAIL, FROM_NAME } = getConfig();
  const { amount, netAmount, currency, method, transactionId, cryptoTransactionHash } = payoutDetails;

  try {
    const msg = {
      to: email,
      from: {
        email: FROM_EMAIL,
        name: FROM_NAME
      },
      subject: 'ProNet - Payout Completed Successfully! 💰',
      html: `
        <!DOCTYPE html>
        <html>
        <head>
          <meta charset="UTF-8">
          <style>
            body { font-family: Arial, sans-serif; line-height: 1.6; color: #333; background: #f4f4f4; margin: 0; padding: 0; }
            .container { max-width: 600px; margin: 20px auto; padding: 0; background: #ffffff; border-radius: 10px; box-shadow: 0 4px 6px rgba(0,0,0,0.1); }
            .header { background: linear-gradient(135deg, #4CD3C8 0%, #0B1929 100%); color: white; padding: 30px 20px; text-align: center; border-radius: 10px 10px 0 0; }
            .header h1 { margin: 0; font-size: 28px; }
            .content { padding: 30px 20px; }
            .highlight-box { background: #f8f9fa; border-left: 4px solid #4CD3C8; padding: 20px; margin: 20px 0; border-radius: 5px; }
            .amount { font-size: 36px; font-weight: bold; color: #4CD3C8; margin: 10px 0; }
            .details { background: #f8f9fa; padding: 15px; border-radius: 5px; margin: 20px 0; }
            .details-row { display: flex; justify-content: space-between; padding: 8px 0; border-bottom: 1px solid #e0e0e0; }
            .details-row:last-child { border-bottom: none; }
            .label { font-weight: 600; color: #666; }
            .value { color: #333; }
            .success-icon { font-size: 48px; text-align: center; margin: 20px 0; }
            .footer { background: #f8f9fa; padding: 20px; text-align: center; font-size: 12px; color: #888; border-radius: 0 0 10px 10px; border-top: 1px solid #e0e0e0; }
            .warning { background: #fff3cd; border: 1px solid #ffc107; border-radius: 5px; padding: 15px; margin: 20px 0; font-size: 14px; color: #856404; }
            a { color: #4CD3C8; text-decoration: none; }
          </style>
        </head>
        <body>
          <div class="container">
            <div class="header">
              <h1>💰 Payout Completed!</h1>
            </div>
            <div class="content">
              <div class="success-icon">✅</div>
              <p style="text-align: center; font-size: 18px;">Your payout has been processed successfully!</p>
              
              <div class="highlight-box">
                <p style="margin: 0; font-size: 14px; color: #666;">Amount Received</p>
                <div class="amount">₹${netAmount?.toFixed(2) || amount?.toFixed(2)}</div>
                <p style="margin: 0; font-size: 12px; color: #888;">${currency || 'INR'} • ${method || 'Crypto'} Transfer</p>
              </div>

              <div class="details">
                <h3 style="margin-top: 0; color: #0B1929;">Transaction Details</h3>
                <div class="details-row">
                  <span class="label">Payment Method:</span>
                  <span class="value">${method || 'Crypto Wallet'}</span>
                </div>
                ${transactionId ? `
                <div class="details-row">
                  <span class="label">Transaction ID:</span>
                  <span class="value" style="font-family: monospace; font-size: 11px;">${transactionId}</span>
                </div>
                ` : ''}
                ${cryptoTransactionHash ? `
                <div class="details-row">
                  <span class="label">Blockchain Hash:</span>
                  <span class="value" style="font-family: monospace; font-size: 11px;">${cryptoTransactionHash}</span>
                </div>
                ` : ''}
                <div class="details-row">
                  <span class="label">Status:</span>
                  <span class="value" style="color: #28a745; font-weight: 600;">✓ Completed</span>
                </div>
              </div>

              <div class="warning">
                ⚠️ <strong>Security Note:</strong> This payout has been sent to your registered wallet address. 
                Please verify the transaction in your wallet. If you did not request this payout, contact support immediately.
              </div>

              <p>The funds should appear in your wallet shortly. Cryptocurrency transactions typically take 10-30 minutes for network confirmation.</p>
              
              <p>If you have any questions or concerns, please don't hesitate to contact our support team.</p>
              
              <p>Best regards,<br><strong>The ProNet Team</strong></p>
            </div>
            <div class="footer">
              <p>&copy; ${new Date().getFullYear()} ProNet Platform. All rights reserved.</p>
              <p>This is an automated email. Please do not reply to this message.</p>
            </div>
          </div>
        </body>
        </html>
      `
    };

    await sgMail.send(msg);
    emailLogger.success(`Payout completion email sent to: ${email}`);
    return true;

  } catch (error) {
    emailLogger.error('Error sending payout completion email', { email, error: error.message });
    return false;
  }
};

export default {
  sendOtpEmail,
  sendWelcomeEmail,
  sendPasswordResetConfirmation,
  sendPayoutCompletionEmail
};
