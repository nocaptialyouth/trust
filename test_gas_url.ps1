$url = "https://script.google.com/macros/s/AKfycbyi0iJclzJWDK1fSEnzSa1AGDHD_YeSlsj9J82XEMTl26UF9EPatP1jv0iJCrpdrghK/exec"
$payload = '{"action":"addTransaction","transaction":{"patientName":"KimChunJa","treatmentDate":"2026-07-22","submitDate":"2026-07-22","amount":20000,"inCharge":"Sim","hospital":"Haebaek","submitter":"Guardian","residentNo":"431225-2******","insuranceType":"1000","bank":"Nonghyup","account":"316-910094-83307","depositor":"Lee","contact":"010-8337-5915","receiptCount":"1","remarks":"Test"}}'

Write-Host "Sending POST request to Google Apps Script URL..."
try {
    $res = Invoke-WebRequest -Uri $url -Method Post -Body $payload -ContentType "application/json" -MaximumRedirection 5
    Write-Host "STATUS CODE:" $res.StatusCode
    Write-Host "RESPONSE BODY:" $res.Content
} catch {
    Write-Host "ERROR ENCOUNTERED:" $_.Exception.Message
    if ($_.Exception.Response) {
        $stream = $_.Exception.Response.GetResponseStream()
        $reader = New-Object System.IO.StreamReader($stream)
        Write-Host "ERROR RESPONSE BODY:" $reader.ReadToEnd()
    }
}
