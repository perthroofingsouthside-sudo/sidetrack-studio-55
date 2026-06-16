/* GamerAvatar — composable Bitmoji-style SVG character built from layered parts.
   Used by the Profile page and the Creation Lab modal. */

export const SKIN_TONES = [
  { key: "light",  name: "Light",  fill: "#F4D7BB", shade: "#D9B894" },
  { key: "warm",   name: "Warm",   fill: "#E8B790", shade: "#C99873" },
  { key: "tan",    name: "Tan",    fill: "#C68A5F", shade: "#A66E47" },
  { key: "brown",  name: "Brown",  fill: "#8C5A36", shade: "#6F4423" },
  { key: "deep",   name: "Deep",   fill: "#553421", shade: "#3E2415" },
];

export const HAIR_STYLES = ["short", "curly", "long", "buzz", "mohawk", "hidden"];
export const HAIR_COLORS = ["#1A1A1A", "#5B3A1E", "#E0C277", "#B33E33", "#FF4FB1", "#39FF14"];

export const TOP_STYLES = [
  { key: "hoodie", name: "Hoodie" },
  { key: "tee",    name: "Tee" },
  { key: "jacket", name: "Jacket" },
  { key: "vest",   name: "Vest" },
];
export const TOP_COLORS = ["#FF6B00", "#39FF14", "#1A1A1A", "#FFFFFF", "#B57BFF", "#FF4FB1"];

export const CAPS = [
  { key: "none", name: "None" },
  { key: "cap",  name: "Cap" },
  { key: "beanie", name: "Beanie" },
];
export const CAP_COLORS = ["#FF6B00", "#39FF14", "#1A1A1A", "#FFFFFF"];

export const INSTRUMENTS = [
  { key: "guitar", name: "Guitar" },
  { key: "bass",   name: "Bass" },
  { key: "drums",  name: "Drums" },
  { key: "mic",    name: "Mic" },
  { key: "keys",   name: "Keys" },
  { key: "dj",     name: "DJ" },
];

export const FACES = ["cool", "smile", "wow"];

export const DEFAULT_GAMER_AVATAR = {
  skin: "warm",
  hair: "short",
  hairColor: "#1A1A1A",
  face: "cool",
  cap: "cap",
  capColor: "#FF6B00",
  top: "hoodie",
  topColor: "#FF6B00",
  instrument: "guitar",
  // Legacy fields for back-compat with old icon+palette avatars
  icon: undefined,
  palette: undefined,
};

const skinByKey = (k) => SKIN_TONES.find((s) => s.key === k) || SKIN_TONES[1];

// Hair shape components (relative to a head centered at cx=120, head radius ≈ 56)
function HairShort({ color }) {
  return <path d="M64 92 Q70 50 120 46 Q170 50 176 92 Q176 78 160 70 Q140 60 120 60 Q100 60 80 70 Q64 78 64 92 Z" fill={color} />;
}
function HairCurly({ color }) {
  return (
    <g fill={color}>
      <circle cx="80" cy="78" r="14" /><circle cx="98" cy="62" r="14" /><circle cx="120" cy="56" r="15" />
      <circle cx="142" cy="62" r="14" /><circle cx="160" cy="78" r="14" /><circle cx="72" cy="96" r="10" />
      <circle cx="168" cy="96" r="10" />
    </g>
  );
}
function HairLong({ color }) {
  return (
    <g fill={color}>
      <path d="M62 90 Q66 50 120 46 Q174 50 178 90 L178 150 L168 152 L168 100 Q160 80 120 80 Q80 80 72 100 L72 152 L62 150 Z" />
    </g>
  );
}
function HairBuzz({ color }) {
  return <path d="M70 92 Q76 64 120 60 Q164 64 170 92 Q170 84 160 80 Q140 74 120 74 Q100 74 80 80 Q70 84 70 92 Z" fill={color} opacity="0.85" />;
}
function HairMohawk({ color }) {
  return (
    <g fill={color}>
      <rect x="108" y="42" width="24" height="48" rx="4" />
      <path d="M70 96 Q90 90 108 90 L108 100 Q90 102 70 110 Z" opacity="0.7" />
      <path d="M170 96 Q150 90 132 90 L132 100 Q150 102 170 110 Z" opacity="0.7" />
    </g>
  );
}
function HairHidden() { return null; }

const HAIR_MAP = { short: HairShort, curly: HairCurly, long: HairLong, buzz: HairBuzz, mohawk: HairMohawk, hidden: HairHidden };

// Face expressions — eyes + mouth at cx=120 cy=128 (head center)
function FaceCool({ skin }) {
  return (
    <g>
      {/* Sunglasses */}
      <rect x="84" y="116" width="34" height="14" rx="6" fill="#0A0A0F" />
      <rect x="122" y="116" width="34" height="14" rx="6" fill="#0A0A0F" />
      <rect x="115" y="121" width="10" height="3" fill="#0A0A0F" />
      <rect x="86" y="118" width="6" height="3" fill="#39FF14" opacity="0.7" />
      <rect x="124" y="118" width="6" height="3" fill="#FF6B00" opacity="0.7" />
      {/* Mouth — slight smirk */}
      <path d="M108 152 Q120 158 132 152" stroke={skin.shade} strokeWidth="3" fill="none" strokeLinecap="round" />
    </g>
  );
}
function FaceSmile({ skin }) {
  return (
    <g>
      <circle cx="100" cy="124" r="3.5" fill="#0A0A0F" />
      <circle cx="140" cy="124" r="3.5" fill="#0A0A0F" />
      <path d="M100 150 Q120 162 140 150" stroke={skin.shade} strokeWidth="3.5" fill="none" strokeLinecap="round" />
    </g>
  );
}
function FaceWow({ skin }) {
  return (
    <g>
      {/* Wide-open eyes */}
      <circle cx="100" cy="124" r="5" fill="#FFFFFF" stroke="#0A0A0F" strokeWidth="1.5" />
      <circle cx="100" cy="124" r="2.5" fill="#0A0A0F" />
      <circle cx="140" cy="124" r="5" fill="#FFFFFF" stroke="#0A0A0F" strokeWidth="1.5" />
      <circle cx="140" cy="124" r="2.5" fill="#0A0A0F" />
      {/* Open-mouth "wow" */}
      <ellipse cx="120" cy="154" rx="6" ry="8" fill={skin.shade} opacity="0.5" />
      <ellipse cx="120" cy="154" rx="3" ry="5" fill="#0A0A0F" />
    </g>
  );
}
const FACE_MAP = { cool: FaceCool, smile: FaceSmile, wow: FaceWow };

// Cap shapes
function CapBaseball({ color }) {
  return (
    <g>
      <path d="M64 92 Q70 50 120 46 Q170 50 176 92 Q176 80 160 74 Q140 66 120 66 Q100 66 80 74 Q64 80 64 92 Z" fill={color} />
      <path d="M70 92 Q60 100 50 102 L52 110 Q70 102 80 96 Z" fill={color} opacity="0.92" />
      {/* Logo */}
      <text x="120" y="78" textAnchor="middle" fontSize="13" fontFamily="Outfit, sans-serif" fontWeight="900" fill="#FFFFFF">PP</text>
    </g>
  );
}
function CapBeanie({ color }) {
  return (
    <g>
      <path d="M66 96 Q72 52 120 48 Q168 52 174 96 L174 104 Q150 100 120 100 Q90 100 66 104 Z" fill={color} />
      <rect x="66" y="100" width="108" height="10" rx="4" fill={color} opacity="0.7" />
      <circle cx="120" cy="44" r="6" fill={color} />
      <circle cx="120" cy="44" r="3" fill={color} opacity="0.7" />
    </g>
  );
}
const CAP_MAP = { none: null, cap: CapBaseball, beanie: CapBeanie };

// Top (clothing) shapes — drawn from y=190 down
function TopHoodie({ color }) {
  return (
    <g>
      {/* Hoodie body */}
      <path d="M58 230 Q60 200 88 190 L152 190 Q180 200 182 230 L182 320 L58 320 Z" fill={color} />
      {/* Hood */}
      <path d="M88 190 Q86 168 120 168 Q154 168 152 190 Q140 192 120 192 Q100 192 88 190 Z" fill={color} opacity="0.85" />
      {/* Front pouch */}
      <path d="M90 260 Q120 252 150 260 L150 290 Q120 286 90 290 Z" fill={color} opacity="0.78" />
      {/* Drawstrings */}
      <line x1="108" y1="190" x2="106" y2="220" stroke="#FFFFFF" strokeWidth="2" />
      <line x1="132" y1="190" x2="134" y2="220" stroke="#FFFFFF" strokeWidth="2" />
      <circle cx="106" cy="222" r="2.5" fill="#FFFFFF" /><circle cx="134" cy="222" r="2.5" fill="#FFFFFF" />
    </g>
  );
}
function TopTee({ color }) {
  return (
    <g>
      <path d="M60 220 L92 192 Q120 200 148 192 L180 220 L168 232 L162 218 L162 320 L78 320 L78 218 L72 232 Z" fill={color} />
      {/* Neckline */}
      <path d="M100 192 Q120 204 140 192" stroke="#FFFFFF" strokeWidth="1.5" fill="none" opacity="0.6" />
    </g>
  );
}
function TopJacket({ color }) {
  return (
    <g>
      <path d="M58 218 Q60 198 88 190 L152 190 Q180 198 182 218 L182 320 L58 320 Z" fill={color} />
      {/* Collar / zipper */}
      <path d="M88 192 L118 220 L122 220 L152 192" stroke="#FFFFFF" strokeWidth="2" fill="none" opacity="0.85" />
      <line x1="120" y1="220" x2="120" y2="318" stroke="#FFFFFF" strokeWidth="1.5" opacity="0.6" />
      <path d="M88 190 L82 220" stroke="#FFFFFF" strokeWidth="2" opacity="0.85" />
      <path d="M152 190 L158 220" stroke="#FFFFFF" strokeWidth="2" opacity="0.85" />
    </g>
  );
}
function TopVest({ color }) {
  return (
    <g>
      <path d="M68 218 L100 192 Q120 196 140 192 L172 218 L172 320 L68 320 Z" fill={color} />
      <path d="M100 192 L100 320" stroke="#0A0A0F" strokeWidth="2" opacity="0.4" />
      <path d="M140 192 L140 320" stroke="#0A0A0F" strokeWidth="2" opacity="0.4" />
    </g>
  );
}
const TOP_MAP = { hoodie: TopHoodie, tee: TopTee, jacket: TopJacket, vest: TopVest };

// Signature instrument — drawn at bottom right of the avatar canvas
function InstGuitar() {
  return (
    <g transform="translate(160, 232) rotate(-25)">
      <ellipse cx="0" cy="40" rx="22" ry="28" fill="#FF6B00" />
      <ellipse cx="0" cy="40" rx="22" ry="28" fill="none" stroke="#0A0A0F" strokeWidth="1.5" />
      <circle cx="0" cy="38" r="6" fill="#0A0A0F" />
      <rect x="-3" y="-30" width="6" height="40" fill="#3E2415" />
      <rect x="-5" y="-36" width="10" height="6" fill="#0A0A0F" />
    </g>
  );
}
function InstBass() {
  return (
    <g transform="translate(160, 232) rotate(-22)">
      <ellipse cx="0" cy="42" rx="24" ry="32" fill="#39FF14" />
      <ellipse cx="0" cy="42" rx="24" ry="32" fill="none" stroke="#0A0A0F" strokeWidth="1.5" />
      <circle cx="0" cy="40" r="5" fill="#0A0A0F" />
      <rect x="-3" y="-30" width="6" height="42" fill="#3E2415" />
    </g>
  );
}
function InstMic() {
  return (
    <g transform="translate(170, 240)">
      <rect x="-4" y="0" width="8" height="40" rx="2" fill="#1A1A1A" />
      <circle cx="0" cy="-2" r="10" fill="#C0C0C0" stroke="#0A0A0F" strokeWidth="1.5" />
      <path d="M-7 -2 Q0 -10 7 -2" stroke="#0A0A0F" strokeWidth="1" fill="none" />
      <circle cx="0" cy="-2" r="3" fill="#FF6B00" />
    </g>
  );
}
function InstDrums() {
  return (
    <g transform="translate(165, 236)">
      <ellipse cx="0" cy="20" rx="18" ry="6" fill="#0A0A0F" />
      <rect x="-18" y="0" width="36" height="22" fill="#FF6B00" />
      <ellipse cx="0" cy="0" rx="18" ry="6" fill="#39FF14" />
      <ellipse cx="0" cy="0" rx="18" ry="6" fill="none" stroke="#0A0A0F" strokeWidth="1.5" />
    </g>
  );
}
function InstKeys() {
  return (
    <g transform="translate(150, 248) rotate(-8)">
      <rect x="0" y="0" width="56" height="14" rx="2" fill="#FFFFFF" stroke="#0A0A0F" strokeWidth="1.5" />
      {[8, 16, 28, 36, 44].map((x) => (
        <rect key={`bk-${x}`} x={x} y="0" width="6" height="9" fill="#0A0A0F" />
      ))}
    </g>
  );
}
function InstDJ() {
  return (
    <g transform="translate(158, 240)">
      <circle cx="0" cy="0" r="20" fill="#1A1A1A" stroke="#39FF14" strokeWidth="2" />
      <circle cx="0" cy="0" r="6" fill="#FF6B00" />
      <circle cx="0" cy="0" r="2" fill="#0A0A0F" />
    </g>
  );
}
const INST_MAP = { guitar: InstGuitar, bass: InstBass, mic: InstMic, drums: InstDrums, keys: InstKeys, dj: InstDJ };

/**
 * The avatar character itself. `size` controls overall scale.
 * `glowColor` paints the radial background halo.
 */
export default function GamerAvatar({ avatar, size = 200, glowColor = "#FF6B00", showInstrument = true }) {
  const a = { ...DEFAULT_GAMER_AVATAR, ...(avatar || {}) };
  const skin = skinByKey(a.skin);
  const HairC = HAIR_MAP[a.hair] || HairShort;
  const FaceC = FACE_MAP[a.face] || FaceCool;
  const CapC = CAP_MAP[a.cap] || null;
  const TopC = TOP_MAP[a.top] || TopHoodie;
  const InstC = INST_MAP[a.instrument] || InstGuitar;

  return (
    <svg width={size} height={size} viewBox="0 0 240 320" xmlns="http://www.w3.org/2000/svg" data-testid="gamer-avatar-svg">
      <defs>
        <radialGradient id="glow" cx="50%" cy="40%" r="60%">
          <stop offset="0%" stopColor={glowColor} stopOpacity="0.45" />
          <stop offset="60%" stopColor={glowColor} stopOpacity="0.08" />
          <stop offset="100%" stopColor={glowColor} stopOpacity="0" />
        </radialGradient>
      </defs>

      {/* Halo backdrop */}
      <rect x="0" y="0" width="240" height="320" fill="url(#glow)" />

      {/* TOP first (so head sits on shoulders) */}
      <TopC color={a.topColor || "#FF6B00"} />

      {/* Neck */}
      <rect x="110" y="174" width="20" height="20" fill={skin.fill} />
      <rect x="110" y="186" width="20" height="6" fill={skin.shade} opacity="0.5" />

      {/* Head */}
      <circle cx="120" cy="128" r="56" fill={skin.fill} />
      {/* Subtle face shading */}
      <ellipse cx="84" cy="138" rx="8" ry="14" fill={skin.shade} opacity="0.35" />
      <ellipse cx="156" cy="138" rx="8" ry="14" fill={skin.shade} opacity="0.35" />

      {/* Face features */}
      <FaceC skin={skin} />

      {/* Hair (if no cap) OR Cap */}
      {a.cap !== "none" && CapC
        ? <CapC color={a.capColor || "#FF6B00"} />
        : <HairC color={a.hairColor || "#1A1A1A"} />}

      {/* Hair peeking under cap (only for non-hidden hair when a cap is on) */}
      {a.cap !== "none" && a.hair !== "hidden" && a.hair !== "buzz" && (
        <g opacity="0.85">
          <path d="M72 110 Q70 132 76 144 L88 144 Q86 130 84 116 Z" fill={a.hairColor || "#1A1A1A"} />
          <path d="M168 110 Q170 132 164 144 L152 144 Q154 130 156 116 Z" fill={a.hairColor || "#1A1A1A"} />
        </g>
      )}

      {/* Signature instrument */}
      {showInstrument && <InstC />}
    </svg>
  );
}
