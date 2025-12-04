import AsyncStorage from '@react-native-async-storage/async-storage';
import axios from 'axios';
import * as cheerio from 'cheerio';

// 注意：請確保 stop_id_map.json 位於 assets 資料夾，
// 並且在 tsconfig.json 中設定 "resolveJsonModule": true
import stopDataRaw from '../databases/stop_id_map.json';

// ==========================================
// 1. 型別定義 (Type Definitions)
// ==========================================

export interface GeoLocation {
  lat: number;
  lon: number;
}

export interface StopInfo {
  name: string;
  sid: string;
  geo?: GeoLocation;
  slid?: string;
}

export interface BusInfo {
  route_name: string;
  rid: string;
  sid: string;
  arrival_time_text: string;
  raw_time: number;
  direction_text: string;
  stop_count: number;
  estimated_duration?: number; // 預估行程時間（分鐘）
  start_geo?: GeoLocation;
  end_geo?: GeoLocation;
  path_stops: StopInfo[];
}

interface StopMapData {
  by_sid: { [key: string]: any };
  by_name: { [key: string]: string[] };
}

// ==========================================
// 2. 配置與常數 (Constants)
// ==========================================

// 依據原始 TS 檔保留 CORS Proxy 設定，若為純 Native 環境可移除 corsproxy.io 前綴
const BASE_URL = "https://corsproxy.io/?https://pda5284.gov.taipei/MQS";

// 模擬 iPhone Safari 的 User Agent
const USER_AGENT = 'Mozilla/5.0 (iPhone; CPU iPhone OS 14_0 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/14.0 Mobile/15E148 Safari/604.1';

const STATUS_CODES: { [key: string]: string } = {
  '0': '進站中', '': '未發車', '-1': '未發車', '-2': '交管不停', '-3': '末班已過', '-4': '今日未營運'
};

// ==========================================
// 3. 資料提供者介面與實作 (Data Provider)
// ==========================================

interface IDataProvider {
  loadData(): Promise<StopMapData>;
  loadCache(): Promise<any>;
  saveCache(data: any): Promise<void>;
}

class ExpoDataProvider implements IDataProvider {
  private cacheKey: string;

  constructor(cacheKey: string = 'route_validation_cache') {
    this.cacheKey = cacheKey;
  }

  async loadData(): Promise<StopMapData> {
    return stopDataRaw as unknown as StopMapData;
  }

  async loadCache(): Promise<any> {
    try {
      const jsonValue = await AsyncStorage.getItem(this.cacheKey);
      return jsonValue != null ? JSON.parse(jsonValue) : {};
    } catch(e) {
      console.warn("讀取快取失敗", e);
      return {};
    }
  }

  async saveCache(data: any): Promise<void> {
    try {
      const jsonValue = JSON.stringify(data);
      await AsyncStorage.setItem(this.cacheKey, jsonValue);
    } catch (e) {
      console.error("寫入快取失敗", e);
    }
  }
}

// ==========================================
// 4. 核心邏輯服務 (Core Service)
// ==========================================

export class BusPlannerService {
  private dataProvider: IDataProvider;
  private stopMap: StopMapData = { by_sid: {}, by_name: {} };
  private routeCache: { [key: string]: any } = {}; // 執行期間的記憶體快取 (路線詳情)
  private validationCache: { [key: string]: BusInfo[] } = {}; // 持久化的路徑快取

  constructor() {
    this.dataProvider = new ExpoDataProvider();
  }

  /**
   * 初始化：載入資料庫與快取
   */
  async initialize() {
    this.stopMap = await this.dataProvider.loadData();
    this.validationCache = await this.dataProvider.loadCache();
  }

  // --- 基礎查找 Helpers ---

  getSidsByName(name: string): string[] {
    return this.stopMap.by_name[name] || [];
  }

  getSlidBySid(sid: string): string | null {
    const info = this.stopMap.by_sid[sid];
    return info ? info.slid : null;
  }

  getGeoBySid(sid: string): GeoLocation | undefined {
    const info = this.stopMap.by_sid[sid];
    if (info && info.lat) {
      return { lat: parseFloat(info.lat), lon: parseFloat(info.lon) };
    }
    return undefined;
  }

  /**
   * 取得代表性 SIDs
   * 針對某個站名，依據 SLID 去重
   */
  getRepresentativeSids(name: string): string[] {
    const allSids = this.getSidsByName(name);
    if (!allSids.length) return [];

    const seenSlids = new Set<string>();
    const representatives: string[] = [];

    for (const sid of allSids) {
      const slid = this.getSlidBySid(sid);
      if (slid && !seenSlids.has(slid)) {
        seenSlids.add(slid);
        representatives.push(sid);
      } else if (!slid) {
        // 保險起見，若無 SLID 也納入
        representatives.push(sid);
      }
    }
    return representatives;
  }

  // --- 時間處理 ---

  /**
   * 計算預估行程時間（分鐘）
   * 基於站數和時段的經驗公式
   */
  private calculateEstimatedDuration(stopCount: number): number {
    if (stopCount <= 0) return 0;
    
    const currentHour = new Date().getHours();
    
    // 基礎時間：每站 2.5 分鐘（包含行駛 + 停靠）
    let baseTime = stopCount * 2.5;
    
    // 尖峰時段加成（7-9am, 5-7pm）
    const isRushHour = (currentHour >= 7 && currentHour < 9) || (currentHour >= 17 && currentHour < 19);
    if (isRushHour) {
      baseTime *= 1.3; // 尖峰時段增加 30%
    }
    
    // 離峰或深夜時段（22pm-6am）速度較快
    const isOffPeak = currentHour >= 22 || currentHour < 6;
    if (isOffPeak) {
      baseTime *= 0.8; // 離峰時段減少 20%
    }
    
    return Math.round(baseTime);
  }

  private parseTimeText(text: string): number {
    text = (text || "").trim();
    if (text.includes("進站")) return 0;
    if (text.includes("即將")) return 10;
    if (text.includes("將到")) return 10; // Python: < 180s logic often results in "將到"
    
    if (text.includes("分")) {
      const num = parseInt(text.replace(/\D/g, ''));
      return isNaN(num) ? 99999 : num * 60;
    }
    return 99999;
  }

  private formatTimeFromCode(code: string): string {
    if (code === '0') return "進站中";
    if (STATUS_CODES[code]) return STATUS_CODES[code];
    try {
      const secs = parseInt(code);
      if (secs < 0) return STATUS_CODES[code] || "未發車";
      if (secs < 180) return "將到站";
      return `${Math.floor(secs / 60)}分`;
    } catch { return "未發車"; }
  }

  // --- HTTP Fetchers ---

  private async fetchHtml(url: string): Promise<string | null> {
    try {
      const res = await axios.get(url, { headers: { 'User-Agent': USER_AGENT }, timeout: 8000 });
      return res.status === 200 ? (typeof res.data === 'string' ? res.data : JSON.stringify(res.data)) : null;
    } catch (e) { return null; }
  }

  private async fetchJson(url: string): Promise<any | null> {
    try {
      const res = await axios.get(url, { headers: { 'User-Agent': USER_AGENT }, timeout: 8000 });
      return res.status === 200 ? res.data : null;
    } catch (e) { return null; }
  }

  // --- 爬蟲邏輯 ---

  async fetchBusesAtSid(sid: string): Promise<any[]> {
    const info = this.stopMap.by_sid[sid];
    if (!info) return [];
    const slid = info.slid;

    const urlHtml = `${BASE_URL}/stop.jsp?sid=${sid}`;
    const urlJson = slid ? `${BASE_URL}/StopLocationDyna?stoplocationid=${slid}` : null;

    const promises: Promise<any>[] = [this.fetchHtml(urlHtml)];
    if (urlJson) promises.push(this.fetchJson(urlJson));

    const results = await Promise.all(promises);
    const html = results[0] as string | null;
    const jsonData = (results.length > 1 ? results[1] : null) as any;

    if (!html) return [];

    const $ = cheerio.load(html);
    const routeMap: { [key: string]: any } = {};

    $('tr').each((_, row) => {
      const link = $(row).find('a[href*="route.jsp"]');
      if (link.length === 0) return;

      let dynId: string | null = null;
      $(row).find('td').each((_, td) => {
        const id = $(td).attr('id');
        if (id && id.startsWith('tte')) {
          dynId = id.replace('tte', '');
        }
      });

      if (dynId) {
        const href = link.attr('href') || '';
        const query = href.split('?')[1] || '';
        const params = new URLSearchParams(query);
        const rid = params.get('rid') || '';
        routeMap[dynId] = { route: link.text().trim(), rid, sid };
      }
    });

    const buses: any[] = [];

    if (jsonData && jsonData.Stop) {
      for (const stopItem of jsonData.Stop) {
        const vals = (stopItem.n1 || "").split(',');
        if (vals.length < 8) continue;
        
        const jDynId = vals[1];
        const jTime = vals[7];

        if (routeMap[jDynId]) {
          const info = routeMap[jDynId];
          const timeText = this.formatTimeFromCode(jTime);
          buses.push({
            route: info.route,
            rid: info.rid,
            sid: sid,
            time_text: timeText,
            raw_time: this.parseTimeText(timeText)
          });
          delete routeMap[jDynId];
        }
      }
    }

    for (const key in routeMap) {
      const info = routeMap[key];
      buses.push({
        route: info.route,
        rid: info.rid,
        sid: sid,
        time_text: "無法取得",
        raw_time: 99999
      });
    }

    return buses;
  }

  async getRidsAtSid(sid: string): Promise<Set<string>> {
    const buses = await this.fetchBusesAtSid(sid);
    return new Set(buses.map(b => b.rid));
  }

  async getRouteDetail(rid: string): Promise<any> {
    if (this.routeCache[rid]) return this.routeCache[rid];

    const html = await this.fetchHtml(`${BASE_URL}/route.jsp?rid=${rid}`);
    if (!html) return {};
    
    const $ = cheerio.load(html);

    const parseStops = (classRegex: RegExp) => {
      const stops: any[] = [];
      $('tr').each((_, row) => {
        const className = $(row).attr('class');
        if (className && classRegex.test(className)) {
          const link = $(row).find('a');
          if (link.length) {
            const href = link.attr('href') || '';
            const params = new URLSearchParams(href.split('?')[1]);
            stops.push({
              name: link.text().trim(),
              slid: params.get('slid') || ''
            });
          }
        }
      });
      return stops;
    };

    const data = {
      go_stops: parseStops(/ttego\d+/),
      back_stops: parseStops(/tteback\d+/)
    };
    
    this.routeCache[rid] = data;
    return data;
  }

  getVerifiedPath(stops: any[], startName: string, endName: string, currentSlid: string | null): any[] | null {
    const startIndices = stops.map((s, i) => s.name === startName ? i : -1).filter(i => i !== -1);
    if (startIndices.length === 0) return null;

    let candidates: any[][] = [];

    for (const idx of startIndices) {
      const stopSlid = stops[idx].slid;
      if (currentSlid && stopSlid && currentSlid !== stopSlid) continue;

      const subList = stops.slice(idx);
      const endRelIndex = subList.findIndex((s: any) => s.name === endName);
      
      if (endRelIndex !== -1) {
        candidates.push(subList.slice(0, endRelIndex + 1));
      }
    }

    if (candidates.length === 0) return null;
    return candidates.reduce((a, b) => a.length < b.length ? a : b);
  }

  // ==========================================
  // 5. 快取更新邏輯 (移植自 Python: update_cached_buses)
  // ==========================================

  /**
   * 針對快取中的路線，只更新時間而不重新規劃路徑
   */
  async updateCachedBuses(cachedBuses: BusInfo[]): Promise<BusInfo[]> {
    // 1. 將快取的公車依據 SID 分組，減少請求次數
    const sidGroups: Record<string, BusInfo[]> = {};
    for (const b of cachedBuses) {
      if (!sidGroups[b.sid]) sidGroups[b.sid] = [];
      sidGroups[b.sid].push(b);
    }

    // 2. 定義單個 SID 的更新邏輯
    const updateGroup = async (sid: string, buses: BusInfo[]): Promise<BusInfo[]> => {
      // 抓取該 SID 的即時資料
      const realtimeData = await this.fetchBusesAtSid(sid);
      // 建立 RID -> 即時資訊的 Map
      const realtimeMap = new Map<string, any>();
      realtimeData.forEach(d => realtimeMap.set(d.rid, d));

      const updatedBuses: BusInfo[] = [];

      for (const cachedB of buses) {
        if (realtimeMap.has(cachedB.rid)) {
          const rt = realtimeMap.get(cachedB.rid);
          
          // 更新時間，其餘路徑資訊保持不變 (Deep Copy 建議)
          const newBus: BusInfo = {
            ...cachedB,
            arrival_time_text: rt.time_text,
            raw_time: rt.raw_time,
            // 保留或計算預估行程時間（處理舊快取沒有此欄位的情況）
            estimated_duration: cachedB.estimated_duration ?? this.calculateEstimatedDuration(cachedB.stop_count),
            // 重新解析 Geo 物件以防丟失 (若從 JSON 還原)
            start_geo: cachedB.start_geo ? { ...cachedB.start_geo } : undefined,
            end_geo: cachedB.end_geo ? { ...cachedB.end_geo } : undefined,
            path_stops: cachedB.path_stops.map(s => ({ ...s, geo: s.geo ? { ...s.geo } : undefined }))
          };
          updatedBuses.push(newBus);
        } else {
            // 若該班車已消失在即時資料中（例如開走了），視需求決定是否保留
            // 策略：這裡設為未發車或移除。目前策略：更新為"未發車"並保留，或直接移除。
            // 為了避免畫面跳動，我們將其時間設為極大值
            updatedBuses.push({
                ...cachedB,
                arrival_time_text: "更新失敗",
                raw_time: 99999
            });
        }
      }
      return updatedBuses;
    };

    // 3. 併發執行所有 SID 的更新
    const tasks = Object.entries(sidGroups).map(([sid, buses]) => updateGroup(sid, buses));
    const results = await Promise.all(tasks);

    // 4. 展平結果
    return results.flat().sort((a, b) => a.raw_time - b.raw_time);
  }

  // ==========================================
  // 6. 主功能入口 (Main Plan Function)
  // ==========================================

  async plan(startStation: string, endStation: string): Promise<BusInfo[]> {
    const cacheKey = `${startStation}|${endStation}`;
    
    // 1. 檢查快取
    // 若命中快取，則執行「快速更新模式」(Python: update_cached_buses)
    if (this.validationCache[cacheKey]) {
      console.log(`[BusPlanner] Hit cache for ${startStation}->${endStation}, updating times...`);
      return await this.updateCachedBuses(this.validationCache[cacheKey]);
    }

    console.log(`[BusPlanner] No cache, planning route ${startStation}->${endStation}`);

    // 2. 取得代表性 SIDs
    const startRepSids = this.getRepresentativeSids(startStation);
    const endRepSids = this.getRepresentativeSids(endStation);

    if (startRepSids.length === 0 || endRepSids.length === 0) return [];

    // 3. 併發查詢：起點公車列表 & 終點路線列表
    const startTask = Promise.all(startRepSids.map(sid => this.fetchBusesAtSid(sid)));
    const endTask = Promise.all(endRepSids.map(sid => this.getRidsAtSid(sid)));

    const [startResultsNested, endRidsSets] = await Promise.all([startTask, endTask]);

    // 4. 計算交集
    const endRidsUnion = new Set<string>();
    endRidsSets.forEach(set => set.forEach(rid => endRidsUnion.add(rid)));

    const allStartCandidates = startResultsNested.flat();
    const ridFiltered = allStartCandidates.filter(b => endRidsUnion.has(b.rid));

    // 5. 驗證路徑詳情
    const validBuses: BusInfo[] = [];
    const seenRoutes = new Set<string>();
    
    ridFiltered.sort((a, b) => a.raw_time - b.raw_time);

    for (const cand of ridFiltered) {
      if (seenRoutes.has(cand.rid)) continue;

      const routeData = await this.getRouteDetail(cand.rid);
      const candSlid = this.getSlidBySid(cand.sid);

      let direction = "未知";
      let pathStopsData = this.getVerifiedPath(routeData.go_stops, startStation, endStation, candSlid);
      
      if (pathStopsData) {
        direction = "去程";
      } else {
        pathStopsData = this.getVerifiedPath(routeData.back_stops, startStation, endStation, candSlid);
        if (pathStopsData) direction = "返程";
      }

      if (pathStopsData) {
        seenRoutes.add(cand.rid);
        
        const enhancedPath: StopInfo[] = pathStopsData.map((p: any) => {
          const refSid = (this.getSidsByName(p.name) || [])[0] || "";
          return {
            name: p.name,
            sid: refSid,
            geo: this.getGeoBySid(refSid)
          };
        });

        const startGeo = this.getGeoBySid(cand.sid);
        const endRefSid = endRepSids[0] || "";
        const endGeo = this.getGeoBySid(endRefSid);

        const stopCount = enhancedPath.length - 1;
        const estimatedDuration = this.calculateEstimatedDuration(stopCount);

        validBuses.push({
          route_name: cand.route,
          rid: cand.rid,
          sid: cand.sid,
          arrival_time_text: cand.time_text,
          raw_time: cand.raw_time,
          direction_text: direction,
          stop_count: stopCount,
          estimated_duration: estimatedDuration,
          start_geo: startGeo,
          end_geo: endGeo,
          path_stops: enhancedPath
        });
      }
    }

    // 6. 寫入快取
    if (validBuses.length > 0) {
      // 儲存前移除即時時間資訊，確保下次讀取時只拿靜態路徑結構
      // 這裡直接存完整物件也可以，但在 updateCachedBuses 會覆蓋時間
      const cacheToSave = validBuses.map(b => {
          const { arrival_time_text, raw_time, ...rest } = b;
          // 恢復為預設值，避免混淆
          return { ...rest, arrival_time_text: '', raw_time: 0 } as BusInfo;
      });
      
      this.validationCache[cacheKey] = cacheToSave;
      await this.dataProvider.saveCache(this.validationCache);
      
      // 回傳時要保留這次查到的時間
      return validBuses;
    }

    return validBuses;
  }
}