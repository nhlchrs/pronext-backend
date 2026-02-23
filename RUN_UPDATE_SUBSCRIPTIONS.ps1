# ========================================================
# PowerShell Script: Update All Users to Subscribed Status
# Run this in PowerShell from the pronext-backend directory
# ========================================================

Write-Host ""
Write-Host "========================================" -ForegroundColor Cyan
Write-Host "📊 Update All Users to Subscribed" -ForegroundColor Cyan
Write-Host "========================================" -ForegroundColor Cyan
Write-Host ""

# Confirm before proceeding
Write-Host "⚠️  WARNING: This will update ALL existing users to have:" -ForegroundColor Yellow
Write-Host "   - subscriptionStatus: true" -ForegroundColor Yellow
Write-Host "   - subscriptionTier: Pro or Premium (alternating)" -ForegroundColor Yellow
Write-Host "   - subscriptionExpiryDate: 2 years from now (720 days)" -ForegroundColor Yellow
Write-Host ""

$confirmation = Read-Host "Do you want to proceed? (yes/no)"
if ($confirmation -ne "yes" -and $confirmation -ne "y") {
    Write-Host "❌ Operation cancelled" -ForegroundColor Red
    exit
}

Write-Host ""
Write-Host "🔄 Running update script..." -ForegroundColor Green
Write-Host ""

# Run the Node.js script
node .\UPDATE_ALL_USERS_SUBSCRIPTION.js

Write-Host ""
Write-Host "========================================" -ForegroundColor Cyan
Write-Host "✅ Script execution completed!" -ForegroundColor Green
Write-Host "========================================" -ForegroundColor Cyan
Write-Host ""
