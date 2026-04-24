"use client";

import * as React from "react";
import { createPortal } from "react-dom";
import { Copy, Download, MoreHorizontal, Pencil, Trash2 } from "lucide-react";
import { cn } from "@/lib/cn";

export type RowAction = "edit" | "duplicate" | "export" | "delete";

interface TemplateRowActionsProps {
  templateName: string;
  onSelect: (action: RowAction) => void;
}

const MENU_WIDTH = 180;
const MENU_GAP = 4;

/**
 * Kebab trigger + portal menu for a template row. Opening the menu is a
 * mousedown on the button; selecting an item or clicking outside closes it.
 * Rendered through a portal so the overflow-clip on the table card doesn't
 * swallow it.
 */
export function TemplateRowActions({ templateName, onSelect }: TemplateRowActionsProps) {
  const btnRef = React.useRef<HTMLButtonElement>(null);
  const [anchor, setAnchor] = React.useState<DOMRect | null>(null);

  const open = () => {
    const rect = btnRef.current?.getBoundingClientRect();
    if (rect) setAnchor(rect);
  };

  const handleButtonClick = (e: React.MouseEvent<HTMLButtonElement>) => {
    // Row also has a click handler (navigate to fill). Stop propagation so
    // opening the menu doesn't also fire that.
    e.stopPropagation();
    anchor ? setAnchor(null) : open();
  };

  const handleSelect = (action: RowAction) => {
    setAnchor(null);
    onSelect(action);
  };

  return (
    <>
      <button
        ref={btnRef}
        type="button"
        aria-label={`Actions for ${templateName}`}
        aria-haspopup="menu"
        aria-expanded={anchor !== null}
        onClick={handleButtonClick}
        className={cn(
          "shrink-0 w-7 h-7 rounded-[6px] grid place-items-center",
          "border border-transparent bg-transparent text-ink-3 cursor-pointer",
          "transition-[background-color,color,border-color] duration-100",
          "hover:bg-surface-2 hover:text-ink hover:border-line",
          "focus-visible:outline-[2px_solid_var(--color-accent)] focus-visible:outline-offset-1"
        )}
      >
        <MoreHorizontal size={15} aria-hidden="true" />
      </button>
      {anchor && (
        <Menu
          anchorRect={anchor}
          onSelect={handleSelect}
          onClose={() => setAnchor(null)}
        />
      )}
    </>
  );
}

interface MenuProps {
  anchorRect: DOMRect;
  onSelect: (action: RowAction) => void;
  onClose: () => void;
}

function Menu({ anchorRect, onSelect, onClose }: MenuProps) {
  const ref = React.useRef<HTMLDivElement>(null);
  const [mounted, setMounted] = React.useState(false);

  React.useEffect(() => {
    setMounted(true);
  }, []);

  React.useEffect(() => {
    const handleMouseDown = (e: MouseEvent) => {
      if (ref.current && !ref.current.contains(e.target as Node)) onClose();
    };
    const handleKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") onClose();
    };
    document.addEventListener("mousedown", handleMouseDown);
    document.addEventListener("keydown", handleKey);
    return () => {
      document.removeEventListener("mousedown", handleMouseDown);
      document.removeEventListener("keydown", handleKey);
    };
  }, [onClose]);

  if (!mounted) return null;

  // Align the menu's right edge with the button's right edge (kebab columns
  // sit at the table's right side, so menus anchored by `left` would clip).
  const top = anchorRect.bottom + MENU_GAP;
  const left = Math.max(8, Math.min(anchorRect.right - MENU_WIDTH, window.innerWidth - MENU_WIDTH - 8));

  return createPortal(
    <div
      ref={ref}
      role="menu"
      // React portals propagate events through the React tree, not the DOM
      // tree (docs.reactjs.org — `createPortal` caveats). Without this the
      // menu-item clicks bubble up to the <tr>'s onClick and navigate the
      // user to the fill flow instead of triggering Edit/Duplicate/Delete.
      onClick={(e) => e.stopPropagation()}
      onMouseDown={(e) => e.stopPropagation()}
      style={{ top, left, width: MENU_WIDTH }}
      className={cn(
        "fixed z-50 p-1",
        "bg-surface border border-line-strong rounded-md shadow-lg"
      )}
    >
      <MenuItem
        icon={<Pencil size={13} aria-hidden="true" />}
        label="Edit"
        onClick={() => onSelect("edit")}
      />
      <MenuItem
        icon={<Copy size={13} aria-hidden="true" />}
        label="Duplicate"
        onClick={() => onSelect("duplicate")}
      />
      <MenuItem
        icon={<Download size={13} aria-hidden="true" />}
        label="Export"
        onClick={() => onSelect("export")}
      />
      <div className="my-1 border-t border-line" />
      <MenuItem
        icon={<Trash2 size={13} aria-hidden="true" />}
        label="Delete"
        onClick={() => onSelect("delete")}
        destructive
      />
    </div>,
    document.body
  );
}

interface MenuItemProps {
  icon: React.ReactNode;
  label: string;
  onClick: () => void;
  destructive?: boolean;
}

function MenuItem({ icon, label, onClick, destructive }: MenuItemProps) {
  return (
    <button
      type="button"
      role="menuitem"
      onClick={onClick}
      className={cn(
        "flex items-center gap-2 w-full py-1.5 px-2.5",
        "border-0 rounded-[4px] cursor-pointer text-left",
        "font-ui text-[12.5px] bg-transparent",
        destructive
          ? "text-err hover:bg-err-weak"
          : "text-ink-2 hover:bg-surface-2 hover:text-ink"
      )}
    >
      {icon}
      <span>{label}</span>
    </button>
  );
}
