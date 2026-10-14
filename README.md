# Comptabilité

Application web installable (PWA) de comptabilité personnelle et familiale, offerte par Thomas Boulet Coaching. Chaque personne crée son compte et sa comptabilité privée, et peut inviter son conjoint.

- **Données** : Supabase, projet `tb-coaching app`, tables préfixées `cpta_` (une comptabilité par foyer, isolée par les règles d'accès de la base). Les anciennes tables `compta_` ne sont plus utilisées.
- **Accès** : chaque foyer n'est visible que par ses membres (`cpta_members`). Le titulaire gère les réglages et l'activité pro ; un membre invité saisit les dépenses du foyer.
- **Paiements coaching** : pour le seul foyer du coach, les paiements marqués « payé » dans TB my Coach (`biz_payments`) sont ajoutés en lecture seule au chiffre d'affaires.
- **Hébergement** : GitHub Pages, site statique, sans étape de build.

La clé présente dans `index.html` est la clé publique (anon) de Supabase : elle est faite pour être visible ; ce sont les règles d'accès de la base qui protègent les données.

## Fichiers
- `index.html` : toute l'application
- `supabase.js` : client Supabase 2.45.4 (copie locale)
- `sw.js`, `manifest.webmanifest`, icônes : installation sur l'écran d'accueil
