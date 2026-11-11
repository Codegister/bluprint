import { previewUser } from "@/dev/preview-fixtures";

function isAuthScreen() {
  return new URLSearchParams(window.location.search).get("screen") === "auth";
}

export function useAuth() {
  const authScreen = isAuthScreen();
  return {
    isLoading: false,
    isAuthenticated: !authScreen,
    user: authScreen ? undefined : previewUser,
    signIn: async (..._args: unknown[]) => undefined,
    signOut: async () => undefined,
  };
}
