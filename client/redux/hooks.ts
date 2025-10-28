import { TypedUseSelectorHook, useDispatch, useSelector } from "react-redux";
import type { RootState, AppDispatch } from "./store";

// Export typed (type-safe) hooks
export const useAppDispatch = () => useDispatch<AppDispatch>(); // For functions
export const useAppSelector: TypedUseSelectorHook<RootState> = useSelector; // Getters
