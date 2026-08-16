// 一度入力した名前をブラウザへ覚えさせるための小さなヘルパー。
// LINE内ブラウザやプライベートモードなど、保存が使えない環境でも
// 落ちないように必ず try/catch で包んでいる。

const KEY = "genbameshi:name";

export function loadSavedName(): string {
  try {
    return localStorage.getItem(KEY) ?? "";
  } catch {
    return "";
  }
}

export function saveName(name: string): void {
  try {
    const trimmed = name.trim();
    if (trimmed) localStorage.setItem(KEY, trimmed);
  } catch {
    // 保存できなくても機能上は問題ないため無視する
  }
}
