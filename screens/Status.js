import React, { useRef, useState } from 'react';
import { SafeAreaView, View, Text, StyleSheet, FlatList, TouchableOpacity } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { colors } from '../theme';
import { useNavigation } from '@react-navigation/native';

const outbound = [
  { name: '644', status: 'arriving', time: '將到站' },
  { name: '278', status: 'minutes', time: '3 分' },
  { name: '復興幹線', status: 'minutes', time: '17 分' },
  { name: '0 南', status: 'not-started', time: '未發車' },
];

const inbound = [
  { name: '羅斯福路幹線', status: 'arriving', time: '將到站' },
  { name: '643', status: 'minutes', time: '5 分' },
  { name: '松江新生幹線', status: 'minutes', time: '14 分' },
  { name: '藍 5', status: 'not-started', time: '未發車' },
];

const Badge = ({ status, time }) => {
  const bg = status === 'arriving' ? colors.arriving : status === 'minutes' ? colors.minutes : colors.notStarted;
  const text = status === 'not-started' ? '#534D4D' : '#FFF';
  return (
    <View style={[styles.badge, { backgroundColor: bg }]}> 
      <Text style={[styles.badgeText, { color: text }]}>{time}</Text>
    </View>
  );
};

export default function Status() {
  const nav = useNavigation();
  const [dir, setDir] = useState('outbound');
  const data = dir === 'outbound' ? outbound : inbound;

  const start = useRef(null);
  const onStart = (e) => {
    start.current = { x: e.nativeEvent.pageX, y: e.nativeEvent.pageY };
  };
  const onEnd = (e) => {
    if (!start.current) return;
    const dx = e.nativeEvent.pageX - start.current.x;
    const dy = e.nativeEvent.pageY - start.current.y;
    start.current = null;
    if (Math.abs(dx) > 50 && Math.abs(dx) > Math.abs(dy)) {
      if (dx < 0) setDir('inbound');
      else setDir('outbound');
    }
  };

  return (
    <SafeAreaView style={styles.root}
      onStartShouldSetResponder={() => true}
      onResponderGrant={onStart}
      onResponderRelease={onEnd}
    >
      <View style={styles.header}>
        <View style={styles.titleWrap}>
          <TouchableOpacity onPress={() => nav.goBack()} style={styles.backBtn}>
            <Ionicons name="chevron-back" size={30} color="#fff" />
          </TouchableOpacity>
          <Text style={styles.title}>師大分部</Text>
        </View>
        <View style={styles.tabs}>
          <TouchableOpacity style={styles.tab} onPress={() => setDir('outbound')}>
            <Text style={styles.tabText}>去</Text>
          </TouchableOpacity>
          <View style={styles.tabDivider} />
          <TouchableOpacity style={styles.tab} onPress={() => setDir('inbound')}>
            <Text style={styles.tabText}>回</Text>
          </TouchableOpacity>
        </View>
        <View style={[styles.underline, dir === 'outbound' ? styles.underLeft : styles.underRight]} />
      </View>

      <FlatList
        contentContainerStyle={{ paddingHorizontal: 24, paddingTop: 22 }}
        data={data}
        keyExtractor={(item, i) => item.name + i}
        ItemSeparatorComponent={() => <View style={styles.listDivider} />}
        renderItem={({ item }) => (
          <View style={styles.itemRow}>
            <Text style={styles.itemName}>{item.name}</Text>
            <Badge status={item.status} time={item.time} />
          </View>
        )}
      />
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: colors.busDark },
  header: { backgroundColor: colors.busHeader, shadowColor: '#000', shadowOpacity: 0.25, shadowRadius: 6 },
  titleWrap: { height: 133, justifyContent: 'center', alignItems: 'center' },
  backBtn: { position: 'absolute', left: 16, top: '50%', marginTop: -15, width: 30, height: 30, alignItems: 'center', justifyContent: 'center' },
  title: { color: '#fff', fontSize: 40, fontWeight: '500', lineHeight: 18 },
  tabs: { height: 32, flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' },
  tab: { flex: 1, alignItems: 'center', justifyContent: 'center' },
  tabText: { color: '#fff', fontSize: 17, fontWeight: '600' },
  tabDivider: { width: 1, height: '100%', backgroundColor: 'rgba(255,255,255,0.25)' },
  underline: { height: 2, backgroundColor: colors.dividerLight },
  underLeft: { width: 197 },
  underRight: { width: 194, marginLeft: 199 },
  itemRow: { height: 50, flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' },
  itemName: { color: '#fff', fontSize: 20, fontWeight: '600' },
  badge: { height: 37, width: 71, borderRadius: 999, alignItems: 'center', justifyContent: 'center' },
  badgeText: { fontSize: 17, fontWeight: '600' },
  listDivider: { height: 1, backgroundColor: colors.divider },
});
