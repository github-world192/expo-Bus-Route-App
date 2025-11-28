import React from 'react';
import { SafeAreaView, View, StyleSheet, Text, TouchableOpacity } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import SearchBar from './components/SearchBar';
import { colors } from '../theme';
import { useNavigation } from '@react-navigation/native';

export default function Search() {
  const nav = useNavigation();
  return (
    <SafeAreaView style={styles.root}>
      <View style={styles.header}>
        <View style={styles.headerRow}>
          <TouchableOpacity onPress={() => nav.goBack()} style={styles.backBtn}>
            <Ionicons name="chevron-back" size={30} color="#fff" />
          </TouchableOpacity>
          <View style={{ flex: 1 }}>
            <SearchBar containerStyle={{}} />
          </View>
        </View>
      </View>

      <View style={styles.content}>
        <Text style={styles.gray}>最近搜尋</Text>
        <View style={styles.hr} />
        <TouchableOpacity onPress={() => nav.navigate('Status')} style={styles.listRow}>
          <Text style={styles.item}>師大分部</Text>
          <Ionicons name="arrow-up-right" size={24} color="#fff" />
        </TouchableOpacity>
        <View style={styles.hrDark} />
      </View>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: colors.busHeader },
  header: { backgroundColor: colors.busHeader, paddingHorizontal: 28, paddingTop: 24, paddingBottom: 16 },
  headerRow: { flexDirection: 'row', alignItems: 'center' },
  backBtn: { width: 50, height: 50, alignItems: 'center', justifyContent: 'center', marginLeft: -9 },
  content: { flex: 1, paddingHorizontal: 26, paddingTop: 30 },
  gray: { color: colors.gray, fontSize: 16, fontWeight: '600', marginBottom: 7 },
  hr: { height: 1, backgroundColor: colors.gray },
  hrDark: { height: 1, backgroundColor: '#555' },
  listRow: { height: 74, flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' },
  item: { color: '#fff', fontSize: 20, fontWeight: '600' },
});
