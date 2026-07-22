$extractPath = "temp_xlsx"

# Load shared strings
$sharedStrings = @()
$ssPath = Join-Path $extractPath "xl/sharedStrings.xml"
if (Test-Path $ssPath) {
    [xml]$ssXml = Get-Content -Path $ssPath -Encoding UTF8
    $siNodes = $ssXml.sst.si
    if ($siNodes) {
        foreach ($si in $siNodes) {
            if ($si.t) {
                $sharedStrings += $si.t.'#text'
            } elseif ($si.r) {
                $runText = ""
                foreach ($r in $si.r) {
                    if ($r.t) {
                        $runText += $r.t.'#text'
                    }
                }
                $sharedStrings += $runText
            } else {
                $sharedStrings += ""
            }
        }
    }
}

# Parse workbook.xml
$wbPath = Join-Path $extractPath "xl/workbook.xml"
[xml]$wbXml = Get-Content -Path $wbPath -Encoding UTF8
$sheets = $wbXml.workbook.sheets.sheet

# Map relation ID to path
$wbRelsPath = Join-Path $extractPath "xl/_rels/workbook.xml.rels"
$relsMap = @{}
if (Test-Path $wbRelsPath) {
    [xml]$relsXml = Get-Content -Path $wbRelsPath -Encoding UTF8
    foreach ($rel in $relsXml.Relationships.Relationship) {
        $relsMap[$rel.Id] = $rel.Target
    }
}

$output = @()
foreach ($sheet in $sheets) {
    $sheetName = $sheet.name
    $rId = $sheet.Attributes | Where-Object { $_.LocalName -eq 'id' } | Select-Object -ExpandProperty Value
    $targetPath = $relsMap[$rId]
    $sheetXmlPath = Join-Path $extractPath "xl/$targetPath"
    
    $output += "========================================="
    $output += "Sheet: $sheetName"
    
    if (Test-Path $sheetXmlPath) {
        [xml]$sheetXml = Get-Content -Path $sheetXmlPath -Encoding UTF8
        $rows = $sheetXml.worksheet.sheetData.row
        $output += "Total Rows: $($rows.Count)"
        
        # Print rows 1 to 50
        foreach ($row in $rows) {
            $rowNum = [int]($row.r)
            if ($rowNum -le 50) {
                $cellsList = @()
                foreach ($c in $row.c) {
                    $cellRef = $c.r
                    $cellVal = ""
                    if ($c.v) {
                        $v = $c.v.'#text'
                        $typeAttr = $c.Attributes | Where-Object { $_.LocalName -eq 't' } | Select-Object -ExpandProperty Value
                        if ($typeAttr -eq "s") {
                            $idx = [int]$v
                            if ($idx -lt $sharedStrings.Count) {
                                $cellVal = $sharedStrings[$idx]
                            }
                        } else {
                            $cellVal = $v
                        }
                    }
                    if ($cellVal -ne "") {
                        $cellsList += "$($cellRef):$($cellVal)"
                    }
                }
                if ($cellsList.Count -gt 0) {
                    $output += "  Row $($rowNum): " + ($cellsList -join ", ")
                }
            }
        }
    } else {
        $output += "File not found"
    }
    $output += ""
}

$output | Out-File -FilePath "headers_result.txt" -Encoding UTF8
Write-Host "Headers saved to headers_result.txt"
