import { useEffect, useMemo, useState } from "react";
import { Input } from "@/components/ui/input";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";

export type TimelineUnit = "day" | "week" | "month" | "year";

const UNITS: { value: TimelineUnit; label: string }[] = [
  { value: "day", label: "Day(s)" },
  { value: "week", label: "Week(s)" },
  { value: "month", label: "Month(s)" },
  { value: "year", label: "Year(s)" },
];

export function parseTimeline(
  raw: string | null | undefined
): { num: string; unit: TimelineUnit } | null {
  if (!raw) return null;
  const m = raw.trim().match(/^(\d+(?:\.\d+)?)\s*(day|days|week|weeks|month|months|year|years)\b/i);
  if (!m) return null;
  const unitRaw = m[2].toLowerCase().replace(/s$/, "") as TimelineUnit;
  return { num: m[1], unit: unitRaw };
}

export function formatTimeline(num: string, unit: TimelineUnit): string {
  const n = num.trim();
  if (!n) return "";
  const plural = Number(n) === 1 ? unit : `${unit}s`;
  return `${n} ${plural}`;
}

interface Props {
  value: string;
  onChange: (combined: string) => void;
  /** If provided and value doesn't parse, shown as a "current value" note. */
  originalRaw?: string | null;
}

export function TimelineInput({ value, onChange, originalRaw }: Props) {
  const parsed = useMemo(() => parseTimeline(value), [value]);
  const [num, setNum] = useState<string>(parsed?.num ?? "");
  const [unit, setUnit] = useState<TimelineUnit>(parsed?.unit ?? "week");

  // Sync when external value flips between parseable states (e.g. entering edit mode).
  useEffect(() => {
    const p = parseTimeline(value);
    if (p) {
      setNum(p.num);
      setUnit(p.unit);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const update = (nextNum: string, nextUnit: TimelineUnit) => {
    setNum(nextNum);
    setUnit(nextUnit);
    onChange(formatTimeline(nextNum, nextUnit));
  };

  const unparseableExisting =
    originalRaw && originalRaw.trim() && !parseTimeline(originalRaw);

  return (
    <div className="mt-2 space-y-2">
      <div className="flex gap-2">
        <Input
          type="number"
          min={1}
          step={1}
          value={num}
          onChange={(e) => update(e.target.value, unit)}
          placeholder="e.g. 6"
          className="w-32"
        />
        <Select value={unit} onValueChange={(v) => update(num, v as TimelineUnit)}>
          <SelectTrigger className="flex-1">
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            {UNITS.map((u) => (
              <SelectItem key={u.value} value={u.value}>
                {u.label}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
      </div>
      {unparseableExisting ? (
        <p className="text-xs text-muted-foreground">
          Current value: <span className="font-medium text-foreground">{originalRaw}</span> — saving
          will replace it.
        </p>
      ) : null}
    </div>
  );
}
