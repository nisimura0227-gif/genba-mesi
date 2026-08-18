// 一度入力した名前をブラウザへ覚えさせるための小さなヘルパー。
// LINE内ブラウザやプライベートモードなど、保存が使えない環境でも
// 落ちないように必ず try/catch で包んでいる。

const KEY = "genbameshi:name";
const COMPANY_KEY = "genbameshi:company";

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

export function loadSavedCompany(): string {
  try {
    return localStorage.getItem(COMPANY_KEY) ?? "";
  } catch {
    return "";
  }
}

export function saveCompany(company: string): void {
  try {
    const trimmed = company.trim();
    if (trimmed) localStorage.setItem(COMPANY_KEY, trimmed);
  } catch {
    // 保存できなくても機能上は問題ないため無視する
  }
}
