// Riconoscimento vocale (Web Speech API) e lettura ad alta voce.

const Riconoscimento = globalThis.SpeechRecognition ?? globalThis.webkitSpeechRecognition;

export function voceSupportata() {
  return Boolean(Riconoscimento);
}

// onParziale(testo): trascrizione dal vivo; onFinale(testo): frase conclusa.
export function creaRiconoscimento({ onParziale = () => {}, onFinale = () => {}, onErrore = () => {}, onFine = () => {} } = {}) {
  if (!Riconoscimento) throw new Error('Il riconoscimento vocale non è supportato da questo browser');
  const r = new Riconoscimento();
  r.lang = 'it-IT';
  r.interimResults = true;
  r.continuous = true;

  r.onresult = (evento) => {
    let parziale = '';
    for (let i = evento.resultIndex; i < evento.results.length; i += 1) {
      const risultato = evento.results[i];
      if (risultato.isFinal) onFinale(risultato[0].transcript.trim());
      else parziale += risultato[0].transcript;
    }
    if (parziale) onParziale(parziale.trim());
  };
  r.onerror = (evento) => onErrore(new Error(`Microfono: ${evento.error}`));
  r.onend = () => onFine();

  return {
    avvia: () => r.start(),
    ferma: () => r.stop(),
  };
}

export function leggiAdAltaVoce(testo) {
  if (!globalThis.speechSynthesis) return false;
  speechSynthesis.cancel();
  const frase = new SpeechSynthesisUtterance(testo);
  frase.lang = 'it-IT';
  speechSynthesis.speak(frase);
  return true;
}
