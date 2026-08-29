import {
  TouchableOpacity,
  TouchableNativeFeedback,
  Text,
  StyleSheet,
  View,
} from 'react-native';

import { COLORS, SPACING } from '../styles/theme';
import { shadow, weight, ACTIVE_OPACITY, HAIRLINE } from '../styles/platform';

/**
 * Button surface with a native Android ripple.
 *
 * The ripple must be clipped by a parent with overflow:hidden, or it paints
 * a square over the rounded corners.
 *
 * TouchableNativeFeedback is unavailable on some very old devices, so we fall
 * back to opacity rather than rendering nothing.
 */
const Pressable = ({ children, onPress, style, radius = 0, disabled }) => {
  if (TouchableNativeFeedback.canUseNativeForeground) {
    return (
      <View style={[{ borderRadius: radius, overflow: 'hidden' }, style]}>
        <TouchableNativeFeedback
          onPress={onPress}
          disabled={disabled}
          background={TouchableNativeFeedback.Ripple(
            'rgba(255,255,255,0.22)',
            false
          )}
        >
          <View style={styles.rippleInner}>{children}</View>
        </TouchableNativeFeedback>
      </View>
    );
  }

  return (
    <TouchableOpacity
      onPress={onPress}
      disabled={disabled}
      activeOpacity={ACTIVE_OPACITY}
      style={style}
    >
      {children}
    </TouchableOpacity>
  );
};

export const Button = ({
  title,
  onPress,
  style,
  textStyle,
  variant = 'primary',
  disabled,
}) => {
  const isPrimary = variant === 'primary';

  return (
    <Pressable
      onPress={onPress}
      disabled={disabled}
      radius={25}
      style={[
        isPrimary ? styles.primaryButton : styles.secondaryButton,
        isPrimary && shadow(2),
        disabled && styles.disabled,
        style,
      ]}
    >
      <View style={styles.buttonInner}>
        <Text
          style={[
            styles.buttonText,
            isPrimary ? styles.primaryText : styles.secondaryText,
            textStyle,
          ]}
          // Android: never let a long label break the button height.
          numberOfLines={1}
        >
          {title}
        </Text>
      </View>
    </Pressable>
  );
};

export const OptionItem = ({
  label,
  icon,
  onPress,
  selected,
  type = 'single',
}) => {
  return (
    <TouchableOpacity
      style={[styles.optionContainer, selected && styles.selectedOption]}
      onPress={onPress}
      activeOpacity={ACTIVE_OPACITY}
    >
      <View style={styles.content}>
        {icon ? <View style={styles.iconContainer}>{icon}</View> : null}
        <Text style={styles.label}>{label}</Text>
      </View>
      {type === 'multi' ? (
        <View style={[styles.checkbox, selected && styles.checkedBox]} />
      ) : null}
    </TouchableOpacity>
  );
};

const styles = StyleSheet.create({
  primaryButton: {
    backgroundColor: COLORS.primary,
    borderRadius: 25,
    width: '100%',
    marginVertical: SPACING.m,
  },
  secondaryButton: {
    backgroundColor: COLORS.greyMedium,
    borderRadius: 25,
    width: '100%',
    marginVertical: SPACING.m,
  },
  disabled: { opacity: 0.5 },
  buttonInner: {
    paddingVertical: SPACING.m,
    paddingHorizontal: SPACING.l,
    alignItems: 'center',
    justifyContent: 'center',
    minHeight: 52,
  },
  rippleInner: { width: '100%' },
  buttonText: {
    fontSize: 16,
    ...weight(600),
    // Android clips descenders on tight line heights.
    lineHeight: 22,
    includeFontPadding: false,
    textAlignVertical: 'center',
  },
  primaryText: { color: COLORS.white },
  secondaryText: { color: COLORS.textPrimary },

  optionContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    backgroundColor: COLORS.white,
    borderWidth: HAIRLINE,
    borderColor: COLORS.border,
    borderRadius: 16,
    paddingVertical: 16,
    paddingHorizontal: 16,
    marginVertical: SPACING.s,
    width: '100%',
    minHeight: 58,
  },
  selectedOption: {
    borderColor: COLORS.primary,
    borderWidth: 1.5,
    backgroundColor: COLORS.primarySoft,
  },
  content: {
    flexDirection: 'row',
    alignItems: 'center',
    flex: 1,
    paddingRight: 8,
  },
  iconContainer: { marginRight: 14, flexShrink: 0 },
  label: {
    fontSize: 16,
    color: COLORS.textPrimary,
    flex: 1,
    flexWrap: 'wrap',
    lineHeight: 22,
    includeFontPadding: false,
  },
  checkbox: {
    width: 20,
    height: 20,
    borderWidth: 1,
    borderColor: COLORS.border,
    borderRadius: 4,
  },
  checkedBox: {
    backgroundColor: COLORS.primary,
    borderColor: COLORS.primary,
  },
});

export default { Button, OptionItem };
