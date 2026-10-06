import { createContext, useContext } from "react";

// App() still owns the state and handlers; pages read what they need from
// here instead of being closures inside App().
export const AppContext = createContext(null);

export function useAppContext() {
  const value = useContext(AppContext);
  if (!value) throw new Error("useAppContext must be used inside AppContext.Provider");
  return value;
}
