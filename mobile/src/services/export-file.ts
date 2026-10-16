import { File, Paths } from 'expo-file-system';
import { isAvailableAsync, shareAsync } from 'expo-sharing';
export async function exportFile(data: unknown, name: string) {
  if (!await isAvailableAsync()) throw new Error('File sharing is unavailable on this device.');
  const file = new File(Paths.cache, name);
  file.create({ overwrite: true });
  file.write(JSON.stringify(data, null, 2));
  try { await shareAsync(file.uri, { mimeType: 'application/json', UTI: 'public.json' }); }
  finally { if (file.exists) file.delete(); }
}
