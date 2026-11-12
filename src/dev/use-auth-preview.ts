import { previewUser } from "@/dev/preview-fixtures";

function isSignedOutScreen() {
  const screen = new URLSearchParams(window.location.search).get("screen");
  return screen === "auth" || screen === "home";
}

export function useAuth() {
  const signedOut = isSignedOutScreen();
  return {
    isLoading: false,
    isAuthenticated: !signedOut,
    user: signedOut ? undefined : previewUser,
    signIn: async (..._args: unknown[]) => undefined,
    signOut: async () => undefined,
  };
}
