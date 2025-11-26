import React from 'react';
import { StyleSheet, Text, TouchableOpacity, View } from 'react-native';
import MapView, { PROVIDER_DEFAULT, PROVIDER_GOOGLE } from 'react-native-maps';

import { useRouter } from 'expo-router';


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
            <MapView style={styles.map} provider={PROVIDER_GOOGLE} showsUserLocation={true} showsMyLocationButton={true} mapType='standard'>
            
            {/* 右下角的返回按鈕 */}
            <View style={{ flex: 1, justifyContent: 'flex-start', alignItems: 'flex-start' }}>
                <TouchableOpacity onPress={onCancel} style={styles.cancelBtn} activeOpacity={0.7}>
                    <Text style={styles.text}>返回</Text>
                </TouchableOpacity>
            </View>
            </MapView>
        </View>
    );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
  },
  map: {
    width: '100%',
    height: '100%',
  },
  text: {
    fontSize: 16,
    color: 'black',
  },
  cancelBtn: {
    paddingLeft: 12,
    paddingVertical: 8, 
  },
});
