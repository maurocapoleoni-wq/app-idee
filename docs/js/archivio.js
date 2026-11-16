// Archivio locale dei dialoghi sul telefono (IndexedDB in produzione, RAM nei test).
// È la prima rete di sicurezza: ogni messaggio dell'utente finisce qui prima di tutto il resto.

export function creaArchivio(memoria) {
  async function tutti() {
    return memoria.leggi();
  }

  async function trova(chiave) {
    return (await memoria.leggi()).find((d) => d.chiave === chiave) ?? null;
  }

  async function salva(dialogo) {
    if (!dialogo?.chiave) throw new Error('Dialogo senza chiave: impossibile salvarlo');
    const lista = await memoria.leggi();
    const i = lista.findIndex((d) => d.chiave === dialogo.chiave);
    if (i === -1) lista.push(dialogo);
    else lista[i] = dialogo;
    await memoria.scrivi(lista);
  }

  return { tutti, trova, salva };
}
