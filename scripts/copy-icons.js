#!/usr/bin/env node

const fs = require('fs');
const path = require('path');

const sourceDir = path.join(__dirname, '..', 'assets', 'images');
const distAssetsDir = path.join(__dirname, '..', 'dist', 'assets');

console.log('📦 Copying PWA icons...\n');

// 確保目標目錄存在
if (!fs.existsSync(distAssetsDir)) {
  fs.mkdirSync(distAssetsDir, { recursive: true });
}

// 需要複製的圖標文件
const iconFiles = [
  { src: 'icon.png', dest: 'icon.png', desc: 'Main PWA icon' },
  { src: 'favicon.png', dest: 'favicon-32x32.png', desc: 'Favicon 32x32' },
  { src: 'icon.png', dest: 'icon-192x192.png', desc: 'Icon 192x192' },
  { src: 'icon.png', dest: 'icon-512x512.png', desc: 'Icon 512x512' },
  { src: 'android-icon-foreground.png', dest: 'android-icon.png', desc: 'Android icon' },
  { src: 'splash-icon.png', dest: 'splash.png', desc: 'Splash icon' }
];

iconFiles.forEach(({ src, dest, desc }) => {
  const sourcePath = path.join(sourceDir, src);
  const destPath = path.join(distAssetsDir, dest);
  
  try {
    if (fs.existsSync(sourcePath)) {
      fs.copyFileSync(sourcePath, destPath);
      console.log(`✅ ${desc}: ${dest}`);
    } else {
      console.log(`⚠️  Source not found: ${src}`);
    }
  } catch (error) {
    console.error(`❌ Failed to copy ${src}:`, error.message);
  }
});

console.log('\n🎉 Icons copied successfully!');
