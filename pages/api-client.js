/* ==========================================================================
   API CLIENT — Minsq
   Centraliza todas as requisições AJAX para o servidor local (Porta 3001)
   ========================================================================== */

(function () {
  'use strict';

  const BASE_URL = '/api';

  /* Determina se está rodando dentro do iframe do shell original (ignora VSCode preview) */
  let isInIframe = false;
  try {
    isInIframe = window !== window.top && window.top.__mohiAuth !== undefined;
  } catch (e) {
    isInIframe = false;
  }

  let currentToken = null;
  let isRefreshing = false;
  let refreshSubscribers = [];

  function onRefreshed(token) {
    refreshSubscribers.forEach(cb => cb(token));
    refreshSubscribers = [];
  }

  const publicPaths = ['/auth/login', '/auth/refresh', '/auth/register', '/auth/reset-password', '/auth/verify-email', '/auth/forgot-password', '/auth/logout', '/auth/validate-code'];

  /* ---------- postMessage helpers (modo iframe) ---------- */

  /**
   * Pede o token ao shell (index.html) via postMessage.
   * O shell é o único que chama /auth/refresh — sem corrida.
   */
  function requestTokenFromShell(forceRefresh = false) {
    return new Promise((resolve, reject) => {
      const requestId = Math.random().toString(36).slice(2);
      const msgType = forceRefresh ? 'MINSQ_REFRESH_TOKEN' : 'MINSQ_GET_TOKEN';

      const timeout = setTimeout(() => {
        window.removeEventListener('message', handler);
        reject(new Error('[MohiAuth] Token request timeout'));
      }, 25000);

      function handler(event) {
        if (event.origin !== window.location.origin) return;
        if (event.data?.type === 'MINSQ_TOKEN_RESPONSE' && event.data.requestId === requestId) {
          clearTimeout(timeout);
          window.removeEventListener('message', handler);
          resolve(event.data.token);
        }
      }

      window.addEventListener('message', handler);
      window.top.postMessage({ type: msgType, requestId }, window.location.origin);
    });
  }

  /* ---------- Refresh direto (modo standalone / top-level) ---------- */

  async function doDirectRefresh() {
    if (isRefreshing) {
      return new Promise(resolve => refreshSubscribers.push(resolve));
    }
    isRefreshing = true;
    try {
      const refreshRes = await fetch(`${BASE_URL}/auth/refresh`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        credentials: 'include'
      });
      const refreshData = await refreshRes.json();
      if (refreshRes.ok && refreshData.token) {
        currentToken = refreshData.token;
        onRefreshed(currentToken);
        return currentToken;
      }
      throw new Error('Sessão inválida');
    } catch (e) {
      onRefreshed(null);
      return null;
    } finally {
      isRefreshing = false;
    }
  }

  /* ---------- Resolve o token (iframe ou standalone) ---------- */

  async function resolveToken(forceRefresh = false) {
    let token = null;
    if (isInIframe) {
      // Delega ao shell — zero chamadas a /auth/refresh por parte do iframe
      try {
        token = await requestTokenFromShell(forceRefresh);
      } catch (e) {
        // Timeout inesperado: fallback para refresh direto
        console.warn('[MohiAuth] postMessage timeout, usando fallback direto.');
        token = await doDirectRefresh();
      }
    } else {
      // Standalone (ex: abrir auth.html diretamente) — comportamento original
      token = await doDirectRefresh();
    }
    if (token) startHeartbeat();
    return token;
  }

  /* ---------- Heartbeat ---------- */
  let heartbeatInterval = null;
  function startHeartbeat() {
    if (heartbeatInterval) return;
    heartbeatInterval = setInterval(async () => {
      try {
        if (!currentToken) return;
        await fetch(`${BASE_URL}/user/me/heartbeat`, {
          method: 'POST',
          headers: { 'Authorization': `Bearer ${currentToken}` },
          credentials: 'include'
        });
      } catch (e) { }
    }, 2 * 60 * 1000); // 2 minutos
  }

  /* ---------- Redirect para login ---------- */

  function redirectToLogin() {
    if (isInIframe) {
      window.top.postMessage({ type: 'MINSQ_INVALIDATE' }, '*');
      // '/auth' é a rota do shell: abre o login dentro do iframe e mantém a URL limpa
      // (antes ia para /pages/auth/auth.html e a URL completa aparecia na barra).
      window.top.location.replace('/auth');
    } else {
      if (document.getElementById('mh-content-frame')) {
        // It's the shell. Tell it to invalidate.
        if (window.__mohiAuth) window.__mohiAuth.invalidate();
      } else {
        var seg = window.location.pathname.split('/').pop() || '';
        var file = seg.indexOf('.') === -1 ? seg + '.html' : seg;
        if (file !== 'index.html' && window.location.pathname !== '/') {
          window.location.replace('/');
        }
      }
    }
  }

  /* ---------- Helper principal de requisições ---------- */

  async function request(path, options = {}) {
    // Sem token em memória e rota protegida → pega o token (shell ou refresh direto)
    if (!currentToken && !publicPaths.some(p => path.startsWith(p))) {
      const token = await resolveToken(false);
      if (token) {
        currentToken = token;
      } else {
        redirectToLogin();
        return Promise.reject(new Error('Sessão expirada — redirecionando para login.'));
      }
    }

    const headers = { ...options.headers };

    if (!(options.body instanceof FormData)) {
      headers['Content-Type'] = 'application/json';
    }

    if (currentToken) {
      headers['Authorization'] = `Bearer ${currentToken}`;
    }



    let res = await fetch(`${BASE_URL}${path}`, {
      ...options,
      headers,
      credentials: 'include'
    });

    // --- REFRESH TOKEN INTERCEPTOR (401) ---
    if (res.status === 401 && !publicPaths.some(p => path.startsWith(p))) {
      currentToken = null;

      const newToken = await resolveToken(true);

      if (newToken) {
        currentToken = newToken;
        headers['Authorization'] = `Bearer ${newToken}`;
        res = await fetch(`${BASE_URL}${path}`, {
          ...options,
          headers,
          credentials: 'include'
        });
      } else {
        redirectToLogin();
        return Promise.reject(new Error('Sessão expirada — redirecionando para login.'));
      }
    }
    // ---------------------------------

    const data = await res.json();

    if (!res.ok) {
      if (res.status === 503 && data.code === 'MAINTENANCE_MODE') {
        localStorage.setItem('minsq_is_maintenance', 'true');
        localStorage.setItem('minsq_maint_ts', String(Date.now()));
        const _h = (window.location.hostname || '').toLowerCase();
        const _p = (window.location.pathname || '').toLowerCase();
        const isExempt = _h.startsWith('maintenance') || _h.startsWith('status') || _h.startsWith('web') || _p.includes('status') || _p.includes('web') || _p.includes('maintenance');
        if (!isExempt) {
          if (_h === 'localhost' || _h === '127.0.0.1') {
            window.top.location.replace('/pages/api/maintenance.html');
          } else {
            window.top.location.replace('https://maintenance.mohi.com.br');
          }
        }
        return Promise.reject(new Error('Sistema em manutenção.'));
      }
      const err = new Error(data.error || 'Erro desconhecido na API.');
      Object.assign(err, data); // Anexa propriedades como `code` e `attemptsLeft`
      throw err;
    }

    if (localStorage.getItem('minsq_is_maintenance')) {
      localStorage.removeItem('minsq_is_maintenance');
      localStorage.removeItem('minsq_maint_ts');
    }

    return data;
  }

  async function requestBlob(path, options = {}) {
    const headers = options.headers ? { ...options.headers } : {};

    if (currentToken) {
      headers['Authorization'] = `Bearer ${currentToken}`;
    }

    let res = await fetch(`${BASE_URL}${path}`, {
      ...options,
      headers,
      credentials: 'include'
    });

    if (res.status === 401 && !publicPaths.some(p => path.startsWith(p))) {
      currentToken = null;
      const newToken = await resolveToken(true);
      if (newToken) {
        currentToken = newToken;
        headers['Authorization'] = `Bearer ${newToken}`;
        res = await fetch(`${BASE_URL}${path}`, {
          ...options,
          headers,
          credentials: 'include'
        });
      } else {
        redirectToLogin();
        return Promise.reject(new Error('Sessão expirada — redirecionando para login.'));
      }
    }

    if (!res.ok) {
      throw new Error('Erro ao baixar o arquivo da API.');
    }

    return await res.blob();
  }

  const api = {
    request,
    requestBlob,
    // Feedback
    async sendFeedback(type, message, rating, email) {
      return request('/feedback', {
        method: 'POST',
        body: JSON.stringify({ type, message, rating, email }),
      });
    },

    // Direct Message
    async sendDM(message, email) {
      return request('/dm', {
        method: 'POST',
        body: JSON.stringify({ message, email }),
      });
    },

    // Autenticação
    async login(email, password) {
      const data = await request('/auth/login', {
        method: 'POST',
        body: JSON.stringify({ email, password }),
      });
      if (data.token) {
        currentToken = data.token;
        startHeartbeat();
        // Notifica o shell sobre o novo token (Auth Bus)
        if (isInIframe) window.top.postMessage({ type: 'MINSQ_SET_TOKEN', token: data.token }, window.location.origin);
      }
      return data;
    },

    async register(nome, email, nascimento, password) {
      return request('/auth/register', {
        method: 'POST',
        body: JSON.stringify({ nome, email, nascimento, password }),
      });
    },

    async verifyEmail(email, code, turnstileToken) {
      const payload = { email, code };
      if (turnstileToken) payload.turnstileToken = turnstileToken;
      const data = await request('/auth/verify-email', {
        method: 'POST',
        body: JSON.stringify(payload),
      });
      if (data.token) {
        currentToken = data.token;
        startHeartbeat();
        if (isInIframe) window.top.postMessage({ type: 'MINSQ_SET_TOKEN', token: data.token, user: data.user }, window.location.origin);
      } else if (data.onboardingToken) {
        currentToken = data.onboardingToken;
        sessionStorage.setItem('minsq_onboarding_token', data.onboardingToken);
      }
      return data;
    },

    async forgotPassword(email) {
      return request('/auth/forgot-password', {
        method: 'POST',
        body: JSON.stringify({ email }),
      });
    },

    async validateCode(email, code) {
      return request('/auth/validate-code', {
        method: 'POST',
        body: JSON.stringify({ email, code }),
      });
    },

    async resetPassword(email, code, newPassword) {
      const data = await request('/auth/reset-password', {
        method: 'POST',
        body: JSON.stringify({ email, code, newPassword }),
      });
      if (data.token) {
        currentToken = data.token;
        startHeartbeat();
        if (isInIframe) window.top.postMessage({ type: 'MINSQ_SET_TOKEN', token: data.token }, window.location.origin);
      }
      return data;
    },

    async logout() {
      try {
        await request('/auth/logout', {
          method: 'POST',
        });
        currentToken = null;
        // Invalida o token no shell também
        if (isInIframe) window.top.postMessage({ type: 'MINSQ_INVALIDATE' }, window.location.origin);
      } catch (e) {
        console.warn('Logout failed on core', e);
      }
    },

    async logoutAll() {
      return request('/auth/logout-all', {
        method: 'POST',
      });
    },

    // Perfil e Configurações
    async getProfile() {
      return request('/user/me');
    },

    async completeOnboarding(handle, conheceu_por) {
      const data = await request('/user/me/onboarding', {
        method: 'POST',
        body: JSON.stringify({ handle, conheceu_por }),
      });
      if (data.token) {
        currentToken = data.token;
        if (isInIframe) window.top.postMessage({ type: 'MINSQ_SET_TOKEN', token: data.token, user: data.user }, window.location.origin);
      }
      return data;
    },

    async checkHandle(handle) {
      return request(`/user/check-handle?handle=${encodeURIComponent(handle)}`);
    },

    async updateProfile(profileData) {
      return request('/user/me', {
        method: 'PATCH',
        body: JSON.stringify(profileData),
        keepalive: true,
      });
    },

    async verifyCurrentPassword(senha_atual) {
      return request('/user/me/verify-password', {
        method: 'POST',
        body: JSON.stringify({ senha_atual }),
      });
    },

    async updatePassword(password, senha_atual) {
      return request('/user/me/password', {
        method: 'PATCH',
        body: JSON.stringify({ password, senha_atual }),
      });
    },

    // Sessões
    async getSessions() {
      return request('/user/me/sessions');
    },

    async revokeSession(sessionId, senha_atual) {
      return request(`/user/me/sessions/${sessionId}`, {
        method: 'DELETE',
        body: JSON.stringify({ senha_atual }),
      });
    },

    async revokeAllSessions(senha_atual) {
      return request('/user/me/sessions', {
        method: 'DELETE',
        body: JSON.stringify({ senha_atual }),
      });
    },

    // Zona de perigo
    async disableAccount(senha_atual) {
      return request('/user/me/disable', {
        method: 'POST',
        body: JSON.stringify({ senha_atual }),
      });
    },

    async deleteAccount(senha_atual) {
      return request('/user/me', {
        method: 'DELETE',
        body: JSON.stringify({ senha_atual }),
      });
    },

    async getPublicProfile(identifier) {
      return request(`/user/${encodeURIComponent(identifier)}/public`);
    },

    async followUser(identifier) {
      return request(`/user/${encodeURIComponent(identifier)}/follow`, { method: 'POST' });
    },
    async unfollowUser(identifier) {
      return request(`/user/${encodeURIComponent(identifier)}/follow`, { method: 'DELETE' });
    },
    async getFollowStatus(identifier) {
      return request(`/user/${encodeURIComponent(identifier)}/follow-status`);
    },
    async getFollowers(identifier, page = 1) {
      return request(`/user/${encodeURIComponent(identifier)}/followers?page=${page}&limit=10`);
    },
    async getFollowing(identifier, page = 1) {
      return request(`/user/${encodeURIComponent(identifier)}/following?page=${page}&limit=10`);
    },
    async getFollowRequests(page = 1) {
      return request(`/user/me/follow-requests?page=${page}&limit=30`);
    },
    async acceptFollowRequest(followerId) {
      return request(`/user/follow-requests/${encodeURIComponent(followerId)}/accept`, { method: 'PATCH' });
    },
    async rejectFollowRequest(followerId) {
      return request(`/user/follow-requests/${encodeURIComponent(followerId)}/reject`, { method: 'PATCH' });
    },

    async getRanking(type) {
      return request(`/ranking/${type}`);
    },

    async getRankingMe() {
      return request('/ranking/me');
    },


    // Notas (Notes)
    async getNotes() {
      return request('/notes');
    },

    async saveNote(noteData) {
      return request('/notes', {
        method: 'POST',
        body: JSON.stringify(noteData),
      });
    },

    async deleteNote(id) {
      return request(`/notes/${id}`, {
        method: 'DELETE',
      });
    },

    async restoreNote(id) {
      return request(`/notes/${id}/restore`, {
        method: 'POST',
      });
    },

    async purgeNote(id) {
      return request(`/notes/${id}/purge`, {
        method: 'DELETE',
      });
    },

    async emptyNotesTrash() {
      return request('/notes/trash/empty', {
        method: 'DELETE',
      });
    },

    // Dashboard
    async getDashboardSummary() {
      return request('/dashboard/summary');
    },

    // Tarefas (Tasks)
    async getTasks(startDate) {
      let url = '/tasks';
      if (startDate) url += `?startDate=${startDate}`;
      return request(url);
    },

    async createTask(taskData) {
      return request('/tasks', {
        method: 'POST',
        body: JSON.stringify(taskData),
      });
    },

    async updateTask(id, taskData) {
      return request(`/tasks/${id}`, {
        method: 'PATCH',
        body: JSON.stringify(taskData),
      });
    },

    async deleteTask(id) {
      return request(`/tasks/${id}`, {
        method: 'DELETE',
      });
    },

    async completeTask(id, concluida) {
      return request(`/tasks/${id}/complete`, {
        method: 'POST',
        body: JSON.stringify({ concluida }),
      });
    },

    // Metas (Goals)
    async getGoals() {
      return request('/goals');
    },

    async createGoal(goalData) {
      return request('/goals', {
        method: 'POST',
        body: JSON.stringify(goalData),
      });
    },

    async updateGoal(id, goalData) {
      return request(`/goals/${id}`, {
        method: 'PATCH',
        body: JSON.stringify(goalData),
      });
    },

    async deleteGoal(id) {
      return request(`/goals/${id}`, {
        method: 'DELETE',
      });
    },

    async completeGoal(id) {
      return request(`/goals/${id}/complete`, {
        method: 'POST',
      });
    },

    // Planos de Ação (Plans Action)
    async getPlansAction() {
      return request('/plans_action');
    },

    async upsertPlansAction(catData) {
      return request('/plans_action', {
        method: 'POST',
        body: JSON.stringify(catData),
      });
    },

    async deletePlansAction(catId) {
      return request(`/plans_action/${catId}`, {
        method: 'DELETE',
      });
    },

    // Mapas Mentais (Mind Maps)
    async getMindmaps() {
      return request('/mindmaps');
    },

    async createMindmap(mapData) {
      return request('/mindmaps', {
        method: 'POST',
        body: JSON.stringify(mapData),
      });
    },

    async updateMindmap(mapId, mapData) {
      return request(`/mindmaps/${mapId}`, {
        method: 'PATCH',
        body: JSON.stringify(mapData),
      });
    },

    async deleteMindmap(mapId) {
      return request(`/mindmaps/${mapId}`, {
        method: 'DELETE',
      });
    },

    // Controle de Vícios (Addictions)
    async getAddictions() {
      return request('/addictions');
    },

    async createAddiction(addictionData) {
      return request('/addictions', {
        method: 'POST',
        body: JSON.stringify(addictionData),
      });
    },

    async updateAddiction(addictionId, addictionData) {
      return request(`/addictions/${addictionId}`, {
        method: 'PATCH',
        body: JSON.stringify(addictionData),
      });
    },

    async deleteAddiction(addictionId) {
      return request(`/addictions/${addictionId}`, {
        method: 'DELETE',
      });
    },




    // Foco (Focus)
    async getFocusStats() {
      return request('/focus/stats');
    },

    async logFocusSession(sessionData) {
      return request('/focus/sessions', {
        method: 'POST',
        body: JSON.stringify(sessionData),
      });
    },

    async getFocoFolders() {
      return request('/focus/folders');
    },

    async createFocoFolder(name) {
      return request('/focus/folders', {
        method: 'POST',
        body: JSON.stringify({ name }),
      });
    },

    async deleteFocoFolder(id) {
      return request(`/focus/folders/${id}`, {
        method: 'DELETE',
      });
    },

    async getFocoRoutines() {
      return request('/focus/routines');
    },

    async createFocoRoutine(routineData) {
      return request('/focus/routines', {
        method: 'POST',
        body: JSON.stringify(routineData),
      });
    },

    async deleteFocoRoutine(id) {
      return request(`/focus/routines/${id}`, {
        method: 'DELETE',
      });
    },

    // Saúde (Health)
    async getHealthSettings() {
      return request('/health/settings');
    },

    async saveHealthSettings(settingsData) {
      return request('/health/settings', {
        method: 'POST',
        body: JSON.stringify(settingsData),
      });
    },

    async getHealthLogs(startDate) {
      let url = '/health/logs';
      if (startDate) url += `?startDate=${startDate}`;
      return request(url);
    },

    async logHealth(logData) {
      return request('/health/logs', {
        method: 'POST',
        body: JSON.stringify(logData),
      });
    },

    async deleteHealthLog(id) {
      return request(`/health/logs/${id}`, {
        method: 'DELETE',
      });
    },

    // Rotinas (Routines)
    async getRoutines(preset) {
      const q = preset ? `?preset=${preset}` : '';
      return request(`/routines${q}`);
    },

    async createRoutine(routineData) {
      return request('/routines', {
        method: 'POST',
        body: JSON.stringify(routineData),
      });
    },

    async setRoutinePreset(preset) {
      return request('/routines/preset', {
        method: 'PUT',
        body: JSON.stringify({ preset }),
      });
    },

    async deleteRoutine(id) {
      return request(`/routines/${id}`, {
        method: 'DELETE',
      });
    },

    async deleteMultipleRoutines(ids) {
      return request('/routines/delete-multiple', {
        method: 'POST',
        body: JSON.stringify({ ids }),
      });
    },

    // Estudos (Study)
    async getStudySettings() {
      return request('/study/settings');
    },

    async saveStudySettings(settingsData) {
      return request('/study/settings', {
        method: 'POST',
        body: JSON.stringify(settingsData),
      });
    },

    async getStudyTracks() {
      return request('/study/tracks');
    },

    async saveStudyTrack(trackData) {
      return request('/study/tracks', {
        method: 'POST',
        body: JSON.stringify(trackData),
      });
    },

    async deleteStudyTrack(trackId) {
      return request(`/study/tracks/${trackId}`, {
        method: 'DELETE',
      });
    },

    async getStudyNotes() {
      return request('/study/notes');
    },

    async saveStudyNote(noteData) {
      return request('/study/notes', {
        method: 'POST',
        body: JSON.stringify(noteData),
      });
    },

    async deleteStudyNote(noteId) {
      return request(`/study/notes/${noteId}`, {
        method: 'DELETE',
      });
    },

    async getStudyPlan(trackId) {
      return request(`/study/plans/${trackId}`);
    },

    async saveStudyPlan(trackId, modules) {
      return request('/study/plans', {
        method: 'POST',
        body: JSON.stringify({ track_id: trackId, modules }),
      });
    },

    async getStudySessions(startDate) {
      let url = '/study/sessions';
      if (startDate) url += `?startDate=${startDate}`;
      return request(url);
    },

    async saveStudySession(sessionData) {
      return request('/study/sessions', {
        method: 'POST',
        body: JSON.stringify(sessionData),
      });
    },

    async deleteStudySession(id) {
      return request(`/study/sessions/${id}`, {
        method: 'DELETE',
      });
    },

    // Upload de Arquivos (Multipart Form Data)
    async uploadFile(file, folder = 'general') {
      const formData = new FormData();
      formData.append('file', file);
      formData.append('folder', folder);

      return request('/uploads', {
        method: 'POST',
        body: formData,
      });
    },

    // Suporte (Support)
    async createSupportTicket(ticketData) {
      return request('/support/tickets', {
        method: 'POST',
        body: JSON.stringify(ticketData),
      });
    },

    async sendPublicContact(contactData) {
      return request('/support/contact', {
        method: 'POST',
        body: JSON.stringify(contactData),
      });
    },

    async getSupportTickets() {
      return request('/support/tickets');
    },

    // Administração (Admin)
    async getStatus() {
      return request('/status');
    },

    // Bug reports (User & Admin)
    async reportBug(bugData) {
      return request('/bugs', {
        method: 'POST',
        body: JSON.stringify(bugData),
      });
    }

  };

  window.api = api;
})();
