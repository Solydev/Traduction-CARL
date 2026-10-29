# Lancement depuis WSL — V1.3.0

Dans le dossier du projet, utilisez simplement :

```bash
bash lancer-wsl.sh
```

Choisissez **1** pour auditer les six langues ou **2** pour corriger et sauvegarder. Saisissez ensuite le code du **profil de départ inclus**, ou Entrée pour toute la liste. Le programme descend dans la liste CARL à partir de ce profil, jusqu’au dernier. Le lanceur ouvre une **vraie fenêtre Google Chrome Windows**, puis attend votre connexion à CARL. Vous pouvez aussi double-cliquer sur **Lancer-WSL.cmd** depuis l’Explorateur.

Le lanceur réutilise le Node.js et le module Playwright déjà fournis par Codex dans le dossier utilisateur Windows. **Aucune nouvelle installation Windows n’est nécessaire.** WSL sert à lancer ces composants Windows existants. Ce mode ne dépend pas de WSLg et n’ouvre aucun serveur local d’affichage.

## Vérification ou audit limité

```bash
bash lancer-wsl.sh --diagnostic
bash lancer-wsl.sh --audit --profiles BUYER --languages fr_FR
bash lancer-wsl.sh --apply --start-profile BUYER_LABO
```

Sur ce poste, le diagnostic confirme Windows, Node.js 24.22.1, Playwright et `C:\Program Files\Google\Chrome\Application\chrome.exe`. Si le projet est déplacé hors du dossier utilisateur Windows, la variable `CARL_WINDOWS_HOME` peut indiquer son chemin Linux, par exemple `/mnt/c/Users/samuel.cadart`.

## Correctif réseau

CARL utilise à la fois des navigations et des réponses AJAX. Une navigation peut retirer son ancienne réponse du cache de Chromium. Le programme ne tente plus de relire ces documents après leur navigation. Les réponses AJAX sont lues en mémoire avant leur remise au navigateur, avec une seule transmission au serveur et sans reprise automatique de la requête. Les erreurs HTTP et JSF restent bloquantes, et chaque sauvegarde est toujours suivie d’un rafraîchissement et d’une comparaison des données.

Après un changement de langue, le programme attend jusqu’à 45 secondes que le code exact de langue soit présent, que le document ait fini son chargement et que le même profil soit de nouveau affiché. Une confirmation tardive est détectée et validée avant cette attente finale. La langue n’est pas sélectionnée une deuxième fois en cas de lenteur.

Le passage au profil suivant attend également le retour complet de la liste et toutes ses lignes. Le tableau est retrouvé même si CARL change son identifiant interne. Les widgets attendent leurs champs et leurs lignes, restent visibles au moins 1,2 seconde, puis sont fermés par le programme après lecture. Les valeurs sont détaillées dans `lectures.csv` et les comptes de champs sont affichés dans le terminal.

Le test Chrome d’intégration utilise un faux serveur local, sans données CARL ni identifiants. Il vérifie une navigation après AJAX ainsi que l’absence de double requête.

## Ancien moteur Linux

Le moteur Linux reste accessible explicitement avec `--linux-engine`. Il nécessite les dépendances Ubuntu et WSLg. L’ancien mode `--local-display` reste disponible sur demande explicite ; il n’est jamais activé par le lancement normal.
