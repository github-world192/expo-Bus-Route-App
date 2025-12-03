]]import React, { useEffect, useState } from 'react';
import { Platform, StyleSheet, Text, TouchableOpacity, View } from 'react-native';

interface BeforeInstallPromptEvent extends Event {
  prompt: () => Promise<void>;
  userChoice: Promise<{ outcome: 'accepted' | 'dismissed' }>;
}

export default function InstallPWA() {
  const [deferredPrompt, setDeferredPrompt] = useState<BeforeInstallPromptEvent | null>(null);
  const [showInstallBanner, setShowInstallBanner] = useState(false);
  const [isIOS, setIsIOS] = useState(false);
  const [isStandalone, setIsStandalone] = useState(false);

  useEffect(() => {
    if (Platform.OS !== 'web') return;

    // 檢查是否為 iOS
    const userAgent = window.navigator.userAgent.toLowerCase();
    const iOS = /iphone|ipad|ipod/.test(userAgent);
    setIsIOS(iOS);

    // 檢查是否已經安裝（獨立模式）
    const standalone = window.matchMedia('(display-mode: standalone)').matches ||
                      (window.navigator as any).standalone ||
                      document.referrer.includes('android-app://');
    setIsStandalone(standalone);

    // 如果已經安裝，不顯示橫幅
    if (standalone) {
      return;
    }

    // Android Chrome 會觸發這個事件
    const handleBeforeInstallPrompt = (e: Event) => {
      e.preventDefault();
      setDeferredPrompt(e as BeforeInstallPromptEvent);
      setShowInstallBanner(true);
    };

    window.addEventListener('beforeinstallprompt', handleBeforeInstallPrompt);

    // iOS Safari 需要手動顯示提示
    if (iOS && !standalone) {
      // 檢查使用者是否之前關閉過提示
      const dismissed = localStorage.getItem('pwa-install-dismissed');
      if (!dismissed) {
        setShowInstallBanner(true);
      }
    }

    return () => {
      window.removeEventListener('beforeinstallprompt', handleBeforeInstallPrompt);
    };
  }, []);

  const handleInstallClick = async () => {
    if (!deferredPrompt) return;

    // 顯示安裝提示
    await deferredPrompt.prompt();
    
    // 等待使用者選擇
    const { outcome } = await deferredPrompt.userChoice;
    
    if (outcome === 'accepted') {
      console.log('使用者接受安裝 PWA');
    }
    
    // 清除 prompt
    setDeferredPrompt(null);
    setShowInstallBanner(false);
  };

  const handleDismiss = () => {
    setShowInstallBanner(false);
    localStorage.setItem('pwa-install-dismissed', 'true');
  };

  // 不顯示橫幅的情況
  if (!showInstallBanner || isStandalone || Platform.OS !== 'web') {
    return null;
  }

  return (
    <View style={styles.container}>
      <View style={styles.banner}>
        <View style={styles.content}>
          <Text style={styles.icon}>📱</Text>
          <View style={styles.textContainer}>
            <Text style={styles.title}>安裝台北公車 APP</Text>
            {isIOS ? (
              <Text style={styles.description}>
                點擊 <Text style={styles.bold}>分享</Text> 按鈕，選擇 <Text style={styles.bold}>加入主畫面</Text>
              </Text>
            ) : (
              <Text style={styles.description}>
                快速存取、離線使用、獲得通知
              </Text>
            )}
          </View>
        </View>
        
        <View style={styles.actions}>
          {!isIOS && deferredPrompt && (
            <TouchableOpacity
              style={styles.installButton}
              onPress={handleInstallClick}
              activeOpacity={0.7}
            >
              <Text style={styles.installButtonText}>安裝</Text>
            </TouchableOpacity>
          )}
          <TouchableOpacity
            style={styles.dismissButton}
            onPress={handleDismiss}
            activeOpacity={0.7}
          >
            <Text style={styles.dismissButtonText}>✕</Text>
          </TouchableOpacity>
        </View>
      </View>

      {/* iOS 詳細說明 */}
      {isIOS && (
        <View style={styles.iosInstructions}>
          <Text style={styles.iosStep}>1. 點擊底部的 <Text style={styles.shareIcon}>⎋</Text> 分享按鈕</Text>
          <Text style={styles.iosStep}>2. 向下滾動找到「加入主畫面」</Text>
          <Text style={styles.iosStep}>3. 點擊「新增」完成安裝</Text>
        </View>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    position: 'fixed' as any,
    bottom: 0,
    left: 0,
    right: 0,
    zIndex: 1000,
    backgroundColor: 'transparent',
  },
  banner: {
    backgroundColor: '#6F73F8',
    padding: 16,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    boxShadow: '0 -2px 10px rgba(0, 0, 0, 0.1)',
  },
  content: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
  },
  icon: {
    fontSize: 32,
  },
  textContainer: {
    flex: 1,
  },
  title: {
    fontSize: 16,
    fontWeight: '700',
    color: '#fff',
    marginBottom: 4,
  },
  description: {
    fontSize: 13,
    color: 'rgba(255, 255, 255, 0.9)',
  },
  bold: {
    fontWeight: '700',
  },
  actions: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  installButton: {
    backgroundColor: '#fff',
    paddingHorizontal: 16,
    paddingVertical: 8,
    borderRadius: 20,
  },
  installButtonText: {
    color: '#6F73F8',
    fontSize: 14,
    fontWeight: '700',
  },
  dismissButton: {
    width: 32,
    height: 32,
    alignItems: 'center',
    justifyContent: 'center',
  },
  dismissButtonText: {
    color: '#fff',
    fontSize: 20,
    fontWeight: '300',
  },
  iosInstructions: {
    backgroundColor: '#f8f8f8',
    padding: 16,
    gap: 8,
  },
  iosStep: {
    fontSize: 13,
    color: '#666',
    lineHeight: 20,
  },
  shareIcon: {
    fontSize: 16,
    fontWeight: '700',
  },
});
