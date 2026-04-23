# Remote SSH execution using .NET TcpClient + SSH protocol via paramiko-like approach
# Since we don't have sshpass, we'll use a different method

$server = "62.210.92.252"
$port = 22
$user = "root"
$pass = "Kia2014x"

# Try using Posh-SSH if available
if (Get-Module -ListAvailable -Name Posh-SSH) {
    Write-Host "Using Posh-SSH"
    $secPass = ConvertTo-SecureString $pass -AsPlainText -Force
    $cred = New-Object System.Management.Automation.PSCredential($user, $secPass)
    $session = New-SSHSession -ComputerName $server -Port $port -Credential $cred -AcceptKey
    
    $commands = @(
        "echo '=== STEP 1: Check environment ==='",
        "python3 --version",
        "ls /var/www/vod-manager/venv/bin/activate && echo VENV_EXISTS || echo NO_VENV",
        "echo '=== STEP 2: Install playwright in venv ==='",
        "source /var/www/vod-manager/venv/bin/activate && pip install playwright 2>&1 | tail -5",
        "echo '=== STEP 3: Install Chromium with deps ==='",
        "source /var/www/vod-manager/venv/bin/activate && playwright install --with-deps chromium 2>&1 | tail -20",
        "echo '=== STEP 4: Test import ==='",
        "source /var/www/vod-manager/venv/bin/activate && python3 -c 'from playwright.sync_api import sync_playwright; print(\"PLAYWRIGHT_OK\")'",
        "echo '=== STEP 5: Restart services ==='",
        "systemctl restart vod-manager-api vod-manager-worker",
        "sleep 3",
        "systemctl is-active vod-manager-api",
        "systemctl is-active vod-manager-worker"
    )
    
    foreach ($cmd in $commands) {
        $result = Invoke-SSHCommand -SessionId $session.SessionId -Command $cmd
        Write-Host $result.Output
        if ($result.ExitStatus -ne 0) {
            Write-Host "ERROR: $($result.Error)"
        }
    }
    
    Remove-SSHSession -SessionId $session.SessionId
} else {
    Write-Host "Posh-SSH not found. Installing..."
    Install-Module -Name Posh-SSH -Force -Scope CurrentUser
    Write-Host "Please run this script again after installation."
}
