# 🏍️ Highway Speedster - Local Setup Guide

## Quick Setup on Mac

### Step 1: Create Project
```bash
cd ~/Desktop
npm create vite@latest highway-speedster -- --template react-ts
cd highway-speedster
```

### Step 2: Install Dependencies
```bash
npm install
npm install three @react-three/fiber @react-three/drei zustand
npm install -D @types/three
```

### Step 3: Download Project Files

Since your project is built in this web environment, you have two options:

**Option A: Download from GitHub (After Push)**
Once you push to GitHub, you can clone it anywhere.

**Option B: Manual Copy**
Copy the files from this chat to your local project:
- src/App.tsx
- src/game/Scene.tsx
- src/game/UI.tsx
- src/game/store.ts
- src/index.css
- index.html

### Step 4: Push to GitHub
```bash
git init
git add .
git commit -m "Highway Speedster - 3D motorcycle racer"
git branch -M main
git remote add origin https://github.com/YOUR_USERNAME/highway-speedster.git
git push -u origin main
```

### Step 5: Deploy to Vercel
1. Go to vercel.com
2. Import your GitHub repo
3. Click Deploy
4. Get your live link!

---

## Alternative: Use This Web Environment

Your game is already built and working here! You can:
1. Share the preview link directly
2. Download the built files from the dist/ folder
3. Deploy directly from here if the platform supports it

The game is fully functional with:
- ✅ 3D motorcycle racing
- ✅ Tilt controls (mobile) + keyboard (desktop)
- ✅ 3 unlockable bikes (Blitz, Apex, Chronos)
- ✅ Traffic system with collision detection
- ✅ Score system with combos
- ✅ Beautiful UI with garage, menus, HUD
