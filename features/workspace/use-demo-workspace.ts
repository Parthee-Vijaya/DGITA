"use client";

import { useCallback, useEffect, useState } from "react";

import type { Actor } from "../auth/types";
import {
  DEFAULT_CONTENT,
  DEFAULT_IMAGES,
  normalizeDgitaApproval,
  type ContentEntry,
  type DgitaApproval,
  type FieldComment,
  type ImageEntry,
} from "./model";

type PortalWorkspace = {
  content: ContentEntry[];
  images: ImageEntry[];
  approvals: Record<string, DgitaApproval>;
  fieldComments: FieldComment[];
};

const INITIAL_WORKSPACE: PortalWorkspace = {
  content: DEFAULT_CONTENT,
  images: DEFAULT_IMAGES,
  approvals: {},
  fieldComments: [],
};

export function useDemoWorkspace(viewer: Actor) {
  const [workspace, setWorkspace] = useState<PortalWorkspace>(() =>
    structuredClone(INITIAL_WORKSPACE),
  );
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const refresh = useCallback(async () => {
    setLoading(true);
    try {
      const response = await fetch("/api/workspace", { cache: "no-store" });
      if (response.status === 401) {
        window.location.assign("/login");
        return;
      }
      const payload = (await response.json()) as {
        workspace?: PortalWorkspace;
        error?: string;
      };
      if (!response.ok || !payload.workspace) {
        throw new Error(payload.error || "Portalindholdet kunne ikke hentes.");
      }
      setWorkspace(payload.workspace);
      setError(null);
    } catch (reason) {
      setError((reason as Error).message);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    const timeout = window.setTimeout(() => void refresh(), 0);
    return () => window.clearTimeout(timeout);
  }, [refresh, viewer.role, viewer.subject, viewer.tenantId]);

  const mutate = useCallback(async (body: unknown) => {
    try {
      const response = await fetch("/api/workspace", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(body),
      });
      const payload = (await response.json()) as { error?: string };
      if (response.status === 401) {
        window.location.assign("/login");
        return;
      }
      if (!response.ok) throw new Error(payload.error || "Ændringen kunne ikke gemmes.");
      setError(null);
    } catch (reason) {
      setError((reason as Error).message);
      await refresh();
    }
  }, [refresh]);

  const updateContent = useCallback((entry: ContentEntry, actor: Actor) => {
    if (actor.role !== "admin") return false;
    const saved = {
      ...entry,
      updatedAt: new Date().toISOString(),
      updatedBy: actor.displayName,
    };
    setWorkspace((current) => ({
      ...current,
      content: current.content.map((item) => item.id === entry.id ? saved : item),
    }));
    void mutate({ action: "content.upsert", entry });
    return true;
  }, [mutate]);

  const addContent = useCallback((entry: ContentEntry, actor: Actor) => {
    if (actor.role !== "admin") return false;
    const saved = {
      ...entry,
      updatedAt: new Date().toISOString(),
      updatedBy: actor.displayName,
    };
    setWorkspace((current) => ({ ...current, content: [...current.content, saved] }));
    void mutate({ action: "content.upsert", entry });
    return true;
  }, [mutate]);

  const removeContent = useCallback((id: string, actor: Actor) => {
    if (actor.role !== "admin") return false;
    setWorkspace((current) => ({
      ...current,
      content: current.content.filter((entry) => entry.id !== id),
    }));
    void mutate({ action: "content.delete", id });
    return true;
  }, [mutate]);

  const resetContent = useCallback((actor: Actor) => {
    if (actor.role !== "admin") return false;
    setWorkspace((current) => ({
      ...current,
      content: structuredClone(DEFAULT_CONTENT),
    }));
    void mutate({ action: "content.reset" });
    return true;
  }, [mutate]);

  const updateImage = useCallback((entry: ImageEntry, actor: Actor) => {
    if (actor.role !== "admin") return false;
    const saved = {
      ...entry,
      updatedAt: new Date().toISOString(),
      updatedBy: actor.displayName,
    };
    setWorkspace((current) => ({
      ...current,
      images: current.images.map((item) => item.id === entry.id ? saved : item),
    }));
    void mutate({ action: "image.upsert", entry });
    return true;
  }, [mutate]);

  const resetImages = useCallback((actor: Actor) => {
    if (actor.role !== "admin") return false;
    setWorkspace((current) => ({ ...current, images: structuredClone(DEFAULT_IMAGES) }));
    void mutate({ action: "image.reset" });
    return true;
  }, [mutate]);

  const updateApproval = useCallback((caseId: string, approval: DgitaApproval, actor: Actor) => {
    if (actor.role === "user") return false;
    const saved = {
      ...normalizeDgitaApproval(approval),
      updatedAt: new Date().toISOString(),
      updatedBy: actor.displayName,
    };
    setWorkspace((current) => ({
      ...current,
      approvals: { ...current.approvals, [caseId]: saved },
    }));
    void mutate({ action: "approval.save", caseId, approval });
    return true;
  }, [mutate]);

  const addFieldComment = useCallback((comment: FieldComment, actor: Actor) => {
    if (actor.role === "user") return false;
    setWorkspace((current) => ({
      ...current,
      fieldComments: [...current.fieldComments, comment],
    }));
    void mutate({
      action: "field-comment.add",
      comment: {
        id: comment.id,
        caseId: comment.caseId,
        fieldId: comment.fieldId,
        fieldLabel: comment.fieldLabel,
        body: comment.body,
        visibility: comment.visibility,
      },
    });
    return true;
  }, [mutate]);

  return {
    ...workspace,
    loading,
    error,
    refresh,
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
