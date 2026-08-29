import { useState } from 'react';
import {
  View,
  Text,
  StyleSheet,
  SafeAreaView,
  Animated,
  PanResponder,
  Dimensions,
  TouchableOpacity, StatusBar} from 'react-native';
import { COLORS } from '../styles/theme';
import { STATUS_BAR_HEIGHT, weight } from '../styles/platform';

const { width } = Dimensions.get('window');

const PersonaSwipeScreen = ({ navigation }) => {
  const [currentIndex, setCurrentIndex] = useState(0);

  const personas = [
    "My camera roll has thousands of photos I never look back at",
    "I take photos of everything, but none of them feel special anymore",
    "I want to feel more connected to my memories",
    "I want to actually do something with my photos, not just let them sit in my camera roll"
  ];

  const position = new Animated.ValueXY();

  const panResponder = PanResponder.create({
    onStartShouldSetPanResponder: () => true,
    onPanResponderMove: (_, gesture) => {
      position.setValue({ x: gesture.dx, y: gesture.dy });
    },
    onPanResponderRelease: (_, gesture) => {
      if (gesture.dx > 120) {
        handleSwipe(true);
      } else if (gesture.dx < -120) {
        handleSwipe(false);
      } else {
        Animated.spring(position, {
          toValue: { x: 0, y: 0 },
          useNativeDriver: true,
        }).start();
      }
    },
  });

  const handleSwipe = (liked) => {
    Animated.timing(position, {
      toValue: { x: liked ? width * 1.5 : -width * 1.5, y: 0 },
      duration: 200,
      useNativeDriver: true,
    }).start(() => {
      position.setValue({ x: 0, y: 0 });
      const nextIndex = currentIndex + 1;

      if (nextIndex < personas.length) {
        setCurrentIndex(nextIndex);
      } else {
        navigation.navigate('Confirmation');
      }
    });
  };

  const handleButtonPress = (liked) => {
    handleSwipe(liked);
  };

  return (
    <SafeAreaView style={styles.container}>
      <StatusBar barStyle="dark-content" backgroundColor="transparent" translucent />
      <View style={styles.androidStatusSpacer} />
      <View style={styles.progressBar}>
        <View style={[styles.progressFill, { width: '50%' }]} />
      </View>

      <View style={styles.header}>
        <Text style={styles.title}>Do any of these sound like you?</Text>
        <Text style={styles.subtitle}>Swipe right if yes, left if no</Text>
      </View>

      <View style={styles.cardContainer}>
        <Text style={styles.cardIndex}>{currentIndex + 1} of {personas.length}</Text>

        <Animated.View
          {...panResponder.panHandlers}
          style={[
            styles.card,
            {
              transform: [
                { translateX: position.x },
                { translateY: position.y }
              ]
            }
          ]}
        >
          <Text style={styles.thoughtIcon}>💭</Text>
          <Text style={styles.personaText}>"{personas[currentIndex]}"</Text>
        </Animated.View>

        <View style={styles.actions}>
          <TouchableOpacity
            style={styles.rejectButton}
            onPress={() => handleButtonPress(false)}
          >
            <Text style={styles.actionIcon}>✗</Text>
          </TouchableOpacity>

          {/* Explicit spacer: `gap` is unsupported on older RN and renders
              inconsistently on Android. */}
          <View style={styles.actionGap} />

          <TouchableOpacity
            style={styles.acceptButton}
            onPress={() => handleButtonPress(true)}
          >
            <Text style={styles.actionIcon}>✓</Text>
          </TouchableOpacity>
        </View>
      </View>
    </SafeAreaView>
  );
};

const styles = StyleSheet.create({
  androidStatusSpacer: { height: STATUS_BAR_HEIGHT },
  container: {
    flex: 1,
    backgroundColor: '#FBF9FD',
  },
  progressBar: {
    height: 4,
    backgroundColor: '#E4DDEA',
    width: '100%',
  },
  progressFill: {
    height: '100%',
    backgroundColor: COLORS.primary,
  },
  header: {
    paddingHorizontal: 24,
    paddingTop: 12,
    marginTop: 75,
    paddingBottom: 8,
  },
  title: {
    fontSize: 36,
    includeFontPadding: false,
    ...weight(600),
    color: '#2F233B',
    textAlign: 'left',
    marginBottom: 10,
  },
  subtitle: {
    fontSize: 16,
    includeFontPadding: false,
    color: '#786D82',
    textAlign: 'left',
  },
  cardContainer: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
  },
  cardIndex: {
    fontSize: 14,
    includeFontPadding: false,
    color: '#A69AAD',
    marginBottom: 14,
  },
  card: {
    width: width * 0.82,
    backgroundColor: '#FFFFFF',
    borderRadius: 20,
    padding: 26,
    minHeight: 210,
    justifyContent: 'center',
    alignItems: 'center',
    shadowColor: '#000',
    elevation: 4,
  },
  thoughtIcon: {
    fontSize: 30,
    includeFontPadding: false,
    marginBottom: 18,
  },
  personaText: {
    fontSize: 17,
    includeFontPadding: false,
    fontStyle: 'italic',
    textAlign: 'center',
    color: '#4A3E55',
    lineHeight: 24,
  },
  actions: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    marginTop: 36,
  },
  /** Space between reject and accept. */
  actionGap: { width: 32 },
  rejectButton: {
    width: 46,
    height: 46,
    borderRadius: 23,
    backgroundColor: '#FFF0F0',
    justifyContent: 'center',
    alignItems: 'center',
    borderWidth: 1,
    borderColor: '#FECACA',
  },
  acceptButton: {
    width: 46,
    height: 46,
    borderRadius: 23,
    backgroundColor: '#F0FDF4',
    justifyContent: 'center',
    alignItems: 'center',
    borderWidth: 1,
    borderColor: '#BBF7D0',
  },
  actionIcon: {
    fontSize: 20,
    includeFontPadding: false,
    color: '#4A3E55',
    includeFontPadding: false,
    textAlignVertical: 'center',
    lineHeight: 22,
  },
});

export default PersonaSwipeScreen;
