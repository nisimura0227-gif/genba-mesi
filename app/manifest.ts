import type { MetadataRoute } from "next";

/**
 * ホーム画面に追加したときの表示名・アイコンの設定。
 * Next.js の標準の仕組みで /manifest.webmanifest として配信される。
 */
export default function manifest(): MetadataRoute.Manifest {
  return {
    name: "現場めし",
    short_name: "現場めし",
    description: "建設現場のお弁当注文サイト",
    start_url: "/",
    scope: "/",
    display: "standalone",
    background_color: "#ffffff",
    theme_color: "#2f7d4f",
    lang: "ja",
    icons: [
      { src: "/icon.svg", sizes: "any", type: "image/svg+xml", purpose: "any" },
      { src: "/icon.svg", sizes: "any", type: "image/svg+xml", purpose: "maskable" },
      // SVGを解釈しないインストール経路向けにPNG版も用意しておく
      { src: "/apple-touch-icon.png", sizes: "1024x1024", type: "image/png", purpose: "any" },
    ],
  };
}
