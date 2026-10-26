/** Author: BinaryBeast1209 */
import { Text, type TextProps } from 'react-native';

type Props = TextProps & {
  inline?: boolean;
};

export function SafeText({ children, style, inline: _inline, ...rest }: Props) {
  return (
    <Text {...rest} style={[{ flexShrink: 1 }, style]}>
      {children}
    </Text>
  );
}
