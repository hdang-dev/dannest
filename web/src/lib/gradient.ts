// A stable gradient per collection, derived from its id — so the same collection
// always looks the same without the backend storing any colors.

const GRADIENTS: [string, string][] = [
  ["#f59e0b", "#ef4444"],
  ["#b45309", "#78350f"],
  ["#7c3aed", "#ec4899"],
  ["#16a34a", "#65a30d"],
  ["#0ea5e9", "#6366f1"],
  ["#134e4a", "#14b8a6"],
];

export function gradientFor(id: string): [string, string] {
  let hash = 0;
  for (let i = 0; i < id.length; i++) hash = (hash * 31 + id.charCodeAt(i)) | 0;
  return GRADIENTS[Math.abs(hash) % GRADIENTS.length];
}
