// Mock for react-native-pager-view on web platform
import React from 'react';
import { Dimensions, ScrollView, View } from 'react-native';

// Mock PagerView component for web
const PagerView = React.forwardRef(({ 
  children, 
  style, 
  initialPage = 0, 
  onPageSelected,
  ...props 
}, ref) => {
  const scrollViewRef = React.useRef(null);
  const [currentPage, setCurrentPage] = React.useState(initialPage);

  // Expose setPage method like native PagerView
  React.useImperativeHandle(ref, () => ({
    setPage: (page) => {
      const screenWidth = Dimensions.get('window').width;
      scrollViewRef.current?.scrollTo({ x: page * screenWidth, animated: true });
    },
  }));

  const handleScroll = (event) => {
    const screenWidth = Dimensions.get('window').width;
    const contentOffsetX = event.nativeEvent.contentOffset.x;
    const newPage = Math.round(contentOffsetX / screenWidth);
    
    if (newPage !== currentPage && newPage >= 0) {
      setCurrentPage(newPage);
      if (onPageSelected) {
        onPageSelected({ nativeEvent: { position: newPage } });
      }
    }
  };

  return (
    <ScrollView
      ref={scrollViewRef}
      horizontal
      pagingEnabled
      showsHorizontalScrollIndicator={false}
      onScroll={handleScroll}
      onMomentumScrollEnd={handleScroll}
      scrollEventThrottle={16}
      decelerationRate="fast"
      snapToInterval={Dimensions.get('window').width}
      snapToAlignment="center"
      style={[style, { cursor: 'grab', userSelect: 'none' }]}
      contentContainerStyle={{ userSelect: 'none' }}
      {...props}
    >
      {React.Children.map(children, (child, index) => (
        <View 
          key={index} 
          style={{ width: Dimensions.get('window').width }}
        >
          {child}
        </View>
      ))}
    </ScrollView>
  );
});

PagerView.displayName = 'PagerView';

export default PagerView;
