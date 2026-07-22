$extractPath = "temp_xlsx"

# 1. Load shared strings cleanly
$ssPath = Join-Path $extractPath "xl/sharedStrings.xml"
$sharedStrings = @()
if (Test-Path $ssPath) {
    [xml]$ssXml = Get-Content -Path $ssPath -Encoding UTF8
    $siNodes = $ssXml.SelectNodes("//*[local-name()='si']")
    foreach ($si in $siNodes) {
        $sharedStrings += $si.InnerText
    }
}
Write-Host "Loaded $($sharedStrings.Count) shared strings."

# 2. Parse workbook.xml & rels
$wbPath = Join-Path $extractPath "xl/workbook.xml"
[xml]$wbXml = Get-Content -Path $wbPath -Encoding UTF8
$sheets = $wbXml.SelectNodes("//*[local-name()='sheet']")

$wbRelsPath = Join-Path $extractPath "xl/_rels/workbook.xml.rels"
$relsMap = @{}
if (Test-Path $wbRelsPath) {
    [xml]$relsXml = Get-Content -Path $wbRelsPath -Encoding UTF8
    $rels = $relsXml.SelectNodes("//*[local-name()='Relationship']")
    foreach ($rel in $rels) {
        $relsMap[$rel.Id] = $rel.Target
    }
}

# 3. Process each sheet
$summaryOutput = @()

foreach ($sheet in $sheets) {
    $sheetName = $sheet.name
    $rId = $sheet.Attributes | Where-Object { $_.LocalName -eq 'id' } | Select-Object -ExpandProperty Value
    $targetPath = $relsMap[$rId]
    $sheetXmlPath = Join-Path $extractPath "xl/$targetPath"
    
    $summaryOutput += "=========================================================="
    $summaryOutput += "SHEET NAME: $sheetName (File: $targetPath)"
    $summaryOutput += "=========================================================="
    
    if (Test-Path $sheetXmlPath) {
        [xml]$sheetXml = Get-Content -Path $sheetXmlPath -Encoding UTF8
        $rows = $sheetXml.SelectNodes("//*[local-name()='row']")
        $summaryOutput += "Total Rows with Data: $($rows.Count)"
        
        # Print sample rows (headers + first 10 data rows)
        $printed = 0
        foreach ($row in $rows) {
            $rowNum = [int]($row.r)
            $cells = $row.SelectNodes(".//*[local-name()='c']")
            $cellTexts = @()
            
            foreach ($c in $cells) {
                $cellRef = $c.r
                $typeAttr = $c.Attributes | Where-Object { $_.LocalName -eq 't' } | Select-Object -ExpandProperty Value
                $vNode = $c.SelectSingleNode("*[local-name()='v']")
                $cellVal = ""
                
                if ($vNode) {
                    $rawV = $vNode.InnerText
                    if ($typeAttr -eq "s") {
                        $idx = [int]$rawV
                        if ($idx -lt $sharedStrings.Count) {
                            $cellVal = $sharedStrings[$idx]
                        } else {
                            $cellVal = "[String Index $idx Out of Range]"
                        }
                    } else {
                        $cellVal = $rawV
                    }
                }
                
                # Clean up newlines for readable single-line display
                $cleanVal = $cellVal -replace "\r?\n", " "
                if ($cleanVal -ne "") {
                    $cellTexts += "$($cellRef): $cleanVal"
                }
            }
            
            if ($cellTexts.Count -gt 0) {
                # We print if rowNum <= 40 or if we haven't printed 15 sample rows yet
                if ($rowNum -le 40 -or $printed -lt 15) {
                    $summaryOutput += "Row $($rowNum): " + ($cellTexts -join " | ")
                    if ($rowNum -gt 40) { $printed++ }
                }
            }
        }
    } else {
        $summaryOutput += "Sheet XML file not found!"
    }
    $summaryOutput += ""
}

$summaryOutput | Out-File -FilePath "sheets_summary.txt" -Encoding UTF8
Write-Host "sheets_summary.txt written successfully."
