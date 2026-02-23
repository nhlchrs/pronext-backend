# ========================================================
# PowerShell Script: Generate Payments and Commissions for Test Users
# Run this in PowerShell from the pronext-backend directory
# ========================================================

Write-Host ""
Write-Host "========================================" -ForegroundColor Cyan
Write-Host "💰 Generate Test Payments & Commissions" -ForegroundColor Cyan
Write-Host "========================================" -ForegroundColor Cyan
Write-Host ""

Write-Host "This script will:" -ForegroundColor Yellow
Write-Host "   1. Find all subscribed users with sponsors" -ForegroundColor Yellow
Write-Host "   2. Create payment records ($135 each)" -ForegroundColor Yellow
Write-Host "   3. Generate commissions (Direct, Level, Binary, Reward)" -ForegroundColor Yellow
Write-Host "   4. Skip users who already have payments" -ForegroundColor Yellow
Write-Host ""

$confirmation = Read-Host "Do you want to proceed? (yes/no)"
if ($confirmation -ne "yes" -and $confirmation -ne "y") {
    Write-Host "❌ Operation cancelled" -ForegroundColor Red
    exit
}

Write-Host ""
Write-Host "🔄 Running commission generation script..." -ForegroundColor Green
Write-Host ""

# Run the Node.js script
node .\GENERATE_TEST_COMMISSIONS.js

Write-Host ""
Write-Host "========================================" -ForegroundColor Cyan
Write-Host "✅ Script execution completed!" -ForegroundColor Green
Write-Host "========================================" -ForegroundColor Cyan
Write-Host ""
