#!/usr/bin/env node

const fs = require('fs');
const path = require('path');

const distDir = path.join(__dirname, '..', 'dist');
const htmlFiles = ['index.html', 'map.html', 'route.html', 'search.html', 'stop.html', '+not-found.html', '_sitemap.html'];

const metaTags = `
  <!-- PWA Manifest -->
  <link rel="manifest" href="/manifest.json">
  
  <!-- iOS PWA Meta Tags -->
  <meta name="apple-mobile-web-app-capable" content="yes">
  <meta name="apple-mobile-web-app-status-bar-style" content="black-translucent">
  <meta name="apple-mobile-web-app-title" content="台北公車">
  <meta name="mobile-web-app-capable" content="yes">
  
  <!-- iOS Icons - Multiple sizes for better quality -->
  <link rel="apple-touch-icon" href="/assets/icon.png">
  <link rel="apple-touch-icon" sizes="120x120" href="/assets/icon.png">
  <link rel="apple-touch-icon" sizes="152x152" href="/assets/icon.png">
  <link rel="apple-touch-icon" sizes="167x167" href="/assets/icon.png">
  <link rel="apple-touch-icon" sizes="180x180" href="/assets/icon.png">
  <link rel="apple-touch-icon" sizes="1024x1024" href="/assets/icon.png">
  
  <!-- Favicon -->
  <link rel="icon" type="image/png" sizes="32x32" href="/assets/favicon-32x32.png">
  <link rel="shortcut icon" href="/assets/icon.png">
  
  <!-- Theme Color -->
  <meta name="theme-color" content="#6F73F8">
  <meta name="msapplication-TileColor" content="#6F73F8">
  <meta name="msapplication-TileImage" content="/assets/icon.png">
`;

console.log('🔧 Adding PWA meta tags to HTML files...\n');

htmlFiles.forEach(filename => {
  const filePath = path.join(distDir, filename);
  
  if (!fs.existsSync(filePath)) {
    console.log(`⚠️  Skipping ${filename} (not found)`);
    return;
  }
  
  let html = fs.readFileSync(filePath, 'utf8');
  
  // Check if meta tags already exist
  if (html.includes('apple-mobile-web-app-capable')) {
    console.log(`✓ ${filename} already has PWA meta tags`);
    return;
  }
  
  // Insert meta tags before </head>
  html = html.replace('</head>', `${metaTags}\n</head>`);
  
  fs.writeFileSync(filePath, html, 'utf8');
  console.log(`✅ Added PWA meta tags to ${filename}`);
});

console.log('\n🎉 Done!');
