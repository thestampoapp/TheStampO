import {
  View,
  Text,
  StyleSheet,
  Image,
  StatusBar,
  Platform,
  useWindowDimensions,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { Button } from '../components/Common';
import { SPACING } from '../styles/theme';
import { STATUS_BAR_HEIGHT } from '../styles/platform';
import { getWelcomeHero } from '../utils/assets';

const WelcomeScreen = ({ navigation }) => {
  const hero = getWelcomeHero();
  const insets = useSafeAreaInsets();
  const { width, height } = useWindowDimensions();

  // Keep the hero proportional but never tall enough to push the CTA off-screen.
  const heroWidth = Math.min(width * 0.88, 380);
  const heroHeight = Math.min(heroWidth * 1.12, height * 0.42, 340);

  const topInset =
    Platform.OS === 'android' ? insets.top + STATUS_BAR_HEIGHT : insets.top;

  return (
    <View
      style={[
        styles.container,
        { paddingTop: topInset, paddingBottom: Math.max(insets.bottom, 12) },
      ]}
    >
      <StatusBar barStyle="dark-content" backgroundColor="transparent" translucent />

      <View style={styles.textContainer}>
        <Text style={styles.title}>Your photos, turned into tiny treasures</Text>
        <Text style={styles.subtitle}>Collect moments. Make them beautiful.</Text>
      </View>

      <View style={styles.imageContainer}>
        {hero ? (
          <Image
            source={hero}
            style={[styles.heroImage, { width: heroWidth, height: heroHeight }]}
            resizeMode="contain"
          />
        ) : (
          <View
            style={[
              styles.heroImage,
              styles.heroPlaceholder,
              { width: heroWidth, height: heroHeight },
            ]}
          >
            <Text style={styles.heroPlaceholderText}>TheStampO</Text>
          </View>
        )}
      </View>

      <View style={styles.buttonContainer}>
        <Button title="Get Started" onPress={() => navigation.navigate('Referral')} />
      </View>
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#FFFFFF',
    paddingHorizontal: SPACING.xl,
  },
  textContainer: {
    alignItems: 'center',
    paddingTop: 8,
    paddingBottom: 8,
  },
  title: {
    fontSize: 32,
    includeFontPadding: false,
    fontWeight: '700',
    textAlign: 'center',
    color: '#2F233B',
    lineHeight: 38,
  },
  subtitle: {
    fontSize: 17,
    includeFontPadding: false,
    textAlign: 'center',
    color: '#786D82',
    marginTop: 10,
    lineHeight: 24,
  },
  imageContainer: {
    flex: 1,
    minHeight: 0,
    justifyContent: 'center',
    alignItems: 'center',
    width: '100%',
  },
  heroImage: {
    maxWidth: '100%',
  },
  heroPlaceholder: {
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: '#F4F1F8',
    borderRadius: 24,
  },
  heroPlaceholderText: {
    fontSize: 28,
    fontWeight: '700',
    color: '#A69AAD',
    letterSpacing: 1,
  },
  buttonContainer: {
    width: '100%',
    paddingTop: 8,
  },
});

export default WelcomeScreen;
