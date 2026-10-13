import {
  BookOpen,
  Clover,
  Coffee,
  Crown,
  Flame,
  Headphones,
  Moon,
  Snowflake,
  Target,
  Zap,
  type LucideIcon,
} from 'lucide-react-native';
import React from 'react';
import { T } from './nova';

const STICKER_ICONS: Record<string, { Icon: LucideIcon; color: string; label: string }> = {
  '⚡': { Icon: Zap, color: '#D79527', label: 'Lightning' },
  '🔥': { Icon: Flame, color: '#D95B2E', label: 'Fire' },
  '❄️': { Icon: Snowflake, color: '#4384A6', label: 'Snowflake' },
  '🍀': { Icon: Clover, color: '#4B7F52', label: 'Clover' },
  '💤': { Icon: Moon, color: '#7A6697', label: 'Sleep' },
  '🎧': { Icon: Headphones, color: '#657B91', label: 'Headphones' },
  '📚': { Icon: BookOpen, color: '#4B7F52', label: 'Books' },
  '☕': { Icon: Coffee, color: '#8C6145', label: 'Coffee' },
  '👑': { Icon: Crown, color: '#D79527', label: 'Crown' },
  '🎯': { Icon: Target, color: '#D95B2E', label: 'Target' },
};

export function stickerLabel(glyph: string): string {
  return STICKER_ICONS[glyph]?.label ?? 'Sticker';
}

export function StickerMark({ glyph, size }: { glyph: string; size: number }) {
  const { Icon, color } = STICKER_ICONS[glyph] ?? { Icon: Zap, color: T.primary };

  return <Icon size={size} color={color} strokeWidth={2.6} />;
}
