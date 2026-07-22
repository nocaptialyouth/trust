$ssPath = "temp_xlsx/xl/sharedStrings.xml"

if (Test-Path $ssPath) {
    [xml]$ssXml = Get-Content -Path $ssPath -Encoding UTF8
    $siNodes = $ssXml.SelectNodes("//*[local-name()='si']")
    Write-Host "Total si nodes found with XPath: $($siNodes.Count)"
    
    $output = @()
    $output += "First 50 shared strings with InnerText:"
    for ($i = 0; $i -lt 50 -and $i -lt $siNodes.Count; $i++) {
        $val = $siNodes[$i].InnerText
        $output += "$($i): $val"
    }
    $output | Out-File -FilePath "ss_test_result.txt" -Encoding UTF8
    Write-Host "ss_test_result.txt written."
}
