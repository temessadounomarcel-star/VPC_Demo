# Simulation d'un VPC avec Docker

**Projet pédagogique — Réseaux privés, communication entre services et segmentation réseau**

## 1. Présentation du projet

Ce projet consiste à simuler localement certains principes d'un réseau privé cloud (*Virtual Private Cloud — VPC*) à l'aide de Docker.

L'architecture repose sur trois conteneurs :

- **Web :** Nginx, pour servir une page HTML et rediriger les requêtes vers l'API.
- **API :** Node.js avec Express, pour traiter les requêtes et communiquer avec la base de données.
- **Base de données :** MySQL, pour stocker les données et exécuter les requêtes SQL.

L'objectif est de comprendre comment les services peuvent communiquer sur des réseaux privés distincts, tout en limitant l'exposition des ports.

> **Important :** cette simulation utilise des réseaux Docker locaux. Elle illustre certains concepts d'un VPC, mais ne crée pas de véritable VPC sur Google Cloud Platform (GCP).

## 2. Objectifs pédagogiques

- Comprendre le fonctionnement d'un réseau Docker de type `bridge`.
- Connecter plusieurs conteneurs à un même réseau.
- Faire communiquer Nginx, Node.js et MySQL.
- Utiliser les noms des conteneurs pour les communications internes.
- Séparer les services dans plusieurs réseaux.
- Limiter l'exposition des ports sur la machine hôte.
- Vérifier la connectivité et diagnostiquer les erreurs réseau.

## 3. Architecture réseau

L'architecture utilise deux réseaux Docker :

- `web-network` : connecte Nginx et l'API Node.js.
- `data-network` : connecte l'API Node.js et MySQL.

L'API est le seul service applicatif connecté aux deux réseaux.

```text
                  UTILISATEUR
                       |
                       | HTTP : localhost:8080
                       v
             +--------------------+
             |   NGINX / WEB      |
             |  vpc-container     |
             +--------------------+
                       |
                       | web-network
                       v
             +--------------------+
             |    API NODE.JS     |
             | vpc-api-container  |
             +--------------------+
                       |
                       | data-network
                       v
             +--------------------+
             |       MYSQL        |
             |  mysql-container   |
             +--------------------+
```

### Répartition des réseaux

| Conteneur | `web-network` | `data-network` |
|---|---|---|
| `vpc-container` (Nginx) | Oui | Non |
| `vpc-api-container` (Node.js) | Oui | Oui |
| `mysql-container` (MySQL) | Non | Oui |

Cette organisation limite la connectivité directe : Nginx et MySQL ne partagent pas de réseau Docker. L'API sert d'intermédiaire entre les deux.

## 4. Technologies utilisées

| Technologie | Rôle |
|---|---|
| Docker | Exécution des services dans des conteneurs |
| Docker Bridge Network | Communication entre conteneurs |
| Nginx | Serveur Web et proxy inverse |
| Node.js | Exécution de l'API |
| Express | Création des routes HTTP |
| MySQL 8.4 | Gestion de la base de données |
| PowerShell | Exécution des commandes sous Windows |

## 5. Ports et communication

| Service | Port interne | Port publié sur l'hôte |
|---|---:|---|
| Nginx | 80 | 8080 |
| API Node.js | 3000 | Aucun |
| MySQL | 3306 | Aucun |

Seul Nginx publie un port sur la machine hôte :

```text
http://localhost:8080
```

La configuration Nginx redirige les requêtes préfixées par `/api/` vers l'API Node.js :

```nginx
location /api/ {
    proxy_pass http://vpc-api-container:3000/;
    proxy_set_header Host $host;
    proxy_set_header X-Real-IP $remote_addr;
}
```

Les services communiquent sur leurs réseaux Docker respectifs. Les ports internes de l'API et de MySQL ne sont pas directement publiés sur Windows.

## 6. Installation et lancement

### Prérequis

- Windows 10 ou Windows 11.
- Docker Desktop installé et démarré.
- PowerShell.
- Les fichiers du projet : `index.html`, `nginx.conf`, le `Dockerfile` Web, ainsi que le dossier `api`.

### Construire l'image Web

Depuis le dossier du projet :

```powershell
docker build -t vpc-demo .
```

### Construire l'image de l'API

```powershell
docker build -t vpc-api .\api
```

### Créer les réseaux

```powershell
docker network create web-network
docker network create data-network
```

Si les réseaux existent déjà, ne les recrée pas.

### Démarrer MySQL

Pour une nouvelle instance de démonstration :

```powershell
docker run -d `
  --name mysql-container `
  --network data-network `
  -e MYSQL_ROOT_PASSWORD="ChangeThisForDemo!" `
  -e MYSQL_DATABASE=demo_db `
  mysql:8.4
```

Cette commande est destinée à une installation neuve. Si `mysql-container` existe déjà, conserve-le afin de préserver son état et ses données.

### Démarrer l'API

```powershell
docker run -d `
  --name vpc-api-container `
  --network data-network `
  vpc-api
```

Connecter ensuite l'API au réseau Web :

```powershell
docker network connect web-network vpc-api-container
```

**Configuration requise :** le code de l'API doit utiliser `mysql-container` comme hôte MySQL et un mot de passe correspondant à la configuration réelle de MySQL.

### Démarrer Nginx

```powershell
docker run -d `
  --name vpc-container `
  --network web-network `
  -p 8080:80 `
  vpc-demo
```

## 7. Tests et vérifications

### Vérifier les conteneurs actifs

```powershell
docker ps
```

### Vérifier les réseaux

```powershell
docker network inspect web-network
docker network inspect data-network
```

### Vérifier les ports publiés

```powershell
docker port vpc-container
docker port vpc-api-container
docker port mysql-container
```

Seul le conteneur Web doit afficher un mappage de port vers la machine hôte.

### Tester l'API et MySQL

```powershell
docker exec vpc-api-container node -e "fetch('http://localhost:3000').then(r=>r.text()).then(console.log).catch(console.error)"
```

La réponse attendue contient notamment :

```json
{
  "message": "API Node.js opérationnelle",
  "mysql": "Connexion réussie"
}
```

### Tester le site Web

Ouvrir dans le navigateur :

- Page Web : `http://localhost:8080`
- API via Nginx : `http://localhost:8080/api/`

La seconde URL doit renvoyer la réponse JSON de l'API si la configuration et les communications sont opérationnelles.

## 8. Sécurité et limites

Cette simulation met en pratique plusieurs principes :

- **Segmentation réseau :** séparation des services Web et base de données.
- **Réduction de l'exposition :** absence de publication directe des ports 3000 et 3306 sur l'hôte.
- **Intermédiaire applicatif :** l'API permet au Web d'accéder aux données sans connexion directe de Nginx à MySQL.

Cependant, ces mesures ne suffisent pas à garantir une sécurité complète.

Pour aller plus loin :

- Utiliser un compte MySQL dédié à l'application, avec des privilèges limités.
- Éviter d'inscrire les mots de passe en clair dans le code ou dans le dépôt Git.
- Utiliser des variables d'environnement ou un gestionnaire de secrets.
- Ajouter des contrôles d'accès et une validation des entrées dans l'API.
- Prévoir une persistance explicite des données MySQL avec un volume Docker.
- Vérifier les journaux, la disponibilité des services et la gestion des erreurs.

Un réseau Docker `bridge` n'est pas un pare-feu applicatif complet. La segmentation limite les chemins de communication, mais ne remplace pas les contrôles d'accès au niveau des applications et des services.

## 9. Différence entre Docker et un VPC Google Cloud

| Élément | Simulation Docker | Google Cloud |
|---|---|---|
| Réseau privé | Réseau Docker `bridge` | VPC Google Cloud |
| Sous-réseaux | Sous-réseaux IP Docker | Sous-réseaux régionaux du VPC |
| Connectivité | Réseaux de conteneurs | Routes et règles de pare-feu cloud |
| Ressources | Conteneurs locaux | VM, services cloud et autres ressources compatibles |
| Portée | Environnement local | Infrastructure cloud |

Cette simulation aide à comprendre la segmentation et les communications réseau. Elle ne remplace pas une configuration réelle de VPC, de sous-réseaux, de routes et de règles de pare-feu dans Google Cloud.

## 10. Conclusion

Ce projet montre comment organiser une application composée de plusieurs services dans des conteneurs Docker, en séparant le réseau Web du réseau de données.

Il constitue une première étape pratique pour comprendre les principes de segmentation réseau, de connectivité privée et de réduction de l'exposition des services avant de les étudier dans un véritable environnement cloud.

---

**Nom du projet :** `VPC-demo`  
**Type :** Simulation pédagogique locale  
**Plateforme :** Docker Desktop sous Windows  
**Objectif :** Comprendre les principes réseau inspirés des VPC cloud.
