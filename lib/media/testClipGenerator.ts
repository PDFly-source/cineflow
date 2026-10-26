/**
 * Generates an authentic local WebM video file directly inside the browser using Canvas & MediaRecorder.
 * No network requests, zero downloads, 100% client-side generated.
 */
/**
 * Duration of the generated clip. Must comfortably exceed the player's default
 * controls auto-hide delay (3.5s) so uninterrupted playback can be verified
 * and users can exercise gestures on a real timeline.
 */
export const TEST_CLIP_DURATION_SECONDS = 8;

export async function generateTestClipFile(): Promise<File | null> {
  if (typeof window === 'undefined' || typeof MediaRecorder === 'undefined') {
    return null;
  }

  return new Promise((resolve) => {
    try {
      const width = 640;
      const height = 360;
      const canvas = document.createElement('canvas');
      canvas.width = width;
      canvas.height = height;
      const ctx = canvas.getContext('2d');
      if (!ctx) return resolve(null);

      // Create audio tone
      let audioTrack: MediaStreamTrack | null = null;
      try {
        const AudioCtx = window.AudioContext || (window as unknown as { webkitAudioContext: typeof AudioContext }).webkitAudioContext;
        if (AudioCtx) {
          const actx = new AudioCtx();
          const dest = actx.createMediaStreamDestination();
          const osc = actx.createOscillator();
          const gain = actx.createGain();
          osc.type = 'sine';
          osc.frequency.setValueAtTime(440, actx.currentTime);
          gain.gain.setValueAtTime(0.1, actx.currentTime);
          osc.connect(gain);
          gain.connect(dest);
          osc.start();
          audioTrack = dest.stream.getAudioTracks()[0] || null;
        }
      } catch {}

      const videoStream = canvas.captureStream(30);
      if (audioTrack) {
        videoStream.addTrack(audioTrack);
      }

      const mimeType = MediaRecorder.isTypeSupported('video/webm;codecs=vp9')
        ? 'video/webm;codecs=vp9'
        : MediaRecorder.isTypeSupported('video/webm')
        ? 'video/webm'
        : 'video/mp4';

      const recorder = new MediaRecorder(videoStream, { mimeType });
      const chunks: Blob[] = [];

      recorder.ondataavailable = (e) => {
        if (e.data && e.data.size > 0) chunks.push(e.data);
      };

      recorder.onstop = () => {
        const blob = new Blob(chunks, { type: mimeType });
        const file = new File([blob], 'CineFlow_Test_Clip.webm', {
          type: mimeType,
          lastModified: Date.now(),
        });
        resolve(file);
      };

      recorder.start();

      let frame = 0;
      const totalFrames = 30 * TEST_CLIP_DURATION_SECONDS; // visual progress denominator (duration is enforced by elapsed time)
      const startTime = Date.now();

      const draw = () => {
        const elapsed = (Date.now() - startTime) / 1000;
        const progress = Math.min(1, frame / totalFrames);

        // Background
        ctx.fillStyle = '#0c0f17';
        ctx.fillRect(0, 0, width, height);

        // Gradient Glow
        const grad = ctx.createRadialGradient(width / 2, height / 2, 20, width / 2, height / 2, 240);
        grad.addColorStop(0, 'rgba(99, 102, 241, 0.35)');
        grad.addColorStop(1, 'rgba(6, 182, 212, 0)');
        ctx.fillStyle = grad;
        ctx.fillRect(0, 0, width, height);

        // Outer rotating ring
        ctx.save();
        ctx.translate(width / 2, height / 2);
        ctx.rotate((frame * 2 * Math.PI) / 90);
        ctx.strokeStyle = '#6366f1';
        ctx.lineWidth = 3;
        ctx.beginPath();
        ctx.arc(0, 0, 70, 0, Math.PI * 1.5);
        ctx.stroke();
        ctx.restore();

        // Inner play triangle
        ctx.fillStyle = '#38bdf8';
        ctx.beginPath();
        const triR = 25;
        ctx.moveTo(width / 2 - triR * 0.7, height / 2 - triR);
        ctx.lineTo(width / 2 + triR * 1.1, height / 2);
        ctx.lineTo(width / 2 - triR * 0.7, height / 2 + triR);
        ctx.closePath();
        ctx.fill();

        // Text Info
        ctx.fillStyle = '#ffffff';
        ctx.font = 'bold 20px system-ui, -apple-system, sans-serif';
        ctx.textAlign = 'center';
        ctx.fillText('CineFlow Test Media Stream', width / 2, 60);

        ctx.fillStyle = '#94a3b8';
        ctx.font = '13px monospace';
        ctx.fillText(`TIME: ${elapsed.toFixed(2)}s · RESOLUTION: ${width}x${height} · 30 FPS`, width / 2, 90);

        // Status countdown
        const remaining = Math.max(0, TEST_CLIP_DURATION_SECONDS - elapsed).toFixed(1);
        ctx.fillStyle = '#38bdf8';
        ctx.font = 'bold 15px monospace';
        ctx.fillText(`TEST DURATION: ${remaining}s`, width / 2, height - 50);

        // Progress line
        ctx.fillStyle = '#1e293b';
        ctx.fillRect(40, height - 25, width - 80, 6);
        ctx.fillStyle = '#6366f1';
        ctx.fillRect(40, height - 25, (width - 80) * progress, 6);

        frame++;
        // End on real elapsed time: rAF frame rate varies wildly across
        // browsers/devices, so a frame-count cutoff yields unpredictable
        // (often far shorter) clips.
        if (elapsed < TEST_CLIP_DURATION_SECONDS && recorder.state === 'recording') {
          requestAnimationFrame(draw);
        } else {
          try {
            if (recorder.state === 'recording') recorder.stop();
          } catch {}
        }
      };

      requestAnimationFrame(draw);
    } catch {
      resolve(null);
    }
  });
}
