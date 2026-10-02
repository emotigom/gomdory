type PageMarkerProps = {
  page: string;
  view?: string;
  extra?: Record<string, string>;
  renderMeta?: boolean;
};

export function pageMarkerMetadata({ page, view, extra }: Omit<PageMarkerProps, "renderMeta">) {
  const metadata: Record<string, string> = {
    "gom:page": page,
  };

  if (view) {
    metadata["gom:view"] = view;
  }

  if (extra) {
    for (const [key, value] of Object.entries(extra)) {
      metadata[`gom:${key}`] = value;
    }
  }

  return metadata;
}

export default function PageMarker({ page, view, extra, renderMeta = true }: PageMarkerProps) {
  const bodyAttributes: Record<string, string> = {
    "data-gom-page": page,
    "data-gom-marker": "1",
  };

  if (view) {
    bodyAttributes["data-gom-view"] = view;
  }

  if (extra) {
    for (const [key, value] of Object.entries(extra)) {
      bodyAttributes[`data-gom-${key}`] = value;
    }
  }

  return (
    <>
      {renderMeta ? (
        <>
          <meta name="gom:page" content={page} />
          {view ? <meta name="gom:view" content={view} /> : null}
          {extra
            ? Object.entries(extra).map(([key, value]) => (
                <meta key={key} name={`gom:${key}`} content={value} />
              ))
            : null}
        </>
      ) : null}
      <div {...bodyAttributes} className="sr-only" />
    </>
  );
}
