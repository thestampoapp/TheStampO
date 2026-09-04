import { View, Text, StyleSheet } from 'react-native';
import { Button } from '../components/Common';
import OnboardingStepLayout from '../components/OnboardingStepLayout';
import { COLORS, SPACING } from '../styles/theme';
import { weight } from '../styles/platform';

const PrivacyItem = ({ icon, title, description }) => (
  <View style={styles.privacyItem}>
    <View style={styles.iconContainer}>
      <Text style={styles.iconText}>{icon}</Text>
    </View>
    <View style={styles.textContainer}>
      <Text style={styles.itemTitle}>{title}</Text>
      <Text style={styles.description}>{description}</Text>
    </View>
  </View>
);

const PrivacyScreen = ({ navigation }) => {
  const promises = [
    {
      icon: '📱',
      title: 'Your photos stay on your device',
      description: 'Every stamp and scrapbook page lives only on your phone. Nothing is uploaded anywhere.',
    },
    {
      icon: '🔒',
      title: 'We never see your images',
      description: 'StampO works completely offline. Your memories are yours alone and we have zero access.',
    },
    {
      icon: '🚫',
      title: 'No hidden data collection',
      description: 'No tracking, no ads, no selling your information.',
    },
    {
      icon: '🗑️',
      title: 'Delete means delete',
      description: "When you remove a stamp or page, it's gone instantly. We don't keep copies",
    },
  ];

  return (
    <OnboardingStepLayout
      progressWidth="90%"
      footer={<Button title="Continue" onPress={() => navigation.navigate('CameraIntro')} />}
    >
      <View style={styles.header}>
        <View style={styles.iconCircle}>
          <Text style={styles.shieldIcon}>🛡️</Text>
        </View>
        <Text style={styles.title}>Your privacy comes first</Text>
        <Text style={styles.subtitle}>
          Everything you create in StampO stays 100% on your device. Here's our promise:
        </Text>
      </View>

      <View style={styles.list}>
        {promises.map((p, i) => (
          <PrivacyItem key={i} {...p} />
        ))}
      </View>
    </OnboardingStepLayout>
  );
};

const styles = StyleSheet.create({
  header: {
    alignItems: 'center',
    marginBottom: SPACING.xl * 2,
    marginTop: SPACING.xl,
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
  shieldIcon: {
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
  },
  subtitle: {
    fontSize: 16,
    includeFontPadding: false,
    textAlign: 'center',
    color: COLORS.textSecondary,
    lineHeight: 24,
  },
  list: {
    width: '100%',
  },
  privacyItem: {
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

export default PrivacyScreen;
