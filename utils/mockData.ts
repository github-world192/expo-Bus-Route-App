// utils/mockData.ts (或 app/ride.tsx 上方)

import { PulseDataPoint } from '../hooks/useTripStats';

// 新增 mode 參數
export const generateMockData = (mode: 'weekday' | 'weekend'): PulseDataPoint[] => {
  const data: PulseDataPoint[] = [];
  
  for (let minute = 0; minute < 1440; minute += 5) {
    let score = 0;
    let isLowConfidence = false;
    const hour = minute / 60;

    if (mode === 'weekday') {
      // --- 平日模式 (Commuter Pattern) ---
      // 早尖峰 07:00 - 09:00
      if (hour >= 7 && hour < 9) score = 4.0 + Math.random();
      // 晚尖峰 17:00 - 19:30
      else if (hour >= 17 && hour < 19.5) score = 3.5 + Math.random();
      // 中午吃飯 12:00 - 13:00 (稍低)
      else if (hour >= 12 && hour < 13) score = 2.0;
      // 其他離峰
      else if (hour > 6 && hour < 23) score = 1.0 + Math.random() * 0.5;
      // 深夜
      else { score = 0; isLowConfidence = true; }
    } else {
      // --- 週末模式 (Leisure Pattern) ---
      // 睡比較晚，早上沒什麼車
      if (hour < 9) { score = 0.5; isLowConfidence = true; }
      // 中午過後到晚上持續熱鬧 (11:00 - 21:00)
      else if (hour >= 11 && hour < 21) score = 2.5 + Math.random() * 1.5;
      // 緩慢下降
      else if (hour >= 9) score = 1.5;
      else score = 0;
    }

    // 隨機波動
    score += (Math.random() - 0.5) * 0.2;

    data.push({
      minute,
      score: Math.max(0, score),
      isLowConfidence
    });
  }
  return data;
};