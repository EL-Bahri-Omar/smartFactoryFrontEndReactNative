// app/index.jsx
// Entry point — redirects based on auth status + role home page.
// Supervisors (ADMIN, RESPONSABLE_INDUSTRIEL) → dashboard, others → map.

import { Redirect } from "expo-router";
import { useAppSelector } from "../src/hooks/useAppSelector";
import { homeRouteFor } from "../src/hooks/useRole";

export default function Index() {
  const { status, user } = useAppSelector((s) => s.auth);

  if (status === "authenticated" && user) {
    return <Redirect href={homeRouteFor(user.role)} />;
  }

  return <Redirect href="/(auth)/login" />;
}
