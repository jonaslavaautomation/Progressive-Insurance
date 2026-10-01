// The LAVA logo for generated documents (PDFs and the ID card image). Loaded once from /public
// and cached; documents still generate without it if it can't be loaded.
export const LOGO_URL = '/lava-logo.png';
/** Width / height of public/lava-logo.png (1124 x 352). */
export const LOGO_RATIO = 1124 / 352;

let dataUrl: Promise<string | null> | null = null;
let image: Promise<HTMLImageElement | null> | null = null;

export function loadLogoDataUrl(): Promise<string | null> {
  dataUrl ??= fetch(LOGO_URL)
    .then((response) => (response.ok ? response.blob() : Promise.reject(new Error('logo'))))
    .then((blob) => new Promise<string | null>((resolve) => { const reader = new FileReader(); reader.onload = () => resolve(String(reader.result)); reader.onerror = () => resolve(null); reader.readAsDataURL(blob); }))
    .catch(() => null);
  return dataUrl;
}

export function loadLogoImage(): Promise<HTMLImageElement | null> {
  image ??= new Promise((resolve) => { const img = new Image(); img.onload = () => resolve(img); img.onerror = () => resolve(null); img.src = LOGO_URL; });
  return image;
}
