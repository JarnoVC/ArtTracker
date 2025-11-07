# Quick Fix for GitHub Authentication

## ✅ Step 1: I've Already Removed the Old Credentials

The cached "pdsseu" credentials have been removed from Windows Credential Manager.

## Step 2: Create a Personal Access Token

1. **Go to GitHub Settings**:
   - Visit: https://github.com/settings/tokens/new?type=beta
   - Or go to: https://github.com/settings/tokens → "Generate new token (classic)"

2. **Fill in the form**:
   - **Note**: `ArtTracker Development`
   - **Expiration**: Choose "90 days" or "No expiration" (for convenience)
   - **Scopes**: Check `repo` (this gives full access to repositories)

3. **Click "Generate token"**

4. **COPY THE TOKEN** (it looks like: `ghp_xxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxx`)
   - ⚠️ **Important**: You won't be able to see this token again!

## Step 3: Use the Token to Push

### Option A: Git Credential Manager (Recommended)

When you run `git push`, Git will prompt you for credentials:
- **Username**: `JarnoVC`
- **Password**: Paste your Personal Access Token (NOT your GitHub password)

### Option B: Store Token in Git Remote URL (Quick but less secure)

Run this command (replace `YOUR_TOKEN` with your actual token):

```powershell
git remote set-url origin https://YOUR_TOKEN@github.com/JarnoVC/ArtTracker.git
```

Then push:
```powershell
git push -u origin main
```

⚠️ **Warning**: This stores the token in plain text in your Git config. Only do this on a secure machine.

### Option C: Use SSH (Most Secure)

1. **Check if you have SSH keys**:
   ```powershell
   Test-Path ~/.ssh/id_ed25519.pub
   ```

2. **If not, create one**:
   ```powershell
   ssh-keygen -t ed25519 -C "Jarno.vanclemene@hotmail.com"
   ```
   - Press Enter to accept defaults
   - Optionally set a passphrase

3. **Copy your public key**:
   ```powershell
   Get-Content ~/.ssh/id_ed25519.pub | Set-Clipboard
   ```

4. **Add to GitHub**:
   - Go to: https://github.com/settings/keys
   - Click "New SSH key"
   - Title: "My Windows PC"
   - Paste the key
   - Click "Add SSH key"

5. **Change remote to SSH**:
   ```powershell
   git remote set-url origin git@github.com:JarnoVC/ArtTracker.git
   ```

6. **Test and push**:
   ```powershell
   ssh -T git@github.com
   git push -u origin main
   ```

## Step 4: Verify Everything Works

After setting up authentication, test with:

```powershell
git push -u origin main
```

You should see your code being pushed successfully!

## Troubleshooting

**Still getting 403 error?**
- Make sure you're using a Personal Access Token, not your GitHub password
- Check that the token has `repo` scope enabled
- Verify you're logged into GitHub as `JarnoVC`, not `pdsseu`

**Token expired?**
- Create a new token and update your credentials

**Want to use SSH but having issues?**
- Make sure your SSH key is added to your GitHub account
- Test with: `ssh -T git@github.com`

