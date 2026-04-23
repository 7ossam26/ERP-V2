import React, { useState, useCallback } from "react";
import ConfirmModal from "../components/bulk/ConfirmModal";

/**
 * Imperative confirm dialog.
 * Returns [confirmFn, ConfirmDialog].
 *
 * Usage:
 *   const [confirm, ConfirmDialog] = useConfirm();
 *   // in JSX: {ConfirmDialog}
 *   // imperatively: const ok = await confirm({ message: "…", tone: "danger" });
 */
export function useConfirm() {
  const [state, setState] = useState({ open: false, opts: {}, resolve: null });

  const confirm = useCallback(
    (opts = {}) =>
      new Promise((resolve) => {
        setState({ open: true, opts, resolve });
      }),
    []
  );

  const handleConfirm = () => {
    state.resolve?.(true);
    setState((s) => ({ ...s, open: false }));
  };

  const handleClose = () => {
    state.resolve?.(false);
    setState((s) => ({ ...s, open: false }));
  };

  const dialog = React.createElement(ConfirmModal, {
    ...state.opts,
    open: state.open,
    onConfirm: handleConfirm,
    onClose: handleClose,
  });

  return [confirm, dialog];
}
