import { cx } from "@/lib/cx";

interface SwitchProps {
  readonly checked: boolean;
  readonly onChange: (checked: boolean) => void;
  /** Id del texto visible que nombra el interruptor. */
  readonly labelledBy: string;
  readonly describedBy?: string | undefined;
  readonly disabled?: boolean;
}

/** Interruptor de encendido y apagado, de 48 px de alto. El nombre lo da un texto visible. */
export function Switch({ checked, onChange, labelledBy, describedBy, disabled = false }: SwitchProps) {
  return (
    <button
      type="button"
      role="switch"
      aria-checked={checked}
      aria-labelledby={labelledBy}
      aria-describedby={describedBy}
      disabled={disabled}
      onClick={() => onChange(!checked)}
      className={cx(
        "relative h-12 w-20 shrink-0 rounded-full border-[1.5px] transition-colors duration-150",
        checked ? "border-brand bg-brand" : "border-line bg-line-2",
      )}
    >
      <span
        aria-hidden="true"
        className={cx(
          "absolute top-1 size-9 rounded-full bg-surface shadow transition-all duration-150",
          checked ? "left-9" : "left-1",
        )}
      />
    </button>
  );
}
