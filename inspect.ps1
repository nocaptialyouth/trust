$path = "C:\Users\user\.gemini\antigravity\brain\62ecab60-7450-48c9-b446-d5fe77ad2114\.system_generated\steps\3\content.md"
$content = [System.IO.File]::ReadAllLines($path, [System.Text.Encoding]::UTF8)
Write-Host "Printing first 45 lines:"
for ($i = 0; $i -lt 45 -and $i -lt $content.Length; $i++) {
    Write-Host "$($i): $($content[$i])"
}
