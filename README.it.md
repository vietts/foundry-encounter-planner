# Calcolo incontri (D&D 5e)

*[English](README.md)*

Una finestra per il GM su Foundry VTT con il sistema **dnd5e**: prepari gli incontri **senza mettere token in scena**,
vedi come va un'intera **giornata d'avventura**, poi trasformi il piano in un **Incontro** di dnd5e e lo metti in scena.

- **Il gruppo dal mondo**: il party principale di dnd5e, oppure il primo attore Gruppo, oppure i PG dei giocatori.
  Togli la spunta a un PG per escluderlo; ritocca danni per round, bonus d'attacco e cure della giornata (i valori ritoccati hanno il bordo oro, svuota il campo per tornare alla stima).
- **I mostri dai compendi che scegli**: cerca per nome o GS, oppure trascina un attore in un incontro.
  Di default i mostri SRD di dnd5e per le regole del mondo (`dnd5e.actors24` con le regole 2024, `dnd5e.monsters` con le legacy).
  In **Impostazioni › Calcolo incontri › Compendi dei mostri** agganci i tuoi (modulo del Monster Manual, un compendio tradotto o homebrew…).
  I mostri trascinati da altri compendi vengono ricondotti a quelli scelti per id o per nome: ogni incontro pesca da **una sola fonte**.
- **Difficoltà 2024**: soglie Bassa / Moderata / Alta sommate sui PG inclusi.
- **La giornata**: incontri in fila, riposo breve facoltativo dopo ognuno (dadi vita), cure magiche fra uno scontro e l'altro.
  Ti dice **a quale incontro il gruppo cade**, quanti PF restano dopo ogni scontro e, per ogni incontro,
  **quante volte di fila** lo reggono, con e senza riposi brevi.
- **Dal piano al tavolo**: *Crea incontro* crea (o aggiorna) un attore Incontro di dnd5e nella cartella *Incontri*.
  I suoi mostri sono copie nel mondo in *Incontri › Mostri*, una per mostro e condivise fra tutti gli incontri, così
  **cambi ritratti e token prima di piazzarli** (la matita accanto a ogni mostro apre la sua copia).
  *In scena* li piazza nella scena aperta con il piazzamento di dnd5e, e nel combat tracker secondo l'impostazione di dnd5e.

Si apre dal pulsante in cima alla barra Attori, oppure con `game.modules.get("dnd5e-encounter-planner").api.open()`.

## Come stima

Valori attesi, niente dadi: serve a farsi un'idea, non è un verdetto.

- **Mostri:** PF e CA veri dalla scheda; danni per round e bonus d'attacco dalla tabella del mostro tipico per GS.
- **PG:** danni per round da una tabella per livello pesata per classe (modificabile), bonus d'attacco = competenza + 3/4/5.
- **Lo scontro:** il gruppo concentra i colpi sul mostro che fa più danni per PF; i danni dei mostri si spalmano sui PG
  in piedi in proporzione ai PF massimi — per questo *rischio morti* scatta già sotto il 25% dei PF del gruppo.
- Due cursori per adattarlo al tuo tavolo: **efficacia del gruppo** e **letalità dei mostri**.

## Installazione

URL del manifest: `https://github.com/vietts/foundry-encounter-planner/releases/latest/download/module.json`

Serve Foundry VTT v13+ e dnd5e 5.0+ (attori Incontro). Interfaccia in inglese e italiano.

## Licenza

MIT
