// Warm, light line illustrations for the onboarding cards (flow.life-style: thin ink strokes, soft fills).

type Name =
  | "one" | "two" | "three" | "four"
  | "noPet" | "cat" | "dog"
  | "apartment" | "house" | "condo" | "any"
  | "studio" | "bed1" | "bed2" | "bed3";

const S = { stroke: "var(--color-ink)", strokeWidth: 1.6, fill: "none", strokeLinecap: "round" as const, strokeLinejoin: "round" as const };

function Person({ x, fill }: { x: number; fill: string }) {
  return (
    <g>
      <circle cx={x} cy={22} r={6} {...S} fill={fill} />
      <path d={`M${x - 10} 50c0-8 4.5-14 10-14s10 6 10 14`} {...S} fill={fill} />
    </g>
  );
}

export default function Illustration({ name, className = "" }: { name: Name; className?: string }) {
  const sage = "#dfe5d2";
  const sand = "#efe6d2";
  const rose = "#f2dcd9";
  const body = (() => {
    switch (name) {
      case "one":
        return <Person x={40} fill={sage} />;
      case "two":
        return (<><Person x={30} fill={sage} /><Person x={50} fill={rose} /></>);
      case "three":
        return (<><Person x={22} fill={sage} /><Person x={40} fill={rose} /><Person x={58} fill={sand} /></>);
      case "four":
        return (<><Person x={18} fill={sage} /><Person x={34} fill={rose} /><Person x={50} fill={sand} /><g transform="translate(64 10) scale(.7)"><Person x={0} fill={sage} /></g></>);
      case "noPet":
        return (<><circle cx={40} cy={32} r={16} {...S} fill={sand} /><path d="M29 43l22-22" {...S} /></>);
      case "cat":
        return (<><path d="M24 50c0-12 7-20 16-20s16 8 16 20Z" {...S} fill={sand} /><path d="M30 31l-2-11 8 6M50 31l2-11-8 6" {...S} fill={sand} /><circle cx={35} cy={38} r={1.2} fill="var(--color-ink)" /><circle cx={45} cy={38} r={1.2} fill="var(--color-ink)" /><path d="M56 48c8 0 8-10 2-10" {...S} /></>);
      case "dog":
        return (<><path d="M26 50c0-12 6-20 14-20s14 8 14 20Z" {...S} fill={sage} /><path d="M28 32c-6 2-8 10-4 14M52 32c6 2 8 10 4 14" {...S} fill={sage} /><circle cx={36} cy={38} r={1.2} fill="var(--color-ink)" /><circle cx={44} cy={38} r={1.2} fill="var(--color-ink)" /><path d="M38 44h4" {...S} /></>);
      case "apartment":
        return (<><rect x={24} y={12} width={32} height={40} rx={2} {...S} fill={sand} />{[0, 1, 2].map((r) => [0, 1].map((c) => <rect key={`${r}${c}`} x={30 + c * 12} y={18 + r * 10} width={7} height={6} {...S} fill="#fff" />))}<path d="M36 52v-8h8v8" {...S} /></>);
      case "house":
        return (<><path d="M18 32L40 14l22 18" {...S} /><path d="M23 29v23h34V29" {...S} fill={rose} /><path d="M36 52V40h8v12" {...S} fill="#fff" /><rect x={48} y={34} width={6} height={6} {...S} fill="#fff" /></>);
      case "condo":
        return (<><rect x={30} y={6} width={20} height={46} rx={2} {...S} fill={sage} />{[0, 1, 2, 3, 4].map((r) => <path key={r} d={`M34 ${13 + r * 8}h12`} {...S} />)}<path d="M14 52h52" {...S} /><path d="M58 52c0-10 6-14 6-14M58 40c-3-2-7-1-8 1" {...S} /></>);
      case "any":
        return (<><circle cx={40} cy={32} r={18} {...S} fill={sand} /><path d="M33 26c0-4 3-6 7-6s7 2 7 6c0 5-7 5-7 10M40 42v1" {...S} /></>);
      case "studio":
      case "bed1":
      case "bed2":
      case "bed3": {
        const n = name === "studio" ? 0 : Number(name.slice(3));
        return (<><path d="M14 46V28M14 38h52v8M66 46V34" {...S} /><rect x={18} y={30} width={10} height={8} rx={2} {...S} fill={sage} /><path d="M30 38v-4h34" {...S} fill={sand} />{n > 0 && <text x={40} y={22} textAnchor="middle" fontSize="12" fill="var(--color-ink)" fontFamily="var(--font-sans)">{n === 3 ? "3+" : n}</text>}{n === 0 && <path d="M30 22h20" {...S} />}</>);
      }
    }
  })();
  return (
    <svg viewBox="0 0 80 60" className={className} aria-hidden>
      {body}
    </svg>
  );
}

export type { Name as IllustrationName };
