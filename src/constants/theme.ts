export const theme = {
  colors: {
    primary: '#007BFF', // 品牌主色
    background: '#F8F9FA', // 頁面/App 背景色
    card: '#FFFFFF', // 卡片/元件背景色
    text: '#FFFFFF', // 主要文字顏色 (Note: This seems to be white, might need a dark text color for contrast on light background)
    textPrimary: '#000000', // Adding a default dark text color as mainTextColor is white which might be for buttons or dark mode
    textSecondary: '#666666',
    searchBackground: '#EFEFF4', // iOS search bar style
    tabIndicator: '#007BFF',
  },
  spacing: {
    unit: 8,
    s: 8,
    m: 16,
    l: 24,
    xl: 32,
  },
  button: {
    borderRadius: 6,
    paddingVertical: 12,
    paddingHorizontal: 20,
  },
  card: {
    borderRadius: 12,
    padding: 20,
    shadow: {
      shadowColor: '#000',
      shadowOffset: {
        width: 0,
        height: 4,
      },
      shadowOpacity: 0.1,
      shadowRadius: 10,
      elevation: 4, // Android shadow approximation
    },
  },
};
