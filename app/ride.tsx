import { Stack, useLocalSearchParams, useRouter } from 'expo-router';
import React from 'react';
import { Alert, Button, SafeAreaView, ScrollView, StyleSheet, Text, View } from 'react-native';
import { TripPulseChart } from '../components/TripPulseChart';
import { useTripIngestion } from '../hooks/useTripIngestion';
import { useTripStats } from '../hooks/useTripStats';

// --- MOCK DATA FOR DEMO PURPOSES ---
const MOCK_API_RESPONSE = [
  { 
    routeId: '307', 
    stationId: 'S1', 
    // Simulating buses coming in 5, 20, 25 mins from now
    etaList: [5, 20, 25, 40, 55] 
  },
  { 
    routeId: '265', 
    stationId: 'S2', 
    // Simulating buses in 8, 22 mins
    etaList: [8, 22, 50] 
  }
];

export default function SearchResultScreen() {
  const router = useRouter();
  // 1. Get Params (e.g., from previous search input screen)
  const { start = "Taipei Main", end = "Ximen" } = useLocalSearchParams<{ start: string, end: string }>();

  // 2. Init Hooks
  const { ingestTripData } = useTripIngestion();
  
  // We grab refreshStats to manually reload the chart after we ingest new data
  const { stats, metadata, loading, refreshStats } = useTripStats(start, end);

  // 3. Handle Ingestion (Simulation of API Success)
  const handleSimulateApiReturn = async () => {
    console.log("Simulating API Return...");
    
    try {
      // Write to SQLite
      await ingestTripData(start, end, MOCK_API_RESPONSE);
      
      // Refresh the UI
      await refreshStats();
      
      Alert.alert("Data Ingested", "已寫入模擬數據，圖表應更新。");
    } catch (e: any) {
      // <--- 3. 顯示明確錯誤，不再靜默失敗
      Alert.alert("Error", "操作失敗: " + e.message);
    }
  };

  return (
    <SafeAreaView style={styles.container}>
      <Stack.Screen options={{ title: 'Trip Results' }} />
      
      <ScrollView contentContainerStyle={styles.scrollContent}>
        
        {/* SECTION 1: The Pulse Chart */}
        <Text style={styles.sectionTitle}>Historical Frequency</Text>
        <TripPulseChart 
          startName={start} 
          endName={end} 
          totalDays={metadata.totalDays}
          routeCount={metadata.routeCount}
          // 🔥 傳遞資料與讀取狀態
          data={stats}
          isLoading={loading}
        />
        
        {/* SECTION 2: Action Area (Simulate API) */}
        <View style={styles.debugCard}>
          <Text style={styles.debugTitle}>Developer Tools</Text>
          <Text style={styles.debugDesc}>
            Since this is a partial context, click below to simulate receiving live API data for this trip. 
            This will feed the SQLite DB and update the chart above.
          </Text>
          <Button 
            title="Simulate Live API & Ingest" 
            onPress={handleSimulateApiReturn} 
          />
        </View>

        {/* SECTION 3: Raw Stats Debug */}
        <View style={styles.statsCard}>
          <Text style={styles.statsTitle}>Debug Info</Text>
          <Text>Total Data Points: {stats.length}</Text>
          <Text>Known Routes: {metadata.routeCount}</Text>
          <Text>Observed Days: {metadata.totalDays}</Text>
          <Text>Loading: {loading ? 'Yes' : 'No'}</Text>
        </View>

      </ScrollView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#f2f2f7',
  },
  scrollContent: {
    padding: 16,
  },
  sectionTitle: {
    fontSize: 22,
    fontWeight: '700',
    marginBottom: 10,
    color: '#000',
  },
  debugCard: {
    marginTop: 20,
    padding: 16,
    backgroundColor: '#fff',
    borderRadius: 12,
    borderWidth: 1,
    borderColor: '#e5e5ea',
  },
  debugTitle: {
    fontSize: 16,
    fontWeight: '600',
    marginBottom: 8,
    color: '#FF9500',
  },
  debugDesc: {
    fontSize: 14,
    color: '#666',
    marginBottom: 12,
    lineHeight: 20,
  },
  statsCard: {
    marginTop: 20,
    padding: 16,
    backgroundColor: '#e5e5ea', // Darker gray for differentiation
    borderRadius: 12,
  },
  statsTitle: {
    fontSize: 16,
    fontWeight: '600',
    marginBottom: 8,
  }
});