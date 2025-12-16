import { useCallback, useEffect, useState } from 'react';
import { getRouteLogs, getTripDefinition } from '../components/DatabaseService';

export interface PulseDataPoint {
  minute: number;
  score: number;
  isLowConfidence: boolean;
}

export const useTripStats = (startName: string, endName: string) => {
  const [stats, setStats] = useState<PulseDataPoint[]>([]);
  const [metadata, setMetadata] = useState({ totalDays: 0, routeCount: 0 });
  const [loading, setLoading] = useState(false);

  const fetchStats = useCallback(async () => {
    if (!startName || !endName) return;
    setLoading(true);
    
    try {
      const tripKey = `${startName}_${endName}`;

      // 1. 讀取旅程定義
      const tripDef = await getTripDefinition(tripKey);
      
      if (!tripDef || !tripDef.included_routes) {
        setStats([]);
        setMetadata({ totalDays: 0, routeCount: 0 });
        return;
      }

      const routes = tripDef.included_routes as { rId: string, sId: string }[];
      
      // 2. 並行讀取所有相關路線的 Logs
      // routesHistories 是一個陣列，每個元素是該路線的 { "2023-10-01": [], ... } 物件
      const routesHistories = await Promise.all(
        routes.map(r => getRouteLogs(r.rId, r.sId))
      );

      // 3. 統計總有效天數 (Set 去重)
      const allDays = new Set<string>();
      routesHistories.forEach(history => {
        Object.keys(history).forEach(date => allDays.add(date));
      });
      const totalDays = allDays.size;

      if (totalDays === 0) {
        setStats([]);
        setMetadata({ totalDays: 0, routeCount: routes.length });
        return;
      }

      // 4. 聚合時間軸 (Superposition)
      const timeline = new Float32Array(1440);

      routesHistories.forEach(history => {
        // 遍歷該路線的每一天
        Object.values(history).forEach((arrivals: any) => {
          if (Array.isArray(arrivals)) {
            arrivals.forEach((mod: number) => {
              if (mod >= 0 && mod < 1440) {
                timeline[mod]++;
              }
            });
          }
        });
      });

      // 5. 轉換為 UI Data (Windowing + Damping)
      const uiData: PulseDataPoint[] = [];
      const WINDOW = 5;
      const DAMPING_FACTOR = 3;

      for (let t = 0; t < 1440; t += WINDOW) {
        let sumBuses = 0;
        for (let w = 0; w < WINDOW; w++) {
          if (t + w < 1440) sumBuses += timeline[t + w];
        }

        const score = sumBuses / (totalDays + DAMPING_FACTOR);
        const isLowConfidence = totalDays < DAMPING_FACTOR;

        uiData.push({ minute: t, score, isLowConfidence });
      }

      setStats(uiData);
      setMetadata({ totalDays, routeCount: routes.length });

    } catch (e) {
      console.error("[BusPulse] Stats Error:", e);
    } finally {
      setLoading(false);
    }
  }, [startName, endName]);

  useEffect(() => {
    fetchStats();
  }, [fetchStats]);

  return { stats, metadata, loading, refreshStats: fetchStats };
};