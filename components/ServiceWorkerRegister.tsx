// components/ServiceWorkerRegister.tsx
import { useEffect } from 'react';
import { Platform } from 'react-native';

export default function ServiceWorkerRegister() {
  useEffect(() => {
    // 1. 環境檢查
    if (Platform.OS !== 'web' || typeof window === 'undefined') {
      return;
    }

    if (!('serviceWorker' in navigator)) {
      console.log('[SW] 此瀏覽器不支援 Service Worker');
      return;
    }

    // 2. 定義註冊函式
    const registerSW = async () => {
      try {
        // 指向 public 資料夾中的 service-worker.js
        const registration = await navigator.serviceWorker.register('/service-worker.js', {
          scope: '/',
        });

        console.log('[SW] 註冊成功，Scope:', registration.scope);

        // 3. 檢查更新 (保持你原有的邏輯)
        registration.addEventListener('updatefound', () => {
          const newWorker = registration.installing;
          if (newWorker) {
            newWorker.addEventListener('statechange', () => {
              if (newWorker.state === 'installed' && navigator.serviceWorker.controller) {
                console.log('[SW] 發現新版本，建議重整頁面');
              }
            });
          }
        });
      } catch (error) {
        console.error('[SW] 註冊失敗:', error);
      }
    };

    // 3. [關鍵修正] 判斷頁面載入狀態，避免錯過時機
    if (document.readyState === 'complete' || document.readyState === 'interactive') {
      registerSW();
    } else {
      window.addEventListener('load', registerSW);
    }
  }, []);

  return null;
}