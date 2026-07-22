$xlsxPath = "data.xlsx"
$zipPath = "data.zip"
$extractPath = "temp_xlsx"

# Remove existing temp folder and zip if they exist
if (Test-Path $extractPath) {
    Remove-Item -Path $extractPath -Recurse -Force
}
if (Test-Path $zipPath) {
    Remove-Item -Path $zipPath -Force
}

# Copy to data.zip
Copy-Item -Path $xlsxPath -Destination $zipPath

# Extract ZIP
Write-Host "Extracting ZIP archive..."
Expand-Archive -Path $zipPath -DestinationPath $extractPath

# Function to parse shared strings
$sharedStrings = @()
$ssPath = Join-Path $extractPath "xl/sharedStrings.xml"
if (Test-Path $ssPath) {
    Write-Host "Parsing shared strings..."
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
Write-Host "Found $($sharedStrings.Count) shared strings."

# Parse workbook.xml to list sheets
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
$output += "Workbook Sheets:"
foreach ($sheet in $sheets) {
    $sheetName = $sheet.name
    $rId = $sheet.Attributes | Where-Object { $_.LocalName -eq 'id' } | Select-Object -ExpandProperty Value
    $output += " - Name: $sheetName (rId: $rId)"
}
$output += ""

$output += "--- Sheet details ---"
foreach ($sheet in $sheets) {
    $sheetName = $sheet.name
    $rId = $sheet.Attributes | Where-Object { $_.LocalName -eq 'id' } | Select-Object -ExpandProperty Value
    $targetPath = $relsMap[$rId]
    $sheetXmlPath = Join-Path $extractPath "xl/$targetPath"
    $output += "Sheet Name: $sheetName (Path: xl/$targetPath)"
    
    if (Test-Path $sheetXmlPath) {
        [xml]$sheetXml = Get-Content -Path $sheetXmlPath -Encoding UTF8
        # Cells are under worksheet.sheetData.row
        $rows = $sheetXml.worksheet.sheetData.row
        $output += "  Total Rows: $($rows.Count)"
        
        # Print first 20 rows of each sheet to get the headers and structure
        $rowCount = 0
        foreach ($row in $rows) {
            if ($rowCount -ge 20) { break }
            $rowNum = $row.r
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
                        } else {
                            $cellVal = "[String Index $idx Out of Range]"
                        }
                    } else {
                        $cellVal = $v
                    }
                }
                $cellsList += "$($cellRef):$($cellVal)"
            }
            $output += "    Row $($rowNum): " + ($cellsList -join ", ")
            $rowCount++
        }
    } else {
        $output += "  Sheet file not found at $sheetXmlPath"
    }
    $output += ""
}

$output | Out-File -FilePath "inspect_result.txt" -Encoding UTF8
Write-Host "Inspection result written to inspect_result.txt"

# Clean up data.zip
if (Test-Path $zipPath) {
    Remove-Item -Path $zipPath -Force
}
