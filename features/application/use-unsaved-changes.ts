"use client";
import { useEffect, useRef } from "react";

export function confirmNavigation() {
  return window.dispatchEvent(new Event("dgita:before-navigate", { cancelable: true }));
}

export function useUnsavedChanges(dirty: boolean, busy = false) {
  const state = useRef({ dirty, busy });
  useEffect(() => { state.current = { dirty, busy }; }, [dirty, busy]);
  useEffect(() => {
    const unload = (event: BeforeUnloadEvent) => {
      if (!state.current.dirty && !state.current.busy) return;
      event.preventDefault();
      event.returnValue = "";
    };
    const navigate = (event: Event) => {
      if (state.current.busy) {
        event.preventDefault();
        window.alert("Vent på, at gemning og upload er afsluttet, før du forlader siden.");
      } else if (state.current.dirty && !window.confirm("Du har ugemte ændringer. Vil du forlade siden uden at gemme dem?")) {
        event.preventDefault();
      }
    };
    window.addEventListener("beforeunload", unload);
    window.addEventListener("dgita:before-navigate", navigate);
    return () => {
      window.removeEventListener("beforeunload", unload);
      window.removeEventListener("dgita:before-navigate", navigate);
    };
  }, []);
  return () => { state.current = { dirty: false, busy: false }; };
}
