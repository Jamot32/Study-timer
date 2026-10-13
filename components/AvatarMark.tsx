import React from 'react';
import { Circle, Ellipse, Path, Svg } from 'react-native-svg';
import { AVATARS } from '@/lib/profile';

const LEGACY_AVATARS: Record<string, (typeof AVATARS)[number]> = {
  '🐱': 'cat',
  '🐈': 'cat',
  '🦊': 'fox',
  '🐸': 'frog',
  '🐧': 'penguin',
  '🦉': 'owl',
  '🦇': 'owl',
  '👾': 'alien',
  '🌙': 'moon',
  '⭐': 'star',
};

export function avatarId(avatar?: string): (typeof AVATARS)[number] {
  return AVATARS.find((id) => id === avatar) ?? LEGACY_AVATARS[avatar ?? ''] ?? 'owl';
}

/** Compact, scalable mascot artwork shared by profile, battle, and rank views. */
export function AvatarMark({ avatar, size }: { avatar?: string; size: number }) {
  const id = avatarId(avatar);

  return (
    <Svg width={size} height={size} viewBox="0 0 100 100">
      {id === 'cat' ? (
        <>
          <Path d="M19 45 22 13 43 31Q50 28 57 31L78 13 81 45Q88 54 83 69 75 88 50 88 25 88 17 69 12 54 19 45Z" fill="#D98B59" />
          <Path d="m30 24 2 18 12-10Zm40 0-2 18-12-10Z" fill="#F2C4A2" />
          <Ellipse cx="37" cy="55" rx="4" ry="6" fill="#332A26" />
          <Ellipse cx="63" cy="55" rx="4" ry="6" fill="#332A26" />
          <Path d="m46 65 4-3 4 3-4 4Z" fill="#9E5948" />
          <Path d="M50 69q-5 7-11 1m11-1q5 7 11 1M24 64 40 66m-16 4 16-1m36-5-16 2m16 4-16-1" fill="none" stroke="#6A4537" strokeWidth="2.5" strokeLinecap="round" />
        </>
      ) : null}
      {id === 'fox' ? (
        <>
          <Path d="M17 49 22 10 45 30Q50 28 55 30L78 10 83 49Q84 78 50 90 16 78 17 49Z" fill="#E4773D" />
          <Path d="m29 23 4 22 10-13Zm42 0-4 22-10-13Z" fill="#F8D9B5" />
          <Path d="M25 57q4-13 17-9l8 13 8-13q13-4 17 9-3 20-25 23-22-3-25-23Z" fill="#FFF0D9" />
          <Ellipse cx="39" cy="51" rx="3.5" ry="5" fill="#342A28" />
          <Ellipse cx="61" cy="51" rx="3.5" ry="5" fill="#342A28" />
          <Path d="m46 65 4-3 4 3-4 4Z" fill="#654138" />
        </>
      ) : null}
      {id === 'frog' ? (
        <>
          <Path d="M16 48Q16 36 28 36h44q12 0 12 12v20Q78 87 50 87 22 87 16 68Z" fill="#67A66C" />
          <Circle cx="32" cy="38" r="16" fill="#78B979" />
          <Circle cx="68" cy="38" r="16" fill="#78B979" />
          <Circle cx="33" cy="38" r="8" fill="#F8F1D9" />
          <Circle cx="67" cy="38" r="8" fill="#F8F1D9" />
          <Circle cx="35" cy="39" r="3.5" fill="#28362D" />
          <Circle cx="65" cy="39" r="3.5" fill="#28362D" />
          <Path d="M34 65q16 15 32 0" fill="none" stroke="#315D3B" strokeWidth="4" strokeLinecap="round" />
          <Circle cx="24" cy="62" r="5" fill="#9BCD82" />
          <Circle cx="76" cy="62" r="5" fill="#9BCD82" />
        </>
      ) : null}
      {id === 'penguin' ? (
        <>
          <Path d="M50 12Q22 12 20 48l-6 21q-2 13 10 10l12-7q14 9 28 0l12 7q12 3 10-10l-6-21Q78 12 50 12Z" fill="#455867" />
          <Ellipse cx="50" cy="58" rx="22" ry="27" fill="#F7F1E3" />
          <Circle cx="40" cy="42" r="4" fill="#27343C" />
          <Circle cx="60" cy="42" r="4" fill="#27343C" />
          <Path d="m43 50 7-3 7 3-7 8Z" fill="#E9A844" />
          <Path d="M40 77q10 6 20 0" fill="none" stroke="#D8993C" strokeWidth="5" strokeLinecap="round" />
        </>
      ) : null}
      {id === 'owl' ? (
        <>
          <Path d="m17 40 5-25 20 16q8-3 16 0l20-16 5 25q9 37-33 51Q8 77 17 40Z" fill="#9B7054" />
          <Path d="M21 25 35 36 27 39Zm58 0L65 36l8 3Z" fill="#E7C28D" />
          <Circle cx="37" cy="50" r="13" fill="#F5E7C6" />
          <Circle cx="63" cy="50" r="13" fill="#F5E7C6" />
          <Circle cx="39" cy="51" r="5" fill="#43352D" />
          <Circle cx="61" cy="51" r="5" fill="#43352D" />
          <Path d="m45 64 5-7 5 7-5 6Z" fill="#D99A45" />
          <Path d="M32 78q18 7 36 0" fill="none" stroke="#C59A6B" strokeWidth="4" strokeLinecap="round" />
        </>
      ) : null}
      {id === 'alien' ? (
        <>
          <Path d="M50 13v12m0-12-9-7m9 7 9-7" fill="none" stroke="#9472B5" strokeWidth="5" strokeLinecap="round" />
          <Circle cx="41" cy="6" r="4" fill="#F0C978" />
          <Circle cx="59" cy="6" r="4" fill="#F0C978" />
          <Ellipse cx="50" cy="55" rx="34" ry="37" fill="#9273B3" />
          <Ellipse cx="36" cy="52" rx="7" ry="11" fill="#30283C" />
          <Ellipse cx="64" cy="52" rx="7" ry="11" fill="#30283C" />
          <Circle cx="34" cy="48" r="2.5" fill="#F7F0DC" />
          <Circle cx="62" cy="48" r="2.5" fill="#F7F0DC" />
          <Path d="M42 72q8 6 16 0" fill="none" stroke="#59466E" strokeWidth="3" strokeLinecap="round" />
          <Circle cx="23" cy="67" r="4" fill="#B89CCF" />
          <Circle cx="77" cy="67" r="4" fill="#B89CCF" />
        </>
      ) : null}
      {id === 'moon' ? (
        <>
          <Path d="M65 13Q32 16 32 49t33 37Q37 95 19 75 0 53 17 28 34 5 65 13Z" fill="#E4B65E" />
          <Path d="m70 25 3 7 7 3-7 3-3 7-3-7-7-3 7-3Zm-22 37 2 5 5 2-5 2-2 5-2-5-5-2 5-2Zm29 4 2 4 4 2-4 1-2 5-1-5-5-1 5-2Z" fill="#F4D99E" />
        </>
      ) : null}
      {id === 'star' ? (
        <>
          <Path d="m50 8 12 27 29 3-22 19 7 29-26-16-26 16 7-29L9 38l29-3Z" fill="#E9B84F" stroke="#C98D35" strokeWidth="3" strokeLinejoin="round" />
          <Ellipse cx="40" cy="49" rx="3.5" ry="5" fill="#49372A" />
          <Ellipse cx="60" cy="49" rx="3.5" ry="5" fill="#49372A" />
          <Path d="M42 62q8 8 16 0" fill="none" stroke="#8A5932" strokeWidth="3" strokeLinecap="round" />
          <Circle cx="31" cy="59" r="4" fill="#F5D587" />
          <Circle cx="69" cy="59" r="4" fill="#F5D587" />
        </>
      ) : null}
    </Svg>
  );
}
