# 🚌 Taipei Bus Planner (TS Version) 技術手冊

**版本**：v2.0 (React Native / TypeScript)
**前身**：`optimizeVersion.py` (Python)
**核心改動**：由「純爬蟲」轉為「靜態路徑優先」架構，並修正地圖資料源的變數誤用問題。

## 1\. 簡介 (Introduction)

本模組移植自 `optimizeVersion.py`，但針對行動端環境進行了重構。
舊版邏輯依賴大量即時請求來篩選路線，速度慢且易被阻擋。**新版 (`busPlanner.ts`) 改採「靜態優先」策略**：先利用離線路線檔 (`metro_bus_routes.json`) 算出可行路徑，再針對性地抓取即時資料。

此外，我們發現原專案中的地圖資料檔 (`stops.json`) 存在變數誤用（欄位名為 `sid` 但內容實為 `slid`），導致地圖查詢不準確。新版已全面修正此問題，確保地圖點擊能精確對應到物理站牌。

-----

## 2\. 資料架構 (Data Schema)

系統依賴兩個核心靜態 JSON，架構如下：

### A. 路線拓撲 (`metro_bus_routes.json`)

提供靜態路線站序，用於離線計算「A站到B站有哪些公車經過」。

```json
[
  {
    "route_name": "307",         // (Str) 路線名稱
    "rid": "10254",              // (Str) 路線唯一碼
    "direction": 0,              // (Int) 0=去程, 1=返程
    "stops_sid": ["123", "456"]  // (Array) 依序排列的站點 SID
  }
]
```

### B. 站點索引 (`stop_id_map_v3.json`)

採用 Geo Pooling 技術壓縮的站點資料庫。

  * **`g` (Geo Pool)**: 座標陣列 `[[Lat, Lon], ...]`。
  * **`n` (Name Index)**: `{ "站名": ["SID1", "SID2"] }`。
  * **`s` (Stops)**: 站點詳情 `{ "SID": [Name, SLID, GeoIndex] }`。
      * **關鍵欄位 `SLID` (Stop Location ID)**：物理站牌 ID。同一候車亭內的所有路線共享此 ID，用於爬取動態。

-----

## 3\. API 參考 (API Reference)

所有方法皆回傳 `Promise`。以下是核心資料結構與方法說明。

### 核心回傳物件 (`BusInfo`)

```typescript
interface BusInfo {
  routeName: string;       // 路線名稱 (如 "307")
  rid: string;             // Route ID
  sid: string;             // 邏輯站點 ID (SID)
  arrivalTimeText: string; // 顯示文字 (如 "3分", "進站中")
  rawTime: number;         // 排序用秒數 (-1:進站, 99999:未發車)
  directionText: string;   // "去程" 或 "返程"
  pathStops: StopInfo[];   // 完整路徑站點列表 (含座標)
}
```

### 方法詳解

#### `plan(startName, endName)`

  * **用途**：規劃兩地之間的最佳路線。
  * **Input**: `(string, string)` - 起點站名, 終點站名
  * **Output**: `Promise<BusInfo[]>` - 已排序的路線列表
  * **邏輯**：靜態路徑匹配 $\to$ SLID 聚合查詢 $\to$ 交集過濾。

#### `getArrivalsBySlid(slid, stopName)`

  * **用途**：**[地圖專用]** 查詢特定物理站牌的動態。
  * **Input**: `(string, string)` - SLID (物理站牌ID), 站名 (僅作標示用)
  * **Output**: `Promise<any[]>` - 該站牌所有公車動態
  * **特點**：直接鎖定物理位置，解決同名站牌混淆問題。

#### `getStopArrivals(stopName)`

  * **用途**：**[搜尋專用]** 模糊查詢某站名下的所有動態。
  * **Input**: `(string)` - 站名
  * **Output**: `Promise<any[]>`
  * **特點**：會列出該名稱下所有方向、所有位置的站牌資訊。

-----

## 4\. 關鍵修正與優化 (Fixes & Improvements)

1.  **地圖資料精確化 (Map Accuracy Fix)**：

      * **問題**：原 `stops.json` 中的 `sid` 欄位儲存的其實是 `slid` (Stop Location ID)。舊版程式誤將其當作 SID 處理，導致資料錯亂。
      * **修正**：新版 `map.native.tsx` 與 Service 明確將其視為 `slid`，並透過 `getArrivalsBySlid` 進行查詢。
      * **效益**：現在地圖上點擊某個座標的站牌，顯示的一定是**該地理位置**的公車動態，不會再跳到對向或遠處的同名站牌。

2.  **新北市/跨區公車修復**：

      * **修正**：改良 HTML 解析器 (`cheerio`)，能夠正確處理新北市公車 API 格式（部分欄位結構與台北市不同）。
      * **效益**：大幅減少「未知」或「查無資料」的情況。

3.  **效能提升**：

      * **靜態優先**：透過 `metro_bus_routes.json` 先過濾掉 90% 無效路線，僅對有效路線發起網路請求。
      * **SLID 聚合**：將同一站牌的多條路線請求合併為單次 HTTP Request，載入速度提升顯著。


## 5\. API 使用範例 (Usage Examples)

以下範例展示如何在 React Native 組件中呼叫 `BusPlannerService` 的三種主要功能。

**前置作業**：

```typescript
import { BusPlannerService } from './services/busPlanner';

// 實例化 Service (建議使用 useRef 或 Singleton 模式保持實例)
const planner = new BusPlannerService();
```

### 範例 1：路線規劃 (`plan`)

適用於「路線規劃」頁面，計算兩地之間的最佳公車路徑。

```typescript
const handleRouteSearch = async () => {
  try {
    // 輸入起點與終點站名
    const routes = await planner.plan('捷運公館站', '師大');
    
    routes.forEach(route => {
      console.log(`路線: ${route.routeName} (${route.directionText})`);
      console.log(`預估時間: ${route.arrivalTimeText}`);
      console.log(`經過站數: ${route.stopCount}`);
    });
  } catch (error) {
    console.error("規劃失敗:", error);
  }
};
```

### 範例 2：關鍵字模糊搜尋 (`getStopArrivals`)

適用於「搜尋框」，使用者只輸入站名，系統列出該名稱下所有相關站牌的動態。

```typescript
const handleKeywordSearch = async (inputName: string) => {
  // 例如輸入 "師大"
  const buses = await planner.getStopArrivals(inputName);
  
  // 回傳結果包含不同方向、不同位置名為 "師大" 的所有公車
  console.log(`找到 ${buses.length} 班公車`);
};
```

### 範例 3：精確位置查詢 (`getArrivalsBySlid`) [New]

適用於「地圖點擊」，直接查詢特定物理站牌（SLID）的動態。

```typescript
const handleMapClick = async (slid: string, stopName: string) => {
  // 例如點擊地圖上的 Marker，其 slid 為 "123456"
  const buses = await planner.getArrivalsBySlid(slid, stopName);
  
  // 回傳結果"僅"包含該候車亭會停靠的公車，不會混入對向車道資訊
  console.log(`此站牌共有 ${buses.length} 條路線經過`);
};
```

-----

## 6\. `stop.tsx` 的運作邏輯 (Stop Screen Usage)

現在的 `stop.tsx` 是一個**智慧型容器**，它會根據傳入參數的不同，自動決定要執行「模糊搜尋」還是「精確鎖定」。

### 核心邏輯流程

頁面接收參數：`params: { name: string, slid?: string }`

1.  **檢查 `slid`**：
      * **若有 `slid`** $\to$ 呼叫 `getArrivalsBySlid()`。
      * **若無 `slid`** $\to$ 呼叫 `getStopArrivals()`。

### 場景 A：從搜尋頁進入 (Discovery Mode)

當使用者在搜尋框輸入站名時，我們只知道名字，不知道具體是哪一支站牌。

  * **行為**：僅傳遞 `name`。
  * **路由呼叫**：
    ```typescript
    router.push({ 
      pathname: '/stop', 
      params: { name: '捷運淡水站' } // 只有名字
    });
    ```
  * **結果**：`stop.tsx` 顯示該區域所有名為「捷運淡水站」的公車資訊（包含去回程）。

### 場景 B：從地圖頁進入 (Precision Mode)

當使用者點擊地圖上的 Marker 時，我們明確知道那是哪一個物理站點（擁有唯一的 SLID）。

  * **行為**：傳遞 `name` 與 `slid`。
  * **路由呼叫**：
    ```typescript
    router.push({ 
      pathname: '/stop', 
      params: { 
        name: '捷運淡水站', 
        slid: '123456789' // 地圖資料提供的物理 ID
      } 
    });
    ```
  * **結果**：`stop.tsx` **精確鎖定**該地圖圖標代表的站牌。使用者看到的動態資訊，就是該地理位置實際會看到的公車，完全排除了同名但不同位置的干擾資訊。