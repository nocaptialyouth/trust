$url = "https://docs.google.com/spreadsheets/d/e/2PACX-1vTglnQ5SSB6mtD3tERFLwtNl8HST0Hwd_jU-XHMTERzher8RSLxTWVOSRfZtPJoTT4xFbriKMF6HHqK/pub?output=xlsx"
$outputPath = "data.xlsx"

Write-Host "Downloading spreadsheet as XLSX..."
Invoke-WebRequest -Uri $url -OutFile $outputPath
Write-Host "Download complete. File saved to $outputPath"
