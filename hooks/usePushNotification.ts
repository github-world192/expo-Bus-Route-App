import { useEffect, useState } from 'react';
import { Platform } from 'react-native';

interface NotificationPermission {
  granted: boolean;
  denied: boolean;
  prompt: boolean;
}

export default function usePushNotification() {
  const [permission, setPermission] = useState<NotificationPermission>({
    granted: false,
    denied: false,
    prompt: true,
  });
  const [subscription, setSubscription] = useState<PushSubscription | null>(null);
  const [isSupported, setIsSupported] = useState(false);

  useEffect(() => {
    if (Platform.OS !== 'web' || typeof window === 'undefined') {
      return;
    }

    // 檢查瀏覽器是否支援推送通知
    const supported = 'Notification' in window && 
                     'serviceWorker' in navigator && 
                     'PushManager' in window;
    
    setIsSupported(supported);

    if (supported) {
      // 檢查目前的通知權限狀態
      const currentPermission = Notification.permission;
      setPermission({
        granted: currentPermission === 'granted',
        denied: currentPermission === 'denied',
        prompt: currentPermission === 'default',
      });

      // 如果已授權，獲取現有訂閱
      if (currentPermission === 'granted') {
        getExistingSubscription();
      }
    }
  }, []);

  const getExistingSubscription = async () => {
    try {
      const registration = await navigator.serviceWorker.ready;
      const existingSubscription = await registration.pushManager.getSubscription();
      setSubscription(existingSubscription);
    } catch (error) {
      console.error('獲取訂閱失敗:', error);
    }
  };

  const requestPermission = async (): Promise<boolean> => {
    if (Platform.OS !== 'web' || !isSupported) {
      console.log('不支援推送通知');
      return false;
    }

    try {
      const result = await Notification.requestPermission();
      
      setPermission({
        granted: result === 'granted',
        denied: result === 'denied',
        prompt: result === 'default',
      });

      if (result === 'granted') {
        console.log('通知權限已授予');
        await subscribeToPush();
        return true;
      } else {
        console.log('通知權限被拒絕');
        return false;
      }
    } catch (error) {
      console.error('請求通知權限失敗:', error);
      return false;
    }
  };

  const subscribeToPush = async (): Promise<PushSubscription | null> => {
    try {
      const registration = await navigator.serviceWorker.ready;
      
      // 檢查是否已有訂閱
      let pushSubscription = await registration.pushManager.getSubscription();
      
      if (!pushSubscription) {
        // 創建新的訂閱
        // VAPID public key 需要從後端獲取
        const vapidPublicKey = process.env.EXPO_PUBLIC_VAPID_PUBLIC_KEY || '';
        
        if (!vapidPublicKey) {
          console.warn('未設定 VAPID public key');
          // 即使沒有 VAPID key，也可以創建本地通知
        }

        const options: PushSubscriptionOptionsInit = {
          userVisibleOnly: true,
          ...(vapidPublicKey && {
            applicationServerKey: urlBase64ToUint8Array(vapidPublicKey),
          }),
        };

        pushSubscription = await registration.pushManager.subscribe(options);
        console.log('推送訂閱成功:', pushSubscription);
      }

      setSubscription(pushSubscription);
      
      // 將訂閱資訊發送到後端保存（如果需要）
      // await sendSubscriptionToBackend(pushSubscription);
      
      return pushSubscription;
    } catch (error) {
      console.error('訂閱推送失敗:', error);
      return null;
    }
  };

  const unsubscribe = async (): Promise<boolean> => {
    if (!subscription) {
      return false;
    }

    try {
      const success = await subscription.unsubscribe();
      if (success) {
        setSubscription(null);
        console.log('取消訂閱成功');
      }
      return success;
    } catch (error) {
      console.error('取消訂閱失敗:', error);
      return false;
    }
  };

  const showLocalNotification = (title: string, options?: NotificationOptions) => {
    if (Platform.OS !== 'web' || !isSupported || !permission.granted) {
      console.log('無法顯示通知');
      return;
    }

    const defaultOptions: NotificationOptions = {
      icon: '/assets/icon.png',
      badge: '/assets/icon.png',
      //vibrate: [200, 100, 200],
      ...options,
    };

    new Notification(title, defaultOptions);
  };

  return {
    isSupported,
    permission,
    subscription,
    requestPermission,
    subscribeToPush,
    unsubscribe,
    showLocalNotification,
  };
}

// 輔助函數：將 base64 字串轉換為 Uint8Array
function urlBase64ToUint8Array(base64String: string): Uint8Array {
  const padding = '='.repeat((4 - (base64String.length % 4)) % 4);
  const base64 = (base64String + padding)
    .replace(/\-/g, '+')
    .replace(/_/g, '/');

  const rawData = window.atob(base64);
  const outputArray = new Uint8Array(rawData.length);

  for (let i = 0; i < rawData.length; ++i) {
    outputArray[i] = rawData.charCodeAt(i);
  }
  return outputArray;
}
