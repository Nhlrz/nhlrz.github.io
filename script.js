(function() {
    "use strict";

    // ---------- Configuration ----------
    const AVAILABLE_LANGS = ['fr', 'en', 'ja'];
    const DEFAULT_LANG = 'fr';

    // ---------- Détermination de la langue (priorité) ----------
    function getPreferredLanguage() {
        // 1. GET
        const urlParams = new URLSearchParams(window.location.search);
        let lang = urlParams.get('lang');
        if (lang && AVAILABLE_LANGS.includes(lang)) {
            localStorage.setItem('prefLang', lang);
            return lang;
        }

        // 2. POST (simulé via un paramètre de formulaire)
        //    On vérifie si un champ caché 'lang' a été soumis (via un POST factice)
        //    En statique, on peut utiliser un cookie ou sessionStorage, mais on va utiliser
        //    un mécanisme: si le formulaire a été soumis, on aurait un paramètre POST.
        //    Ici, on va vérifier sessionStorage pour un flag "post_lang" qui serait défini par le submit.
        //    (Dans la pratique, on peut intercepter le submit du formulaire pour définir ce flag)
        const postLang = sessionStorage.getItem('post_lang');
        if (postLang && AVAILABLE_LANGS.includes(postLang)) {
            localStorage.setItem('prefLang', postLang);
            sessionStorage.removeItem('post_lang');
            return postLang;
        }

        // 3. Session (localStorage)
        const stored = localStorage.getItem('prefLang');
        if (stored && AVAILABLE_LANGS.includes(stored)) {
            return stored;
        }

        // 4. Préférences du navigateur
        const navLangs = navigator.languages || [navigator.language];
        for (let nl of navLangs) {
            const base = nl.split('-')[0]; // 'fr' de 'fr-FR'
            if (AVAILABLE_LANGS.includes(base)) {
                localStorage.setItem('prefLang', base);
                return base;
            }
        }

        // 5. Défaut
        localStorage.setItem('prefLang', DEFAULT_LANG);
        return DEFAULT_LANG;
    }

    const currentLang = getPreferredLanguage();

    // ---------- Mise à jour de l'URL (pour refléter le GET) ----------
    function updateUrl(lang) {
        const url = new URL(window.location);
        url.searchParams.set('lang', lang);
        window.history.replaceState({}, '', url);
    }
    updateUrl(currentLang);

    // ---------- Chargement du JSON et application du contenu ----------
    async function loadContent(lang) {
        try {
            const response = await fetch('data.json');
            if (!response.ok) throw new Error('Impossible de charger data.json');
            const data = await response.json();

            // Mettre à jour le texte de tous les éléments avec data-i18n
            const elements = document.querySelectorAll('[data-i18n]');
            elements.forEach(el => {
                const key = el.getAttribute('data-i18n');
                const translation = data[lang]?.[key];
                if (translation !== undefined) {
                    // On remplace le contenu (pour les listes, on peut gérer du HTML)
                    el.innerHTML = translation;
                }
            });

            // Mettre à jour les métadonnées schema.org (ex: itemprop)
            // Ici on suppose que les valeurs sont déjà dans les éléments data-i18n,
            // donc déjà mises à jour. On peut aussi forcer l'attribut lang sur les éléments.

            // Attribut lang de la page
            document.documentElement.lang = lang;

            // Générer les liens alternatifs dans le <head>
            updateAlternateLinks(lang);

            // Gérer les sous-titres de la vidéo
            updateVideoSubtitles(lang);

            // Mettre à jour les titres des pages et autres meta
            document.title = data[lang]?.title || 'Portfolio';

        } catch (error) {
            console.error('Erreur de chargement du contenu :', error);
        }
    }

    // ---------- Liens alternatifs (hreflang) ----------
    function updateAlternateLinks(currentLang) {
        // Supprimer les anciens liens alternatifs
        document.querySelectorAll('link[rel="alternate"][hreflang]').forEach(el => el.remove());

        const baseUrl = window.location.href.split('?')[0]; // URL sans paramètres
        AVAILABLE_LANGS.forEach(lang => {
            if (lang === currentLang) return; // On ne met pas le lien vers soi-même (facultatif)
            const link = document.createElement('link');
            link.rel = 'alternate';
            link.hreflang = lang;
            link.href = baseUrl + '?lang=' + lang;
            document.head.appendChild(link);
        });

        // Ajouter aussi un lien x-default (optionnel)
        const xDefault = document.createElement('link');
        xDefault.rel = 'alternate';
        xDefault.hreflang = 'x-default';
        xDefault.href = baseUrl + '?lang=' + DEFAULT_LANG;
        document.head.appendChild(xDefault);
    }

    // ---------- Vidéo : changement des sous-titres ----------
    function updateVideoSubtitles(lang) {
        const video = document.getElementById('presentation-video');
        if (!video) return;

        // Attendre que les pistes soient chargées
        if (video.readyState < 2) {
            video.addEventListener('loadedmetadata', function() {
                setActiveTrack(video, lang);
            });
        } else {
            setActiveTrack(video, lang);
        }
    }

    function setActiveTrack(video, lang) {
        const tracks = video.textTracks;
        for (let i = 0; i < tracks.length; i++) {
            const track = tracks[i];
            if (track.language === lang) {
                track.mode = 'showing';
            } else {
                track.mode = 'hidden';
            }
        }
    }

    // ---------- Changement de langue (boutons & POST) ----------
    function setLanguage(lang) {
        if (!AVAILABLE_LANGS.includes(lang)) return;
        // Stockage en session pour simuler POST
        sessionStorage.setItem('post_lang', lang);
        // Rediriger avec GET pour respecter la priorité
        const url = new URL(window.location);
        url.searchParams.set('lang', lang);
        window.location.href = url.toString();
    }

    // Écoute des clics sur les boutons de langue
    document.querySelectorAll('#lang-switcher button').forEach(btn => {
        btn.addEventListener('click', function(e) {
            e.preventDefault();
            const lang = this.getAttribute('data-lang');
            setLanguage(lang);
        });
    });

    // Gestion du formulaire POST (pour simuler un POST)
    // On va intercepter la soumission du formulaire (si jamais il est utilisé)
    const postForm = document.getElementById('post-form');
    if (postForm) {
        postForm.addEventListener('submit', function(e) {
            e.preventDefault();
            const langInput = document.getElementById('post-lang');
            if (langInput) {
                const lang = langInput.value;
                if (AVAILABLE_LANGS.includes(lang)) {
                    sessionStorage.setItem('post_lang', lang);
                    // Rediriger avec GET
                    const url = new URL(window.location);
                    url.searchParams.set('lang', lang);
                    window.location.href = url.toString();
                }
            }
        });
    }

    // ---------- Initialisation ----------
    // Charger le contenu pour la langue détectée
    loadContent(currentLang);

    // Option : si l'utilisateur change de langue via un lien ?lang=, on recharge
    // déjà via le rechargement de la page. Mais on peut aussi écouter les changements d'URL (pushState) si besoin.

})();
