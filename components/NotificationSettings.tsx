import React, { useEffect, useState } from 'react';
import { Platform, StyleSheet, Switch, Text, TouchableOpacity, View } from 'react-native';
import usePushNotification from '../hooks/usePushNotification';

export default function NotificationSettings() {
  const {
    isSupported,
    permission,
    requestPermission,
    showLocalNotification,
  } = usePushNotification();

  const [notificationsEnabled, setNotificationsEnabled] = useState(false);
  const [debugInfo, setDebugInfo] = useState('');
  const [isStandalone, setIsStandalone] = useState(false);
  const [isVisible, setIsVisible] = useState(true);

  useEffect(() => {
    if (Platform.OS !== 'web') {
      setDebugInfo('❌ Platform is not web');
      return;
    }

    // 檢查使用者是否之前關閉過通知設定區塊
    const dismissed = localStorage.getItem('notification-settings-dismissed');
    if (dismissed === 'true') {
      setIsVisible(false);
      return;
    }

    // 檢查是否已安裝 PWA（獨立模式）
    const standalone = window.matchMedia('(display-mode: standalone)').matches ||
                      (window.navigator as any).standalone ||
                      document.referrer.includes('android-app://');
    
    setIsStandalone(standalone);
    
    const hasNotificationAPI = 'Notification' in window;
    const hasServiceWorker = 'serviceWorker' in navigator;
    const hasPushManager = 'PushManager' in window;
    const userAgent = navigator.userAgent;
    const isIOS = /iPad|iPhone|iPod/.test(userAgent);
    
    setDebugInfo(`
📱 Device: ${isIOS ? 'iOS' : 'Other'}
🏠 Standalone: ${standalone ? '✅' : '❌'}
🔔 Notification API: ${hasNotificationAPI ? '✅' : '❌'}
⚙️ Service Worker: ${hasServiceWorker ? '✅' : '❌'}
📤 Push Manager: ${hasPushManager ? '✅' : '❌'}
🔐 Permission: ${permission.granted ? '✅ granted' : permission.denied ? '❌ denied' : '⏳ default'}
✨ isSupported: ${isSupported ? '✅' : '❌'}
🌐 User Agent: ${userAgent.substring(0, 50)}...
    `.trim());
    
    setNotificationsEnabled(permission.granted);
  }, [isSupported, permission.granted, permission.denied]);

  const handleToggleNotifications = async () => {
    if (!notificationsEnabled) {
      // 開啟通知
      const granted = await requestPermission();
      if (granted) {
        setNotificationsEnabled(true);
        // 顯示測試通知
        showLocalNotification('通知已啟用 ✅', {
          body: '您將收到公車到站提醒',
          icon: '/assets/icon.png',
        });
      }
    } else {
      // 關閉通知（需要用戶在系統設定中關閉）
      alert('請在瀏覽器設定中管理通知權限');
    }
  };

  const handleTestNotification = () => {
    showLocalNotification('測試通知 🚌', {
      body: '這是一則測試通知訊息',
      icon: '/assets/icon.png',
      badge: '/assets/icon.png',
      //vibrate: [200, 100, 200],
    });
  };

  const handleClose = () => {
    setIsVisible(false);
    // 儲存使用者選擇，下次不再顯示
    if (typeof window !== 'undefined') {
      localStorage.setItem('notification-settings-dismissed', 'true');
    }
  };

  // Web 平台下一律顯示（移除條件限制以便調試）
  if (Platform.OS !== 'web' || !isVisible) {
    return null;
  }

  return (
    <View style={styles.container}>
      <View style={styles.header}>
        <Text style={styles.title}>🔔 通知設定</Text>
        <TouchableOpacity
          style={styles.closeButton}
          onPress={handleClose}
          activeOpacity={0.7}
        >
          <Text style={styles.closeButtonText}>✕</Text>
        </TouchableOpacity>
      </View>

      <View style={styles.settingRow}>
        <View style={styles.settingInfo}>
          <Text style={styles.settingLabel}>到站提醒</Text>
          <Text style={styles.settingDescription}>
            公車即將到站時推送通知
          </Text>
        </View>
        <Switch
          value={notificationsEnabled}
          onValueChange={handleToggleNotifications}
          trackColor={{ false: '#767577', true: '#6F73F8' }}
          thumbColor={notificationsEnabled ? '#fff' : '#f4f3f4'}
        />
      </View>

      {notificationsEnabled && (
        <TouchableOpacity
          style={styles.testButton}
          onPress={handleTestNotification}
          activeOpacity={0.7}
        >
          <Text style={styles.testButtonText}>發送測試通知</Text>
        </TouchableOpacity>
      )}

      {permission.denied && (
        <View style={styles.deniedNotice}>
          <Text style={styles.deniedText}>
            ⚠️ 通知權限已被拒絕，請在瀏覽器設定中重新啟用
          </Text>
        </View>
      )}

      {/* iOS 說明 */}
      <View style={styles.infoBox}>
        <Text style={styles.infoTitle}>💡 使用提示</Text>
        <Text style={styles.infoText}>
          • iOS 16.4+ 支援推送通知功能{'\n'}
          • 必須將 App 加入主畫面後才能使用{'\n'}
          • Android 所有版本皆支援通知功能
        </Text>
      </View>

      {/* 顯示狀態資訊 */}
      {!isStandalone && (
        <View style={[styles.infoBox, { backgroundColor: '#3a2a1a' }]}>
          <Text style={[styles.infoTitle, { color: '#ffaa00' }]}>⚠️ 請先安裝 PWA</Text>
          <Text style={styles.infoText}>
            iOS 需要先將網站加入主畫面才能使用通知功能
          </Text>
        </View>
      )}

      {/* Debug 資訊 - 永久顯示以便排查問題 */}
      {debugInfo && (
        <View style={styles.debugBox}>
          <Text style={styles.debugTitle}>🔧 系統資訊</Text>
          <Text style={styles.debugText}>{debugInfo}</Text>
        </View>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    backgroundColor: '#1a2526',
    borderRadius: 12,
    padding: 16,
    marginHorizontal: 20,
    marginVertical: 12,
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: 16,
  },
  title: {
    fontSize: 18,
    fontWeight: '700',
    color: '#fff',
  },
  closeButton: {
    width: 32,
    height: 32,
    borderRadius: 16,
    backgroundColor: 'rgba(255, 255, 255, 0.1)',
    alignItems: 'center',
    justifyContent: 'center',
  },
  closeButtonText: {
    color: '#fff',
    fontSize: 18,
    fontWeight: '600',
    lineHeight: 20,
  },
  settingRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingVertical: 12,
    borderBottomWidth: 1,
    borderBottomColor: '#263133',
  },
  settingInfo: {
    flex: 1,
    marginRight: 12,
  },
  settingLabel: {
    fontSize: 16,
    fontWeight: '600',
    color: '#fff',
    marginBottom: 4,
  },
  settingDescription: {
    fontSize: 13,
    color: '#9aa6a6',
  },
  testButton: {
    backgroundColor: '#6F73F8',
    borderRadius: 8,
    padding: 12,
    alignItems: 'center',
    marginTop: 12,
  },
  testButtonText: {
    color: '#fff',
    fontSize: 14,
    fontWeight: '600',
  },
  deniedNotice: {
    backgroundColor: '#E74C3C',
    borderRadius: 8,
    padding: 12,
    marginTop: 12,
  },
  deniedText: {
    color: '#fff',
    fontSize: 13,
    lineHeight: 18,
  },
  infoBox: {
    backgroundColor: '#263133',
    borderRadius: 8,
    padding: 12,
    marginTop: 12,
  },
  infoTitle: {
    fontSize: 14,
    fontWeight: '600',
    color: '#fff',
    marginBottom: 8,
  },
  infoText: {
    fontSize: 13,
    color: '#9aa6a6',
    lineHeight: 20,
  },
  debugBox: {
    backgroundColor: '#2a1a1a',
    borderRadius: 8,
    padding: 12,
    marginTop: 12,
    borderWidth: 1,
    borderColor: '#E74C3C',
  },
  debugTitle: {
    fontSize: 13,
    fontWeight: '600',
    color: '#ff9999',
    marginBottom: 8,
  },
  debugText: {
    fontSize: 11,
    color: '#ffcccc',
    fontFamily: Platform.OS === 'web' ? 'monospace' : 'Courier',
    lineHeight: 18,
  },
});
