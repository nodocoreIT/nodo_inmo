"use client";

import { useState, useRef, useEffect, useCallback } from "react";
import { Check, ChevronsUpDown } from "lucide-react";
import { cn } from "@/shared/lib/utils";

interface ComboboxProps {
  value: string;
  onChange: (value: string) => void;
  options: readonly string[];
  placeholder?: string;
  searchPlaceholder?: string;
  disabled?: boolean;
  id?: string;
  "aria-label"?: string;
}

export function Combobox({
  value,
  onChange,
  options,
  placeholder = "Seleccioná...",
  searchPlaceholder = "Buscar...",
  disabled,
  id,
  "aria-label": ariaLabel,
}: ComboboxProps) {
  const [open, setOpen] = useState(false);
  const [search, setSearch] = useState("");
  const containerRef = useRef<HTMLDivElement>(null);
  const searchRef = useRef<HTMLInputElement>(null);

  const filtered =
    search.trim() === ""
      ? options
      : options.filter((o) =>
          o.toLowerCase().includes(search.toLowerCase()),
        );

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
    onChange(value === option ? "" : option);
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
              }}
            />
          </div>

          <div className="max-h-56 overflow-y-auto py-1">
            {filtered.length === 0 ? (
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
          </div>
        </div>
      )}
    </div>
  );
}
