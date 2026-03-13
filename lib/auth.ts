import crypto from "node:crypto";

/**
 * タイミング攻撃に強い文字列比較
 * 2つの文字列を定時間で比較し、文字列の内容に基づいて実行時間が変わらない
 * @param a - 比較対象の文字列1
 * @param b - 比較対象の文字列2
 * @returns 文字列が同一の場合は true、異なる場合は false
 */
export function timingSafeEqual(a: string, b: string): boolean {
  const bufA = Buffer.from(a);
  const bufB = Buffer.from(b);

  if (bufA.length !== bufB.length) {
    return false;
  }

  return crypto.timingSafeEqual(bufA, bufB);
}

/**
 * パスキーの検証
 * @param providedPasskey - ユーザーが提供したパスキー
 * @param expectedPasskey - 環境変数から取得した期待されるパスキー
 * @returns パスキーが正しい場合は true、間違っている場合は false
 */
export function verifyPasskey(
  providedPasskey: string | null,
  expectedPasskey: string | undefined,
): boolean {
  if (!providedPasskey || !expectedPasskey) {
    return false;
  }

  try {
    return timingSafeEqual(providedPasskey, expectedPasskey);
  } catch {
    return false;
  }
}
