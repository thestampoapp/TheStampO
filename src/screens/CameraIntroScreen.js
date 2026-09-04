import { View, Text, StyleSheet } from 'react-native';
import { Button } from '../components/Common';
import OnboardingStepLayout from '../components/OnboardingStepLayout';
import { COLORS, SPACING } from '../styles/theme';
import { weight } from '../styles/platform';

const IntroItem = ({ icon, title, description }) => (
  <View style={styles.item}>
    <View style={styles.iconContainer}>
      <Text style={styles.iconText}>{icon}</Text>
    </View>
    <View style={styles.textContainer}>
      <Text style={styles.itemTitle}>{title}</Text>
      <Text style={styles.description}>{description}</Text>
    </View>
  </View>
);

const CameraIntroScreen = ({ navigation }) => {
  const items = [
    {
      icon: '🎯',
      title: 'Frame your shot as a stamp',
      description: 'See your world through the stamp-shaped viewfinder before you capture',
    },
    {
      icon: '🔘',
      title: 'One-tap stamp punch',
      description: 'Instantly turn any photo into a collectible stamp with serrated edges',
    },
  ];

  return (
    <OnboardingStepLayout
      progressWidth="95%"
      contentContainerStyle={styles.scrollContent}
      footer={<Button title="Continue" onPress={() => navigation.navigate('Camera')} />}
    >
      <View style={styles.iconCircle}>
        <Text style={styles.cameraIcon}>📷</Text>
      </View>

      <Text style={styles.title}>Ready to capture your first stamp?</Text>
      <Text style={styles.subtitle}>
        StampO uses your camera to frame the world through a stamp-shaped viewfinder
      </Text>

      <View style={styles.list}>
        {items.map((item, i) => (
          <IntroItem key={i} {...item} />
        ))}
      </View>
    </OnboardingStepLayout>
  );
};

const styles = StyleSheet.create({
  scrollContent: {
    flexGrow: 1,
    justifyContent: 'center',
  },
  iconCircle: {
    width: 80,
    height: 80,
    borderRadius: 40,
    backgroundColor: '#F1E9F8',
    justifyContent: 'center',
    alignItems: 'center',
    marginBottom: SPACING.l,
  },
  cameraIcon: {
    fontSize: 30,
    includeFontPadding: false,
  },
  title: {
    fontSize: 32,
    includeFontPadding: false,
    ...weight(500),
    textAlign: 'center',
    color: COLORS.textPrimary,
    marginBottom: SPACING.m,
    lineHeight: 40,
  },
  subtitle: {
    fontSize: 16,
    includeFontPadding: false,
    textAlign: 'center',
    color: COLORS.textSecondary,
    marginBottom: SPACING.xl * 2,
    lineHeight: 24,
  },
  list: {
    width: '100%',
  },
  item: {
    flexDirection: 'row',
    marginBottom: SPACING.xl,
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
  itemTitle: {
    fontSize: 16,
    includeFontPadding: false,
    ...weight(600),
    color: COLORS.textPrimary,
    marginBottom: 4,
  },
  description: {
    fontSize: 14,
    includeFontPadding: false,
    color: COLORS.textSecondary,
    lineHeight: 20,
  },
});

export default CameraIntroScreen;
