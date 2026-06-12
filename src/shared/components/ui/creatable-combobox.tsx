"use client";

import { useState, useRef, useEffect, useCallback } from "react";
import { Check, ChevronsUpDown, Loader2, Plus } from "lucide-react";
import { cn } from "@/shared/lib/utils";

interface CreatableComboboxProps {
  value: string;
  onChange: (value: string) => void;
  options: readonly string[];
  onCreateOption?: (name: string) => void | Promise<void>;
  isCreating?: boolean;
  placeholder?: string;
  searchPlaceholder?: string;
  createLabel?: (name: string) => string;
  disabled?: boolean;
  id?: string;
  "aria-label"?: string;
}

export function CreatableCombobox({
  value,
  onChange,
  options,
  onCreateOption,
  isCreating,
  placeholder = "Seleccioná...",
  searchPlaceholder = "Buscar...",
  createLabel = (name) => `Agregar "${name}"`,
  disabled,
  id,
  "aria-label": ariaLabel,
}: CreatableComboboxProps) {
  const [open, setOpen] = useState(false);
  const [search, setSearch] = useState("");
  const containerRef = useRef<HTMLDivElement>(null);
  const searchRef = useRef<HTMLInputElement>(null);

  const trimmed = search.trim();
  const filtered =
    trimmed === ""
      ? options
      : options.filter((o) => o.toLowerCase().includes(trimmed.toLowerCase()));

  const exactMatch = options.some(
    (o) => o.toLowerCase() === trimmed.toLowerCase(),
  );
  const showCreate = !!onCreateOption && trimmed.length > 0 && !exactMatch;

  const close = useCallback(() => {
    setOpen(false);
    setSearch("");
  }, []);

  useEffect(() => {
    if (!open) return;
    function onPointerDown(e: PointerEvent) {
      if (!containerRef.current?.contains(e.target as Node)) close();
    }
    document.addEventListener("pointerdown", onPointerDown);
    return () => document.removeEventListener("pointerdown", onPointerDown);
  }, [open, close]);

  useEffect(() => {
    if (open) setTimeout(() => searchRef.current?.focus(), 0);
  }, [open]);

  function handleSelect(option: string) {
    onChange(option);
    close();
  }

  async function handleCreate() {
    if (!onCreateOption || !trimmed) return;
    await onCreateOption(trimmed);
    onChange(trimmed);
    close();
  }

  return (
    <div ref={containerRef} className="relative">
      <button
        type="button"
        id={id}
        aria-label={ariaLabel}
        aria-expanded={open}
        aria-haspopup="listbox"
        disabled={disabled}
        onClick={() => setOpen((v) => !v)}
        className={cn(
          "flex h-9 w-full items-center justify-between rounded-md border border-input bg-transparent px-3 py-2 text-sm shadow-xs",
          "focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring",
          "disabled:cursor-not-allowed disabled:opacity-50",
          !value && "text-muted-foreground",
        )}
      >
        <span className="truncate">{value || placeholder}</span>
        <ChevronsUpDown className="ml-2 h-4 w-4 shrink-0 opacity-50" />
      </button>

      {open && (
        <div
          role="listbox"
          className="absolute z-50 mt-1 w-full rounded-md border border-border bg-popover text-popover-foreground shadow-md"
        >
          <div className="border-b border-border px-2 py-1.5">
            <input
              ref={searchRef}
              type="text"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder={searchPlaceholder}
              className="w-full bg-transparent text-sm outline-none placeholder:text-muted-foreground"
              onKeyDown={(e) => {
                if (e.key === "Escape") close();
                if (e.key === "Enter" && showCreate) {
                  e.preventDefault();
                  void handleCreate();
                }
              }}
            />
          </div>

          <div className="max-h-56 overflow-y-auto py-1">
            {filtered.length === 0 && !showCreate ? (
              <p className="py-6 text-center text-sm text-muted-foreground">
                Sin resultados
              </p>
            ) : (
              filtered.map((option) => (
                <button
                  key={option}
                  type="button"
                  role="option"
                  aria-selected={value === option}
                  onClick={() => handleSelect(option)}
                  className={cn(
                    "flex w-full items-center gap-2 px-3 py-2 text-left text-sm",
                    "hover:bg-accent hover:text-accent-foreground",
                    value === option && "bg-accent/40",
                  )}
                >
                  <Check
                    className={cn(
                      "h-3.5 w-3.5 shrink-0",
                      value === option ? "opacity-100" : "opacity-0",
                    )}
                  />
                  {option}
                </button>
              ))
            )}

            {showCreate && (
              <button
                type="button"
                disabled={isCreating}
                onClick={() => void handleCreate()}
                className="flex w-full items-center gap-2 border-t border-border px-3 py-2 text-left text-sm font-medium text-brand hover:bg-accent"
              >
                {isCreating ? (
                  <Loader2 className="h-3.5 w-3.5 shrink-0 animate-spin" />
                ) : (
                  <Plus className="h-3.5 w-3.5 shrink-0" />
                )}
                {createLabel(trimmed)}
              </button>
            )}
          </div>
        </div>
      )}
    </div>
  );
}
