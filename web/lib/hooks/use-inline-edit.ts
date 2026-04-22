import * as React from "react";

interface UseInlineEditOptions {
  /** Canonical value from the caller; the draft syncs to this when not editing. */
  value: string;
  /** Called with the new value only when the user changed it. */
  onCommit: (next: string) => void;
}

interface UseInlineEditResult {
  editing: boolean;
  draft: string;
  setDraft: React.Dispatch<React.SetStateAction<string>>;
  inputRef: React.RefObject<HTMLInputElement | null>;
  startEditing: () => void;
  commit: () => void;
  cancel: () => void;
  handleKeyDown: (e: React.KeyboardEvent<HTMLInputElement>) => void;
}

/**
 * Click-to-edit primitive: draft state, focus-on-enter, Enter/Esc/blur
 * handlers. The draft rehydrates from <c>value</c> whenever the caller's
 * value changes while we're NOT editing — so optimistic rollbacks and
 * refetches don't clobber an in-progress edit.
 *
 * Lifted out of InspectorField so FieldSlot and any future inline-edit
 * surfaces share one implementation. InspectorField will switch to this
 * hook when its Tailwind migration lands (Day 9 follow-up).
 */
export function useInlineEdit({ value, onCommit }: UseInlineEditOptions): UseInlineEditResult {
  const [editing, setEditing] = React.useState(false);
  const [draft, setDraft] = React.useState(value);
  const inputRef = React.useRef<HTMLInputElement | null>(null);

  React.useEffect(() => {
    if (!editing) setDraft(value);
  }, [value, editing]);

  React.useEffect(() => {
    if (editing) {
      inputRef.current?.focus();
      inputRef.current?.select();
    }
  }, [editing]);

  const startEditing = React.useCallback(() => setEditing(true), []);

  const commit = React.useCallback(() => {
    setEditing(false);
    if (draft !== value) onCommit(draft);
  }, [draft, value, onCommit]);

  const cancel = React.useCallback(() => {
    setDraft(value);
    setEditing(false);
  }, [value]);

  const handleKeyDown = React.useCallback(
    (e: React.KeyboardEvent<HTMLInputElement>) => {
      if (e.key === "Enter") {
        e.preventDefault();
        commit();
      } else if (e.key === "Escape") {
        e.preventDefault();
        cancel();
      }
    },
    [commit, cancel]
  );

  return {
    editing,
    draft,
    setDraft,
    inputRef,
    startEditing,
    commit,
    cancel,
    handleKeyDown,
  };
}
