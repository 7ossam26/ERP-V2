import React, { useState, useCallback } from "react";
import PromptModal from "../components/bulk/PromptModal";

/**
 * Imperative text-input dialog.
 * Returns [promptFn, PromptDialog].
 *
 * Usage:
 *   const [prompt, PromptDialog] = usePrompt();
 *   // in JSX: {PromptDialog}
 *   // imperatively: const value = await prompt({ title: "…", label: "…" });
 *   // returns the trimmed string, or null if user cancelled.
 */
export function usePrompt() {
  const [state, setState] = useState({ open: false, opts: {}, resolve: null });

  const prompt = useCallback(
    (opts = {}) =>
      new Promise((resolve) => {
        setState({ open: true, opts, resolve });
      }),
    []
  );

  const handleConfirm = (value) => {
    state.resolve?.(value);
    setState((s) => ({ ...s, open: false }));
  };

  const handleClose = () => {
    state.resolve?.(null);
    setState((s) => ({ ...s, open: false }));
  };

  const dialog = React.createElement(PromptModal, {
    ...state.opts,
    open: state.open,
    onConfirm: handleConfirm,
    onClose: handleClose,
  });

  return [prompt, dialog];
}
