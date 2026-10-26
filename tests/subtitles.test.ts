import test from 'node:test';
import assert from 'node:assert/strict';
import {
  parseSrt,
  parseVtt,
  parseSubtitleFile,
  getActiveCues,
  parseTimestampToSeconds,
} from '../lib/subtitles/parser.ts';

// Real-world SRT sample (as used by players everywhere)
const SAMPLE_SRT = `1
00:00:01,000 --> 00:00:04,000
Some light is worth the climb.

2
00:00:05,500 --> 00:00:08,250
Second line with <b>bold</b> formatting
spanning two lines.`;

// Real-world WebVTT sample
const SAMPLE_VTT = `WEBVTT

intro-cue
00:00:02.000 --> 00:00:05.000
Hello from VTT

00:10.000 --> 00:12.500
Short timestamp format`;

test('parseTimestampToSeconds: handles SRT and VTT timestamp styles', () => {
  assert.equal(parseTimestampToSeconds('00:01:23,456'), 83.456);
  assert.equal(parseTimestampToSeconds('00:01:23.456'), 83.456);
  assert.equal(parseTimestampToSeconds('01:23.456'), 83.456);
});

test('parseSrt: extracts cues, timings and multi-line text', () => {
  const cues = parseSrt(SAMPLE_SRT);
  assert.equal(cues.length, 2);
  assert.equal(cues[0].start, 1);
  assert.equal(cues[0].end, 4);
  assert.equal(cues[0].text, 'Some light is worth the climb.');
  assert.ok(cues[1].text.includes('bold'));
  assert.ok(cues[1].text.includes('\n'));
});

test('parseVtt: skips header and parses cue identifiers/settings', () => {
  const cues = parseVtt(SAMPLE_VTT);
  assert.equal(cues.length, 2);
  assert.equal(cues[0].start, 2);
  assert.equal(cues[0].end, 5);
  assert.equal(cues[1].start, 10);
});

test('parseSubtitleFile: offset shifts timing in both directions', () => {
  const shifted = parseSubtitleFile(SAMPLE_SRT, 'sample.srt', 1.5);
  assert.equal(shifted.format, 'srt');
  assert.equal(shifted.cues[0].start, 2.5);
  assert.equal(shifted.cues[1].end, 9.75);
  assert.equal(shifted.offsetSeconds, 1.5);

  const advanced = parseSubtitleFile(SAMPLE_SRT, 'sample.srt', -1);
  // Negative offsets clamp to 0 at the very start of the file
  assert.equal(advanced.cues[0].start, 0);
});

test('parseSubtitleFile: detects WEBVTT content regardless of extension', () => {
  const vtt = parseSubtitleFile(SAMPLE_VTT, 'sample.txt', 0);
  assert.equal(vtt.format, 'vtt');
  assert.equal(vtt.cues.length, 2);
});

test('parseSubtitleFile: invalid files yield zero cues (validation contract for UI errors)', () => {
  const garbage = parseSubtitleFile('this is not a subtitle file\nat all', 'broken.srt', 0);
  assert.equal(garbage.cues.length, 0);

  const empty = parseSubtitleFile('', 'empty.vtt', 0);
  assert.equal(empty.cues.length, 0);
});

test('getActiveCues: returns only cues overlapping the current time', () => {
  const cues = parseSrt(SAMPLE_SRT);
  assert.equal(getActiveCues(cues, 2).length, 1);
  assert.equal(getActiveCues(cues, 4.5).length, 0);
  assert.equal(getActiveCues(cues, 6).length, 1);
});

test('sanitize: strips script tags and javascript: URLs from cue text', () => {
  const malicious = `1
00:00:01,000 --> 00:00:02,000
<script>alert('xss')</script>Safe text <a href="javascript:alert(1)">link</a>`;
  const cues = parseSrt(malicious);
  assert.ok(!cues[0].text.includes('<script>'));
  assert.ok(!cues[0].text.includes('javascript:'));
  assert.ok(cues[0].text.includes('Safe text'));
});
