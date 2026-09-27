import { useCallback, useState } from 'react';

import type { NfcServiceErrorCode, NfcUiStatus } from '../types/nfc';
import { NfcServiceError } from '../types/nfc';

const NFC_ERROR_MESSAGES: Record<NfcServiceErrorCode, string> = {
  NFC_UNAVAILABLE: 'NFC no está disponible en este dispositivo',
  NFC_DISABLED: 'Activa NFC en la configuración del dispositivo',
  SESSION_CANCELLED: 'Operación cancelada',
  TAG_NOT_WRITABLE: 'Esta etiqueta no permite escritura',
  WRITE_FAILED: 'No se pudo escribir en la etiqueta',
  VERIFY_MISMATCH: 'La verificación falló: el contenido leído no coincide',
  UNSUPPORTED_TAG: 'Etiqueta NFC no compatible',
  UNKNOWN: 'Error desconocido de NFC',
};

export function nfcErrorMessage(error: unknown): string {
  if (error instanceof NfcServiceError) {
    return NFC_ERROR_MESSAGES[error.code] ?? error.message;
  }
  if (error instanceof Error && error.message) {
    return error.message;
  }
  return NFC_ERROR_MESSAGES.UNKNOWN;
}

export type NfcOperationControls = {
  setStatus: (status: NfcUiStatus) => void;
};

export type NfcOperationFn = (controls: NfcOperationControls) => Promise<void>;

export function useNfcOperation() {
  const [status, setStatus] = useState<NfcUiStatus>('IDLE');
  const [error, setError] = useState<string | null>(null);

  const reset = useCallback(() => {
    setStatus('IDLE');
    setError(null);
  }, []);

  const run = useCallback(async (operation: NfcOperationFn) => {
    setError(null);
    setStatus('WAITING');
    try {
      await operation({ setStatus });
    } catch (err) {
      setError(nfcErrorMessage(err));
      setStatus('ERROR');
    }
  }, []);

  return { status, error, setStatus, run, reset };
}
