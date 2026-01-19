Write-Host "🧪 Testing Ramadan Vocabulary API..." -ForegroundColor Cyan
Write-Host ""
Write-Host "Make sure the server is running on http://localhost:5000" -ForegroundColor Yellow
Write-Host ""

$baseUrl = "http://localhost:5000"
$passedTests = 0
$totalTests = 0

# Test 1: Health Check
Write-Host "Test 1: Health Check Endpoint" -ForegroundColor Yellow
$totalTests++
try {
    $response = Invoke-RestMethod -Uri "$baseUrl/health" -Method Get -ErrorAction Stop
    if ($response.success -eq $true) {
        Write-Host "✅ PASSED - Server is running" -ForegroundColor Green
        Write-Host "   Environment: $($response.environment)" -ForegroundColor Gray
        $passedTests++
    } else {
        Write-Host "❌ FAILED - Unexpected response" -ForegroundColor Red
    }
} catch {
    Write-Host "❌ FAILED - Cannot connect to server" -ForegroundColor Red
    Write-Host "   Error: $($_.Exception.Message)" -ForegroundColor Red
}
Write-Host ""

# Test 2: Get All Words
Write-Host "Test 2: Get All Words (Paginated)" -ForegroundColor Yellow
$totalTests++
try {
    $response = Invoke-RestMethod -Uri "$baseUrl/api/words?limit=5" -Method Get -ErrorAction Stop
    if ($response.success -eq $true -and $response.data.words.Count -eq 5) {
        Write-Host "✅ PASSED - Retrieved $($response.data.words.Count) words" -ForegroundColor Green
        Write-Host "   Total in DB: $($response.data.pagination.totalWords)" -ForegroundColor Gray
        Write-Host "   First word: $($response.data.words[0].arabic) ($($response.data.words[0].transliteration))" -ForegroundColor Gray
        $passedTests++
    } else {
        Write-Host "❌ FAILED - Expected 5 words" -ForegroundColor Red
    }
} catch {
    Write-Host "❌ FAILED - $($_.Exception.Message)" -ForegroundColor Red
}
Write-Host ""

# Test 3: Get Word by ID
Write-Host "Test 3: Get Specific Word by ID" -ForegroundColor Yellow
$totalTests++
try {
    $response = Invoke-RestMethod -Uri "$baseUrl/api/words/1" -Method Get -ErrorAction Stop
    if ($response.success -eq $true -and $response.data.id -eq 1) {
        Write-Host "✅ PASSED - Retrieved word ID 1" -ForegroundColor Green
        Write-Host "   Arabic: $($response.data.arabic)" -ForegroundColor Gray
        Write-Host "   Translation: $($response.data.translation)" -ForegroundColor Gray
        Write-Host "   Frequency: $($response.data.frequency)" -ForegroundColor Gray
        $passedTests++
    } else {
        Write-Host "❌ FAILED - Word not found" -ForegroundColor Red
    }
} catch {
    Write-Host "❌ FAILED - $($_.Exception.Message)" -ForegroundColor Red
}
Write-Host ""

# Test 4: Search Words
Write-Host "Test 4: Search Words" -ForegroundColor Yellow
$totalTests++
try {
    $response = Invoke-RestMethod -Uri "$baseUrl/api/words/search/Allah" -Method Get -ErrorAction Stop
    if ($response.success -eq $true) {
        Write-Host "✅ PASSED - Search completed" -ForegroundColor Green
        Write-Host "   Found: $($response.data.count) results" -ForegroundColor Gray
        $passedTests++
    } else {
        Write-Host "❌ FAILED - Search failed" -ForegroundColor Red
    }
} catch {
    Write-Host "❌ FAILED - $($_.Exception.Message)" -ForegroundColor Red
}
Write-Host ""

# Test 5: Test 404 Handler
Write-Host "Test 5: 404 Not Found Handler" -ForegroundColor Yellow
$totalTests++
try {
    $response = Invoke-RestMethod -Uri "$baseUrl/api/nonexistent" -Method Get -ErrorAction Stop
    Write-Host "❌ FAILED - Should return 404" -ForegroundColor Red
} catch {
    if ($_.Exception.Response.StatusCode -eq 404) {
        Write-Host "✅ PASSED - 404 handler working" -ForegroundColor Green
        $passedTests++
    } else {
        Write-Host "❌ FAILED - Wrong status code" -ForegroundColor Red
    }
}
Write-Host ""

# Test 6: Quran API Health (May fail without credentials)
Write-Host "Test 6: Quran API Health Check" -ForegroundColor Yellow
Write-Host "   (This may fail if you haven't added QF credentials)" -ForegroundColor Gray
$totalTests++
try {
    $response = Invoke-RestMethod -Uri "$baseUrl/api/quran/health" -Method Get -ErrorAction Stop
    if ($response.success -eq $true) {
        Write-Host "✅ PASSED - Quran API accessible" -ForegroundColor Green
        Write-Host "   Environment: $($response.data.environment)" -ForegroundColor Gray
        Write-Host "   Token Valid: $($response.data.tokenValid)" -ForegroundColor Gray
        $passedTests++
    } else {
        Write-Host "⚠️  WARNING - Quran API not accessible (check credentials)" -ForegroundColor Yellow
    }
} catch {
    Write-Host "⚠️  WARNING - Quran API not configured (add QF credentials to .env)" -ForegroundColor Yellow
}
Write-Host ""

# Test 7: Protected Endpoint (Should fail without token)
Write-Host "Test 7: Protected Endpoint (Without Auth)" -ForegroundColor Yellow
$totalTests++
try {
    $response = Invoke-RestMethod -Uri "$baseUrl/api/words/learn" -Method Get -ErrorAction Stop
    Write-Host "❌ FAILED - Should require authentication" -ForegroundColor Red
} catch {
    if ($_.Exception.Response.StatusCode -eq 401) {
        Write-Host "✅ PASSED - Authentication required (as expected)" -ForegroundColor Green
        $passedTests++
    } else {
        Write-Host "❌ FAILED - Wrong status code" -ForegroundColor Red
    }
}
Write-Host ""

# Summary
Write-Host "================================================" -ForegroundColor Cyan
Write-Host "📊 Test Summary" -ForegroundColor Cyan
Write-Host "================================================" -ForegroundColor Cyan
Write-Host "Passed: $passedTests / $totalTests" -ForegroundColor $(if ($passedTests -eq $totalTests) { "Green" } else { "Yellow" })
Write-Host ""

if ($passedTests -eq $totalTests) {
    Write-Host "🎉 All tests passed! Backend is working correctly." -ForegroundColor Green
    Write-Host ""
    Write-Host "Next Steps:" -ForegroundColor Cyan
    Write-Host "1. Add Firebase credentials to test authentication" -ForegroundColor White
    Write-Host "2. Add Quran Foundation API credentials for verse examples" -ForegroundColor White
    Write-Host "3. Import your full word dataset" -ForegroundColor White
    Write-Host "4. Connect your frontend application" -ForegroundColor White
} elseif ($passedTests -ge 5) {
    Write-Host "✅ Core functionality working!" -ForegroundColor Green
    Write-Host "⚠️  Some optional features need configuration" -ForegroundColor Yellow
} else {
    Write-Host "❌ Some tests failed. Check the errors above." -ForegroundColor Red
    Write-Host ""
    Write-Host "Common fixes:" -ForegroundColor Yellow
    Write-Host "- Make sure MongoDB is running" -ForegroundColor White
    Write-Host "- Run 'npm run seed' to populate the database" -ForegroundColor White
    Write-Host "- Check that server is running on port 5000" -ForegroundColor White
}
Write-Host ""
