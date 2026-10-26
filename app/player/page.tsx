'use client';

import React from 'react';
import dynamic from 'next/dynamic';

const VideoPlayer = dynamic(
  () => import('@/components/player/VideoPlayer').then((mod) => mod.VideoPlayer),
  {
    ssr: false,
    loading: () => (
      <div className="flex-1 flex items-center justify-center bg-black min-h-[60vh]">
        <div className="text-slate-500 text-sm font-medium">Initializing CineFlow engine...</div>
      </div>
    ),
  }
);

export default function PlayerPage() {
  return (
    <div className="player-page flex-1 flex flex-col w-full bg-black min-h-0">
      <VideoPlayer />
    </div>
  );
}
