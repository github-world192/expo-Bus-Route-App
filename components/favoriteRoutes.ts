/**
 * 常用路線管理服務
 * 使用 AsyncStorage 儲存使用者的常用路線
 */

import AsyncStorage from '@react-native-async-storage/async-storage';

// 常用路線介面
export interface FavoriteRoute {
  id: string;                    // 唯一 ID (fromStop-toStop)
  fromStop: string;              // 起點站牌名稱
  toStop: string;                // 終點站牌名稱
  displayName?: string;          // 自訂顯示名稱（如"回家"、"上班"）
  addedAt: number;               // 加入時間戳記
  lastUsed?: number;             // 最後使用時間
  useCount: number;              // 使用次數
  pinned: boolean;               // 是否置頂
  cachedRouteNames?: string[];   // 快取的可用公車路線（用於快速顯示）
  cacheUpdatedAt?: number;       // 快取更新時間
}

// 常用路線資料結構
interface FavoriteRoutesData {
  routes: FavoriteRoute[];
  maxCount: number;              // 最大數量限制
}

// 儲存 Key
const STORAGE_KEY = '@favorite_routes';
const DEFAULT_MAX_COUNT = 10;

/**
 * 常用路線服務類別
 */
export class FavoriteRoutesService {
  private static instance: FavoriteRoutesService;
  private cache: FavoriteRoutesData | null = null;

  private constructor() {}

  /**
   * 取得單例實例
   */
  static getInstance(): FavoriteRoutesService {
    if (!FavoriteRoutesService.instance) {
      FavoriteRoutesService.instance = new FavoriteRoutesService();
    }
    return FavoriteRoutesService.instance;
  }

  /**
   * 生成路線 ID
   */
  private generateRouteId(fromStop: string, toStop: string): string {
    return `${fromStop}-${toStop}`;
  }

  /**
   * 從儲存空間讀取資料
   */
  private async loadData(): Promise<FavoriteRoutesData> {
    try {
      const data = await AsyncStorage.getItem(STORAGE_KEY);
      if (data) {
        const parsed: FavoriteRoutesData = JSON.parse(data);
        this.cache = parsed;
        return parsed;
      }
    } catch (error) {
      console.error('讀取常用路線失敗:', error);
    }

    // 首次使用：建立預設資料，包含「師大分部→師大」
    const now = Date.now();
    const defaultRoute: FavoriteRoute = {
      id: this.generateRouteId('師大分部', '師大'),
      fromStop: '師大分部',
      toStop: '師大',
      displayName: undefined,
      addedAt: now,
      lastUsed: undefined,
      useCount: 0,
      pinned: false,
    };

    const defaultData: FavoriteRoutesData = {
      routes: [defaultRoute],
      maxCount: DEFAULT_MAX_COUNT,
    };
    
    // 儲存預設資料
    await this.saveData(defaultData);
    this.cache = defaultData;
    return defaultData;
  }

  /**
   * 儲存資料到儲存空間
   */
  private async saveData(data: FavoriteRoutesData): Promise<boolean> {
    try {
      await AsyncStorage.setItem(STORAGE_KEY, JSON.stringify(data));
      this.cache = data;
      console.log('常用路線已儲存:', data.routes.length, '條');
      return true;
    } catch (error) {
      console.error('儲存常用路線失敗:', error);
      return false;
    }
  }

  /**
   * 取得所有常用路線
   * @param sorted 是否排序（置頂 > 使用次數 > 新增時間）
   */
  async getAllRoutes(sorted: boolean = true): Promise<FavoriteRoute[]> {
    const data = await this.loadData();
    
    if (!sorted) {
      return data.routes;
    }

    // 排序：置頂優先 > 使用次數 > 最後使用時間 > 新增時間
    return [...data.routes].sort((a, b) => {
      // 1. 置頂路線優先
      if (a.pinned !== b.pinned) {
        return a.pinned ? -1 : 1;
      }
      
      // 2. 使用次數多的優先
      if (a.useCount !== b.useCount) {
        return b.useCount - a.useCount;
      }
      
      // 3. 最後使用時間較新的優先
      if (a.lastUsed && b.lastUsed && a.lastUsed !== b.lastUsed) {
        return b.lastUsed - a.lastUsed;
      }
      
      // 4. 新增時間較新的優先
      return b.addedAt - a.addedAt;
    });
  }

  /**
   * 檢查路線是否已加入常用
   */
  async isFavorite(fromStop: string, toStop: string): Promise<boolean> {
    const data = await this.loadData();
    const id = this.generateRouteId(fromStop, toStop);
    return data.routes.some(route => route.id === id);
  }

  /**
   * 取得特定常用路線
   */
  async getRoute(fromStop: string, toStop: string): Promise<FavoriteRoute | null> {
    const data = await this.loadData();
    const id = this.generateRouteId(fromStop, toStop);
    return data.routes.find(route => route.id === id) || null;
  }

  /**
   * 新增常用路線
   */
  async addRoute(
    fromStop: string,
    toStop: string,
    displayName?: string
  ): Promise<{ success: boolean; message: string; route?: FavoriteRoute }> {
    try {
      const data = await this.loadData();
      const id = this.generateRouteId(fromStop, toStop);

      // 檢查是否已存在
      const existingIndex = data.routes.findIndex(route => route.id === id);
      if (existingIndex !== -1) {
        return {
          success: false,
          message: '此路線已在常用清單中',
          route: data.routes[existingIndex],
        };
      }

      // 檢查是否超過最大數量
      if (data.routes.length >= data.maxCount) {
        return {
          success: false,
          message: `常用路線已達上限（${data.maxCount} 條）`,
        };
      }

      // 建立新路線
      const newRoute: FavoriteRoute = {
        id,
        fromStop,
        toStop,
        displayName,
        addedAt: Date.now(),
        lastUsed: Date.now(),
        useCount: 1,
        pinned: false,
      };

      data.routes.push(newRoute);
      const saved = await this.saveData(data);

      if (saved) {
        console.log('新增常用路線:', fromStop, '→', toStop);
        return {
          success: true,
          message: '已加入常用路線',
          route: newRoute,
        };
      } else {
        return {
          success: false,
          message: '儲存失敗',
        };
      }
    } catch (error) {
      console.error('新增常用路線錯誤:', error);
      return {
        success: false,
        message: '發生錯誤',
      };
    }
  }

  /**
   * 移除常用路線
   */
  async removeRoute(fromStop: string, toStop: string): Promise<{ success: boolean; message: string }> {
    try {
      const data = await this.loadData();
      const id = this.generateRouteId(fromStop, toStop);

      const originalLength = data.routes.length;
      data.routes = data.routes.filter(route => route.id !== id);

      if (data.routes.length === originalLength) {
        return {
          success: false,
          message: '路線不存在',
        };
      }

      const saved = await this.saveData(data);
      
      if (saved) {
        console.log('移除常用路線:', fromStop, '→', toStop);
        return {
          success: true,
          message: '已移除常用路線',
        };
      } else {
        return {
          success: false,
          message: '儲存失敗',
        };
      }
    } catch (error) {
      console.error('移除常用路線錯誤:', error);
      return {
        success: false,
        message: '發生錯誤',
      };
    }
  }

  /**
   * 更新路線資訊（重新命名、置頂等）
   */
  async updateRoute(
    fromStop: string,
    toStop: string,
    updates: Partial<Pick<FavoriteRoute, 'displayName' | 'pinned'>>
  ): Promise<{ success: boolean; message: string }> {
    try {
      const data = await this.loadData();
      const id = this.generateRouteId(fromStop, toStop);

      const routeIndex = data.routes.findIndex(route => route.id === id);
      if (routeIndex === -1) {
        return {
          success: false,
          message: '路線不存在',
        };
      }

      // 更新欄位
      if ('displayName' in updates) {
        data.routes[routeIndex].displayName = updates.displayName;
      }
      if ('pinned' in updates && updates.pinned !== undefined) {
        data.routes[routeIndex].pinned = updates.pinned;
      }

      const saved = await this.saveData(data);
      
      if (saved) {
        console.log('更新常用路線:', fromStop, '→', toStop, updates);
        return {
          success: true,
          message: '已更新路線',
        };
      } else {
        return {
          success: false,
          message: '儲存失敗',
        };
      }
    } catch (error) {
      console.error('更新常用路線錯誤:', error);
      return {
        success: false,
        message: '發生錯誤',
      };
    }
  }

  /**
   * 記錄路線使用（增加使用次數，更新最後使用時間）
   */
  async recordUsage(fromStop: string, toStop: string): Promise<void> {
    try {
      const data = await this.loadData();
      const id = this.generateRouteId(fromStop, toStop);

      const routeIndex = data.routes.findIndex(route => route.id === id);
      if (routeIndex !== -1) {
        data.routes[routeIndex].useCount += 1;
        data.routes[routeIndex].lastUsed = Date.now();
        await this.saveData(data);
        console.log('記錄路線使用:', fromStop, '→', toStop, '使用次數:', data.routes[routeIndex].useCount);
      }
    } catch (error) {
      console.error('記錄路線使用錯誤:', error);
    }
  }

  /**
   * 清空所有常用路線
   */
  async clearAll(): Promise<{ success: boolean; message: string }> {
    try {
      const data = await this.loadData();
      data.routes = [];
      const saved = await this.saveData(data);
      
      if (saved) {
        console.log('已清空所有常用路線');
        return {
          success: true,
          message: '已清空所有常用路線',
        };
      } else {
        return {
          success: false,
          message: '儲存失敗',
        };
      }
    } catch (error) {
      console.error('清空常用路線錯誤:', error);
      return {
        success: false,
        message: '發生錯誤',
      };
    }
  }

  /**
   * 取得統計資訊
   */
  async getStats(): Promise<{
    totalRoutes: number;
    pinnedRoutes: number;
    totalUsageCount: number;
    maxCount: number;
  }> {
    const data = await this.loadData();
    return {
      totalRoutes: data.routes.length,
      pinnedRoutes: data.routes.filter(r => r.pinned).length,
      totalUsageCount: data.routes.reduce((sum, r) => sum + r.useCount, 0),
      maxCount: data.maxCount,
    };
  }

  /**
   * 更新路線的快取路線名稱
   * @param fromStop 起點站牌
   * @param toStop 終點站牌
   * @param routeNames 可用的公車路線名稱陣列
   */
  async updateRouteCacheNames(
    fromStop: string,
    toStop: string,
    routeNames: string[]
  ): Promise<boolean> {
    try {
      const data = await this.loadData();
      const id = this.generateRouteId(fromStop, toStop);
      const routeIndex = data.routes.findIndex(route => route.id === id);

      if (routeIndex === -1) {
        console.warn('路線不存在，無法更新快取');
        return false;
      }

      data.routes[routeIndex].cachedRouteNames = routeNames;
      data.routes[routeIndex].cacheUpdatedAt = Date.now();
      
      const saved = await this.saveData(data);
      if (saved) {
        console.log('已更新路線快取:', fromStop, '→', toStop, '路線數:', routeNames.length);
      }
      return saved;
    } catch (error) {
      console.error('更新路線快取錯誤:', error);
      return false;
    }
  }

  /**
   * 取得路線的快取路線名稱
   * @param fromStop 起點站牌
   * @param toStop 終點站牌
   * @returns 快取的路線名稱陣列，如果沒有快取則返回 null
   */
  async getCachedRouteNames(
    fromStop: string,
    toStop: string
  ): Promise<string[] | null> {
    try {
      const data = await this.loadData();
      const id = this.generateRouteId(fromStop, toStop);
      const route = data.routes.find(route => route.id === id);

      if (!route || !route.cachedRouteNames) {
        return null;
      }

      return route.cachedRouteNames;
    } catch (error) {
      console.error('取得快取路線名稱錯誤:', error);
      return null;
    }
  }

  /**
   * 清除快取（用於強制重新載入）
   */
  clearCache(): void {
    this.cache = null;
  }
}

// 匯出單例實例
export const favoriteRoutesService = FavoriteRoutesService.getInstance();
