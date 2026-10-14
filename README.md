# Comptabilité

Application web installable (PWA) pour la comptabilité du foyer Boulet et de l'activité de coaching.

- **Données** : Supabase, projet `tb-coaching app`, tables préfixées `compta_` (séparées de l'app coaching).
- **Accès** : réservé aux membres listés dans `compta_members` (titulaire : Thomas, adresse perso). Les lignes pro et les réglages ne sont modifiables que par le titulaire.
- **Paiements coaching** : les paiements marqués « payé » dans TB my Coach (`biz_payments`) sont ajoutés en lecture seule au chiffre d'affaires.
- **Hébergement** : GitHub Pages, site statique, sans étape de build.

La clé présente dans `index.html` est la clé publique (anon) de Supabase : elle est faite pour être visible ; ce sont les règles d'accès de la base qui protègent les données.

## Fichiers
- `index.html` : toute l'application
- `supabase.js` : client Supabase 2.45.4 (copie locale)
- `sw.js`, `manifest.webmanifest`, icônes : installation sur l'écran d'accueil
