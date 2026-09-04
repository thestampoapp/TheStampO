import { useEffect, useRef } from 'react';
import { View, Text, StyleSheet, Animated } from 'react-native';
import { Button } from '../components/Common';
import OnboardingStepLayout from '../components/OnboardingStepLayout';
import { COLORS, SPACING } from '../styles/theme';
import { weight } from '../styles/platform';

const FeatureItem = ({ icon, label, description }) => (
  <View style={styles.featureItem}>
    <View style={styles.iconContainer}>
      <Text style={styles.iconText}>{icon}</Text>
    </View>
    <View style={styles.textContainer}>
      <Text style={styles.featureLabel}>{label}</Text>
      <Text style={styles.featureDescription}>{description}</Text>
    </View>
  </View>
);

const FeaturesScreen = ({ navigation }) => {
  const fadeAnim = useRef(new Animated.Value(0)).current;

  useEffect(() => {
    Animated.timing(fadeAnim, {
      toValue: 1,
      duration: 700,
      useNativeDriver: true,
    }).start();
  }, []);

  const features = [
    {
      icon: '📷',
      label: 'Photos feel disposable',
      description: 'Every capture becomes a collectible stamp, complete with serrated edges and a satisfying punch sound',
    },
    {
      icon: '✂️',
      label: 'No time for scrapbooking',
      description: 'Create a page in minutes. Drag stamps, tape, and stickers onto a canvas with your finger',
    },
    {
      icon: '📅',
      label: 'Memories fade too fast',
      description: 'Your calendar fills with stamps. A visual diary that builds itself, one day at a time',
    },
    {
      icon: '✉️',
      label: 'Nothing worth sharing',
      description: 'Share pages people actually care about. Handmade creations, not another filtered photo',
    },
  ];

  return (
    <Animated.View style={{ flex: 1, opacity: fadeAnim }}>
      <OnboardingStepLayout
        progressWidth="70%"
        footer={<Button title="Continue" onPress={() => navigation.navigate('Interests')} />}
      >
        <Text style={styles.title}>A better way to capture memories</Text>
        <Text style={styles.subtitle}>Here's how StampO helps</Text>

        <View style={styles.featuresList}>
          {features.map((f, i) => (
            <FeatureItem key={i} {...f} />
          ))}
        </View>
      </OnboardingStepLayout>
    </Animated.View>
  );
};

const styles = StyleSheet.create({
  title: {
    fontSize: 32,
    includeFontPadding: false,
    ...weight(500),
    textAlign: 'left',
    color: COLORS.textPrimary,
    marginTop: SPACING.xl,
    width: '100%',
    lineHeight: 40,
  },
  subtitle: {
    fontSize: 16,
    includeFontPadding: false,
    textAlign: 'left',
    color: COLORS.textSecondary,
    marginTop: SPACING.m,
    marginBottom: SPACING.xl * 2,
    width: '100%',
  },
  featuresList: {
    width: '100%',
  },
  featureItem: {
    flexDirection: 'row',
    marginBottom: SPACING.xl * 2,
  },
  iconContainer: {
    width: 50,
    height: 50,
    borderRadius: 12,
    backgroundColor: '#F3F0F6',
    justifyContent: 'center',
    alignItems: 'center',
    marginRight: SPACING.m,
  },
  iconText: {
    fontSize: 24,
    includeFontPadding: false,
  },
  textContainer: {
    flex: 1,
  },
  featureLabel: {
    fontSize: 14,
    includeFontPadding: false,
    color: COLORS.textSecondary,
    textDecorationLine: 'line-through',
    marginBottom: 4,
  },
  featureDescription: {
    fontSize: 16,
    includeFontPadding: false,
    color: COLORS.textPrimary,
    lineHeight: 24,
  },
});

export default FeaturesScreen;
