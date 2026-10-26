export interface SubtitleCue {
  id: number | string;
  start: number; // in seconds
  end: number; // in seconds
  text: string;
}

export interface ParsedSubtitle {
  format: 'srt' | 'vtt';
  cues: SubtitleCue[];
  vttBlobUrl?: string;
  originalText: string;
  offsetSeconds: number;
  fileName?: string;
}

/**
 * Parses time format: "00:01:23,456" or "00:01:23.456" or "01:23.456" into seconds.
 */
export function parseTimestampToSeconds(timeStr: string): number {
  const clean = timeStr.trim().replace(',', '.');
  const parts = clean.split(':');

  if (parts.length === 3) {
    const hours = parseFloat(parts[0]);
    const minutes = parseFloat(parts[1]);
    const seconds = parseFloat(parts[2]);
    return hours * 3600 + minutes * 60 + seconds;
  } else if (parts.length === 2) {
    const minutes = parseFloat(parts[0]);
    const seconds = parseFloat(parts[1]);
    return minutes * 60 + seconds;
  }
  return 0;
}

/**
 * Formats seconds into WebVTT timestamp: "00:01:23.456"
 */
export function formatSecondsToVttTime(totalSeconds: number): string {
  const s = Math.max(0, totalSeconds);
  const hours = Math.floor(s / 3600);
  const minutes = Math.floor((s % 3600) / 60);
  const seconds = s % 60;
  const wholeSeconds = Math.floor(seconds);
  const milliseconds = Math.min(999, Math.round((seconds - wholeSeconds) * 1000));

  const hh = hours.toString().padStart(2, '0');
  const mm = minutes.toString().padStart(2, '0');
  const ss = wholeSeconds.toString().padStart(2, '0');
  const ms = milliseconds.toString().padStart(3, '0');

  return `${hh}:${mm}:${ss}.${ms}`;
}

/**
 * Strips dangerous HTML tags while preserving basic formatting cues.
 */
export function sanitizeSubtitleText(text: string): string {
  return text
    .replace(/<script\b[^<]*(?:(?!<\/script>)<[^<]*)*<\/script>/gi, '')
    .replace(/<iframe\b[^<]*(?:(?!<\/iframe>)<[^<]*)*<\/iframe>/gi, '')
    .replace(/javascript:/gi, '')
    .replace(/on\w+="[^"]*"/gi, '');
}

/**
 * Parse an SRT formatted string into cue objects.
 */
export function parseSrt(raw: string, offsetSeconds = 0): SubtitleCue[] {
  const cues: SubtitleCue[] = [];
  // Normalize line breaks
  const normalized = raw.replace(/\r\n/g, '\n').replace(/\r/g, '\n').trim();
  const blocks = normalized.split(/\n\s*\n/);

  let idCounter = 1;

  for (const block of blocks) {
    const lines = block.trim().split('\n');
    if (lines.length < 2) continue;

    let timeLineIndex = 0;
    // Check if line 0 is a sequence index
    if (/^\d+$/.test(lines[0].trim()) && lines.length >= 3) {
      timeLineIndex = 1;
    }

    const timeLine = lines[timeLineIndex];
    if (!timeLine || !timeLine.includes('-->')) continue;

    const [startStr, endStr] = timeLine.split('-->');
    if (!startStr || !endStr) continue;

    const start = Math.max(0, parseTimestampToSeconds(startStr) + offsetSeconds);
    const end = Math.max(start, parseTimestampToSeconds(endStr) + offsetSeconds);

    const textLines = lines.slice(timeLineIndex + 1);
    const text = sanitizeSubtitleText(textLines.join('\n').trim());

    if (text) {
      cues.push({
        id: idCounter++,
        start,
        end,
        text,
      });
    }
  }

  return cues;
}

/**
 * Parse a WebVTT formatted string into cue objects.
 */
export function parseVtt(raw: string, offsetSeconds = 0): SubtitleCue[] {
  const cues: SubtitleCue[] = [];
  const normalized = raw.replace(/\r\n/g, '\n').replace(/\r/g, '\n').trim();
  const blocks = normalized.split(/\n\s*\n/);

  let idCounter = 1;

  for (const block of blocks) {
    const lines = block.trim().split('\n');
    if (lines.length === 0) continue;

    // Skip the WEBVTT header
    if (lines[0].startsWith('WEBVTT') || lines[0].startsWith('NOTE')) {
      continue;
    }

    let timeLineIndex = 0;
    if (!lines[0].includes('-->') && lines.length > 1 && lines[1].includes('-->')) {
      timeLineIndex = 1;
    }

    const timeLine = lines[timeLineIndex];
    if (!timeLine || !timeLine.includes('-->')) continue;

    const parts = timeLine.split('-->');
    const startStr = parts[0].trim();
    const endWithSettings = parts[1].trim();
    const endStr = endWithSettings.split(' ')[0];

    const start = Math.max(0, parseTimestampToSeconds(startStr) + offsetSeconds);
    const end = Math.max(start, parseTimestampToSeconds(endStr) + offsetSeconds);

    const textLines = lines.slice(timeLineIndex + 1);
    const text = sanitizeSubtitleText(textLines.join('\n').trim());

    if (text) {
      cues.push({
        id: idCounter++,
        start,
        end,
        text,
      });
    }
  }

  return cues;
}

/**
 * Converts cues into a valid WebVTT string.
 */
export function cuesToWebVttString(cues: SubtitleCue[]): string {
  let vtt = 'WEBVTT\n\n';
  for (const cue of cues) {
    const s = formatSecondsToVttTime(cue.start);
    const e = formatSecondsToVttTime(cue.end);
    vtt += `${cue.id}\n${s} --> ${e}\n${cue.text}\n\n`;
  }
  return vtt;
}

/**
 * Master parser for subtitle file (detects SRT or WebVTT)
 */
export function parseSubtitleFile(
  rawText: string,
  fileName: string,
  offsetSeconds = 0
): ParsedSubtitle {
  const isVtt = fileName.toLowerCase().endsWith('.vtt') || rawText.trim().startsWith('WEBVTT');
  const format: 'srt' | 'vtt' = isVtt ? 'vtt' : 'srt';

  const cues = isVtt ? parseVtt(rawText, offsetSeconds) : parseSrt(rawText, offsetSeconds);

  // Generate WebVTT blob url for HTML5 <track>
  const vttString = cuesToWebVttString(cues);
  let vttBlobUrl: string | undefined;

  if (typeof window !== 'undefined' && window.URL && window.Blob) {
    const blob = new Blob([vttString], { type: 'text/vtt;charset=utf-8' });
    vttBlobUrl = URL.createObjectURL(blob);
  }

  return {
    format,
    cues,
    vttBlobUrl,
    originalText: rawText,
    offsetSeconds,
    fileName,
  };
}

/**
 * Retrieves the currently active cues for a given playback time.
 */
export function getActiveCues(cues: SubtitleCue[], currentTime: number): SubtitleCue[] {
  return cues.filter((cue) => currentTime >= cue.start && currentTime <= cue.end);
}
