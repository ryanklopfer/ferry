export function SuperbillPreview({ claimId, mime }: { claimId: number; mime: string | null }) {
  if (!mime) return <div className="rounded-lg border border-dashed border-stone-300 p-6 text-center text-xs text-stone-500">No superbill attached</div>;
  const src = `/api/claims/${claimId}/superbill`;
  return (
    <div className="overflow-hidden rounded-lg border border-stone-200 bg-white">
      {mime === "application/pdf" ? (
        <iframe src={src} title="Superbill" className="h-[70vh] w-full" />
      ) : (
        // eslint-disable-next-line @next/next/no-img-element
        <img src={src} alt="Superbill" className="w-full" />
      )}
      <a href={src} target="_blank" className="block border-t border-stone-200 px-3 py-1.5 text-center text-xs underline">Open full size</a>
    </div>
  );
}
