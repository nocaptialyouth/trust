$extractPath = "temp_xlsx"

# Load shared strings
$ssPath = Join-Path $extractPath "xl/sharedStrings.xml"
$sharedStrings = @()
if (Test-Path $ssPath) {
    [xml]$ssXml = Get-Content -Path $ssPath -Encoding UTF8
    $siNodes = $ssXml.SelectNodes("//*[local-name()='si']")
    foreach ($si in $siNodes) {
        $sharedStrings += $si.InnerText
    }
}
Write-Host "Loaded shared strings count: $($sharedStrings.Count)"

# Parse workbook & rels
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

$masterPatients = @()
$transactions = @()

# Helper to convert Excel serial date to YYYY-MM-DD
function Convert-ExcelDate($val) {
    if ($val -match "^\d+(\.\d+)?$") {
        $num = [double]$val
        if ($num -gt 30000 -and $num -lt 60000) {
            $base = Get-Date "1899-12-30"
            $d = $base.AddDays($num)
            return $d.ToString("yyyy-MM-dd")
        }
    }
    return $val
}

foreach ($sheet in $sheets) {
    $rId = $sheet.Attributes | Where-Object { $_.LocalName -eq 'id' } | Select-Object -ExpandProperty Value
    $targetPath = $relsMap[$rId]
    $sheetXmlPath = Join-Path $extractPath "xl/$targetPath"
    
    if (Test-Path $sheetXmlPath) {
        [xml]$sheetXml = Get-Content -Path $sheetXmlPath -Encoding UTF8
        $rows = $sheetXml.SelectNodes("//*[local-name()='row']")
        
        # sheet2.xml is master patient sheet (추가(A,B찾기))
        if ($targetPath -like "*sheet2.xml*") {
            Write-Host "Processing sheet2 (Master Patients)..."
            foreach ($row in $rows) {
                $rowNum = [int]($row.r)
                if ($rowNum -le 2) { continue }
                
                $cells = $row.SelectNodes(".//*[local-name()='c']")
                $rowMap = @{}
                foreach ($c in $cells) {
                    $col = ($c.r -replace "\d+", "")
                    $typeAttr = $c.Attributes | Where-Object { $_.LocalName -eq 't' } | Select-Object -ExpandProperty Value
                    $vNode = $c.SelectSingleNode("*[local-name()='v']")
                    $val = ""
                    if ($vNode) {
                        $rawV = $vNode.InnerText
                        if ($typeAttr -eq "s") {
                            $idx = [int]$rawV
                            if ($idx -lt $sharedStrings.Count) { $val = $sharedStrings[$idx] }
                        } else {
                            $val = $rawV
                        }
                    }
                    $rowMap[$col] = $val
                }
                
                if ($rowMap['B'] -and $rowMap['B'] -ne "") {
                    $patient = [PSCustomObject]@{
                        id = "P_$($rowNum)"
                        seq = $rowMap['A']
                        name = $rowMap['B']
                        residentNo = $rowMap['C']
                        gender = $rowMap['D']
                        age = $rowMap['E']
                        insuranceType = $rowMap['F']
                        dept = $rowMap['G']
                        bank = if ($rowMap['H'] -eq "0.0" -or $rowMap['H'] -eq "0") { "" } else { $rowMap['H'] }
                        account = if ($rowMap['I'] -eq "0.0" -or $rowMap['I'] -eq "0") { "" } else { $rowMap['I'] }
                        depositor = if ($rowMap['J'] -eq "0.0" -or $rowMap['J'] -eq "0") { "" } else { $rowMap['J'] }
                        contact = if ($rowMap['K'] -eq "0.0" -or $rowMap['K'] -eq "0") { "" } else { $rowMap['K'] }
                        memo = $rowMap['L']
                        idPrefix = $rowMap['M']
                        ward = $rowMap['N']
                    }
                    $masterPatients += $patient
                }
            }
        }
        
        # sheet1.xml is transactions sheet (25~26년)
        if ($targetPath -like "*sheet1.xml*") {
            Write-Host "Processing sheet1 (Transactions)..."
            foreach ($row in $rows) {
                $rowNum = [int]($row.r)
                if ($rowNum -le 4) { continue }
                
                $cells = $row.SelectNodes(".//*[local-name()='c']")
                $rowMap = @{}
                foreach ($c in $cells) {
                    $col = ($c.r -replace "\d+", "")
                    $typeAttr = $c.Attributes | Where-Object { $_.LocalName -eq 't' } | Select-Object -ExpandProperty Value
                    $vNode = $c.SelectSingleNode("*[local-name()='v']")
                    $val = ""
                    if ($vNode) {
                        $rawV = $vNode.InnerText
                        if ($typeAttr -eq "s") {
                            $idx = [int]$rawV
                            if ($idx -lt $sharedStrings.Count) { $val = $sharedStrings[$idx] }
                        } else {
                            $val = $rawV
                        }
                    }
                    $rowMap[$col] = $val
                }
                
                if ($rowMap['B'] -and $rowMap['B'] -ne "") {
                    $tx = [PSCustomObject]@{
                        id = "T_$($rowNum)"
                        patientName = $rowMap['B']
                        treatmentDate = Convert-ExcelDate $rowMap['C']
                        submitDate = Convert-ExcelDate $rowMap['D']
                        amount = if ($rowMap['E']) { [double]($rowMap['E']) } else { 0 }
                        inCharge = $rowMap['F']
                        hospital = $rowMap['G']
                        submitter = $rowMap['H']
                        residentNo = $rowMap['I']
                        insuranceType = $rowMap['J']
                        bank = $rowMap['K']
                        account = $rowMap['L']
                        depositor = $rowMap['M']
                        contact = $rowMap['N']
                        receiptCount = $rowMap['O']
                        remarks = $rowMap['P']
                        adminChecked = if ($rowMap['U'] -eq "1" -or $rowMap['U'] -eq "O") { $true } else { $false }
                        auditChecked = if ($rowMap['W'] -eq "1" -or $rowMap['W'] -eq "O") { $true } else { $false }
                        isError = if ($rowMap['X'] -and $rowMap['X'] -ne "" -and $rowMap['X'] -ne "0") { $true } else { $false }
                    }
                    $transactions += $tx
                }
            }
        }
    }
}

$dataObj = [PSCustomObject]@{
    masterPatients = $masterPatients
    transactions = $transactions
}

$jsonPath = "initial_data.json"
$dataObj | ConvertTo-Json -Depth 5 | Out-File -FilePath $jsonPath -Encoding UTF8
Write-Host "Successfully generated initial_data.json"
