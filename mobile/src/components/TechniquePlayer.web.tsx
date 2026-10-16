export default function TechniquePlayer({ uri, title, tall = false }: { uri: string; title: string; tall?: boolean }) {
  return <iframe src={uri} title={title} style={{ width: '100%', height: tall ? 440 : 220, border: 0 }} allow="autoplay; encrypted-media; picture-in-picture; fullscreen" allowFullScreen referrerPolicy="strict-origin-when-cross-origin" />;
}
