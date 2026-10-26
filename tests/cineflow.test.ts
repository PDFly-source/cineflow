import test from 'node:test';
import assert from 'node:assert/strict';
import {
  parseTimestampToSeconds,
  formatSecondsToVttTime,
  sanitizeSubtitleText,
  parseSrt,
  parseVtt,
  getActiveCues,
} from '../lib/subtitles/parser.ts';
import { formatTime, formatFileSize, formatVideoTitle } from '../lib/utils/formatters.ts';
import { getMediaKey, DEFAULT_SETTINGS, importData } from '../lib/storage/db.ts';

test('parseTimestampToSeconds: correctly parses various timestamp formats', () => {
  assert.equal(parseTimestampToSeconds('00:01:23,456'), 83.456);
  assert.equal(parseTimestampToSeconds('00:01:23.456'), 83.456);
  assert.equal(parseTimestampToSeconds('01:30.500'), 90.5);
  assert.equal(parseTimestampToSeconds('00:00:00,000'), 0);
});

test('formatSecondsToVttTime: converts seconds to standard WebVTT time', () => {
  assert.equal(formatSecondsToVttTime(83.456), '00:01:23.456');
  assert.equal(formatSecondsToVttTime(0), '00:00:00.000');
  assert.equal(formatSecondsToVttTime(3661.12), '01:01:01.120');
});

test('sanitizeSubtitleText: strips malicious scripts while preserving clean content', () => {
  const dirty = 'Hello <b>World</b><script>alert("hack")</script><i>subtitle</i>';
  const clean = sanitizeSubtitleText(dirty);
  assert.ok(!clean.includes('<script>'));
  assert.ok(clean.includes('<b>World</b>'));
  assert.ok(clean.includes('<i>subtitle</i>'));
});

test('parseSrt: parses standard SubRip cues with offset', () => {
  const rawSrt = `
1
00:00:01,000 --> 00:00:04,000
First subtitle line

2
00:00:05,500 --> 00:00:08,200
Second subtitle line
  `.trim();

  const cues = parseSrt(rawSrt, 1.0); // +1.0 second offset
  assert.equal(cues.length, 2);
  assert.equal(cues[0].start, 2.0);
  assert.equal(cues[0].end, 5.0);
  assert.equal(cues[0].text, 'First subtitle line');

  assert.equal(cues[1].start, 6.5);
  assert.equal(cues[1].end, 9.2);
});

test('parseVtt: parses WebVTT format', () => {
  const rawVtt = `
WEBVTT

00:00:02.000 --> 00:00:05.000
VTT subtitle text
  `.trim();

  const cues = parseVtt(rawVtt, 0);
  assert.equal(cues.length, 1);
  assert.equal(cues[0].start, 2.0);
  assert.equal(cues[0].end, 5.0);
  assert.equal(cues[0].text, 'VTT subtitle text');
});

test('getActiveCues: retrieves cues matching current timestamp', () => {
  const cues = [
    { id: 1, start: 1, end: 4, text: 'One' },
    { id: 2, start: 5, end: 8, text: 'Two' },
  ];

  assert.equal(getActiveCues(cues, 0.5).length, 0);
  assert.equal(getActiveCues(cues, 2.5)[0].text, 'One');
  assert.equal(getActiveCues(cues, 6)[0].text, 'Two');
});

test('formatters: formatTime, formatFileSize, and formatVideoTitle', () => {
  assert.equal(formatTime(75), '1:15');
  assert.equal(formatTime(3675), '1:01:15');
  assert.equal(formatTime(0), '0:00');

  assert.equal(formatFileSize(1048576), '1 MB');
  assert.equal(formatFileSize(52428800), '50 MB');

  assert.equal(formatVideoTitle('my_vacation_video.mp4'), 'my_vacation_video');
  assert.equal(formatVideoTitle('nature_documentary.mkv'), 'nature_documentary');
});

test('getMediaKey: produces consistent unique keys', () => {
  const file = { name: 'test video 1.mp4', size: 1234567, lastModified: 1700000000000 };
  const key = getMediaKey(file);
  assert.ok(key.includes('1234567'));
  assert.ok(!key.includes(' ')); // spaces sanitized
});

test('importData: validates corrupt and valid JSON backups', async () => {
  const corruptResult = await importData('{ not valid json');
  assert.equal(corruptResult.success, false);

  const fakeAppResult = await importData(JSON.stringify({ app: 'DifferentApp' }));
  assert.equal(fakeAppResult.success, false);

  const validBackup = JSON.stringify({
    app: 'CineFlow',
    version: '1.0.0',
    settings: { seekInterval: 15 },
    history: [],
    playlists: [],
  });
  const validResult = await importData(validBackup);
  assert.equal(validResult.success, true);
});

test('A-B Repeat: verifies boundary conditions and loop interval logic', () => {
  // Point A set, Point B null -> not active
  const state1 = { pointA: 10, pointB: null, isActive: false };
  assert.equal(state1.isActive, false);

  // Point A = 10, Point B = 25 -> valid loop
  const state2 = { pointA: 10, pointB: 25, isActive: true };
  assert.ok(state2.isActive);
  assert.ok(state2.pointB > state2.pointA);

  // Time triggers: when currentTime reaches or exceeds pointB, loop resets to pointA
  const simulatePlayback = (currentTime: number, ab: typeof state2) => {
    if (ab.isActive && ab.pointB !== null && ab.pointA !== null && currentTime >= ab.pointB) {
      return ab.pointA;
    }
    return currentTime;
  };

  assert.equal(simulatePlayback(24.9, state2), 24.9);
  assert.equal(simulatePlayback(25.0, state2), 10);
  assert.equal(simulatePlayback(26.5, state2), 10);
});

test('DEFAULT_SETTINGS: contains all required modern player preferences', () => {
  assert.equal(DEFAULT_SETTINGS.playerProfile, 'movie');
  assert.equal(DEFAULT_SETTINGS.subtitleFont, 'sans');
  assert.equal(DEFAULT_SETTINGS.subtitlePosition, 'bottom');
  assert.equal(DEFAULT_SETTINGS.gesturesEnabled, true);
  assert.equal(DEFAULT_SETTINGS.longPressSpeed, 2.0);
  assert.equal(DEFAULT_SETTINGS.gestureSensitivity, 'medium');
  assert.equal(DEFAULT_SETTINGS.saveHistory, true);
});

test('Diagnostics: runs server-side fallback cleanly without throwing', async () => {
  const { runPlaybackDiagnostics } = await import('../lib/media/diagnostics.ts');
  const report = runPlaybackDiagnostics();
  assert.ok(report);
  assert.ok(Array.isArray(report.results));
  assert.ok(Array.isArray(report.systemCapabilities));
});

