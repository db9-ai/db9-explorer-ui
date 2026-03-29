interface Props {
  path: string;
  onNavigate: (path: string) => void;
}

export function Breadcrumb({ path, onNavigate }: Props) {
  const segments = path.split('/').filter(Boolean);

  return (
    <div className="breadcrumb">
      <span
        className={`breadcrumb-segment ${segments.length === 0 ? 'current' : ''}`}
        onClick={() => onNavigate('/')}
      >
        /
      </span>
      {segments.map((seg, i) => {
        const segPath = '/' + segments.slice(0, i + 1).join('/') + '/';
        const isCurrent = i === segments.length - 1;
        return (
          <span key={segPath} style={{ display: 'contents' }}>
            <span className="breadcrumb-sep">›</span>
            <span
              className={`breadcrumb-segment ${isCurrent ? 'current' : ''}`}
              onClick={() => !isCurrent && onNavigate(segPath)}
            >
              {seg}
            </span>
          </span>
        );
      })}
    </div>
  );
}
