# Vérifications — 23 octobre 2026 — V1.0.0

- Session CARL réelle inspectée : 25 profils, dont 20 modifiables et 5 standard.
- Profils standard constatés : DEFAULT, MANAGER, MENU, PURCHASER, REQUESTER. Le champ Code est en lecture seule et la disquette n’est pas présente ; le programme les ignore.
- Widgets rencontrés : Favoris, Indicateurs, Graphique, Rapports et Site externe. Plusieurs widgets du même type existent dans WAREHOUSEMAN.
- 122 textes distincts relevés dans les widgets des profils modifiables. Le dictionnaire comporte également les libellés de ces profils.
- Les six codes et les messages de confirmation ont été vérifiés dans CARL : fr_FR, en_GB, de_DE, en_US, es_ES, es_MX.
- L’intitulé français « English, Australia » correspond à en_GB. Le programme utilise le code réel et vérifie ce code après chaque changement.
- L’indicateur MR_BY_ME_AWAINGREAL a servi à distinguer les demandes d’intervention des ordres de travail dans un titre ambigu.

## Modifications réalisées pour les essais dans CARL

Uniquement sur le profil BUYER, widget Favoris :

| Langue | Champ | Avant | Après |
|---|---|---|---|
| en_GB | Titre | FAVORITES | Favourites |
| fr_FR | Titre | FAVORITES | Favoris |
| fr_FR | Première ligne de favori | DI en cours | Demandes d'intervention en cours |

Ces essais ont été sauvegardés avec la disquette. Les deux valeurs françaises ont été relues après l’action « Rafraîchir les données ». Le titre français distinct a confirmé l’indépendance des versions française et anglaise. La session a été remise en français. Aucune correction en masse des autres profils n’a été exécutée.

## Tests du code

Huit tests automatiques passent : reconnaissance de Standard, intégrité et longueur du dictionnaire, distinction de widgets identiques, texte inconnu, changement d’identité d’une ligne, ordre sauvegarde/rafraîchissement/relecture, refus de poursuivre après une sauvegarde perdue, rejet des valeurs invalides.

Le script principal passe la vérification de syntaxe et la commande d’aide s’exécute. Le parcours autonome complet avec une nouvelle connexion Chrome reste à valider. Les essais dans CARL ont utilisé le navigateur intégré de cette conversation.

## Adaptation WSL — V1.1.0

Ubuntu-24.04 sous WSL 2 : Node.js 24.15.0 et npm 11.12.1 déjà présents. Playwright 1.60.0 a été installé dans `/home/sam/.local/share/carl-traduction/runtime`. Son Chromium 1223 déjà en cache est disponible, WSLg expose l’affichage `:0`, et `ldd` ne relève aucune bibliothèque manquante. Le diagnostic du lanceur réussit et les huit tests passent dans Ubuntu. Aucune installation Windows ni commande sudo n’a été exécutée. La première exécution complète connectée sous WSL reste à valider.

## Fenêtre native et correctif des réponses — V1.2.1

Le lancement WSL normal utilise désormais Node.js et Playwright Windows déjà fournis par Codex, puis ouvre Google Chrome Windows. Ce parcours a été vérifié dans la session réelle : connexion manuelle de l’utilisateur, accès à la liste des profils et audit de BUYER en français terminé. Un échec de relecture de réponse AJAX au retour à la liste a ensuite été corrigé.

Le correctif distingue les navigations des réponses AJAX et conserve ces dernières en mémoire avant leur remise au navigateur. La requête est transmise une seule fois, sans retry automatique. Les erreurs serveur et le contrôle de sauvegarde restent actifs.

Les 17 tests unitaires passent, ainsi qu’un test d’intégration avec Chrome sur un faux serveur local : navigation immédiatement après AJAX, ancienne réponse simulée comme supprimée, contenu toujours contrôlable, nombre de POST exactement conforme. La correction finale a été vérifiée sur ce serveur de test ; l’exécution complète des six langues dans CARL reste à valider.

## Changement de langue — V1.2.2

Après l’audit français de BUYER, le contrôle immédiat du code en_GB pouvait s’exécuter pendant la reconstruction de la page. La capture enregistrée montrait déjà le champ Search en anglais, avec le reste de l’écran encore en cours de chargement. L’attente repose désormais sur un état final explicite : langue exacte, document chargé, sélecteur renseigné et même profil visible. Les confirmations tardives sont prises en compte sans répéter la sélection de langue.

Les 17 tests unitaires et les quatre tests Chrome d’intégration passent, soit 21 au total. Les trois nouveaux cas couvrent une page intermédiaire sans code de langue, une confirmation retardée et le refus d’accepter une mauvaise langue ou un mauvais profil. L’inspection de la fenêtre réelle a été interrompue par l’outil, qui ne pouvait pas vérifier l’URL ; le parcours réel des six langues n’a pas été rejoué avec cette version.

## Listes et lecture des widgets — V1.2.3

Le rapport réel V1.2.2 de BUYER confirme désormais la lecture de 4 widgets et de 12 champs dans chacune des six langues. Le profil BUYER_LABO apparaît dans la capture prise après l’arrêt, malgré le message « Profil introuvable ». La recherche utilisait une liste potentiellement encore absente ou incomplète juste après le retour depuis le détail.

Le programme attend maintenant le tableau de résultats visible et le nombre exact de lignes annoncé par sa pagination. Les identifiants de conteneur générés et les espaces autour des codes sont pris en compte. Les changements de pagination attendent aussi leur nouveau numéro.

Les widgets attendent leur titre, leurs boutons actifs et le nombre complet de libellés annoncé. Les fenêtres sont maintenues visibles au moins 1,2 seconde après chargement, et leurs champs sont consignés dans lectures.csv avant fermeture. L’audit utilise ensuite ces lectures sans rouvrir les fenêtres pour calculer ses différences.

Les 18 tests unitaires et les huit tests Chrome d’intégration passent, soit 26 au total. Les nouveaux tests reproduisent le retour retardé de BUYER vers une liste contenant BUYER_LABO, un identifiant généré différent, une liste cachée ou partielle, un widget dont les sept lignes arrivent en plusieurs étapes et une pagination retardée. Le passage réel au deuxième profil avec cette version reste à confirmer.

## Reconstruction après sauvegarde — V1.2.4

Le rapport réel du 23 octobre à 14:02 UTC contient les saisies françaises de BUYER, sans confirmation de sauvegarde. La capture montre un écran en reconstruction. L’ancienne version lisait immédiatement le code de langue après le rafraîchissement ; elle pouvait aussi lire les engrenages pendant une navigation. La pile technique n’était pas conservée : le point exact de cette ancienne erreur ne peut pas être établi avec certitude.

La correction attend le même profil et la bonne langue avec un tableau complet avant et après la disquette. Après le clic sur Actualiser, elle attend que l’ancien champ de description soit remplacé ou que son document soit détruit, puis attend de nouveau le profil chargé. Les erreurs de contexte détruit sont reprises uniquement dans les lectures ciblées, jamais dans les clics, les saisies ou les POST. Un rafraîchissement qui ne remplace pas l’écran provoque un arrêt.

Les étapes disquette, rafraîchissement et relecture sont maintenant affichées ; le rapport distingue la transmission de la disquette de la sauvegarde effectivement vérifiée. Les prochains arrêts conservent également la pile dans erreur-technique.log.

Validation : 20 tests unitaires et 11 tests Chrome sur serveur fictif, soit 31 tests. Les nouveaux scénarios vérifient la sauvegarde suivie d’une navigation différée, le remplacement AJAX différé et l’arrêt si l’écran n’est pas remplacé, avec exactement une sauvegarde et un rafraîchissement. Le parcours de correction complet dans CARL reste à confirmer ; les saisies du précédent lancement ne sont pas déclarées sauvegardées sans relecture serveur.

## Activation des lignes éditables — V1.2.5

Le lancement réel de la V1.2.4 confirme la sauvegarde française de BUYER, après rafraîchissement et relecture des quatre widgets. L’arrêt suivant concerne l’activation du deuxième favori anglais. L’ancien contrôle comparait le champ à son état avant activation, mais son identité provenait de tous les éléments portant un title technique, y compris les conteneurs et contrôles de recherche. Le rapport ancien ne contient pas l’identité relue après activation : la différence exacte à l’origine de cet arrêt ne peut donc pas être établie avec certitude.

La lecture et la saisie des champs sont regroupées dans champs.cjs. Les identités utilisent les valeurs des champs et des spans terminaux, des clés techniques fixes et des valeurs dédoublonnées. Un contrôle de recherche n’est pas un code ; une représentation absente d’une valeur optionnelle vide correspond à une valeur vide. Deux codes non vides contradictoires provoquent un arrêt. Le composant, le formulaire, la personnalisation et les références de rapport restent contrôlés.

Le champ est contrôlé avant puis après activation, avec conservation de la comparaison exacte du libellé. Une erreur d’identité conserve maintenant les états attendus et observés dans erreur-technique.log. Aucun contournement du contrôle n’a été ajouté.

Validation : 20 tests unitaires et 15 tests Chrome, soit 35 tests. Les quatre nouveaux tests exécutent la fonction de saisie utilisée par le programme sur deux lignes successives de favoris et de rapports, avec remplacement différé span/input, conteneur de champ, bouton de recherche et valeur optionnelle vide. Ils vérifient aussi l’arrêt avant remplissage si le formulaire ou le texte change et le refus de fusionner des codes contradictoires. Ces cas sont fictifs : le passage effectif au deuxième favori anglais dans CARL reste à confirmer.

## Champ absent de la lecture après activation — V1.2.6

Le diagnostic réel de la V1.2.5 contient expected avec l’identité du deuxième favori anglais, mais live:null. La pile situe l’erreur au contrôle après activation. Le champ input avait pourtant été trouvé par son identifiant à l’étape précédente : le filtre de lecture n’a pas retrouvé le champ activé. Aucun changement de formulaire n’est prouvé par cette erreur. La V1.2.5 ne consignait pas les attributs du champ exclu, donc l’absence de type explicite ou d’infobulle constitue une explication couverte par le correctif, sans preuve permettant de choisir entre ces variantes.

La lecture utilise maintenant la propriété HTML type, qui vaut text pour un input sans attribut type. Si l’infobulle manque, seuls les deux suffixes d’identifiant connus des libellés de favoris et rapports permettent de retrouver leur liaison. Une liaison explicitement différente n’est pas remplacée. Les codes de ligne et le libellé restent comparés avant et après activation ; aucune permission générale de modifier un champ inconnu n’est ajoutée. L’attente de chargement du widget reconnaît aussi ces variantes. Un futur diagnostic live:null inclura les attributs et la valeur de l’élément retrouvé par son identifiant.

Validation : 20 tests unitaires et 18 tests Chrome, soit 38 tests. Les trois nouveaux tests couvrent les favoris et rapports sur deux lignes successives, avec type absent, infobulle absente et les deux absents, ainsi que le chargement d’un widget complet avec ces variantes. Les scénarios de modification concurrente des codes ou du texte restent bloquants. Les données de test sont fictives ; la correction anglaise réelle reste à confirmer. La sauvegarde française de BUYER est confirmée par le rapport utilisateur.

## Reprise depuis un profil inclus — V1.3.0

Les menus Windows et WSL demandent désormais un code de profil de départ après le choix audit/correction. Une saisie vide sélectionne toute la liste. L’option directe --start-profile permet le même choix sans invite. Après lecture de la liste CARL, la sélection conserve son ordre et commence par le profil saisi, inclus, jusqu’au dernier. La casse et les espaces autour du code sont tolérés. Les profils standard restent dans la sélection et sont ignorés au moment du traitement, comme auparavant. La reprise recommence les langues du profil de départ ; elle ne restaure pas une session interrompue.

Un profil inconnu bloque le traitement avant toute ouverture de profil. --profiles reste une sélection explicite et ne peut pas se combiner avec un profil de départ. Le journal affiche le profil de départ et le nombre de profils sélectionnés, standards compris.

Validation : 24 tests de tests.cjs réussis, dont quatre nouveaux cas couvrant l’inclusion du point de départ, l’ordre CARL, le dernier profil, la saisie vide et les options incompatibles. Le contrôle syntaxique de carl.cjs réussit. L’invite a été exécutée avec BUYER_LABO en mode diagnostic, sans ouvrir CARL ; le diagnostic Windows réussit. Les tests Chrome des widgets n’ont pas été rejoués pour ce changement de sélection.
