import { useEffect } from 'react';
import { Platform } from 'react-native';

export default function ServiceWorkerRegister() {
  useEffect(() => {
    if (Platform.OS !== 'web' || typeof window === 'undefined') {
      return;
    }

    // 檢查瀏覽器是否支援 Service Worker
    if ('serviceWorker' in navigator) {
      window.addEventListener('load', () => {
        navigator.serviceWorker
          .register('/service-worker.js')
          .then((registration) => {
            console.log('Service Worker 註冊成功:', registration.scope);

            // 檢查更新
            registration.addEventListener('updatefound', () => {
              const newWorker = registration.installing;
              if (newWorker) {
                newWorker.addEventListener('statechange', () => {
                  if (newWorker.state === 'installed' && navigator.serviceWorker.controller) {
                    // 新版本可用
                    console.log('新版本 Service Worker 已安裝，等待啟用');
                    // 可以在這裡顯示更新提示
                  }
                });
              }
            });
          })
          .catch((error) => {
            console.error('Service Worker 註冊失敗:', error);
          });
      });
    } else {
      console.log('此瀏覽器不支援 Service Worker');
    }
  }, []);

  // 這個組件不渲染任何內容
  return null;
}
