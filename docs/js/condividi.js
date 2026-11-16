// Invio di un messaggio tramite il menu di condivisione del telefono.
// Se il browser non lo supporta, il testo viene copiato negli appunti.

export async function condividi({ titolo, testo }) {
  if (navigator.share) {
    try {
      await navigator.share({ title: titolo, text: testo });
      return 'condiviso';
    } catch (e) {
      if (e?.name === 'AbortError') return 'annullato';
    }
  }
  await navigator.clipboard.writeText(testo);
  return 'copiato';
}
