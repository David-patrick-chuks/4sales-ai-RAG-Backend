# Generate secure Redis password
$chars = "abcdefghijklmnopqrstuvwxyzABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789"
$password = ""
for ($i = 0; $i -lt 16; $i++) {
    $password += $chars[(Get-Random -Maximum $chars.Length)]
}
Write-Host "Generated Redis Password: $password" 