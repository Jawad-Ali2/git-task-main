import { useEffect, useRef } from "react";
import { useRouter } from "next/navigation";
import { useAppDispatch, useAppSelector } from "@/redux/hooks";
import {
  fetchProfile,
  logoutThunk,
  selectCurrentUser,
  clearAuth,
} from "@/redux/authSlice";

export const useAuth = () => {
  const dispatch = useAppDispatch();
  const router = useRouter();
  const user = useAppSelector(selectCurrentUser);
  const { loading, error, initialized } = useAppSelector((state) => state.auth);

  // Track if profile fetch has been initiated
  const fetchInitiated = useRef(false);

  useEffect(() => {
    // Only fetch if not initialized and not already initiated
    if (!initialized && !loading && !fetchInitiated.current) {
      fetchInitiated.current = true;
      
      dispatch(fetchProfile()).catch((err) => {
        console.error("Profile fetch failed:", err);
        // Don't clear auth on silent failures (401)
        if (!err?.silent) {
          dispatch(clearAuth());
        }
      });
    }
  }, [initialized, loading, dispatch]);

  const logout = async () => {
    fetchInitiated.current = false;
    await dispatch(logoutThunk());
    router.push("/login");
  };

  return {
    user,
    loading,
    error,
    logout,
    isAuthenticated: !!user,
    initialized
  };
};
