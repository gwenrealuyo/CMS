"use client";

import {
  useState,
  useRef,
  useEffect,
  useCallback,
  useMemo,
  type ComponentType,
  type KeyboardEvent,
} from "react";
import { useRouter } from "next/navigation";
import {
  MagnifyingGlassIcon,
  UserIcon,
  UserGroupIcon,
  Squares2X2Icon,
  CalendarIcon,
  MegaphoneIcon,
  AcademicCapIcon,
  RectangleStackIcon,
  XMarkIcon,
} from "@heroicons/react/24/outline";
import { useGlobalSearch } from "@/src/hooks/useGlobalSearch";
import {
  GLOBAL_SEARCH_ENTITY_LABELS,
  GLOBAL_SEARCH_ENTITY_ORDER,
  GlobalSearchEntity,
  GlobalSearchResult,
  PersonSearchMeta,
} from "@/src/types/globalSearch";
import { MIN_GLOBAL_SEARCH_LENGTH } from "@/src/lib/globalSearchUtils";
import {
  formatPersonStatusLabel,
  getPersonStatusColor,
} from "@/src/lib/personStatus";

const ENTITY_ICONS: Record<
  GlobalSearchEntity,
  ComponentType<{ className?: string }>
> = {
  person: UserIcon,
  family: RectangleStackIcon,
  cluster: Squares2X2Icon,
  event: CalendarIcon,
  ministry: UserGroupIcon,
  evangelism_group: MegaphoneIcon,
  prospect: MegaphoneIcon,
  sunday_school_class: AcademicCapIcon,
};

interface GlobalSearchProps {
  variant: "desktop" | "mobile";
  onClose?: () => void;
  autoFocus?: boolean;
}

function formatPersonLocation(meta: PersonSearchMeta): string | null {
  const parts: string[] = [];
  if (meta.clusterCodes.length > 0) {
    parts.push(meta.clusterCodes.join(", "));
  }
  if (meta.branchCode) {
    parts.push(meta.branchCode);
  }
  return parts.length > 0 ? parts.join(" · ") : null;
}

function PersonSearchResultContent({
  result,
}: {
  result: GlobalSearchResult;
}) {
  const meta = result.personMeta;
  if (!meta) {
    return (
      <>
        <span className="text-sm font-medium text-gray-900">{result.title}</span>
        {result.subtitle && (
          <span className="text-xs text-gray-500">{result.subtitle}</span>
        )}
      </>
    );
  }

  const location = formatPersonLocation(meta);

  return (
    <>
      <span className="text-sm font-medium text-gray-900">{result.title}</span>
      <div className="flex flex-wrap items-center gap-2 mt-0.5">
        <span
          className={`inline-flex items-center px-2 py-0.5 rounded-full text-[10px] font-medium ${getPersonStatusColor(
            meta.status,
          )}`}
        >
          {formatPersonStatusLabel(meta.status)}
        </span>
        {location && (
          <span className="text-xs text-gray-500">{location}</span>
        )}
      </div>
    </>
  );
}

export default function GlobalSearch({
  variant,
  onClose,
  autoFocus = false,
}: GlobalSearchProps) {
  const router = useRouter();
  const [query, setQuery] = useState("");
  const [dropdownOpen, setDropdownOpen] = useState(false);
  const [activeIndex, setActiveIndex] = useState(-1);
  const containerRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLInputElement>(null);

  const {
    resultsByEntity,
    flatResults,
    loading,
    errors,
    hasQuery,
    isEmpty,
    debouncedQuery,
  } = useGlobalSearch({ query });

  const showDropdown =
    dropdownOpen && (hasQuery || loading) && query.trim().length > 0;

  useEffect(() => {
    if (autoFocus) {
      inputRef.current?.focus();
    }
  }, [autoFocus]);

  useEffect(() => {
    setActiveIndex(-1);
  }, [debouncedQuery, flatResults.length]);

  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (
        containerRef.current &&
        !containerRef.current.contains(event.target as Node)
      ) {
        setDropdownOpen(false);
      }
    };
    document.addEventListener("mousedown", handleClickOutside);
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, []);

  const selectResult = useCallback(
    (result: GlobalSearchResult) => {
      setDropdownOpen(false);
      setQuery("");
      onClose?.();
      router.push(result.href);
    },
    [onClose, router],
  );

  const handleKeyDown = (event: KeyboardEvent<HTMLInputElement>) => {
    if (event.key === "Escape") {
      setDropdownOpen(false);
      onClose?.();
      return;
    }

    if (!showDropdown || flatResults.length === 0) {
      return;
    }

    if (event.key === "ArrowDown") {
      event.preventDefault();
      setActiveIndex((prev) =>
        prev < flatResults.length - 1 ? prev + 1 : 0,
      );
    } else if (event.key === "ArrowUp") {
      event.preventDefault();
      setActiveIndex((prev) =>
        prev > 0 ? prev - 1 : flatResults.length - 1,
      );
    } else if (event.key === "Enter" && activeIndex >= 0) {
      event.preventDefault();
      const selected = flatResults[activeIndex];
      if (selected) {
        selectResult(selected);
      }
    }
  };

  const flatIndexByResult = useMemo(() => {
    const map = new Map<string, number>();
    flatResults.forEach((result, index) => {
      map.set(`${result.entity}-${result.id}`, index);
    });
    return map;
  }, [flatResults]);

  const inputClassName =
    variant === "desktop"
      ? "w-64 pl-10 pr-9 py-2 rounded-lg bg-gray-100 focus:outline-none focus:ring-2 focus:ring-purple-500"
      : "w-full pl-10 pr-9 py-2 rounded-lg bg-gray-100 focus:outline-none focus:ring-2 focus:ring-purple-500";

  const clearSearch = () => {
    setQuery("");
    setDropdownOpen(false);
    setActiveIndex(-1);
    inputRef.current?.focus();
  };

  const renderSearchInput = () => (
    <div className="relative">
      <MagnifyingGlassIcon className="absolute left-3 top-1/2 -translate-y-1/2 h-5 w-5 text-gray-400 pointer-events-none" />
      <input
        ref={inputRef}
        type="text"
        role="searchbox"
        inputMode="search"
        enterKeyHint="search"
        value={query}
        onChange={(e) => {
          setQuery(e.target.value);
          setDropdownOpen(true);
        }}
        onFocus={() => setDropdownOpen(true)}
        onKeyDown={handleKeyDown}
        placeholder="Search people, clusters, events…"
        className={inputClassName}
        aria-label="Global search"
        aria-expanded={showDropdown}
        aria-autocomplete="list"
      />
      {query.length > 0 && (
        <button
          type="button"
          onClick={clearSearch}
          className="absolute right-2 top-1/2 -translate-y-1/2 p-1 rounded-md text-gray-500 hover:text-gray-700 hover:bg-gray-200 min-w-[28px] min-h-[28px] flex items-center justify-center"
          aria-label="Clear search"
        >
          <XMarkIcon className="h-4 w-4" />
        </button>
      )}
    </div>
  );

  const renderResults = () => {
    if (!showDropdown) {
      return null;
    }

    return (
      <div
        className={`absolute left-0 right-0 mt-1 bg-white border border-gray-200 rounded-lg shadow-lg max-h-80 overflow-y-auto z-[60] ${
          variant === "desktop" ? "min-w-[20rem]" : ""
        }`}
        role="listbox"
      >
        {query.trim().length > 0 &&
          query.trim().length < MIN_GLOBAL_SEARCH_LENGTH && (
            <p className="px-4 py-3 text-sm text-gray-500">
              Type at least {MIN_GLOBAL_SEARCH_LENGTH} characters to search
            </p>
          )}

        {loading && (
          <p className="px-4 py-3 text-sm text-gray-500">Searching…</p>
        )}

        {!loading && isEmpty && (
          <p className="px-4 py-3 text-sm text-gray-500">
            No results for &ldquo;{debouncedQuery}&rdquo;
          </p>
        )}

        {GLOBAL_SEARCH_ENTITY_ORDER.map((entity) => {
          const results = resultsByEntity[entity];
          const error = errors[entity];
          if (!results?.length && !error) {
            return null;
          }

          const Icon = ENTITY_ICONS[entity];
          const label = GLOBAL_SEARCH_ENTITY_LABELS[entity];

          return (
            <div key={entity} className="border-t border-gray-100 first:border-t-0">
              <div className="px-3 py-2 text-xs font-semibold text-gray-500 uppercase tracking-wide flex items-center gap-2">
                <Icon className="h-4 w-4" />
                {label}
              </div>
              {error ? (
                <p className="px-4 py-2 text-sm text-red-600">{error}</p>
              ) : (
                results?.map((result) => {
                  const flatIndex =
                    flatIndexByResult.get(`${result.entity}-${result.id}`) ??
                    -1;
                  const isActive = flatIndex === activeIndex;
                  return (
                    <button
                      key={`${result.entity}-${result.id}`}
                      type="button"
                      role="option"
                      aria-selected={isActive}
                      className={`w-full text-left px-4 py-2.5 min-h-[44px] flex flex-col justify-center hover:bg-gray-50 ${
                        isActive ? "bg-purple-50" : ""
                      }`}
                      onMouseEnter={() => setActiveIndex(flatIndex)}
                      onClick={() => selectResult(result)}
                    >
                      <PersonSearchResultContent result={result} />
                    </button>
                  );
                })
              )}
            </div>
          );
        })}
      </div>
    );
  };

  if (variant === "mobile") {
    return (
      <div ref={containerRef} className="relative w-full">
        {renderSearchInput()}
        {renderResults()}
      </div>
    );
  }

  return (
    <div ref={containerRef} className="relative hidden md:block">
      {renderSearchInput()}
      {renderResults()}
    </div>
  );
}
