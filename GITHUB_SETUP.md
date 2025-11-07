# Fixing GitHub Authentication Issue

## The Problem
Git is trying to use credentials for "pdsseu" instead of "JarnoVC". This is because Windows has cached old GitHub credentials.

## Solution Steps

### Option 1: Clear Windows Credentials (Recommended)

1. **Open Windows Credential Manager**:
   - Press `Win + R`
   - Type: `control /name Microsoft.CredentialManager`
   - Press Enter

2. **Go to "Windows Credentials" tab**

3. **Find and remove any GitHub entries**:
   - Look for entries like:
     - `git:https://github.com`
     - `github.com`
     - Any entries containing "pdsseu" or "github"
   
4. **Delete those entries** (click the arrow → Remove)

### Option 2: Use GitHub Personal Access Token (More Secure)

1. **Create a Personal Access Token on GitHub**:
   - Go to: https://github.com/settings/tokens
   - Click "Generate new token (classic)"
   - Name it: "ArtTracker Development"
   - Select scopes: `repo` (full control of private repositories)
   - Click "Generate token"
   - **COPY THE TOKEN** (you won't see it again!)

2. **Update Git remote URL** (use the token in the URL):
   ```
   git remote set-url origin https://[YOUR_TOKEN]@github.com/JarnoVC/ArtTracker.git
   ```
   Replace `[YOUR_TOKEN]` with your actual token

3. **Or use SSH instead** (see Option 3)

### Option 3: Use SSH (Best for Long-term)

1. **Check if you have SSH keys**:
   ```powershell
   Test-Path ~/.ssh/id_ed25519.pub
   ```

2. **If no SSH key, create one**:
   ```powershell
   ssh-keygen -t ed25519 -C "Jarno.vanclemene@hotmail.com"
   ```
   - Press Enter to accept default location
   - Optionally set a passphrase

3. **Copy your public key**:
   ```powershell
   Get-Content ~/.ssh/id_ed25519.pub | Set-Clipboard
   ```

4. **Add SSH key to GitHub**:
   - Go to: https://github.com/settings/keys
   - Click "New SSH key"
   - Title: "My Windows PC"
   - Paste the key
   - Click "Add SSH key"

5. **Change remote to SSH**:
   ```powershell
   git remote set-url origin git@github.com:JarnoVC/ArtTracker.git
   ```

6. **Test SSH connection**:
   ```powershell
   ssh -T git@github.com
   ```
   You should see: "Hi JarnoVC! You've successfully authenticated..."

### Quick Fix (Try This First)

Run these commands in PowerShell (as Administrator if needed):

```powershell
# Remove GitHub credentials from Windows Credential Manager
cmdkey /list | Select-String "github" | ForEach-Object {
    $line = $_.Line
    if ($line -match "Target: (.+)") {
        cmdkey /delete:$matches[1]
    }
}

# Then try pushing again - Git will ask for credentials
git push -u origin main
```

When prompted:
- Username: `JarnoVC`
- Password: Use a Personal Access Token (not your GitHub password)

