import { WebView } from 'react-native-webview';
export default function TechniquePlayer({ uri, title, tall = false }: { uri: string; title: string; tall?: boolean }) {
  return <WebView source={{ uri }} accessibilityLabel={title} style={{ height: tall ? 440 : 220, backgroundColor: '#000' }} allowsFullscreenVideo allowsInlineMediaPlayback mediaPlaybackRequiresUserAction={false} />;
}
