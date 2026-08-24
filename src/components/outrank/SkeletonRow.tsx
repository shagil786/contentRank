"use client";

export function SkeletonRow({ index }: { index: number }) {
  const isTop = index < 3;
  return (
    <div className={`flex items-center rule-b ${isTop ? "bg-ink/5" : ""}`}>
      <div className="pl-3 sm:pl-5 pr-2 sm:pr-4 py-2 sm:py-3 w-[64px] sm:w-[110px] shrink-0">
        <div className="h-8 sm:h-12 w-10 bg-ink/10 animate-pulse" />
      </div>
      <div className="hidden sm:block w-[42px] py-2 pr-3 shrink-0">
        <div className="h-[44px] w-[34px] bg-ink/10 animate-pulse" />
      </div>
      <div className="flex-1 py-2 sm:py-3 pr-2 space-y-2">
        <div className="h-4 w-2/3 bg-ink/10 animate-pulse" />
        <div className="h-2.5 w-1/3 bg-ink/5 animate-pulse" />
      </div>
      <div className="pr-3 sm:pr-5 py-2 sm:py-3 shrink-0 min-w-[78px] sm:min-w-[120px] text-right">
        <div className="h-4 w-16 ml-auto bg-ink/10 animate-pulse" />
      </div>
      <div className="hidden sm:block w-[78px] pr-5" />
    </div>
  );
}
