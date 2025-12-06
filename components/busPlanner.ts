/**
 * BusPlannerService.ts
 * 台北公車即時路線規劃器 (Taipei Bus Planner)
 * Target: React Native (Expo SDK 54+)
 */

// import AsyncStorage from '@react-native-async-storage/async-storage';
import * as cheerio from 'cheerio';
import stopDataRaw from '../databases/stop_id_map.json';

// 直接引入靜態資料庫
class MockAsyncStorage {
  static store: Record<string, string> = {};
  static getItem(key: string) { return Promise.resolve(this.store[key] || null); }
  static setItem(key: string, value: string) { this.store[key] = value; return Promise.resolve(); }
}
const AsyncStorage = MockAsyncStorage;

// ========== 類型定義 ==========

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
  routeName: string;
  rid: string;
  sid: string;
  arrivalTimeText: string;
  rawTime: number;
  directionText: string;
  stopCount: number;
  estimatedDuration: number; // 預估搭乘時間（分鐘）
  startGeo?: GeoLocation;
  endGeo?: GeoLocation;
  pathStops: StopInfo[];
}

export interface RouteDetail {
  goStops: Array<{ name: string; sid: string }>;
  backStops: Array<{ name: string; sid: string }>;
}

export interface StopDatabase {
  by_sid: Record<string, { lat?: string; lon?: string; slid?: string; name?: string }>;
  by_name: Record<string, string[]>;
}

// ========== 配置 ==========

const CONFIG = {
  BASE_URL: "https://api.codetabs.com/v1/proxy?quest=https://pda5284.gov.taipei/MQS",
  USER_AGENT: "Mozilla/5.0 (iPhone; CPU iPhone OS 16_0 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/16.0 Mobile/15E148 Safari/604.1",
  TIMEOUT_MS: 10000,
  CACHE_KEY_PREFIX: "BUS_ROUTE_CACHE_",
  TIME_NOT_DEPARTED: 99999,
  TIME_ARRIVING: 0,
  TIME_UNKNOWN: 88888,
  AVG_TIME_PER_STOP: 2.5, // 平均每站間隔時間（分鐘）
};

enum BusStatus {
  ARRIVING = '進站中',
  NOT_DEPARTED = '未發車',
  TRAFFIC_CONTROL = '交管不停',
  LAST_PASSED = '末班已過',
  NOT_OPERATING = '今日未營運',
  UNKNOWN = '未知'
}

// ========== 解析工具 ==========

class TimeParser {
  static parseTextToSeconds(text: string): number {
    const t = text.trim();
    if (t.includes("進站") || t.includes("將到")) return CONFIG.TIME_ARRIVING;
    if (t.includes("未發車") || t.includes("末班") || t.includes("今日未")) return CONFIG.TIME_NOT_DEPARTED;
    if (t.includes(":")) return CONFIG.TIME_UNKNOWN; 

    const digits = t.replace(/\D/g, '');
    if (!digits) return CONFIG.TIME_NOT_DEPARTED;
    
    const val = parseInt(digits, 10);
    return t.includes("分") ? val * 60 : val;
  }

  static formatStatusCode(code: string): string {
    const codeStr = String(code).trim();
    const mapping: Record<string, string> = {
      '0': BusStatus.ARRIVING,
      '': BusStatus.NOT_DEPARTED,
      '-1': BusStatus.NOT_DEPARTED,
      '-2': BusStatus.TRAFFIC_CONTROL,
      '-3': BusStatus.LAST_PASSED,
      '-4': BusStatus.NOT_OPERATING
    };

    if (mapping[codeStr]) return mapping[codeStr];
    if (codeStr.includes(':')) return codeStr;

    try {
      const secs = parseInt(codeStr, 10);
      if (isNaN(secs)) return BusStatus.UNKNOWN;
      if (secs < 0) return BusStatus.NOT_DEPARTED; 
      if (secs < 180) return "將到站";
      return `${Math.floor(secs / 60)}分`;
    } catch {
      return BusStatus.NOT_DEPARTED;
    }
  }
}

class UrlHelper {
  static getParam(href: string | undefined, key: string): string | null {
    if (!href) return null;
    try {
      const url = new URL(href, CONFIG.BASE_URL);
      return url.searchParams.get(key);
    } catch (e) {
      return null;
    }
  }
}

// ========== 核心服務 ==========

export class BusPlannerService {
  private db: StopDatabase;
  private routeRequestDedupMap: Map<string, Promise<RouteDetail>> = new Map();
  private isInitialized = false;

  constructor() {
    this.db = { by_sid: {}, by_name: {} };
  }

  public async initialize(): Promise<void> {
    this.db = stopDataRaw as unknown as StopDatabase;
    this.isInitialized = true;
    return Promise.resolve();
  }

  // --- Getters ---

  public getSidsByName(name: string): string[] {
    return this.db.by_name[name] || [];
  }

  public getGeoBySid(sid: string): GeoLocation | undefined {
    const info = this.db.by_sid[sid];
    if (info && info.lat && info.lon) {
      return { lat: parseFloat(info.lat), lon: parseFloat(info.lon) };
    }
    return undefined;
  }

  public getRepresentativeSids(name: string): string[] {
    const allSids = this.getSidsByName(name);
    const seenSlids = new Set<string>();
    const representatives: string[] = [];

    for (const sid of allSids) {
      const info = this.db.by_sid[sid];
      const slid = info?.slid;

      if (slid) {
        if (!seenSlids.has(slid)) {
          seenSlids.add(slid);
          representatives.push(sid);
        }
      } else {
        representatives.push(sid);
      }
    }
    return representatives;
  }

  public getAllStopNames(): string[] {
    return Object.keys(this.db.by_name);
  }

  /**
   * 計算預估搭乘時間
   * @param stopCount 站數（不含起點）
   * @returns 預估時間（分鐘）
   */
  private calculateEstimatedDuration(stopCount: number): number {
    if (stopCount <= 0) return 0;
    // 基本計算：站數 × 平均站間時間
    // 加上一些緩衝時間（首站等待 + 末站下車）
    const travelTime = stopCount * CONFIG.AVG_TIME_PER_STOP;
    const bufferTime = 1; // 緩衝時間（分鐘）
    return Math.ceil(travelTime + bufferTime);
  }

  public findNearestStop(userLat: number, userLon: number): string | null {
    const stopNames = this.getAllStopNames();
    let nearestStop: string | null = null;
    let minDistance = Infinity;

    for (const stopName of stopNames) {
      const sids = this.getRepresentativeSids(stopName);
      if (sids.length === 0) continue;

      const geo = this.getGeoBySid(sids[0]);
      if (!geo) continue;

      const distance = this.calculateDistance(userLat, userLon, geo.lat, geo.lon);
      if (distance < minDistance) {
        minDistance = distance;
        nearestStop = stopName;
      }
    }

    return nearestStop;
  }

  private calculateDistance(lat1: number, lon1: number, lat2: number, lon2: number): number {
    const R = 6371; // 地球半徑（公里）
    const dLat = (lat2 - lat1) * Math.PI / 180;
    const dLon = (lon2 - lon1) * Math.PI / 180;
    const a = 
      Math.sin(dLat / 2) * Math.sin(dLat / 2) +
      Math.cos(lat1 * Math.PI / 180) * Math.cos(lat2 * Math.PI / 180) *
      Math.sin(dLon / 2) * Math.sin(dLon / 2);
    const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
    return R * c;
  }

  // --- Logic ---

  public async fetchBusesAtSid(sid: string): Promise<any[]> {
    const info = this.db.by_sid[sid];
    const slid = info?.slid;

    const taskHtml = this._fetchText(`${CONFIG.BASE_URL}/stop.jsp?sid=${sid}`);
    const taskJson = slid 
      ? this._fetchJson(`${CONFIG.BASE_URL}/StopLocationDyna?stoplocationid=${slid}`) 
      : Promise.resolve(null);

    const [html, jsonData] = await Promise.all([taskHtml, taskJson]);

    if (!html) return [];

    const $ = cheerio.load(html);
    const routeMap: Record<string, { route: string; rid: string }> = {};

    $('tr').each((_, row) => {
        const $row = $(row);
        // FIX: 使用 .first() 避免抓到隱藏的區間車連結文字
        const link = $row.find('a[href*="route.jsp"]').first();
        if (link.length === 0) return;

        const href = link.attr('href');
        const rid = UrlHelper.getParam(href, 'rid');
        const routeName = link.text().trim();
        
        // FIX: 更精確地尋找 tte ID，模擬 Python 的 find behavior
        let dynId = null;
        const dynIdRaw = $row.find('td[id^="tte"]').attr('id');
        if (dynIdRaw) {
            dynId = dynIdRaw.replace('tte', '');
        }

        if (dynId && rid) {
            routeMap[dynId] = { route: routeName, rid };
        }
    });

    const buses: any[] = [];

    if (jsonData && jsonData.Stop) {
        for (const item of jsonData.Stop) {
            const vals = (item.n1 || "").split(',');
            if (vals.length < 8) continue;

            const jDynId = vals[1];
            const jTimeCode = vals[7];

            if (routeMap[jDynId]) {
                const { route, rid } = routeMap[jDynId];
                delete routeMap[jDynId]; 
                
                const timeText = TimeParser.formatStatusCode(jTimeCode);
                buses.push({
                    route,
                    rid,
                    sid,
                    timeText: timeText,
                    rawTime: TimeParser.parseTextToSeconds(timeText)
                });
            }
        }
    }

    for (const key in routeMap) {
        const info = routeMap[key];
        buses.push({
            route: info.route,
            rid: info.rid,
            sid,
            timeText: "更新中",
            rawTime: CONFIG.TIME_NOT_DEPARTED
        });
    }

    // FIX: 強制依照時間排序，確保 plan 在去重時優先保留「進站中」的最佳車次
    // 這解決了 0南 (進站中) 被 0南 (21分) 覆蓋的問題
    buses.sort((a, b) => a.rawTime - b.rawTime);

    return buses;
  }

  public async getRouteStructure(rid: string): Promise<RouteDetail> {
    if (this.routeRequestDedupMap.has(rid)) {
      return this.routeRequestDedupMap.get(rid)!;
    }

    const task = (async (): Promise<RouteDetail> => {
      const html = await this._fetchText(`${CONFIG.BASE_URL}/route.jsp?rid=${rid}`);
      if (!html) return { goStops: [], backStops: [] };

      const $ = cheerio.load(html);

      const extractStops = (classRegex: RegExp) => {
        const stops: Array<{ name: string; sid: string }> = [];
        $('tr').each((_, el) => {
            const className = $(el).attr('class') || '';
            if (classRegex.test(className)) {
                // FIX: 同樣使用 .first()
                const link = $(el).find('a').first();
                if (link.length > 0) {
                    const href = link.attr('href');
                    const sid = UrlHelper.getParam(href, 'sid');
                    if (sid) {
                        stops.push({ name: link.text().trim(), sid: sid });
                    }
                }
            }
        });
        return stops;
      };

      return {
        goStops: extractStops(/ttego\d+/),
        backStops: extractStops(/tteback\d+/)
      };
    })();

    this.routeRequestDedupMap.set(rid, task);
    
    try {
        return await task;
    } finally {
        setTimeout(() => this.routeRequestDedupMap.delete(rid), 2000); 
    }
  }

  public async updateCachedBuses(cachedBuses: BusInfo[]): Promise<BusInfo[]> {
    const sidGroups: Record<string, BusInfo[]> = {};
    cachedBuses.forEach(b => {
        if (!sidGroups[b.sid]) sidGroups[b.sid] = [];
        sidGroups[b.sid].push(b);
    });

    const tasks = Object.keys(sidGroups).map(async (sid) => {
        const groupBuses = sidGroups[sid];
        const realtimeList = await this.fetchBusesAtSid(sid);
        const realtimeMap = new Map(realtimeList.map(x => [x.rid, x]));

        return groupBuses.map(busData => {
            const rt = realtimeMap.get(busData.rid);
            const arrival = rt ? rt.timeText : "更新中";
            const raw = rt ? rt.rawTime : CONFIG.TIME_NOT_DEPARTED;

            return {
                ...busData,
                arrivalTimeText: arrival,
                rawTime: raw,
                estimatedDuration: busData.estimatedDuration || 0
            };
        });
    });

    const results = await Promise.all(tasks);
    return results.flat().sort((a, b) => a.rawTime - b.rawTime);
  }

  public async plan(startName: string, endName: string): Promise<BusInfo[]> {
    if (!this.isInitialized) await this.initialize();

    const cacheKey = `${CONFIG.CACHE_KEY_PREFIX}${startName}_${endName}`;
    
    try {
        const cachedJson = await AsyncStorage.getItem(cacheKey);
        if (cachedJson) {
            const cachedBuses: BusInfo[] = JSON.parse(cachedJson);
            return await this.updateCachedBuses(cachedBuses);
        }
    } catch (e) {
        console.warn("[BusPlanner] Cache read error:", e);
    }

    const startSids = this.getRepresentativeSids(startName);
    const endSidsFull = this.getSidsByName(endName);
    const endSidsRep = this.getRepresentativeSids(endName);
    const endSidsSet = new Set(endSidsFull);

    if (startSids.length === 0 || endSidsRep.length === 0) return [];

    const [startRealtimeGroups, endHtmlResults] = await Promise.all([
        Promise.all(startSids.map(sid => this.fetchBusesAtSid(sid))),
        Promise.all(endSidsRep.map(sid => this._fetchText(`${CONFIG.BASE_URL}/stop.jsp?sid=${sid}`)))
    ]);

    const endRidsUnion = new Set<string>();
    endHtmlResults.forEach(html => {
        if (html) {
            const matches = html.matchAll(/route\.jsp\?rid=(\d+)/g);
            for (const m of matches) {
                endRidsUnion.add(m[1]);
            }
        }
    });

    const allStartBuses = startRealtimeGroups.flat();
    const validCandidates = allStartBuses.filter(c => endRidsUnion.has(c.rid));

    if (validCandidates.length === 0) return [];

    const uniqueRids = [...new Set(validCandidates.map(c => c.rid))];
    await Promise.all(uniqueRids.map(rid => this.getRouteStructure(rid)));

    const finalBuses: BusInfo[] = [];
    const seenKeys = new Set<string>(); 

    for (const cand of validCandidates) {
        const key = `${cand.rid}_${cand.sid}`;
        if (seenKeys.has(key)) continue;

        const routeStruct = await this.getRouteStructure(cand.rid);
        
        let direction = "去程";
        let path = this._determineDirection(routeStruct.goStops, cand.sid, endSidsSet, endName);

        if (!path) {
            direction = "返程";
            path = this._determineDirection(routeStruct.backStops, cand.sid, endSidsSet, endName);
        }

        if (path) {
            seenKeys.add(key);
            
            const enhancedPath: StopInfo[] = path.map(p => ({
                name: p.name,
                sid: p.sid,
                geo: this.getGeoBySid(p.sid)
            }));

            const startGeo = enhancedPath.length > 0 ? enhancedPath[0].geo : this.getGeoBySid(cand.sid);
            const endGeo = enhancedPath.length > 0 ? enhancedPath[enhancedPath.length - 1].geo : undefined;
            const stopCount = enhancedPath.length - 1;
            const estimatedDuration = this.calculateEstimatedDuration(stopCount);

            finalBuses.push({
                routeName: cand.route,
                rid: cand.rid,
                sid: cand.sid,
                arrivalTimeText: cand.timeText,
                rawTime: cand.rawTime,
                directionText: direction,
                stopCount: stopCount,
                estimatedDuration: estimatedDuration,
                startGeo: startGeo,
                endGeo: endGeo,
                pathStops: enhancedPath
            });
        }
    }

    finalBuses.sort((a, b) => a.rawTime - b.rawTime);
    
    const cachePayload = finalBuses.map(b => ({
        ...b,
        arrivalTimeText: '',
        rawTime: 0
    }));
    
    AsyncStorage.setItem(cacheKey, JSON.stringify(cachePayload))
        .catch(e => console.warn("[BusPlanner] Cache write failed:", e));

    return finalBuses;
  }

  // --- Helpers ---

  private async _fetchText(url: string): Promise<string | null> {
    try {
        const res = await fetch(url);
        if (!res.ok) return null;
        return await res.text();
    } catch (e) {
        return null;
    }
  }

  private async _fetchJson(url: string): Promise<any | null> {
    try {
        const res = await fetch(url);
        if (!res.ok) return null;
        return await res.json();
    } catch (e) {
        return null;
    }
  }

  private _determineDirection(
    stops: Array<{ name: string; sid: string }>,
    startSid: string,
    endSidsSet: Set<string>,
    endName: string
  ): Array<{ name: string; sid: string }> | null {
    const startInfo = this.db.by_sid[startSid];
    const targetSlid = startInfo?.slid;

    let startIndex = -1;
    for (let i = 0; i < stops.length; i++) {
        const currSid = stops[i].sid;
        if (currSid === startSid) {
            startIndex = i;
            break;
        }
        if (targetSlid) {
            const currInfo = this.db.by_sid[currSid];
            if (currInfo?.slid === targetSlid) {
                startIndex = i;
                break;
            }
        }
    }

    if (startIndex === -1) return null;

    const pathSlice = stops.slice(startIndex);
    const endSlidsSet = new Set<string>();
    endSidsSet.forEach(esid => {
        const info = this.db.by_sid[esid];
        if (info?.slid) endSlidsSet.add(info.slid);
    });

    let foundIndex = -1;
    for (let i = 1; i < pathSlice.length; i++) { 
        const stop = pathSlice[i];
        const currInfo = this.db.by_sid[stop.sid];
        const currSlid = currInfo?.slid;

        const isMatch = endSidsSet.has(stop.sid) || 
                        (currSlid && endSlidsSet.has(currSlid)) ||
                        stop.name === endName;
        
        if (isMatch) {
            foundIndex = i;
            break;
        }
    }

    if (foundIndex !== -1) {
        return pathSlice.slice(0, foundIndex + 1);
    }

    return null;
  }
}