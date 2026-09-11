"use client";

import { useEffect, useRef, useState } from "react";
import {
  BrowserQRCodeReader,
  type IScannerControls,
} from "@zxing/browser";

interface CheckInQrScannerProps {
  onScan: (text: string) => void;
  paused?: boolean;
}

function cameraErrorMessage(error: unknown): string {
  const name = error instanceof DOMException ? error.name : "";
  if (name === "NotAllowedError" || name === "PermissionDeniedError") {
    return "Camera access was denied. Allow camera permission and try again. Scanning requires HTTPS or localhost.";
  }
  if (name === "NotFoundError") {
    return "No camera was found on this device.";
  }
  if (name === "NotReadableError") {
    return "The camera is in use by another application. Close other apps using the camera and try again.";
  }
  return "Unable to start the camera. Scanning requires HTTPS or localhost.";
}

function stopStream(stream: MediaStream | null) {
  stream?.getTracks().forEach((track) => track.stop());
}

export default function CheckInQrScanner({
  onScan,
  paused = false,
}: CheckInQrScannerProps) {
  const videoRef = useRef<HTMLVideoElement>(null);
  const onScanRef = useRef(onScan);
  const pausedRef = useRef(paused);
  const [error, setError] = useState<string | null>(null);
  const [starting, setStarting] = useState(true);
  const [retryKey, setRetryKey] = useState(0);

  onScanRef.current = onScan;
  pausedRef.current = paused;

  useEffect(() => {
    let cancelled = false;
    let controls: IScannerControls | null = null;
    let stream: MediaStream | null = null;
    const reader = new BrowserQRCodeReader();

    const handleResult = (result?: { getText: () => string } | null) => {
      if (pausedRef.current || !result) return;
      onScanRef.current(result.getText());
    };

    const start = async () => {
      const video = videoRef.current;
      if (!video) return;

      video.muted = true;
      video.setAttribute("playsinline", "true");
      video.setAttribute("autoplay", "true");

      try {
        stream = await navigator.mediaDevices.getUserMedia({
          audio: false,
          video: { facingMode: { ideal: "environment" } },
        });
        if (cancelled) {
          stopStream(stream);
          return;
        }

        video.srcObject = stream;
        await video.play();

        if (cancelled) {
          stopStream(stream);
          video.srcObject = null;
          return;
        }

        controls = await reader.decodeFromStream(stream, video, (result) =>
          handleResult(result)
        );

        if (cancelled) {
          controls.stop();
          stopStream(stream);
          video.srcObject = null;
          return;
        }

        setStarting(false);
        setError(null);
      } catch (err) {
        stopStream(stream);
        if (cancelled) return;
        setStarting(false);
        setError(cameraErrorMessage(err));
      }
    };

    // Skip the first React Strict Mode mount so the webcam is not
    // opened and immediately stopped (that leaves a black preview).
    const timeoutId = window.setTimeout(() => {
      void start();
    }, 150);

    return () => {
      cancelled = true;
      window.clearTimeout(timeoutId);
      controls?.stop();
      stopStream(stream);
      const video = videoRef.current;
      if (video) {
        video.srcObject = null;
      }
    };
  }, [retryKey]);

  return (
    <div className="mt-4 space-y-3">
      {error ? (
        <div className="rounded-md border border-red-100 bg-red-50 px-3 py-2 text-sm text-red-600">
          {error}
        </div>
      ) : null}
      <div className="relative overflow-hidden rounded-lg border border-primary/20 bg-black">
        <video
          ref={videoRef}
          className="aspect-video w-full bg-black object-cover"
          muted
          playsInline
          autoPlay
        />
        {starting && !error ? (
          <p className="absolute inset-0 flex items-center justify-center text-sm text-white/80">
            Starting camera…
          </p>
        ) : null}
      </div>
      {error ? (
        <button
          type="button"
          onClick={() => {
            setError(null);
            setStarting(true);
            setRetryKey((key) => key + 1);
          }}
          className="text-sm font-medium text-primary hover:text-lighthouse-navy hover:underline"
        >
          Try camera again
        </button>
      ) : null}
    </div>
  );
}
