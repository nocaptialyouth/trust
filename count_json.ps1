$json = Get-Content -Path "initial_data.json" -Raw -Encoding UTF8 | ConvertFrom-Json
Write-Host "Master Patients Count in JSON: $($json.masterPatients.Count)"
Write-Host "Transactions Count in JSON: $($json.transactions.Count)"

# Check last master patient
if ($json.masterPatients.Count -gt 0) {
    $lastP = $json.masterPatients[$json.masterPatients.Count - 1]
    Write-Host "Last Master Patient in JSON: Seq=$($lastP.seq), Name=$($lastP.name), ResidentNo=$($lastP.residentNo)"
}

# Check last transaction
if ($json.transactions.Count -gt 0) {
    $lastTx = $json.transactions[$json.transactions.Count - 1]
    Write-Host "Last Transaction in JSON: Name=$($lastTx.patientName), Date=$($lastTx.treatmentDate), Amount=$($lastTx.amount)"
}
