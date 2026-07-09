import { type ClassValue, clsx } from 'clsx'
import { twMerge } from 'tailwind-merge'

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs))
}

// TMDB poster URLs saved from search results use the small w92 rendition;
// swap in the sharper w342 for larger display surfaces. Non-TMDB URLs
// (Open Library, MangaDex, manual) pass through untouched.
export function sharpPoster(url: string | null): string | null {
  if (!url || !url.includes('image.tmdb.org')) return url
  return url.replace('/w92', '/w342')
}
