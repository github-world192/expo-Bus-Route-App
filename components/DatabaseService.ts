import AsyncStorage from '@react-native-async-storage/async-storage';

// --- Keys Helpers ---
const KEY_TRIP_DEFS = 'bus_pulse_trip_defs';
const getLogKey = (routeId: string, stationId: string) => `bus_logs_${routeId}_${stationId}`;

// 為了相容性保留，但其實不需要初始化
export const initDatabase = async () => {
  // JSON 模式不需要建表
  return Promise.resolve();
};

// --- Trip Definitions (儲存使用者的搜尋偏好) ---
export const saveTripDefinition = async (tripKey: string, routes: any[]) => {
  try {
    const existingRaw = await AsyncStorage.getItem(KEY_TRIP_DEFS);
    const defs = existingRaw ? JSON.parse(existingRaw) : {};
    
    defs[tripKey] = {
      included_routes: routes,
      last_accessed: Date.now()
    };

    await AsyncStorage.setItem(KEY_TRIP_DEFS, JSON.stringify(defs));
  } catch (e) {
    console.error("Failed to save trip def", e);
  }
};

export const getTripDefinition = async (tripKey: string) => {
  try {
    const raw = await AsyncStorage.getItem(KEY_TRIP_DEFS);
    const defs = raw ? JSON.parse(raw) : {};
    return defs[tripKey] || null;
  } catch (e) {
    console.error("Failed to get trip def", e);
    return null;
  }
};

// --- Logs (儲存歷史數據) ---
// 結構: Key="bus_logs_307_S1", Value={ "2023-12-17": [400, 420], "2023-12-18": [...] }
export const saveRouteLog = async (routeId: string, stationId: string, dateKey: string, arrivals: number[]) => {
  const key = getLogKey(routeId, stationId);
  try {
    const raw = await AsyncStorage.getItem(key);
    const history = raw ? JSON.parse(raw) : {};
    
    // 更新當天的資料
    history[dateKey] = arrivals;
    
    await AsyncStorage.setItem(key, JSON.stringify(history));
  } catch (e) {
    console.error("Failed to save route log", e);
  }
};

export const getRouteLogs = async (routeId: string, stationId: string) => {
  const key = getLogKey(routeId, stationId);
  try {
    const raw = await AsyncStorage.getItem(key);
    return raw ? JSON.parse(raw) : {}; // 回傳結構: { "YYYY-MM-DD": [numbers...] }
  } catch (e) {
    return {};
  }
};