import { Space } from '@/constants/theme';
import { ReactNode } from 'react';
import { ScrollView, StyleProp, ViewStyle } from 'react-native';

/**
 * A list that grows with its content up to maxHeight, then scrolls inside
 * itself, so a 100-guest event doesn't stretch the page forever.
 */
export default function ScrollBox({ children, maxHeight = 380, contentStyle }: {
  children: ReactNode;
  maxHeight?: number;
  contentStyle?: StyleProp<ViewStyle>;
}) {
  return (
    <ScrollView
      style={{ maxHeight, flexGrow: 0 }}
      contentContainerStyle={[{ paddingRight: Space.sm }, contentStyle]} // room for the scrollbar
      nestedScrollEnabled // Android: let the inner list scroll inside the page
      showsVerticalScrollIndicator
    >
      {children}
    </ScrollView>
  );
}
