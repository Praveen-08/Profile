"use client";

import * as React from "react";

interface ProjectContextValue {
  projectId: string | null;
  setProjectId: (id: string | null) => void;
}

const ProjectContext = React.createContext<ProjectContextValue | undefined>(undefined);

const STORAGE_KEY = "hdr-editor-project-id";

export function ProjectProvider({ children }: { children: React.ReactNode }) {
  // Lazy initializer so the stored project id is available on the very
  // first client render -- reading it in a useEffect instead left a one-tick
  // window where consumers saw `projectId === null` and redirected away
  // before hydration caught up.
  const [projectId, setProjectIdState] = React.useState<string | null>(() => {
    if (typeof window === "undefined") return null;
    return window.localStorage.getItem(STORAGE_KEY);
  });

  const setProjectId = React.useCallback((id: string | null) => {
    setProjectIdState(id);
    if (id) window.localStorage.setItem(STORAGE_KEY, id);
    else window.localStorage.removeItem(STORAGE_KEY);
  }, []);

  return (
    <ProjectContext.Provider value={{ projectId, setProjectId }}>
      {children}
    </ProjectContext.Provider>
  );
}

export function useProject() {
  const ctx = React.useContext(ProjectContext);
  if (!ctx) throw new Error("useProject must be used within ProjectProvider");
  return ctx;
}
