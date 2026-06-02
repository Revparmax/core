import { Avatar as AvatarPrimitive } from "@base-ui/react/avatar";

import { cn } from "@/lib/utils";

const sizes = {
  xs: "size-6 text-[9px]",
  sm: "size-[30px] text-[11px]",
  md: "size-[34px] text-[12px]",
  lg: "size-11 text-[15px]",
  xl: "size-14 text-[19px]",
} as const;

const tones = {
  ember: "bg-[linear-gradient(140deg,var(--ember-500),var(--ember-600))]",
  blue: "bg-[linear-gradient(140deg,#4F8DF0,#2A5FC0)]",
  green: "bg-[linear-gradient(140deg,#46C489,#1F8A5B)]",
  neutral: "bg-[linear-gradient(140deg,#8A8278,#5A554C)]",
} as const;

interface AvatarProps {
  alt?: string;
  className?: string;
  initials?: string;
  size?: keyof typeof sizes;
  src?: string;
  status?: "online" | "away" | "offline";
  tone?: keyof typeof tones;
}

export function Avatar({
  initials,
  src,
  alt,
  size = "md",
  tone = "ember",
  status,
  className,
}: AvatarProps) {
  return (
    <span className={cn("relative inline-flex", className)} data-slot="avatar">
      <AvatarPrimitive.Root
        className={cn(
          "inline-flex select-none items-center justify-center overflow-hidden rounded-full font-mono font-semibold text-white",
          sizes[size],
          tones[tone]
        )}
      >
        {src && (
          <AvatarPrimitive.Image
            alt={alt}
            className="size-full object-cover"
            src={src}
          />
        )}
        <AvatarPrimitive.Fallback>{initials}</AvatarPrimitive.Fallback>
      </AvatarPrimitive.Root>
      {status && (
        <span
          className={cn(
            "absolute -right-px -bottom-px size-[11px] rounded-full border-2 border-card",
            status === "online" && "bg-pos",
            status === "away" && "bg-[#E0A23B]",
            status === "offline" && "bg-mid"
          )}
        />
      )}
    </span>
  );
}

export function AvatarGroup({
  children,
  more,
  className,
}: {
  children: React.ReactNode;
  more?: number;
  className?: string;
}) {
  return (
    <div
      className={cn(
        "inline-flex items-center [&>*:not(:first-child)]:-ml-2.5 [&>*]:ring-2 [&>*]:ring-card",
        className
      )}
      data-slot="avatar-group"
    >
      {children}
      {more ? (
        <span className="-ml-2.5 inline-flex size-[34px] items-center justify-center rounded-full bg-bar font-mono font-semibold text-[11px] text-mid ring-2 ring-card">
          +{more}
        </span>
      ) : null}
    </div>
  );
}
