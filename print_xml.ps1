$ssPath = "temp_xlsx/xl/sharedStrings.xml"
if (Test-Path $ssPath) {
    # Get first 30 lines of sharedStrings.xml
    $lines = Get-Content -Path $ssPath -TotalCount 30
    $lines | Out-File -FilePath "ss_raw_debug.txt" -Encoding UTF8
    Write-Host "Raw XML dumped to ss_raw_debug.txt"
} else {
    Write-Host "File not found"
}
