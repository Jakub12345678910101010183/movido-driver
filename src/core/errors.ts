// Backend errors → a driver-readable message, and whether trying again later
// can succeed. Codes are the MVxxx errcodes the RPCs raise.

import { t } from "../i18n/index.ts";

export interface BackendError { code?: string; message?: string; status?: number }

const CODES = [
  "NOT_A_DRIVER",
  "JOB_NOT_FOUND",
  "JOB_CLOSED",
  "ANOTHER_JOB_IN_PROGRESS",
  "STOP_NOT_FOUND",
  "INVALID_STATUS",
  "STOP_ORDER",
  "STOP_ALREADY_COMPLETED",
  "STOPS_PENDING",
  "LOCATION_REQUIRED",
  "LOCATION_INACCURATE",
  "NOT_AT_STOP",
  "STOP_NOT_LOCATED",
  "POD_REQUIRED",
  "PHOTO_NOT_UPLOADED",
  "INVALID_PHOTO_PATH",
  "INVALID_SIGNATURE",
  "NO_VEHICLE",
  "VEHICLE_NOT_FOUND",
  "INVALID_ITEM",
  "INVALID_TYPE",
  "DESCRIPTION_REQUIRED",
  "INVALID_FUEL_TYPE",
  "INVALID_LITRES",
  "INVALID_PRICE",
  "INVALID_MILEAGE",
  "INVALID_PHOTOS",
  "EMPTY_PHOTO",
  "PHOTO_MISSING",
  "INVALID_RECEIPT",
  "INVALID_POSITION",
] as const;

export function describeError(err: BackendError | null | undefined): string {
  if (!err) return t("err.generic");
  const code = CODES.find((k) => err.message?.includes(k));
  if (code) return t(`err.${code}`);
  if (isNetworkError(err)) return t("err.network");
  return t("err.tryAgain");
}

export function isNetworkError(err: BackendError | null | undefined): boolean {
  if (!err) return false;
  const m = (err.message ?? "").toLowerCase();
  return m.includes("network") || m.includes("fetch") || m.includes("timeout") || m.includes("timed out")
    || m.includes("aborted") || m.includes("connection") || err.status === 0;
}

/**
 * Whether a failed request should be retried later. Validation and permission
 * errors (MV400/403/404/409, RLS, constraint) will fail the same way again, so
 * they are reported to the driver instead of retried forever.
 */
export function isRetryable(err: BackendError | null | undefined): boolean {
  if (!err) return false;
  if (isNetworkError(err)) return true;
  const code = err.code ?? "";
  if (/^MV4\d\d$/.test(code) || code === "42501" || code === "23505" || code === "23514" || code === "22P02") return false;
  if (code === "PGRST301" || code === "401" || err.status === 401) return true; // expired session: refresh then retry
  if (err.status && err.status >= 500) return true;
  if (err.status && err.status >= 400) return false;
  return true;
}
