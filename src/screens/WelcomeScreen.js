import { View, Text, StyleSheet, Image, SafeAreaView, Dimensions, StatusBar} from 'react-native';
import { Button } from '../components/Common';
import { SPACING } from '../styles/theme';
import { STATUS_BAR_HEIGHT } from '../styles/platform';
import { getWelcomeHero } from '../utils/assets';

const { width, height } = Dimensions.get('window');

const WelcomeScreen = ({ navigation }) => {
  const hero = getWelcomeHero();

  return (
    <SafeAreaView style={styles.container}>
      <StatusBar barStyle="dark-content" backgroundColor="transparent" translucent />
      <View style={styles.androidStatusSpacer} />
      <View style={styles.content}>
        <View style={styles.textContainer}>
          <Text style={styles.title}>Your photos, turned into tiny treasures</Text>
          <Text style={styles.subtitle}>Collect moments. Make them beautiful.</Text>
        </View>

        {/* Exact replica image from reference */}
        <View style={styles.imageContainer}>
          {hero ? (
            <Image source={hero} style={styles.heroImage} resizeMode="contain" />
          ) : (
            <View style={[styles.heroImage, styles.heroPlaceholder]}>
              <Text style={styles.heroPlaceholderText}>TheStampO</Text>
            </View>
          )}
        </View>

        <View style={styles.buttonContainer}>
          <Button 
            title="Get Started" 
            onPress={() => navigation.navigate('Referral')} 
          />
        </View>
      </View>
    </SafeAreaView>
  );
};

const styles = StyleSheet.create({
  androidStatusSpacer: { height: STATUS_BAR_HEIGHT },
  container: {
    flex: 1,
    backgroundColor: '#FFFFFF',
  },
  content: {
    flex: 1,
    paddingHorizontal: SPACING.xl,
    paddingTop: 50,
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  textContainer: {
    alignItems: 'center',
    zIndex: 10,
  },
  title: {
    fontSize: 34,
    includeFontPadding: false,
    fontWeight: '700',
    textAlign: 'center',
    color: '#2F233B',
    lineHeight: 42,
  },
  subtitle: {
    fontSize: 17,
    includeFontPadding: false,
    textAlign: 'center',
    color: '#786D82',
    marginTop: 12,
    lineHeight: 24,
  },
  imageContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    width: '100%',
  },
  heroImage: {
    width: width * 0.9,
    height: height * 0.58,
    maxWidth: 420,
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
    paddingBottom: 50,
    zIndex: 10,
  },
});

export default WelcomeScreen;
