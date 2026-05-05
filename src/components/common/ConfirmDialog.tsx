"use client";

import {
  forwardRef,
  useCallback,
  useImperativeHandle,
  useRef,
  useState,
} from "react";

type CheckboxOption = { label: string; default: boolean };

type Props = {
  title: string;
  description: string;
  confirmLabel?: string;
  cancelLabel?: string;
  destructive?: boolean;
  checkbox?: CheckboxOption;
  onConfirm: (state: { checked: boolean }) => void | Promise<void>;
};

export type ConfirmDialogHandle = {
  open: () => void;
};

export const ConfirmDialog = forwardRef<ConfirmDialogHandle, Props>(
  function ConfirmDialog(
    {
      title,
      description,
      confirmLabel = "OK",
      cancelLabel = "キャンセル",
      destructive,
      checkbox,
      onConfirm,
    },
    ref,
  ) {
    const dialogRef = useRef<HTMLDialogElement>(null);
    const [checked, setChecked] = useState(checkbox?.default ?? false);

    useImperativeHandle(
      ref,
      () => ({
        open: () => {
          setChecked(checkbox?.default ?? false);
          dialogRef.current?.showModal();
        },
      }),
      [checkbox?.default],
    );

    const close = useCallback(() => dialogRef.current?.close(), []);

    const handleConfirm = useCallback(async () => {
      await onConfirm({ checked });
      close();
    }, [onConfirm, checked, close]);

    return (
      <dialog
        ref={dialogRef}
        className="m-auto rounded-xl p-0 shadow-xl backdrop:bg-black/40"
      >
        <div className="w-[min(20rem,90vw)] p-5">
          <h2 className="text-base font-bold text-gray-900">{title}</h2>
          <p className="mt-2 whitespace-pre-line text-sm text-gray-600">
            {description}
          </p>
          {checkbox && (
            <label className="mt-4 flex items-center gap-2 text-sm text-gray-700">
              <input
                type="checkbox"
                checked={checked}
                onChange={(e) => setChecked(e.target.checked)}
                className="h-4 w-4 rounded border-gray-300 accent-emerald-600"
              />
              {checkbox.label}
            </label>
          )}
          <div className="mt-5 flex justify-end gap-2">
            <button
              type="button"
              onClick={close}
              className="min-h-[44px] rounded-md px-4 py-2 text-sm text-gray-700 transition active:bg-gray-100"
            >
              {cancelLabel}
            </button>
            <button
              type="button"
              onClick={handleConfirm}
              className={`min-h-[44px] rounded-md px-4 py-2 text-sm font-medium text-white transition active:opacity-80 ${
                destructive ? "bg-red-600" : "bg-emerald-600"
              }`}
            >
              {confirmLabel}
            </button>
          </div>
        </div>
      </dialog>
    );
  },
);

ConfirmDialog.displayName = "ConfirmDialog";
