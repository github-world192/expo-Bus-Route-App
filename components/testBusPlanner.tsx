/**
 * testBusPlanner.tsx
 * * 執行指令: npx tsx testBusPlanner.tsx
 * 前置需求: npm install cheerio
 */

import { BusPlannerService, BusInfo } from './busPlanner';

// ========== 格式化輔助工具 (模擬 Python print 格式) ==========

/**
 * 計算字串的「視覺寬度」
 * 中文字算 2 格，英數字算 1 格，確保 Console 對齊與 Python 一致
 */
function getVisualLength(str: string): number {
    let len = 0;
    for (let i = 0; i < str.length; i++) {
        // ASCII 範圍外視為寬字元 (中日韓)
        len += (str.charCodeAt(i) > 255) ? 2 : 1;
    }
    return len;
}

/**
 * 模擬 Python 的 "{:<N}" (靠左對齊補空白)
 */
function padRight(str: string, targetLen: number): string {
    const visualLen = getVisualLength(str);
    const padding = Math.max(0, targetLen - visualLen);
    return str + " ".repeat(padding);
}

// ========== 主測試邏輯 ==========

async function main() {
    // 1. 設定參數 (與 Python 版本一致)
    const startSpot = "捷運公館站";
    const endSpot = "師大";

    console.log(`🚀 [BusPlanner TS] 規劃路線: ${startSpot} -> ${endSpot}`);
    console.log("=".repeat(70));

    // 2. 初始化與執行
    const service = new BusPlannerService();
    
    // 注意: 資料已經透過 import 自動載入，無需手動傳入
    await service.initialize(); 

    let buses: BusInfo[] = [];
    try {
        buses = await service.plan(startSpot, endSpot);
    } catch (e) {
        console.error("執行錯誤:", e);
        return;
    }

    if (buses.length === 0) {
        console.log("⚠️ 查無結果。");
        return;
    }

    console.log(`✅ 查詢成功! 共找到 ${buses.length} 班公車\n`);

    // 3. 輸出表格 (Header)
    // Python: "{:<6} | {:<8} | {:<5} | {:<5} | {:<10}"
    const header = 
        padRight("路線", 6) + " | " + 
        padRight("預估時間", 8) + " | " + 
        padRight("方向", 5) + " | " + 
        padRight("站數", 5) + " | " + 
        padRight("候車SID", 10);
    
    console.log(header);
    console.log("-".repeat(70));

    // 4. 輸出列表 (Rows)
    for (let i = 0; i < buses.length; i++) {
        const bus = buses[i];
        
        const row = 
            padRight(bus.routeName, 6) + " | " + 
            padRight(bus.arrivalTimeText, 8) + " | " + 
            padRight(bus.directionText, 5) + " | " + 
            padRight(bus.stopCount.toString(), 5) + " | " + 
            padRight(bus.sid, 10);
            
        console.log(row);

        // 前兩班車顯示詳細除錯資訊 (Geo & RID)
        if (i < 2) {
            const lat = bus.startGeo ? bus.startGeo.lat.toFixed(4) : "N/A";
            const lon = bus.startGeo ? bus.startGeo.lon.toFixed(4) : "N/A";
            console.log(`   ↳ RID: ${bus.rid} | Geo: ${lat},${lon}`);
        }
    }

    // 5. 額外測試：單一站點即時資訊 (驗證 fetchBusesAtSid)
    // 這是 Python 程式碼最後一段的邏輯
    const testSid = "11457";
    console.log(`\n🔍 額外測試: SID ${testSid} 即時資訊`);
    console.log("-".repeat(30));
    
    // 需要手動建立 Client session 嗎？不需要，TS 版本已經封裝 fetch
    const realtimeBuses = await service.fetchBusesAtSid(testSid);
    
    for (const bus of realtimeBuses) {
        // Python: print(f"{bus['route']} - {bus['time_text']}, RID: {bus['rid']}, SID: {bus['sid']}")
        console.log(`${bus.route} - ${bus.time_text}, RID: ${bus.rid}, SID: ${bus.sid}`);
    }
}

main();