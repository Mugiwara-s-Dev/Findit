"use client";

import { BrowserCodeReader, BrowserMultiFormatReader } from "@zxing/browser";
import { BarcodeFormat, DecodeHintType } from "@zxing/library";
import { useEffect, useMemo, useRef, useState } from "react";
import styles from "./findit-dashboard.module.css";

type BarcodeScannerSheetProps = {
  isOpen: boolean;
  onClose: () => void;
  onDetected: (barcode: string) => void;
};

const barcodeHints = new Map<DecodeHintType, unknown>([
  [
    DecodeHintType.POSSIBLE_FORMATS,
    [
      BarcodeFormat.EAN_13,
      BarcodeFormat.EAN_8,
      BarcodeFormat.UPC_A,
      BarcodeFormat.UPC_E,
      BarcodeFormat.CODE_128,
      BarcodeFormat.CODE_39,
      BarcodeFormat.ITF,
    ],
  ],
  [DecodeHintType.TRY_HARDER, true],
]);

const preferredConstraints: MediaStreamConstraints = {
  audio: false,
  video: {
    facingMode: { ideal: "environment" },
    width: { ideal: 1280 },
    height: { ideal: 720 },
  },
};

const fallbackConstraints: MediaStreamConstraints = {
  audio: false,
  video: true,
};

export function BarcodeScannerSheet({ isOpen, onClose, onDetected }: BarcodeScannerSheetProps) {
  const videoRef = useRef<HTMLVideoElement | null>(null);
  const controlsRef = useRef<{ stop: () => void } | null>(null);
  const detectedRef = useRef(false);
  const codeReader = useMemo(() => new BrowserMultiFormatReader(barcodeHints), []);
  const scannerSupported =
    typeof navigator !== "undefined" &&
    Boolean(navigator.mediaDevices?.getUserMedia);
  const isSecureCameraContext =
    typeof window !== "undefined" &&
    (window.isSecureContext ||
      window.location.hostname === "localhost" ||
      window.location.hostname === "127.0.0.1");
  const [message, setMessage] = useState("Apunta la camara al codigo de barras.");
  const [error, setError] = useState<string | null>(null);
  const [isStarting, setIsStarting] = useState(false);

  useEffect(() => {
    if (!isOpen || !scannerSupported) {
      return;
    }

    let active = true;
    let stream: MediaStream | null = null;
    detectedRef.current = false;

    const cleanup = () => {
      controlsRef.current?.stop();
      controlsRef.current = null;

      if (stream) {
        stream.getTracks().forEach((track) => track.stop());
        stream = null;
      }

      BrowserCodeReader.releaseAllStreams();
      stopVideoPreview(videoRef.current);
    };

    const startScanner = async () => {
      setIsStarting(true);
      setError(null);
      setMessage("Activando camara...");

      try {
        stream = await requestCameraStream();

        if (!active) {
          cleanup();
          return;
        }

        const videoTrack = stream.getVideoTracks()[0];
        if (!videoTrack) {
          throw new Error("No encontramos una camara disponible en este dispositivo.");
        }

        const controls = await codeReader.decodeFromStream(
          stream,
          videoRef.current ?? undefined,
          (result, scanError) => {
            if (!active || detectedRef.current) {
              return;
            }

            if (result) {
              const barcode = result.getText().trim();
              if (!barcode) {
                return;
              }

              detectedRef.current = true;
              setMessage(`Codigo detectado: ${barcode}`);
              cleanup();
              onDetected(barcode);
              return;
            }

            if (scanError && !isTransientScanError(scanError)) {
              setError("No pudimos leer el codigo. Prueba con mejor luz o acercando mas la camara.");
            }
          },
        );

        if (!active) {
          controls.stop();
          cleanup();
          return;
        }

        controlsRef.current = controls;
        setIsStarting(false);
        setMessage("Apunta la camara al codigo de barras.");
      } catch (scanStartError) {
        if (!active) {
          return;
        }

        setIsStarting(false);
        setError(readScannerError(scanStartError));
        setMessage("No pudimos iniciar el escaner.");
      }
    };

    void startScanner();

    return () => {
      active = false;
      detectedRef.current = false;
      cleanup();
    };
  }, [codeReader, isOpen, onDetected, scannerSupported]);

  const statusMessage = !scannerSupported
    ? isSecureCameraContext
      ? "Tu navegador no permite usar la camara desde aqui."
      : "La camara solo funciona entrando por https o desde localhost."
    : error ?? (isStarting ? "Preparando camara..." : message);

  if (!isOpen) {
    return null;
  }

  return (
    <div className={styles.scannerOverlay} role="dialog" aria-modal="true" aria-labelledby="barcode-scanner-title">
      <div className={styles.scannerCard}>
        <div className={styles.scannerHeader}>
          <div>
            <h3 id="barcode-scanner-title">Escanear codigo</h3>
            <p>Apunta la camara al codigo del producto para llenar los datos mas rapido.</p>
          </div>

          <button
            className={`${styles.button} ${styles.buttonSecondary} ${styles.scannerCloseButton}`}
            type="button"
            onClick={onClose}
          >
            <span aria-hidden="true">X</span>
          </button>
        </div>

        <div className={styles.scannerViewport}>
          <video ref={videoRef} className={styles.scannerVideo} autoPlay muted playsInline />
          <div className={styles.scannerFrame} aria-hidden="true" />
        </div>

        <div
          className={
            !scannerSupported || error
              ? `${styles.scannerStatus} ${styles.scannerStatusError}`
              : styles.scannerStatus
          }
        >
          {statusMessage}
        </div>

        {!isSecureCameraContext ? (
          <div className={styles.scannerHint}>
            Si lo pruebas desde otro dispositivo, usa `https`. En desarrollo local, `http://localhost:3000` si permite camara.
          </div>
        ) : null}
      </div>
    </div>
  );
}

async function requestCameraStream() {
  const attempts = [preferredConstraints, fallbackConstraints];
  let lastError: unknown = null;

  for (const constraints of attempts) {
    try {
      return await navigator.mediaDevices.getUserMedia(constraints);
    } catch (error) {
      lastError = error;
    }
  }

  throw lastError ?? new Error("No pudimos abrir la camara.");
}

function isTransientScanError(error: unknown) {
  if (!(error instanceof Error)) {
    return false;
  }

  return (
    error.name === "NotFoundException" ||
    error.name === "ChecksumException" ||
    error.name === "FormatException"
  );
}

function readScannerError(error: unknown) {
  if (!(error instanceof Error)) {
    return "No pudimos abrir la camara.";
  }

  if (error.name === "NotAllowedError" || error.name === "SecurityError") {
    return "Activa el permiso de camara para escanear el codigo.";
  }

  if (error.name === "NotFoundError" || error.name === "DevicesNotFoundError") {
    return "No encontramos una camara disponible en este dispositivo.";
  }

  if (error.name === "NotReadableError" || error.name === "TrackStartError") {
    return "La camara esta ocupada por otra app o por otra pestaña.";
  }

  return error.message || "No pudimos abrir la camara.";
}

function stopVideoPreview(video: HTMLVideoElement | null) {
  if (!video) {
    return;
  }

  const stream = video.srcObject;
  if (stream instanceof MediaStream) {
    stream.getTracks().forEach((track) => track.stop());
  }

  video.pause();
  video.srcObject = null;
}
