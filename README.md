# OnlyStreaming

Site de streaming type Netflix en HTML/CSS/JavaScript vanilla, avec Firebase
Authentication, Firestore, Storage-ready, favoris utilisateur, lecteur video,
admin simple, recherche et recommandations par categorie.

## Configuration

1. Cree un projet Firebase.
2. Active Authentication > Email/Password.
3. Active Firestore Database.
4. Active Storage si tu veux heberger posters/videos.
5. Dans Firebase, ajoute une Web App et copie la configuration dans `firebase.js`.
6. Publie les rules:

```bash
firebase deploy --only firestore:rules,storage
```

## Admin

Pour autoriser un compte a ajouter des films:

1. Connecte-toi une premiere fois avec ce compte.
2. Copie son `uid` depuis Authentication.
3. Dans Firestore, cree le document `admins/{uid}` avec par exemple:

```json
{
  "role": "admin"
}
```

## Lancer en local

```bash
firebase serve
```

ou, pour un serveur statique simple:

```bash
npx serve .
```

## Deploiement

```bash
firebase deploy
```

Le site sera disponible sur l'URL Firebase Hosting du projet.
