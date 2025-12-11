import { Preset } from './types';

export const SUPPORTED_FORMATS = {
  'image/png': 'PNG',
  'image/jpeg': 'JPEG',
  'image/webp': 'WebP',
  'image/avif': 'AVIF',
};

export const PRESETS: Preset[] = [
  // Formats
  { id: 'fmt-webp', label: 'Convert to WebP', category: 'format', options: { format: 'image/webp', quality: 0.8 } },
  { id: 'fmt-avif', label: 'Convert to AVIF', category: 'format', options: { format: 'image/avif', quality: 0.8 } },
  { id: 'fmt-jpg-small', label: 'Low Quality JPG', category: 'format', options: { format: 'image/jpeg', quality: 0.5 } },
  
  // Icons & Favicons
  { id: 'icon-16', label: 'Favicon 16x16', category: 'icon', options: { width: 16, height: 16, fit: 'contain', format: 'image/png' } },
  { id: 'icon-32', label: 'Favicon 32x32', category: 'icon', options: { width: 32, height: 32, fit: 'contain', format: 'image/png' } },
  { id: 'icon-192', label: 'PWA 192', category: 'icon', options: { width: 192, height: 192, fit: 'cover', format: 'image/png' } },
  { id: 'icon-512', label: 'PWA 512', category: 'icon', options: { width: 512, height: 512, fit: 'cover', format: 'image/png' } },
  { id: 'apple-180', label: 'Apple Touch 180', category: 'icon', options: { width: 180, height: 180, fit: 'cover', mask: 'square', format: 'image/png' } },
  { id: 'slack-emoji', label: 'Slack/Discord Emoji', category: 'icon', options: { width: 128, height: 128, fit: 'contain', format: 'image/png' } },

  // Social
  { id: 'og-image', label: 'OG Image (1200x630)', category: 'social', options: { width: 1200, height: 630, fit: 'cover', format: 'image/jpeg', quality: 0.9 } },
  { id: 'twitter-card', label: 'Twitter Card (800x418)', category: 'social', options: { width: 800, height: 418, fit: 'cover', format: 'image/jpeg' } },
  { id: 'insta-sq', label: 'Instagram (1080px)', category: 'social', options: { width: 1080, height: 1080, fit: 'cover', format: 'image/jpeg' } },
  { id: 'story', label: 'Story (1080x1920)', category: 'social', options: { width: 1080, height: 1920, fit: 'cover', format: 'image/jpeg' } },
  { id: 'yt-thumb', label: 'YouTube Thumb (720p)', category: 'social', options: { width: 1280, height: 720, fit: 'cover', format: 'image/jpeg' } },
  { id: 'github-social', label: 'GitHub Social (1280x640)', category: 'social', options: { width: 1280, height: 640, fit: 'cover', format: 'image/png' } },

  // Dev Sizes
  { id: 'hd', label: 'Full HD 1080p', category: 'dev', options: { width: 1920, height: 1080, fit: 'contain' } },
  { id: '4k', label: '4K UHD', category: 'dev', options: { width: 3840, height: 2160, fit: 'contain' } },
  { id: 'avatar', label: 'Circle Avatar 256', category: 'dev', options: { width: 256, height: 256, fit: 'cover', mask: 'circle', format: 'image/png' } },
  { id: 'thumb', label: 'Thumbnail 400w', category: 'dev', options: { width: 400 } }, // Height auto
  { id: 'email-banner', label: 'Email Header 600w', category: 'dev', options: { width: 600 } },
  { id: 'hero-sm', label: 'Hero Mobile 480w', category: 'dev', options: { width: 480 } },
  { id: 'hero-md', label: 'Hero Tablet 768w', category: 'dev', options: { width: 768 } },
  { id: 'hero-lg', label: 'Hero Desktop 1200w', category: 'dev', options: { width: 1200 } },
];

export const MAX_FILE_SIZE_MB = 25;