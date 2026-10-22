// Backend errors → a driver-readable message, and whether trying again later
// can succeed. Codes are the MVxxx errcodes the RPCs raise.

export interface BackendError { code?: string; message?: string; status?: number }

const MESSAGES: Record<string, string> = {
  NOT_A_DRIVER: "This account is not an active driver account. Contact your office.",
  JOB_NOT_FOUND: "This job is no longer assigned to you.",
  JOB_CLOSED: "This job is already closed.",
  ANOTHER_JOB_IN_PROGRESS: "Finish your current job before starting another.",
  STOP_NOT_FOUND: "This stop no longer exists on the job.",
  INVALID_STATUS: "That action is not possible for this stop.",
  STOP_ORDER: "Complete the previous stop first.",
  STOP_ALREADY_COMPLETED: "This stop is already delivered.",
  STOPS_PENDING: "Deliver every stop before completing the job.",
  LOCATION_REQUIRED: "Your location is needed to confirm this stop. Turn on location and try again at the stop.",
  LOCATION_INACCURATE: "Your location is not precise enough yet. Wait a moment in the open and try again.",
  NOT_AT_STOP: "You are not at this stop yet. Try again when you arrive.",
  STOP_NOT_LOCATED: "This stop has no map position. Ask the office to correct its address.",
  POD_REQUIRED: "Add a delivery photo or the recipient's signature.",
  PHOTO_NOT_UPLOADED: "The delivery photo has not finished uploading.",
  INVALID_PHOTO_PATH: "The delivery photo could not be linked to this job.",
  INVALID_SIGNATURE: "The signature could not be saved. Please sign again.",
  NO_VEHICLE: "No vehicle is assigned to you. Ask the office to assign one.",
  VEHICLE_NOT_FOUND: "That vehicle is not in your company.",
  INVALID_ITEM: "The check contains an unknown item.",
  INVALID_TYPE: "Choose what kind of issue this is.",
  DESCRIPTION_REQUIRED: "Describe what happened.",
  INVALID_FUEL_TYPE: "Choose a fuel type.",
  INVALID_LITRES: "Enter the litres (more than 0).",
  INVALID_PRICE: "The price looks wrong. Check the receipt.",
  INVALID_MILEAGE: "The mileage looks wrong.",
  INVALID_PHOTOS: "One of the photos could not be attached.",
  EMPTY_PHOTO: "Photo is empty — please retake it.",
  PHOTO_MISSING: "Photo is no longer on this phone — please retake it.",
  INVALID_RECEIPT: "The receipt photo could not be attached.",
  INVALID_POSITION: "Your location could not be read.",
};

export function describeError(err: BackendError | null | undefined): string {
  if (!err) return "Something went wrong.";
  const key = Object.keys(MESSAGES).find((k) => err.message?.includes(k));
  if (key) return MESSAGES[key];
  if (isNetworkError(err)) return "No connection. It will be sent when you are back online.";
  return "Something went wrong. Please try again.";
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
