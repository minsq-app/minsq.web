/* ══════════════════════════════════════════════════════════════
   SHARED.JS — Minsq
   Injeta em TODAS as páginas internas:
     · Auth guard
     · Sidebar com navegação e botão admin condicional
     · Cursor animado (respeita preferência do usuário)
     · Context menu customizado + scroll indicator
     · Hotkeys globais (1-0, H, J, F)

   COMO USAR:
     <script src="shared.js"></script>
     Coloque antes do </body> em qualquer página interna.

   Páginas PUBLIC (sem sidebar/guard): login, register,
   forgot-password, reset-password, onboarding.
══════════════════════════════════════════════════════════════ */

(function () {
  'use strict';

  // Detecção de IFrame e Root Shell
  var IS_IN_IFRAME = window.self !== window.top;
  var IS_ROOT = !IS_IN_IFRAME
    && location.pathname.indexOf('/pages/') === -1
    && location.pathname.indexOf('/auth/') === -1
    && location.pathname.indexOf('/api/') === -1;
  var basePath = '/pages/';
  var assetsPath = '/assets/';

  if (typeof window !== 'undefined' && !window.api) {
    var apiScript = document.createElement('script');
    apiScript.src = basePath + 'api-client.js';
    document.head.appendChild(apiScript);
  }

  /* ════════════════════════════════════════════
     CONFIGURAÇÃO
  ════════════════════════════════════════════ */
  var PUBLIC_PAGES = ['auth.html', 'forgot-password.html', 'reset-password.html', 'onboarding.html', 'index.html', 'logout.html', 'confirm-account.html'];
  var _rawFile = location.pathname.split('/').pop() || 'index.html';
  var CURRENT_FILE = _rawFile.indexOf('.html') === -1 && _rawFile !== '' ? _rawFile + '.html' : (_rawFile || 'index.html');
  var IS_PUBLIC = PUBLIC_PAGES.indexOf(CURRENT_FILE) !== -1;

  // ── PROTEÇÃO GLOBAL CONTRA DUPLO CLIQUE ─────────────────────────
  // Bloqueia cliques repetidos em botões e elementos .btn por 900ms.
  // Funciona globalmente via event delegation no document (fase capture).
  (function () {
    var COOLDOWN_MS = 900;
    document.addEventListener('click', function (e) {
      var target = e.target && (
        e.target.closest('button') ||
        e.target.closest('.btn') ||
        e.target.closest('[data-action]')
      );
      if (!target) return;

      // Ignora elementos marcados como excluídos da proteção
      if (target.hasAttribute('data-no-guard')) return;

      if (target._mhGuardLocked) {
        e.stopImmediatePropagation();
        e.preventDefault();
        return;
      }

      target._mhGuardLocked = true;
      var prevPointer = target.style.pointerEvents;
      target.style.pointerEvents = 'none';

      setTimeout(function () {
        target._mhGuardLocked = false;
        target.style.pointerEvents = prevPointer || '';
      }, COOLDOWN_MS);
    }, true); // fase capture: intercepta antes dos handlers normais
  })();

  // ── PROTEÇÃO GLOBAL CONTRA SELEÇÃO DE TEXTO ─────────────────────
  // Bloqueia o highlight azul de seleção em toda a interface.
  // Exceções: inputs, textareas, [contenteditable], [data-selectable].
  (function () {
    if (document.getElementById('mh-no-select-css')) return;
    var style = document.createElement('style');
    style.id = 'mh-no-select-css';
    style.textContent = [
      '*, *::before, *::after {',
      '  -webkit-user-select: none;',
      '  -moz-user-select: none;',
      '  -ms-user-select: none;',
      '  user-select: none;',
      '}',
      'input, textarea, [contenteditable], [data-selectable] {',
      '  -webkit-user-select: text;',
      '  -moz-user-select: text;',
      '  -ms-user-select: text;',
      '  user-select: text;',
      '}'
    ].join('\n');
    document.head.appendChild(style);
  })();

  // ── PREVENIR NAVEGAÇÃO PELO BOTÃO VOLTAR DO NAVEGADOR ────────────────
  // Solicitação explícita: travar na mesma página sempre que tentar voltar.
  (function () {
    window.history.pushState(null, '', window.location.href);
    window.addEventListener('popstate', function () {
      window.history.pushState(null, '', window.location.href);
    });
  })();

  // ── PROTEÇÃO GLOBAL CONTRA TOOLTIPS NATIVOS E PREVIEWS DE DIGITAÇÃO ──────────
  // Remove 'title' para evitar tooltip nativo e desativa autocompletar em inputs
  (function () {
    function applyGlobalRules(el) {
      if (!el || el.nodeType !== 1) return;

      if (el.hasAttribute('title')) {
        el.removeAttribute('title');
      }

      if (el.tagName === 'INPUT' || el.tagName === 'TEXTAREA') {
        if (!el.hasAttribute('autocomplete') || el.getAttribute('autocomplete') !== 'off') el.setAttribute('autocomplete', 'off');
        if (!el.hasAttribute('spellcheck') || el.getAttribute('spellcheck') !== 'false') el.setAttribute('spellcheck', 'false');
        if (!el.hasAttribute('autocorrect') || el.getAttribute('autocorrect') !== 'off') el.setAttribute('autocorrect', 'off');
        if (!el.hasAttribute('autocapitalize') || el.getAttribute('autocapitalize') !== 'off') el.setAttribute('autocapitalize', 'off');
      }

      if (el.tagName === 'A' && el.hasAttribute('href')) {
        var href = el.getAttribute('href');
        // Ignora âncoras falsas, scripts e os links dinâmicos do modal (termos e privacidade)
        if (href && href !== '#' && href.indexOf('javascript:') !== 0 && href !== 'termos.html' && href !== 'privacidade.html') {
          el.setAttribute('data-href', href);
          el.removeAttribute('href');
          el.style.cursor = 'pointer';
          el.addEventListener('click', function (e) {
            e.preventDefault();
            var target = el.getAttribute('target');
            if (target === '_blank') {
              window.open(href, '_blank');
            } else {
              window.location.href = href;
            }
          });
        }
      }

      if (el.children && el.children.length > 0) {
        for (var i = 0; i < el.children.length; i++) {
          applyGlobalRules(el.children[i]);
        }
      }
    }

    function init() {
      applyGlobalRules(document.body);
      var observer = new MutationObserver(function (mutations) {
        mutations.forEach(function (mutation) {
          if (mutation.type === 'childList') {
            for (var i = 0; i < mutation.addedNodes.length; i++) {
              applyGlobalRules(mutation.addedNodes[i]);
            }
          } else if (mutation.type === 'attributes' && mutation.attributeName === 'title') {
            if (mutation.target.hasAttribute('title')) {
              mutation.target.removeAttribute('title');
            }
          }
        });
      });
      observer.observe(document.documentElement, {
        childList: true,
        subtree: true,
        attributes: true,
        attributeFilter: ['title']
      });
    }

    if (document.readyState === 'loading') {
      document.addEventListener('DOMContentLoaded', init);
    } else {
      init();
    }
  })();

  // Immediate Maintenance Redirect to prevent black screen flash
  try {
    const _host = window.location.hostname.toLowerCase();
    const _path = window.location.pathname.toLowerCase();

    // Limpa estado de manutenção se a URL atual ou o top window trouxer flag de saída
    try {
      const _ownSearch = new URLSearchParams(window.location.search);
      let _topSearch = null;
      try { _topSearch = new URLSearchParams(window.top.location.search); } catch (_) { }
      const hasMaintOff = _ownSearch.get('maintenance') === 'off' || _ownSearch.get('maint') === '0' ||
        (_topSearch && (_topSearch.get('maintenance') === 'off' || _topSearch.get('maint') === '0'));

      if (hasMaintOff) {
        localStorage.removeItem('minsq_is_maintenance');
        localStorage.removeItem('minsq_maint_ts');
        sessionStorage.removeItem('minsq_is_maintenance');
        sessionStorage.removeItem('minsq_maint_redirect_attempt');
        const _past = '=; path=/; max-age=0; expires=Thu, 01 Jan 1970 00:00:00 GMT';
        document.cookie = 'minsq_is_maintenance' + _past;
        document.cookie = 'minsq_is_maintenance' + _past + '; domain=.mohi.com.br';
        document.cookie = 'minsq_is_maintenance' + _past + '; domain=mohi.com.br';
      }
    } catch (_) { }

    const isMaintenancePage = _host.startsWith('maintenance.') || _host.startsWith('maintenance-') || _host === 'maintenance.mohi.com.br' || _path.endsWith('/maintenance.html') || _path === '/maintenance';
    const isStatusPage = _host.startsWith('status.') || _host.startsWith('status-') || _host === 'status.mohi.com.br' || _path.endsWith('/status.html') || _path === '/status' || _path.includes('/api/status.html');
    const isWebPage = _host.startsWith('web.') || _host.startsWith('web-') || _host === 'web.mohi.com.br' || _path.endsWith('/web/index.html') || _path === '/web';

    const isExemptFromMaintenance = isMaintenancePage || isStatusPage || isWebPage;

    function redirectToMaintenance() {
      if (window.location.hostname === 'localhost' || window.location.hostname === '127.0.0.1') {
        window.top.location.replace('/pages/api/maintenance.html');
      } else {
        window.top.location.replace('https://maintenance.mohi.com.br');
      }
    }

    if (!isExemptFromMaintenance) {
      // 1. Redirecionamento rápido apenas se houver flag recente (TTL de 15 segundos)
      const isMaintFlag = localStorage.getItem('minsq_is_maintenance') === 'true';
      const maintTs = parseInt(localStorage.getItem('minsq_maint_ts') || '0', 10);
      const isRecent = maintTs > 0 && (Date.now() - maintTs) < 15000;

      if (isMaintFlag && isRecent) {
        redirectToMaintenance();
      }

      // 2. Ping em tempo real em todas as páginas para garantir sincronização real e auto-cura
      fetch('/api/status', { cache: 'no-store' })
        .then(res => res.json())
        .then(data => {
          if (data && data.isMaintenanceMode) {
            localStorage.setItem('minsq_is_maintenance', 'true');
            localStorage.setItem('minsq_maint_ts', String(Date.now()));
            redirectToMaintenance();
          } else if (data && data.isMaintenanceMode === false) {
            localStorage.removeItem('minsq_is_maintenance');
            localStorage.removeItem('minsq_maint_ts');
            sessionStorage.removeItem('minsq_is_maintenance');
            const _past = '=; path=/; max-age=0; expires=Thu, 01 Jan 1970 00:00:00 GMT';
            document.cookie = 'minsq_is_maintenance' + _past;
            document.cookie = 'minsq_is_maintenance' + _past + '; domain=.mohi.com.br';
            document.cookie = 'minsq_is_maintenance' + _past + '; domain=mohi.com.br';
          }
        })
        .catch(() => { });
    }
  } catch (e) { }

  // ── Global Luma Loading Screen (1 second) ───────────
  (function () {
    if (IS_PUBLIC) return;
    var loaderId = 'mh-loader';
    if (document.getElementById(loaderId)) return;

    // Corrida no Ctrl+R: o shared.js do shell (grande, sem cache) pode terminar de carregar
    // DEPOIS do iframe já ter concluído e pedido para esconder o loader. Nesse caso o loader
    // do shell nasceria "órfão" e ficaria girando até o fallback de 8s. Se o filho já
    // sinalizou que terminou, simplesmente não cria o loader.
    if (!IS_IN_IFRAME && window.__mhLoaderHidden) return;

    // Avisa o shell (pai) que a página interna terminou, mesmo que o loader do pai
    // ainda não exista. Usado nos dois caminhos do loader abaixo.
    function _notifyParentHidden() {
      if (!IS_IN_IFRAME) return;
      try {
        window.parent.__mhLoaderHidden = true;
        if (typeof window.parent.hideMhLoader === 'function') window.parent.hideMhLoader();
      } catch (e) { }
    }

    // Dentro do iframe, se o shell (pai) ainda está mostrando o loader (caso do F5),
    // NÃO cria um segundo loader: reaproveita o do pai. Assim há um único spinner
    // contínuo e ele só some quando a página interna chamar hideMhLoader().
    if (IS_IN_IFRAME) {
      var _parentLoader = null;
      try { _parentLoader = window.parent.document.getElementById(loaderId); } catch (e) { }
      if (_parentLoader && !_parentLoader.classList.contains('fade-out')) {
        window.hideMhLoader = function () { _notifyParentHidden(); };
        return;
      }
    }

    var css = [
      '#mh-loader {',
      '  position: fixed; inset: 0; background: #070707; z-index: 100000;',
      '  display: flex; align-items: center; justify-content: center;',
      '  transition: opacity 0.22s ease-out, visibility 0.22s;',
      '  opacity: 1; visibility: visible;',
      '}',
      '#mh-loader.fade-out {',
      '  opacity: 0; visibility: hidden; pointer-events: none;',
      '}',
      '.mh-loader-content {',
      '  display: flex; align-items: center; justify-content: center;',
      '}',
      '.luma-spin {',
      '  position: relative; width: 38px; height: 38px;',
      '}',
      '.luma-spin span {',
      '  position: absolute; border-radius: 50px;',
      '  border: 2px solid #f3f4f6; box-sizing: border-box;',
      '  animation: loaderAnim 2.5s infinite;',
      '}',
      '.luma-spin span:nth-child(2) {',
      '  animation-delay: -1.25s;',
      '}',
      '@keyframes loaderAnim {',
      '  0% { inset: 0 22px 22px 0; }',
      '  12.5% { inset: 0 22px 0 0; }',
      '  25% { inset: 22px 22px 0 0; }',
      '  37.5% { inset: 22px 0 0 0; }',
      '  50% { inset: 22px 0 0 22px; }',
      '  62.5% { inset: 0 0 0 22px; }',
      '  75% { inset: 0 0 22px 22px; }',
      '  87.5% { inset: 0 0 22px 0; }',
      '  100% { inset: 0 22px 22px 0; }',
      '}'
    ].join('\n');

    var style = document.createElement('style');
    style.id = 'mh-loader-style';
    style.textContent = css;
    document.head.appendChild(style);

    var loader = document.createElement('div');
    loader.id = loaderId;
    loader.innerHTML = [
      '<div class="mh-loader-content">',
      '  <div class="luma-spin">',
      '    <span></span>',
      '    <span></span>',
      '  </div>',
      '</div>'
    ].join('\n');
    document.documentElement.appendChild(loader);

    var isHidden = false;
    var startTime = Date.now();

    window.hideMhLoader = function (force) {
      _notifyParentHidden();
      if (isHidden) return;
      isHidden = true;
      if (!IS_IN_IFRAME) window.__mhLoaderHidden = true;
      loader.classList.add('fade-out');
      setTimeout(function () {
        if (loader.parentNode) loader.parentNode.removeChild(loader);
        var st = document.getElementById('mh-loader-style');
        if (st && st.parentNode) st.parentNode.removeChild(st);
      }, 220);
    };

    // Removido o window.onload preemptivo para garantir que o loader só saia quando
    // o conteúdo e as fotos de fundo realmente terminarem de carregar de forma assíncrona.

    // Auto-hide fallback at exactly 8 seconds
    setTimeout(function () { window.hideMhLoader(true); }, 8000);
  })();

  // Sincroniza o tema da sidebar (sb-branco, sb-blackout) em tempo real entre frames e a raiz
  (function () {
    window.syncSidebarTheme = function () {
      try {
        var pref = localStorage.getItem('dc_sb_pref') || 'default';
        var isForced = false;
        var fPages = ['notas.html', 'analytics.html', 'profile.html', 'settings.html'];

        if (window.self !== window.top) {
          var cFile = location.pathname.split('/').pop() || 'index.html';
          isForced = fPages.indexOf(cFile) !== -1;
        } else {
          var pCheck = window._currentIframePage;
          if (!pCheck && location.pathname && location.pathname !== '/' && location.pathname !== '/index.html') {
            pCheck = location.pathname.replace(/^\/+/, '');
          }
          if (!pCheck && location.search) {
            var m = location.search.match(/[?&]page=([^&]+)/);
            if (m) pCheck = m[1];
          }
          if (pCheck && fPages.indexOf(pCheck) !== -1) isForced = true;
        }

        document.body.classList.remove('sb-branco', 'sb-blackout', 'sb-offwhite', 'sb-bege');
        if (isForced) {
          document.body.classList.add('sb-blackout');
        } else if (pref !== 'padrao' && pref !== 'default') {
          document.body.classList.add('sb-' + pref);
        }
      } catch (e) { }
    };
    window.syncSidebarTheme();
    if (document.readyState === 'complete' || document.readyState === 'interactive') {
      window.syncSidebarTheme();
    } else {
      document.addEventListener('DOMContentLoaded', window.syncSidebarTheme);
    }
    window.addEventListener('storage', function (e) {
      if (e.key === 'dc_sb_pref') window.syncSidebarTheme();
    });
  })();

  // Redirecionamento se acessar diretamente a página interna fora do iframe
  if (!IS_IN_IFRAME && !IS_ROOT && !IS_PUBLIC) {
    var _sh = window.location.hostname.toLowerCase();
    var _isSub = _sh.startsWith('web.') || _sh.startsWith('status.') || _sh.startsWith('maintenance.');
    if (_isSub) {
      window.location.replace('https://mohi.com.br/' + CURRENT_FILE.replace(/\.html$/, '') + window.location.search);
      return;
    }
    window.location.replace('/' + CURRENT_FILE.replace(/\.html$/, '') + window.location.search);
    return;
  }

  // Notificar o Shell pai sobre o carregamento da página (seguro contra cross-origin / file://)
  if (IS_IN_IFRAME) {
    // Corrige duplo recuo da barra lateral removendo o padding-left do body dentro do iframe
    function _injectIframeStyles() {
      if (!document.head) { return setTimeout(_injectIframeStyles, 5); }
      var iframeStyle = document.createElement('style');
      iframeStyle.textContent = 'body { padding-left: 0 !important; } [id*="BgLayer"] { left: 0 !important; width: 100% !important; }';
      document.head.appendChild(iframeStyle);
    }
    _injectIframeStyles();

    try {
      parent.postMessage({
        type: 'mh-frame-loaded',
        url: CURRENT_FILE,
        search: window.location.search
      }, window.location.origin);
    } catch (err) { }
  }

  /* Mapa de arquivo → chave de rota */
  var FILE_TO_KEY = {
    'dashboard.html': 'dashboard',
    'hoje.html': 'today',
    'metas.html': 'goals',

    'saude.html': 'health',
    'estudos.html': 'study',
    'foco.html': 'foco',
    'notas.html': 'notes',
    'analytics.html': 'analytics',
    'profile.html': 'profile',
    'settings.html': 'settings',
  };

  var PAGE_MAP = {
    dashboard: 'dashboard.html',
    today: 'hoje.html',
    goals: 'metas.html',

    health: 'saude.html',
    study: 'estudos.html',
    foco: 'foco.html',
    notes: 'notas.html',
    analytics: 'analytics.html',
    profile: 'profile.html',
    settings: 'settings.html',
  };

  var ACTIVE_KEY = window.ACTIVE_KEY || FILE_TO_KEY[CURRENT_FILE] || '';

  /* ════════════════════════════════════════════
     PERFIL DE OUTRA PESSOA
     profile.html?u=... / ?id=... NÃO é "Meu perfil":
     não destaca a sidebar e não trava o clique em "Meu perfil".
  ════════════════════════════════════════════ */
  function _mhSearchHasProfileTarget(search) {
    try {
      var p = new URLSearchParams(search || '');
      return !!(p.get('u') || p.get('id'));
    } catch (e) { return false; }
  }
  function _mhIsForeignProfile(file, search) {
    if (file !== 'profile.html') return false;
    if (window._mhProfileOwn === true) return false; // ?u= apontando pro próprio usuário
    return _mhSearchHasProfileTarget(search);
  }
  function _mhFrameIsForeignProfile() {
    var f = document.getElementById('mh-content-frame');
    if (!f) return _mhIsForeignProfile(CURRENT_FILE, window.location.search);
    try {
      var loc = f.contentWindow.location;
      return _mhIsForeignProfile((loc.pathname.split('/').pop() || ''), loc.search);
    } catch (e) { return false; }
  }

  /* ════════════════════════════════════════════
     FAVICON — injeta em todas as páginas
  ════════════════════════════════════════════ */
  (function () {
    function _injectFavicon() {
      // User data
      var user = null;
      try {
        var rawUser = localStorage.getItem('minsq_auth_user');
        if (rawUser) user = JSON.parse(rawUser);
      } catch (e) { }

      var faviconPath = assetsPath + 'logo/favcon.svg';
      if (user && user.avatar_type === 'photo' && user.avatar && user.avatar.startsWith('http')) {
        faviconPath = user.avatar;
      } else if (user && user.avatar_url) {
        faviconPath = user.avatar_url;
      }

      if (user && user.nome) {
        document.title = user.nome.trim().split(' ')[0] + " | Minsq";
        if (window.top !== window) { try { window.top.document.title = document.title; } catch (e) { } }
      } else {
        document.title = "Minsq";
        if (window.top !== window) { try { window.top.document.title = document.title; } catch (e) { } }
      }

      var existing = document.querySelectorAll('link[rel~="icon"]');
      var alreadySet = false;

      existing.forEach(function (el) {
        if (el.getAttribute('href') === faviconPath) {
          alreadySet = true;
        } else {
          el.parentNode.removeChild(el);
        }
      });

      if (!alreadySet) {
        var link = document.createElement('link');
        link.rel = 'icon';
        // if using an avatar from URL, the type might not be png, but standard browsers handle it gracefully
        link.href = faviconPath;
        document.head.appendChild(link);
      }
    }
    if (document.head) {
      _injectFavicon();
    } else {
      document.addEventListener('DOMContentLoaded', _injectFavicon);
    }
  })();


  /* ════════════════════════════════════════════
     AUTH GUARD (só em páginas internas)
  ════════════════════════════════════════════ */
  if (!IS_PUBLIC) {
    var _sh = window.location.hostname.toLowerCase();
    var _isSub = _sh.startsWith('web.') || _sh.startsWith('status.') || _sh.startsWith('maintenance.');
    var _authUrl = _isSub ? 'https://mohi.com.br/auth' : '/auth';
    try {
      var _u = JSON.parse(localStorage.getItem('minsq_auth_user'));
      if (!_u || !_u.id) { (window.top || window).location.replace(_authUrl); return; }
    } catch (e) { (window.top || window).location.replace(_authUrl); return; }
  }




  /* ════════════════════════════════════════════
     PAGE TRANSITION OVERLAY
     Fade escuro suave ao navegar entre HTMLs
  ════════════════════════════════════════════ */
  (function () {
    var OV_ID = 'mh-page-overlay';
    var OV_CSS = [
      '#mh-page-overlay{',
      'position:fixed;inset:0;z-index:99999;',
      'left:var(--mh-overlay-left,0);',
      'pointer-events:none;',
      'opacity:0;',
      'background:rgba(7,7,7,.96);',
      'overflow:hidden;',
      'transition:opacity .18s cubic-bezier(.4,0,1,1);',
      '}',
      '#mh-page-overlay::after{',
      'content:"";position:absolute;inset:0;',
      'background:linear-gradient(105deg,transparent 35%,rgba(255,255,255,.045) 50%,transparent 65%);',
      'background-size:300% 100%;background-position:150% 0;',
      'opacity:0;pointer-events:none;transition:none;',
      '}',
      '#mh-page-overlay.mh-ov-out{opacity:1;pointer-events:all;transition:opacity .16s cubic-bezier(0,0,.2,1)}',
      '#mh-page-overlay.mh-ov-out::after{opacity:1;animation:mhOverlaySweep .38s cubic-bezier(.4,0,.2,1) .05s forwards}',
      '#mh-page-overlay.mh-ov-fade{opacity:0;pointer-events:none;transition:opacity .32s cubic-bezier(.4,0,.2,1)}',
      '@keyframes mhOverlaySweep{0%{background-position:150% 0;opacity:0}25%{opacity:1}100%{background-position:-50% 0;opacity:0}}',
    ].join('');

    function _injectOverlay() {
      if (document.getElementById(OV_ID)) return;
      var st = document.createElement('style');
      st.textContent = OV_CSS;
      document.head.appendChild(st);
      var ov = document.createElement('div');
      ov.id = OV_ID;
      document.body.appendChild(ov);
    }

    function _safeUrl(u) {
      try {
        var x = new URL(u, location.origin);
        if (x.origin !== location.origin) return null;
        if (x.pathname.indexOf('/pages/') !== 0) return null;
        return x.pathname + x.search + x.hash;
      } catch (e) { return null; }
    }

    /* Fade-out ao sair e navega depois da transicao */
    function _navigateTo(url) {
      if (window._mhIsNavigating) return;
      var ov = document.getElementById(OV_ID);
      if (ov && ov.classList.contains('mh-ov-out')) return;

      var cleanUrl = url.startsWith('/pages/') ? url : (url.startsWith('pages/') ? '/' + url : '/pages/' + url);
      var safe = _safeUrl(cleanUrl);
      if (!safe) return;

      var childUrl = safe.split('/').pop() || 'auth.html';
      var targetFile = childUrl.split('?')[0];

      var iframe = document.getElementById('mh-content-frame');
      if (iframe) {
        // Prevent reloading the same page
        try {
          var currentPath = iframe.contentWindow.location.pathname || '';
          var currentFile = currentPath.split('/').pop() || '';
          // Exceção: está no perfil de outra pessoa e quer ir pro próprio (profile.html sem ?u=)
          var _leavingForeignProfile = (targetFile === 'profile.html' && !_mhSearchHasProfileTarget(safe.split('?')[1] || '') && _mhFrameIsForeignProfile());
          if (currentFile === targetFile && !_leavingForeignProfile) {
            return;
          }
        } catch (e) {
          var currentSrc = iframe.src || '';
          var currentFile = currentSrc.split('/').pop().split('?')[0];
          if (currentFile === targetFile) {
            return;
          }
        }

        _injectOverlay();
        var ov = document.getElementById(OV_ID);
        var isChildPublic = PUBLIC_PAGES.indexOf(childUrl) !== -1;

        window._mhIsNavigating = true;
        document.body.style.setProperty('--mh-overlay-left', '0');
        if (!ov) { iframe.src = cleanUrl; return; }
        ov.classList.remove('mh-ov-fade');
        ov.classList.add('mh-ov-out');
        iframe.style.pointerEvents = 'none';
        setTimeout(function () {
          iframe.src = cleanUrl;
        }, 200);
        // Trava de segurança: libera a navegação mesmo se 'mh-frame-loaded' nunca chegar
        setTimeout(function () { window._mhIsNavigating = false; }, 4000);
        return;
      }

      // Standalone mode
      try {
        var currentPath = window.location.pathname || '';
        var currentFile = currentPath.split('/').pop() || '';
        if (currentFile === targetFile) {
          return;
        }
      } catch (e) { }

      _injectOverlay();
      var ov = document.getElementById(OV_ID);
      if (!ov) { window.location.href = safe; return; }
      ov.classList.add('mh-ov-out');
      setTimeout(function () {
        window.location.href = safe;
      }, 230);
    }

    window._mhNavigateTo = function (url) {
      if (IS_IN_IFRAME) {
        try {
          parent.postMessage({ type: 'mh-navigate', url: url }, window.location.origin);
          return;
        } catch (err) { }
      }
      _navigateTo(url);
    };
  })();

  /* ════════════════════════════════════════════
     go() GLOBAL
     (nao sobrescreve se a pagina ja tem o seu)
  ════════════════════════════════════════════ */
  if (typeof window.go !== 'function') {
    window.go = function (p) {
      if (IS_IN_IFRAME) {
        // Guard no iframe: não navega se já está na página destino
        if (ACTIVE_KEY && ACTIVE_KEY === p && !(p === 'profile' && _mhIsForeignProfile(CURRENT_FILE, window.location.search))) return;

        try {
          parent.postMessage({ type: 'mh-go', page: p }, window.location.origin);
          return;
        } catch (err) { }
      }
      if (!PAGE_MAP[p]) return;

      // Guard no Shell: usa o pathname atual do iframe para comparar
      var _iframe = document.getElementById('mh-content-frame');
      if (_iframe) {
        try {
          var _cur = _iframe.contentWindow.location.pathname.split('/').pop().split('?')[0];
          if (_cur === PAGE_MAP[p] && !(p === 'profile' && _mhFrameIsForeignProfile())) return;
        } catch (e) {
          // fallback: compara iframe.src
          var _src = (_iframe.src || '').split('/').pop().split('?')[0];
          if (_src === PAGE_MAP[p]) return;
        }
      }

      window._mhNavigateTo(PAGE_MAP[p]);
    };
  }

  /* ════════════════════════════════════════════
     SIDEBAR (só em páginas internas sem sidebar própria)
  ════════════════════════════════════════════ */
  if ((IS_ROOT || !IS_PUBLIC) && !window.MINSQ_HAS_SIDEBAR && !IS_IN_IFRAME) {
    var SB_CSS = [
      ':root{--mh-sb:56px; --mh-sb-expanded:212px; --bg-0: #050505; --bg-1: #0c0c0c; --bg-2: #131313; --line: rgba(255,255,255,.05); --line-soft: rgba(255,255,255,.03); --text-0: #eeeeec; --text-1: #7c7c7a; --text-2: #454543; --accent: #d8d4c8; --ease: cubic-bezier(.16,1,.3,1);}',
      '.mh-sidebar, .mh-sidebar * { box-sizing: border-box; font-family: "Exo 2", sans-serif !important; }',
      '#mh-sidebar-wrapper{position:fixed;left:0;top:0;bottom:0;width:14px;z-index:100001;background:transparent;display:flex;transition:width .2s var(--ease);}',
      '#mh-sidebar-wrapper:hover{width:calc(var(--mh-sb-expanded) + 12px);}',
      '#mh-sidebar-wrapper::after{content:\'\';position:absolute;left:0;top:0;bottom:0;width:1px;background:linear-gradient(180deg, transparent, rgba(255,255,255,.07), transparent);opacity:1;transition:opacity .2s;}',
      '#mh-sidebar-wrapper:hover::after{opacity:0;}',
      '#mh-sidebar-wrapper::before{content:"";position:fixed;top:0;left:0;right:0;bottom:0;background:rgba(0,0,0,0);backdrop-filter:blur(0px);-webkit-backdrop-filter:blur(0px);pointer-events:none;transition:background .35s var(--ease), backdrop-filter .35s var(--ease), -webkit-backdrop-filter .35s var(--ease);z-index:-1;}',
      '#mh-sidebar-wrapper:hover::before{background:rgba(0,0,0,0.4);backdrop-filter:blur(6px);-webkit-backdrop-filter:blur(6px);}',
      'body.mh-k-active-parent #mh-sidebar-wrapper{pointer-events:none!important;width:12px!important;}',
      'body.mh-k-active-parent .mh-sidebar{transform:translateX(calc(-100% - 12px))!important;}',
      '.mh-sidebar{position:absolute;left:10px;top:10px;bottom:10px;width:var(--mh-sb);background:linear-gradient(180deg, rgba(255,255,255,.02), transparent 18%), var(--bg-1);border:1px solid var(--line);border-radius:10px;display:flex;flex-direction:column;align-items:flex-start;padding:14px 10px 12px;z-index:100001;transform:translateX(calc(-100% - 14px));transition:transform .32s var(--ease), width .2s var(--ease), box-shadow .35s var(--ease), background .85s var(--ease), border-color .85s var(--ease); overflow:hidden; white-space:nowrap; box-shadow: 0 14px 34px -12px rgba(0,0,0,.65);}',
      '#mh-sidebar-wrapper:hover .mh-sidebar{transform:translateX(0); width:var(--mh-sb-expanded); box-shadow: 0 0 60px 10px rgba(0,0,0,0.85);}',
      /* — logo — */
      '.mh-logo{width:40px;height:40px;border-radius:8px;display:flex;align-items:center;justify-content:center;cursor:pointer;margin:0 0 16px 3px;background:transparent;border:none;flex-shrink:0;transition:transform .15s; user-select:none; overflow:hidden;}',
      '.mh-logo:hover{transform:translateY(-1px);}',
      '.mh-logo svg{width:34px;height:34px;}',
      '.mh-logo img{width:34px;height:34px;object-fit:contain}',
      '.mh-logo span{font-family:"DM Mono",monospace;font-size:9px;font-weight:500;color:#f0f0f0;letter-spacing:.5px}',
      /* — settings — */
      '.mh-settings-btn{background:transparent;border:none;cursor:pointer;color:var(--text-2);display:flex;align-items:center;justify-content:center;padding:6px;border-radius:7px;opacity:0;pointer-events:none;transition:opacity .2s,color .15s,background .15s;}',
      '.mh-settings-btn:hover, .mh-settings-btn.on{color:var(--text-0);background:rgba(255,255,255,.05);}',
      '.mh-settings-btn.on{cursor:default!important;pointer-events:none!important;}',
      '#mh-sidebar-wrapper:hover .mh-settings-btn{opacity:1;pointer-events:auto;}',
      '.mh-settings-btn svg{width:15px;height:15px;stroke:currentColor;fill:none;stroke-width:1.7;stroke-linecap:round;stroke-linejoin:round;}',
      /* — search / feed — */
      '.mh-search{width:100%;height:36px;border-radius:9px;display:flex;align-items:center;padding:0 10px;gap:10px;background:var(--bg-2);border:1px solid var(--line-soft);color:var(--text-2);margin-bottom:8px;overflow:hidden;cursor:default;transition:background .8s var(--ease), border-color .8s var(--ease);flex-shrink:0;}',
      '.mh-search:hover{background:#171717;border-color:var(--line);}',
      '.mh-search svg{width:15px;height:15px;stroke:currentColor;fill:none;stroke-width:1.7;stroke-linecap:round;stroke-linejoin:round; flex-shrink:0;}',
      '.mh-search span{font-size:12.5px;font-weight:600;letter-spacing:.01em;opacity:0;transition:opacity .2s .05s;white-space:nowrap;color:var(--text-1); pointer-events:none;}',
      '#mh-sidebar-wrapper:hover .mh-search span{opacity:1;}',
      '.mh-feed{width:100%;height:34px;border-radius:9px;display:flex;align-items:center;padding:0 10px;gap:10px;margin-bottom:10px;cursor:default;color:var(--text-2);flex-shrink:0;}',
      '.mh-feed svg{width:15px;height:15px;stroke:currentColor;fill:none;stroke-width:1.7;stroke-linecap:round;stroke-linejoin:round; flex-shrink:0;}',
      '.mh-feed span{font-size:12.5px;font-weight:600;opacity:0;transition:opacity .2s .05s;color:var(--text-2); pointer-events:none;}',
      '#mh-sidebar-wrapper:hover .mh-feed span{opacity:1;}',
      /* — nav — */
      '.mh-nav{display:flex;flex-direction:column;gap:2px;flex:1;width:100%;overflow-y:auto;overflow-x:hidden;}',
      '.mh-nb{width:100%;height:36px;border-radius:9px;display:flex;align-items:center;padding:0 10px;gap:10px;cursor:pointer;position:relative;color:var(--text-2);border:1px solid transparent;transition:background .8s var(--ease), color .8s var(--ease), border-color .8s var(--ease);flex-shrink:0;}',
      '.mh-nb svg{width:15px;height:15px;stroke:currentColor;fill:none;stroke-width:1.7;stroke-linecap:round;stroke-linejoin:round; flex-shrink:0;}',
      '.mh-nb .mh-label{font-size:12.5px;font-weight:600;letter-spacing:.005em;opacity:0;transition:opacity .2s .05s;pointer-events:none;color:inherit;}',
      '#mh-sidebar-wrapper:hover .mh-nb .mh-label{opacity:1;}',
      '.mh-nb:hover{background:rgba(255,255,255,.03);color:var(--text-1);}',
      '.mh-nb.on{background:rgba(255,255,255,.045);color:var(--text-0);border-color:var(--line);cursor:default!important;pointer-events:none!important;}',
      '.mh-div{width:100%;height:1px;background:var(--line-soft);margin:8px 0;flex-shrink:0;transition:background .8s var(--ease);}',
      /* — bottom / account — */
      '.mh-bot{display:flex;flex-direction:column;align-items:flex-start;width:100%;flex-shrink:0;}',
      '.mh-plan { width: 100%; display: flex; align-items: center; justify-content: space-between; gap: 8px; padding: 6px; border-radius: 9px; }',
      '.mh-plan-label { font-size: 10.5px; font-weight: 600; letter-spacing: .02em; color: var(--text-2); white-space: nowrap; overflow: hidden; opacity: 0; transition: opacity .2s .05s; }',
      '#mh-sidebar-wrapper:hover .mh-plan-label { opacity: 1; }',
      '.mh-plan-upgrade { background: var(--accent); color: #0a0a0a; border: none; border-radius: 7px; font-size: 10.5px; font-weight: 700; padding: 5px 11px; cursor: pointer; white-space: nowrap; flex-shrink: 0; transition: transform .15s, filter .15s, opacity .2s .05s; opacity: 0; pointer-events: none; }',
      '#mh-sidebar-wrapper:hover .mh-plan-upgrade { opacity: 1; pointer-events: auto; }',
      '.mh-plan-upgrade:hover { filter: brightness(1.1); transform: translateY(-1px); }',
      '.mh-plan-upgrade:active { transform: translateY(0); }',
      '.mh-account{width:100%;display:flex;align-items:center;padding:6px;border-radius:9px;margin-top:8px;transition:background .15s;}',
      '.mh-account:hover{background:rgba(255,255,255,.03);}',
      '.mh-account.on{background:rgba(255,255,255,.05);}',
      '.mh-account.on .mh-account-av, .mh-account.on .mh-account-name{cursor:default!important; pointer-events:none;}',
      '.mh-account-av{width:26px;height:26px;border-radius:50%;flex-shrink:0;margin-right:10px;background:linear-gradient(145deg,#212121,#131313);border:1px solid var(--line);display:flex;align-items:center;justify-content:center;font-weight:600;font-size:11px;color:var(--text-0);cursor:pointer;overflow:hidden;}',
      '.mh-account-av img{width:100%;height:100%;object-fit:cover;}',
      '.mh-account-name{font-size:12.5px;font-weight:700;color:var(--text-0);opacity:0;transition:opacity .2s .05s, color .8s var(--ease);flex:1;overflow:hidden;text-overflow:ellipsis;}',
      '#mh-sidebar-wrapper:hover .mh-account-name{opacity:1;}',
      /* — Temas da Sidebar — */
      'body.sb-branco .mh-sidebar{background:#e8e0d5!important;border-right-color:rgba(0,0,0,.08)!important}',
      'body.sb-branco .mh-nb{color:#888!important}',
      'body.sb-branco .mh-nb:hover{background:rgba(0,0,0,.04)!important;color:#222!important}',
      'body.sb-branco .mh-nb.on{background:rgba(0,0,0,.1)!important;color:#111!important;border-color:rgba(0,0,0,.12)!important}',
      'body.sb-branco .mh-div{background:rgba(0,0,0,.08)!important}',
      'body.sb-branco .mh-search{background:rgba(0,0,0,.04)!important;border-color:rgba(0,0,0,.08)!important}',
      'body.sb-branco .mh-account-name{color:#333!important}',
      'body.sb-offwhite .mh-sidebar{background:#f5f5f0!important;border-right-color:rgba(0,0,0,.08)!important}',
      'body.sb-offwhite .mh-nb{color:#888!important}',
      'body.sb-offwhite .mh-nb:hover{background:rgba(0,0,0,.04)!important;color:#222!important}',
      'body.sb-offwhite .mh-nb.on{background:rgba(0,0,0,.1)!important;color:#111!important;border-color:rgba(0,0,0,.12)!important}',
      'body.sb-offwhite .mh-div{background:rgba(0,0,0,.08)!important}',
      'body.sb-offwhite .mh-search{background:rgba(0,0,0,.04)!important;border-color:rgba(0,0,0,.08)!important}',
      'body.sb-offwhite .mh-account-name{color:#333!important}',
      'body.sb-bege .mh-sidebar{background:#d8c3a0!important;border-right-color:rgba(0,0,0,.08)!important}',
      'body.sb-bege .mh-nb{color:#888!important}',
      'body.sb-bege .mh-nb:hover{background:rgba(0,0,0,.04)!important;color:#222!important}',
      'body.sb-bege .mh-nb.on{background:rgba(0,0,0,.1)!important;color:#111!important;border-color:rgba(0,0,0,.12)!important}',
      'body.sb-bege .mh-div{background:rgba(0,0,0,.08)!important}',
      'body.sb-bege .mh-search{background:rgba(0,0,0,.04)!important;border-color:rgba(0,0,0,.08)!important}',
      'body.sb-bege .mh-account-name{color:#333!important}',
      'body.sb-blackout .mh-sidebar{background:#000!important;border-right-color:transparent!important;backdrop-filter:none!important}',
      'body.mh-k-active-parent .mh-sidebar{pointer-events:none!important}'
    ].join('');

    function escHtml(s) { if (!s) return ''; return String(s).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;').replace(/'/g, '&#39;'); }

    function _nb(key, svgInner, label) {
      var isOn = ACTIVE_KEY === key;
      return '<div class="mh-nb' + (isOn ? ' on' : '') + '" data-mhkey="' + key + '">'
        + '<svg viewBox="0 0 24 24">' + svgInner + '</svg>'
        + '<span class="mh-label">' + label + '</span>'
        + '</div>';
    }

    function _buildSidebar() {
      var user = {};
      try { user = JSON.parse(localStorage.getItem('minsq_auth_user')) || {}; } catch (e) { }
      var avLetter = '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" style="width:60%;height:60%;opacity:0.8"><path d="M20 21v-2a4 4 0 0 0-4-4H8a4 4 0 0 0-4 4v2"/><circle cx="12" cy="7" r="4"/></svg>';
      var avName = user.nome || 'Usuário';
      var avPhoto = user.avatar_url ? '<img src="' + escHtml(user.avatar_url) + '" alt="avatar">' : avLetter;

      var MH_LOGO_SRC = assetsPath + 'logo/logo.svg';
      var logoHTML = '<img src="' + MH_LOGO_SRC + '" alt="logo" style="width:34px;height:34px;object-fit:contain;display:block;-webkit-user-drag:none;pointer-events:none">';
      try {
        var logoUrl = localStorage.getItem('minsq_logo_url');
        if (logoUrl) logoHTML = '<img src="' + logoUrl + '" alt="logo" style="width:34px;height:34px;object-fit:contain">';
      } catch (e) { }

      var logoProps = 'style="cursor:default;"';

      var searchHTML = '<div class="mh-search">'
        + '<svg viewBox="0 0 24 24"><circle cx="11" cy="11" r="8"/><line x1="21" y1="21" x2="16.65" y2="16.65"/></svg>'
        + '<span>Procurar utilizadores</span>'
        + '</div>';

      var feedHTML = '<div class="mh-feed">'
        + '<svg viewBox="0 0 24 24"><path d="M3 9l9-7 9 7v11a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2z"/><polyline points="9 22 9 12 15 12 15 22"/></svg>'
        + '<span>Feed</span>'
        + '</div>';

      var planHTML = '<div class="mh-plan">'
        + '<span class="mh-plan-label">Plano Free</span>'
        + '<button class="mh-plan-upgrade" data-mhkey="upgrade">Upgrade</button>'
        + '</div>';

      var isProfileOn = (typeof ACTIVE_KEY !== 'undefined' && ACTIVE_KEY === 'profile') && !_mhIsForeignProfile('profile.html', window.location.search);
      var isSettingsOn = (typeof ACTIVE_KEY !== 'undefined' && ACTIVE_KEY === 'settings');

      var accountHTML = '<div class="mh-account' + (isProfileOn ? ' on' : '') + '">'
        + '<div class="mh-account-av" data-mhkey="profile">' + avPhoto + '</div>'
        + '<span class="mh-account-name" data-mhkey="profile" style="cursor:pointer">' + avName + '</span>'
        + '<button class="mh-settings-btn' + (isSettingsOn ? ' on' : '') + '" data-mhkey="settings">'
        + '<svg viewBox="0 0 24 24"><circle cx="12" cy="12" r="3"/><path d="M19.4 15a1.65 1.65 0 0 0 .33 1.82l.06.06a2 2 0 1 1-2.83 2.83l-.06-.06a1.65 1.65 0 0 0-1.82-.33 1.65 1.65 0 0 0-1 1.51V21a2 2 0 0 1-4 0v-.09A1.65 1.65 0 0 0 9 19.4a1.65 1.65 0 0 0-1.82.33l-.06.06a2 2 0 1 1-2.83-2.83l.06-.06a1.65 1.65 0 0 0 .33-1.82 1.65 1.65 0 0 0-1.51-1H3a2 2 0 0 1 0-4h.09A1.65 1.65 0 0 0 4.6 9a1.65 1.65 0 0 0-.33-1.82l-.06-.06a2 2 0 1 1 2.83-2.83l.06.06A1.65 1.65 0 0 0 9 4.68h.09a1.65 1.65 0 0 0 1-1.51V3a2 2 0 0 1 4 0v.09a1.65 1.65 0 0 0 1 1.51 1.65 1.65 0 0 0 1.82-.33l.06-.06a2 2 0 1 1 2.83 2.83l-.06.06a1.65 1.65 0 0 0-.33 1.82V9a1.65 1.65 0 0 0 1.51 1H21a2 2 0 0 1 0 4h-.09a1.65 1.65 0 0 0-1.51 1z"/></svg>'
        + '</button>'
        + '</div>';

      var html = '<div id="mh-sidebar-wrapper">'
        + '<div class="mh-sidebar" id="mh-sidebar">'
        + '<div class="mh-logo" ' + logoProps + '>' + logoHTML + '</div>'
        + searchHTML
        + feedHTML
        + '<div class="mh-nav">'
        + _nb('dashboard', '<rect x="3" y="3" width="7" height="7" rx="1"/><rect x="14" y="3" width="7" height="7" rx="1"/><rect x="3" y="14" width="7" height="7" rx="1"/><rect x="14" y="14" width="7" height="7" rx="1"/>', 'Dashboard')
        + _nb('today', '<circle cx="12" cy="12" r="9"/><polyline points="12 6 12 12 16 14"/>', 'Hoje')
        + '<div class="mh-div"></div>'
        + _nb('goals', '<circle cx="12" cy="12" r="9"/><circle cx="12" cy="12" r="5"/><circle cx="12" cy="12" r="1"/>', 'Metas')

        + _nb('health', '<path d="M20.84 4.61a5.5 5.5 0 0 0-7.78 0L12 5.67l-1.06-1.06a5.5 5.5 0 0 0-7.78 7.78l1.06 1.06L12 21.23l7.78-7.78 1.06-1.06a5.5 5.5 0 0 0 0-7.78z"/>', 'Sa&#250;de')
        + _nb('study', '<path d="M2 3h6a4 4 0 0 1 4 4v14a3 3 0 0 0-3-3H2z"/><path d="M22 3h-6a4 4 0 0 0-4 4v14a3 3 0 0 1 3-3h7z"/>', 'Estudos')
        + _nb('foco', '<line x1="12" y1="2" x2="12" y2="8"/><line x1="12" y1="16" x2="12" y2="22"/><line x1="2" y1="12" x2="8" y2="12"/><line x1="16" y1="12" x2="22" y2="12"/><circle cx="12" cy="12" r="2"/>', 'Foco')
        + _nb('notes', '<path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"/><path d="M14 2v6h6"/><line x1="9" y1="13" x2="15" y2="13"/><line x1="9" y1="17" x2="13" y2="17"/>', 'Notas')
        + '<div class="mh-div"></div>'
        + _nb('analytics', '<polyline points="22 12 18 12 15 21 9 3 6 12 2 12"/>', 'Analytics')
        + '</div>'
        + '<div class="mh-bot">'
        + planHTML
        + accountHTML
        + '</div>'
        + '</div>'
        + '</div>';

      return html;
    }



    /* Injetar CSS imediatamente no <head> — antes do primeiro paint */
    var _sbSt = document.createElement('style');
    _sbSt.textContent = SB_CSS;
    document.head.appendChild(_sbSt);

    /* Injetar sidebar assim que o body estiver disponível */
    function _injectSidebar() {
      if (!document.body) { return setTimeout(_injectSidebar, 0); }
      // Injeta apenas 1 vez e só no body
      if (document.getElementById('mh-sidebar-wrapper')) return;

      var wrap = document.createElement('div');
      wrap.innerHTML = _buildSidebar();
      var sidebarElement = wrap.firstChild;
      document.body.insertBefore(sidebarElement, document.body.firstChild);

      sidebarElement.addEventListener('click', function (e) {
        var el = e.target.closest('[data-mhkey]');
        if (el) {
          var key = el.getAttribute('data-mhkey');
          if (el.classList.contains('on')) return;
          if (key === ACTIVE_KEY && !(key === 'profile' && _mhFrameIsForeignProfile())) return;
          if (typeof window.go === 'function') window.go(key);
        }
      });

      // Após injetar, atualiza com dados reais do banco (async)
      _updateSidebarFromDB();
    }
    _injectSidebar();

    /* Atualiza avatar e nome da sidebar com dados reais do banco */
    function _updateSidebarFromDB() {
      var _attempts = 0;
      var _poll = setInterval(function () {
        _attempts++;
        if (window.api && typeof window.api.getProfile === 'function') {
          if (sessionStorage.getItem('minsq_onboarding_token')) {
            clearInterval(_poll);
            return;
          }
          clearInterval(_poll);
          window.api.getProfile().then(function (profile) {
            if (!profile) return;

            // ── Nome ──
            var nome = profile.nome || profile.name || '';
            if (nome) {
              var nameEl = document.querySelector('.mh-account-name');
              if (nameEl) nameEl.textContent = nome;
              // Atualiza title da guia
              document.title = nome.trim().split(' ')[0] + ' | Minsq';
              if (window.top !== window) { try { window.top.document.title = document.title; } catch (e) { } }
            }

            // ── Avatar ──
            var avSrc = '';
            if (profile.avatar_type === 'photo' && profile.avatar && profile.avatar.startsWith('http')) {
              avSrc = profile.avatar;
            } else if (profile.avatar_url && profile.avatar_url.startsWith('http')) {
              avSrc = profile.avatar_url;
            }
            var avEl = document.querySelector('.mh-account-av');
            if (avEl) {
              if (avSrc) {
                avEl.innerHTML = '<img src="' + escHtml(avSrc) + '" alt="avatar">';
              } else {
                avEl.innerHTML = '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" style="width:60%;height:60%;opacity:0.8"><path d="M20 21v-2a4 4 0 0 0-4-4H8a4 4 0 0 0-4 4v2"/><circle cx="12" cy="7" r="4"/></svg>';
              }
            }

            // ── Favicon ──
            if (avSrc) {
              var favicon = document.querySelector('link[rel~="icon"]');
              if (!favicon) { favicon = document.createElement('link'); favicon.rel = 'icon'; document.head.appendChild(favicon); }
              favicon.removeAttribute('type'); /* type=svg+xml faz o navegador ignorar foto png/jpg */
              favicon.href = avSrc;
            }
          }).catch(function () { });
        } else if (_attempts >= 50) {
          clearInterval(_poll); // 5s sem API — desiste silenciosamente
        }
      }, 100);
    }

  }


  /* ════════════════════════════════════════════
     MENSAGENS DO IFRAME
  ════════════════════════════════════════════ */
  (function () {
    window.addEventListener('message', function (e) {
      if (e.origin !== window.location.origin) return;
      var iframe = document.getElementById('mh-content-frame');
      if (!iframe || e.source !== iframe.contentWindow) return;

      var data = e.data;
      if (!data || typeof data !== 'object') return;

      if (data.type === 'mh-navigate') {
        if (typeof window._mhNavigateTo === 'function') {
          window._mhNavigateTo(data.url);
        }
      } else if (data.type === 'mh-go') {
        if (typeof window.go === 'function') {
          // Guard: não navega se o iframe já está na página destino
          var iframe = document.getElementById('mh-content-frame');
          if (iframe) {
            try {
              var curFile = iframe.contentWindow.location.pathname.split('/').pop().split('?')[0];
              var targetFile = PAGE_MAP[data.page] || '';
              if (curFile === targetFile && !(data.page === 'profile' && _mhFrameIsForeignProfile())) return;
            } catch (e) { }
          }
          window.go(data.page);
        }
      } else if (data.type === 'mh-profile-view') {
        // profile.html informa se o perfil exibido é o do próprio usuário
        window._mhProfileOwn = !!data.own;
        var _acc = document.querySelector('.mh-sidebar .mh-account');
        if (_acc) _acc.classList.toggle('on', !!data.own);
      } else if (data.type === 'mh-frame-loaded') {
        window._mhIsNavigating = false;
        document.body.classList.remove('mh-k-active-parent');

        var childUrl = data.url;
        window._currentIframePage = childUrl;
        if (typeof window.syncSidebarTheme === 'function') window.syncSidebarTheme();

        var search = data.search;

        var ov = document.getElementById('mh-page-overlay');
        if (ov) {
          ov.classList.remove('mh-ov-out');
          ov.classList.add('mh-ov-fade');
          setTimeout(function () { ov.classList.remove('mh-ov-fade'); }, 350);
        }

        var isChildPublic = PUBLIC_PAGES.indexOf(childUrl) !== -1;

        // Nova página carregada: zera o aviso de "?u= é o próprio usuário" (profile.html reenvia)
        window._mhProfileOwn = undefined;
        var routeKey = FILE_TO_KEY[childUrl];
        // No shell, ACTIVE_KEY nasce da URL do F5 (ex.: /hoje -> 'today') e ficava congelada,
        // travando o clique na sidebar de volta pra essa página. Agora segue o iframe.
        if (!IS_IN_IFRAME) ACTIVE_KEY = routeKey || '';
        // Perfil de outra pessoa não conta como "Meu perfil"
        if (_mhIsForeignProfile(childUrl, search)) routeKey = '';
        var navButtons = document.querySelectorAll('.mh-sidebar .mh-nb');
        navButtons.forEach(function (btn) {
          btn.classList.toggle('on', !!routeKey && btn.getAttribute('data-mhkey') === routeKey);
        });
        var settingsBtn = document.querySelector('.mh-sidebar .mh-settings-btn');
        if (settingsBtn) {
          settingsBtn.classList.toggle('on', routeKey === 'settings');
        }
        var accountBox = document.querySelector('.mh-sidebar .mh-account');
        if (accountBox) {
          accountBox.classList.toggle('on', routeKey === 'profile');
        }

        var sParams = new URLSearchParams(search);
        sParams.delete('page');
        var sStr = sParams.toString();
        var qs = sStr ? '?' + sStr : '';
        var cleanChild = childUrl.replace(/\.html$/, '');
        var paramPage = (childUrl === 'auth.html' || childUrl === 'index.html') ? '/' + qs : '/' + cleanChild + qs;

        var newUrl = location.protocol + '//' + location.host + paramPage;
        try {
          if (location.href !== newUrl) {
            history.replaceState(null, '', paramPage);
          }
        } catch (err) { }

        var sb = document.getElementById('mh-sidebar-wrapper');
        var iframe = document.getElementById('mh-content-frame');
        if (sb && iframe) {
          var targetDisplay = isChildPublic ? 'none' : 'block';
          if (sb.style.display !== targetDisplay) {
            sb.style.display = targetDisplay;
          }
          iframe.style.left = '0';
          iframe.style.width = '100%';
          iframe.style.pointerEvents = 'auto'; // Restore clicks!
        }
      } else if (data.type === 'mh-k-modal-open') {
        document.body.classList.add('mh-k-active-parent');
      } else if (data.type === 'mh-k-modal-close') {
        document.body.classList.remove('mh-k-active-parent');
      }
    });
  })();

  /* ════════════════════════════════════════════
     CONTEXT MENU + SCROLL INDICATOR
  ════════════════════════════════════════════ */
  (function () {
    var CTX_CSS = [
      '@keyframes mhFadeUp{from{opacity:0;transform:translate3d(0,14px,0)}to{opacity:1;transform:translate3d(0,0,0)}}',
      /* context menu */
      '#mh-ctx-menu{position:fixed;z-index:99999;background:#121212;border:1px solid rgba(255,255,255,.14);border-radius:12px;box-shadow:0 20px 60px rgba(0,0,0,.7),0 4px 16px rgba(0,0,0,.5);padding:5px;min-width:170px;display:none;animation:mhFadeUp .12s ease;backdrop-filter:blur(8px);will-change:transform,opacity}',
      '#mh-ctx-menu.open{display:block}',
      '.mh-ctx-item{display:flex;align-items:center;gap:10px;padding:9px 12px;border-radius:8px;cursor:pointer;font-family:"Exo 2",sans-serif;font-size:12px;color:#c0c0c0;transition:background .1s,color .1s;user-select:none}',
      '.mh-ctx-item:hover{background:rgba(255,255,255,.08);color:#f0f0f0}',
      '.mh-ctx-icon{font-size:13px;width:18px;text-align:center;flex-shrink:0}',
      '.mh-ctx-sep{height:1px;background:rgba(255,255,255,.04);margin:3px 5px}',
    ].join('');

    var CTX_HTML = [
      '<div id="mh-ctx-menu">',
      '<div class="mh-ctx-item" onclick="window.history.back()"><span class="mh-ctx-icon">&#8592;</span><span>Voltar</span></div>',
      '<div class="mh-ctx-sep"></div>',
      '<div class="mh-ctx-item" onclick="_mhCtxReload()"><span class="mh-ctx-icon">↺</span><span>Recarregar</span></div>',
      '<div class="mh-ctx-sep"></div>',
      '<div class="mh-ctx-item" onclick="_mhCtxTranslate()"><span class="mh-ctx-icon">⌖</span><span>Traduzir página</span></div>',
      '</div>',
    ].join('');

    function _initCtx() {
      if (!document.body) { return setTimeout(_initCtx, 10); }
      /* CSS */
      var st = document.createElement('style');
      st.textContent = CTX_CSS;
      document.head.appendChild(st);

      /* HTML */
      var wrap = document.createElement('div');
      wrap.innerHTML = CTX_HTML;
      while (wrap.firstChild) document.body.appendChild(wrap.firstChild);

      /* ── Context menu ── */
      var menu = document.getElementById('mh-ctx-menu');
      function showMenu(x, y) {
        if (!menu) return;
        menu.classList.add('open');
        var vw = window.innerWidth, vh = window.innerHeight;
        var mw = 180, mh = 140;
        menu.style.left = (x + mw > vw ? x - mw : x) + 'px';
        menu.style.top = (y + mh > vh ? y - mh : y) + 'px';
      }
      function hideMenu() { if (menu) menu.classList.remove('open'); }

      document.addEventListener('contextmenu', function (e) { e.preventDefault(); showMenu(e.clientX, e.clientY); });
      document.addEventListener('click', function (e) { if (menu && !menu.contains(e.target)) hideMenu(); });
      document.addEventListener('keydown', function (e) { if (e.key === 'Escape') hideMenu(); });

      window._mhCtxReload = function () { hideMenu(); window.location.reload(); };
      window._mhCtxTranslate = function () { hideMenu(); window.open('https://translate.google.com/translate?sl=auto&tl=pt&u=' + encodeURIComponent(window.location.href), '_blank'); };
    }

    if (document.readyState === 'complete' || document.readyState === 'interactive') {
      _initCtx();
    } else {
      document.addEventListener('DOMContentLoaded', _initCtx);
    }
  })();

  /* ════════════════════════════════════════════
     HOTKEYS (só em páginas internas)
  ════════════════════════════════════════════ */
  if (IS_ROOT || !IS_PUBLIC) {
    var HK_MAP = {
      '1': 'dashboard', '2': 'today', '3': 'goals',
      '4': 'health', '5': 'study', '6': 'foco', '7': 'notes',
      '8': 'profile', '9': 'settings'
    };

    function _hkIsTyping() {
      var tag = document.activeElement && document.activeElement.tagName;
      return tag === 'INPUT' || tag === 'TEXTAREA' || tag === 'SELECT'
        || !!(document.activeElement && document.activeElement.isContentEditable);
    }

    window.dcSetDate = function (el, dateStr) {
      if (!el) return;
      el.dataset.val = dateStr;

      var hoje = new Date();
      var hStr = hoje.getFullYear() + '-' + String(hoje.getMonth() + 1).padStart(2, '0') + '-' + String(hoje.getDate()).padStart(2, '0');

      var amanha = new Date(hoje);
      amanha.setDate(amanha.getDate() + 1);
      var amStr = amanha.getFullYear() + '-' + String(amanha.getMonth() + 1).padStart(2, '0') + '-' + String(amanha.getDate()).padStart(2, '0');

      if (dateStr === hStr) {
        el.value = 'Hoje';
      } else if (dateStr === amStr) {
        el.value = 'Amanhã';
      } else {
        var p = dateStr.split('-');
        if (p.length === 3) {
          var mesesCurto = ['Jan', 'Fev', 'Mar', 'Abr', 'Mai', 'Jun', 'Jul', 'Ago', 'Set', 'Out', 'Nov', 'Dez'];
          el.value = parseInt(p[2], 10) + ' ' + mesesCurto[parseInt(p[1], 10) - 1];
        } else {
          el.value = dateStr;
        }
      }
    };

    function _hkModalOpen() {
      var m = document.getElementById('modal');
      return !!(m && m.classList.contains('on'));
    }

    function _handleHJ(key) {
      var offset = (key === 'h' || key === 'H') ? 0 : 1;
      if (CURRENT_FILE === 'hoje.html') {
        var getDateOffsetFn = window.getDateOffset || function (off) {
          var d = new Date();
          d.setDate(d.getDate() + off);
          return d.toISOString().split('T')[0];
        };
        if (typeof window.openModal === 'function') {
          window.openModal('task');
          setTimeout(function () {
            var dateInput = document.getElementById('taskData');
            if (dateInput) {
              if (typeof window.dcSetDate === 'function') {
                window.dcSetDate(dateInput, getDateOffsetFn(offset));
              } else {
                dateInput.value = getDateOffsetFn(offset);
              }
            }
          }, 50);
        }
      } else {
        sessionStorage.setItem('mh_open_day', offset === 0 ? 'today' : 'tomorrow');
        if (typeof window.go === 'function') {
          window.go('today');
        }
      }
    }



    function _handleN() {
      if (CURRENT_FILE === 'notas.html') {
        if (typeof window.createNote === 'function') {
          window.createNote();
        }
      } else {
        sessionStorage.setItem('mh_open_notes_new', 'true');
        if (typeof window.go === 'function') {
          window.go('notes');
        }
      }
    }

    function _handleP() {
      if (CURRENT_FILE === 'saude.html') {
        if (typeof window.openWeightLog === 'function') {
          window.openWeightLog();
        }
      } else {
        sessionStorage.setItem('mh_open_weight_new', 'true');
        if (typeof window.go === 'function') {
          window.go('health');
        }
      }
    }

    function handleGlobalHotkey(k, code, e) {
      if (_hkIsTyping() || _hkModalOpen()) {
        return;
      }

      // Outros atalhos
      if (k === 'x' || k === 'X') {
        if (e) e.preventDefault();
        if (typeof window.mhStartSpotlight === 'function') window.mhStartSpotlight();
        return;
      }
      if (k === 'p' || k === 'P') {
        if (e) e.preventDefault();
        _handleP();
        return;
      }
      if (k === 'n' || k === 'N') {
        if (e) e.preventDefault();
        _handleN();
        return;
      }
      if (k === 'h' || k === 'H' || k === 'j' || k === 'J') {
        if (e) e.preventDefault();
        _handleHJ(k);
        return;
      }


      // Atalho K (nas páginas do core do Minsq)
      if (k === 'k' || k === 'K') {
        var CORE_PAGES = ['dashboard.html', 'hoje.html', 'metas.html', 'saude.html', 'estudos.html', 'foco.html', 'notas.html'];
        if (CORE_PAGES.indexOf(CURRENT_FILE) !== -1) {
          if (e) e.preventDefault();
          if (typeof window.toggleKModal === 'function') {
            window.toggleKModal();
          }
          return;
        }
      }

      var dest = HK_MAP[k];
      if (dest) {
        if (e) e.preventDefault();
        window.go(dest);
      }
    }

    // Atalho global extra: Ctrl+A para Água (Registra instantâneo 500ml)
    var _hkAguaBusy = false;
    document.addEventListener('keydown', function (e) {
      if (e.ctrlKey && (e.key === 'a' || e.key === 'A')) {
        if (_hkIsTyping() || _hkModalOpen() || _hkAguaBusy) return;
        e.preventDefault();

        _hkAguaBusy = true;
        var hoje = new Date().toISOString().split('T')[0];
        if (typeof toast === 'function') toast('Verificando consumo de água...');

        if (window.api && typeof window.api.getHealthLogs === 'function') {
          window.api.getHealthLogs().then(function (logs) {
            var prevLog = (logs || []).find(function (h) { return h.tipo === 'agua' && h.data === hoje; });
            var prevVol = prevLog && prevLog.dados_json ? prevLog.dados_json.quantidade : 0;
            if (prevVol > 0 && prevVol < 20) prevVol *= 1000;
            var novo = prevVol + 500;

            if (novo > 8000) {
              if (typeof toast === 'function') toast('Limite de água atingido (8L/dia).', 'err');
              _hkAguaBusy = false;
              return;
            }

            window.api.logHealth({ tipo: 'agua', dados: { quantidade: novo }, data: hoje }).then(function () {
              if (typeof toast === 'function') toast('✓ +500ml de água registrado (Total: ' + novo + 'ml)', 'ok');
              if (typeof window.renderSaude === 'function') window.renderSaude();
            }).catch(function (err) {
              console.error('Erro no atalho Ctrl+A:', err);
              if (typeof toast === 'function') toast(err.message || 'Erro ao registrar água.', 'err');
            }).finally(function () {
              _hkAguaBusy = false;
            });
          }).catch(function (err) {
            console.error('Erro no atalho Ctrl+A:', err);
            _hkAguaBusy = false;
          });
        } else {
          _hkAguaBusy = false;
        }
      }
    });

    // 1. Registra o listener no Shell/Root
    if (IS_ROOT) {
      document.addEventListener('keydown', function (e) {
        if (e.ctrlKey || e.metaKey || e.altKey) return;

        var k = e.key;

        // Escape no Shell
        if (k === 'Escape') {
          // Encaminha Escape para fechar o KModal se estiver ativo
          var iframe = document.getElementById('mh-content-frame');
          if (iframe && iframe.contentWindow) {
            try {
              iframe.contentWindow.postMessage({ type: 'mh-keydown', key: k, code: e.code }, window.location.origin);
            } catch (err) { }
          }
          return;
        }

        // Encaminha outros atalhos para o IFrame
        var isKActive = document.body.classList.contains('mh-k-active-parent');
        var isForwardKey = ['h', 'H', 'j', 'J', 'f', 'F', 'n', 'N', 'k', 'K', '1', '2', '3', '4', '5', '6', '7', '8', '9', '0'].indexOf(k) !== -1;
        var isKNavKey = isKActive && ['w', 'W', 's', 'S', 'ArrowUp', 'ArrowDown', 'Enter', 'd', 'D', 'a', 'A'].indexOf(k) !== -1;

        if (isForwardKey || isKNavKey) {
          if (isKNavKey) {
            e.preventDefault();
          }
          var iframe = document.getElementById('mh-content-frame');
          if (iframe && iframe.contentWindow) {
            try {
              iframe.contentWindow.postMessage({ type: 'mh-keydown', key: k, code: e.code }, window.location.origin);
            } catch (err) { }
          }
        }
      });

    }

    // 2. Registra o listener no IFrame
    if (IS_IN_IFRAME) {
      document.addEventListener('keydown', function (e) {
        if (e.ctrlKey || e.metaKey || e.altKey) return;

        if (e.key === 'Escape') {
          if (typeof window.closeKModal === 'function') {
            window.closeKModal();
          }
          return;
        }

        // If K modal is open, don't let the global hotkey handler interfere
        var kModal = document.getElementById('dashKModal');
        if (kModal && kModal.classList.contains('open')) return;

        handleGlobalHotkey(e.key, e.code, e);
      });

      window.addEventListener('message', function (e) {
        if (e.origin !== window.location.origin) return;
        var iframe = document.getElementById('mh-content-frame');
        if (!iframe || e.source !== iframe.contentWindow) return;

        var data = e.data;
        if (!data || typeof data !== 'object') return;
        if (data.type === 'mh-keydown') {
          if (data.key === 'Escape') {
            if (typeof window.closeKModal === 'function') {
              window.closeKModal();
            }
            return;
          }

          // If K modal is open, route nav keys directly to its handler
          var kModal = document.getElementById('dashKModal');
          if (kModal && kModal.classList.contains('open')) {
            var navKeys = ['w', 'W', 's', 'S', 'ArrowUp', 'ArrowDown', 'Enter', 'd', 'D', 'a', 'A'];
            if (navKeys.indexOf(data.key) !== -1) {
              // Manually fire a synthetic event only on the window keydown
              // that onKeyDown (added by openKModal) is listening to
              try {
                var evt = new KeyboardEvent('keydown', {
                  key: data.key,
                  code: data.code || data.key,
                  bubbles: false,
                  cancelable: true
                });
                window.dispatchEvent(evt);
              } catch (err) { }
              return;
            }
          }

          handleGlobalHotkey(data.key, data.code, null);
        }
      });
    }

    // 3. Registra o listener para páginas standalone
    if (!IS_ROOT && !IS_IN_IFRAME) {
      document.addEventListener('keydown', function (e) {
        if (e.ctrlKey || e.metaKey || e.altKey) return;

        if (e.key === 'Escape') {
          if (typeof window.closeDashNotifPanel === 'function') {
            window.closeDashNotifPanel();
          }
          return;
        }

        handleGlobalHotkey(e.key, e.code, e);
      });
    }

    // Auto-abrir modais pendentes ao carregar a página
    document.addEventListener('DOMContentLoaded', function () {
      if (CURRENT_FILE === 'hoje.html') {
        var openDay = sessionStorage.getItem('mh_open_day');
        if (openDay) {
          sessionStorage.removeItem('mh_open_day');
          setTimeout(function () {
            var offset = openDay === 'today' ? 0 : 1;
            var getDateOffsetFn = window.getDateOffset || function (off) {
              var d = new Date();
              d.setDate(d.getDate() + off);
              return d.toISOString().split('T')[0];
            };
            if (typeof window.openModal === 'function') {
              window.openModal('task');
              setTimeout(function () {
                var dateInput = document.getElementById('taskData');
                if (dateInput) {
                  if (typeof window.dcSetDate === 'function') {
                    window.dcSetDate(dateInput, getDateOffsetFn(offset));
                  } else {
                    dateInput.value = getDateOffsetFn(offset);
                  }
                }
              }, 50);
            }
          }, 250);
        }
      } else if (CURRENT_FILE === 'notas.html') {
        if (sessionStorage.getItem('mh_open_notes_new') === 'true') {
          sessionStorage.removeItem('mh_open_notes_new');
          setTimeout(function () {
            if (typeof window.createNote === 'function') {
              window.createNote();
            }
          }, 250);
        }
      } else if (CURRENT_FILE === 'saude.html') {
        if (sessionStorage.getItem('mh_open_weight_new') === 'true') {
          sessionStorage.removeItem('mh_open_weight_new');
          setTimeout(function () {
            if (typeof window.openWeightLog === 'function') {
              window.openWeightLog();
            }
          }, 250);
        }
      }
    });

  }

  /* ════════════════════════════════════════════
     SHELL IFRAME MANAGER (Só roda na raiz)
  ════════════════════════════════════════════ */
  /* ════════════════════════════════════════════
     SHELL IFRAME MANAGER (Só roda na raiz - Fallback)
  ════════════════════════════════════════════ */
  if (IS_ROOT) {
    (function () {
      function initShellFrame() {
        var iframe = document.getElementById('mh-content-frame');
        if (!iframe) return;

        // Listener de fallback caso a comunicação via postMessage não inicialize a tempo
        iframe.addEventListener('load', function () {
          try {
            var childWindow = iframe.contentWindow;
            if (!childWindow) return;
            var childUrl = childWindow.location.pathname.split('/').pop() || 'auth.html';
            var search = childWindow.location.search;

            var ov = document.getElementById('mh-page-overlay');
            if (ov) ov.classList.remove('mh-ov-out');

            var isChildPublic = PUBLIC_PAGES.indexOf(childUrl) !== -1;

            var routeKey = FILE_TO_KEY[childUrl];
            if (!IS_IN_IFRAME && routeKey) ACTIVE_KEY = routeKey;
            var _foreign = _mhIsForeignProfile(childUrl, search);
            if (routeKey || _foreign) {
              var navButtons = document.querySelectorAll('.mh-sidebar .mh-nb');
              navButtons.forEach(function (btn) {
                btn.classList.toggle('on', !_foreign && btn.getAttribute('data-mhkey') === routeKey);
              });
              var _accFb = document.querySelector('.mh-sidebar .mh-account');
              if (_accFb) _accFb.classList.toggle('on', !_foreign && routeKey === 'profile');
            }

            var searchQS = search ? (search.startsWith('?') ? search : '?' + search) : '';
            var cleanChild = childUrl.replace(/\.html$/, '');
            var paramPage = (childUrl === 'auth.html' || childUrl === 'index.html') ? '/' + searchQS : '/' + cleanChild + searchQS;
            var newUrl = location.protocol + '//' + location.host + paramPage;
            if (location.href !== newUrl) {
              history.replaceState(null, '', paramPage);
            }

            var sb = document.getElementById('mh-sidebar-wrapper');
            if (sb) {
              var targetDisplay = isChildPublic ? 'none' : 'block';
              if (sb.style.display !== targetDisplay) {
                sb.style.display = targetDisplay;
              }
              iframe.style.left = '0';
              iframe.style.width = '100%';
            }
          } catch (err) {
            // Este catch previne erros de política de mesma origem em file://
          }
        });
      }

      if (document.readyState === 'complete') {
        initShellFrame();
      } else {
        window.addEventListener('load', initShellFrame);
      }
    })();
  }

  // ── CENTRALIZED K-HOTKEY MODAL & VISUAL CUSTOMIZER ──
  (function () {
    var CORE_PAGES = ['dashboard.html', 'hoje.html', 'metas.html', 'saude.html', 'estudos.html', 'foco.html', 'settings.html', 'notas.html'];
    if (IS_PUBLIC || CORE_PAGES.indexOf(CURRENT_FILE) === -1) {
      return;
    }

    // consolidated Google Fonts link injection
    if (!document.getElementById('mh-google-fonts')) {
      var link = document.createElement('link');
      link.id = 'mh-google-fonts';
      link.rel = 'stylesheet';
      link.href = 'https://fonts.googleapis.com/css2?family=Chakra+Petch:wght@400;700&family=Cinzel:wght@400;700&family=Orbitron:wght@400;700&family=Permanent+Marker&family=Playfair+Display:ital,wght@0,400;0,700&family=Rajdhani:wght@400;700&family=Bebas+Neue&family=DM+Sans:wght@400;700&family=Inter:wght@400;700&family=Space+Grotesk:wght@400;700&family=Lora:ital,wght@0,400;0,700;1,400&family=Fira+Code:wght@400;700&family=Syne:wght@700;800&family=Caveat:wght@400;700&family=Syncopate:wght@400;700&family=Montserrat:wght@400;700&family=Press+Start+2P&family=Pixelify+Sans:wght@400;700&family=Exo+2:wght@400;700&family=Fraunces:ital,opsz,wght@0,9..144,400;0,9..144,700;1,9..144,400&display=swap';
      document.head.appendChild(link);
    }

    // CSS inject
    var custCss = [
      '.pfont-dmsans { --profile-font: "Exo 2", sans-serif; --fm: "Exo 2", sans-serif !important; }',
      '.pfont-orbitron { --profile-font: "Orbitron", sans-serif; --fm: "Orbitron", sans-serif !important; }',
      '.pfont-cinzel { --profile-font: "Cinzel", serif; --fm: "Cinzel", serif !important; }',
      '.pfont-bebas { --profile-font: "Bebas Neue", cursive; --fm: "Bebas Neue", cursive !important; }',
      '.pfont-marker { --profile-font: "Permanent Marker", cursive; --fm: "Permanent Marker", cursive !important; }',
      '.pfont-playfair { --profile-font: "Playfair Display", serif; --fm: "Playfair Display", serif !important; }',
      '.pfont-rajdhani { --profile-font: "Rajdhani", sans-serif; --fm: "Rajdhani", sans-serif !important; }',
      '.pfont-chakra { --profile-font: "Chakra Petch", sans-serif; --fm: "Chakra Petch", sans-serif !important; }',
      '.pfont-inter { --profile-font: "Inter", sans-serif; --fm: "Inter", sans-serif !important; }',
      '.pfont-spacegrotesk { --profile-font: "Space Grotesk", sans-serif; --fm: "Space Grotesk", sans-serif !important; }',
      '.pfont-lora { --profile-font: "Lora", serif; --fm: "Lora", serif !important; }',
      '.pfont-firacode { --profile-font: "Fira Code", monospace; --fm: "Fira Code", monospace !important; }',
      '.pfont-syne { --profile-font: "Syne", sans-serif; --fm: "Syne", sans-serif !important; }',
      '.pfont-caveat { --profile-font: "Caveat", cursive; --fm: "Caveat", cursive !important; }',
      '.pfont-syncopate { --profile-font: "Syncopate", sans-serif; --fm: "Syncopate", sans-serif !important; }',
      '.pfont-montserrat { --profile-font: "Montserrat", sans-serif; --fm: "Montserrat", sans-serif !important; }',
      '.pfont-pressstart { --profile-font: "Press Start 2P", cursive; --fm: "Press Start 2P", cursive !important; }',
      'body.pfont-pressstart { font-size: 56% !important; }',
      'body.pfont-pressstart .ficha-title { font-size: 11px !important; }',
      'body.pfont-pressstart .ficha-body { font-size: 8.5px !important; }',
      'body.pfont-pressstart .ri-title { font-size: 8.5px !important; }',
      'body.pfont-pressstart .ri-snippet { font-size: 7.5px !important; }',
      'body.pfont-pressstart .rail-title { font-size: 7px !important; }',
      'body.pfont-pressstart .rail-count { font-size: 11px !important; }',
      'body.pfont-pressstart .btn, body.pfont-pressstart .btn-new { font-size: 8.5px !important; }',
      'body.pfont-pressstart .badge { font-size: 8px !important; }',
      '.pfont-pixelify { --profile-font: "Pixelify Sans", sans-serif; --fm: "Pixelify Sans", sans-serif !important; }',
      '.pfont-exo2 { --profile-font: "DM Sans", sans-serif; --fm: "DM Sans", sans-serif !important; }',
      '.pfont-fraunces { --profile-font: "Fraunces", serif; --fm: "Fraunces", serif !important; }',
      'body { font-family: var(--profile-font, "Exo 2", sans-serif) !important; }'
    ];

    var isLegacyCustomPage = false;
    custCss.push(
      '@keyframes mhcoPanelIn{from{opacity:0;transform:translateY(10px)}to{opacity:1;transform:translateY(0)}}',
      '#dashCustomOverlay{position:fixed;inset:0;background:rgba(0,0,0,0.55);backdrop-filter:blur(12px);-webkit-backdrop-filter:blur(12px);z-index:100002;display:none;align-items:center;justify-content:center;padding:2rem 1rem}',
      '#dashCustomOverlay.open{display:flex}',
      '#mhco-panel{position:relative;width:100%;max-width:1310px;height:640px;max-height:calc(100vh - 4rem);background:#18181b;border:1px solid #3f3f46;border-radius:.75rem;box-shadow:0 30px 60px -15px rgba(0,0,0,.55);overflow:hidden;font-family:"Exo 2",sans-serif;color:#fff}',
      '#mhco-close{position:absolute;top:1.25rem;right:1.25rem;width:2.25rem;height:2.25rem;border-radius:9999px;background:rgba(255,255,255,.1);border:none;display:flex;align-items:center;justify-content:center;cursor:pointer;z-index:10;transition:background .2s}',
      '#mhco-close:hover{background:rgba(255,255,255,.2)}',
      '#mhco-close svg{width:1.1rem;height:1.1rem;color:#fff}',
      '#mhco-mode-toggle{position:absolute;top:1.25rem;right:4.25rem;z-index:10}',
      '.mhco-seg{display:inline-flex;border:1px solid #27272a;border-radius:.625rem;overflow:hidden;width:fit-content}',
      '.mhco-seg-opt{background:transparent;border:none;color:#9ca3af;font-family:inherit;font-size:.8125rem;padding:.65rem 1.15rem;cursor:pointer;transition:background .2s,color .2s}',
      '.mhco-seg-opt+.mhco-seg-opt{border-left:1px solid #27272a}',
      '.mhco-seg-opt:hover{color:#fff}',
      '.mhco-seg-opt.active{background:rgba(255,255,255,.1);color:#fff}',
      '#mhco-header-mask{position:absolute;top:0;left:0;right:0;height:4.75rem;background:linear-gradient(to bottom,#18181b 60%,rgba(24,24,27,0) 100%);z-index:5;pointer-events:none;opacity:0;transition:opacity .3s cubic-bezier(.16,1,.3,1)}',
      '#mhco-header-mask.visible{opacity:1}',
      '#mhco-content{position:absolute;inset:0;padding:3.25rem 1.75rem 1.75rem;display:flex;flex-direction:column}',
      '#mhco-body-wrap{position:relative;flex:1;min-width:0;min-height:0;display:flex}',
      '#mhco-body{flex:1;min-width:0;min-height:0;display:flex;flex-direction:column;overflow-y:auto;padding-right:.75rem;scrollbar-width:none;-ms-overflow-style:none}',
      '#mhco-body::-webkit-scrollbar{display:none}',
      '#mhco-filter-content{display:flex;flex-direction:column;animation:mhcoPanelIn 220ms cubic-bezier(.16,1,.3,1) forwards}',
      '.mhco-sb-track{position:absolute;top:3.25rem;right:-.5rem;bottom:0;width:2px;pointer-events:none}',
      '.mhco-sb-thumb{position:absolute;right:0;width:2px;background:#3f3f46;opacity:.5;transition:opacity .2s,background .2s}',
      '#mhco-body-wrap:hover .mhco-sb-thumb,.mhco-sb-thumb.scrolling{opacity:1}',
      '.mhco-sb-thumb.scrolling{background:rgba(255,255,255,.3)}',
      '.mhco-section{display:flex;flex-direction:column;gap:1.25rem;padding:1.75rem 0;border-top:1px solid #27272a}',
      '.mhco-section.no-top{border-top:none;padding-top:0}',
      '.mhco-title{margin:0;font-size:.75rem;text-transform:uppercase;letter-spacing:.1em;color:#9ca3af}',
      '.mhco-hint{font-size:.75rem;color:#9ca3af;margin:-.5rem 0 0 0}',
      '.mhco-filters-hd{display:flex;align-items:center;justify-content:space-between;gap:1rem;flex-wrap:wrap}',
      '.mhco-chips{display:flex;flex-wrap:wrap;gap:.5rem 1.75rem;margin-top:.25rem;border-bottom:1px solid #27272a;padding-bottom:.9rem}',
      '.mhco-chip{background:none;border:none;padding:0 0 .9rem 0;margin-bottom:-.9rem;font-family:inherit;font-size:.8125rem;color:#9ca3af;position:relative;cursor:pointer;white-space:nowrap;transition:color .2s,opacity .2s}',
      '.mhco-chip::after{content:"";position:absolute;left:0;right:0;bottom:-1px;height:2px;background:#fff;transform:scaleX(0);transform-origin:left;transition:transform .25s cubic-bezier(.16,1,.3,1)}',
      '.mhco-chip:hover{color:#fff}.mhco-chip.selected{color:#fff}.mhco-chip.selected::after{transform:scaleX(1)}',
      '.mhco-chip.disabled{color:#9ca3af;opacity:.4;cursor:not-allowed;pointer-events:none}',
      '.mhco-upload-card{position:relative;width:100%;aspect-ratio:1920/940;border-radius:.75rem;border:1px dashed #3f3f46;background:rgba(255,255,255,.05);overflow:hidden;display:flex;align-items:center;justify-content:center}',
      '.mhco-upload-card img{position:absolute;inset:0;width:100%;height:100%;object-fit:fill}',
      '.mhco-upload-empty{display:flex;flex-direction:column;align-items:center;gap:.5rem;color:#9ca3af;font-size:.8125rem;pointer-events:none}',
      '.mhco-upload-empty svg{width:1.75rem;height:1.75rem}',
      '.mhco-mock-cards{position:absolute;inset:0;pointer-events:none;z-index:2}',
      '.mhco-mock-card{position:absolute;border-radius:10px;background:rgba(15,15,15,.45);backdrop-filter:blur(12px) saturate(1.6) brightness(1.08);-webkit-backdrop-filter:blur(12px) saturate(1.6) brightness(1.08);border:1px solid rgba(255,255,255,.13);box-shadow:0 4px 24px rgba(0,0,0,.28),inset 0 1px 0 rgba(255,255,255,.07)}',
      '.mhco-mock-div{position:absolute;background:rgba(255,255,255,.16)}.mhco-mock-div-v{width:1px}.mhco-mock-div-h{height:1px}',
      '.mhco-upload-actions{display:flex;align-items:center;gap:.75rem;flex-wrap:wrap}',
      '.mhco-upload-actions .mhco-btn[disabled]{opacity:.4;cursor:not-allowed;pointer-events:none}',
      '.mhco-opacity-row{display:flex;align-items:center;gap:.9rem}',
      '.mhco-opacity-row .mhco-opacity-label{min-width:6.5rem;flex-shrink:0;font-size:.75rem;color:#9ca3af}',
      '.mhco-slider{flex:1;-webkit-appearance:none;appearance:none;height:2px;background:#3f3f46;border-radius:2px;outline:none;cursor:pointer}',
      '.mhco-slider::-webkit-slider-thumb{-webkit-appearance:none;width:.9rem;height:.9rem;border-radius:50%;background:#fff;cursor:pointer;border:2px solid #09090b}',
      '.mhco-slider::-moz-range-thumb{width:.9rem;height:.9rem;border-radius:50%;background:#fff;cursor:pointer;border:2px solid #09090b}',
      '.mhco-opacity-val{min-width:2.75rem;text-align:right;font-size:.8125rem;color:#9ca3af;flex-shrink:0}',
      '.mhco-sidebar-grid{display:grid;grid-template-columns:repeat(2,1fr);gap:.6rem}',
      '.mhco-sidebar-card{display:block;width:100%;background:rgba(255,255,255,.05);border:1px solid #27272a;border-radius:.5rem;padding:.6rem;text-align:left;font-family:inherit;cursor:pointer;transition:border-color .2s,background .2s}',
      '.mhco-sidebar-card:hover{border-color:#3f3f46;background:#27272a}.mhco-sidebar-card.selected{border-color:rgba(255,255,255,.3);background:rgba(255,255,255,.1)}',
      '.mhco-sidebar-preview{display:flex;height:2.75rem;border-radius:.375rem;overflow:hidden;border:1px solid #27272a}',
      '.mhco-sidebar-preview .mhco-rail{width:28%;height:100%;background:rgba(255,255,255,.1)}.mhco-sidebar-preview .mhco-sbody{flex:1;height:100%;background:rgba(255,255,255,.05)}',
      '.mhco-sidebar-card[data-style="blackout"] .mhco-rail{background:#000}',
      '.mhco-sidebar-card[data-style="offwhite"] .mhco-rail{background:#f5f5f0;border-right:1px solid rgba(0,0,0,.15)}',
      '.mhco-sidebar-card[data-style="padrao"] .mhco-rail{background:#3f3f46}',
      '.mhco-sidebar-card[data-style="bege"] .mhco-rail{background:#d8c3a0}',
      '.mhco-sidebar-name{margin:.5rem 0 0 0;font-size:.8125rem;color:#fff}.mhco-sidebar-desc{margin:.15rem 0 0 0;font-size:.7rem;color:#9ca3af}',
      '.mhco-glass-bulk{display:flex;gap:.5rem;flex-wrap:wrap}',
      '.mhco-toggle-row{display:flex;align-items:center;justify-content:space-between;gap:1.5rem;padding:.8rem 0}',
      '.mhco-toggle-row+.mhco-toggle-row{border-top:1px solid #27272a}',
      '.mhco-toggle-label{font-size:.875rem;color:#fff}',
      '.mhco-toggle-row-text{display:flex;flex-direction:column;gap:.2rem}',
      '.mhco-toggle-desc{font-size:.75rem;color:#9ca3af}',
      '.mhco-switch{width:1.375rem;height:1.375rem;flex-shrink:0;border-radius:.375rem;border:1px solid #27272a;background:transparent;padding:0;display:flex;align-items:center;justify-content:center;cursor:pointer;transition:background .2s,border-color .2s}',
      '.mhco-switch:hover{border-color:#3f3f46}',
      '.mhco-switch-check{width:.7rem;height:.7rem;color:#09090b;opacity:0;transform:scale(.6);transition:opacity .15s,transform .15s cubic-bezier(.16,1,.3,1)}',
      '.mhco-switch.on{background:#fff;border-color:#fff}.mhco-switch.on .mhco-switch-check{opacity:1;transform:scale(1)}',
      '.mhco-btn{font-family:inherit;font-size:.8125rem;font-weight:500;border-radius:.625rem;padding:.65rem 1.1rem;cursor:pointer;transition:border-color .2s,background .2s,color .2s;width:fit-content}',
      '.mhco-btn-outline{background:transparent;border:1px solid #3f3f46;color:#fff}.mhco-btn-outline:hover{background:rgba(255,255,255,.05);border-color:rgba(255,255,255,.3)}',
      '.mhco-btn-sm{padding:.5rem .85rem;font-size:.75rem}'
    );

    custCss.push(
      /* Font grid styles (used on legacy pages too) */
      '.dc-font-grid { display: grid; grid-template-columns: repeat(2, 1fr); gap: 8px; }',
      '.dc-font-card { background: rgba(255,255,255,0.03); border: 1px solid rgba(255,255,255,0.06); border-radius: 10px; padding: 12px; cursor: pointer; text-align: center; transition: all 0.2s; }',
      'body.sb-branco .dc-font-card { background: rgba(0,0,0,0.02); border-color: rgba(0,0,0,0.06); }',
      '.dc-font-card:hover { background: rgba(255,255,255,0.06); border-color: rgba(255,255,255,0.15); }',
      'body.sb-branco .dc-font-card:hover { background: rgba(0,0,0,0.04); border-color: rgba(0,0,0,0.12); }',
      '.dc-font-card.sel { background: rgba(255,255,255,0.08); border-color: rgba(255,255,255,0.3); box-shadow: 0 4px 12px rgba(0,0,0,0.25); }',
      'body.sb-branco .dc-font-card.sel { background: rgba(0,0,0,0.08); border-color: rgba(0,0,0,0.3); }',
      '.dc-font-name { font-size: 13px; font-weight: 600; color: var(--t1, #fff); }',
      'body.sb-branco .dc-font-name { color: #111; }',
      '.dc-font-preview { font-size: 10px; color: var(--t4, #666); margin-top: 4px; }',

      /* K-modal styles */
      '.k-overlay { position: fixed; inset: 0; z-index: 100000; background: rgba(6, 6, 9, 0.4); opacity: 0; visibility: hidden; display: flex; align-items: center; justify-content: center; transition: opacity 0.3s cubic-bezier(0.16, 1, 0.3, 1), backdrop-filter 0.3s cubic-bezier(0.16, 1, 0.3, 1), visibility 0.3s; }',
      '.k-overlay.open { opacity: 1; visibility: visible; backdrop-filter: blur(12px); -webkit-backdrop-filter: blur(12px); }',
      '.k-panel { background: rgba(10, 10, 14, 0.72); border: 1px solid rgba(255, 255, 255, 0.08); border-radius: 20px; padding: 30px 40px; width: min(340px, 90vw); box-shadow: 0 30px 80px rgba(0,0,0,0.6); text-align: center; transform: scale(0.95) translateY(10px); transition: transform 0.3s cubic-bezier(0.16, 1, 0.3, 1); }',
      '.k-overlay.open .k-panel { transform: scale(1) translateY(0); }',
      '.k-title { font-family: var(--fm, "Exo 2", sans-serif); font-size: 16px; font-weight: 700; color: var(--t1, #ffffff); margin-bottom: 4px; }',
      '.k-desc { font-family: var(--fm, "Exo 2", sans-serif); font-size: 10.5px; color: var(--t4, rgba(255,255,255,0.4)); margin-bottom: 22px; }',
      '.k-buttons { display: flex; flex-direction: column; gap: 10px; }',
      '.k-btn { background: rgba(255, 255, 255, 0.03); border: 1px solid rgba(255, 255, 255, 0.05); border-radius: 12px; padding: 13px 18px; display: flex; align-items: center; gap: 12px; color: var(--t2, #e0e0e0); font-family: var(--fm, "Exo 2", sans-serif); font-size: 12.5px; font-weight: 600; transition: all 0.2s ease; text-align: left; outline: none; border: 1px solid transparent; }',
      '.k-btn.active { background: rgba(255, 255, 255, 0.08) !important; border-color: rgba(255, 255, 255, 0.2) !important; color: var(--t1, #ffffff) !important; transform: translateY(-1.5px); box-shadow: 0 6px 18px rgba(0,0,0,0.25); }',
      '.k-btn-sair { border: 1px solid transparent !important; }',
      '.k-btn-sair.active { background: rgba(255, 50, 50, 0.08) !important; border-color: rgba(255, 50, 50, 0.22) !important; color: #ff6b6b !important; }',
      '.k-btn-icon { width: 15px; height: 15px; flex-shrink: 0; opacity: 0.65; transition: opacity 0.2s; }',
      '.k-btn.active .k-btn-icon { opacity: 1 !important; }',
      '.k-guide { margin-top: 18px; font-family: var(--fm, "Exo 2", sans-serif); font-size: 8.5px; letter-spacing: 0.5px; text-transform: uppercase; color: var(--t4, rgba(255,255,255,0.2)); display: flex; align-items: center; justify-content: center; gap: 4px; border-top: 1px solid rgba(255, 255, 255, 0.05); padding-top: 14px; }'
    );

    var style = document.createElement('style');
    style.id = 'mh-global-customizer-css';
    style.textContent = custCss.join('\n');
    document.head.appendChild(style);

    // Helpers
    window.globalGetOrCreateBgLayer = function () {
      var existing = document.getElementById('dashBgLayer') ||
        document.getElementById('hojeBgLayer') ||
        document.getElementById('metasBgLayer') ||
        document.getElementById('healthBgLayer') ||
        document.getElementById('finBgLayer') ||
        document.getElementById('focoBgLayer') ||
        document.getElementById('estBgLayer') ||
        document.getElementById('notesBgLayer') ||
        document.getElementById('globalPageBgLayer');
      if (existing) return existing;

      var layer = document.createElement('div');
      layer.id = 'globalPageBgLayer';
      layer.style.position = 'fixed';
      layer.style.inset = '0';
      layer.style.zIndex = '-99999';
      layer.style.backgroundSize = 'cover';
      layer.style.backgroundPosition = 'center';
      layer.style.backgroundRepeat = 'no-repeat';
      layer.style.pointerEvents = 'none';
      layer.style.transition = 'opacity 0.3s';
      document.body.appendChild(layer);
      return layer;
    };

    window.globalApplyBg = function (url) {
      return new Promise(function (resolve) {
        var layer = window.globalGetOrCreateBgLayer();
        if (layer) {
          var op = localStorage.getItem(ACTIVE_KEY + 'BgOpacity');
          if (op === null) op = '0.55';
          var opVal = Number(op);
          if (opVal > 1) opVal = opVal / 100;

          if (url) {
            var img = new Image();
            img.onload = function () {
              layer.style.backgroundImage = 'url("' + url + '")';
              layer.style.opacity = opVal;
              resolve();
            };
            img.onerror = function () {
              layer.style.backgroundImage = '';
              layer.style.opacity = '0';
              resolve();
            };
            img.src = url;
          } else {
            layer.style.backgroundImage = '';
            layer.style.opacity = '0';
            resolve();
          }
        } else {
          resolve();
        }
      });
    };

    window.globalApplyFont = function (font) {
      var FONT_CLASSES = ['pfont-dmsans', 'pfont-orbitron', 'pfont-cinzel', 'pfont-bebas', 'pfont-marker', 'pfont-playfair', 'pfont-rajdhani', 'pfont-chakra', 'pfont-inter', 'pfont-spacegrotesk', 'pfont-lora', 'pfont-firacode', 'pfont-syne', 'pfont-caveat', 'pfont-syncopate', 'pfont-montserrat', 'pfont-pressstart', 'pfont-pixelify', 'pfont-exo2', 'pfont-fraunces'];
      FONT_CLASSES.forEach(function (c) { document.body.classList.remove(c); });
      if (font && font !== 'dmsans') {
        document.body.classList.add('pfont-' + font);
      }
    };

    // ── Fila de sincronização de perfil ──
    // Garante que os PATCH /user/me sejam enviados em ordem (evita que uma resposta
    // atrasada de um valor antigo sobrescreva no banco um valor mais novo já salvo),
    // e expõe window._mhPendingSaves para o background sync saber se deve esperar.
    window._mhPendingSaves = 0;
    window._mhProfileSaveQueue = Promise.resolve();
    window._mhQueueProfileSave = function (payload) {
      if (!window.api || typeof window.api.updateProfile !== 'function') return Promise.resolve();
      window._mhPendingSaves++;
      // Grava um "cadeado" no localStorage (sobrevive a F5, diferente do _mhPendingSaves
      // que é só memória). Assim, se a página recarregar com o PATCH ainda em voo, a
      // página nova sabe que precisa esperar antes de confiar num GET do servidor.
      try { localStorage.setItem('mh_custom_sync_lock', String(Date.now())); } catch (e) { }
      window._mhProfileSaveQueue = window._mhProfileSaveQueue
        .then(function () { return window.api.updateProfile(payload); })
        .catch(function (err) {
          console.warn('Core sync failed, using local storage.', err);
          if (typeof toast === 'function') {
            toast('⚠️ Não foi possível salvar sua customização no servidor. Verifique sua conexão.', 'erro');
          }
        })
        .finally(function () {
          window._mhPendingSaves = Math.max(0, window._mhPendingSaves - 1);
          if (window._mhPendingSaves === 0) {
            try { localStorage.removeItem('mh_custom_sync_lock'); } catch (e) { }
          }
        });
      return window._mhProfileSaveQueue;
    };

    window.globalSaveSetting = function (key, val) {
      var lsKeyMap = { bgImage: 'BgImage', bgOpacity: 'BgOpacity', font: 'Font' };
      if (lsKeyMap[key] !== undefined) {
        localStorage.setItem(ACTIVE_KEY + lsKeyMap[key], val);
      }

      var user = null;
      try {
        user = JSON.parse(localStorage.getItem('minsq_auth_user')) || {};
      } catch (e) { }

      if (user && window.api && typeof window.api.updateProfile === 'function') {
        var cust = {};
        try {
          cust = typeof user.customization_json === 'string' ? JSON.parse(user.customization_json) : (user.customization_json || {});
        } catch (e) { }

        if (!cust[ACTIVE_KEY]) cust[ACTIVE_KEY] = {};
        cust[ACTIVE_KEY][key] = val;

        user.customization_json = JSON.stringify(cust);
        localStorage.setItem('minsq_auth_user', JSON.stringify(user));

        window._mhQueueProfileSave({ customization_json: cust });
      }
    };

    window.clearUserCustomizationStorage = function () {
      var _pages = ['dashboard', 'today', 'hoje', 'goals', 'metas', 'health', 'saude', 'study', 'estudos', 'foco', 'notes', 'notas', 'analytics', 'profile', 'settings', 'geral'];
      _pages.forEach(function (k) {
        try {
          localStorage.removeItem(k + 'BgImage');
          localStorage.removeItem(k + 'BgOpacity');
          localStorage.removeItem(k + 'Font');
          localStorage.removeItem('dc_layout_' + k);
        } catch (e) { }
      });
      try {
        localStorage.removeItem('dc_sb_pref');
        localStorage.removeItem('minsq_auth_user');
        localStorage.removeItem('minsq_last_user_id');
        localStorage.removeItem('minsq_token');
        localStorage.removeItem('mh_custom_sync_lock');
      } catch (e) { }
    };

    window.globalRemoveBg = function () {
      window.globalSaveSetting('bgImage', '');
      window.globalApplyBg('');
      if (typeof _syncCustomizerPanel === 'function') {
        _syncCustomizerPanel();
      }
      if (typeof toast === 'function') toast('✓ Fundo removido');
    };

    window.globalSelectFont = function (card) {
      var val = card.dataset.val;
      var grid = card.closest('.dc-font-grid');
      if (grid) {
        grid.querySelectorAll('.dc-font-card').forEach(function (c) { c.classList.remove('sel'); });
      } else {
        document.querySelectorAll('.dc-font-card').forEach(function (c) { c.classList.remove('sel'); });
      }
      card.classList.add('sel');
      window.globalApplyFont(val);
      window.globalSaveSetting('font', val);
    };

    window.globalRenderFontGrid = function (containerId) {
      var container = document.getElementById(containerId);
      if (!container) return;

      var FONTS = [
        { id: 'dmsans', name: 'Exo 2', preview: 'Padrão Minsq' },
        { id: 'orbitron', name: 'Orbitron', preview: 'Estilo sci-fi' },
        { id: 'cinzel', name: 'Cinzel', preview: 'Elegância clássica' },
        { id: 'bebas', name: 'Bebas Neue', preview: 'Impacto condensado' },
        { id: 'marker', name: 'Permanent Marker', preview: 'Escrita urbana' },
        { id: 'playfair', name: 'Playfair Display', preview: 'Editorial clássico' },
        { id: 'rajdhani', name: 'Rajdhani', preview: 'Técnico quadrado' },
        { id: 'chakra', name: 'Chakra Petch', preview: 'Cyberpunk' },
        { id: 'inter', name: 'Inter', preview: 'Minimalista' },
        { id: 'spacegrotesk', name: 'Space Grotesk', preview: 'Geometria técnica' },
        { id: 'lora', name: 'Lora', preview: 'Serifada editorial' },
        { id: 'firacode', name: 'Fira Code', preview: 'Código mono' },
        { id: 'syne', name: 'Syne', preview: 'Expressiva artística' },
        { id: 'caveat', name: 'Caveat', preview: 'Caligrafia humana' },
        { id: 'syncopate', name: 'Syncopate', preview: 'Futurista larga' },
        { id: 'montserrat', name: 'Montserrat', preview: 'Moderna geométrica' },
        { id: 'pressstart', name: 'Press Start 2P', preview: 'Retro 8-bit' },
        { id: 'pixelify', name: 'Pixelify Sans', preview: 'Quadrada gamer' },
        { id: 'exo2', name: 'DM Sans', preview: 'Clássica e legível' },
        { id: 'fraunces', name: 'Fraunces', preview: 'Serifada orgânica' }
      ];

      var activeFont = localStorage.getItem(ACTIVE_KEY + 'Font') || 'dmsans';

      container.innerHTML = FONTS.map(function (f) {
        var isSel = f.id === activeFont ? ' sel' : '';
        return '<div class="dc-font-card' + isSel + '" data-val="' + f.id + '" onclick="window.globalSelectFont(this)">'
          + '<div class="dc-font-name" style="font-family:\'' + f.name + '\', sans-serif">' + f.name + '</div>'
          + '<div class="dc-font-preview">' + f.preview + '</div>'
          + '</div>';
      }).join('');
    };

    // ── Customizer Panel ──
    // Override AFTER DOMContentLoaded so legacy pages (dashboard, hoje, metas, notas)
    // cannot re-define openDashCustom after us and win.
    function _registerCustomizerFns() {
      function _openNew() {
        // Remove any legacy embedded overlay so the new one can be injected
        var oldOverlay = document.getElementById('dashCustomOverlay');
        if (oldOverlay) {
          var hasLegacyPanel = oldOverlay.querySelector('#dashCustomPanel');
          if (hasLegacyPanel) oldOverlay.parentNode.removeChild(oldOverlay);
        }
        var overlay = document.getElementById('dashCustomOverlay');
        if (!overlay) {
          _injectCustomizerHTML();
          overlay = document.getElementById('dashCustomOverlay');
        }
        if (!overlay) return;
        overlay.classList.add('open');
      }

      window.openDashCustom = _openNew;
      window.closeDashCustom = function () {
        var overlay = document.getElementById('dashCustomOverlay');
        if (overlay) overlay.classList.remove('open');
      };
    }

    if (document.readyState === 'loading') {
      document.addEventListener('DOMContentLoaded', function () { setTimeout(_registerCustomizerFns, 0); });
    } else {
      setTimeout(_registerCustomizerFns, 0);
    }

    // Close on Escape
    document.addEventListener('keydown', function (e) {
      if (e.key === 'Escape') {
        if (typeof window.closeDashCustom === 'function') {
          window.closeDashCustom();
        }
      }
    });

    function _injectCustomizerHTML() {
      if (document.getElementById('dashCustomOverlay')) return;

      var EASE = 'cubic-bezier(0.16,1,0.3,1)';

      var LAYOUT_FILTERS = {
        geral: { label: 'Geral', glass: { mode: 'master', desc: 'Ativa ou desativa o vidro fosco em todos os cards do Minsq de uma vez.' } },
        dashboard: { label: 'Dashboard', glass: { mode: 'list', items: ['Card principal', 'Lista do dia', 'Minhas metas', 'Perspectiva de vida', 'Frases para viver'] } },
        today: { label: 'Hoje', glass: { mode: 'list', items: ['Lista do dia', 'Rotina diária'] } },
        goals: { label: 'Metas', glass: { mode: 'list', items: ['Metas', 'Mapa de ação', 'Controle de vício'] } },

        health: { label: 'Saúde', glass: { mode: 'list', items: ['Dieta', 'Peso corporal', 'Hidratação'] } },
        study: { label: 'Estudo', glass: { mode: 'list', items: ['Timer de foco', 'Sessões recentes', 'Anotações', 'Matérias'] } },
        foco: { label: 'Foco', glass: { mode: 'list', items: ['Rotinas', 'Calendário'] } }
      };

      var SIDEBAR_STYLES = [
        { id: 'blackout', name: 'Blackout', desc: 'Fundo preto, contraste máximo.' },
        { id: 'offwhite', name: 'Off White', desc: 'Fundo claro, tom off-white.' },
        { id: 'padrao', name: 'Padrão', desc: 'Estilo padrão do Minsq.' },
        { id: 'bege', name: 'Bege', desc: 'Fundo bege, tom quente.' },
      ];

      var MOCK_LAYOUTS = {
        dashboard: [{ top: 3, left: 3, width: 46, height: 73 }, { top: 3, left: 51, width: 46, height: 73 }, { top: 79, left: 3, width: 94, height: 18 }],
        today: [{ top: 3, left: 3, width: 70, height: 94 }, { top: 3, left: 76, width: 21, height: 94 }],
        goals: [{ top: 3, left: 3, width: 94, height: 50 }, { top: 56, left: 3, width: 46, height: 41 }, { top: 56, left: 51, width: 46, height: 41 }],

        health: [{ top: 3, left: 3, width: 58, height: 94 }, { top: 3, left: 64, width: 33, height: 45 }, { top: 52, left: 64, width: 33, height: 45 }],
        study: [{ top: 0, left: 0, width: 11, height: 100 }, { top: 3, left: 14, width: 83, height: 20 }, { top: 27, left: 14, width: 25.67, height: 70 }, { top: 27, left: 42.67, width: 25.67, height: 70 }, { top: 27, left: 71.34, width: 25.67, height: 70 }],
        foco: [{ top: 3, left: 3, width: 94, height: 70 }]
      };

      var layoutState = {};
      var userCust = null;
      try {
        var usr = JSON.parse(localStorage.getItem('minsq_auth_user')) || {};
        userCust = typeof usr.customization_json === 'string' ? JSON.parse(usr.customization_json) : (usr.customization_json || {});
      } catch (e) { userCust = {}; }

      Object.keys(LAYOUT_FILTERS).forEach(function (k) {
        var s = {}; try { s = JSON.parse(localStorage.getItem('dc_layout_' + k) || '{}'); } catch (e) { }
        var c = userCust[k] || {};

        var bgImg = c.bgImage !== undefined ? c.bgImage : (s.bgImage !== undefined ? s.bgImage : '');

        var oldOp = localStorage.getItem(k + 'BgOpacity');
        var defaultOp = 80;
        if (oldOp !== null) {
          var parsedOp = Number(oldOp);
          if (!isNaN(parsedOp)) defaultOp = parsedOp <= 1 ? Math.round(parsedOp * 100) : parsedOp;
        }
        var bgOp = c.bgOpacity !== undefined ? c.bgOpacity : (s.bgOpacity !== undefined ? s.bgOpacity : defaultOp);

        layoutState[k] = {
          bgImage: bgImg,
          bgOpacity: bgOp,
          sidebarStyle: c.sidebarStyle || s.sidebarStyle || 'padrao',
          glassOn: c.glassOn !== undefined ? !!c.glassOn : !!s.glassOn,
          glassItems: c.glassItems || s.glassItems || {}
        };
      });

      var filterMode = 'individual'; // 'individual' | 'global'
      var currentFilter = (ACTIVE_KEY && LAYOUT_FILTERS[ACTIVE_KEY]) ? ACTIVE_KEY : 'dashboard';

      function saveLayoutState(key) {
        var st = layoutState[key];
        localStorage.setItem('dc_layout_' + key, JSON.stringify(st));
        try {
          var user = JSON.parse(localStorage.getItem('minsq_auth_user') || '{}') || {};
          var cust = {}; try { cust = typeof user.customization_json === 'string' ? JSON.parse(user.customization_json) : (user.customization_json || {}); } catch (e) { }
          if (!cust[key]) cust[key] = {};
          Object.assign(cust[key], st);

          if (key === 'geral') {
            Object.keys(LAYOUT_FILTERS).forEach(function (k) {
              if (k !== 'geral') {
                if (!cust[k]) cust[k] = {};
                cust[k].bgImage = st.bgImage;
                cust[k].bgOpacity = st.bgOpacity;
                cust[k].sidebarStyle = st.sidebarStyle;
                cust[k].glassOn = st.glassOn;
                if (LAYOUT_FILTERS[k].glass && LAYOUT_FILTERS[k].glass.items) {
                  if (!cust[k].glassItems) cust[k].glassItems = {};
                  LAYOUT_FILTERS[k].glass.items.forEach(function (item) {
                    cust[k].glassItems[item] = st.glassOn;
                  });
                }

                if (!layoutState[k]) layoutState[k] = {};
                layoutState[k].bgImage = st.bgImage;
                layoutState[k].bgOpacity = st.bgOpacity;
                layoutState[k].sidebarStyle = st.sidebarStyle;
                layoutState[k].glassOn = st.glassOn;
                if (LAYOUT_FILTERS[k].glass && LAYOUT_FILTERS[k].glass.items) {
                  if (!layoutState[k].glassItems) layoutState[k].glassItems = {};
                  LAYOUT_FILTERS[k].glass.items.forEach(function (item) {
                    layoutState[k].glassItems[item] = st.glassOn;
                  });
                }
                localStorage.setItem('dc_layout_' + k, JSON.stringify(layoutState[k]));
              }
            });
          }

          user.customization_json = JSON.stringify(cust);
          localStorage.setItem('minsq_auth_user', JSON.stringify(user));
          window._mhQueueProfileSave({ customization_json: cust });
        } catch (e) { }
      }



      function mockHTML(key) {
        return '';
      }

      var CHECK_SVG = '<svg class="mhco-switch-check" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="3" stroke-linecap="round" stroke-linejoin="round"><polyline points="20 6 9 17 4 12"/></svg>';

      function renderFilterContent(key) {
        var cfg = LAYOUT_FILTERS[key], st = layoutState[key];
        if (!cfg || !st) return;
        var fc = document.getElementById('mhco-filter-content');
        if (!fc) return;

        var sidebarHTML = SIDEBAR_STYLES.map(function (s) {
          return '<button type="button" class="mhco-sidebar-card' + (st.sidebarStyle === s.id ? ' selected' : '') + '" data-style="' + s.id + '">'
            + '<div class="mhco-sidebar-preview"><div class="mhco-rail"></div><div class="mhco-sbody"></div></div>'
            + '<p class="mhco-sidebar-name">' + s.name + '</p><p class="mhco-sidebar-desc">' + s.desc + '</p></button>';
        }).join('');

        // Vidro fosco UI foi removida - agora é ativado automaticamente via presença de imagem de fundo

        var bgTag = st.bgImage
          ? '<img src="' + st.bgImage + '" alt="" style="opacity:' + (st.bgOpacity / 100) + ';">'
          : '<div class="mhco-upload-empty"><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round"><rect x="3" y="3" width="18" height="18" rx="2"/><circle cx="8.5" cy="8.5" r="1.5"/><path d="M21 15l-5-5L5 21"/></svg><span>1920 × 940</span></div>';

        fc.innerHTML =
          '<div class="mhco-section">'
          + '<p class="mhco-title">Imagem de fundo</p>'
          + '<p class="mhco-hint" style="margin-top:-.25rem;">Recomendado 1920 × 940. Vale só para "' + cfg.label + '". A imagem é esticada pra preencher o espaço todo. Os blocos mostrados por cima são os cards reais da página.</p>'
          + '<div class="mhco-upload-card" id="mhco-bg-card">' + bgTag + mockHTML(key) + '</div>'
          + '<div class="mhco-upload-actions">'
          + '<label class="mhco-btn mhco-btn-outline mhco-btn-sm" for="mhco-bg-input" style="margin:0;cursor:pointer;">Enviar imagem</label>'
          + '<input type="file" accept=".jpg,.jpeg,.png,.webp,.gif,image/png,image/jpeg,image/webp,image/gif" id="mhco-bg-input" hidden>'
          + '<button type="button" class="mhco-btn mhco-btn-outline mhco-btn-sm" id="mhco-bg-remove"' + (st.bgImage ? '' : ' disabled') + '>Remover imagem</button>'
          + '</div>'
          + '<div class="mhco-opacity-row"><span class="mhco-opacity-label">Opacidade</span>'
          + '<input type="range" min="0" max="100" value="' + st.bgOpacity + '" class="mhco-slider" id="mhco-opacity-slider"' + (st.bgImage ? '' : ' disabled') + '>'
          + '<span class="mhco-opacity-val" id="mhco-opacity-val">' + st.bgOpacity + '%</span></div>'
          + '</div>'
          + '<div class="mhco-section"><p class="mhco-title">Estilo da sidebar</p>'
          + '<p class="mhco-hint" style="margin-top:-.25rem;">Escolha como a barra lateral aparece nesta área.</p>'
          + '<div class="mhco-sidebar-grid">' + sidebarHTML + '</div></div>';

        // Upload
        var inp = document.getElementById('mhco-bg-input');
        if (inp) inp.addEventListener('change', function () {
          var file = this.files && this.files[0]; if (!file) return;
          if (typeof toast === 'function') toast('Enviando imagem...');
          window.api.uploadFile(file, 'backgrounds').then(function (res) {
            st.bgImage = res.url; saveLayoutState(key);
            window.loadAndApplyPageCustomization();
            renderFilterContent(key);
            if (typeof toast === 'function') toast('✓ Imagem aplicada');
          }).catch(function (err) { if (typeof toast === 'function') toast(err.message || '⚠️ Erro ao enviar', 'erro'); });
          this.value = '';
        });

        // Remove
        var rmBtn = document.getElementById('mhco-bg-remove');
        if (rmBtn) rmBtn.addEventListener('click', function () {
          st.bgImage = ''; saveLayoutState(key);
          localStorage.removeItem(key + 'BgImage');
          if (key === 'geral') {
            // Also clear ACTIVE_KEY migration if clearing globally
            localStorage.removeItem(ACTIVE_KEY + 'BgImage');
          }
          window.loadAndApplyPageCustomization();
          renderFilterContent(key);
          if (typeof toast === 'function') toast('✓ Fundo removido');
        });

        // Opacity
        var sl = document.getElementById('mhco-opacity-slider'), ov = document.getElementById('mhco-opacity-val');
        if (sl) {
          var _dragStartOpacity = null;

          // Marca o valor de onde o arraste começou (mouse/touch/teclado).
          var _markDragStart = function () {
            if (_dragStartOpacity === null) _dragStartOpacity = st.bgOpacity;
          };
          sl.addEventListener('pointerdown', _markDragStart);
          sl.addEventListener('keydown', _markDragStart);

          // 'input' dispara a cada pixel arrastado — só atualiza a prévia visual
          // e o localStorage local, na hora. NÃO manda nada pro servidor aqui,
          // pra não gerar uma req por pixel.
          sl.addEventListener('input', function () {
            _markDragStart(); // garante que capturamos o início mesmo sem pointerdown (ex: clique direto na trilha)
            st.bgOpacity = Number(this.value); if (ov) ov.textContent = st.bgOpacity + '%';
            var img = fc.querySelector('#mhco-bg-card img'); if (img) img.style.opacity = st.bgOpacity / 100;
            localStorage.setItem('dc_layout_' + key, JSON.stringify(st));

            // Aplica ao vivo no fundo real da página (não só na prévia do modal),
            // mas só se o filtro que você tá editando for o da página atual
            // (ou "geral", que vale pra todas).
            if (key === ACTIVE_KEY || key === 'geral') {
              var realLayer = window.globalGetOrCreateBgLayer && window.globalGetOrCreateBgLayer();
              if (realLayer) realLayer.style.opacity = st.bgOpacity / 100;
            }
          });

          // 'change' dispara uma única vez, quando o usuário solta o slider.
          // Compara "de onde tava" (_dragStartOpacity) com "onde parou" (st.bgOpacity):
          // só manda a requisição pro servidor se o valor realmente mudou.
          sl.addEventListener('change', function () {
            var startVal = _dragStartOpacity;
            _dragStartOpacity = null;
            if (startVal !== null && startVal === st.bgOpacity) return; // nada mudou, não manda req à toa
            saveLayoutState(key); // uma única requisição, com o valor final
          });
        }

        // Sidebar
        fc.querySelectorAll('[data-style]').forEach(function (btn) {
          btn.addEventListener('click', function () {
            st.sidebarStyle = this.dataset.style; saveLayoutState(key);
            window.loadAndApplyPageCustomization();
            fc.querySelectorAll('.mhco-sidebar-card').forEach(function (c) { c.classList.remove('selected'); });
            this.classList.add('selected');
          });
        });


      }

      function applyFilterMode(mode) {
        filterMode = mode;
        var chips = document.getElementById('mhco-chips');
        if (!chips) return;
        var geralChip = chips.querySelector('[data-filter="geral"]');
        var others = Array.prototype.slice.call(chips.querySelectorAll('.mhco-chip')).filter(function (c) { return c !== geralChip; });
        if (mode === 'global') {
          if (geralChip) { geralChip.classList.remove('disabled'); geralChip.classList.add('selected'); }
          others.forEach(function (c) { c.classList.add('disabled'); c.classList.remove('selected'); });
          currentFilter = 'geral';
        } else {
          if (geralChip) { geralChip.classList.add('disabled'); geralChip.classList.remove('selected'); }
          others.forEach(function (c) { c.classList.remove('disabled'); });
          var toSel = chips.querySelector('[data-filter="' + (typeof ACTIVE_KEY !== 'undefined' ? ACTIVE_KEY : 'dashboard') + '"]') || others[0];
          if (toSel) { chips.querySelectorAll('.mhco-chip').forEach(function (c) { c.classList.remove('selected'); }); toSel.classList.add('selected'); currentFilter = toSel.dataset.filter; }
        }
        renderFilterContent(currentFilter);
      }

      // Build chips
      var chipsHTML = Object.keys(LAYOUT_FILTERS).map(function (k) {
        var dis = k === 'geral' ? ' disabled' : (k === currentFilter ? ' selected' : '');
        return '<button type="button" class="mhco-chip' + dis.replace('selected', 'selected') + '" data-filter="' + k + '">' + LAYOUT_FILTERS[k].label + '</button>';
      }).join('');
      // Fix: geral starts disabled, currentFilter starts selected
      chipsHTML = Object.keys(LAYOUT_FILTERS).map(function (k) {
        var cls = 'mhco-chip';
        if (k === 'geral') cls += ' disabled';
        else if (k === currentFilter) cls += ' selected';
        return '<button type="button" class="' + cls + '" data-filter="' + k + '">' + LAYOUT_FILTERS[k].label + '</button>';
      }).join('');

      var html = '<div id="dashCustomOverlay"><div id="mhco-panel">'
        + '<button type="button" id="mhco-close"><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><line x1="18" y1="6" x2="6" y2="18"/><line x1="6" y1="6" x2="18" y2="18"/></svg></button>'
        + '<div id="mhco-mode-toggle"><div class="mhco-seg" id="mhco-seg"><button class="mhco-seg-opt active" type="button" data-mode="individual">Individual</button><button class="mhco-seg-opt" type="button" data-mode="global">Global</button></div></div>'
        + '<div id="mhco-header-mask"></div>'
        + '<div id="mhco-content"><div id="mhco-body-wrap"><div id="mhco-body">'
        + '<div class="mhco-section no-top"><div class="mhco-filters-hd"><p class="mhco-title" style="margin:0;">Filtros</p></div>'
        + '<p class="mhco-hint" style="margin-top:-.25rem;">No modo Global, o filtro Geral se aplica a tudo. No modo Individual, escolha uma área para personalizar.</p>'
        + '<div class="mhco-chips" id="mhco-chips">' + chipsHTML + '</div></div>'
        + '<div id="mhco-filter-content"></div>'
        + '</div><div class="mhco-sb-track"><div class="mhco-sb-thumb"></div></div></div></div>'
        + '</div></div>';

      var wrap = document.createElement('div');
      wrap.innerHTML = html;
      document.body.appendChild(wrap.firstChild);

      // Close
      document.getElementById('mhco-close').addEventListener('click', function () { window.closeDashCustom(); });
      document.getElementById('dashCustomOverlay').addEventListener('click', function (e) { if (e.target === this) window.closeDashCustom(); });

      // Mode toggle
      document.getElementById('mhco-seg').addEventListener('click', function (e) {
        var opt = e.target.closest('.mhco-seg-opt'); if (!opt) return;
        this.querySelectorAll('.mhco-seg-opt').forEach(function (o) { o.classList.remove('active'); });
        opt.classList.add('active');
        applyFilterMode(opt.dataset.mode);
      });

      // Chips
      document.getElementById('mhco-chips').addEventListener('click', function (e) {
        var chip = e.target.closest('.mhco-chip'); if (!chip || chip.classList.contains('disabled')) return;
        this.querySelectorAll('.mhco-chip').forEach(function (c) { c.classList.remove('selected'); });
        chip.classList.add('selected');
        currentFilter = chip.dataset.filter;
        renderFilterContent(currentFilter);
      });

      // Custom scrollbar
      var body = document.getElementById('mhco-body');
      var thumb = document.querySelector('.mhco-sb-thumb');
      var mask = document.getElementById('mhco-header-mask');
      if (body && thumb) {
        var hideT;
        function updateThumb() {
          var sh = body.scrollHeight, ch = body.clientHeight;
          if (sh <= ch + 1) { thumb.style.height = '0'; return; }
          var avail = Math.max(ch - 52, 0);
          var th = Math.max((ch / sh) * avail, 24);
          var tp = (body.scrollTop / (sh - ch)) * (avail - th);
          thumb.style.height = th + 'px'; thumb.style.top = tp + 'px';
        }
        body.addEventListener('scroll', function () {
          updateThumb();
          thumb.classList.add('scrolling'); clearTimeout(hideT); hideT = setTimeout(function () { thumb.classList.remove('scrolling'); }, 600);
          if (mask) mask.classList.toggle('visible', body.scrollTop > 8);
        });
        body.addEventListener('wheel', function (e) { e.preventDefault(); body.scrollTop += e.deltaY * 0.5; }, { passive: false });
        if (typeof ResizeObserver !== 'undefined') { var ro = new ResizeObserver(updateThumb); ro.observe(body); }
        updateThumb();
      }

      renderFilterContent(currentFilter);
    }


    // ── K-Hotkey Modal ──
    window.toggleKModal = function () {
      var modal = document.getElementById('dashKModal');
      if (!modal) {
        _injectKModalHTML();
        modal = document.getElementById('dashKModal');
      }
      if (!modal) return;
      if (modal.classList.contains('open')) {
        window.closeKModal();
      } else {
        window.openKModal();
      }
    };

    var activeIndex = 0;
    var buttons = null;

    function getKButtons() {
      var modal = document.getElementById('dashKModal');
      if (!modal) return [];
      return Array.prototype.slice.call(modal.querySelectorAll('.k-btn'));
    }

    function updateActive(idx) {
      activeIndex = idx;
      getKButtons().forEach(function (btn, i) {
        btn.classList.toggle('active', i === activeIndex);
      });
    }

    function onKeyDown(e) {
      var btns = getKButtons();
      var total = btns.length;
      if (e.key === 'ArrowUp' || e.key === 'w' || e.key === 'W') {
        e.preventDefault();
        var next = (activeIndex - 1 + total) % total;
        updateActive(next);
      } else if (e.key === 'ArrowDown' || e.key === 's' || e.key === 'S') {
        e.preventDefault();
        var next = (activeIndex + 1) % total;
        updateActive(next);
      } else if (e.key === 'd' || e.key === 'D' || e.key === 'Enter') {
        e.preventDefault();
        var activeBtn = btns[activeIndex];
        if (activeBtn) {
          var action = activeBtn.getAttribute('data-action');
          if (action) {
            window.kNavigate(action);
          }
        }
      } else if (e.key === 'a' || e.key === 'A') {
        e.preventDefault();
        window.closeKModal();
      }
    }

    function onDocumentClick(e) {
      // Guard: if K modal is not open, self-remove and do nothing
      var modal = document.getElementById('dashKModal');
      if (!modal || !modal.classList.contains('open')) {
        document.removeEventListener('click', onDocumentClick, true);
        window.removeEventListener('keydown', onKeyDown);
        document.body.classList.remove('mh-k-active-parent');
        return;
      }

      if (e.button !== 0) return; // Only left click

      // Se o clique foi direto em um botão ou dentro dele, deixa a propagação normal do browser agir
      var btn = e.target.closest('.k-btn');
      if (btn) {
        return;
      }

      e.preventDefault();
      e.stopPropagation();
      var btns = getKButtons();
      var activeBtn = btns[activeIndex];
      if (activeBtn) {
        var action = activeBtn.getAttribute('data-action');
        if (action) {
          window.kNavigate(action);
        }
      }
    }

    window.openKModal = function () {
      var modal = document.getElementById('dashKModal');
      if (!modal) return;
      modal.classList.add('open');
      document.body.classList.add('mh-k-active-parent');

      activeIndex = 0;
      updateActive(0);

      window.addEventListener('keydown', onKeyDown);
      document.addEventListener('click', onDocumentClick, true); // Capture phase

      // Safety: auto-cleanup if the page unloads while modal is open
      window.addEventListener('pagehide', window.closeKModal, { once: true });

      try { parent.postMessage({ type: 'mh-k-modal-open' }, window.location.origin); } catch (e) { }
    };

    window.closeKModal = function () {
      var modal = document.getElementById('dashKModal');
      if (!modal) return;
      modal.classList.remove('open');
      document.body.classList.remove('mh-k-active-parent');

      window.removeEventListener('keydown', onKeyDown);
      document.removeEventListener('click', onDocumentClick, true);

      try { parent.postMessage({ type: 'mh-k-modal-close' }, window.location.origin); } catch (e) { }
    };

    window.kNavigate = function (action) {
      window.closeKModal();
      if (action === 'sair') {
        return; // Only closes the modal, doesn't logout
      }
      if (action === 'visual') {
        window.openDashCustom();
      } else if (action === 'tipografia') {
        if (typeof window.openTypographyModal === 'function') {
          window.openTypographyModal();
        }
      } else if (action === 'support') {
        sessionStorage.setItem('mh_auto_open_support_central', '1');
        window.go('settings');
      } else if (action === 'help') {
        if (typeof window.mhStartSpotlight === 'function') {
          window.mhStartSpotlight();
        }
      }
    };

    function _injectKModalHTML() {
      if (document.getElementById('dashKModal')) return;

      var menuButtons = [];

      if (CURRENT_FILE !== 'notas.html') {
        menuButtons.push({
          id: 'visual',
          label: 'Visual',
          svg: '<svg class="k-btn-icon" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round"><circle cx="12" cy="12" r="3"></circle><path d="M19.4 15a1.65 1.65 0 0 0 .33 1.82l.06.06a2 2 0 1 1-2.83 2.83l-.06-.06a1.65 1.65 0 0 0-1.82-.33 1.65 1.65 0 0 0-1 1.51V21a2 2 0 0 1-4 0v-.09A1.65 1.65 0 0 0 9 19.4a1.65 1.65 0 0 0-1.82.33l-.06.06a2 2 0 1 1-2.83-2.83l.06-.06a1.65 1.65 0 0 0 .33-1.82 1.65 1.65 0 0 0-1.51-1H3a2 2 0 0 1 0-4h.09A1.65 1.65 0 0 0 4.6 9a1.65 1.65 0 0 0-.33-1.82l-.06-.06a2 2 0 1 1 2.83-2.83l.06.06a1.65 1.65 0 0 0 1.82.33H9a1.65 1.65 0 0 0 1-1.51V3a2 2 0 0 1 4 0v.09a1.65 1.65 0 0 0 1 1.51 1.65 1.65 0 0 0 1.82-.33l.06-.06a2 2 0 1 1 2.83 2.83l-.06.06a1.65 1.65 0 0 0-.33 1.82V9a1.65 1.65 0 0 0 1.51 1H21a2 2 0 0 1 0 4h-.09a1.65 1.65 0 0 0-1.51 1z"></path></svg>',
          action: 'visual'
        });

        menuButtons.push({
          id: 'tipografia',
          label: 'Tipografia',
          svg: '<svg class="k-btn-icon" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round"><polyline points="4 7 4 4 20 4 20 7"></polyline><line x1="9" y1="20" x2="15" y2="20"></line><line x1="12" y1="4" x2="12" y2="20"></line></svg>',
          action: 'tipografia'
        });

        menuButtons.push({
          id: 'support',
          label: 'Suporte',
          svg: '<svg class="k-btn-icon" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round"><path d="M21 15a2 2 0 0 1-2 2H7l-4 4V5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2z"></path></svg>',
          action: 'support'
        });
      }

      menuButtons.push({
        id: 'help',
        label: 'Ajuda',
        svg: '<svg class="k-btn-icon" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round"><circle cx="12" cy="12" r="10"></circle><path d="M9.09 9a3 3 0 0 1 5.83 1c0 2-3 3-3 3"></path><line x1="12" y1="17" x2="12.01" y2="17"></line></svg>',
        action: 'help'
      });

      menuButtons.push({
        id: 'sair',
        label: 'Sair',
        svg: '<svg class="k-btn-icon" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round"><line x1="18" y1="6" x2="6" y2="18"></line><line x1="6" y1="6" x2="18" y2="18"></line></svg>',
        action: 'sair',
        class: 'k-btn-sair'
      });

      var buttonsHTML = menuButtons.map(function (btn) {
        var cls = 'k-btn' + (btn.class ? ' ' + btn.class : '');
        return '<button class="' + cls + '" data-action="' + btn.action + '" onclick="window.kNavigate(\'' + btn.action + '\')">'
          + btn.svg
          + '<span>' + btn.label + '</span>'
          + '</button>';
      }).join('\n');

      var html = [
        '<div id="dashKModal" class="k-overlay">',
        '  <div class="k-panel">',
        '    <div class="k-title">Menu Rápido</div>',
        '    <div class="k-desc">Atalho de Navegação</div>',
        '    <div class="k-buttons">',
        buttonsHTML,
        '    </div>',
        '    <div class="k-guide">',
        '      [W/S] navegar &bull; [D/Enter] confirmar &bull; [A] sair',
        '    </div>',
        '  </div>',
        '</div>'
      ].join('\n');

      var wrap = document.createElement('div');
      wrap.innerHTML = html;
      document.body.appendChild(wrap.firstChild);
    }

    // Apply customizations on load
    window.loadAndApplyPageCustomization = function () {
      var user = null;
      try {
        user = JSON.parse(localStorage.getItem('minsq_auth_user')) || {};
      } catch (e) { }

      var currentUserId = user ? (user.id || user.email || '') : '';
      var lastUserId = '';
      try { lastUserId = localStorage.getItem('minsq_last_user_id') || ''; } catch (e) { }
      if (currentUserId && lastUserId && String(lastUserId) !== String(currentUserId)) {
        var _pages = ['dashboard', 'today', 'hoje', 'goals', 'metas', 'health', 'saude', 'study', 'estudos', 'foco', 'notes', 'notas', 'analytics', 'profile', 'settings', 'geral'];
        _pages.forEach(function (k) {
          try {
            localStorage.removeItem(k + 'BgImage');
            localStorage.removeItem(k + 'BgOpacity');
            localStorage.removeItem(k + 'Font');
            localStorage.removeItem('dc_layout_' + k);
          } catch (e) { }
        });
        try { localStorage.removeItem('dc_sb_pref'); } catch (e) { }
      }
      if (currentUserId) {
        try { localStorage.setItem('minsq_last_user_id', String(currentUserId)); } catch (e) { }
      }

      var cust = {};
      try {
        cust = typeof user.customization_json === 'string' ? JSON.parse(user.customization_json) : (user.customization_json || {});
      } catch (e) { }

      var pageSettings = cust[ACTIVE_KEY] || {};
      var globalSettings = cust['geral'] || {};

      var font = pageSettings.font !== undefined ? pageSettings.font : (globalSettings.font !== undefined ? globalSettings.font : (localStorage.getItem(ACTIVE_KEY + 'Font') || 'dmsans'));
      localStorage.setItem(ACTIVE_KEY + 'Font', font);
      window.globalApplyFont(font);

      // settings.html tem seu próprio visual — não aplicar bg/sidebar/glass
      // para não vazar o fundo de outras páginas na topbar e no layout do settings.
      if (CURRENT_FILE === 'settings.html') return;

      var bgImg = pageSettings.bgImage !== undefined ? pageSettings.bgImage : (globalSettings.bgImage !== undefined ? globalSettings.bgImage : '');

      var oldOp = localStorage.getItem(ACTIVE_KEY + 'BgOpacity');
      var defaultOp = 80;
      if (oldOp !== null) {
        var parsedOp = Number(oldOp);
        if (!isNaN(parsedOp)) defaultOp = parsedOp <= 1 ? Math.round(parsedOp * 100) : parsedOp;
      }
      var opacity = pageSettings.bgOpacity !== undefined ? pageSettings.bgOpacity : (globalSettings.bgOpacity !== undefined ? globalSettings.bgOpacity : defaultOp);

      var sidebarStyle = pageSettings.sidebarStyle !== undefined ? pageSettings.sidebarStyle : (globalSettings.sidebarStyle !== undefined ? globalSettings.sidebarStyle : 'padrao');

      localStorage.setItem(ACTIVE_KEY + 'BgImage', bgImg);
      localStorage.setItem(ACTIVE_KEY + 'BgOpacity', opacity);
      localStorage.setItem('dc_sb_pref', sidebarStyle);

      if (bgImg) {
        window.globalApplyBg(bgImg);
      } else {
        window.globalApplyBg('');
      }

      document.body.classList.remove('sb-branco', 'sb-blackout', 'sb-offwhite', 'sb-bege');
      if (sidebarStyle !== 'padrao' && sidebarStyle !== 'default') {
        document.body.classList.add('sb-' + sidebarStyle);
      }

      // Apply Glass Effect automatically based on background image presence
      var hasBgImage = !!bgImg;
      document.querySelectorAll('[data-glass-label]').forEach(function (el) {
        if (hasBgImage) {
          el.classList.add('glass-card');
        } else {
          el.classList.remove('glass-card');
        }
      });
    }

    // Async background sync of profile to keep localStorage fresh
    function syncProfileFromDb(attempt) {
      attempt = attempt || 0;
      // Cadeado persistido: se uma alteração local foi salva há pouco (inclusive numa
      // página/aba anterior que recarregou antes do PATCH terminar), esperamos um
      // pouco em vez de buscar do servidor agora e arriscar sobrescrever com um
      // valor ainda desatualizado. Depois de ~4s ou 5 tentativas, seguimos em frente
      // de qualquer forma (evita ficar travado se o cadeado ficar "preso").
      var lock = null;
      try { lock = localStorage.getItem('mh_custom_sync_lock'); } catch (e) { }
      if (lock && (Date.now() - Number(lock)) < 4000 && attempt < 5) {
        setTimeout(function () { syncProfileFromDb(attempt + 1); }, 800);
        return;
      }
      if (window.api && typeof window.api.getProfile === 'function') {
        // Se ainda existe um PATCH de customização em andamento (ex: usuário acabou
        // de mexer no slider de opacidade), esperamos ele terminar antes de puxar o
        // perfil do banco. Do contrário essa leitura pode chegar com o valor antigo
        // (o PATCH ainda não tinha sido persistido) e sobrescrever a mudança local
        // que o usuário acabou de fazer — é isso que causava o "reset" ao dar F5.
        var pendingQueue = (window._mhPendingSaves > 0 && window._mhProfileSaveQueue)
          ? window._mhProfileSaveQueue
          : Promise.resolve();

        pendingQueue.then(function () {
          return window.api.getProfile();
        })
          .then(function (profile) {
            if (profile) {
              try {
                var u = JSON.parse(localStorage.getItem('minsq_auth_user') || 'null') || {};
                Object.assign(u, profile);
                localStorage.setItem('minsq_auth_user', JSON.stringify(u));
                window.loadAndApplyPageCustomization();
                if (typeof _syncCustomizerPanel === 'function') {
                  _syncCustomizerPanel();
                }
              } catch (e) { }
            }
          })
          .catch(function (err) {
            console.warn('[shared] Background profile sync failed:', err);
          });
      }
    }

    if (document.body) {
      window.loadAndApplyPageCustomization();
      syncProfileFromDb();
    } else {
      document.addEventListener('DOMContentLoaded', function () {
        window.loadAndApplyPageCustomization();
        syncProfileFromDb();
      });
    }

    // ── TIPOGRAFIA MODAL ──
    function _injectTypographyModalHTML() {
      if (document.getElementById('typographyOverlay')) return;
      var overlay = document.createElement('div');
      overlay.id = 'typographyOverlay';
      overlay.className = 'typography-overlay';

      var html = `
<style>
  .typography-overlay {
    position: fixed; inset: 0; background: transparent; z-index: 100000;
    pointer-events: none; display: flex; align-items: center; justify-content: center;
    padding: 2rem 1.5rem; transition: background 0.3s cubic-bezier(0.16, 1, 0.3, 1), backdrop-filter 0.3s cubic-bezier(0.16, 1, 0.3, 1), -webkit-backdrop-filter 0.3s cubic-bezier(0.16, 1, 0.3, 1);
  }
  .typography-overlay.open { pointer-events: auto; background: rgba(0,0,0,0.55); backdrop-filter: blur(12px); -webkit-backdrop-filter: blur(12px); }
  
  .typography-overlay .stage { position: relative; width: 100%; max-width: 1313px; height: 648px; max-height: calc(100vh - 4rem); }
  .typography-overlay .card-overlay { position: absolute; inset: 0; background: #18181b; border: 1px solid #3f3f46; border-radius: 0.75rem; z-index: 50; opacity: 0; pointer-events: none; box-shadow: 0 30px 60px -15px rgba(0,0,0,0.55); transition: opacity 0.3s cubic-bezier(0.16, 1, 0.3, 1), transform 0.3s cubic-bezier(0.16, 1, 0.3, 1); }
  .typography-overlay.open .card-overlay.visible { opacity: 1; pointer-events: auto; }
  .typography-overlay .card-overlay-close { position: absolute; top: 1.25rem; right: 1.25rem; width: 2.25rem; height: 2.25rem; border-radius: 9999px; background: rgba(255,255,255,0.10); border: none; display: flex; align-items: center; justify-content: center; cursor: pointer; opacity: 0; transform: scale(0.8); z-index: 10; transition: opacity 0.25s cubic-bezier(0.16, 1, 0.3, 1) 0.2s, transform 0.25s cubic-bezier(0.16, 1, 0.3, 1) 0.2s, background-color 0.2s ease; }
  .typography-overlay .card-overlay.expanded .card-overlay-close { opacity: 1; transform: scale(1); }
  .typography-overlay .card-overlay-close svg { width: 1.1rem; height: 1.1rem; color: #ffffff; }
  .typography-overlay .card-overlay-close:hover { background: rgba(255,255,255,0.20); }
  .typography-overlay .filter-mode-toggle { position: absolute; top: 1.25rem; right: 4.25rem; z-index: 10; display: flex; opacity: 0; transform: scale(0.8); transition: opacity 0.25s cubic-bezier(0.16, 1, 0.3, 1) 0.2s, transform 0.25s cubic-bezier(0.16, 1, 0.3, 1) 0.2s; }
  .typography-overlay .card-overlay.expanded .filter-mode-toggle { opacity: 1; transform: scale(1); }
  @media (max-width: 560px) { .typography-overlay .filter-mode-toggle { right: 3.75rem; } .typography-overlay .filter-mode-toggle .segmented-option { padding: 0.55rem 0.7rem; font-size: 0.75rem; } }
  .typography-overlay .overlay-header-mask { position: absolute; top: 0; left: 0; right: 0; height: 4.75rem; background: linear-gradient(to bottom, #18181b 60%, rgba(24, 24, 27, 0) 100%); z-index: 5; pointer-events: none; opacity: 0; transition: opacity 0.3s cubic-bezier(0.16, 1, 0.3, 1); border-radius: 0.75rem 0.75rem 0 0; }
  .typography-overlay .overlay-header-mask.visible { opacity: 1; }
  .typography-overlay .overlay-content { position: absolute; inset: 0; padding: 3.25rem 1.75rem 1.75rem 1.75rem; display: flex; flex-direction: column; opacity: 0; z-index: 1; transition: opacity 0.3s cubic-bezier(0.16, 1, 0.3, 1) 0.15s; }
  .typography-overlay .card-overlay.expanded .overlay-content { opacity: 1; }
  .typography-overlay .overlay-panel { display: flex; flex-direction: column; gap: 2rem; flex: 1; min-height: 0; }
  .typography-overlay .overlay-body-wrap { position: relative; flex: 1; min-width: 0; min-height: 0; display: flex; }
  .typography-overlay .overlay-body { flex: 1; min-width: 0; min-height: 0; display: flex; flex-direction: column; overflow-y: auto; padding-right: 0.75rem; scrollbar-width: none; -ms-overflow-style: none; }
  .typography-overlay .overlay-body::-webkit-scrollbar { display: none; width: 0; height: 0; }
  .typography-overlay .custom-scrollbar-track { position: absolute; top: 3.25rem; right: -0.5rem; bottom: 0; width: 2px; pointer-events: none; }
  .typography-overlay .custom-scrollbar-thumb { position: absolute; right: 0; width: 2px; background: #3f3f46; opacity: 0.5; transition: opacity 0.2s ease, background-color 0.2s ease; }
  .typography-overlay .overlay-body-wrap:hover .custom-scrollbar-thumb, .typography-overlay .custom-scrollbar-thumb.scrolling { opacity: 1; }
  .typography-overlay .custom-scrollbar-thumb.scrolling { background: rgba(255,255,255,0.30); }
  .typography-overlay .settings-section { display: flex; flex-direction: column; gap: 1.25rem; padding: 1.75rem 0; border-top: 1px solid #27272a; }
  .typography-overlay .section-title { margin: 0; font-size: 0.75rem; text-transform: uppercase; letter-spacing: 0.1em; color: #9ca3af; }
  .typography-overlay .field-hint { font-size: 0.75rem; color: #9ca3af; margin: -0.5rem 0 0 0; }
  .typography-overlay .segmented { display: inline-flex; border: 1px solid #27272a; border-radius: 0.625rem; overflow: hidden; width: fit-content; }
  .typography-overlay .segmented-option { background: transparent; border: none; color: #9ca3af; font-family: inherit; font-size: 0.8125rem; padding: 0.65rem 1.15rem; cursor: pointer; transition: background-color 0.2s ease, color 0.2s ease; }
  .typography-overlay .segmented-option + .segmented-option { border-left: 1px solid #27272a; }
  .typography-overlay .segmented-option:hover { color: #ffffff; }
  .typography-overlay .segmented-option.active { background: rgba(255,255,255,0.10); color: #ffffff; }
  .typography-overlay .filters-header { display: flex; align-items: center; justify-content: space-between; gap: 1rem; flex-wrap: wrap; }
  .typography-overlay .filter-chips { display: flex; flex-wrap: wrap; gap: 0.5rem 1.75rem; margin-top: 0.25rem; border-bottom: 1px solid #27272a; padding-bottom: 0.9rem; }
  .typography-overlay .filter-chip { background: none; border: none; padding: 0 0 0.9rem 0; margin-bottom: -0.9rem; font-family: inherit; font-size: 0.8125rem; color: #9ca3af; position: relative; cursor: pointer; white-space: nowrap; transition: color 0.2s ease, opacity 0.2s ease; }
  .typography-overlay .filter-chip::after { content: ''; position: absolute; left: 0; right: 0; bottom: -1px; height: 2px; background: #ffffff; transform: scaleX(0); transform-origin: left; transition: transform 0.25s cubic-bezier(0.16, 1, 0.3, 1); }
  .typography-overlay .filter-chip:hover { color: #ffffff; }
  .typography-overlay .filter-chip.selected { color: #ffffff; }
  .typography-overlay .filter-chip.selected::after { transform: scaleX(1); }
  .typography-overlay .filter-chip.disabled { color: #9ca3af; opacity: 0.4; cursor: not-allowed; pointer-events: none; }
  .typography-overlay .font-grid { display: grid; grid-template-columns: repeat(3, 1fr); gap: 0.5rem; margin-top: 0.25rem; }
  @media (max-width: 640px) { .typography-overlay .font-grid { grid-template-columns: repeat(2, 1fr); } }
  @media (max-width: 400px) { .typography-overlay .font-grid { grid-template-columns: 1fr; } }
  .typography-overlay .font-card { display: block; width: 100%; background: rgba(255,255,255,0.05); border: 1px solid #27272a; border-radius: 0.5rem; padding: 0.55rem 0.6rem; text-align: center; font-family: inherit; cursor: pointer; transition: border-color 0.2s ease, background-color 0.2s ease; }
  .typography-overlay .font-card:hover { border-color: #3f3f46; background: #27272a; }
  .typography-overlay .font-card.selected { border-color: rgba(255,255,255,0.30); background: rgba(255,255,255,0.10); }
  .typography-overlay .font-card-name { color: #ffffff; font-size: 0.85rem; line-height: 1.2; margin: 0; overflow: hidden; text-overflow: ellipsis; white-space: nowrap; }
  .typography-overlay .font-card-desc { color: #9ca3af; font-size: 0.65rem; font-family: "Exo 2", sans-serif; margin: 0.2rem 0 0 0; overflow: hidden; text-overflow: ellipsis; white-space: nowrap; }
  .typography-overlay .font-test-input { width: 100%; min-height: 110px; background: rgba(255,255,255,0.05); border: 1px solid #27272a; border-radius: 0.625rem; padding: 0.9rem 1rem; color: #ffffff; font-size: 1.5rem; line-height: 1.3; outline: none; resize: vertical; transition: border-color 0.2s ease, background-color 0.2s ease; }
  .typography-overlay .font-test-input::placeholder { color: #9ca3af; font-family: "Exo 2", sans-serif; font-size: 0.9rem; }
  .typography-overlay .font-test-input:hover { border-color: #3f3f46; }
  .typography-overlay .font-test-input:focus { border-color: #3f3f46; background: rgba(255,255,255,0.10); }
  .typography-overlay .reopen-btn { position: absolute; inset: 0; display: none; align-items: center; justify-content: center; }
  .typography-overlay .reopen-btn.visible { display: flex; }
  .typography-overlay .reopen-btn button { background: rgba(255,255,255,0.10); border: 1px solid #3f3f46; color: #ffffff; font-family: inherit; font-size: 0.875rem; padding: 0.7rem 1.25rem; border-radius: 0.625rem; cursor: pointer; transition: background-color 0.2s ease; }
  .typography-overlay .reopen-btn button:hover { background: rgba(255,255,255,0.20); }
</style>
<div class="stage">
  <div class="card-overlay visible expanded" id="typography-card-overlay">
    <button class="card-overlay-close" type="button" id="typography-card-overlay-close" aria-label="Fechar">
      <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><line x1="18" y1="6" x2="6" y2="18"/><line x1="6" y1="6" x2="18" y2="18"/></svg>
    </button>
    <div class="filter-mode-toggle" id="typography-filter-mode-toggle">
      <div class="segmented" data-filter-mode>
        <button class="segmented-option active" type="button" data-mode="individual">Individual</button>
        <button class="segmented-option" type="button" data-mode="global">Global</button>
      </div>
    </div>
    <div class="overlay-header-mask"></div>
    <div class="overlay-content">
      <div class="overlay-panel overlay-panel-single" data-panel="tipografia">
        <div class="overlay-body-wrap">
          <div class="overlay-body">
            <div class="settings-section" style="border-top:none; padding-top:0;">
              <div class="filters-header">
                <p class="section-title" style="margin:0;">Filtros</p>
              </div>
              <p class="field-hint" style="margin-top:-0.25rem;">No modo Global, o filtro Geral se aplica a tudo. No modo Individual, escolha um filtro específico para cada área.</p>
              <div class="filter-chips" id="typography-filter-chips">
                <button class="filter-chip disabled" type="button" data-filter="geral">Geral</button>
                <button class="filter-chip selected" type="button" data-filter="dashboard">Dashboard</button>
                <button class="filter-chip" type="button" data-filter="today">Hoje</button>
                <button class="filter-chip" type="button" data-filter="goals">Metas</button>

                <button class="filter-chip" type="button" data-filter="health">Saúde</button>
                <button class="filter-chip" type="button" data-filter="study">Estudo</button>
                <button class="filter-chip" type="button" data-filter="foco">Foco</button>
              </div>
            </div>
            <div class="settings-section">
              <p class="section-title">Teste</p>
              <p class="field-hint" style="margin-top:-0.25rem;">Digite algo abaixo para ver como fica com a fonte selecionada.</p>
              <textarea class="font-test-input" id="typography-font-test-input" placeholder="Digite aqui para testar a fonte selecionada..." maxlength="100" style="font-family:'Exo 2', sans-serif;"></textarea>
            </div>
            <div class="settings-section">
              <p class="section-title">Fontes</p>
              <div class="font-grid" id="typography-font-grid">
                <button class="font-card selected" type="button" data-font-family="'Exo 2', sans-serif">
                  <p class="font-card-name" style="font-family:'Exo 2', sans-serif;">Exo 2</p><p class="font-card-desc">Padrão minsq</p>
                </button>
                <button class="font-card" type="button" data-font-family="'Fraunces', serif">
                  <p class="font-card-name" style="font-family:'Fraunces', serif;">Fraunces</p><p class="font-card-desc">Serifada orgânica</p>
                </button>
                <button class="font-card" type="button" data-font-family="'Cinzel', serif">
                  <p class="font-card-name" style="font-family:'Cinzel', serif;">Cinzel</p><p class="font-card-desc">Elegância clássica</p>
                </button>
                <button class="font-card" type="button" data-font-family="'Pixelify Sans', sans-serif">
                  <p class="font-card-name" style="font-family:'Pixelify Sans', sans-serif;">Pixelify Sans</p><p class="font-card-desc">Quadrada gamer</p>
                </button>
                <button class="font-card" type="button" data-font-family="'Permanent Marker', cursive">
                  <p class="font-card-name" style="font-family:'Permanent Marker', cursive;">Permanent Marker</p><p class="font-card-desc">Escrita urbana</p>
                </button>
                <button class="font-card" type="button" data-font-family="'Fira Code', monospace">
                  <p class="font-card-name" style="font-family:'Fira Code', monospace;">Fira Code</p><p class="font-card-desc">Código mono</p>
                </button>
                <button class="font-card" type="button" data-font-family="'Rajdhani', sans-serif">
                  <p class="font-card-name" style="font-family:'Rajdhani', sans-serif;">Rajdhani</p><p class="font-card-desc">Técnico quadrado</p>
                </button>
                <button class="font-card" type="button" data-font-family="'Chakra Petch', sans-serif">
                  <p class="font-card-name" style="font-family:'Chakra Petch', sans-serif;">Chakra Petch</p><p class="font-card-desc">Cyberpunk</p>
                </button>
                <button class="font-card" type="button" data-font-family="'Inter', sans-serif">
                  <p class="font-card-name" style="font-family:'Inter', sans-serif;">Inter</p><p class="font-card-desc">Minimalista</p>
                </button>
                <button class="font-card" type="button" data-font-family="'Space Grotesk', sans-serif">
                  <p class="font-card-name" style="font-family:'Space Grotesk', sans-serif;">Space Grotesk</p><p class="font-card-desc">Geometria técnica</p>
                </button>
                <button class="font-card" type="button" data-font-family="'Lora', serif">
                  <p class="font-card-name" style="font-family:'Lora', serif;">Lora</p><p class="font-card-desc">Serifada editorial</p>
                </button>
                <button class="font-card" type="button" data-font-family="'Playfair Display', serif">
                  <p class="font-card-name" style="font-family:'Playfair Display', serif;">Playfair Display</p><p class="font-card-desc">Editorial clássico</p>
                </button>
                <button class="font-card" type="button" data-font-family="'Syne', sans-serif">
                  <p class="font-card-name" style="font-family:'Syne', sans-serif;">Syne</p><p class="font-card-desc">Expressiva artística</p>
                </button>
                <button class="font-card" type="button" data-font-family="'Caveat', cursive">
                  <p class="font-card-name" style="font-family:'Caveat', cursive;">Caveat</p><p class="font-card-desc">Caligrafia humana</p>
                </button>
                <button class="font-card" type="button" data-font-family="'Syncopate', sans-serif">
                  <p class="font-card-name" style="font-family:'Syncopate', sans-serif;">Syncopate</p><p class="font-card-desc">Futurista larga</p>
                </button>
                <button class="font-card" type="button" data-font-family="'Montserrat', sans-serif">
                  <p class="font-card-name" style="font-family:'Montserrat', sans-serif;">Montserrat</p><p class="font-card-desc">Moderna geométrica</p>
                </button>
                <button class="font-card" type="button" data-font-family="'Press Start 2P', monospace">
                  <p class="font-card-name" style="font-family:'Press Start 2P', monospace; font-size:0.65rem;">Press Start 2P</p><p class="font-card-desc">Retro 8-bit</p>
                </button>
                <button class="font-card" type="button" data-font-family="'Bebas Neue', sans-serif">
                  <p class="font-card-name" style="font-family:'Bebas Neue', sans-serif;">Bebas Neue</p><p class="font-card-desc">Impacto condensado</p>
                </button>
                <button class="font-card" type="button" data-font-family="'DM Sans', sans-serif">
                  <p class="font-card-name" style="font-family:'DM Sans', sans-serif;">DM Sans</p><p class="font-card-desc">Clássica e legível</p>
                </button>
                <button class="font-card" type="button" data-font-family="'Orbitron', sans-serif">
                  <p class="font-card-name" style="font-family:'Orbitron', sans-serif;">Orbitron</p><p class="font-card-desc">Estilo sci-fi</p>
                </button>
              </div>
            </div>
          </div>
          <div class="custom-scrollbar-track"><div class="custom-scrollbar-thumb"></div></div>
        </div>
      </div>
    </div>
  </div>
  <div class="reopen-btn" id="typography-reopen-btn">
    <button type="button" id="typography-reopen-btn-inner">Reabrir Tipografia</button>
  </div>
</div>
`;
      overlay.innerHTML = html;
      document.body.appendChild(overlay);

      var cardOverlay = document.getElementById('typography-card-overlay');
      var closeBtn = document.getElementById('typography-card-overlay-close');
      var reopenWrap = document.getElementById('typography-reopen-btn');
      var reopenBtn = document.getElementById('typography-reopen-btn-inner');

      closeBtn.addEventListener('click', function () {
        if (typeof window.closeTypographyModal === 'function') {
          window.closeTypographyModal();
        } else {
          overlay.classList.remove('open');
        }
      });

      reopenBtn.addEventListener('click', function () {
        reopenWrap.classList.remove('visible');
        cardOverlay.classList.add('visible');
        requestAnimationFrame(function () { cardOverlay.classList.add('expanded'); });
      });

      var filterModeSeg = overlay.querySelector('[data-filter-mode]');
      var filterChipGroup = document.getElementById('typography-filter-chips');
      var fontGrid = document.getElementById('typography-font-grid');
      var fontTestInput = document.getElementById('typography-font-test-input');

      overlay.querySelectorAll('.segmented').forEach(function (seg) {
        seg.addEventListener('click', function (e) {
          var opt = e.target.closest('.segmented-option');
          if (!opt) return;
          seg.querySelectorAll('.segmented-option').forEach(function (o) { o.classList.remove('active'); });
          opt.classList.add('active');
        });
      });

      var currentMode = 'individual';
      var currentFilter = ACTIVE_KEY || 'dashboard';

      function applyFilterMode(mode) {
        currentMode = mode;
        var geralChip = filterChipGroup.querySelector('[data-filter="geral"]');
        var otherChips = Array.from(filterChipGroup.querySelectorAll('.filter-chip')).filter(function (c) { return c !== geralChip; });
        if (!geralChip) return;

        if (mode === 'global') {
          geralChip.classList.remove('disabled');
          otherChips.forEach(function (c) { c.classList.add('disabled'); c.classList.remove('selected'); });
          geralChip.classList.add('selected');
          currentFilter = 'geral';
        } else {
          geralChip.classList.add('disabled');
          geralChip.classList.remove('selected');
          otherChips.forEach(function (c) { c.classList.remove('disabled', 'selected'); });
          var targetChip = filterChipGroup.querySelector('[data-filter="' + (ACTIVE_KEY || 'dashboard') + '"]') || otherChips[0];
          targetChip.classList.add('selected');
          currentFilter = targetChip.getAttribute('data-filter');
        }
        _syncFontSelectionUI();
      }

      if (filterModeSeg && filterChipGroup) {
        filterModeSeg.addEventListener('click', function (e) {
          var opt = e.target.closest('.segmented-option');
          if (!opt) return;
          applyFilterMode(opt.dataset.mode);
        });

        filterChipGroup.addEventListener('click', function (e) {
          var chip = e.target.closest('.filter-chip');
          if (!chip || chip.classList.contains('disabled')) return;
          filterChipGroup.querySelectorAll('.filter-chip').forEach(function (c) { c.classList.remove('selected'); });
          chip.classList.add('selected');
          currentFilter = chip.getAttribute('data-filter');
          _syncFontSelectionUI();
        });

        applyFilterMode('individual');
      }

      function _syncFontSelectionUI() {
        var user = null;
        try { user = JSON.parse(localStorage.getItem('minsq_auth_user')) || {}; } catch (e) { }
        var cust = {};
        if (user && user.customization_json) {
          try { cust = typeof user.customization_json === 'string' ? JSON.parse(user.customization_json) : user.customization_json; } catch (e) { }
        }

        var legacyFontMap = {
          'dmsans': "'Exo 2', sans-serif",
          'orbitron': "'Orbitron', sans-serif",
          'cinzel': "'Cinzel', serif",
          'bebas': "'Bebas Neue', sans-serif",
          'marker': "'Permanent Marker', cursive",
          'playfair': "'Playfair Display', serif",
          'rajdhani': "'Rajdhani', sans-serif",
          'chakra': "'Chakra Petch', sans-serif",
          'inter': "'Inter', sans-serif",
          'spacegrotesk': "'Space Grotesk', sans-serif",
          'lora': "'Lora', serif",
          'firacode': "'Fira Code', monospace",
          'syne': "'Syne', sans-serif",
          'caveat': "'Caveat', cursive",
          'syncopate': "'Syncopate', sans-serif",
          'montserrat': "'Montserrat', sans-serif",
          'pressstart': "'Press Start 2P', monospace",
          'pixelify': "'Pixelify Sans', sans-serif",
          'exo2': "'DM Sans', sans-serif",
          'fraunces': "'Fraunces', serif"
        };

        var savedFont = "'Exo 2', sans-serif";
        if (currentMode === 'global') {
          if (cust.global && cust.global.typography) {
            savedFont = cust.global.typography;
          } else if (cust.geral && cust.geral.font) {
            savedFont = legacyFontMap[cust.geral.font] || savedFont;
          }
        } else if (currentMode === 'individual') {
          if (cust.pages && cust.pages[currentFilter] && cust.pages[currentFilter].typography) {
            savedFont = cust.pages[currentFilter].typography;
          } else {
            var legacyFilterMap = {
              'today': 'hoje',
              'goals': 'metas',

              'health': 'saude',
              'study': 'estudos',
              'notes': 'notas',
              'analytics': 'analitics'
            };
            var legacyFilter = legacyFilterMap[currentFilter] || currentFilter;

            if (cust[legacyFilter] && cust[legacyFilter].font) {
              savedFont = legacyFontMap[cust[legacyFilter].font] || savedFont;
            } else if (cust[currentFilter] && cust[currentFilter].font) {
              savedFont = legacyFontMap[cust[currentFilter].font] || savedFont;
            } else if (cust.global && cust.global.typography) {
              savedFont = cust.global.typography;
            } else if (cust.geral && cust.geral.font) {
              savedFont = legacyFontMap[cust.geral.font] || savedFont;
            }
          }
        }

        fontTestInput.style.fontFamily = savedFont;

        var recommendedMap = {
          'dashboard': "'Exo 2', sans-serif",
          'today': "'Fraunces', serif",
          'goals': "'Cinzel', serif",

          'health': "'Fraunces', serif",
          'study': "'Cinzel', serif",
          'foco': "'Exo 2', sans-serif"
        };
        var currentRec = currentMode === 'individual' ? recommendedMap[currentFilter] : null;

        fontGrid.querySelectorAll('.font-card').forEach(function (c) {
          if (c.dataset.fontFamily === savedFont) {
            c.classList.add('selected');
          } else {
            c.classList.remove('selected');
          }

          var existingBadge = c.querySelector('.rec-badge');
          if (currentRec && c.dataset.fontFamily === currentRec) {
            if (!existingBadge) {
              existingBadge = document.createElement('div');
              existingBadge.className = 'rec-badge';
              existingBadge.innerText = 'Recomendado';
              existingBadge.style.fontSize = '8px';
              existingBadge.style.background = 'rgba(255,255,255,0.08)';
              existingBadge.style.color = 'rgba(255,255,255,0.6)';
              existingBadge.style.padding = '3px 6px';
              existingBadge.style.borderRadius = '4px';
              existingBadge.style.marginTop = '8px';
              existingBadge.style.fontWeight = '600';
              existingBadge.style.letterSpacing = '0.5px';
              existingBadge.style.textTransform = 'uppercase';
              existingBadge.style.width = 'fit-content';
              c.appendChild(existingBadge);
            }
            existingBadge.style.display = 'inline-block';
          } else {
            if (existingBadge) {
              existingBadge.style.display = 'none';
            }
          }
        });
      }

      if (fontGrid && fontTestInput) {
        fontGrid.addEventListener('click', function (e) {
          var card = e.target.closest('.font-card');
          if (!card) return;
          fontGrid.querySelectorAll('.font-card').forEach(function (c) { c.classList.remove('selected'); });
          card.classList.add('selected');
          fontTestInput.style.fontFamily = card.dataset.fontFamily;

          _saveTypographySetting(currentMode, currentFilter, card.dataset.fontFamily);
          if (currentMode === 'global' || currentFilter === ACTIVE_KEY) {
            document.body.style.setProperty('--profile-font', card.dataset.fontFamily);
            document.body.style.setProperty('--fm', card.dataset.fontFamily);
            document.body.style.setProperty('font-family', card.dataset.fontFamily, 'important');
          }
        });
      }

      function _saveTypographySetting(mode, filter, font) {
        var user = null;
        try { user = JSON.parse(localStorage.getItem('minsq_auth_user')) || {}; } catch (e) { }
        if (!user || !window.api || typeof window.api.updateProfile !== 'function') return;

        var cust = {};
        try { cust = typeof user.customization_json === 'string' ? JSON.parse(user.customization_json) : (user.customization_json || {}); } catch (e) { }

        var blockedKeys = ['notes', 'notas', 'analytics', 'analitics'];
        if (cust.pages) {
          blockedKeys.forEach(function (k) { delete cust.pages[k]; });
        }
        blockedKeys.forEach(function (k) { delete cust[k]; });

        if (mode === 'global') {
          if (!cust.global) cust.global = {};
          cust.global.typography = font;

          if (cust.pages) {
            Object.keys(cust.pages).forEach(function (k) { delete cust.pages[k].typography; });
          }
          var legacyFilterMap = { 'today': 'hoje', 'goals': 'metas', 'health': 'saude', 'study': 'estudos', 'notes': 'notas', 'analytics': 'analitics' };
          Object.keys(legacyFilterMap).forEach(function (k) {
            var lK = legacyFilterMap[k];
            if (cust[lK]) delete cust[lK].font;
            if (cust[k]) delete cust[k].font;
          });
        } else {
          if (!cust.pages) cust.pages = {};
          if (!cust.pages[filter]) cust.pages[filter] = {};
          cust.pages[filter].typography = font;
        }

        user.customization_json = JSON.stringify(cust);
        localStorage.setItem('minsq_auth_user', JSON.stringify(user));
        if (typeof window._mhQueueProfileSave === 'function') {
          window._mhQueueProfileSave({ customization_json: cust });
        }
      }

      function initCustomScrollbar(scrollEl, thumb) {
        if (!scrollEl || !thumb) return;
        var hideTimeout;
        var TRACK_TOP_OFFSET = 52;

        function updateThumb() {
          var scrollTop = scrollEl.scrollTop;
          var scrollHeight = scrollEl.scrollHeight;
          var clientHeight = scrollEl.clientHeight;
          if (scrollHeight <= clientHeight + 1) {
            thumb.style.opacity = '0';
            thumb.style.height = '0';
            return;
          }
          thumb.style.opacity = '';
          var available = Math.max(clientHeight - TRACK_TOP_OFFSET, 0);
          var thumbHeight = Math.max((clientHeight / scrollHeight) * available, 24);
          var maxTop = available - thumbHeight;
          var thumbTop = (scrollTop / (scrollHeight - clientHeight)) * maxTop;
          thumb.style.height = thumbHeight + 'px';
          thumb.style.top = thumbTop + 'px';
        }

        function flashThumb() {
          thumb.classList.add('scrolling');
          clearTimeout(hideTimeout);
          hideTimeout = setTimeout(function () { thumb.classList.remove('scrolling'); }, 600);
        }

        scrollEl.addEventListener('scroll', function () {
          updateThumb();
          flashThumb();
        });
        scrollEl.addEventListener('wheel', function (e) { e.preventDefault(); scrollEl.scrollTop += e.deltaY * 0.5; }, { passive: false });

        if (typeof ResizeObserver !== 'undefined') {
          var ro = new ResizeObserver(updateThumb);
          ro.observe(scrollEl);
          Array.from(scrollEl.children).forEach(function (child) { ro.observe(child); });
        }
        updateThumb();
      }

      var wrap = overlay.querySelector('.overlay-body-wrap');
      if (wrap) {
        initCustomScrollbar(wrap.querySelector('.overlay-body'), wrap.querySelector('.custom-scrollbar-thumb'));
      }

      var overlayHeaderMask = overlay.querySelector('.overlay-header-mask');
      if (overlayHeaderMask) {
        overlay.querySelectorAll('.overlay-body').forEach(function (scrollEl) {
          var syncMask = function () {
            overlayHeaderMask.classList.toggle('visible', scrollEl.scrollTop > 8);
          };
          scrollEl.addEventListener('scroll', syncMask);
          syncMask();
        });
      }
    }

    window.openTypographyModal = function () {
      var oldOverlay = document.getElementById('typographyOverlay');
      if (oldOverlay) {
        var hasLegacyPanel = oldOverlay.querySelector('#typography-card-overlay');
        if (hasLegacyPanel) oldOverlay.parentNode.removeChild(oldOverlay);
      }
      var overlay = document.getElementById('typographyOverlay');
      if (!overlay) {
        _injectTypographyModalHTML();
        overlay = document.getElementById('typographyOverlay');
      }
      if (!overlay) return;
      overlay.classList.add('open');

      var cardOverlay = document.getElementById('typography-card-overlay');
      if (cardOverlay) {
        cardOverlay.classList.add('visible');
        requestAnimationFrame(function () { cardOverlay.classList.add('expanded'); });
      }
      var reopenWrap = document.getElementById('typography-reopen-btn');
      if (reopenWrap) reopenWrap.classList.remove('visible');
    };

    window.closeTypographyModal = function () {
      var overlay = document.getElementById('typographyOverlay');
      if (overlay) overlay.classList.remove('open');
    };

    function _applySavedTypography() {
      var user = null;
      try { user = JSON.parse(localStorage.getItem('minsq_auth_user')) || {}; } catch (e) { }
      if (!user) return;
      var cust = {};
      try { cust = typeof user.customization_json === 'string' ? JSON.parse(user.customization_json) : (user.customization_json || {}); } catch (e) { }

      var globalFont = cust.global && cust.global.typography ? cust.global.typography : null;
      var pageFont = (cust.pages && ACTIVE_KEY && cust.pages[ACTIVE_KEY] && cust.pages[ACTIVE_KEY].typography)
        ? cust.pages[ACTIVE_KEY].typography : null;

      if (pageFont) {
        document.body.style.setProperty('--profile-font', pageFont);
        document.body.style.setProperty('--fm', pageFont);
        document.body.style.setProperty('font-family', pageFont, 'important');
      } else if (globalFont) {
        document.body.style.setProperty('--profile-font', globalFont);
        document.body.style.setProperty('--fm', globalFont);
        document.body.style.setProperty('font-family', globalFont, 'important');
      }
    }

    if (document.readyState === 'loading') {
      document.addEventListener('DOMContentLoaded', _applySavedTypography);
    } else {
      _applySavedTypography();
    }
  })();

})();

/* ==========================================================================
   (bloqueio de DevTools/console removido — atrapalhava debug e não protegia nada de verdade)
   ========================================================================== */

document.addEventListener("DOMContentLoaded", function () {
  if (window.location.pathname.includes('/pages/')) {
    const betaNotice = document.createElement("div");
    betaNotice.innerText = "Minsq Beta · Version 0.4.1 - Build ID: 7F3A9C21D84E6B50A17C4D9F82B6E031";
    betaNotice.style.position = "fixed";
    betaNotice.style.bottom = "10px";
    betaNotice.style.right = "10px";
    betaNotice.style.color = "#808080";
    betaNotice.style.fontFamily = "'Exo 2', sans-serif";
    betaNotice.style.fontSize = "12px";
    betaNotice.style.fontWeight = "500";
    betaNotice.style.letterSpacing = "0.5px";
    betaNotice.style.zIndex = "999999";
    betaNotice.style.pointerEvents = "none";
    document.body.appendChild(betaNotice);
  }
});
/* ── SPOTLIGHT INTERATIVO ── */
var _spotlightSteps = [];
var _spotlightIdx = 0;

window.mhStartSpotlight = function () {
  var allSteps = Array.prototype.slice.call(document.querySelectorAll('[data-mh-help]'));
  _spotlightSteps = allSteps.filter(function (el) {
    return el.offsetWidth > 0 || el.offsetHeight > 0 || el.getClientRects().length > 0;
  });

  if (_spotlightSteps.length === 0) {
    if (typeof window.showMhToast === 'function') {
      window.showMhToast('Nenhuma dica interativa disponível nesta página.', 'info');
    } else {
      alert('Nenhuma dica interativa disponível nesta página.');
    }
    return;
  }

  _spotlightIdx = 0;
  _injectSpotlightHTML();

  // Block scrolling
  document.body.style.overflow = 'hidden';
  document.querySelectorAll('.page').forEach(function (p) { p.style.overflow = 'hidden'; });

  _renderSpotlightStep();
};

window.mhStopSpotlight = function () {
  var ov = document.getElementById('mh-spotlight-overlay');
  if (ov) {
    ov.classList.remove('active');
    var pop = document.getElementById('mh-spotlight-popover');
    if (pop) pop.classList.remove('active');

    // Restore scrolling
    document.body.style.overflow = '';
    document.querySelectorAll('.page').forEach(function (p) { p.style.overflow = ''; });

    setTimeout(function () {
      if (ov.parentNode) ov.parentNode.removeChild(ov);
    }, 400);
  }
};

function _renderSpotlightStep() {
  var target = _spotlightSteps[_spotlightIdx];
  if (!target) return window.mhStopSpotlight();

  var ov = document.getElementById('mh-spotlight-overlay');
  var hole = document.getElementById('mh-spotlight-hole');
  var pop = document.getElementById('mh-spotlight-popover');
  var txt = document.getElementById('mh-spotlight-text');
  var stepInd = document.getElementById('mh-spotlight-step');
  var btnNext = document.getElementById('mh-spotlight-next');

  ov.classList.add('active');
  pop.classList.remove('active');

  var framesCount = 0;

  var radius = window.getComputedStyle(target).borderRadius;
  if (!radius || radius === '0px') radius = '8px';
  hole.style.borderRadius = radius;

  // Popover texto
  txt.textContent = target.getAttribute('data-mh-help');
  stepInd.textContent = (_spotlightIdx + 1) + ' / ' + _spotlightSteps.length;

  if (_spotlightIdx === _spotlightSteps.length - 1) {
    btnNext.textContent = 'Concluir';
  } else {
    btnNext.textContent = 'Próximo';
  }

  function _trackPos() {
    var rect = target.getBoundingClientRect();
    var pad = 8;
    hole.style.top = (rect.top - pad) + 'px';
    hole.style.left = (rect.left - pad) + 'px';
    hole.style.width = (rect.width + pad * 2) + 'px';
    hole.style.height = (rect.height + pad * 2) + 'px';

    var popRect = pop.getBoundingClientRect();
    var pTop = rect.bottom + pad + 12;
    var pLeft = rect.left + (rect.width / 2) - (popRect.width / 2);
    if (pLeft < 10) pLeft = 10;
    if (pLeft + popRect.width > window.innerWidth - 10) pLeft = window.innerWidth - popRect.width - 10;
    if (pTop + popRect.height > window.innerHeight - 10) {
      pTop = rect.top - pad - 12 - popRect.height;
    }
    pop.style.top = pTop + 'px';
    pop.style.left = pLeft + 'px';

    framesCount++;
    if (framesCount < 60) {
      window._spotlightRaf = requestAnimationFrame(_trackPos);
    }
  }

  if (window._spotlightRaf) cancelAnimationFrame(window._spotlightRaf);
  _trackPos();

  // Scroll suave se o alvo estiver fora da visao
  var initialRect = target.getBoundingClientRect();
  if (initialRect.top < 0 || initialRect.bottom > window.innerHeight) {
    target.scrollIntoView({ behavior: 'smooth', block: 'center' });
  }

  setTimeout(function () {
    pop.classList.add('active');
  }, 50);
}

function _injectSpotlightHTML() {
  if (document.getElementById('mh-spotlight-overlay')) return;

  var st = document.createElement('style');
  st.textContent = `
        #mh-spotlight-overlay {
          position: fixed; top: 0; left: 0; right: 0; bottom: 0;
          z-index: 99998; pointer-events: auto;
          transition: opacity 0.3s; opacity: 0;
        }
        #mh-spotlight-overlay.active { opacity: 1; }
        #mh-spotlight-hole {
          position: absolute;
          box-shadow: 0 0 0 9999px rgba(0, 0, 0, 0.75);
          transition: all 0.4s cubic-bezier(0.25, 1, 0.5, 1);
          pointer-events: none;
        }
        #mh-spotlight-popover {
          position: absolute; z-index: 99999;
          background: ${window.location.pathname.includes('notas.html') ? 'rgba(45, 45, 45, 0.9)' : 'rgba(20, 20, 20, 0.65)'};
          backdrop-filter: blur(12px); -webkit-backdrop-filter: blur(12px);
          border: 1px solid ${window.location.pathname.includes('notas.html') ? 'rgba(255, 255, 255, 0.3)' : 'rgba(255, 255, 255, 0.1)'};
          border-radius: 12px; padding: 16px 20px;
          color: #fff; font-family: var(--fm, 'Exo 2', sans-serif);
          min-width: 260px; max-width: 320px;
          box-shadow: 0 8px 32px rgba(0,0,0,0.4);
          opacity: 0; transform: translateY(10px);
          transition: all 0.4s cubic-bezier(0.25, 1, 0.5, 1);
        }
        #mh-spotlight-popover.active { opacity: 1; transform: translateY(0); }
        .mh-spotlight-text { font-size: 13.5px; line-height: 1.5; margin-bottom: 16px; color: rgba(255, 255, 255, 0.9); }
        .mh-spotlight-footer { display: flex; justify-content: space-between; align-items: center; }
        .mh-spotlight-step { font-size: 11px; color: rgba(255, 255, 255, 0.4); font-variant-numeric: tabular-nums; }
        .mh-spotlight-btn {
          background: rgba(255, 255, 255, 0.1); border: 1px solid rgba(255, 255, 255, 0.05);
          color: #fff; padding: 6px 14px; border-radius: 6px; font-size: 12px; font-weight: 600; cursor: pointer; transition: background 0.2s;
        }
        .mh-spotlight-btn:hover { background: rgba(255, 255, 255, 0.2); }
      `;
  document.head.appendChild(st);

  var ov = document.createElement('div');
  ov.id = 'mh-spotlight-overlay';
  ov.innerHTML = `
        <div id="mh-spotlight-hole"></div>
        <div id="mh-spotlight-popover">
          <div class="mh-spotlight-text" id="mh-spotlight-text"></div>
          <div class="mh-spotlight-footer">
            <span class="mh-spotlight-step" id="mh-spotlight-step">1 / 3</span>
            <button class="mh-spotlight-btn" id="mh-spotlight-next">Próximo</button>
          </div>
        </div>
      `;
  document.body.appendChild(ov);

  // Clicar fora encerra
  ov.addEventListener('click', function (e) {
    if (e.target === ov || e.target.id === 'mh-spotlight-hole') {
      window.mhStopSpotlight();
    }
  });

  document.getElementById('mh-spotlight-next').addEventListener('click', function () {
    _spotlightIdx++;
    if (_spotlightIdx >= _spotlightSteps.length) {
      window.mhStopSpotlight();
    } else {
      _renderSpotlightStep();
    }
  });
}



/* ══════════════════════════════════════════════════════════════
   MÁSCARA DE HORA (HH:MM) — impede minutos > 59 e horas > 23
   Uso: <input type="text" data-time-mask inputmode="numeric" maxlength="5" placeholder="HH:MM">
   · .value sempre devolve "HH:MM" válido ou "" (compatível com input[type=time])
   · Delegação de eventos: funciona em modais criados dinamicamente.
   · window.horaValida(v) / window.horaCompleta(v) para validar antes de enviar.
══════════════════════════════════════════════════════════════ */
(function () {
  'use strict';
  if (window.__timeMaskInit) return;
  window.__timeMaskInit = true;

  var HORA_RE = /^([01]\d|2[0-3]):([0-5]\d)$/;
  window.horaValida = function (v) { return typeof v === 'string' && HORA_RE.test(v); };

  // Converte qualquer texto em dígitos válidos posição a posição (nunca gera hora/minuto inválido)
  function parseDigits(raw) {
    var out = [];
    var ds = String(raw || '').replace(/\D/g, '');
    for (var i = 0; i < ds.length && out.length < 4; i++) {
      var c = ds.charAt(i), n = out.length;
      if (n === 0) {
        if (c > '2') { out.push('0', c); } else { out.push(c); }       // "7" -> "07"
      } else if (n === 1) {
        if (out[0] === '2' && c > '3') continue;                         // "24".."29" ignorados
        out.push(c);
      } else if (n === 2) {
        if (c > '5') { out.push('0', c); } else { out.push(c); }       // minuto "7" -> "07"
      } else {
        out.push(c);
      }
    }
    return out.slice(0, 4);
  }

  function format(d) {
    return d.length <= 2 ? d.join('') : d.slice(0, 2).join('') + ':' + d.slice(2).join('');
  }

  // Completa entrada parcial: "07" -> "07:00", "07:3" -> "07:30", "0" -> "00:00"
  window.horaCompleta = function (raw) {
    var d = parseDigits(raw);
    if (!d.length) return '';
    while (d.length < 4) d.push('0');
    return format(d);
  };

  function isMask(el) { return el && el.tagName === 'INPUT' && el.hasAttribute('data-time-mask'); }

  document.addEventListener('input', function (e) {
    var el = e.target;
    if (!isMask(el)) return;
    if (e.inputType && e.inputType.indexOf('delete') === 0) {
      // Apagando: só reformata (sem forçar ":" ao voltar para 2 dígitos)
      el.value = format(parseDigits(el.value));
      return;
    }
    el.value = format(parseDigits(el.value));
  }, true);

  document.addEventListener('focusout', function (e) {
    var el = e.target;
    if (!isMask(el)) return;
    el.value = window.horaCompleta(el.value);
  }, true);

  // Setas ↑/↓ ajustam de 15 em 15 min (como o step=900 do campo nativo)
  document.addEventListener('keydown', function (e) {
    var el = e.target;
    if (!isMask(el)) return;
    if (e.key !== 'ArrowUp' && e.key !== 'ArrowDown') return;
    e.preventDefault();
    var cur = window.horaCompleta(el.value);
    var total = 0;
    if (cur) { total = parseInt(cur.slice(0, 2), 10) * 60 + parseInt(cur.slice(3), 10); }
    total = (total + (e.key === 'ArrowUp' ? 15 : -15) + 1440) % 1440;
    el.value = ('0' + Math.floor(total / 60)).slice(-2) + ':' + ('0' + (total % 60)).slice(-2);
  }, true);
})();
