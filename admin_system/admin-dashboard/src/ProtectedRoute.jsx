import { Navigate } from "react-router-dom";
import { pb } from "./pocketbase";

export default function ProtectedRoute({ children }) {
    if (!pb.authStore.isValid) {
        return <Navigate to="/" replace />;
    }

    return children;
}
