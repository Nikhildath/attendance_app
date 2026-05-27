$file = 'src/routes/settings.tsx'
$content = Get-Content $file -Raw
$content = $content -replace '</div                 <div className="grid gap-6">', "</div>`n`n                 <div className=`"grid gap-6`">"
Set-Content $file -Value $content -NoNewline
Write-Host "Fixed line 324"
