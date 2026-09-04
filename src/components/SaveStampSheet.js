/**
 * SaveStampSheet.js
 *
 * "Save to device" sheet: choose the scalloped STAMP (transparent PNG) or the
 * full photo inside a white stamp frame with transparent cut-out corners, then
 * write it to the gallery.
 *
 * THE OFFSCREEN STAGE
 * -------------------
 * The stamp on screen may be 160dp wide; saving that would produce a small,
 * soft PNG. So this component mounts a SECOND StampRenderer at
 * CAPTURE_WIDTH (3x canonical) and captures THAT instead.
 *
 * It must be genuinely rendered for captureRef to work -- `display: none`,
 * zero opacity or unmounting all produce a blank or failed capture. Instead
 * it is positioned far off-screen (left: -9999) at full size, which renders
 * normally but is never visible.
 *
 * The stage is also drawn WITHOUT rotation: a rotated capture would bake the
 * -2deg tilt into the bitmap and leave transparent wedges at the corners.
 */

import React, { useState, useRef, useCallback, useEffect } from 'react';
import {
  View,
  Text,
  StyleSheet,
  Modal,
  TouchableOpacity,
  ActivityIndicator,
  Animated,
  Easing,
  Linking,
} from 'react-native';
import { Feather } from '@expo/vector-icons';

import StampRenderer from './StampRenderer';
import {
  saveStampView,
  saveFramedStampView,
  CAPTURE_WIDTH,
  CAPTURE_HEIGHT,
  isSaveAvailable,
  createImageReadyGate,
} from '../utils/saveToDevice';
import { STAMP_COLORS } from '../styles/stampTheme';
import {
  weight,
  shadow,
  HAIRLINE,
  ACTIVE_OPACITY,
  useBottomInset,
} from '../styles/platform';

function Option({ icon, title, body, onPress, busy, disabled }) {
  return (
    <TouchableOpacity
      style={[styles.option, disabled && styles.optionDisabled]}
      onPress={onPress}
      activeOpacity={ACTIVE_OPACITY}
      disabled={busy || disabled}
    >
      <View style={styles.optionIcon}>
        {busy ? (
          <ActivityIndicator size="small" color={STAMP_COLORS.accent} />
        ) : (
          <Feather name={icon} size={19} color={STAMP_COLORS.textPrimary} />
        )}
      </View>
      <View style={styles.optionText}>
        <Text style={styles.optionTitle}>{title}</Text>
        <Text style={styles.optionBody}>{body}</Text>
      </View>
      <Feather name="chevron-right" size={18} color="#B9AFC4" />
    </TouchableOpacity>
  );
}

function SaveStampSheet({ visible, stamp, onClose }) {
  const [busy, setBusy] = useState(null); // 'stamp' | 'png' | null
  const [status, setStatus] = useState(null); // { ok, message, blocked }

  const stageRef = useRef(null);
  const pngStageRef = useRef(null);
  const stampReadyGate = useRef(createImageReadyGate());
  const pngReadyGate = useRef(createImageReadyGate());
  const bottomInset = useBottomInset();
  const slide = useRef(new Animated.Value(0)).current;

  useEffect(() => {
    if (visible) {
      setStatus(null);
      stampReadyGate.current.reset();
      pngReadyGate.current.reset();
    }
    Animated.timing(slide, {
      toValue: visible ? 1 : 0,
      duration: visible ? 220 : 150,
      easing: visible ? Easing.out(Easing.cubic) : Easing.in(Easing.quad),
      useNativeDriver: true,
    }).start();
  }, [visible, slide, stamp?.uri]);

  const handleSaveStamp = useCallback(async () => {
    if (busy) return;
    setBusy('stamp');
    setStatus(null);
    stampReadyGate.current.reset();

    const res = await saveStampView(stageRef, stamp?.uri, stampReadyGate.current);
    setBusy(null);
    setStatus(
      res.ok
        ? { ok: true, message: 'Stamp saved to your gallery' }
        : { ok: false, message: res.error, blocked: res.blocked }
    );
  }, [busy, stamp?.uri]);

  const handleSavePng = useCallback(async () => {
    if (busy) return;
    setBusy('png');
    setStatus(null);
    pngReadyGate.current.reset();

    const res = await saveFramedStampView(pngStageRef, stamp?.uri, pngReadyGate.current);
    setBusy(null);
    setStatus(
      res.ok
        ? { ok: true, message: 'Photo saved to your gallery' }
        : { ok: false, message: res.error, blocked: res.blocked }
    );
  }, [busy, stamp?.uri]);

  const sheetStyle = {
    opacity: slide,
    transform: [
      {
        translateY: slide.interpolate({
          inputRange: [0, 1],
          outputRange: [40, 0],
        }),
      },
    ],
  };

  const unavailable = !isSaveAvailable();

  return (
    <>
      {/*
        OFFSCREEN CAPTURE STAGE.
        Rendered only while the sheet is open, at full capture resolution and
        with NO rotation. Positioned off-screen rather than hidden, because a
        hidden view cannot be captured.
      */}
      {visible ? (
        <View style={styles.stageWrap} pointerEvents="none">
          <View
            ref={stageRef}
            collapsable={false}
            style={[styles.stage, styles.stageSized]}
          >
            <StampRenderer
              uri={stamp?.uri}
              width={CAPTURE_WIDTH}
              rotation={0}
              forceSvg
              onImageReady={() => stampReadyGate.current.notify()}
            />
          </View>
          <View
            ref={pngStageRef}
            collapsable={false}
            style={[styles.stage, styles.stageSized, styles.framedStage]}
          >
            <StampRenderer
              uri={stamp?.uri}
              width={CAPTURE_WIDTH}
              rotation={0}
              framed
              forceSvg
              onImageReady={() => pngReadyGate.current.notify()}
            />
          </View>
        </View>
      ) : null}

      <Modal
        visible={visible}
        transparent
        animationType="fade"
        statusBarTranslucent
        navigationBarTranslucent
        onRequestClose={onClose}
      >
        <View style={styles.wrap}>
          <TouchableOpacity
            style={styles.scrim}
            activeOpacity={1}
            onPress={onClose}
          />

          <Animated.View style={[styles.sheet, shadow(4), { paddingBottom: 14 + bottomInset }, sheetStyle]}>
            <View style={styles.grabber} />
            <Text style={styles.title}>Save to device</Text>

            {unavailable ? (
              <Text style={styles.warn}>
                Saving needs expo-media-library. Run:{'\n'}
                npx expo install expo-media-library
              </Text>
            ) : null}

            <Option
              icon="award"
              title="Save as stamp"
              body="Transparent PNG with the perforated edge"
              onPress={handleSaveStamp}
              busy={busy === 'stamp'}
              disabled={unavailable}
            />

            <View style={styles.divider} />

            <Option
              icon="image"
              title="Save as PNG"
              body="White stamp border with transparent cut-out corners"
              onPress={handleSavePng}
              busy={busy === 'png'}
              disabled={unavailable}
            />

            {status ? (
              <View
                style={[
                  styles.status,
                  status.ok ? styles.statusOk : styles.statusBad,
                ]}
              >
                <Feather
                  name={status.ok ? 'check-circle' : 'alert-circle'}
                  size={15}
                  color={status.ok ? '#3E8E5A' : '#B24659'}
                />
                <Text
                  style={[
                    styles.statusText,
                    status.ok ? styles.statusTextOk : styles.statusTextBad,
                  ]}
                >
                  {status.message}
                </Text>
              </View>
            ) : null}

            {status && !status.ok && status.blocked ? (
              <TouchableOpacity
                style={styles.settingsBtn}
                onPress={() => Linking.openSettings().catch(() => {})}
                activeOpacity={ACTIVE_OPACITY}
              >
                <Text style={styles.settingsText}>Open Settings</Text>
              </TouchableOpacity>
            ) : null}

            <TouchableOpacity
              style={styles.doneBtn}
              onPress={onClose}
              activeOpacity={ACTIVE_OPACITY}
            >
              <Text style={styles.doneText}>{status?.ok ? 'Done' : 'Cancel'}</Text>
            </TouchableOpacity>
          </Animated.View>
        </View>
      </Modal>
    </>
  );
}

const styles = StyleSheet.create({
  /* Far off-screen: rendered (so it can be captured) but never visible. */
  stageWrap: {
    position: 'absolute',
    left: -10000,
    top: 0,
  },
  stage: { backgroundColor: 'transparent' },
  stageSized: {
    width: CAPTURE_WIDTH,
    height: CAPTURE_HEIGHT,
  },
  // StampRenderer paints the white paper border itself. A transparent capture
  // stage preserves the scalloped cut-out corners, exactly like Share.
  framedStage: { backgroundColor: 'transparent' },

  wrap: { flex: 1, justifyContent: 'flex-end' },
  scrim: {
    ...StyleSheet.absoluteFillObject,
    backgroundColor: 'rgba(20,17,15,0.45)',
  },

  sheet: {
    backgroundColor: '#FFFFFF',
    borderTopLeftRadius: 22,
    borderTopRightRadius: 22,
    paddingHorizontal: 18,
    paddingTop: 10,
  },
  grabber: {
    alignSelf: 'center',
    width: 38,
    height: 4,
    borderRadius: 2,
    backgroundColor: '#DED6E6',
    marginBottom: 14,
  },
  title: {
    fontSize: 18,
    includeFontPadding: false,
    color: STAMP_COLORS.textPrimary,
    ...weight(600),
    marginBottom: 10,
    marginLeft: 2,
  },
  warn: {
    fontSize: 12.5,
    lineHeight: 18,
    includeFontPadding: false,
    color: '#B24659',
    marginBottom: 10,
    marginLeft: 2,
  },

  option: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 14,
    paddingHorizontal: 4,
  },
  optionDisabled: { opacity: 0.45 },
  optionIcon: {
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: '#F5F1F8',
    alignItems: 'center',
    justifyContent: 'center',
  },
  optionText: { flex: 1, marginLeft: 13 },
  optionTitle: {
    fontSize: 15.5,
    includeFontPadding: false,
    color: STAMP_COLORS.textPrimary,
    ...weight(600),
  },
  optionBody: {
    marginTop: 2,
    fontSize: 12.5,
    includeFontPadding: false,
    color: STAMP_COLORS.textSecondary,
  },
  divider: { height: HAIRLINE, backgroundColor: '#EEE8F3', marginLeft: 57 },

  status: {
    flexDirection: 'row',
    alignItems: 'center',
    borderRadius: 10,
    paddingHorizontal: 12,
    paddingVertical: 10,
    marginTop: 10,
  },
  statusOk: { backgroundColor: '#EDF7F0' },
  statusBad: { backgroundColor: '#FCEFF2' },
  statusText: {
    flex: 1,
    marginLeft: 8,
    fontSize: 13,
    lineHeight: 18,
    includeFontPadding: false,
  },
  statusTextOk: { color: '#3E8E5A' },
  statusTextBad: { color: '#B24659' },

  settingsBtn: {
    marginTop: 10,
    height: 44,
    borderRadius: 22,
    borderWidth: HAIRLINE,
    borderColor: '#E5DDEC',
    alignItems: 'center',
    justifyContent: 'center',
  },
  settingsText: {
    fontSize: 14.5,
    includeFontPadding: false,
    color: STAMP_COLORS.textPrimary,
    ...weight(600),
  },

  doneBtn: {
    marginTop: 12,
    height: 50,
    borderRadius: 25,
    backgroundColor: '#F5F1F8',
    alignItems: 'center',
    justifyContent: 'center',
  },
  doneText: {
    fontSize: 15,
    includeFontPadding: false,
    color: STAMP_COLORS.textSecondary,
    ...weight(600),
  },
});

export default React.memo(SaveStampSheet);
