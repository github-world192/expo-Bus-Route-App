import React from 'react';
import { SafeAreaView, View, Text, StyleSheet, FlatList } from 'react-native';
import SearchBar from './components/SearchBar';
import { colors } from '../theme';
import { useNavigation } from '@react-navigation/native';

const routes = [
  { name: '復興幹線', status: 'arriving', time: '將到站' },
  { name: '278', status: 'minutes', time: '3 分' },
  { name: '復興幹線', status: 'not-started', time: '未發車' },
];

const Badge = ({ route }) => {
  const bg = route.status === 'arriving' ? colors.arriving : route.status === 'minutes' ? colors.minutes : colors.notStarted;
  const text = route.status === 'not-started' ? '#534D4D' : '#FFF';
  return (
    <View style={[styles.badge, { backgroundColor: bg }]}> 
      <Text style={[styles.badgeText, { color: text }]}>{route.time}</Text>
    </View>
  );
};

export default function Home() {
  const nav = useNavigation();
  return (
    <SafeAreaView style={styles.root}>
      <View style={styles.header}>
        <View style={styles.searchWrap}>
          <SearchBar animateShrink onPress={() => nav.navigate('Search')} />
        </View>
        <View style={styles.tabsRow}>
          <Text style={styles.tabsText}>師大分部 → 師大</Text>
        </View>
        <View style={styles.indicator} />
      </View>

      <View style={{ paddingHorizontal: 24, paddingTop: 15 }}>
        {routes.map((item, idx) => (
          <View key={item.name + idx} style={[styles.itemRow, idx < routes.length - 1 && styles.separatorWrap]}>
            <Text style={styles.itemName}>{item.name}</Text>
            <Badge route={item} />
          </View>
        ))}
      </View>

      <View style={{ alignItems: 'center', paddingVertical: 9 }}>
        <Text style={styles.muted}>顯示出發站的完整動態</Text>
      </View>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: colors.busDark },
  header: { backgroundColor: colors.busHeader, shadowColor: '#000', shadowOpacity: 0.25, shadowRadius: 6 },
  searchWrap: { paddingHorizontal: 28, paddingTop: 24, paddingBottom: 16 },
  tabsRow: { height: 32, alignItems: 'center', justifyContent: 'center' },
  tabsText: { color: '#fff', fontSize: 16, fontWeight: '600' },
  indicator: { height: 2, width: '50%', backgroundColor: '#fff' },
  itemRow: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', height: 50 },
  itemName: { color: '#fff', fontSize: 20, fontWeight: '600' },
  badge: { height: 37, width: 71, borderRadius: 999, alignItems: 'center', justifyContent: 'center' },
  badgeText: { fontSize: 17, fontWeight: '600' },
  separator: { height: 1, backgroundColor: colors.divider, marginVertical: 7 },
  separatorWrap: { borderBottomWidth: 1, borderBottomColor: colors.divider, paddingBottom: 7, marginBottom: 7 },
  muted: { color: colors.textMuted, fontSize: 16, fontWeight: '500' },
});
