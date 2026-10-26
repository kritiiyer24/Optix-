/** Author: BinaryBeast1209 */
import { Platform } from 'react-native';
import * as FileSystem from 'expo-file-system/legacy';

export async function uriToDataUrl(uri: string): Promise<string> {
  if (uri.startsWith('data:')) return uri;
  if (Platform.OS === 'web') return uri;
  const base64 = await FileSystem.readAsStringAsync(uri, {
    encoding: FileSystem.EncodingType.Base64,
  });
  const mime = uri.toLowerCase().includes('.png') ? 'image/png' : 'image/jpeg';
  return `data:${mime};base64,${base64}`;
}
