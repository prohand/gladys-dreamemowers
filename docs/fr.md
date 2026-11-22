# Dreame Mowers

Pilotez vos robots tondeuses **Dreame** et **MOVA** depuis Gladys Assistant :
état, batterie, démarrage, pause, retour à la base, scènes et widget de
tableau de bord.

Les tondeuses n'ont pas d'API locale : comme l'application Dreame,
l'intégration passe par le **cloud Dreame** (connexion internet nécessaire).

## Tondeuses compatibles

Toute tondeuse liée à un compte Dreamehome ou MOVAhome dont le modèle commence
par `dreame.mower.` ou `mova.mower.` : Dreame A1, A1 Pro, A2, A3 AWD, MOVA
600, 1000, LiDAX, Viax… Un modèle absent de cette liste apparaît quand même,
sous son nom technique.

## Configuration

1. Ouvrez l'onglet **Configuration** de l'intégration.
2. **Application** : Dreamehome ou MOVAhome, celle où votre compte a été créé.
3. **E-mail** et **Mot de passe** de ce compte.
   Un compte créé avec « Se connecter avec Google / Apple » n'a pas de mot de
   passe : définissez-en un d'abord dans l'application (Profil → Compte et
   sécurité).
4. **Région** : la région choisie à la création du compte (Europe pour la
   plupart des utilisateurs européens).
5. **Langue des états** : langue des textes État et Erreur.
6. **Intervalle de rafraîchissement** : fréquence de lecture du cloud, une
   minute minimum.
7. Cliquez sur **Tester la connexion** : les tondeuses trouvées s'affichent
   sous le bouton.
8. Ouvrez l'onglet **Découverte** et ajoutez vos tondeuses.

## Ce que montre chaque tondeuse

| Fonction       | Type               | Usage                                        |
| -------------- | ------------------ | -------------------------------------------- |
| Mowing         | interrupteur       | Marche = tondre, Arrêt = pause               |
| Return to base | interrupteur       | Marche = retour à la base                    |
| Status         | texte              | Tonte en cours, En pause, En charge…         |
| Battery        | batterie (%)       | Niveau de charge                             |
| Charging       | batterie (binaire) | 1 pendant la charge                          |
| Error          | texte              | « Aucune erreur », « Tondeuse coincée (2) »… |

Un badge sur chaque appareil indique si la tondeuse répond via le cloud
(**cloud**) ou non (**injoignable** : hors Wi-Fi / 4G, éteinte…).

## Scènes

Dans la catégorie **Intégrations** de l'éditeur de scènes :

- **L'état de la tondeuse change** (déclencheur) — quand la tondeuse démarre,
  se met en pause, rentre, se gare ou s'arrête sur erreur. Choisissez si besoin
  la tondeuse et le nouvel état. Variables : `{{triggerEvent.data.status}}`,
  `{{triggerEvent.data.previous_status}}`, `{{triggerEvent.data.battery}}`.
- **La tondeuse signale une erreur** (déclencheur) — une nouvelle erreur
  (coincée, penchée, lame bloquée…). Variables :
  `{{triggerEvent.data.error_code}}`, `{{triggerEvent.data.error_text}}`.
- **Piloter une tondeuse** (action) — démarrer, mettre en pause, arrêter ou
  renvoyer à la base. Sa sortie **Commande envoyée** indique si le cloud a
  accepté la commande.

Exemples : recevoir une notification quand la tondeuse est coincée ; la
renvoyer à la base quand la pluie arrive ; la lancer chaque matin quand
personne n'est dans le jardin.

## Widget de tableau de bord

Ajoutez la boîte **Robot tondeuse** à un tableau de bord : batterie, état,
erreur, connexion et trois boutons (Tondre, Pause, À la base). Dans ses
réglages, choisissez la tondeuse à afficher (vide : la première du compte).

## Dépannage

- **Connexion refusée** : vérifiez l'e-mail, le mot de passe, l'application
  (Dreamehome ou MOVAhome) et la région. Connectez-vous une fois dans
  l'application avec les mêmes identifiants.
- **Aucune tondeuse trouvée** : la tondeuse doit apparaître dans l'application
  de ce même compte (une tondeuse partagée apparaît aussi).
- **Injoignable** : la tondeuse n'est pas connectée au cloud. Vérifiez son
  Wi-Fi ou sa 4G et qu'elle est allumée.
- **L'état change en retard** : le cloud est lu à l'intervalle choisi ; après
  une commande, la tondeuse est relue 5 secondes plus tard.

## Confidentialité

Le mot de passe est stocké dans un champ secret de Gladys et envoyé, haché,
uniquement au cloud Dreame. Rien d'autre ne sort de votre Gladys.
