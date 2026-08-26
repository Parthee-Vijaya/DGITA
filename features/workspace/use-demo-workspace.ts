"use client";

import { useCallback, useEffect, useState } from "react";
import {
  DEFAULT_CONTENT,
  DEFAULT_IMAGES,
  EMPTY_D_GITA_APPROVAL,
  editContentEntry,
  editImageEntry,
  normalizeDgitaApproval,
  type ContentEntry,
  type DgitaApproval,
  type FieldComment,
  type ImageEntry,
  type WorkspaceViewer,
} from "./model";

const STORAGE_KEY = "dgita-demo-workspace-v3";
const LEGACY_STORAGE_KEY = "dgita-demo-workspace-v2";

type StoredWorkspace = {
  version: 3;
  content: ContentEntry[];
  images: ImageEntry[];
  approvals: Record<string, DgitaApproval>;
  fieldComments: FieldComment[];
};

type LegacyStoredWorkspace = Omit<StoredWorkspace, "version" | "images"> & {
  version: 2;
};

const DEFAULT_APPROVALS: Record<string, DgitaApproval> = {
  "ITA-001284": {
    ...EMPTY_D_GITA_APPROVAL,
    approved: "Ja",
    date: "2026-08-26",
    legalBasis: "GDPR",
    responsible: "Peter Bjerre Ahlgren",
    hasAdditionalResponsible: "Nej",
    itConsultant: "Casper Kjeldsen Ravn",
    infrastructureChanges: "Ja",
    notes: "Arkitekturtegning skal eftersendes før endelig afslutning.",
    internalComments: "Afstem teknisk ejer med Infrastruktur på næste statusmøde.",
    phase: "Under behandling",
  },
};

const INITIAL_WORKSPACE: StoredWorkspace = {
  version: 3,
  content: DEFAULT_CONTENT,
  images: DEFAULT_IMAGES,
  approvals: DEFAULT_APPROVALS,
  fieldComments: [],
};

function cloneInitialWorkspace(): StoredWorkspace {
  return structuredClone(INITIAL_WORKSPACE);
}

function isStoredWorkspace(value: unknown): value is StoredWorkspace {
  if (!value || typeof value !== "object") return false;
  const candidate = value as Partial<StoredWorkspace>;
  return (
    candidate.version === 3 &&
    Array.isArray(candidate.content) &&
    Array.isArray(candidate.images) &&
    candidate.approvals !== null &&
    typeof candidate.approvals === "object" &&
    Array.isArray(candidate.fieldComments)
  );
}

function isLegacyStoredWorkspace(value: unknown): value is LegacyStoredWorkspace {
  if (!value || typeof value !== "object") return false;
  const candidate = value as Partial<LegacyStoredWorkspace>;
  return (
    candidate.version === 2 &&
    Array.isArray(candidate.content) &&
    candidate.approvals !== null &&
    typeof candidate.approvals === "object" &&
    Array.isArray(candidate.fieldComments)
  );
}

function mergeWorkspaceDefaults(workspace: StoredWorkspace): StoredWorkspace {
  const contentIds = new Set(workspace.content.map((entry) => entry.id));
  const imageIds = new Set(workspace.images.map((entry) => entry.id));
  return {
    ...workspace,
    content: [
      ...workspace.content,
      ...DEFAULT_CONTENT.filter((entry) => !contentIds.has(entry.id)),
    ],
    images: [
      ...workspace.images,
      ...DEFAULT_IMAGES.filter((entry) => !imageIds.has(entry.id)),
    ],
  };
}

function persist(workspace: StoredWorkspace) {
  try {
    window.localStorage.setItem(STORAGE_KEY, JSON.stringify(workspace));
  } catch {
    // Demoen forbliver brugbar, hvis browseren blokerer lokal lagring.
  }
}

export function useDemoWorkspace() {
  const [workspace, setWorkspace] = useState<StoredWorkspace>(cloneInitialWorkspace);

  useEffect(() => {
    let cancelled = false;
    try {
      const raw = window.localStorage.getItem(STORAGE_KEY)
        ?? window.localStorage.getItem(LEGACY_STORAGE_KEY);
      if (!raw) return;
      const parsed: unknown = JSON.parse(raw);
      const restored = isStoredWorkspace(parsed)
        ? mergeWorkspaceDefaults(parsed)
        : isLegacyStoredWorkspace(parsed)
          ? mergeWorkspaceDefaults({ ...parsed, version: 3, images: structuredClone(DEFAULT_IMAGES) })
          : null;
      if (restored) {
        window.setTimeout(() => {
          if (!cancelled) {
            setWorkspace(restored);
            persist(restored);
          }
        }, 0);
      }
    } catch {
      // Korrupt demo-state ignoreres til fordel for de sikre standarddata.
    }
    return () => {
      cancelled = true;
    };
  }, []);

  const commit = useCallback((update: (current: StoredWorkspace) => StoredWorkspace) => {
    setWorkspace((current) => {
      const next = update(current);
      persist(next);
      return next;
    });
  }, []);

  const updateContent = useCallback((entry: ContentEntry, viewer: WorkspaceViewer) => {
    if (viewer.role !== "admin") return false;
    commit((current) => ({
      ...current,
      content: editContentEntry(viewer, current.content, entry),
    }));
    return true;
  }, [commit]);

  const addContent = useCallback((entry: ContentEntry, viewer: WorkspaceViewer) => {
    if (viewer.role !== "admin") return false;
    commit((current) => ({
      ...current,
      content: [
        ...current.content,
        {
          ...entry,
          updatedAt: new Date().toISOString(),
          updatedBy: viewer.displayName,
        },
      ],
    }));
    return true;
  }, [commit]);

  const removeContent = useCallback((id: string, viewer: WorkspaceViewer) => {
    if (viewer.role !== "admin") return false;
    commit((current) => ({
      ...current,
      content: current.content.filter((entry) => entry.id !== id),
    }));
    return true;
  }, [commit]);

  const resetContent = useCallback((viewer: WorkspaceViewer) => {
    if (viewer.role !== "admin") return false;
    commit((current) => ({ ...current, content: structuredClone(DEFAULT_CONTENT) }));
    return true;
  }, [commit]);

  const updateImage = useCallback((entry: ImageEntry, viewer: WorkspaceViewer) => {
    if (viewer.role !== "admin") return false;
    commit((current) => ({
      ...current,
      images: editImageEntry(viewer, current.images, entry),
    }));
    return true;
  }, [commit]);

  const resetImages = useCallback((viewer: WorkspaceViewer) => {
    if (viewer.role !== "admin") return false;
    commit((current) => ({ ...current, images: structuredClone(DEFAULT_IMAGES) }));
    return true;
  }, [commit]);

  const updateApproval = useCallback((caseId: string, approval: DgitaApproval, viewer: WorkspaceViewer) => {
    if (viewer.role === "user") return false;
    commit((current) => ({
      ...current,
      approvals: {
        ...current.approvals,
        [caseId]: {
          ...normalizeDgitaApproval(approval),
          updatedAt: new Date().toISOString(),
          updatedBy: viewer.displayName,
        },
      },
    }));
    return true;
  }, [commit]);

  const addFieldComment = useCallback((comment: FieldComment, viewer: WorkspaceViewer) => {
    if (viewer.role === "user") return false;
    commit((current) => ({
      ...current,
      fieldComments: [...current.fieldComments, comment],
    }));
    return true;
  }, [commit]);

  return {
    content: workspace.content,
    images: workspace.images,
    approvals: workspace.approvals,
    fieldComments: workspace.fieldComments,
    updateContent,
    addContent,
    removeContent,
    resetContent,
    updateImage,
    resetImages,
    updateApproval,
    addFieldComment,
  };
}
