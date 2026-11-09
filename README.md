# Hydantoin Proposed Mechanisms

The proposed mechanisms for

phenylglyoxal hydrate + *N*-cyclohexyl-*N*′-methyl(thio)urea → 5-phenyl(thio)hydantoins (achiral imidodiphosphate
catalyst, CHCl₃)

each drawn for the urea and for the thiourea. The reaction can give two isomers: **P1a** (1-Cy-3-Me: Cy on the same
side as Ph) and **P1b** (1-Me-3-Cy), Cy = cyclohexyl. The urea gives P1a and the thiourea P1b as the major product.
Each mechanism is drawn in an **A** version, which ends at P1a, and a **B** version, which ends at P1b.

| mechanism | ends at | what happens |
|---|---|---|
| **M1A** (proposed mechanism I) | P1a | N-Me adds to the protonated aldehyde C4; N-Cy closes onto the protonated ketone C5 (cis-diol); C5–OH₂⁺ leaves (N-acyliminium ion); A⁻ takes the H on C4 (enol); the enol tautomerises to the product through the catalyst |
| **M1B** (proposed mechanism III) | P1b | the same with Cy and Me swapped: N-Cy adds to C4 first, N-Me closes the ring |
| **M2A** (II with Cy and Me swapped) | P1a | the (thio)urea tautomerises to the iso(thio)urea Cy-N=C(XH)-NH-Me; its O/S adds to C4; the imine N-Cy closes onto C5; C4 moves from O/S to the exocyclic N-Me (1,3-shift); then as M1A |
| **M2B** (proposed mechanism II) | P1b | the (thio)urea tautomerises to the iso(thio)urea Cy-NH-C(XH)=N-Me through the catalyst; its O/S adds to C4; the imine N-Me closes onto C5 (2-imino-oxazolidine / thiazolidine); C4 moves from O/S to the exocyclic N-Cy (1,3-shift); then as M1B |
| **M3A**, **M3B** | P1a, P1b | M1A and M1B one step at a time: the enol tautomerises in two proton transfers (HA protonates C5, then A⁻ takes the H on O4) |
| **M4A**, **M4B** | P1a, P1b | M2A and M2B one step at a time: the (thio)urea becomes the iso(thio)urea in two proton transfers; the C4–O/S bond breaks (a zwitterion) before the N closes onto C4; the enol as in M3 |

Every proton transfer is a step through the catalyst HA = (PhO)₂P(O)NHP(O)(OPh)₂ (drawn A–H; its conjugate base A⁻).
Species and step IDs (I7b, S7b …) are the same as in the mechflow projects used for the DFT calculations.

Open `index.html` in a browser: no server or installation is needed, and the page also works straight from the folder.

## What you can do

- **Mechanisms.** Pick a family (M1–M4) and its **A** (→ P1a) or **B** (→ P1b) version, and the urea or the thiourea
  at the top. Each step with a transition state has its own colour, used for the arrow between the structures and for
  the curly arrows on the structure before it. Above each arrow is the step's transition state: **TS 2D | 3D** (above
  the drawing) shows it as a 2D sketch, with the bonds that form or break dashed, or as the 3D TS guess. The step
  windows have their own 2D | 3D switch; the two choices are separate, and each is remembered. Proton transfers and relays through the catalyst are grey; proton
  transfers and steps that release or take up water are drawn as equilibria (⇌).
- **Click a structure** to turn it in 3D (3Dmol.js): label the key atoms (C5, C4, O5 …), change the style, or download
  the xyz file.
- **Click a step arrow** to open the step in its own window: the diagram with the TS above the arrow (2D, with the bonds
  that form or break dashed, or the 3D TS guess), **3D: TS guess and path** (the images of an IDPP
  interpolation between the two sides, with play and slider controls; a step a mechanism uses backwards is played
  backwards) and **Details**.
- **Species / Steps.** Searchable lists. The search box also finds mechanisms (`M2B`), species (`I7b`) and steps (`S7b`).
- **Links.** The address can open a view directly, for example `index.html#ch=S&m=M2B&step=S7b`, `#ch=O&mol=I7a` or
  `#m=M1A&ts=3d`.

The TS guesses and start structures come from a force field and an IDPP interpolation: they are pictures and starting
points, not DFT results. The page is static: it reads only its own files and connects to nothing else.

## Files

| folder | what |
|---|---|
| `index.html`, `assets/` | the page, its script and styles, and 3Dmol.js |
| `data/` | the drawings and structures, as small script files (so that the page also works from the disk) |
| `xyz/species/`, `xyz/ts_guesses/` | every start structure, TS guess and path as xyz files (open with `ase gui`) |

Built by `make_website.py` from the study's sources (not part of this repository).
