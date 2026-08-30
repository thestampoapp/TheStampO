import { useEffect, useRef } from 'react';
import { View, Text, StyleSheet, SafeAreaView, Animated, TouchableOpacity, StatusBar} from 'react-native';
import { COLORS, SPACING } from '../styles/theme';
import { STATUS_BAR_HEIGHT, weight } from '../styles/platform';

const ConfirmationScreen = ({ navigation }) => {
  const scaleAnim = useRef(new Animated.Value(0.3)).current;
  const opacityAnim = useRef(new Animated.Value(0)).current;
  const textOpacity = useRef(new Animated.Value(0)).current;
  const buttonOpacity = useRef(new Animated.Value(0)).current;

  useEffect(() => {
    // Boom the circle
    Animated.spring(scaleAnim, {
      toValue: 1,
      friction: 4,
      tension: 40,
      useNativeDriver: true,
    }).start(() => {
      // Fade in title
      Animated.timing(opacityAnim, {
        toValue: 1,
        duration: 600,
        useNativeDriver: true,
      }).start(() => {
        // Fade in subtitle
        Animated.timing(textOpacity, {
          toValue: 1,
          duration: 500,
          useNativeDriver: true,
        }).start(() => {
          // Fade in button
          Animated.timing(buttonOpacity, {
            toValue: 1,
            duration: 400,
            useNativeDriver: true,
          }).start();
        });
      });
    });
  }, []);

  const handleContinue = () => {
    // Slow fade out
    Animated.timing(opacityAnim, {
      toValue: 0,
      duration: 500,
      useNativeDriver: true,
    }).start(() => {
      navigation.navigate('Features');
    });
  };

  return (
    <SafeAreaView style={styles.container}>
      <StatusBar barStyle="dark-content" backgroundColor="transparent" translucent />
      <View style={styles.androidStatusSpacer} />
      <View style={styles.progressBar}>
        <View style={[styles.progressFill, { width: '60%' }]} />
      </View>

      <View style={styles.content}>
        {/* Animated Circle with Star */}
        <Animated.View 
          style={[
            styles.iconCircle, 
            { 
              transform: [{ scale: scaleAnim }],
              opacity: opacityAnim 
            }
          ]}
        >
          <Text style={styles.sparkleIcon}>✨</Text>
        </Animated.View>

        {/* Title */}
        <Animated.Text style={[styles.title, { opacity: opacityAnim }]}>
          We hear you.
        </Animated.Text>

        {/* Subtitle */}
        <Animated.Text style={[styles.subtitle, { opacity: textOpacity }]}>
          Let's show you how StampO helps.
        </Animated.Text>

        {/* Continue Button */}
        <Animated.View style={{ opacity: buttonOpacity, marginTop: 40 }}>
          <TouchableOpacity 
            style={styles.continueButton} 
            onPress={handleContinue}
          >
            <Text style={styles.continueText}>Continue</Text>
          </TouchableOpacity>
        </Animated.View>
      </View>
    </SafeAreaView>
  );
};

const styles = StyleSheet.create({
  androidStatusSpacer: { height: STATUS_BAR_HEIGHT },
  container: {
    flex: 1,
    backgroundColor: COLORS.background,
  },
  progressBar: {
    height: 4,
    backgroundColor: COLORS.greyLight,
    width: '100%',
  },
  progressFill: {
    height: '100%',
    backgroundColor: COLORS.primary,
  },
  content: {
    flex: 1,
    padding: SPACING.xl,
    alignItems: 'center',
    justifyContent: 'center',
  },
  iconCircle: {
    width: 110,
    height: 110,
    borderRadius: 55,
    backgroundColor: '#F1E9F8',
    justifyContent: 'center',
    alignItems: 'center',
    marginBottom: 40,
  },
  sparkleIcon: {
    fontSize: 44,
    includeFontPadding: false,
  },
  title: {
    fontSize: 32,
    includeFontPadding: false,
    ...weight(600),
    color: COLORS.textPrimary,
    marginBottom: 12,
    textAlign: 'center',
  },
  subtitle: {
    fontSize: 18,
    includeFontPadding: false,
    color: COLORS.textSecondary,
    textAlign: 'center',
    lineHeight: 26,
  },
  continueButton: {
    backgroundColor: COLORS.primary,
    paddingVertical: 16,
    paddingHorizontal: 60,
    borderRadius: 30,
  },
  continueText: {
    color: '#fff',
    fontSize: 17,
    includeFontPadding: false,
    ...weight(600),
  },
});

export default ConfirmationScreen;
