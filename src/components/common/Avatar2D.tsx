function hash(s: string) {
  let h = 0;
  for (let i = 0; i < s.length; i++) h = (h << 5) - h + s.charCodeAt(i);
  return Math.abs(h);
}

const palettes = [
  ["#7c3aed", "#a855f7"],
  ["#0ea5e9", "#22d3ee"],
  ["#10b981", "#34d399"],
  ["#f59e0b", "#fbbf24"],
  ["#ef4444", "#fb7185"],
  ["#6366f1", "#818cf8"],
];

export function Avatar2D({ name, size = 40, src }: { name: string; size?: number; src?: string | null }) {
  if (src) {
    return (
      <img 
        src={src} 
        alt={name} 
        width={size} 
        height={size} 
        className="shrink-0 rounded-full object-cover border border-border"
        onError={(e) => {
          (e.target as HTMLImageElement).src = `https://ui-avatars.com/api/?name=${encodeURIComponent(name)}&background=random`;
        }}
      />
    );
  }
  const initials = name.split(" ").map((n) => n[0]).slice(0, 2).join("").toUpperCase();
  const [a, b] = palettes[hash(name) % palettes.length];
  const id = `g-${hash(name)}`;
  return (
    <svg width={size} height={size} viewBox="0 0 40 40" className="shrink-0 rounded-full">
      <defs>
        <linearGradient id={id} x1="0" x2="1" y1="0" y2="1">
          <stop offset="0%" stopColor={a} />
          <stop offset="100%" stopColor={b} />
        </linearGradient>
      </defs>
      <rect width="40" height="40" rx="20" fill={`url(#${id})`} />
      <text x="50%" y="54%" dominantBaseline="middle" textAnchor="middle" fontSize="14" fontWeight="700" fill="#fff" fontFamily="ui-sans-serif, system-ui">
        {initials}
      </text>
    </svg>
  );
}
