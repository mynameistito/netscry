/** A result value that keeps expected failures in the function's return type. */
export type Result<Value, Failure> =
  | { readonly _tag: "Ok"; readonly value: Value }
  | { readonly _tag: "Err"; readonly error: Failure };

/** Construct a successful result.
 *
 * @param value - The value produced by a successful operation.
 * @returns A result containing `value`.
 */
export const ok = <Value>(value: Value): Result<Value, never> => ({
  _tag: "Ok",
  value,
});

/** Construct a failed result.
 *
 * @param error - The expected failure produced by an operation.
 * @returns A result containing `error`.
 */
export const err = <Failure>(error: Failure): Result<never, Failure> => ({
  _tag: "Err",
  error,
});
