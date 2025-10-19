// app/SearchScreen.tsx
import { useRouter } from 'expo-router';
import React, { useEffect, useRef, useState } from 'react';
import {
  FlatList,
  Keyboard,
  StyleSheet,
  Text,
  TextInput,
  TouchableOpacity,
  TouchableWithoutFeedback,
  View,
} from 'react-native';
import stopMapping from '../databases/stop_to_slid.json';

export default function SearchScreen() {
  const router = useRouter();
  const [query, setQuery] = useState('');
  const [suggestions, setSuggestions] = useState<string[]>([]);
  const debounceRef = useRef<NodeJS.Timeout | null>(null);

  const allStops = Object.keys(stopMapping as Record<string, string>);

  useEffect(() => {
    if (debounceRef.current) clearTimeout(debounceRef.current);
    debounceRef.current = setTimeout(() => {
      const q = query.trim().toLowerCase();
      if (!q) return setSuggestions([]);
      setSuggestions(allStops.filter(s => s.toLowerCase().includes(q)).slice(0, 15));
    }, 250);
  }, [query]);

  const onSelect = (stop: string) => {
    router.push(`/stop?name=${encodeURIComponent(stop)}`);
  };

  const onCancel = () => {
    Keyboard.dismiss(); // 收鍵盤
    router.back(); // 返回上一頁
  };

  return (
    <TouchableWithoutFeedback onPress={onCancel}>
      <View style={styles.container}>
        <View style={styles.inputRow}>
          <TextInput
            placeholder="搜尋站牌"
            placeholderTextColor="#bbb"
            style={styles.input}
            value={query}
            onChangeText={setQuery}
            autoFocus
          />
          <TouchableOpacity onPress={onCancel}>
            <Text style={styles.cancelText}>取消</Text>
          </TouchableOpacity>
        </View>

        <FlatList
          data={suggestions}
          keyExtractor={(item) => item}
          keyboardShouldPersistTaps="handled"
          renderItem={({ item }) => (
            <TouchableOpacity style={styles.item} onPress={() => onSelect(item)}>
              <Text style={styles.text}>{item}</Text>
            </TouchableOpacity>
          )}
        />
      </View>
    </TouchableWithoutFeedback>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#152021',
    paddingTop: 40,
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
  cancelText: {
    color: '#6F73F8',
    fontSize: 16,
    marginLeft: 12,
  },
  item: {
    paddingVertical: 12,
    borderBottomColor: '#2b3435',
    borderBottomWidth: 1,
  },
  text: { color: '#fff', fontSize: 16 },
});
