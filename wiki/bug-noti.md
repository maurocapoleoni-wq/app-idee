# Bug noti

Formato di ogni voce: data · commit — problema, causa, soluzione.

## 2026-11-16 · Impostazioni — "Not Found" con il token giusto
Problema: "Verifica GitHub" rispondeva 404 anche con il token corretto. Causa: errore di battitura nel campo Utente GitHub sul telefono; in più la verifica usava i dati salvati, non quelli visibili. Soluzione: la verifica salva prima i campi, i campi non hanno correzione automatica e 401/403/404 hanno messaggi espliciti (`spiegaErrore`).

## 2026-11-16 · Aggiornamenti — moduli vecchi e nuovi mescolati
Problema: dopo una modifica il browser continuava a usare `claude.js` vecchio dalla cache HTTP (GitHub Pages la tiene 10 minuti). Con moduli ES, un file nuovo che importa una funzione da uno vecchio blocca l'app. Soluzione: il service worker chiede la rete con `cache: 'no-cache'` (rivalida con ETag, costa poco).

## 2026-11-16 · Service worker — non si registra nel browser integrato
Nel browser di Claude Code su `127.0.0.1` la registrazione fallisce ("unknown error when fetching the script"). Sul sito vero (GitHub Pages, https) si attiva regolarmente: non è un bug dell'app.

## Da tenere d'occhio
- Il riconoscimento vocale (`SpeechRecognition`) funziona su Chrome per Android e, verificato dall'utente il 2026-11-16, anche su **Brave per Android** (ora il browser principale). Su altri browser può mancare: in quel caso l'app suggerisce il microfono della tastiera.
- Cambiare browser fa ripartire l'app da zero (impostazioni e archivio locale sono per browser): prima controllare "Salvato su GitHub", poi reinserire token e chiave; le idee tornano dalla cassetta.
- Su alcuni telefoni il riconoscimento si interrompe da solo dopo qualche secondo di silenzio, anche con `continuous = true`.
