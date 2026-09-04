import { useState } from 'react';
import { View, Text, StyleSheet } from 'react-native';
import { Button, OptionItem } from '../components/Common';
import OnboardingStepLayout from '../components/OnboardingStepLayout';
import { COLORS, SPACING } from '../styles/theme';
import { weight } from '../styles/platform';

const ReferralScreen = ({ navigation }) => {
  const [selected, setSelected] = useState(null);

  const options = [
    { id: 'instagram', label: 'Instagram', icon: '📷' },
    { id: 'tiktok', label: 'TikTok', icon: '🎵' },
    { id: 'youtube', label: 'YouTube Shorts', icon: '▶️' },
    { id: 'x', label: 'X (Twitter)', icon: '𝕏' },
    { id: 'reddit', label: 'Reddit', icon: '🤖' },
    { id: 'friend', label: 'A friend', icon: '👫' },
    { id: 'appstore', label: 'App Store search', icon: '🔍' },
    { id: 'other', label: 'Other', icon: '🔘' },
  ];

  return (
    <OnboardingStepLayout
      progressWidth="20%"
      footer={
        <Button
          title="Continue"
          variant="secondary"
          style={selected ? styles.activeButton : styles.disabledButton}
          textStyle={selected ? styles.activeButtonText : null}
          onPress={() => selected && navigation.navigate('Excitement')}
        />
      }
    >
      <Text style={styles.title}>How did you hear about us?</Text>
      <Text style={styles.subtitle}>We'd love to know what brought you here</Text>

      <View style={styles.optionsContainer}>
        {options.map((opt) => (
          <OptionItem
            key={opt.id}
            label={opt.label}
            icon={<Text style={styles.iconText}>{opt.icon}</Text>}
            selected={selected === opt.id}
            onPress={() => setSelected(opt.id)}
          />
        ))}
      </View>
    </OnboardingStepLayout>
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
    marginBottom: SPACING.xl,
    width: '100%',
  },
  optionsContainer: {
    width: '100%',
  },
  iconText: {
    fontSize: 20,
    includeFontPadding: false,
  },
  activeButton: {
    backgroundColor: COLORS.primary,
  },
  activeButtonText: {
    color: COLORS.white,
  },
  disabledButton: {
    backgroundColor: COLORS.greyMedium,
  },
});

export default ReferralScreen;
