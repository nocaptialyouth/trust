$jsonPath = "initial_data.json"
$jsPath = "initial_data.js"

if (Test-Path $jsonPath) {
    Write-Host "Converting initial_data.json to initial_data.js..."
    $jsonContent = Get-Content -Path $jsonPath -Raw -Encoding UTF8
    $jsContent = "window.INITIAL_DATA = " + $jsonContent + ";"
    $jsContent | Out-File -FilePath $jsPath -Encoding UTF8
    Write-Host "Successfully generated initial_data.js"
} else {
    Write-Host "initial_data.json not found"
}
