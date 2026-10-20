import type { NewsCategory } from '../types';

export const NEWS_CATEGORY_LABELS: Record<NewsCategory, string> = {
  uk: 'UK Headlines',
  world: 'World',
  technology: 'Technology',
  business: 'Business',
  science: 'Science',
};

export const ALL_NEWS_CATEGORIES = Object.keys(NEWS_CATEGORY_LABELS) as NewsCategory[];
