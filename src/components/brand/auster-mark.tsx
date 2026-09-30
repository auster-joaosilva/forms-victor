export function AusterMark({ caption }: { caption: string }) {
  return (
    <div className="mb-5 flex items-center gap-[9px]">
      <div className="flex size-[26px] shrink-0 items-center justify-center rounded-md bg-auster-dark">
        <svg width="16" height="16" viewBox="0 0 32 32" aria-hidden="true">
          <path d="M8 21l8-11 8 11" stroke="#71CFEB" strokeWidth="3" fill="none" />
        </svg>
      </div>
      <span className="text-xs uppercase tracking-[1.1px] text-auster-gray">{caption}</span>
    </div>
  )
}
