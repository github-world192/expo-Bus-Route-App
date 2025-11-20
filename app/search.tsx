import { useRouter } from 'expo-router';
import React, { useEffect, useMemo, useRef, useState } from 'react';
import {
  FlatList,
  Keyboard,
  StyleSheet,
  Text,
  TextInput,
  TouchableOpacity,
  View,
} from 'react-native';

// 1. 改為引入包含完整資訊的 stop_id_map.json
// 請確認檔案名稱與路徑是否正確
import stopMapRaw from '../databases/stop_id_map.json';

// 2. 定義我們需要的資料結構
// 雖然檔案裡有 by_sid，但搜尋頁面暫時只需要 by_name 的 key (站名)
interface StopMap {
  by_name: Record<string, string[]>;
}

// 強制轉型
const stopData = stopMapRaw as StopMap;

export default function SearchScreen() {
  const router = useRouter();
  const [query, setQuery] = useState('');
  const [suggestions, setSuggestions] = useState<string[]>([]);
  const debounceRef = useRef<NodeJS.Timeout | null>(null);

  // 3. 取得所有站名
  // 使用 useMemo 優化：只在組件首次載入時執行一次，避免每次打字 render 都重新提取 keys
  const allStops = useMemo(() => Object.keys(stopData.by_name), []);

  useEffect(() => {
    if (debounceRef.current) clearTimeout(debounceRef.current);
    debounceRef.current = setTimeout(() => {
      const q = query.trim().toLowerCase();
      if (!q) {
        setSuggestions([]);
        return;
      }
      // 簡單篩選前 20 筆，這裡邏輯不變
      setSuggestions(allStops.filter(s => s.toLowerCase().includes(q)).slice(0, 20));
    }, 250);
  }, [query, allStops]);

  const onSelect = (stop: string) => {
    // 維持原本邏輯：跳轉至 stop 頁面，並傳遞站名參數
    // 下一頁 (/stop) 需負責利用這個 name 去 stop_id_map.json 查出對應的 sid 列表
    router.push(`/stop?name=${encodeURIComponent(stop)}`);
  };

  const onCancel = () => {
    Keyboard.dismiss();
    if (router.canGoBack()) {
      router.back();
    } else {
      // 如果沒有上一頁（例如直接開啟），則回到首頁
      router.replace('/');
    }
  };

  return (
    <View style={styles.container}>
      <View style={styles.inputRow}>
        <TextInput
          placeholder="搜尋站牌"
          placeholderTextColor="#bbb"
          style={styles.input}
          value={query}
          onChangeText={setQuery}
          autoFocus={true} // 進入頁面自動跳出鍵盤
          clearButtonMode="while-editing" // iOS 專用：顯示清除按鈕
        />
        <TouchableOpacity onPress={onCancel} style={styles.cancelBtn} activeOpacity={0.7}>
          <Text style={styles.cancelText}>取消</Text>
        </TouchableOpacity>
      </View>

      <FlatList
        data={suggestions}
        keyExtractor={(item) => item}
        // 關鍵：允許在鍵盤開啟時點擊列表項目
        keyboardShouldPersistTaps="handled"
        // 關鍵：滑動列表時自動收起鍵盤，體驗更順暢
        keyboardDismissMode="on-drag"
        renderItem={({ item }) => (
          <TouchableOpacity style={styles.item} onPress={() => onSelect(item)}>
            <Text style={styles.text}>{item}</Text>
          </TouchableOpacity>
        )}
      />
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#152021',
    paddingTop: 50, 
    paddingHorizontal: 16,
  },
  inputRow: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 16,
  },
  input: {
    flex: 1,
    backgroundColor: '#3a4243',
    color: '#fff',
    borderRadius: 20,
    paddingHorizontal: 16,
    height: 44,
    fontSize: 16,
  },
  cancelBtn: {
    paddingLeft: 12,
    paddingVertical: 8, 
  },
  cancelText: {
    color: '#6F73F8',
    fontSize: 16,
  },
  item: {
    paddingVertical: 14,
    borderBottomColor: '#2b3435',
    borderBottomWidth: 1,
  },
  text: { color: '#fff', fontSize: 18 },
});