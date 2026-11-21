/**
 * The shortest password the app accepts, in one place.
 *
 * The server enforces it when a password is set, reset or changed, and both
 * screens that ask for one print the same number, so the hint can never promise
 * a rule the server does not keep.
 */
export const MIN_PASSWORD_LENGTH = 8;
