import { cn } from "../lib/utils";
import type { CSSProperties, HTMLProps, ReactNode } from "react";

interface AuroraBackgroundProps extends HTMLProps<HTMLDivElement> {
  children: ReactNode;
  showRadialGradient?: boolean;
}

export const AuroraBackground = ({
  className,
  children,
  showRadialGradient = true,
  ...props
}: AuroraBackgroundProps) => {
  return (
    <div
      className={cn(
        "transition-bg relative flex h-[100vh] flex-col items-center justify-center overflow-hidden bg-[#080808] text-[#F2EFE9]",
        className,
      )}
      {...props}
    >
      <div
        className="pointer-events-none fixed inset-0 -z-10 overflow-hidden"
        style={
          {
            "--black": "#080808",
            "--transparent": "transparent",
          } as CSSProperties
        }
      >
        {/* The --aurora stops are the rose gold family in the same
            base / light / dark / palest / mid order the gold set used:
            #B76E79 --color-accent, #C98A93 -light, #96555F -dark,
            #E4BCC3 -pale, #A6626C the midpoint of accent and accent-dark.
            Blend mode, opacity and mask are untouched. */}
        <div
          className={cn(
            `after:animate-aurora pointer-events-none absolute -inset-[10px] [--aurora:repeating-linear-gradient(100deg,#B76E79_10%,#C98A93_15%,#96555F_20%,#E4BCC3_25%,#A6626C_30%)] [--dark-gradient:repeating-linear-gradient(100deg,var(--black)_0%,var(--black)_7%,var(--transparent)_10%,var(--transparent)_12%,var(--black)_16%)] [background-image:var(--dark-gradient),var(--aurora)] [background-size:300%,_200%] [background-position:50%_50%,50%_50%] opacity-40 blur-[6px] will-change-transform after:absolute after:inset-0 after:[background-image:var(--dark-gradient),var(--aurora)] after:[background-size:200%,_100%] after:[background-attachment:fixed] after:mix-blend-screen after:content-[""]`,

            showRadialGradient &&
              `[mask-image:radial-gradient(ellipse_at_50%_50%,black_40%,var(--transparent)_85%)]`,
          )}
        ></div>
      </div>
      {children}
    </div>
  );
};
