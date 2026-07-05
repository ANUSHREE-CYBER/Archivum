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
    <div>
      <div
        className={cn(
          "transition-bg relative flex h-[100vh] flex-col items-center justify-center overflow-hidden bg-[#080808] text-[#F2EFE9]",
          className,
        )}
        {...props}
      >
        <div
          className="pointer-events-none absolute inset-0 overflow-hidden"
          style={
            {
              "--aurora":
                "repeating-linear-gradient(100deg,#D4AF6A_10%,#E8C86A_15%,#B8944A_20%,#F2EFE9_25%,#C4A05A_30%)",
              "--dark-gradient":
                "repeating-linear-gradient(100deg,#000_0%,#000_7%,transparent_10%,transparent_12%,#000_16%)",

              "--gold-dark": "#B8944A",
              "--gold-medium": "#C4A05A",
              "--gold": "#D4AF6A",
              "--gold-bright": "#E8C86A",
              "--warm-white": "#F2EFE9",
              "--black": "#000",
              "--transparent": "transparent",
            } as CSSProperties
          }
        >
          <div
            className={cn(
              `after:animate-aurora pointer-events-none absolute -inset-[10px] [background-image:var(--dark-gradient),var(--aurora)] [background-size:300%,_200%] [background-position:50%_50%,50%_50%] opacity-30 blur-[10px] filter will-change-transform [--aurora:repeating-linear-gradient(100deg,var(--gold)_10%,var(--gold-bright)_15%,var(--gold-dark)_20%,var(--warm-white)_25%,var(--gold-medium)_30%)] [--dark-gradient:repeating-linear-gradient(100deg,var(--black)_0%,var(--black)_7%,var(--transparent)_10%,var(--transparent)_12%,var(--black)_16%)] after:absolute after:inset-0 after:[background-image:var(--dark-gradient),var(--aurora)] after:[background-size:200%,_100%] after:[background-attachment:fixed] after:mix-blend-difference after:content-[""]`,

              showRadialGradient &&
                `[mask-image:radial-gradient(ellipse_at_100%_0%,black_10%,var(--transparent)_70%)]`,
            )}
          ></div>
        </div>
        {children}
      </div>
    </div>
  );
};
