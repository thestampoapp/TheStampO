/**
 * StampActionSheet.js
 *
 * Bottom sheet of actions for the selected stamp(s).
 *
 *   1 stamp  ->  Edit · Save to device · Move · Print · Delete
 *   2+       ->  Move · Print · Delete   (Edit/Save need exactly one stamp)
 *
 * Built on RN's Modal rather than a library so there is no extra dependency
 * and no native rebuild.
 *
 * Android specifics:
 *   - statusBarTranslucent so the scrim covers the status bar
 *   - onRequestClose wires the hardware back button to dismiss
 *   - the sheet clears the system nav using the measured inset
 */

import React, { useEffect, useRef, useMemo } from 'react';
import {
  View,
  Text,
  StyleSheet,
  Modal,
  TouchableOpacity,
  TouchableWithoutFeedback,
  Animated,
  Easing,
} from 'react-native';
import { Feather } from '@expo/vector-icons';

import { useBottomInset, weight, HAIRLINE, ACTIVE_OPACITY } from '../styles/platform';

const INK = '#2F233B';
const MUTED = '#786D82';
const DANGER = '#D84343';

function Row({ icon, label, sub, danger, onPress }) {
  return (
    <TouchableOpacity
      style={styles.row}
      onPress={onPress}
      activeOpacity={ACTIVE_OPACITY}
    >
      <View style={[styles.iconWrap, danger && styles.iconWrapDanger]}>
        <Feather name={icon} size={19} color={danger ? DANGER : INK} />
      </View>
      <View style={styles.rowText}>
        <Text style={[styles.rowLabel, danger && styles.rowLabelDanger]}>
          {label}
        </Text>
        {sub ? <Text style={styles.rowSub}>{sub}</Text> : null}
      </View>
      <Feather name="chevron-right" size={18} color="#B9AFC4" />
    </TouchableOpacity>
  );
}

function StampActionSheet({
  visible,
  count = 1,
  onEdit,
  onSave,
  onMove,
  onPrint,
  onDelete,
  onClose,
}) {
  const slide = useRef(new Animated.Value(0)).current;
  const bottomInset = useBottomInset();

  useEffect(() => {
    Animated.timing(slide, {
      toValue: visible ? 1 : 0,
      duration: visible ? 240 : 160,
      easing: visible ? Easing.out(Easing.cubic) : Easing.in(Easing.quad),
      useNativeDriver: true,
    }).start();
  }, [visible, slide]);

  const sheetStyle = useMemo(
    () => ({
      opacity: slide,
      transform: [
        {
          translateY: slide.interpolate({
            inputRange: [0, 1],
            outputRange: [280, 0],
          }),
        },
      ],
    }),
    [slide]
  );

  const many = count > 1;
  const noun = many ? `${count} stamps` : 'this stamp';

  return (
    <Modal
      visible={visible}
      transparent
      animationType="fade"
      statusBarTranslucent
      navigationBarTranslucent
      onRequestClose={onClose}
    >
      <TouchableWithoutFeedback onPress={onClose}>
        <View style={styles.scrim} />
      </TouchableWithoutFeedback>

      <View style={styles.anchor} pointerEvents="box-none">
        <Animated.View style={[styles.sheet, { paddingBottom: 14 + bottomInset }, sheetStyle]}>
          <View style={styles.grabber} />

          <Text style={styles.title}>
            {many ? `${count} stamps selected` : 'Stamp options'}
          </Text>

          {/* Edit only makes sense for exactly one stamp. */}
          {!many ? (
            <Row
              icon="edit-2"
              label="Edit"
              sub="Add tape, text and stickers"
              onPress={onEdit}
            />
          ) : null}

          {/* Saving is single-stamp only: the gallery writer captures one
              rendered stamp at a time, and a silent partial batch would be
              worse than not offering it. */}
          {!many && onSave ? (
            <Row
              icon="download"
              label="Save to device"
              sub="Keep a copy in your gallery"
              onPress={onSave}
            />
          ) : null}

          {onMove ? (
            <Row
              icon="folder"
              label="Move to collection"
              sub={many ? `Move ${count} stamps` : 'Put it in another collection'}
              onPress={onMove}
            />
          ) : null}

          <Row
            icon="printer"
            label="Print"
            sub={`Send ${noun} to Blinkit`}
            onPress={onPrint}
          />

          <Row
            icon="trash-2"
            label="Delete"
            sub={many ? `Remove ${count} from your book` : 'Remove from your book'}
            danger
            onPress={onDelete}
          />

          <TouchableOpacity
            style={styles.cancel}
            onPress={onClose}
            activeOpacity={ACTIVE_OPACITY}
          >
            <Text style={styles.cancelText}>Cancel</Text>
          </TouchableOpacity>
        </Animated.View>
      </View>
    </Modal>
  );
}

const styles = StyleSheet.create({
  scrim: {
    ...StyleSheet.absoluteFillObject,
    backgroundColor: 'rgba(24,20,18,0.42)',
  },
  anchor: { flex: 1, justifyContent: 'flex-end' },
  sheet: {
    backgroundColor: '#FEFCFF',
    borderTopLeftRadius: 26,
    borderTopRightRadius: 26,
    paddingTop: 10,
    paddingHorizontal: 16,
    elevation: 24,
  },
  grabber: {
    alignSelf: 'center',
    width: 42,
    height: 4,
    borderRadius: 2,
    backgroundColor: '#E3DDEA',
    marginBottom: 12,
  },
  title: {
    fontSize: 14,
    includeFontPadding: false,
    color: MUTED,
    marginLeft: 6,
    marginBottom: 8,
    ...weight(600),
  },

  row: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 13,
    minHeight: 60,
  },
  iconWrap: {
    width: 42,
    height: 42,
    borderRadius: 21,
    backgroundColor: '#F3EFF7',
    alignItems: 'center',
    justifyContent: 'center',
    marginRight: 14,
  },
  iconWrapDanger: { backgroundColor: '#FBEBEB' },
  rowText: { flex: 1 },
  rowLabel: {
    fontSize: 16.5,
    includeFontPadding: false,
    color: INK,
    ...weight(600),
  },
  rowLabelDanger: { color: DANGER },
  rowSub: {
    marginTop: 2,
    fontSize: 13,
    includeFontPadding: false,
    color: MUTED,
  },

  cancel: {
    marginTop: 8,
    height: 52,
    borderRadius: 14,
    borderWidth: HAIRLINE,
    borderColor: '#E5DDEC',
    alignItems: 'center',
    justifyContent: 'center',
  },
  cancelText: {
    fontSize: 16,
    includeFontPadding: false,
    color: INK,
    ...weight(600),
  },
});

export default React.memo(StampActionSheet);
