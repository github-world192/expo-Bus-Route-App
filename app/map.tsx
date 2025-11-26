import { useRouter } from 'expo-router';
import React from 'react';
import { StyleSheet, Text, TouchableOpacity, View } from 'react-native';

export default function Map() {
    const router = useRouter();

    const onCancel = () => {
        if (router.canGoBack()) {
            router.back();
        } else {
            router.push('/');
        }
    };

    return (
        <View style={styles.container}>
            <View style={styles.messageContainer}>
                <Text style={styles.title}>📱 地圖功能</Text>
                <Text style={styles.message}>
                    地圖功能僅在行動裝置（iOS/Android）上可用
                </Text>
                <Text style={styles.hint}>
                    請使用手機或平板電腦開啟此功能
                </Text>
                
                <TouchableOpacity onPress={onCancel} style={styles.backButton} activeOpacity={0.7}>
                    <Text style={styles.backButtonText}>返回</Text>
                </TouchableOpacity>
            </View>
        </View>
    );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#f5f5f5',
  },
  messageContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    padding: 24,
  },
  title: {
    fontSize: 32,
    fontWeight: '700',
    marginBottom: 16,
    color: '#333',
  },
  message: {
    fontSize: 18,
    textAlign: 'center',
    color: '#666',
    marginBottom: 8,
    lineHeight: 26,
  },
  hint: {
    fontSize: 14,
    textAlign: 'center',
    color: '#999',
    marginBottom: 32,
  },
  backButton: {
    backgroundColor: '#6F73F8',
    paddingHorizontal: 32,
    paddingVertical: 12,
    borderRadius: 8,
  },
  backButtonText: {
    fontSize: 16,
    color: 'white',
    fontWeight: '600',
  },
});
