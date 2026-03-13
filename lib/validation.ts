import { z } from "zod";

// UUID パターン（任意の UUID バージョン v1-v5）
// 形式: xxxxxxxx-xxxx-xxxx-xxxx-xxxxxxxxxxxx
const UUIDPattern =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

// appliance ID パターン（通常の UUID 形式）
const ApplianceIdPattern =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

/**
 * Light Control (lighton/lightoff) リクエストバリデーション
 */
export const LightControlRequestSchema = z.object({
  passkey: z
    .string()
    .min(1, "Passkey is required")
    .max(100, "Passkey is too long"),
});

export type LightControlRequest = z.infer<typeof LightControlRequestSchema>;

/**
 * Lock Control (lockopen) リクエストバリデーション
 */
export const LockControlRequestSchema = z.object({
  passkey: z
    .string()
    .min(1, "Passkey is required")
    .max(100, "Passkey is too long"),
});

export type LockControlRequest = z.infer<typeof LockControlRequestSchema>;

/**
 * Appliance ID バリデーション
 */
export const validateApplianceId = (id: string): boolean => {
  return (
    typeof id === "string" &&
    id.length > 0 &&
    id.length <= 36 &&
    ApplianceIdPattern.test(id)
  );
};

/**
 * Device UUID バリデーション（Sesame用）
 * UUID形式（v1-v5）を受け入れる
 */
export const validateDeviceId = (id: string): boolean => {
  return (
    typeof id === "string" &&
    id.length > 0 &&
    id.length <= 36 &&
    UUIDPattern.test(id)
  );
};

/**
 * バリデーションエラーレスポンスの作成
 */
export function createValidationErrorResponse(errors: z.ZodIssue[]) {
  return {
    error: "Invalid request parameters",
    details: errors.map((e) => ({
      field: e.path.join(".") || "request",
      message: e.message,
    })),
  };
}
