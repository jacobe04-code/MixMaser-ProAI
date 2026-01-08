
import React, { useEffect, useRef } from 'react';
import { VisualizerMode } from '../types';
import { audioEngine } from '../services/audioService';

interface VisualizerProps {
  mode: VisualizerMode;
}

const Visualizer: React.FC<VisualizerProps> = ({ mode }) => {
  const canvasRef = useRef<HTMLCanvasElement>(null);

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    let rafId: number;
    let smoothedVol = 0;

    const draw = () => {
      if (canvas.width !== window.innerWidth || canvas.height !== window.innerHeight) {
        canvas.width = window.innerWidth;
        canvas.height = window.innerHeight;
      }
      const w = canvas.width;
      const h = canvas.height;
      const time = Date.now() * 0.001;

      // Clear logic based on mode
      if (mode === VisualizerMode.FIRE) {
        ctx.fillStyle = 'rgba(2, 6, 23, 0.2)';
        ctx.fillRect(0, 0, w, h);
      } else {
        ctx.clearRect(0, 0, w, h);
      }

      const analyser = audioEngine.masterAnalyser;
      if (analyser) {
        const values = analyser.getValue() as Float32Array;
        let sum = 0;
        for (let i = 0; i < values.length; i++) sum += values[i] ** 2;
        const rms = Math.sqrt(sum / values.length);
        smoothedVol += (rms - smoothedVol) * 0.1;

        if (mode === VisualizerMode.BARS) {
          const barWidth = 15;
          const barSpacing = 5;
          const totalBars = Math.floor(w / (barWidth + barSpacing));
          for (let i = 0; i < totalBars; i++) {
            const freqIdx = Math.floor((i / totalBars) * (values.length / 2));
            const val = Math.max(0, (values[freqIdx] + 100) / 100);
            const height = val * 200;
            const gradient = ctx.createLinearGradient(0, h, 0, h - height);
            gradient.addColorStop(0, '#3b82f6');
            gradient.addColorStop(1, '#ec4899');
            ctx.fillStyle = gradient;
            ctx.globalAlpha = 0.4 + val * 0.6;
            ctx.fillRect(i * (barWidth + barSpacing), h - height, barWidth, height);
          }
        } else if (mode === VisualizerMode.WAVES) {
          ctx.beginPath();
          ctx.lineWidth = 3;
          ctx.strokeStyle = '#3b82f6';
          for (let i = 0; i < values.length; i++) {
            const x = (i / values.length) * w;
            const y = h / 2 + (values[i] * 1.5) * (h / 4);
            if (i === 0) ctx.moveTo(x, y);
            else ctx.lineTo(x, y);
          }
          ctx.stroke();
        } else if (mode === VisualizerMode.DOTS) {
          const gridSize = 50;
          for (let x = 0; x < w; x += gridSize) {
            for (let y = 0; y < h; y += gridSize) {
              const idx = Math.floor(((x + y) / (w + h)) * values.length) % values.length;
              const val = Math.max(0, (values[idx] + 100) / 100);
              ctx.beginPath();
              ctx.fillStyle = `rgba(168, 85, 247, ${val * 0.3})`;
              ctx.arc(x, y, val * gridSize * 0.5, 0, Math.PI * 2);
              ctx.fill();
            }
          }
        }
      }

      rafId = requestAnimationFrame(draw);
    };

    draw();
    return () => cancelAnimationFrame(rafId);
  }, [mode]);

  return <canvas ref={canvasRef} className="fixed inset-0 z-0 pointer-events-none opacity-40" />;
};

export default Visualizer;
