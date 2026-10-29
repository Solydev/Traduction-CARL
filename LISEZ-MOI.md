# CARL — Traduction des écrans d’accueil — V1.3.0

Après le choix audit/correction, le programme demande un **profil de départ inclus**. Saisissez par exemple `BUYER_LABO` : il traitera ce profil puis tous ceux qui suivent dans l’ordre de la liste CARL. Appuyez simplement sur Entrée pour traiter toute la liste. Un code inconnu provoque un arrêt ; les profils standard restent ignorés. La reprise recommence les six langues du profil choisi.

La V1.2.6 prend en compte les champs de saisie dont le type HTML est implicite ou dont l’infobulle disparaît après activation. Les libellés de favoris et de rapports restent identifiés par leurs identifiants techniques connus, avec contrôle du code de ligne et du texte avant modification. La reconstruction de l’écran après sauvegarde reste attendue. Seul « sauvegarde vérifiée » confirme la relecture des traductions enregistrées ; « saisi » ou « disquette transmise » ne suffisent pas. Le lancement reste `bash lancer-wsl.sh`, sans installation supplémentaire.

**Pour ce PC professionnel : `bash lancer-wsl.sh` ou Lancer-WSL.cmd.** Le lanceur ouvre Chrome Windows en réutilisant les composants Codex déjà installés. Aucune nouvelle installation ni interface d’affichage locale n’est nécessaire. Voir [WSL.md](WSL.md).

Le programme parcourt **Système > Écrans d’accueil**, puis chaque profil modifiable et chaque widget. Il utilise un dictionnaire local préparé à partir des libellés relevés dans CARL le 23 octobre 2026. Aucune clé API ni transmission des textes à un service de traduction n’est nécessaire.

## Démarrage sous Windows

1. Double-cliquez sur **Lancer.cmd**.
2. Choisissez **1** pour obtenir un audit ou **2** pour corriger les six langues.
3. Connectez-vous vous-même dans la nouvelle fenêtre Chrome ouverte par le programme. Il reprend automatiquement après connexion. Votre mot de passe n’est ni demandé dans le terminal ni écrit dans les rapports.
4. Suivez l’avancement dans la fenêtre du lanceur. Fermez la fenêtre Chrome à la fin.

Le lanceur sait utiliser Node.js et Playwright fournis avec Codex sur ce poste. Sur un autre poste, installez [Node.js LTS](https://nodejs.org/), puis lancez **Installer.cmd**. Google Chrome doit être installé ; sinon, installez le navigateur de Playwright avec `npx playwright install chromium`.

## Fonctionnement

- Un profil **Standard** est ignoré avant toute saisie et toute sauvegarde. Les cinq profils standard constatés sont DEFAULT, MANAGER, MENU, PURCHASER et REQUESTER ; le programme vérifie le marqueur réel, sans se limiter à cette liste.
- Pour chaque profil modifiable, le programme relève d’abord les textes présents dans sa version française, y compris ceux actuellement rédigés en anglais. Il les associe au dictionnaire pour produire les six versions. Il corrige également le libellé du profil.
- Les champs traités sont les titres des widgets Favoris, Indicateurs, Graphique, Rapports et Site externe, ainsi que les libellés des lignes de favoris et de rapports. Les codes, formulaires, liens, filtres et paramètres techniques ne sont pas modifiés. Les noms internes des définitions de widgets sont en lecture seule.
- Plusieurs widgets du même type sont distingués par leur position. Les lignes sont identifiées par leur ordre et leurs références techniques, pour détecter une différence de structure entre les langues.
- Les listes paginées sont parcourues jusqu’à la dernière page.
- Le retour à la liste des profils attend que toutes les lignes annoncées par la pagination soient présentes. Le programme retrouve le tableau sans dépendre de son identifiant interne généré.
- Chaque fenêtre de widget attend son titre, ses boutons actifs et toutes ses lignes avant la lecture. Elle reste visible au moins 1,2 seconde après son chargement. En audit, le programme clique lui-même sur **Annuler** après lecture ; cette fermeture est normale.
- L’audit compare les textes déjà relevés, sans rouvrir chaque widget pour calculer les différences.
- Après chaque langue en mode correction : validation des fenêtres de widgets, clic sur la **disquette**, rafraîchissement des données, relecture de tous les champs et comparaison. Un échec arrête le traitement avant le changement de langue suivant.
- Le programme revient au français à la fin d’une exécution réussie.

Les six codes sont `fr_FR`, `en_GB`, `de_DE`, `en_US`, `es_ES` et `es_MX`. **Attention à l’intitulé dans CARL : l’option « English, Australia » affichée en français utilise effectivement `en_GB`, puis apparaît comme « English, United Kingdom ».** Les variantes britanniques sont donc utilisées pour cette option.

## Dictionnaire et limites

**dictionnaire.tsv** contient les textes existants et leurs traductions. Plusieurs graphies d’un même texte peuvent être séparées par `~` dans la première colonne. Les autres colonnes sont : français, anglais GB, allemand, espagnol ES, anglais US facultatif et espagnol MX facultatif. Une cellule US ou MX vide reprend respectivement la version GB ou ES.

Les traductions constituent des propositions contextualisées pour la GMAO ; un audit permet de vérifier la terminologie métier avant une correction en masse. Les noms HILTI, MEF, CARL, Malteurop et les repères P1, AU et US sont conservés.

**Sans moteur de traduction installé, un nouveau texte absent du dictionnaire ne peut pas être traduit automatiquement.** Il reste inchangé et apparaît dans le rapport avec le statut « absent du dictionnaire ». Ajoutez sa traduction au fichier, puis relancez. Les textes déjà corrigés sont reconnus lors des exécutions suivantes.

L’application nécessite l’accès réseau habituel à CARL et vos droits de modification. Une modification de l’interface CARL peut nécessiter une adaptation des sélecteurs. Les sélecteurs et le parcours ont été inspectés dans la session réelle ; le programme autonome n’a pas encore fait l’objet d’une exécution complète connectée. Le contrôle de sauvegarde a été testé automatiquement. Des titres et un libellé ont été sauvegardés et relus dans CARL sur BUYER ; les changements précis sont consignés dans **VERIFICATIONS.md**.

## Rapports

Chaque exécution crée un dossier daté dans **rapports/** contenant :

- **modifications.csv** : profil, langue, widget, champ, ancien texte, nouveau texte et statut. « saisi » désigne une saisie ; la ligne « sauvegarde vérifiée » confirme ensuite la relecture du profil et de sa langue.
- **lectures.csv** : tous les textes effectivement lus, y compris ceux qui n’exigent aucune correction. Chaque lecture de widget est écrite avant la fermeture de sa fenêtre. Le terminal affiche aussi le widget et le nombre de champs lus.
- **originaux.jsonl** : les valeurs relevées avant chaque langue, utiles pour une restauration manuelle. Aucun bouton de restauration automatique n’est fourni.
- **execution.log** : avancement et éventuelle erreur.
- **erreur.png** en cas d’erreur : capture de la fenêtre CARL pour diagnostic.

Les sauvegardes déjà confirmées restent dans CARL si une erreur survient ensuite. Les champs saisis depuis la dernière sauvegarde peuvent rester visibles dans la fenêtre ; le programme laisse celle-ci ouverte. Les rapports sont des données de l’entreprise, stockées dans ce dossier, donc dans l’emplacement OneDrive choisi pour le projet. Le navigateur utilise une session temporaire sans profil Chrome persistant ni export des cookies.

## Commandes avancées

```text
node carl.cjs --audit --profiles BUYER --languages fr_FR,en_GB
node carl.cjs --apply --profiles BUYER
node carl.cjs --apply
node --test tests.cjs
```

Pour un environnement de qualification : ajoutez `--url https://votre-serveur/gmao/`. Le programme ne change jamais d’environnement de sa propre initiative.

Documentation de la dépendance : [Playwright — locators](https://playwright.dev/docs/locators).
