export default function GuitarDiagram({ chord }) {
  const shapes = {
    Am: [[-1, 0, 2, 2, 1, 0]], C: [[-1, 3, 2, 0, 1, 0]], G: [[3, 2, 0, 0, 0, 3]], F: [[1, 3, 3, 2, 1, 1]],
    Dm: [[-1, -1, 0, 2, 3, 1]], Em: [[0, 2, 2, 0, 0, 0]], D: [[-1, -1, 0, 2, 3, 2]], E: [[0, 2, 2, 1, 0, 0]],
    A: [[-1, 0, 2, 2, 2, 0]], B: [[-1, 2, 4, 4, 4, 2]],
  };
  const frets = shapes[chord]?.[0];
  if (!frets) return null;
  return (
    <div className="mt-4 flex justify-center gap-1">
      {frets.map((f, i) => (
        <div key={`string-${i}`} className="flex flex-col items-center gap-1">
          <span className="text-[8px] text-[#5C5C6B]">{f === -1 ? "x" : f === 0 ? "o" : ""}</span>
          {[1, 2, 3, 4].map((pos) => (
            <div key={pos} className={`w-4 h-4 rounded-full border ${f === pos ? "bg-[#FF6B00] border-[#FF6B00] shadow-[0_0_8px_rgba(255,107,0,0.5)]" : "border-white/10"}`} />
          ))}
        </div>
      ))}
    </div>
  );
}
