# SendGrid Email Service Setup Guide

## 📧 Overview

ProNext Platform now uses **SendGrid** for all email communications including:
- OTP verification emails (registration, login, password reset)
- Welcome emails after successful registration
- Password reset confirmation emails
- Admin notifications

## 🚀 Quick Setup

### Step 1: Create SendGrid Account

1. Go to [SendGrid Website](https://sendgrid.com/)
2. Click "Start for Free" or "Sign Up"
3. Complete the registration process
4. Verify your email address

### Step 2: Get Your API Key

1. Log into your SendGrid dashboard
2. Go to **Settings** → **API Keys**
3. Click **Create API Key**
4. Name it (e.g., "ProNext Backend")
5. Select **Full Access** or **Restricted Access** with Mail Send permissions
6. Click **Create & View**
7. **Copy the API key immediately** (you won't be able to see it again)

### Step 3: Configure Environment Variables

Add the following to your `.env` file in the `pronext-backend` folder:

```env
# SendGrid Email Configuration
SENDGRID_API_KEY=SG.your_actual_api_key_here
FROM_EMAIL=noreply@yourdomain.com
FROM_NAME=ProNext Platform
```

**Example:**
```env
SENDGRID_API_KEY=SG.abcd1234efgh5678ijkl9012mnop3456
FROM_EMAIL=noreply@pronext.com
FROM_NAME=ProNext Platform
```

### Step 4: Verify Sender Identity

SendGrid requires sender verification before you can send emails:

#### Option A: Single Sender Verification (Easiest for Testing)

1. In SendGrid dashboard, go to **Settings** → **Sender Authentication**
2. Click **Verify a Single Sender**
3. Fill in the form with your email address
4. Click **Create**
5. Check your email and click the verification link
6. Use this verified email as your `FROM_EMAIL`

#### Option B: Domain Authentication (Best for Production)

1. In SendGrid dashboard, go to **Settings** → **Sender Authentication**
2. Click **Authenticate Your Domain**
3. Follow the DNS setup instructions for your domain
4. Wait for DNS propagation (can take up to 48 hours)
5. You can then use any email address from that domain as `FROM_EMAIL`

### Step 5: Test Your Setup

Restart your backend server:

```bash
cd pronext-backend
npm start
```

Check the logs for:
```
✅ [EMAIL_SERVICE] SendGrid initialized successfully
```

## 📨 Email Types Sent

### 1. Registration OTP Email
**When:** User registers a new account
**Contains:** 6-digit OTP code, valid for 1 minute
**Purpose:** `register`

### 2. Login OTP Email
**When:** User logs in
**Contains:** 6-digit OTP code, valid for 1 minute
**Purpose:** `login`

### 3. Password Reset OTP Email
**When:** User requests password reset
**Contains:** 6-digit OTP code, valid for 5 minutes
**Purpose:** `reset-password`

### 4. Welcome Email
**When:** User successfully verifies OTP after registration
**Contains:** Welcome message and getting started information

### 5. Password Reset Confirmation
**When:** User successfully resets their password
**Contains:** Confirmation of password change

## 🔧 Troubleshooting

### Issue: "SendGrid API key not configured" Error

**Solution:**
1. Verify `SENDGRID_API_KEY` is in your `.env` file
2. Make sure there are no spaces around the `=` sign
3. Restart your backend server
4. Check the API key is correct (starts with `SG.`)

### Issue: "Email not received"

**Solution:**
1. Check spam/junk folder
2. Verify sender email in SendGrid dashboard
3. Check SendGrid activity logs: Dashboard → **Activity**
4. Verify your SendGrid account is not suspended
5. Check if you exceeded SendGrid free tier limits (100 emails/day)

### Issue: "403 Forbidden" Error

**Solution:**
1. Check your API key has Mail Send permissions
2. Verify sender identity is completed
3. Try creating a new API key with Full Access

### Issue: Emails showing as "from test@gmail.com"

**Solution:**
This was the old Nodemailer configuration. After implementing SendGrid:
1. Verify `FROM_EMAIL` and `FROM_NAME` are in `.env`
2. Restart the backend server
3. The new emails will show your configured sender

## 💳 SendGrid Pricing

### Free Tier
- **100 emails/day** forever free
- Perfect for development and testing
- Email API access
- Email validation

### Essentials Plan ($19.95/month)
- **50,000 emails/month**
- All basic features
- 24/7 email support

### Pro Plan ($89.95/month)
- **100,000 emails/month**
- Advanced features
- Dedicated IP address
- Priority support

For development, the **free tier** is sufficient!

## 📊 Monitoring Email Activity

1. Log into SendGrid dashboard
2. Go to **Activity**
3. View:
   - Emails sent
   - Delivery status
   - Bounces
   - Opens (if tracking enabled)
   - Clicks (if tracking enabled)

## 🔐 Security Best Practices

1. **Never commit** your API key to Git
2. Add `.env` to `.gitignore`
3. Use **environment variables** in production
4. Rotate API keys regularly
5. Use **Restricted Access** API keys with only Mail Send permission
6. Enable **two-factor authentication** on your SendGrid account

## 📝 Code Implementation

### Email Service Location
```
pronext-backend/services/emailService.js
```

### Functions Available

#### sendOtpEmail(email, otp, purpose)
```javascript
import { sendOtpEmail } from '../../services/emailService.js';

// For registration
await sendOtpEmail(userEmail, otp, 'register');

// For login
await sendOtpEmail(userEmail, otp, 'login');

// For password reset
await sendOtpEmail(userEmail, otp, 'reset-password');

// For admin
await sendOtpEmail(adminEmail, otp, 'admin-forgot-password');
```

#### sendWelcomeEmail(email, userName)
```javascript
import { sendWelcomeEmail } from '../../services/emailService.js';

await sendWelcomeEmail(user.email, `${user.fname} ${user.lname}`);
```

#### sendPasswordResetConfirmation(email)
```javascript
import { sendPasswordResetConfirmation } from '../../services/emailService.js';

await sendPasswordResetConfirmation(user.email);
```

## 🎨 Email Templates

All emails are sent with:
- **Professional HTML design**
- **Responsive layout** (mobile-friendly)
- **Purple gradient branding** (#667eea to #764ba2)
- **Security warnings** about not sharing OTP
- **Clear OTP display** with large, easy-to-read font
- **Auto-generated footer** with company info

## ✅ Verification Checklist

- [ ] SendGrid account created
- [ ] API key generated and copied
- [ ] Environment variables configured in `.env`
- [ ] Sender identity verified (single sender or domain)
- [ ] Backend server restarted
- [ ] Test email sent successfully
- [ ] Check email received (including spam folder)
- [ ] Verify email formatting and branding

## 🔄 Migration from Nodemailer

The old Nodemailer configuration has been completely replaced with SendGrid. Changes made:

### Before (Nodemailer)
```javascript
import nodemailer from 'nodemailer';

const transporter = nodemailer.createTransport({
  service: 'gmail',
  auth: {
    user: 'email@gmail.com',
    pass: 'app_password'
  }
});
```

### After (SendGrid)
```javascript
import { sendOtpEmail } from '../../services/emailService.js';

await sendOtpEmail(email, otp, 'register');
```

### Benefits of SendGrid:
✅ Better deliverability
✅ Professional email templates
✅ No Gmail app password needed
✅ Built-in analytics
✅ Better spam prevention
✅ Scalable (100 emails/day free)
✅ Easier to manage

## 📞 Support

If you encounter issues:

1. Check SendGrid documentation: https://docs.sendgrid.com/
2. Check SendGrid status page: https://status.sendgrid.com/
3. Review backend logs for error messages
4. Contact SendGrid support (available 24/7 for paid plans)

## 🎯 Next Steps

1. ✅ Install SendGrid package: `npm install @sendgrid/mail`
2. ✅ Create email service: `services/emailService.js`
3. ✅ Update auth controller to use SendGrid
4. ✅ Add environment variables
5. 🔲 Get SendGrid API key
6. 🔲 Verify sender identity
7. 🔲 Test email sending
8. 🔲 Deploy to production

---

**Last Updated:** January 18, 2026
**Version:** 1.0.0
