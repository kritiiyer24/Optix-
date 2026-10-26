/** Author: BinaryBeast1209 */
import { StyleSheet, View } from 'react-native';
import { SafeText } from './SafeText';
import { brand, colors, displayBase } from '../theme';

type Props = {
  light?: boolean;
};

export function Logo({ light = false }: Props) {
  const ink = light ? '#F7F1E8' : colors.text;
  const mark = light ? '#F4D7B0' : colors.accent;
  return (
    <View style={styles.row}>
      <View style={[styles.mark, { backgroundColor: mark }]}>
        <View style={styles.iris} />
      </View>
      <SafeText inline style={[styles.word, { color: ink }]}>
        {brand.name}
      </SafeText>
    </View>
  );
}

const styles = StyleSheet.create({
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    alignSelf: 'flex-start',
    gap: 10,
    maxWidth: '100%',
  },
  mark: {
    width: 26,
    height: 26,
    borderRadius: 13,
    alignItems: 'center',
    justifyContent: 'center',
  },
  iris: {
    width: 9,
    height: 9,
    borderRadius: 5,
    backgroundColor: '#FFFBF6',
  },
  word: {
    ...displayBase,
    fontSize: 20,
    lineHeight: 24,
  },
});
