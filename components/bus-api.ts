// TaipeiBusAPI.ts
import * as cheerio from 'cheerio';

/**
 * Represents a bus arrival estimate
 */
export interface BusArrival {
  route: string;
  direction: string;
  estimatedTime: string;
  rawTimeValue: string;
  stopDynamicId: string;
}

/**
 * Response from the get stop estimates method
 */
export interface StopEstimatesResponse {
  arrivals: BusArrival[];
  lastUpdate: string;
}

/**
 * Route information mapping
 */
interface RouteInfo {
  路線: string;
  站牌: string;
  去返程: string;
}

/**
 * Client for fetching Taipei bus arrival estimates
 */
export class TaipeiBusAPI {
  private static readonly BASE_URL = 'https://pda5284.gov.taipei/MQS';
  
  // Status code mappings from the API
  private static readonly STATUS_CODES: Record<string, string> = {
    '0': '進站中',
    '': '未發車',
    '-1': '未發車',
    '-2': '交管不停',
    '-3': '末班已過',
    '-4': '今日未營運',
  };

  private stopMapping: Record<string, string> = {};

  /**
   * Initialize with stop name to ID mapping
   */
  constructor(stopMapping: Record<string, string>) {
    this.stopMapping = stopMapping;
  }

  /**
   * Load stop mapping from JSON file (for use with require/import)
   */
  static async createWithMapping(
    mappingPath?: Record<string, string>
  ): Promise<TaipeiBusAPI> {
    if (mappingPath) {
      return new TaipeiBusAPI(mappingPath);
    }
    
    // If you're using expo or react-native, you can require the JSON directly
    const stopMapping = require('../databases/stop_to_slid.json');
    return new TaipeiBusAPI(stopMapping);
  }

  /**
   * Get bus arrival estimates for a specific stop
   */
  async getStopEstimates(stopName: string): Promise<StopEstimatesResponse> {
    const stopId = this.stopMapping[stopName];
    
    if (!stopId) {
      return { arrivals: [], lastUpdate: '' };
    }

    try {
      // Fetch static route information
      const routeMap = await this.fetchRouteInfo(stopId);
      
      // Fetch dynamic arrival data
      const dynamicData = await this.fetchDynamicData(stopId);
      
      // Process and combine the data
      return this.processArrivals(dynamicData, routeMap);
    } catch (error) {
      console.error('Error fetching stop estimates:', error);
      throw error;
    }
  }

  /**
   * Fetch static route information for a stop
   */
  private async fetchRouteInfo(
    stopId: string
  ): Promise<Record<string, RouteInfo>> {
    const url = `https://corsproxy.io/?${encodeURIComponent(`${TaipeiBusAPI.BASE_URL}/stoplocation.jsp?slid=${stopId}`)}`;
    const response = await fetch(url);
    
    if (!response.ok) {
      throw new Error(`HTTP error! status: ${response.status}`);
    }
    
    const html = await response.text();
    const $ = cheerio.load(html);
    
    const routeMap: Record<string, RouteInfo> = {};
    
    // Find all bus rows with class 'ttego1' or 'ttego2'
    $('tr.ttego1, tr.ttego2').each((_, row) => {
      const cols = $(row).find('td');
      
      if (cols.length !== 4) return;
      
      const routeName = $(cols[0]).find('a').text().trim() || 'N/A';
      const stopName = $(cols[1]).find('a').text().trim() || 'N/A';
      const direction = $(cols[2]).text().trim();
      
      const timeId = $(cols[3]).attr('id');
      if (timeId) {
        const dynamicId = timeId.replace('tte', '');
        routeMap[dynamicId] = {
          路線: routeName,
          站牌: stopName,
          去返程: direction,
        };
      }
    });
    
    return routeMap;
  }

  /**
   * Fetch dynamic arrival data for a stop
   */
  private async fetchDynamicData(stopId: string): Promise<any> {
    const url = `https://corsproxy.io/?${encodeURIComponent(`${TaipeiBusAPI.BASE_URL}/StopLocationDyna?stoplocationid=${stopId}`)}`;
    const response = await fetch(url);
    
    if (!response.ok) {
      throw new Error(`HTTP error! status: ${response.status}`);
    }
    
    return await response.json();
  }

  /**
   * Process dynamic data and combine with route information
   */
  private processArrivals(
    jsonData: any,
    routeMap: Record<string, RouteInfo>
  ): StopEstimatesResponse {
    const arrivals: BusArrival[] = [];
    const updateTime = (jsonData.UpdateTime || 'N/A').replace(/&#x3a;/g, ':');
    
    const stops = jsonData.Stop || [];
    
    for (const stopEntry of stops) {
      if (!stopEntry.n1) continue;
      
      const n1Parts = stopEntry.n1.split(',');
      if (n1Parts.length < 8) continue;
      
      const stopDynamicId = n1Parts[1];
      const rawTime = n1Parts[7];
      const estimatedTime = this.formatArrivalTime(rawTime);
      
      // Get static route info with fallback
      const staticInfo = routeMap[String(stopEntry.id)] || {
        路線: `未知路線 (ID:${stopDynamicId})`,
        去返程: 'N/A',
        站牌: 'N/A',
      };
      
      arrivals.push({
        route: staticInfo.路線,
        direction: staticInfo.去返程,
        estimatedTime,
        rawTimeValue: rawTime,
        stopDynamicId,
      });
    }
    
    // Sort by route name for easier reading
    arrivals.sort((a, b) => a.route.localeCompare(b.route));
    
    return {
      arrivals,
      lastUpdate: updateTime,
    };
  }

  /**
   * Convert arrival time seconds to human-readable format
   */
  private formatArrivalTime(timeValue: string): string {
    // Check for special status codes
    if (timeValue in TaipeiBusAPI.STATUS_CODES) {
      return TaipeiBusAPI.STATUS_CODES[timeValue];
    }
    
    const seconds = parseInt(timeValue, 10);
    
    if (isNaN(seconds)) {
      return '資料格式錯誤';
    }
    
    if (seconds === 0) {
      return '進站中';
    } else if (seconds > 0 && seconds < 180) {
      return '將到站';
    } else if (seconds >= 180) {
      return `${Math.floor(seconds / 60)}分`;
    } else {
      return TaipeiBusAPI.STATUS_CODES[String(seconds)] || '數據異常';
    }
  }
}

// Example React Native Component Usage
// BusStopScreen.tsx
/*
import React, { useState, useEffect } from 'react';
import {
  View,
  Text,
  FlatList,
  StyleSheet,
  ActivityIndicator,
  RefreshControl,
} from 'react-native';
import { TaipeiBusAPI, BusArrival } from './TaipeiBusAPI';

// Import your stop mapping JSON
const stopMapping = require('./stop_to_slid.json');

export const BusStopScreen: React.FC = () => {
  const [arrivals, setArrivals] = useState<BusArrival[]>([]);
  const [lastUpdate, setLastUpdate] = useState<string>('');
  const [loading, setLoading] = useState<boolean>(true);
  const [refreshing, setRefreshing] = useState<boolean>(false);
  const [busAPI] = useState(() => new TaipeiBusAPI(stopMapping));

  const fetchBusData = async () => {
    try {
      const { arrivals, lastUpdate } = await busAPI.getStopEstimates('捷運公館站');
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
        <Text style={styles.title}>捷運公館站</Text>
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
*/
