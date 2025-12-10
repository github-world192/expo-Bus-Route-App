// 路線排序函數：用於統一排序公車路線
// 排序規則：
// 1. 有到站時間的公車優先，按時間從近到遠
// 2. 無時間資料時：純數字 > 數字+文字 > 幹線 > 長途/國道

interface SortableRoute {
  route: string;
  rawTime?: number;
}

export function sortRoutes<T extends SortableRoute>(a: T, b: T): number {
  // 先按到站時間排序（有時間的優先）
  const aHasTime = a.rawTime !== undefined && a.rawTime < 999999;
  const bHasTime = b.rawTime !== undefined && b.rawTime < 999999;
  
  if (aHasTime && bHasTime) {
    // 都有時間，按時間排序
    return (a.rawTime || 999999) - (b.rawTime || 999999);
  } else if (aHasTime) {
    // 只有 a 有時間，a 排前面
    return -1;
  } else if (bHasTime) {
    // 只有 b 有時間，b 排前面
    return 1;
  }
  
  // 都沒有時間，按路線名稱排序
  const aRoute = a.route;
  const bRoute = b.route;
  
  // 判斷是否為幹線（包含"幹線"關鍵字）
  const aIsMainLine = aRoute.includes('幹線');
  const bIsMainLine = bRoute.includes('幹線');
  
  // 判斷是否為長途路線（包含"→"或"國道"）
  const aIsLongDistance = aRoute.includes('→') || aRoute.includes('國道');
  const bIsLongDistance = bRoute.includes('→') || bRoute.includes('國道');
  
  // 提取數字部分（例如 "236區" -> 236, "小12" -> 12）
  const aNumMatch = aRoute.match(/\d+/);
  const bNumMatch = bRoute.match(/\d+/);
  
  const aNum = aNumMatch ? parseInt(aNumMatch[0], 10) : null;
  const bNum = bNumMatch ? parseInt(bNumMatch[0], 10) : null;
  
  // 判斷是否為純數字路線（例如 "236", "505"）
  const aIsPureNum = /^\d+$/.test(aRoute);
  const bIsPureNum = /^\d+$/.test(bRoute);
  
  // 優先級排序邏輯
  if (aIsPureNum && bIsPureNum) {
    // 都是純數字，按數字大小排序
    return aNum! - bNum!;
  } else if (aIsPureNum) {
    // a 是純數字，b 不是
    if (bIsMainLine || bIsLongDistance) {
      // b 是幹線或長途，b 排後面
      return -1;
    }
    return -1; // a 排前面
  } else if (bIsPureNum) {
    // b 是純數字，a 不是
    if (aIsMainLine || aIsLongDistance) {
      // a 是幹線或長途，a 排後面
      return 1;
    }
    return 1; // b 排前面
  } else if (aNum !== null && bNum !== null) {
    // 都有數字但不是純數字
    // 檢查是否有幹線或長途
    if (aIsMainLine && !bIsMainLine && !bIsLongDistance) {
      return -1; // 幹線優先於一般路線
    } else if (bIsMainLine && !aIsMainLine && !aIsLongDistance) {
      return 1;
    } else if (aIsLongDistance && !bIsLongDistance && !bIsMainLine) {
      return 1; // 長途路線排後面
    } else if (bIsLongDistance && !aIsLongDistance && !aIsMainLine) {
      return -1;
    }
    
    // 都是同類型，先按數字排序
    if (aNum !== bNum) {
      return aNum - bNum;
    }
    // 數字相同，按完整名稱字母排序
    return aRoute.localeCompare(bRoute, 'zh-TW');
  } else if (aNum !== null) {
    // 只有 a 有數字
    if (bIsMainLine) {
      return 1; // 幹線優先
    } else if (bIsLongDistance) {
      return -1; // a 排前面
    }
    return -1;
  } else if (bNum !== null) {
    // 只有 b 有數字
    if (aIsMainLine) {
      return -1; // 幹線優先
    } else if (aIsLongDistance) {
      return 1; // b 排前面
    }
    return 1;
  } else {
    // 都是純中文
    if (aIsMainLine && !bIsMainLine) {
      return -1; // 幹線優先
    } else if (bIsMainLine && !aIsMainLine) {
      return 1;
    } else if (aIsLongDistance && !bIsLongDistance) {
      return 1; // 長途路線排後面
    } else if (bIsLongDistance && !aIsLongDistance) {
      return -1;
    }
    // 都是同類型，按字母排序
    return aRoute.localeCompare(bRoute, 'zh-TW');
  }
}
