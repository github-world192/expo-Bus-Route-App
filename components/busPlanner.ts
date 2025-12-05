import AsyncStorage from '@react-native-async-storage/async-storage';
import axios from 'axios';
import * as cheerio from 'cheerio';

// 假設 stop_id_map.json 位於 assets 或 databases 資料夾
// 請根據專案實際路徑調整引用
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
}

export interface BusInfo {
  route_name: string;
  rid: string;
  sid: string;
  arrival_time_text: string;
  raw_time: number; // 用於排序的秒數
  direction_text: string;
  stop_count: number;
  start_geo?: GeoLocation;
  end_geo?: GeoLocation;
  path_stops: StopInfo[];
}

interface StopMapData {
  by_sid: { [key: string]: any }; // 原始資料通常是 string 格式的 lat/lon
  by_name: { [key: string]: string[] };
}

interface RawRouteStop {
  name: string;
  sid: string;
}

interface RouteDetail {
  go_stops: RawRouteStop[];
  back_stops: RawRouteStop[];
}

// ==========================================
// 2. 配置與常數 (Configuration)
// ==========================================

const BASE_URL = "https://corsproxy.io/?https://pda5284.gov.taipei/MQS"; // 視需求加上 CORS Proxy
const USER_AGENT = 'Mozilla/5.0 (iPhone; CPU iPhone OS 14_0 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/14.0 Mobile/15E148 Safari/604.1';

const TIME_CONSTANTS = {
  NOT_DEPARTED: 99999,
  ARRIVING: 0,
  UNKNOWN: 88888
};

const STATUS_CODES: { [key: string]: string } = {
  '0': '進站中', 
  '': '未發車', 
  '-1': '未發車', 
  '-2': '交管不停', 
  '-3': '末班已過', 
  '-4': '今日未營運'
};

// ==========================================
// 3. 解析工具 (Parsers)
// ==========================================

class TimeParser {
  static parseTextToSeconds(text: string): number {
    text = (text || "").trim();
    if (text.includes("進站") || text.includes("將到")) return TIME_CONSTANTS.ARRIVING;
    if (text.includes("未發車") || text.includes("末班") || text.includes("今日未")) return TIME_CONSTANTS.NOT_DEPARTED;
    if (text.includes(":")) return TIME_CONSTANTS.UNKNOWN;

    try {
      const numStr = text.replace(/\D/g, '');
      if (!numStr) return TIME_CONSTANTS.NOT_DEPARTED;
      const val = parseInt(numStr, 10);
      return text.includes("分") ? val * 60 : val;
    } catch {
      return TIME_CONSTANTS.NOT_DEPARTED;
    }
  }

  static formatStatusCode(code: string): string {
    const codeStr = String(code).trim();
    if (STATUS_CODES[codeStr]) return STATUS_CODES[codeStr];
    
    // 若不是標準代碼，嘗試解析秒數
    if (!codeStr.includes(":")) {
      try {
        const secs = parseInt(codeStr, 10);
        if (isNaN(secs) || secs < 0) return STATUS_CODES['-1']; // 未發車
        if (secs < 180) return "將到站";
        return `${Math.floor(secs / 60)}分`;
      } catch {
        return STATUS_CODES['-1'];
      }
    }
    return codeStr; // 回傳原始文字 (如 12:30)
  }
}

class HtmlParser {
  /**
   * 解析站牌頁面 (stop.jsp)，提取 Dynamic ID (tte...) 與 Route ID 的對應關係
   */
  static parseStopPage(html: string): Map<string, { route: string, rid: string }> {
    const $ = cheerio.load(html);
    const routeMap = new Map<string, { route: string, rid: string }>();

    $('tr').each((_, row) => {
      const link = $(row).find('a[href*="route.jsp"]');
      if (link.length === 0) return;

      // 取得 RID
      const href = link.attr('href') || '';
      // 簡易 Query String 解析，避免 URLSearchParams 在某些舊環境報錯
      const ridMatch = href.match(/[?&]rid=(\d+)/);
      const rid = ridMatch ? ridMatch[1] : '';

      // 尋找 Dynamic ID (id="tteXXXX")
      let dynId: string | null = null;
      $(row).find('td[id^="tte"]').each((_, td) => {
        const idAttr = $(td).attr('id');
        if (idAttr) {
          dynId = idAttr.replace('tte', '');
          return false; // break loop
        }
      });

      if (dynId && rid) {
        routeMap.set(dynId, { route: link.text().trim(), rid });
      }
    });

    return routeMap;
  }

  /**
   * 解析路線頁面 (route.jsp)，提取去程與回程站點
   */
  static parseRoutePage(html: string): RouteDetail {
    const $ = cheerio.load(html);

    const extractStops = (classRegex: RegExp): RawRouteStop[] => {
      const stops: RawRouteStop[] = [];
      $('tr').each((_, row) => {
        const className = $(row).attr('class') || '';
        if (classRegex.test(className)) {
          const link = $(row).find('a');
          if (link.length) {
            const href = link.attr('href') || '';
            const sidMatch = href.match(/[?&]sid=([^&]+)/);
            stops.push({
              name: link.text().trim(),
              sid: sidMatch ? sidMatch[1] : ''
            });
          }
        }
      });
      return stops;
    };

    return {
      go_stops: extractStops(/ttego\d+/),
      back_stops: extractStops(/tteback\d+/)
    };
  }

  /**
   * 快速提取 HTML 中所有的 RID
   */
  static extractRidsFromHtml(html: string): Set<string> {
    const rids = new Set<string>();
    const regex = /route\.jsp\?rid=(\d+)/g;
    let match;
    while ((match = regex.exec(html)) !== null) {
      rids.add(match[1]);
    }
    return rids;
  }
}

// ==========================================
// 4. 核心服務 (BusPlannerService)
// ==========================================

export class BusPlannerService {
  private stopMap: StopMapData = { by_sid: {}, by_name: {} };
  
  // Level 1 Memory Cache: 儲存路線結構 (不含時間)，生命週期為 App 執行期間
  private memoryRouteCache: Map<string, RouteDetail> = new Map();
  // Request Deduplication Locks: 儲存進行中的 Promise
  private pendingRouteRequests: Map<string, Promise<RouteDetail>> = new Map();

  // Level 2 Disk Cache: 儲存完整的規劃結果 (需搭配 initialize 載入)
  private validationCache: { [key: string]: BusInfo[] } = {};
  private readonly CACHE_KEY = 'route_validation_cache_v2';

  constructor() {
    // 建構子不進行非同步操作，需呼叫 initialize
  }

  async initialize() {
    try {
      // 1. 載入靜態站點資料
      this.stopMap = stopDataRaw as unknown as StopMapData;

      // 2. 載入磁碟快取
      const jsonValue = await AsyncStorage.getItem(this.CACHE_KEY);
      this.validationCache = jsonValue != null ? JSON.parse(jsonValue) : {};
    } catch (e) {
      console.warn("[BusPlanner] Initialization failed:", e);
    }
  }

  // --- 資料庫存取 Helper ---

  private getStopInfo(sid: string): any {
    return this.stopMap.by_sid[sid];
  }

  public getSidsByName(name: string): string[] {
    return this.stopMap.by_name[name] || [];
  }

  public getGeoBySid(sid: string): GeoLocation | undefined {
    const info = this.getStopInfo(sid);
    if (info && info.lat && info.lon) {
      return { lat: parseFloat(info.lat), lon: parseFloat(info.lon) };
    }
    return undefined;
  }

  /**
   * 取得代表性 SIDs (依據 SLID 去重)
   */
  public getRepresentativeSids(name: string): string[] {
    const allSids = this.getSidsByName(name);
    const seenSlids = new Set<string>();
    const representatives: string[] = [];

    for (const sid of allSids) {
      const info = this.getStopInfo(sid);
      const slid = info ? info.slid : null;
      
      if (slid && !seenSlids.has(slid)) {
        seenSlids.add(slid);
        representatives.push(sid);
      } else if (!slid) {
        // 若無 slid 資料，為保險起見仍保留
        representatives.push(sid);
      }
    }
    return representatives;
  }

  // --- HTTP 請求 ---

  private async fetchText(url: string): Promise<string | null> {
    try {
      const res = await axios.get(url, { 
        headers: { 'User-Agent': USER_AGENT }, 
        timeout: 10000 
      });
      return res.status === 200 ? (typeof res.data === 'string' ? res.data : JSON.stringify(res.data)) : null;
    } catch (e) { 
      // console.debug(`Fetch failed: ${url}`); 
      return null; 
    }
  }

  private async fetchJson(url: string): Promise<any | null> {
    try {
      const res = await axios.get(url, { 
        headers: { 'User-Agent': USER_AGENT }, 
        timeout: 10000 
      });
      return res.status === 200 ? res.data : null;
    } catch (e) { return null; }
  }

  // --- 邏輯功能 ---

  /**
   * 取得特定 SID 的即時公車列表 (平行抓取 HTML + JSON)
   */
  async fetchBusesAtSid(sid: string): Promise<any[]> {
    const info = this.getStopInfo(sid);
    const slid = info ? info.slid : null;

    const taskHtml = this.fetchText(`${BASE_URL}/stop.jsp?sid=${sid}`);
    const taskJson = slid ? this.fetchJson(`${BASE_URL}/StopLocationDyna?stoplocationid=${slid}`) : Promise.resolve(null);

    const [html, jsonData] = await Promise.all([taskHtml, taskJson]);

    if (!html) return [];

    // 1. 解析 HTML 建立對照表
    const routeMap = HtmlParser.parseStopPage(html);
    const buses: any[] = [];

    // 2. 結合 JSON 資料填入精確時間
    if (jsonData && jsonData.Stop) {
      for (const stopItem of jsonData.Stop) {
        const vals = (stopItem.n1 || "").split(',');
        if (vals.length < 8) continue;
        
        const jDynId = vals[1]; // dynamic id
        const jTimeCode = vals[7]; // status code or seconds

        if (routeMap.has(jDynId)) {
          const routeInfo = routeMap.get(jDynId)!;
          const timeText = TimeParser.formatStatusCode(jTimeCode);
          
          buses.push({
            route: routeInfo.route,
            rid: routeInfo.rid,
            sid: sid,
            time_text: timeText,
            raw_time: TimeParser.parseTextToSeconds(timeText)
          });
          routeMap.delete(jDynId); // 處理完畢移除
        }
      }
    }

    // 3. 處理 HTML 有但 JSON 遺漏的車次 (通常是未發車或資料不同步)
    routeMap.forEach((info) => {
      buses.push({
        route: info.route,
        rid: info.rid,
        sid: sid,
        time_text: "更新中",
        raw_time: TIME_CONSTANTS.NOT_DEPARTED
      });
    });

    return buses;
  }

  /**
   * 取得路線結構 (含 Memory Cache 與 Promise Deduplication)
   */
  async getRouteStructure(rid: string): Promise<RouteDetail> {
    // 1. 快取命中
    if (this.memoryRouteCache.has(rid)) {
      return this.memoryRouteCache.get(rid)!;
    }

    // 2. 請求合併 (若已有相同的 RID 請求正在進行，直接回傳該 Promise)
    if (this.pendingRouteRequests.has(rid)) {
      return this.pendingRouteRequests.get(rid)!;
    }

    // 3. 發起新請求
    const promise = (async () => {
      try {
        const html = await this.fetchText(`${BASE_URL}/route.jsp?rid=${rid}`);
        const data = html ? HtmlParser.parseRoutePage(html) : { go_stops: [], back_stops: [] };
        
        this.memoryRouteCache.set(rid, data); // 寫入快取
        return data;
      } catch (e) {
        return { go_stops: [], back_stops: [] };
      } finally {
        this.pendingRouteRequests.delete(rid); // 請求結束，移除鎖
      }
    })();

    this.pendingRouteRequests.set(rid, promise);
    return promise;
  }

  /**
   * 判定路線方向並擷取路徑段
   */
  private determineDirection(
    stops: RawRouteStop[],
    startSid: string,
    endSidsSet: Set<string>,
    endName: string
  ): RawRouteStop[] | null {
    // 1. 定位起點索引 (SID > SLID > Name)
    // 由於 SLID 需要額外查表，這裡簡化為優先查 SID，若無則查 Name
    // (Python 版有查 SLID，若需要高精度可在此補上，但在前端 JS 端盡量減少計算量)
    let startIndex = stops.findIndex(s => s.sid === startSid);
    
    // Fallback: 嘗試用 SLID 匹配 (如果 SID 沒對上)
    if (startIndex === -1) {
        const startInfo = this.getStopInfo(startSid);
        const startSlid = startInfo ? startInfo.slid : null;
        if (startSlid) {
            startIndex = stops.findIndex(s => {
                const info = this.getStopInfo(s.sid);
                return info && info.slid === startSlid;
            });
        }
    }

    if (startIndex === -1) return null;

    // 2. 定位終點索引 (從起點後開始找)
    const pathSlice = stops.slice(startIndex); // 包含起點
    let foundIndex = -1;

    // 優化：預先建立終點 SLID 集合 (若 endSidsSet 很多)
    // 這裡直接在迴圈內判斷
    for (let i = 1; i < pathSlice.length; i++) { // 跳過起點自身
        const stop = pathSlice[i];
        const info = this.getStopInfo(stop.sid);
        const slid = info ? info.slid : null;

        // 命中條件：SID 吻合 OR SLID 吻合 OR 站名吻合
        if (
            endSidsSet.has(stop.sid) || 
            (slid && this.isSlidInSet(slid, endSidsSet)) || 
            stop.name === endName
        ) {
            foundIndex = i;
            break;
        }
    }

    if (foundIndex !== -1) {
        return pathSlice.slice(0, foundIndex + 1);
    }

    return null;
  }

  private isSlidInSet(targetSlid: string, sidsSet: Set<string>): boolean {
    // 這是一個效能較差的實作，若 endSidsSet 很大建議在外部預處理 SLID Set
    for (const sid of sidsSet) {
        const info = this.getStopInfo(sid);
        if (info && info.slid === targetSlid) return true;
    }
    return false;
  }

  /**
   * 更新已快取路線的即時時間
   */
  async updateCachedBuses(cachedBuses: BusInfo[]): Promise<BusInfo[]> {
    // 依據 SID 分組以批次更新
    const sidGroups: { [key: string]: BusInfo[] } = {};
    for (const b of cachedBuses) {
      if (!sidGroups[b.sid]) sidGroups[b.sid] = [];
      sidGroups[b.sid].push(b);
    }

    const tasks = Object.keys(sidGroups).map(async (sid) => {
      const groupBuses = sidGroups[sid];
      // 重新抓取該站即時資訊
      const realtimeList = await this.fetchBusesAtSid(sid);
      const realtimeMap = new Map(realtimeList.map(r => [r.rid, r]));

      return groupBuses.map(bus => {
        const rt = realtimeMap.get(bus.rid);
        const arrival = rt ? rt.time_text : "更新中";
        const raw = rt ? rt.raw_time : TIME_CONSTANTS.NOT_DEPARTED;

        // 回傳新的 BusInfo 物件 (保留靜態路徑，更新動態時間)
        return {
          ...bus,
          arrival_time_text: arrival,
          raw_time: raw,
          // 確保深拷貝物件結構，防止參照問題
          start_geo: bus.start_geo ? { ...bus.start_geo } : undefined,
          end_geo: bus.end_geo ? { ...bus.end_geo } : undefined,
          path_stops: bus.path_stops.map(s => ({
            ...s,
            geo: s.geo ? { ...s.geo } : undefined
          }))
        };
      });
    });

    const results = await Promise.all(tasks);
    // Flatten and Sort
    return results.flat().sort((a, b) => a.raw_time - b.raw_time);
  }

  // ==========================================
  // 5. 主入口 (Main Plan Method)
  // ==========================================

  async plan(startName: string, endName: string): Promise<BusInfo[]> {
    const cacheKey = `${startName}|${endName}`;

    // 1. 檢查快取
    if (this.validationCache[cacheKey]) {
      console.log(`[BusPlanner] Hit cache for ${startName}->${endName}`);
      return await this.updateCachedBuses(this.validationCache[cacheKey]);
    }

    console.log(`[BusPlanner] Start planning: ${startName} -> ${endName}`);

    // 2. 準備站點 ID
    const startSids = this.getRepresentativeSids(startName);
    const endSidsFull = this.getSidsByName(endName);
    const endSidsRep = this.getRepresentativeSids(endName);
    const endSidsSet = new Set(endSidsFull);

    if (startSids.length === 0 || endSidsRep.length === 0) {
      return [];
    }

    // 3. 平行查詢：(起點即時資訊) + (終點 HTML)
    // 目的：透過終點 HTML 找出所有經過終點的 RID，用於快速過濾
    const tStart = Promise.all(startSids.map(sid => this.fetchBusesAtSid(sid)));
    const tEnd = Promise.all(endSidsRep.map(sid => this.fetchText(`${BASE_URL}/stop.jsp?sid=${sid}`)));

    const [startResNested, endResHtml] = await Promise.all([tStart, tEnd]);

    // 解析終點經過的所有 RID
    const endRidsUnion = new Set<string>();
    endResHtml.forEach(html => {
      if (html) {
        const rids = HtmlParser.extractRidsFromHtml(html);
        rids.forEach(rid => endRidsUnion.add(rid));
      }
    });

    // 篩選候選車次 (起點有車，且該車 RID 也在終點站出現過)
    const candidates = startResNested.flat();
    const validCandidates = candidates.filter(c => endRidsUnion.has(c.rid));

    if (validCandidates.length === 0) return [];

    // 4. 取得路線詳細資料並驗證方向
    // 這裡利用 getRouteStructure 的 Request Deduplication 特性，直接 map 下去即可
    const uniqueRids = new Set(validCandidates.map(c => c.rid));
    await Promise.all(Array.from(uniqueRids).map(rid => this.getRouteStructure(rid)));

    const finalBuses: BusInfo[] = [];
    const seenKeys = new Set<string>(); // rid_sid

    for (const cand of validCandidates) {
      const key = `${cand.rid}_${cand.sid}`;
      if (seenKeys.has(key)) continue;

      // 因為上面已經 await 過，這裡會直接從記憶體快取拿
      const routeStruct = await this.getRouteStructure(cand.rid);

      let direction = "去程";
      let path = this.determineDirection(routeStruct.go_stops, cand.sid, endSidsSet, endName);

      if (!path) {
        direction = "返程";
        path = this.determineDirection(routeStruct.back_stops, cand.sid, endSidsSet, endName);
      }

      if (path) {
        seenKeys.add(key);

        // 建立完整路徑資訊 (補上 Geo)
        const enhancedPath: StopInfo[] = path.map(p => {
          const pSid = p.sid || cand.sid; // Fallback
          return {
            name: p.name,
            sid: pSid,
            geo: this.getGeoBySid(pSid)
          };
        });

        const startGeo = enhancedPath[0]?.geo || this.getGeoBySid(cand.sid);
        const endGeo = enhancedPath[enhancedPath.length - 1]?.geo;

        finalBuses.push({
          route_name: cand.route,
          rid: cand.rid,
          sid: cand.sid,
          arrival_time_text: cand.time_text,
          raw_time: cand.raw_time,
          direction_text: direction,
          stop_count: enhancedPath.length - 1,
          start_geo: startGeo,
          end_geo: endGeo,
          path_stops: enhancedPath
        });
      }
    }

    // 5. 排序與寫入快取
    finalBuses.sort((a, b) => a.raw_time - b.raw_time);

    if (finalBuses.length > 0) {
      // 寫入快取前，移除即時時間 (設為預設值)，只保留路徑結構
      const cacheData = finalBuses.map(b => ({
        ...b,
        arrival_time_text: '',
        raw_time: 0
      }));
      
      this.validationCache[cacheKey] = cacheData;
      AsyncStorage.setItem(this.CACHE_KEY, JSON.stringify(this.validationCache)).catch(e => 
        console.warn("Failed to save cache", e)
      );
    }

    return finalBuses;
  }
}