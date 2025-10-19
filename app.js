import { NavigationContainer } from '@react-navigation/native';
import { createNativeStackNavigator } from '@react-navigation/native-stack';
import { Button, StyleSheet, Text, View } from 'react-native';

const Stack = createNativeStackNavigator();

// 首頁
function HomeScreen({ navigation }) {
  return (
    <View style={styles.container}>
      <Text style={styles.title}>歡迎來到有用畫面App</Text>
      <Button
        title="前往功能頁面"
        onPress={() => navigation.navigate('Feature')}
      />
    </View>
  );
}

// 功能頁面
function FeatureScreen() {
  return (
    <View style={styles.container}>
      <Text style={styles.title}>這是有用的功能頁面</Text>
      <Text>你可以在這裡放置按鈕、表單、列表等功能</Text>
    </View>
  );
}

export default function App() {
  return (
    <NavigationContainer>
      <Stack.Navigator initialRouteName="Home">
        <Stack.Screen name="Home" component={HomeScreen} />
        <Stack.Screen name="Feature" component={FeatureScreen} />
      </Stack.Navigator>
    </NavigationContainer>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    padding: 20,
  },
  title: {
    fontSize: 24,
    marginBottom: 20,
  },
});
