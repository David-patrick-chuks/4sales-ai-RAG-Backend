# Generate secure production secrets
Write-Host "Generating secure production secrets..." -ForegroundColor Green

# Generate API Token (64 characters)
$chars = "abcdefghijklmnopqrstuvwxyzABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789"
$apiToken = ""
for ($i = 0; $i -lt 64; $i++) {
    $apiToken += $chars[(Get-Random -Maximum $chars.Length)]
}

# Generate Session Secret (64 characters)
$sessionSecret = ""
for ($i = 0; $i -lt 64; $i++) {
    $sessionSecret += $chars[(Get-Random -Maximum $chars.Length)]
}

# Generate JWT Secret (64 characters)
$jwtSecret = ""
for ($i = 0; $i -lt 64; $i++) {
    $jwtSecret += $chars[(Get-Random -Maximum $chars.Length)]
}

Write-Host "Generated API Token: $apiToken" -ForegroundColor Yellow
Write-Host "Generated Session Secret: $sessionSecret" -ForegroundColor Yellow
Write-Host "Generated JWT Secret: $jwtSecret" -ForegroundColor Yellow

Write-Host "`nCopy these values to your .env file:" -ForegroundColor Cyan
Write-Host "AGENT_API_TOKEN=$apiToken" -ForegroundColor White
Write-Host "SESSION_SECRET=$sessionSecret" -ForegroundColor White
Write-Host "JWT_SECRET=$jwtSecret" -ForegroundColor White 