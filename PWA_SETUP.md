# PWA 設置指南

## 準備工作完成度
✅ app.json 已配置 PWA 設定
✅ package.json 已添加建置腳本
⚠️ 需要準備圖示檔案

## 需要的圖示檔案

在 `assets/images/` 目錄下需要以下檔案：

1. **icon.png** - 1024x1024 px（應用圖示）
2. **adaptive-icon.png** - 1024x1024 px（Android 適配圖示）
3. **favicon.png** - 48x48 px（網頁瀏覽器圖示）
4. **splash.png** - 1284x2778 px（啟動畫面）

### 快速生成圖示
您可以使用這些免費工具：
- https://www.figma.com/（設計）
- https://favicon.io/（生成 favicon）
- https://appicon.co/（生成各尺寸圖示）

## 建置 PWA

### 1. 本地測試
```bash
npm run web
```
在瀏覽器開啟 http://localhost:8081

### 2. 建置生產版本
```bash
npm run build:web
```
建置結果會在 `dist/` 目錄

**注意**：Expo SDK 54+ 使用 Metro bundler，建置命令為 `expo export --platform web`

### 3. 部署到免費平台

#### 方案 A: Vercel（推薦）
```bash
# 1. 安裝 Vercel CLI（一次性）
npm install -g vercel

# 2. 建置專案
npm run build:web

# 3. 部署（在專案根目錄執行）
vercel --prod

# Vercel 會自動偵測 dist/ 目錄並部署
# 首次部署會要求：
# - 登入 Vercel 帳號（可用 GitHub 登入）
# - 確認專案設定
# - 選擇專案名稱
```

**重要**：不需要 cd 到 dist 目錄，直接在專案根目錄執行 `vercel --prod` 即可。

**後續更新**：
```bash
npm run build:web
vercel --prod
```

#### 方案 B: Netlify
```bash
# 安裝 Netlify CLI
npm install -g netlify-cli

# 部署
cd dist
netlify deploy --prod
```

#### 方案 C: GitHub Pages
1. 將 dist/ 內容推送到 GitHub 倉庫的 gh-pages 分支
2. 在倉庫設定中啟用 GitHub Pages

## 用戶使用方式

### iOS (Safari)
1. 開啟網址
2. 點擊分享按鈕
3. 選擇「加入主畫面」
4. 應用會出現在主畫面，可像原生 app 一樣開啟

### Android (Chrome)
1. 開啟網址
2. 點擊選單（三個點）
3. 選擇「安裝應用程式」或「加到主畫面」
4. 應用會出現在主畫面

## 注意事項

### PWA 已支援的功能
✅ 地圖顯示（使用 Google Maps API）
✅ 定位功能（需用戶授權）
✅ 公車動態查詢
✅ 路線規劃
✅ 離線基本功能（需配置 Service Worker）

### PWA 限制
⚠️ react-native-maps 在 web 上使用替代方案（您已實作 map.tsx）
⚠️ 某些原生動畫效果可能不同
⚠️ iOS Safari 的 PWA 功能較受限（無推送通知等）

## 後續優化

### 添加 Service Worker（離線支援）
```bash
npx expo install @expo/webpack-config
```
然後在 app.json 添加：
```json
"web": {
  "serviceWorker": {
    "enabled": true
  }
}
```

### 添加 Web Push 通知
需要額外配置推送服務（Firebase Cloud Messaging 等）

## 成本分析
- 建置：**免費**
- 部署（Vercel/Netlify）：**免費**
- 維護更新：**免費**
- 無需 Apple/Google 開發者帳號：**免費**

**總成本：$0**
