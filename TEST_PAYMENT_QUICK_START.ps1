# NOWPayments Quick Test Script
# Run this to test your payment integration quickly

Write-Host ""
Write-Host "╔════════════════════════════════════════════════════════╗" -ForegroundColor Cyan
Write-Host "║   PRONEXT - NOWPAYMENTS TESTING QUICK START           ║" -ForegroundColor Cyan
Write-Host "║   Automated Testing Helper                            ║" -ForegroundColor Cyan
Write-Host "╚════════════════════════════════════════════════════════╝" -ForegroundColor Cyan
Write-Host ""

# Function to show menu
function Show-Menu {
    Write-Host "Choose what you want to test:" -ForegroundColor Yellow
    Write-Host ""
    Write-Host "  1. 🧪 Run Basic Tests (No Login)" -ForegroundColor White
    Write-Host "  2. 🔐 Run Authenticated Tests (Need Token)" -ForegroundColor White
    Write-Host "  3. 🔔 Test Webhooks" -ForegroundColor White
    Write-Host "  4. 🚀 Start Backend Server" -ForegroundColor White
    Write-Host "  5. 🌐 Start Frontend (User Panel)" -ForegroundColor White
    Write-Host "  6. 📊 Check Payment Status" -ForegroundColor White
    Write-Host "  7. 🔍 View MongoDB Payments" -ForegroundColor White
    Write-Host "  8. ✅ Run ALL Tests (Recommended)" -ForegroundColor Green
    Write-Host "  9. 📖 Open Testing Guide" -ForegroundColor White
    Write-Host "  0. ❌ Exit" -ForegroundColor Red
    Write-Host ""
}

# Check if backend is running
function Test-BackendRunning {
    try {
        $response = Invoke-RestMethod -Uri "http://localhost:5000/api/payments/currencies" -TimeoutSec 2
        return $true
    } catch {
        return $false
    }
}

# Check if frontend is running
function Test-FrontendRunning {
    try {
        $response = Invoke-WebRequest -Uri "http://localhost:5173" -TimeoutSec 2
        return $true
    } catch {
        return $false
    }
}

# Test 1: Basic Tests
function Run-BasicTests {
    Write-Host ""
    Write-Host "═══════════════════════════════════════" -ForegroundColor Cyan
    Write-Host "  Running Basic Tests..." -ForegroundColor Cyan
    Write-Host "═══════════════════════════════════════" -ForegroundColor Cyan
    Write-Host ""
    
    if (-not (Test-BackendRunning)) {
        Write-Host "❌ Backend is not running!" -ForegroundColor Red
        Write-Host "Please start backend first (Option 4)" -ForegroundColor Yellow
        return
    }
    
    Write-Host "✅ Backend is running" -ForegroundColor Green
    Write-Host ""
    
    node test-nowpayments-basic.js
    
    Write-Host ""
    Write-Host "Press any key to continue..." -ForegroundColor Gray
    $null = $Host.UI.RawUI.ReadKey("NoEcho,IncludeKeyDown")
}

# Test 2: Authenticated Tests
function Run-AuthTests {
    Write-Host ""
    Write-Host "═══════════════════════════════════════" -ForegroundColor Cyan
    Write-Host "  Running Authenticated Tests..." -ForegroundColor Cyan
    Write-Host "═══════════════════════════════════════" -ForegroundColor Cyan
    Write-Host ""
    
    if (-not (Test-BackendRunning)) {
        Write-Host "❌ Backend is not running!" -ForegroundColor Red
        Write-Host "Please start backend first (Option 4)" -ForegroundColor Yellow
        return
    }
    
    # Check if token is set
    $content = Get-Content "test-nowpayments.js" -Raw
    if ($content -match "TOKEN = 'YOUR_JWT_TOKEN_HERE'") {
        Write-Host "⚠️  JWT Token not configured!" -ForegroundColor Yellow
        Write-Host ""
        Write-Host "Steps to get token:" -ForegroundColor Cyan
        Write-Host "1. Login at: http://localhost:5173/login" -ForegroundColor White
        Write-Host "2. Press F12 to open DevTools" -ForegroundColor White
        Write-Host "3. In Console, type: localStorage.getItem('token')" -ForegroundColor White
        Write-Host "4. Copy the token" -ForegroundColor White
        Write-Host "5. Edit test-nowpayments.js, line 11" -ForegroundColor White
        Write-Host "6. Replace 'YOUR_JWT_TOKEN_HERE' with your token" -ForegroundColor White
        Write-Host ""
        Write-Host "Do you want to open the file now? (Y/N): " -ForegroundColor Yellow -NoNewline
        $response = Read-Host
        if ($response -eq 'Y' -or $response -eq 'y') {
            code test-nowpayments.js
        }
        return
    }
    
    Write-Host "✅ Token is configured" -ForegroundColor Green
    Write-Host ""
    
    node test-nowpayments.js
    
    Write-Host ""
    Write-Host "Press any key to continue..." -ForegroundColor Gray
    $null = $Host.UI.RawUI.ReadKey("NoEcho,IncludeKeyDown")
}

# Test 3: Webhooks
function Test-Webhooks {
    Write-Host ""
    Write-Host "═══════════════════════════════════════" -ForegroundColor Cyan
    Write-Host "  Testing Webhooks..." -ForegroundColor Cyan
    Write-Host "═══════════════════════════════════════" -ForegroundColor Cyan
    Write-Host ""
    
    if (-not (Test-BackendRunning)) {
        Write-Host "❌ Backend is not running!" -ForegroundColor Red
        Write-Host "Please start backend first (Option 4)" -ForegroundColor Yellow
        return
    }
    
    node helpers/webhookTestHelper.js --all
    
    Write-Host ""
    Write-Host "Press any key to continue..." -ForegroundColor Gray
    $null = $Host.UI.RawUI.ReadKey("NoEcho,IncludeKeyDown")
}

# Start Backend
function Start-Backend {
    Write-Host ""
    Write-Host "═══════════════════════════════════════" -ForegroundColor Cyan
    Write-Host "  Starting Backend Server..." -ForegroundColor Cyan
    Write-Host "═══════════════════════════════════════" -ForegroundColor Cyan
    Write-Host ""
    
    if (Test-BackendRunning) {
        Write-Host "✅ Backend is already running" -ForegroundColor Green
        Write-Host ""
        return
    }
    
    Write-Host "Starting backend in new window..." -ForegroundColor Yellow
    Start-Process powershell -ArgumentList "-NoExit", "-Command", "cd '$PWD'; npm start"
    
    Write-Host "⏳ Waiting for server to start..." -ForegroundColor Yellow
    Start-Sleep -Seconds 3
    
    $attempts = 0
    while ($attempts -lt 10) {
        if (Test-BackendRunning) {
            Write-Host "✅ Backend started successfully!" -ForegroundColor Green
            Write-Host "📍 Running on: http://localhost:5000" -ForegroundColor Cyan
            Write-Host ""
            return
        }
        Start-Sleep -Seconds 1
        $attempts++
    }
    
    Write-Host "⚠️  Backend may not have started. Check the new window." -ForegroundColor Yellow
    Write-Host ""
}

# Start Frontend
function Start-Frontend {
    Write-Host ""
    Write-Host "═══════════════════════════════════════" -ForegroundColor Cyan
    Write-Host "  Starting Frontend (User Panel)..." -ForegroundColor Cyan
    Write-Host "═══════════════════════════════════════" -ForegroundColor Cyan
    Write-Host ""
    
    if (Test-FrontendRunning) {
        Write-Host "✅ Frontend is already running" -ForegroundColor Green
        Write-Host "📍 Open: http://localhost:5173" -ForegroundColor Cyan
        Write-Host ""
        return
    }
    
    $pronetPath = Join-Path (Split-Path $PWD -Parent) "pronet"
    
    if (-not (Test-Path $pronetPath)) {
        Write-Host "❌ Frontend directory not found!" -ForegroundColor Red
        Write-Host "Expected: $pronetPath" -ForegroundColor Yellow
        Write-Host ""
        return
    }
    
    Write-Host "Starting frontend in new window..." -ForegroundColor Yellow
    Start-Process powershell -ArgumentList "-NoExit", "-Command", "cd '$pronetPath'; npm run dev"
    
    Write-Host "⏳ Waiting for frontend to start..." -ForegroundColor Yellow
    Start-Sleep -Seconds 5
    
    Write-Host "✅ Frontend should be starting!" -ForegroundColor Green
    Write-Host "📍 Open: http://localhost:5173" -ForegroundColor Cyan
    Write-Host ""
    
    Write-Host "Open in browser? (Y/N): " -ForegroundColor Yellow -NoNewline
    $response = Read-Host
    if ($response -eq 'Y' -or $response -eq 'y') {
        Start-Process "http://localhost:5173"
    }
}

# Check Payment Status
function Check-PaymentStatus {
    Write-Host ""
    Write-Host "═══════════════════════════════════════" -ForegroundColor Cyan
    Write-Host "  Check Payment Status..." -ForegroundColor Cyan
    Write-Host "═══════════════════════════════════════" -ForegroundColor Cyan
    Write-Host ""
    
    Write-Host "Enter Invoice ID: " -ForegroundColor Yellow -NoNewline
    $invoiceId = Read-Host
    
    if (-not $invoiceId) {
        Write-Host "❌ Invoice ID is required" -ForegroundColor Red
        return
    }
    
    Write-Host "Enter JWT Token: " -ForegroundColor Yellow -NoNewline
    $token = Read-Host
    
    try {
        $headers = @{
            "Authorization" = "Bearer $token"
            "Content-Type" = "application/json"
        }
        
        $response = Invoke-RestMethod -Uri "http://localhost:5000/api/payments/status/$invoiceId" -Headers $headers
        
        Write-Host ""
        Write-Host "✅ Payment Status Retrieved" -ForegroundColor Green
        Write-Host ""
        Write-Host "Status: $($response.data.payment_status)" -ForegroundColor Cyan
        Write-Host "Amount: $($response.data.pay_amount) $($response.data.pay_currency)" -ForegroundColor Cyan
        Write-Host "Created: $($response.data.created_at)" -ForegroundColor Cyan
        Write-Host ""
    } catch {
        Write-Host "❌ Error: $($_.Exception.Message)" -ForegroundColor Red
        Write-Host ""
    }
    
    Write-Host "Press any key to continue..." -ForegroundColor Gray
    $null = $Host.UI.RawUI.ReadKey("NoEcho,IncludeKeyDown")
}

# View MongoDB Payments
function View-MongoPayments {
    Write-Host ""
    Write-Host "═══════════════════════════════════════" -ForegroundColor Cyan
    Write-Host "  Recent Payments from MongoDB..." -ForegroundColor Cyan
    Write-Host "═══════════════════════════════════════" -ForegroundColor Cyan
    Write-Host ""
    
    Write-Host "⚠️  This requires MongoDB connection string from .env" -ForegroundColor Yellow
    Write-Host ""
    Write-Host "Opening MongoDB query in new window..." -ForegroundColor Cyan
    
    $mongoQuery = @"
// Connect to MongoDB and run this query
db.payments.find({}).sort({createdAt: -1}).limit(10)
"@
    
    Set-Content -Path "temp_mongo_query.js" -Value $mongoQuery
    code temp_mongo_query.js
    
    Write-Host "✅ Query file opened in VS Code" -ForegroundColor Green
    Write-Host ""
}

# Run All Tests
function Run-AllTests {
    Write-Host ""
    Write-Host "╔════════════════════════════════════════════════════════╗" -ForegroundColor Magenta
    Write-Host "║   RUNNING COMPLETE TEST SUITE                          ║" -ForegroundColor Magenta
    Write-Host "╚════════════════════════════════════════════════════════╝" -ForegroundColor Magenta
    Write-Host ""
    
    # Check and start backend if needed
    if (-not (Test-BackendRunning)) {
        Write-Host "⏳ Backend not running. Starting..." -ForegroundColor Yellow
        Start-Backend
        Start-Sleep -Seconds 5
    } else {
        Write-Host "✅ Backend is running" -ForegroundColor Green
    }
    
    # Run basic tests
    Write-Host ""
    Write-Host "━━━ STEP 1: Basic Tests ━━━" -ForegroundColor Cyan
    node test-nowpayments-basic.js
    
    Write-Host ""
    Write-Host "━━━ STEP 2: Webhook Tests ━━━" -ForegroundColor Cyan
    node helpers/webhookTestHelper.js --all
    
    Write-Host ""
    Write-Host "╔════════════════════════════════════════════════════════╗" -ForegroundColor Green
    Write-Host "║   BASIC TESTS COMPLETE!                                ║" -ForegroundColor Green
    Write-Host "╚════════════════════════════════════════════════════════╝" -ForegroundColor Green
    Write-Host ""
    Write-Host "📋 Next Steps:" -ForegroundColor Yellow
    Write-Host "1. Login to frontend: http://localhost:5173" -ForegroundColor White
    Write-Host "2. Go to Payment page" -ForegroundColor White
    Write-Host "3. Test subscription with crypto" -ForegroundColor White
    Write-Host "4. Get JWT token and run authenticated tests" -ForegroundColor White
    Write-Host ""
    
    Write-Host "Press any key to continue..." -ForegroundColor Gray
    $null = $Host.UI.RawUI.ReadKey("NoEcho,IncludeKeyDown")
}

# Open Testing Guide
function Open-TestingGuide {
    Write-Host ""
    Write-Host "Opening testing guide..." -ForegroundColor Cyan
    code COMPLETE_PAYMENT_TESTING_GUIDE.md
    Write-Host "✅ Guide opened in VS Code" -ForegroundColor Green
    Write-Host ""
}

# Main Loop
while ($true) {
    Clear-Host
    
    Write-Host ""
    Write-Host "╔════════════════════════════════════════════════════════╗" -ForegroundColor Cyan
    Write-Host "║   PRONEXT - NOWPAYMENTS TESTING                        ║" -ForegroundColor Cyan
    Write-Host "╚════════════════════════════════════════════════════════╝" -ForegroundColor Cyan
    Write-Host ""
    
    # Show status
    $backendStatus = if (Test-BackendRunning) { "🟢 Running" } else { "🔴 Stopped" }
    $frontendStatus = if (Test-FrontendRunning) { "🟢 Running" } else { "🔴 Stopped" }
    
    Write-Host "Backend:  $backendStatus" -ForegroundColor $(if (Test-BackendRunning) { "Green" } else { "Red" })
    Write-Host "Frontend: $frontendStatus" -ForegroundColor $(if (Test-FrontendRunning) { "Green" } else { "Red" })
    Write-Host ""
    
    Show-Menu
    
    Write-Host "Enter your choice: " -ForegroundColor Yellow -NoNewline
    $choice = Read-Host
    
    switch ($choice) {
        "1" { Run-BasicTests }
        "2" { Run-AuthTests }
        "3" { Test-Webhooks }
        "4" { Start-Backend }
        "5" { Start-Frontend }
        "6" { Check-PaymentStatus }
        "7" { View-MongoPayments }
        "8" { Run-AllTests }
        "9" { Open-TestingGuide }
        "0" { 
            Write-Host ""
            Write-Host "Goodbye! 👋" -ForegroundColor Cyan
            Write-Host ""
            exit 
        }
        default { 
            Write-Host ""
            Write-Host "❌ Invalid choice. Please try again." -ForegroundColor Red
            Start-Sleep -Seconds 2
        }
    }
}
