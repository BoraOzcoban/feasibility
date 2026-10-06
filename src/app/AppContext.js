import { createContext, useContext } from "react";

// App() gathers the state and handlers from the domain hooks; pages and the
// route guards read what they need from here.
export const AppContext = createContext(null);

export function useAppContext() {
  const value = useContext(AppContext);
  if (!value) throw new Error("useAppContext must be used inside AppContext.Provider");
  return value;
}
