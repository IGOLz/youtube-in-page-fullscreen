# YouTube In-Page Fullscreen

Il video riempie tutta l'area della pagina nella stessa scheda di Brave. Intestazione, playlist, consigli, descrizione e commenti vengono nascosti durante la vista espansa e ripristinati all'uscita.

## Installazione in Brave

1. Scarica il repository con **Code → Download ZIP** ed estrailo, oppure usa la copia locale già preparata.
2. Apri `brave://extensions`.
3. Attiva **Modalità sviluppatore** in alto a destra.
4. Premi **Carica estensione non pacchettizzata** / **Load unpacked**.
5. Seleziona la cartella **extension**, quella che contiene `manifest.json`.
6. Ricarica le schede YouTube già aperte.

Conserva la cartella dove si trova: Brave legge i file da lì. Per aggiornare, sostituisci i file, premi il pulsante di ricarica sulla scheda dell'estensione e ricarica YouTube. Per rimuoverla, usa **Rimuovi** nella stessa pagina.

Se stai passando dalla versione precedente con un altro nome, rimuovi prima quella da Brave e carica la nuova cartella `extension`. Non tenere attive entrambe le versioni.

## Uso

| Comando | Risultato |
| --- | --- |
| `F` | Espande il video nella scheda o torna alla pagina |
| Doppio clic sul video | Alterna le due viste |
| Nuovo pulsante a forma di finestra, accanto al tutto schermo | Alterna le due viste |
| `Esc` | Torna alla pagina |
| Pulsante tutto schermo originale di YouTube | Usa ancora il tutto schermo nativo |

Le scorciatoie non intervengono mentre scrivi nella ricerca o nei commenti. Riproduzione, sottotitoli e controlli restano quelli di YouTube. Il video rimane nel suo punto originale nel DOM; l'estensione ne cambia temporaneamente le dimensioni e ripristina lo scorrimento all'uscita. La navigazione verso un altro video chiude la vista espansa.

## Cosa aspettarsi

Questa modalità riempie **l'area della pagina**, non nasconde le schede o la barra degli indirizzi di Brave. Se metti prima Brave a tutto schermo, puoi espandere e ridurre i video dentro quello spazio senza uscirne. Uscire successivamente dal tutto schermo di Brave mantiene l'animazione di macOS.

La prima versione supporta le normali pagine `www.youtube.com/watch`. Shorts, player incorporati e YouTube Music sono esclusi. Funziona anche su altri sistemi con browser Chromium, ma nasce per Brave su Mac. Cambiamenti futuri al player YouTube possono richiedere un aggiornamento dei selettori.

## Privacy e struttura

Manifest V3, un content script e un foglio CSS. Accesso limitato a `https://www.youtube.com/*`, necessario anche sulla home per seguire la navigazione interna verso un video. Nessun background worker, popup, analytics, richiesta di rete, salvataggio dati o permesso aggiuntivo. L'estensione non modifica gli annunci o le impostazioni di Shields.

`extension/` è pronta da installare: nessuna compilazione o dipendenza. Gli strumenti npm servono soltanto ai test.

## Verifica per sviluppatori

```sh
npm ci
npx playwright install chromium
npm test
```

Per provare l'estensione reale in Brave headless su macOS, con un profilo temporaneo separato da quello personale:

```sh
BROWSER_PATH='/Applications/Brave Browser.app/Contents/MacOS/Brave Browser' npm test
```

I test caricano l'estensione non pacchettizzata su una pagina di prova servita all'indirizzo YouTube tramite intercettazione locale. Verificano dimensioni del player, ridimensionamento finestra, scorciatoie, campi di testo, focus, scroll, tutto schermo nativo, navigazione e sostituzione del player. Non verificano la riproduzione, gli annunci o il layout del sito YouTube reale, che richiedono una prova manuale.

## Ispirazione

Ispirata all'idea di [ibnuh/youtube-full-screen-tab](https://github.com/ibnuh/youtube-full-screen-tab). Implementazione scritta da zero. Qui `F` usa direttamente la modalità scheda, senza popup o preferenze; il pulsante nativo rimane disponibile.

Licenza MIT.
