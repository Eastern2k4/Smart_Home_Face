"use client";

import * as React from "react";
import * as SwitchPrimitive from "@radix-ui/react-switch";
import { cn } from "@/lib/utils";

interface SwitchProps extends React.ComponentProps<
  typeof SwitchPrimitive.Root
> {
  onColor?: string;
  offColor?: string;
  showGlow?: boolean;
}

function Switch({
  className,
  onColor = "bg-green-500",
  offColor = "bg-gray-300",
  showGlow = true,
  ...props
}: SwitchProps) {
  const [checked, setChecked] = React.useState(props.checked || false);

  // Update internal state when props change
  React.useEffect(() => {
    if (props.checked !== undefined) {
      setChecked(props.checked);
    }
  }, [props.checked]);

  return (
    <SwitchPrimitive.Root
      data-slot="switch"
      checked={checked}
      onCheckedChange={(value) => {
        setChecked(value);
        props.onCheckedChange?.(value);
      }}
      className={cn(
        "peer inline-flex h-[1.15rem] w-8 shrink-0 items-center rounded-full border border-transparent shadow-xs transition-all outline-none focus-visible:ring-[3px] disabled:cursor-not-allowed disabled:opacity-50",
        // Dynamic colors based on checked state
        checked
          ? `${onColor} ${showGlow ? `shadow-[0_0_6px_${onColor.includes("green") ? "rgba(34,197,94,0.5)" : "rgba(59,130,246,0.5)"}]` : ""}`
          : `${offColor} shadow-inner`,
        "focus-visible:border-ring focus-visible:ring-ring/50",
        className,
      )}
      style={{
        boxShadow:
          checked && showGlow
            ? `0 0 8px ${
                onColor === "bg-green-500"
                  ? "rgba(34, 197, 94, 0.4)"
                  : onColor === "bg-blue-500"
                    ? "rgba(59, 130, 246, 0.4)"
                    : onColor === "bg-red-500"
                      ? "rgba(239, 68, 68, 0.4)"
                      : "rgba(0, 0, 0, 0.2)"
              }`
            : "inset 0 1px 2px rgba(0,0,0,0.1)",
        transition: "all 0.2s ease-in-out",
      }}
      {...props}
    >
      <SwitchPrimitive.Thumb
        data-slot="switch-thumb"
        className={cn(
          "pointer-events-none block size-4 rounded-full ring-0 transition-transform",
          "bg-white shadow-md",
          "data-[state=checked]:translate-x-[calc(100%-2px)] data-[state=unchecked]:translate-x-0",
          "dark:bg-white",
        )}
        style={{
          boxShadow: "0 1px 3px rgba(0,0,0,0.2), 0 0 0 1px rgba(0,0,0,0.05)",
          transition: "transform 0.2s ease-in-out",
        }}
      />
    </SwitchPrimitive.Root>
  );
}

export { Switch };
