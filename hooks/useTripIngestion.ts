import { useCallback } from 'react';
import { getRouteLogs, saveRouteLog, saveTripDefinition } from '../components/DatabaseService';
import { getLogicalDate, getVirtualMoD, runGreedyMagnet } from '../utils/BusPulseUtils';

interface RouteInfo {
  routeId: string;
  stationId: string;
  etaList: number[]; // Relative minutes
}

export const useTripIngestion = () => {
  const ingestTripData = useCallback(async (
    startName: string, 
    endName: string, 
    apiRoutes: RouteInfo[]
  ) => {
    if (!apiRoutes.length) return;

    const tripKey = `${startName}_${endName}`;
    const now = Date.now();
    const logicalDate = getLogicalDate(now);
    const currentMoD = getVirtualMoD(now);

    try {
      // 1. 儲存旅程定義
      const routeMapping = apiRoutes.map(r => ({ rId: r.routeId, sId: r.stationId }));
      await saveTripDefinition(tripKey, routeMapping);

      // 2. 更新每條路線的 Logs
      // 我們並行處理所有路線的讀取->運算->寫入
      await Promise.all(apiRoutes.map(async (route) => {
        // A. 讀取該路線的所有歷史 (為了拿到今天的舊資料)
        const fullHistory = await getRouteLogs(route.routeId, route.stationId);
        const todayArrivals = fullHistory[logicalDate] || [];

        // B. 執行磁鐵演算法 (去重)
        const updatedArrivals = runGreedyMagnet(todayArrivals, route.etaList, currentMoD);

        // C. 寫回儲存
        await saveRouteLog(route.routeId, route.stationId, logicalDate, updatedArrivals);
      }));

      console.log(`[BusPulse JSON] Ingested ${apiRoutes.length} routes for ${tripKey}`);
    } catch (error) {
      console.error("[BusPulse] Ingestion Failed:", error);
      throw error; // 拋出錯誤讓 UI 層捕捉
    }
  }, []);

  return { ingestTripData };
};