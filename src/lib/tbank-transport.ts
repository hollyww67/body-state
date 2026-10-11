import https from 'node:https';

/** A single request, never an automatic retry: Init may already have reached the bank. */
export function requestTbank(url: string, payload: Record<string, unknown>): Promise<{ ok: boolean; data: Record<string, unknown> | null }> {
  const endpoint = new URL(url);
  if (endpoint.protocol !== 'https:') throw new Error('TBANK_HTTPS_REQUIRED');
  const body = JSON.stringify(payload);
  return new Promise((resolve, reject) => {
    const request = https.request(endpoint, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', Accept: 'application/json', 'Content-Length': Buffer.byteLength(body) },
      // Avoid reusing an idle bank connection across infrequent payments.
      agent: false,
    }, response => {
      const chunks: Buffer[] = [];
      let size = 0;
      response.on('data', (chunk: Buffer) => {
        size += chunk.length;
        if (size > 1_048_576) request.destroy(new Error('TBANK_RESPONSE_TOO_LARGE'));
        else chunks.push(chunk);
      });
      response.on('error', error => { clearTimeout(deadline); reject(error); });
      response.on('end', () => {
        clearTimeout(deadline);
        let data: Record<string, unknown> | null = null;
        try {
          const parsed: unknown = JSON.parse(Buffer.concat(chunks).toString('utf8'));
          if (parsed && typeof parsed === 'object' && !Array.isArray(parsed)) data = parsed as Record<string, unknown>;
        } catch { /* A non-JSON response is an uncertain result, not a rejection. */ }
        resolve({ ok: (response.statusCode || 0) >= 200 && (response.statusCode || 0) < 300, data });
      });
    });
    const deadline = setTimeout(() => request.destroy(new Error('TBANK_TIMEOUT')), 20_000);
    request.on('error', error => { clearTimeout(deadline); reject(error); });
    request.end(body);
  });
}

export function paymentId(value: unknown): string {
  if (typeof value === 'number' && !Number.isSafeInteger(value)) throw new Error('TBANK_INVALID_PAYMENT_ID');
  const id = typeof value === 'string' || typeof value === 'number' ? String(value) : '';
  if (!/^\d{1,80}$/.test(id)) throw new Error('TBANK_INVALID_PAYMENT_ID');
  return id;
}

/** Log only an allowlisted technical code; never payload, contact details or credentials. */
export function paymentErrorCode(error: unknown): string {
  const e = error as { code?: string; message?: string; cause?: { code?: string } } | null;
  const code = e?.cause?.code || e?.code || e?.message || '';
  return /^(TBANK_[A-Z_]+|UND_ERR_[A-Z_]+|E[A-Z_]+|[0-9]{5})$/.test(code) ? code : 'PAYMENT_INTERNAL_ERROR';
}
