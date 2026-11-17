import { useState } from "react";

/** A review's photos: one shown plainly, several in a row you swipe through, with which one you are on. */
export function PhotoStrip({ urls, alt, className }: { urls: string[]; alt: string; className: string }) {
  const [shown, setShown] = useState(0);
  if (urls.length === 0) return null;
  if (urls.length === 1) return <img className={className} src={urls[0]} alt={alt} loading="lazy" />;
  return (
    <div className="photo-strip-wrap">
      <div
        className="photo-strip"
        onScroll={(event) => setShown(Math.round(event.currentTarget.scrollLeft / event.currentTarget.clientWidth))}
      >
        {urls.map((url, index) => (
          <img key={url} className={className} src={url} alt={`${alt} (${index + 1} of ${urls.length})`} loading="lazy" />
        ))}
      </div>
      <span className="photo-count" aria-hidden="true">{shown + 1}/{urls.length}</span>
    </div>
  );
}
