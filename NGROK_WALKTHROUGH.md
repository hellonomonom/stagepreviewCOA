# ngrok Setup - Step-by-Step Walkthrough

## 🎯 Goal
Get HTTPS URL so you can test VR on Quest 3 and Vision Pro.

---

## ✅ Step 1: Download ngrok

1. **Open your web browser**

2. **Go to:** https://ngrok.com/download

3. **Click the Windows download button**
   - It will download `ngrok-v3-windows-amd64.zip` (or similar)

4. **Wait for download to finish**

**✅ Done with Step 1?** Let me know when you've downloaded it!

---

## ✅ Step 2: Extract ngrok

1. **Find the downloaded file** (usually in Downloads folder)
   - File name: `ngrok-v3-windows-amd64.zip`

2. **Right-click** the `.zip` file

3. **Click "Extract All..."**

4. **Choose extraction location:**
   - Example: `C:\ngrok\`
   - Click "Extract"

5. **Open the extracted folder**
   - You should see `ngrok.exe` file

**✅ Done with Step 2?** Let me know when you see `ngrok.exe`!

---

## ✅ Step 3: Create Free ngrok Account

1. **Go to:** https://dashboard.ngrok.com/signup

2. **Sign up:**
   - Use email or GitHub
   - Create free account

3. **After signup, you'll be on dashboard**
   - Look for "Your Authtoken" section

4. **Copy your authtoken** (long string of letters/numbers)
   - Looks like: `2abc123def456ghi789...`
   - **Keep this safe!**

**✅ Done with Step 3?** Do you have your authtoken copied?

---

## ✅ Step 4: Configure ngrok

1. **Open PowerShell** (Windows Search → "PowerShell")

2. **Navigate to ngrok folder:**
   ```powershell
   cd C:\ngrok
   ```
   (Or wherever you extracted ngrok)

3. **Run authtoken command:**
   ```powershell
   .\ngrok.exe config add-authtoken YOUR_AUTHTOKEN_HERE
   ```
   Replace `YOUR_AUTHTOKEN_HERE` with the token you copied!

4. **Should see:** "Authtoken saved to configuration file"

**✅ Done with Step 4?** Did you see the success message?

---

## ✅ Step 5: Start Your Dev Server

1. **Open terminal in your project folder**

2. **Run:**
   ```bash
   npm run dev
   ```

3. **Wait for it to start**
   - Should see: `VITE v5.x.x ready in xxx ms`
   - Should see: `Local: http://localhost:3000/`

4. **Leave this terminal running!** ⚠️ Don't close it!

**✅ Done with Step 5?** Is your dev server running?

---

## ✅ Step 6: Start ngrok (NEW Terminal)

1. **Open a NEW terminal/PowerShell window**
   - Keep dev server terminal open!

2. **Navigate to ngrok folder:**
   ```powershell
   cd C:\ngrok
   ```

3. **Start ngrok:**
   ```powershell
   .\ngrok.exe http 3000
   ```

4. **You should see:**
   ```
   ngrok
   
   Session Status                online
   Forwarding                    https://abc123-def456.ngrok.io -> http://localhost:3000
   ```

5. **Copy the HTTPS URL:**
   - It's the part after "Forwarding"
   - Example: `https://abc123-def456.ngrok.io`

**✅ Done with Step 6?** What HTTPS URL do you see?

---

## ✅ Step 7: Test on Quest 3

1. **Put on Quest 3**

2. **Open Quest Browser**

3. **Type your ngrok HTTPS URL:**
   - Example: `https://abc123-def456.ngrok.io`
   - Press Enter

4. **Your app should load!**

5. **Look for VR button** (bottom-right corner)

6. **Click "Enter VR"** 🎉

**✅ Done with Step 7?** Did it work?

---

## 🆘 Need Help?

If you're stuck at any step, just tell me:
- Which step you're on
- What you see (any error messages?)
- What's not working

I'll help you through it! 🚀

---

## Quick Checklist

- [ ] Downloaded ngrok
- [ ] Extracted to folder (have ngrok.exe)
- [ ] Created ngrok account
- [ ] Got authtoken
- [ ] Configured authtoken
- [ ] Dev server running
- [ ] ngrok running (shows HTTPS URL)
- [ ] Tested on Quest 3











