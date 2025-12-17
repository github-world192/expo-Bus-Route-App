import { useCallback, useEffect, useState } from 'react';
// [FIX] 修正路徑以對齊 busPlanner.ts (若您的 DatabaseService 在 services 資料夾，請自行改回)
import { getRouteLogs, getTripDefinition } from '../components/DatabaseService'; 

export interface PulseDataPoint {
  minute: number;
  score: number;
  isLowConfidence: boolean;
}

export interface TripStatsResult {
  weekday: PulseDataPoint[];
  weekend: PulseDataPoint[];
}

export const useTripStats = (startName: string, endName: string) => {
  const [stats, setStats] = useState<TripStatsResult>({ weekday: [], weekend: [] });
  const [metadata, setMetadata] = useState({ totalDays: 0, daysWeekday: 0, daysWeekend: 0, routeCount: 0 });
  const [loading, setLoading] = useState(false);

  const fetchStats = useCallback(async () => {
    if (!startName || !endName) return;
    setLoading(true);
    
    // [Debug] 開始讀取
    const tripKey = `${startName}_${endName}`;
    console.log(`[TripStats] Fetching for key: ${tripKey}`);

    try {
      // 1. 讀取旅程定義
      const tripDef = await getTripDefinition(tripKey);
      
      // [Debug] 檢查定義檔
      if (!tripDef) {
        console.warn(`[TripStats] No definition found for ${tripKey}`);
        setStats({ weekday: [], weekend: [] });
        return;
      }
      if (!tripDef.included_routes) {
         console.warn(`[TripStats] Invalid definition format (missing included_routes):`, tripDef);
         setStats({ weekday: [], weekend: [] });
         return;
      }

      const routes = tripDef.included_routes as { rId: string, sId: string }[];
      console.log(`[TripStats] Found ${routes.length} routes in definition.`);

      // 2. 並行讀取所有相關路線的 Logs
      const routesHistories = await Promise.all(
        routes.map(r => getRouteLogs(r.rId, r.sId))
      );

      // 3. 聚合數據
      const timelineWeekday = new Float32Array(1440);
      const timelineWeekend = new Float32Array(1440);
      const allDates = new Set<string>();
      let daysWeekday = 0;
      let daysWeekend = 0;
      let totalBusesFound = 0;

      routesHistories.forEach((history, idx) => {
        if (!history) return;
        
        const dateKeys = Object.keys(history);
        // [Debug] 檢查每條路線的 log 數量
        // console.log(`[TripStats] Route ${idx} has logs for ${dateKeys.length} days.`);

        Object.entries(history).forEach(([dateStr, arrivals]: [string, any]) => {
          // 計算天數
          if (!allDates.has(dateStr)) {
            allDates.add(dateStr);
            const day = new Date(dateStr).getDay(); // 0=Sun, 6=Sat
            if (day === 0 || day === 6) daysWeekend++;
            else daysWeekday++;
          }

          // 累積班次
          const day = new Date(dateStr).getDay();
          const isWeekend = (day === 0 || day === 6);
          const targetTimeline = isWeekend ? timelineWeekend : timelineWeekday;

          if (Array.isArray(arrivals)) {
            arrivals.forEach((mod: number) => { 
              if (mod >= 0 && mod < 1440) {
                  targetTimeline[mod]++; 
                  totalBusesFound++;
              }
            });
          }
        });
      });

      const totalDays = allDates.size;
      console.log(`[TripStats] Aggregated: ${totalDays} days (${daysWeekday} WD, ${daysWeekend} WE), Total Buses: ${totalBusesFound}`);

      // [Debug] 若有天數但沒車，可能是 arrivals 格式問題
      if (totalDays > 0 && totalBusesFound === 0) {
          console.warn("[TripStats] Found days but 0 buses. Check 'arrivals' format in DB.");
      }

      if (totalDays === 0) {
        setStats({ weekday: [], weekend: [] });
        setMetadata({ totalDays: 0, daysWeekday: 0, daysWeekend: 0, routeCount: routes.length });
        return;
      }

      // Helper: 將時間軸轉換為 UI 數據
      const processTimeline = (tl: Float32Array, days: number): PulseDataPoint[] => {
        const uiData: PulseDataPoint[] = [];
        const WINDOW = 5;
        // [Tweak] 若天數很少(例如剛開始)，減少 Damping 以讓圖表有起伏
        const DAMPING_FACTOR = days < 3 ? 0.5 : 3;

        for (let t = 0; t < 1440; t += WINDOW) {
          let sumBuses = 0;
          for (let w = 0; w < WINDOW; w++) { if (t + w < 1440) sumBuses += tl[t + w]; }
          
          // 正規化分數
          let score = 0;
          if (days > 0) {
             score = sumBuses / (days + DAMPING_FACTOR);
             // [Vis] 放大係數：讓稀疏資料也能顯示一點高度
             if (days < 2) score *= 2.0; 
          }

          const isLowConfidence = days < 2; 
          uiData.push({ minute: t, score, isLowConfidence });
        }
        return uiData;
      };

      setStats({
        weekday: processTimeline(timelineWeekday, daysWeekday),
        weekend: processTimeline(timelineWeekend, daysWeekend)
      });
      
      setMetadata({ 
        totalDays, 
        routeCount: routes.length,
        daysWeekday,
        daysWeekend
      });

    } catch (e) {
      console.error("[TripStats] Error:", e);
      setStats({ weekday: [], weekend: [] });
    } finally {
      setLoading(false);
    }
  }, [startName, endName]);

  useEffect(() => {
    fetchStats();
  }, [fetchStats]);

  return { stats, metadata, loading, refreshStats: fetchStats };
};