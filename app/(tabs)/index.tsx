import React, { useEffect, useState } from 'react';
import {
  ActivityIndicator,
  FlatList,
  RefreshControl,
  StyleSheet,
  Text,
  View,
} from 'react-native';
import { BusArrival, TaipeiBusAPI } from '../../components/bus-api';
import stopMapping from '../../databases/stop_to_slid.json';

// Import your stop mapping JSON
export default function HomeScreen() {
  const [arrivals, setArrivals] = useState<BusArrival[]>([]);
  const [lastUpdate, setLastUpdate] = useState<string>('');
  const [loading, setLoading] = useState<boolean>(true);
  const [refreshing, setRefreshing] = useState<boolean>(false);
  const [busAPI] = useState(() => new TaipeiBusAPI(stopMapping));

  const fetchBusData = async () => {
    try {
      const { arrivals, lastUpdate } = await busAPI.getStopEstimates('師大分部');
      setArrivals(arrivals);
      setLastUpdate(lastUpdate);
    } catch (error) {
      console.error('Failed to fetch bus data:', error);
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  };

  useEffect(() => {
    fetchBusData();
    
    // Auto-refresh every 30 seconds
    const interval = setInterval(fetchBusData, 30000);
    
    return () => clearInterval(interval);
  }, []);

  const onRefresh = () => {
    setRefreshing(true);
    fetchBusData();
  };

  const renderBusItem = ({ item }: { item: BusArrival }) => (
    <View style={styles.busItem}>
      <View style={styles.busHeader}>
        <Text style={styles.routeName}>{item.route}</Text>
        <Text style={styles.estimatedTime}>{item.estimatedTime}</Text>
      </View>
      <Text style={styles.direction}>{item.direction}</Text>
    </View>
  );

  if (loading) {
    return (
      <View style={styles.centered}>
        <ActivityIndicator size="large" color="#0066cc" />
      </View>
    );
  }


  return (
    <View style={styles.container}>
      <View style={styles.header}>
        <Text style={styles.title}>師大分部</Text>
        <Text style={styles.updateTime}>更新時間: {lastUpdate}</Text>
      </View>
      
      <FlatList
        data={arrivals}
        renderItem={renderBusItem}
        keyExtractor={(item, index) => `${item.route}-${index}`}
        refreshControl={
          <RefreshControl refreshing={refreshing} onRefresh={onRefresh} />
        }
        ListEmptyComponent={
          <View style={styles.centered}>
            <Text>目前無公車資訊</Text>
          </View>
        }
      />
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#f5f5f5',
  },
  centered: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
  },
  header: {
    backgroundColor: '#fff',
    padding: 16,
    borderBottomWidth: 1,
    borderBottomColor: '#e0e0e0',
  },
  title: {
    fontSize: 24,
    fontWeight: 'bold',
    marginBottom: 4,
  },
  updateTime: {
    fontSize: 12,
    color: '#666',
  },
  busItem: {
    backgroundColor: '#fff',
    padding: 16,
    marginVertical: 4,
    marginHorizontal: 8,
    borderRadius: 8,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.1,
    shadowRadius: 2,
    elevation: 2,
  },
  busHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 8,
  },
  routeName: {
    fontSize: 18,
    fontWeight: 'bold',
    color: '#0066cc',
  },
  estimatedTime: {
    fontSize: 16,
    fontWeight: '600',
    color: '#ff6600',
  },
  direction: {
    fontSize: 14,
    color: '#666',
  },
});