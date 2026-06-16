# Hivemind — assets de marque

Logo « essaim d'alvéoles » : un cœur orange (l'orchestrateur) entouré de six
cellules (les services), en hexagones — clin d'œil à la ruche, aux services
hexagonaux et à l'architecture hexagonale du backend.

## Fichiers
- `hivemind-mark.svg` — la marque seule (carré, 120×120). Sert aussi de favicon / app-icon.
- `hivemind-lockup.svg` — marque + mot « Hivemind » (fonds clairs).
- `hivemind-lockup-dark.svg` — version pour fonds sombres (mot en blanc).

## Couleurs
- Cellules / ambre de marque : `#FBB040` (miel ambré)
- Cœur (cellule centrale) : `#E8920C` (ambre profond)
- Wordmark sur fond clair : `Hive` `#E8920C` · `mind` `#1F2733`
- Wordmark sur fond sombre : `Hive` `#FBB040` · `mind` `#FFFFFF`

## Note production
Les lockups utilisent du texte SVG (`<text>`) avec une pile de polices sans-serif.
Pour une reproduction garantie hors navigateur (impression, autres outils), il
est recommandé de **vectoriser le texte en tracés** (Inkscape : Chemin → Objet en
chemin ; ou `inkscape --export-text-to-path`). La marque (`hivemind-mark.svg`) est
déjà 100 % vectorielle, sans texte.
