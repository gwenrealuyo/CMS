"use client";

import {
  useLayoutEffect,
  useRef,
  useState,
  type MouseEvent,
} from "react";

interface ExpandableTextProps {
  text: string;
  className?: string;
  onToggle?: (expanded: boolean) => void;
}

export default function ExpandableText({
  text,
  className = "",
  onToggle,
}: ExpandableTextProps) {
  const textRef = useRef<HTMLDivElement>(null);
  const onToggleRef = useRef(onToggle);
  const skipToggleCallback = useRef(true);
  const [expanded, setExpanded] = useState(false);
  const [isOverflowing, setIsOverflowing] = useState(false);

  onToggleRef.current = onToggle;

  useLayoutEffect(() => {
    setExpanded(false);
  }, [text]);

  useLayoutEffect(() => {
    const el = textRef.current;
    if (!el) return;

    const checkOverflow = () => {
      if (!el.classList.contains("line-clamp-2")) return;
      setIsOverflowing(el.scrollHeight > el.clientHeight + 1);
    };

    checkOverflow();
    const observer = new ResizeObserver(checkOverflow);
    observer.observe(el);
    return () => observer.disconnect();
  }, [text, expanded]);

  useLayoutEffect(() => {
    if (skipToggleCallback.current) {
      skipToggleCallback.current = false;
      return;
    }
    onToggleRef.current?.(expanded);
  }, [expanded]);

  const handleToggle = (event: MouseEvent<HTMLButtonElement>) => {
    event.preventDefault();
    event.stopPropagation();
    setExpanded((prev) => !prev);
  };

  return (
    <div>
      <div
        ref={textRef}
        className={[className, !expanded ? "line-clamp-2" : ""]
          .filter(Boolean)
          .join(" ")}
      >
        {text}
      </div>
      {isOverflowing && (
        <button
          type="button"
          onClick={handleToggle}
          aria-expanded={expanded}
          className="mt-1 text-sm text-primary hover:text-primary underline"
        >
          {expanded ? "See less" : "See more"}
        </button>
      )}
    </div>
  );
}
