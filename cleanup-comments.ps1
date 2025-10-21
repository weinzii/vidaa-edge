# Intelligent Comment Cleanup Script
# Removes redundant development comments while preserving important architectural notes

$patterns = @(
    # Development artifacts - always remove
    @{ Pattern = '^\s*//\s*✅\s*FIX:\s*.*$'; Description = 'FIX markers' }
    @{ Pattern = '^\s*//\s*✅\s*(?!.*(?:IMPORTANT|Note:|TODO|FIXME)).*$'; Description = 'Checkmark comments (non-important)' }
    
    # Redundant explanations of obvious operations - context-aware removal
    @{ Pattern = '^\s*//\s*This counts (only|files).*$'; Description = 'Obvious counting explanations' }
    @{ Pattern = '^\s*//\s*NOT placeholders.*$'; Description = 'Redundant NOT clarifications' }
    @{ Pattern = '^\s*//\s*Track (timeout|interval|subscription).*$'; Description = 'Obvious tracking comments' }
    @{ Pattern = '^\s*//\s*Store (handle|subscription).*$'; Description = 'Obvious storage comments' }
    @{ Pattern = '^\s*//\s*Clear (all|old).*$'; Description = 'Obvious cleanup comments' }
    @{ Pattern = '^\s*//\s*Unsubscribe from.*$'; Description = 'Obvious unsubscribe comments' }
    @{ Pattern = '^\s*//\s*Cancel existing.*$'; Description = 'Obvious cancel comments' }
    @{ Pattern = '^\s*//\s*Prevent (memory leaks|concurrent).*$'; Description = 'Redundant prevention notes' }
    @{ Pattern = '^\s*//\s*(Increment|Decrement|Reset) (auto-save )?counter.*$'; Description = 'Obvious counter operations' }
    @{ Pattern = '^\s*//\s*Set status to.*$'; Description = 'Obvious status assignments' }
    @{ Pattern = '^\s*//\s*Mark (as|session).*$'; Description = 'Obvious marking operations' }
)

# Directories to process
$directories = @(
    'src\app\services',
    'src\app\components',
    'src\app\models',
    'services'
)

$totalRemoved = 0
$filesModified = 0

Write-Host "`nIntelligent Comment Cleanup" -ForegroundColor Cyan
Write-Host "==========================`n" -ForegroundColor Cyan

foreach ($dir in $directories) {
    $fullPath = Join-Path $PSScriptRoot $dir
    if (-not (Test-Path $fullPath)) { continue }
    
    $files = Get-ChildItem -Path $fullPath -Recurse -Include *.ts,*.js
    
    foreach ($file in $files) {
        $content = Get-Content $file.FullName -Raw
        $originalContent = $content
        $removedInFile = 0
        
        foreach ($pattern in $patterns) {
            $regex = [regex]$pattern.Pattern
            $matches = $regex.Matches($content)
            
            if ($matches.Count -gt 0) {
                # Remove matching lines
                $content = $regex.Replace($content, '')
                $removedInFile += $matches.Count
            }
        }
        
        # Clean up multiple consecutive blank lines (max 2)
        $content = $content -replace '(\r?\n){4,}', "`n`n`n"
        
        if ($content -ne $originalContent) {
            Set-Content -Path $file.FullName -Value $content -NoNewline
            $filesModified++
            $totalRemoved += $removedInFile
            
            $relativePath = $file.FullName.Replace($PSScriptRoot + '\', '')
            Write-Host "  ✓ $relativePath" -ForegroundColor Green
            Write-Host "    Removed $removedInFile redundant comments" -ForegroundColor Gray
        }
    }
}

Write-Host "`n==========================`n" -ForegroundColor Cyan
Write-Host "Summary:" -ForegroundColor Yellow
Write-Host "  Files modified: $filesModified" -ForegroundColor White
Write-Host "  Comments removed: $totalRemoved" -ForegroundColor White
Write-Host "`nImportant architectural comments preserved! ✓`n" -ForegroundColor Green
