$extractPath = "temp_xlsx"
$ssPath = Join-Path $extractPath "xl/sharedStrings.xml"

if (Test-Path $ssPath) {
    [xml]$ssXml = Get-Content -Path $ssPath -Encoding UTF8
    $siNodes = $ssXml.sst.si
    Write-Host "Total si nodes: $($siNodes.Count)"
    
    $output = @()
    $output += "First 100 shared strings:"
    for ($i = 0; $i -lt 100 -and $i -lt $siNodes.Count; $i++) {
        $si = $siNodes[$i]
        $val = ""
        if ($si.t) {
            $val = $si.t.InnerText
        } elseif ($si.r) {
            $runText = ""
            foreach ($r in $si.r) {
                if ($r.t) {
                    $runText += $r.t.InnerText
                }
            }
            $val = $runText
        }
        $output += "$($i): $val"
    }
    $output | Out-File -FilePath "ss_debug.txt" -Encoding UTF8
    Write-Host "ss_debug.txt written."
} else {
    Write-Host "sharedStrings.xml not found"
}
