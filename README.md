# Hydantoin Proposed Mechanisms

The three proposed mechanisms for

phenylglyoxal hydrate + *N*-cyclohexyl-*N*′-methyl(thio)urea → 5-phenyl(thio)hydantoins (achiral imidodiphosphate
catalyst, CHCl₃)

each drawn for the urea and for the thiourea. The reaction can give two isomers: **P1a** (1-Cy-3-Me) and **P1b**
(1-Me-3-Cy), Cy = cyclohexyl. The urea gives P1a and the thiourea P1b as the major product.

| mechanism | ends at | what happens |
|---|---|---|
| **M1** | P1a | N-Me adds to the protonated aldehyde C4; N-Cy closes onto the protonated ketone C5 (cis-diol); C5–OH₂⁺ leaves (N-acyliminium ion); A⁻ takes the H on C4 (enol); the enol tautomerises to the product through the catalyst |
| **M2** | P1b | the (thio)urea tautomerises to the iso(thio)urea through the catalyst; its O/S adds to C4; the imine N-Me closes onto C5 (2-imino-oxazolidine / thiazolidine); C4 moves from O/S to the exocyclic N-Cy (1,3-shift); then as M3 |
| **M3** | P1b | as M1, but N-Cy adds to C4 first and N-Me closes the ring |

Every proton transfer is a step through the catalyst HA = (PhO)₂P(O)NHP(O)(OPh)₂ (drawn A–H; its conjugate base A⁻).
Species and step IDs (I7b, S7b …) are the same as in the mechflow projects used for the DFT calculations.

Open `index.html` in a browser: no server or installation is needed, and the page also works straight from the folder.

## What you can do

- **Mechanisms.** Pick M1, M2 or M3, and the urea or the thiourea at the top. Each step with a transition state has its
  own colour, used for the arrow between the structures and for the curly arrows on the structure before it. Above each
  arrow is a 3D picture of a TS guess. Proton transfers and relays through the catalyst are grey; proton transfers and
  steps that release or take up water are drawn as equilibria (⇌).
- **Click a structure** to turn it in 3D (3Dmol.js): label the key atoms (C5, C4, O5 …), change the style, or download
  the xyz file.
- **Click a step arrow** to open the step in its own window: the diagram with the TS above the arrow (2D, with the bonds
  that form or break dashed; **2D | 3D** swaps in the 3D TS guess), **3D: TS guess and path** (the images of an IDPP
  interpolation between the two sides, with play and slider controls; a step a mechanism uses backwards is played
  backwards) and **Details**.
- **Species / Steps.** Searchable lists. The search box also finds mechanisms (`M2`), species (`I7b`) and steps (`S7b`).
- **Links.** The address can open a view directly, for example `index.html#ch=S&m=M2&step=S7b` or `#ch=O&mol=I7a`.

The TS guesses and start structures come from a force field and an IDPP interpolation: they are pictures and starting
points, not DFT results. The page is static: it reads only its own files and connects to nothing else.

## Files

| folder | what |
|---|---|
| `index.html`, `assets/` | the page, its script and styles, and 3Dmol.js |
| `data/` | the drawings and structures, as small script files (so that the page also works from the disk) |
| `xyz/species/`, `xyz/ts_guesses/` | every start structure, TS guess and path as xyz files (open with `ase gui`) |

Built by `make_website.py` from the study's sources (not part of this repository).
