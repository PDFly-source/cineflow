'use client';

import React from 'react';
import {
  ShieldCheck,
  HardDrive,
  EyeOff,
  WifiOff,
  Lock,
  FileCheck,
  ServerOff,
  Database,
} from 'lucide-react';
import Link from 'next/link';
import { BrandHeader } from '@/components/brand/Logo';

export default function PrivacyPage() {
  const privacyPillars = [
    {
      icon: ServerOff,
      title: 'Zero Remote Servers',
      description:
        'CineFlow has no video upload servers, cloud storage buckets, or video processing microservices. Playback occurs solely within your browser’s native HTML5 media pipeline.',
    },
    {
      icon: EyeOff,
      title: 'Zero Analytics & Telemetry',
      description:
        'There are no trackers, telemetry beacons, error loggers, advertising SDKs, or third-party tracking scripts loaded into the app. Your watch habits remain strictly yours.',
    },
    {
      icon: Lock,
      title: 'No User Accounts Required',
      description:
        'You never need to log in, register, provide an email address, or create credentials. There is no central user database or identity profiling.',
    },
    {
      icon: Database,
      title: 'Isolated Local Storage',
      description:
        'Playback timestamps, subtitle styling, and custom playlists are stored exclusively in your browser’s local IndexedDB. Data never leaves your physical device.',
    },
    {
      icon: FileCheck,
      title: 'Ephemeral Memory Management',
      description:
        'Selected videos are accessed via temporary in-memory Object URLs (blob:). When you change videos or close the player, memory handles are explicitly revoked.',
    },
    {
      icon: WifiOff,
      title: 'Offline-First Progressive Web App',
      description:
        'The application shell is cached on your device via standard service workers. CineFlow can be opened and used on airplanes, remote trips, and offline environments.',
    },
  ];

  return (
    <div className="flex-1 max-w-5xl w-full mx-auto px-4 sm:px-6 lg:px-8 py-4 sm:py-6 space-y-6">
      <BrandHeader className="md:hidden" />

      {/* Header */}
      <div className="space-y-3 pb-6 border-b border-slate-800">
        <div className="flex items-center gap-2 text-xs font-semibold uppercase tracking-wider text-cyan-400">
          <ShieldCheck className="w-4 h-4" />
          <span>Privacy Guarantee</span>
        </div>
        <h1 className="text-3xl sm:text-4xl font-extrabold tracking-tight text-white">
          Privacy by Architecture, Not Just Policy
        </h1>
        <p className="text-sm sm:text-base text-slate-300 leading-relaxed max-w-3xl">
          Most modern media apps demand accounts, stream over clouds, and harvest viewing metadata.
          CineFlow is engineered on the opposite premise: your media stays strictly on your device.
        </p>
      </div>

      {/* Pillars Grid */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-5">
        {privacyPillars.map((pillar, i) => {
          const Icon = pillar.icon;
          return (
            <div
              key={i}
              className="p-5 sm:p-6 rounded-2xl bg-slate-900 border border-slate-800 space-y-3 hover:border-slate-700 transition"
            >
              <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-indigo-600/10 text-indigo-400 border border-indigo-500/20">
                <Icon className="w-5 h-5" />
              </div>
              <h2 className="text-base font-semibold text-white">{pillar.title}</h2>
              <p className="text-xs text-slate-400 leading-relaxed">{pillar.description}</p>
            </div>
          );
        })}
      </div>

      {/* Honest Browser Security Context */}
      <section className="rounded-2xl bg-slate-900/60 border border-slate-800 p-6 sm:p-8 space-y-4">
        <h2 className="text-lg font-bold text-white tracking-tight">
          Understanding Browser Security &amp; Local Media Access
        </h2>
        <div className="text-xs text-slate-300 space-y-3 leading-relaxed">
          <p>
            Modern web browsers enforce strict security sandboxes to protect user safety.
            A browser application cannot unilaterally scan your entire hard drive or mobile filesystem without your explicit permission.
          </p>
          <p>
            When you select a video using CineFlow&apos;s file picker, the browser supplies an isolated <code className="text-indigo-300 font-mono">File</code> object reference to CineFlow for the duration of that session.
            When you reload the page or return later, browser security intentionally resets that file reference.
            That is why CineFlow asks you to choose the file again when resuming a saved playlist or history item.
          </p>
          <p>
            We adhere to these browser standards honestly, without pretending to have system-wide file access that web applications cannot securely possess.
          </p>
        </div>
      </section>

      {/* User Data Controls */}
      <section className="rounded-2xl bg-slate-900 border border-slate-800 p-6 sm:p-8 flex flex-col sm:flex-row sm:items-center justify-between gap-6">
        <div>
          <h2 className="text-base font-bold text-white">Full User Control of Stored Data</h2>
          <p className="text-xs text-slate-400 mt-1 max-w-xl">
            You can inspect your storage usage, export a full JSON backup of your playlists and history, or permanently wipe all local database records anytime.
          </p>
        </div>

        <Link
          href="/settings"
          className="px-5 py-2.5 rounded-xl bg-indigo-600 hover:bg-indigo-500 text-xs font-semibold text-white transition self-start sm:self-auto shrink-0 shadow-sm"
        >
          Manage Data in Settings
        </Link>
      </section>
    </div>
  );
}
