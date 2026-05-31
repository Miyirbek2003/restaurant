export const PLACEHOLDER_MENU_IMAGE = '/placeholder-food.svg';

export function resolveImageUrl(url: string | null | undefined): string {
  if (url?.trim()) return url.trim();
  return PLACEHOLDER_MENU_IMAGE;
}
