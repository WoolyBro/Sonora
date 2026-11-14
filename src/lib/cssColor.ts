/**
 * Resolves a CSS custom property (which may hold a color-mix() or an oklab
 * value) to plain sRGB, for canvas drawing. Uses a hidden probe element to get
 * the computed colour and a 1x1 canvas to convert it.
 */
export type RGB = [number, number, number];

export function createColorReader() {
  const probe = document.createElement("span");
  probe.style.display = "none";
  document.body.appendChild(probe);
  const px = document.createElement("canvas").getContext("2d", { willReadFrequently: true })!;

  const rgb = (cssVar: string, fallback: RGB): RGB => {
    probe.style.color = `var(${cssVar})`;
    const value = getComputedStyle(probe).color;
    px.clearRect(0, 0, 1, 1);
    px.fillStyle = "#000";
    px.fillStyle = value;
    px.fillRect(0, 0, 1, 1);
    const [r, g, b, a] = px.getImageData(0, 0, 1, 1).data;
    return a ? [r, g, b] : fallback;
  };

  return {
    rgb,
    /** "rgba(r,g,b,a)" for canvas styles. */
    css: (cssVar: string, alpha = 1, fallback: RGB = [120, 100, 200]) => {
      const [r, g, b] = rgb(cssVar, fallback);
      return `rgba(${r},${g},${b},${alpha})`;
    },
    dispose: () => probe.remove(),
  };
}
