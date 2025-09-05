Write-Host "Starting SecBrain Development Server..." -ForegroundColor Green
Write-Host ""
Write-Host "The app will open in your browser at: http://localhost:8000" -ForegroundColor Yellow
Write-Host ""
Write-Host "Press Ctrl+C to stop the server" -ForegroundColor Cyan
Write-Host ""

try {
    npx http-server -p 8000 -o
} catch {
    Write-Host "Error starting server: $_" -ForegroundColor Red
    Write-Host "Make sure Node.js and npm are installed" -ForegroundColor Yellow
}

Read-Host "Press Enter to exit"
