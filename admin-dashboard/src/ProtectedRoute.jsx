import { Navigate } from "react-router-dom";
import { pb } from "./pocketbase";

export default function ProtectedRoute({ children, requiredModule }) {
  const authModel = pb.authStore.model;

  // 1. Level One: Authentication Check
  // If they are not logged in at all, kick them back to the login screen.
  if (!pb.authStore.isValid || !authModel) {
    return <Navigate to="/" replace />;
  }

  // 2. Level Two: Super Admin Bypass
  // Super admins inherently own the system. They bypass all module restrictions.
  if (authModel.collectionName === "super_admins") {
    return children;
  }

  // 3. Level Three: Regular Admin Role-Based Access
  if (authModel.collectionName === "admins") {
    // If the route doesn't specify a required module (like the main /dashboard), let them in.
    if (!requiredModule) {
      return children;
    }

    // Look at the JSON array we added to their database record
    const userPermissions = authModel.permissions || [];

    // If their array includes the module name, render the page
    if (userPermissions.includes(requiredModule)) {
      return children;
    } else {
      // Unauthorized! Kick them back to the dashboard and notify them.
      alert(
        `⛔ Access Denied: You do not have permission to access the ${requiredModule.toUpperCase()} module.`,
      );
      return <Navigate to="/dashboard" replace />;
    }
  }

  // Fallback: If somehow a user isn't an admin or super_admin, kick them out.
  return <Navigate to="/" replace />;
}
