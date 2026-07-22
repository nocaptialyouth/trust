$url = "https://script.google.com/macros/s/AKfycbyi0iJclzJWDK1fSEnzSa1AGDHD_YeSlsj9J82XEMTl26UF9EPatP1jv0iJCrpdrghK/exec"

Write-Host "--- Testing POST Request with text/plain ---"
$jsonBody = '{"action":"addTransaction","transaction":{"patientName":"TestPatient","treatmentDate":"2026-07-22","submitDate":"2026-07-22","amount":50000,"inCharge":"Admin","hospital":"TestHospital","submitter":"Guardian","residentNo":"900101-1000000","insuranceType":"Health","bank":"Pusan","account":"123-456-789","depositor":"TestUser","contact":"010-1234-5678","receiptCount":"1","remarks":"Test"}}'

try {
    $resPost = Invoke-WebRequest -Uri $url -Method Post -Body $jsonBody -ContentType "text/plain;charset=utf-8" -MaximumRedirection 5
    Write-Host "POST Status Code: $($resPost.StatusCode)"
    Write-Host "POST Content: $($resPost.Content)"
} catch {
    Write-Host "POST Error: $($_.Exception.Message)"
}
