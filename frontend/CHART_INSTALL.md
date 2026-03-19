# Installer Chart.js en local (optionnel)

Pour que les graphiques fonctionnent sans connexion internet :

1. Télécharge Chart.js depuis :
   https://cdn.jsdelivr.net/npm/chart.js@4.4.0/dist/chart.umd.min.js

2. Enregistre le fichier ici :
   frontend/js/vendors/chart.min.js

3. Dans index.html, remplace cette ligne :
   <script src="https://cdn.jsdelivr.net/npm/chart.js@4.4.0/..."></script>
   
   Par :
   <script src="js/vendors/chart.min.js"></script>

Sans cette étape, les graphiques sont désactivés automatiquement
mais TOUT LE RESTE fonctionne normalement.
