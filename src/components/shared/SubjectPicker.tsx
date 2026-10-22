import { useId, useState } from "react";

const OTHER = "__other__";

interface SubjectPickerProps {
  value: string;
  onChange: (subject: string) => void;
  /** From `subjectOptions()`: the student's classes. */
  options: string[];
  className: string;
}

/**
 * A subject dropdown of the student's classes, plus "Other…", which opens a box to type any name (e.g. a class that
 * hasn't been imported yet). An empty value shows "Choose a class", so callers should require a subject before saving.
 */
export function SubjectPicker({ value, onChange, options, className }: SubjectPickerProps) {
  const inputId = useId();
  // A saved subject that isn't one of the classes (typed earlier, or a class since dropped) opens in the typed box.
  const [custom, setCustom] = useState(() => value.trim() !== "" && !options.includes(value));

  return (
    <div className="space-y-2">
      <select
        className={className}
        aria-label="Subject"
        value={custom ? OTHER : value}
        onChange={e => {
          if (e.target.value === OTHER) {
            setCustom(true);
            onChange("");
          } else {
            setCustom(false);
            onChange(e.target.value);
          }
        }}
      >
        {!custom && value === "" && <option value="" disabled>Choose a class</option>}
        {options.map(s => <option key={s} value={s}>{s}</option>)}
        <option value={OTHER}>Other…</option>
      </select>
      {custom && (
        <div>
          <label htmlFor={inputId} className="block text-xs font-medium text-gray-500 mb-1">Subject name</label>
          <input id={inputId} className={className} placeholder="e.g. EPIC" maxLength={80} autoFocus
            value={value} onChange={e => onChange(e.target.value)} />
        </div>
      )}
    </div>
  );
}
