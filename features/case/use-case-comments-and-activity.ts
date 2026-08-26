"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import {
  CaseFeedApiError,
  getCaseActivity,
  getCaseComments,
  submitCaseComment,
  type CaseActivityEvent,
  type CaseComment,
  type SubmitCaseCommentInput,
} from "./case-client";

export type CaseFeedError = {
  source: "load" | "submit";
  message: string;
  status?: number;
};

export type UseCaseCommentsAndActivityResult = {
  comments: CaseComment[];
  events: CaseActivityEvent[];
  isLoading: boolean;
  isSubmitting: boolean;
  error: CaseFeedError | null;
  refresh: () => Promise<void>;
  submitComment: (input: SubmitCaseCommentInput) => Promise<boolean>;
  clearError: () => void;
};

export function useCaseCommentsAndActivity(
  caseId: string | null | undefined,
): UseCaseCommentsAndActivityResult {
  const normalizedCaseId = caseId?.trim() || null;
  const [data, setData] = useState<{
    caseId: string | null;
    comments: CaseComment[];
    events: CaseActivityEvent[];
  }>({ caseId: null, comments: [], events: [] });
  const [loadingCaseId, setLoadingCaseId] = useState<string | null>(null);
  const [submittingCaseId, setSubmittingCaseId] = useState<string | null>(null);
  const [taggedError, setTaggedError] = useState<{
    caseId: string;
    error: CaseFeedError;
  } | null>(null);
  const loadRequestRef = useRef<{
    caseId: string;
    controller: AbortController;
  } | null>(null);
  const submitRequestRef = useRef<{
    caseId: string;
    controller: AbortController;
  } | null>(null);

  const load = useCallback(async (targetCaseId: string) => {
    loadRequestRef.current?.controller.abort();
    const controller = new AbortController();
    const request = { caseId: targetCaseId, controller };
    loadRequestRef.current = request;
    setLoadingCaseId(targetCaseId);
    setTaggedError((current) =>
      current?.caseId === targetCaseId && current.error.source === "load"
        ? null
        : current,
    );

    try {
      const [nextComments, nextEvents] = await Promise.all([
        getCaseComments(targetCaseId, controller.signal),
        getCaseActivity(targetCaseId, controller.signal),
      ]);

      if (
        controller.signal.aborted ||
        loadRequestRef.current !== request
      ) {
        return;
      }

      setData({ caseId: targetCaseId, comments: nextComments, events: nextEvents });
    } catch (caught) {
      if (
        isAbortError(caught) ||
        loadRequestRef.current !== request
      ) {
        return;
      }
      setTaggedError({
        caseId: targetCaseId,
        error: toCaseFeedError("load", caught),
      });
    } finally {
      if (loadRequestRef.current === request) {
        loadRequestRef.current = null;
        setLoadingCaseId((current) =>
          current === targetCaseId ? null : current,
        );
      }
    }
  }, []);

  useEffect(() => {
    loadRequestRef.current?.controller.abort();
    loadRequestRef.current = null;
    submitRequestRef.current?.controller.abort();
    submitRequestRef.current = null;

    if (!normalizedCaseId) return;
    const loadTimeout = window.setTimeout(() => {
      void load(normalizedCaseId);
    }, 0);

    return () => {
      window.clearTimeout(loadTimeout);
      loadRequestRef.current?.controller.abort();
      loadRequestRef.current = null;
      submitRequestRef.current?.controller.abort();
      submitRequestRef.current = null;
    };
  }, [normalizedCaseId, load]);

  const refresh = useCallback(async () => {
    if (!normalizedCaseId) return;
    await load(normalizedCaseId);
  }, [normalizedCaseId, load]);

  const submitComment = useCallback(async (input: SubmitCaseCommentInput) => {
    if (!normalizedCaseId || submitRequestRef.current) return false;

    const targetCaseId = normalizedCaseId;
    const controller = new AbortController();
    const request = { caseId: targetCaseId, controller };
    submitRequestRef.current = request;
    setSubmittingCaseId(targetCaseId);
    setTaggedError((current) =>
      current?.caseId === targetCaseId && current.error.source === "submit"
        ? null
        : current,
    );

    try {
      const nextComments = await submitCaseComment(
        targetCaseId,
        input,
        controller.signal,
      );

      if (
        controller.signal.aborted ||
        submitRequestRef.current !== request
      ) {
        return false;
      }

      setData((current) => ({
        caseId: targetCaseId,
        comments: nextComments,
        events: current.caseId === targetCaseId ? current.events : [],
      }));
      await load(targetCaseId);
      return true;
    } catch (caught) {
      if (
        isAbortError(caught) ||
        submitRequestRef.current !== request
      ) {
        return false;
      }
      setTaggedError({
        caseId: targetCaseId,
        error: toCaseFeedError("submit", caught),
      });
      return false;
    } finally {
      if (submitRequestRef.current === request) {
        submitRequestRef.current = null;
        setSubmittingCaseId((current) =>
          current === targetCaseId ? null : current,
        );
      }
    }
  }, [normalizedCaseId, load]);

  const clearError = useCallback(() => {
    setTaggedError((current) =>
      current?.caseId === normalizedCaseId ? null : current,
    );
  }, [normalizedCaseId]);

  const hasCurrentData = data.caseId === normalizedCaseId;
  const error = taggedError?.caseId === normalizedCaseId
    ? taggedError.error
    : null;

  return {
    comments: hasCurrentData ? data.comments : [],
    events: hasCurrentData ? data.events : [],
    isLoading: Boolean(normalizedCaseId && loadingCaseId === normalizedCaseId),
    isSubmitting: Boolean(
      normalizedCaseId && submittingCaseId === normalizedCaseId,
    ),
    error,
    refresh,
    submitComment,
    clearError,
  };
}

function toCaseFeedError(
  source: CaseFeedError["source"],
  error: unknown,
): CaseFeedError {
  if (error instanceof CaseFeedApiError) {
    return { source, message: error.message, status: error.status };
  }
  return {
    source,
    message:
      source === "submit"
        ? "Kommentaren kunne ikke gemmes. Prøv igen."
        : "Sagsdata kunne ikke hentes. Prøv igen.",
  };
}

function isAbortError(error: unknown) {
  return (
    (error instanceof DOMException && error.name === "AbortError") ||
    (error instanceof Error && error.name === "AbortError")
  );
}
