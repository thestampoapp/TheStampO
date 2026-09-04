import { useState } from 'react';
import { View, Text, StyleSheet, TouchableOpacity } from 'react-native';
import { Button } from '../components/Common';
import OnboardingStepLayout from '../components/OnboardingStepLayout';
import { COLORS, SPACING } from '../styles/theme';
import { weight } from '../styles/platform';

const InterestItem = ({ label, icon, selected, onPress }) => (
  <TouchableOpacity
    style={[styles.item, selected && styles.selectedItem]}
    onPress={onPress}
  >
    <Text style={styles.iconText}>{icon}</Text>
    <Text style={[styles.label, selected && styles.selectedLabel]}>{label}</Text>
  </TouchableOpacity>
);

const InterestsScreen = ({ navigation }) => {
  const [selected, setSelected] = useState([]);

  const interests = [
    { id: 'travel', label: 'Travel & adventures', icon: '✈️' },
    { id: 'food', label: 'Food & coffee', icon: '🍽️' },
    { id: 'pets', label: 'Pets & animals', icon: '🐾' },
    { id: 'nature', label: 'Nature & outdoors', icon: '🌿' },
    { id: 'family', label: 'Family & friends', icon: '👥' },
    { id: 'street', label: 'Street & architecture', icon: '🏙️' },
    { id: 'art', label: 'Art & crafts', icon: '🎨' },
    { id: 'everyday', label: 'Everyday moments', icon: '☀️' },
  ];

  const toggleInterest = (id) => {
    if (selected.includes(id)) {
      setSelected(selected.filter((i) => i !== id));
    } else {
      setSelected([...selected, id]);
    }
  };

  return (
    <OnboardingStepLayout
      progressWidth="80%"
      footer={
        <Button
          title="Continue"
          variant="secondary"
          style={selected.length > 0 ? styles.activeButton : styles.disabledButton}
          textStyle={selected.length > 0 ? styles.activeButtonText : null}
          onPress={() => selected.length > 0 && navigation.navigate('Privacy')}
        />
      }
    >
      <Text style={styles.title}>What moments do you love capturing?</Text>
      <Text style={styles.subtitle}>Pick as many as you like</Text>

      <View style={styles.grid}>
        {interests.map((int) => (
          <InterestItem
            key={int.id}
            label={int.label}
            icon={int.icon}
            selected={selected.includes(int.id)}
            onPress={() => toggleInterest(int.id)}
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
  grid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    justifyContent: 'space-between',
    width: '100%',
  },
  item: {
    width: '48%',
    backgroundColor: COLORS.white,
    borderWidth: 1,
    borderColor: COLORS.border,
    borderRadius: 15,
    padding: SPACING.m,
    marginBottom: SPACING.m,
    alignItems: 'center',
    justifyContent: 'center',
    minHeight: 100,
  },
  selectedItem: {
    borderColor: COLORS.primary,
    backgroundColor: COLORS.primary,
  },
  selectedLabel: {
    color: COLORS.white,
  },
  iconText: {
    fontSize: 30,
    includeFontPadding: false,
    marginBottom: SPACING.s,
  },
  label: {
    fontSize: 14,
    includeFontPadding: false,
    textAlign: 'center',
    color: COLORS.textPrimary,
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

export default InterestsScreen;
