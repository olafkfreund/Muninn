// Muninn - JavaScript Application Controller
// Interacts with the GitHub API client-side and registers WebMCP tools.

(function () {
  'use strict';

  // Application State
  const state = {
    token: localStorage.getItem('gh_pat') || '',
    user: null,
    repos: [],
    prs: [],
    issues: [],
    workflowRuns: {},
    securityAlerts: [],
    totalStars: 0,
    theme: localStorage.getItem('theme') || 'dark',
    refreshInterval: parseInt(localStorage.getItem('refresh_interval') || '300', 10),
    timerId: null,
    mcpController: null,
    bridgeSocket: null,
    bridgeReconnectTimer: null,
    bridgeUrl: 'ws://localhost:8765',
    oauthClientId: ''
  };

  // DOM Elements
  const el = {
    themeToggle: document.getElementById('theme-toggle'),
    navItems: document.querySelectorAll('.nav-item'),
    viewSections: document.querySelectorAll('.view-section'),
    currentViewTitle: document.getElementById('current-view-title'),
    btnRefresh: document.getElementById('btn-refresh'),
    
    // Header/Auth
    userProfileHeader: document.getElementById('user-profile-header'),
    userDisplayName: document.getElementById('user-display-name'),
    userLogin: document.getElementById('user-login'),
    userAvatarImg: document.getElementById('user-avatar-img'),
    btnLogoutHeader: document.getElementById('btn-logout-header'),
    viewSetup: document.getElementById('view-setup'),
    authForm: document.getElementById('auth-form'),
    patInput: document.getElementById('pat-input'),
    authErrorMsg: document.getElementById('auth-error-msg'),
    oauthLoginContainer: document.getElementById('oauth-login-container'),
    btnOauthLogin: document.getElementById('btn-oauth-login'),
    
    // Overview
    statRunningWorkflows: document.getElementById('stat-running-workflows'),
    statActivePrs: document.getElementById('stat-active-prs'),
    statOpenIssues: document.getElementById('stat-open-issues'),
    statSecurityAlerts: document.getElementById('stat-security-alerts'),
    statTotalStars: document.getElementById('stat-total-stars'),
    overviewWorkflowsTbody: document.getElementById('overview-workflows-tbody'),
    
    // Workflows View
    workflowsRepoSelect: document.getElementById('workflows-repo-select'),
    workflowsRunsTbody: document.getElementById('workflows-runs-tbody'),
    
    // PR View
    prsTbody: document.getElementById('prs-tbody'),
    
    // Issues View
    issuesListContainer: document.getElementById('issues-list-container'),
    btnCreateIssueModal: document.getElementById('btn-create-issue-modal'),
    modalCreateIssue: document.getElementById('modal-create-issue'),
    btnCloseIssueModal: document.getElementById('btn-close-issue-modal'),
    btnCancelIssue: document.getElementById('btn-cancel-issue'),
    createIssueForm: document.getElementById('create-issue-form'),
    issueRepoSelect: document.getElementById('issue-repo-select'),
    issueTitleInput: document.getElementById('issue-title-input'),
    issueBodyTextarea: document.getElementById('issue-body-textarea'),
    
    // Security View
    securityAlertsTbody: document.getElementById('security-alerts-tbody'),
    
    // Stars View
    starsTbody: document.getElementById('stars-tbody'),
    
    // Settings View
    btnDisconnectToken: document.getElementById('btn-disconnect-token'),
    settingsTokenBadge: document.getElementById('settings-token-badge'),
    settingsTokenPreview: document.getElementById('settings-token-preview'),
    selectRefreshRate: document.getElementById('select-refresh-rate'),
    
    // WebMCP Status
    agentStatusDot: document.getElementById('agent-status-dot'),
    agentStatusText: document.getElementById('agent-status-text')
  };

  // --- INITIALIZATION ---
  async function init() {
    setupTheme();
    setupNavigation();
    setupEventListeners();
    setupAutoRefresh();

    // Check if redirect contains OAuth code
    const urlParams = new URLSearchParams(window.location.search);
    const code = urlParams.get('code');
    
    if (code) {
      // Clear code query param from address bar
      window.history.replaceState({}, document.title, window.location.pathname);
      showView('setup');
      if (el.authErrorMsg) {
        el.authErrorMsg.textContent = 'Exchanging authorization code...';
        el.authErrorMsg.className = 'badge badge-info';
        el.authErrorMsg.style.display = 'block';
      }
      
      try {
        const res = await fetch('http://localhost:8765/oauth/exchange', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ code: code })
        });
        
        const data = await res.json();
        if (data.error) {
          throw new Error(data.error);
        }
        
        if (data.access_token) {
          validateAndConnect(data.access_token, true);
        }
      } catch (err) {
        if (el.authErrorMsg) {
          el.authErrorMsg.textContent = `OAuth connection failed: ${err.message}. Make sure node mcp-bridge.js is running.`;
          el.authErrorMsg.className = 'badge badge-danger';
        }
      }
    } else if (state.token) {
      validateAndConnect(state.token, false);
    } else {
      showView('setup');
      checkOauthBridgeAvailability();
    }

    checkWebMcpSupport();
  }

  async function checkOauthBridgeAvailability() {
    try {
      const res = await fetch('http://localhost:8765/config');
      const data = await res.json();
      if (data.client_id) {
        state.oauthClientId = data.client_id;
        if (el.oauthLoginContainer) {
          el.oauthLoginContainer.style.display = 'block';
        }
      }
    } catch (err) {
      if (el.oauthLoginContainer) {
        el.oauthLoginContainer.style.display = 'none';
      }
    }
  }

  // --- THEME MANAGEMENT ---
  function setupTheme() {
    document.documentElement.setAttribute('data-theme', state.theme);
    if (el.themeToggle) {
      el.themeToggle.checked = (state.theme === 'light');
    }
  }

  function toggleTheme() {
    state.theme = state.theme === 'dark' ? 'light' : 'dark';
    localStorage.setItem('theme', state.theme);
    document.documentElement.setAttribute('data-theme', state.theme);
  }

  // --- NAVIGATION & VIEWS ---
  function setupNavigation() {
    // Check initial hash
    const hash = window.location.hash.replace('#', '') || 'overview';
    if (state.token) {
      showView(hash);
    }

    window.addEventListener('hashchange', function () {
      const activeHash = window.location.hash.replace('#', '') || 'overview';
      if (state.token) {
        showView(activeHash);
      }
    });
  }

  function showView(viewId) {
    if (!state.token && viewId !== 'setup') {
      viewId = 'setup';
    }

    el.viewSections.forEach(section => {
      section.classList.remove('active');
    });

    const targetSection = document.getElementById(`view-${viewId}`);
    if (targetSection) {
      targetSection.classList.add('active');
      
      // Update Title
      const titleMap = {
        'setup': 'Connect to GitHub',
        'overview': 'Overview',
        'workflows': 'Actions & Workflow Runs',
        'prs': 'Pull Requests',
        'issues': 'Issues Management',
        'security': 'Security Alerts',
        'stars': 'Project Stars & Analytics',
        'automation': 'Automations & Agents',
        'settings': 'Settings'
      };
      el.currentViewTitle.textContent = titleMap[viewId] || 'Muninn';

      // Update Sidebar Nav State
      el.navItems.forEach(item => {
        item.classList.remove('active');
        if (item.getAttribute('data-view') === viewId) {
          item.classList.add('active');
        }
      });
    }
  }

  // --- EVENT LISTENERS ---
  function setupEventListeners() {
    if (el.themeToggle) {
      el.themeToggle.addEventListener('change', toggleTheme);
    }

    if (el.authForm) {
      el.authForm.addEventListener('submit', function (e) {
        e.preventDefault();
        const inputToken = el.patInput.value.trim();
        if (inputToken) {
          validateAndConnect(inputToken, true);
        }
      });
    if (el.btnOauthLogin) {
      el.btnOauthLogin.addEventListener('click', function () {
        if (!state.oauthClientId) return;
        const redirectUri = encodeURIComponent(window.location.origin + window.location.pathname);
        window.location.href = `https://github.com/login/oauth/authorize?client_id=${state.oauthClientId}&scope=repo,workflow,security_events&redirect_uri=${redirectUri}`;
      });
    }

    if (el.btnRefresh) {
      el.btnRefresh.addEventListener('click', function () {
        refreshDashboard();
      });
    }

    if (el.btnLogoutHeader) {
      el.btnLogoutHeader.addEventListener('click', disconnectToken);
    }

    if (el.btnDisconnectToken) {
      el.btnDisconnectToken.addEventListener('click', disconnectToken);
    }

    if (el.selectRefreshRate) {
      el.selectRefreshRate.addEventListener('change', function () {
        state.refreshInterval = parseInt(this.value, 10);
        localStorage.setItem('refresh_interval', state.refreshInterval);
        setupAutoRefresh();
      });
    }

    // Workflows Dropdown Change
    if (el.workflowsRepoSelect) {
      el.workflowsRepoSelect.addEventListener('change', function () {
        const repoFull = this.value;
        if (repoFull) {
          loadRepoWorkflows(repoFull);
        } else {
          el.workflowsRunsTbody.innerHTML = `<tr><td colspan="6" style="text-align: center; color: var(--fg-secondary);">Select a repository above to display workflows.</td></tr>`;
        }
      });
    }

    // Issues Modal Controls
    if (el.btnCreateIssueModal) {
      el.btnCreateIssueModal.addEventListener('click', () => {
        el.modalCreateIssue.classList.add('active');
      });
    }

    const closeIssueModal = () => {
      el.modalCreateIssue.classList.remove('active');
      el.createIssueForm.reset();
    };

    if (el.btnCloseIssueModal) el.btnCloseIssueModal.addEventListener('click', closeIssueModal);
    if (el.btnCancelIssue) el.btnCancelIssue.addEventListener('click', closeIssueModal);

    if (el.createIssueForm) {
      el.createIssueForm.addEventListener('submit', function (e) {
        e.preventDefault();
        createGitHubIssue();
      });
    }
  }

  // --- AUTO-REFRESH MANAGEMENT ---
  function setupAutoRefresh() {
    if (state.timerId) {
      clearInterval(state.timerId);
      state.timerId = null;
    }

    if (state.refreshInterval > 0 && state.token) {
      state.timerId = setInterval(refreshDashboard, state.refreshInterval * 1000);
    }
  }

  // --- GITHUB API CLIENT ---
  async function ghFetch(path, options = {}) {
    const headers = {
      'Authorization': `token ${state.token}`,
      'Accept': 'application/vnd.github.v3+json',
      ...options.headers
    };

    const response = await fetch(`https://api.github.com${path}`, {
      ...options,
      headers
    });

    if (!response.ok) {
      const errorBody = await response.json().catch(() => ({}));
      const errorMsg = errorBody.message || `API Error: ${response.status} ${response.statusText}`;
      throw new Error(errorMsg);
    }

    return response.json();
  }

  // --- AUTHENTICATION & LOGIN ---
  async function validateAndConnect(token, showSuccessAlert) {
    try {
      if (el.authErrorMsg) el.authErrorMsg.style.display = 'none';
      
      // Temporary state set
      state.token = token;
      
      // Validate token by fetching user profile
      const user = await ghFetch('/user');
      
      // Access Control: lock access to owner (olafkfreund)
      if (user.login !== 'olafkfreund') {
        throw new Error('Access Denied: Only user @olafkfreund is permitted to access this portal.');
      }
      
      // Save state
      state.user = user;
      localStorage.setItem('gh_pat', token);
      
      // Update Headers and settings
      if (el.userProfileHeader) {
        el.userProfileHeader.style.display = 'flex';
        el.userDisplayName.textContent = user.name || user.login;
        el.userLogin.textContent = `@${user.login}`;
        el.userAvatarImg.src = user.avatar_url;
      }

      if (el.settingsTokenBadge) {
        el.settingsTokenBadge.textContent = 'Connected';
        el.settingsTokenBadge.className = 'badge badge-success';
        el.settingsTokenPreview.textContent = token.substring(0, 8) + '...xxxx';
      }

      // Populate Settings selection
      if (el.selectRefreshRate) {
        el.selectRefreshRate.value = state.refreshInterval;
      }
      
      // Success transition
      const activeHash = window.location.hash.replace('#', '') || 'overview';
      showView(activeHash);
      
      // Fetch data
      refreshDashboard();

      // Setup WebMCP
      registerWebMcpTools();

      setupAutoRefresh();
    } catch (err) {
      state.token = '';
      localStorage.removeItem('gh_pat');
      if (el.authErrorMsg) {
        el.authErrorMsg.textContent = `Authentication Failed: ${err.message}`;
        el.authErrorMsg.style.display = 'block';
      }
      showView('setup');
    }
  }

  function disconnectToken() {
    state.token = '';
    state.user = null;
    state.repos = [];
    state.prs = [];
    state.issues = [];
    state.workflowRuns = {};
    state.securityAlerts = [];
    
    localStorage.removeItem('gh_pat');
    
    if (el.userProfileHeader) {
      el.userProfileHeader.style.display = 'none';
    }

    if (state.timerId) {
      clearInterval(state.timerId);
      state.timerId = null;
    }

    // Abort WebMCP Tools
    if (state.mcpController) {
      state.mcpController.abort();
      state.mcpController = null;
      updateWebMcpStatusCard(false, 'Inactive (Disconnected)');
    }

    showView('setup');
  }

  // --- DASHBOARD DATA LOADING ---
  async function refreshDashboard() {
    if (!state.token) return;

    // Show spinning refresh icon
    const refreshIcon = el.btnRefresh.querySelector('i');
    refreshIcon.classList.add('fa-spin');

    try {
      // 1. Fetch Repositories
      const repos = await ghFetch('/user/repos?sort=updated&per_page=100');
      state.repos = repos;
      
      // Calculate total stars
      state.totalStars = repos.reduce((acc, repo) => acc + (repo.stargazers_count || 0), 0);
      el.statTotalStars.textContent = state.totalStars;

      // Populate repo dropdowns
      populateRepoDropdowns(repos);

      // 2. Fetch Open PRs (using Search API for efficiency)
      const prsResult = await ghFetch(`/search/issues?q=is:open+is:pr+user:${state.user.login}&per_page=100`);
      state.prs = prsResult.items || [];
      el.statActivePrs.textContent = state.prs.length;

      // 3. Fetch Open Issues (using Search API)
      const issuesResult = await ghFetch(`/search/issues?q=is:open+is:issue+user:${state.user.login}&per_page=100`);
      state.issues = issuesResult.items || [];
      el.statOpenIssues.textContent = state.issues.length;

      // 4. Load Recent Workflows runs for overview
      await loadRecentOverviewWorkflows(repos.slice(0, 5));

      // 5. Load Security Scans
      await loadSecurityScans(repos.slice(0, 5));

      // Render all views
      renderOverview();
      renderPRs();
      renderIssues();
      renderSecurityAlerts();
      renderStars();

      // Trigger active views updates if applicable
      const activeHash = window.location.hash.replace('#', '') || 'overview';
      if (activeHash === 'workflows') {
        const activeRepo = el.workflowsRepoSelect.value;
        if (activeRepo) loadRepoWorkflows(activeRepo);
      }

    } catch (err) {
      console.error('Error refreshing dashboard:', err);
    } finally {
      // Remove spin
      setTimeout(() => {
        refreshIcon.classList.remove('fa-spin');
      }, 500);
    }
  }

  function populateRepoDropdowns(repos) {
    // Save selections
    const prevWorkflowVal = el.workflowsRepoSelect.value;
    const prevIssueVal = el.issueRepoSelect.value;

    const options = repos.map(repo => `<option value="${repo.full_name}">${repo.full_name}</option>`).join('');
    
    el.workflowsRepoSelect.innerHTML = `<option value="">Select a repository...</option>${options}`;
    el.issueRepoSelect.innerHTML = `<option value="">Select a repository...</option>${options}`;

    // Restore selections if valid
    if (prevWorkflowVal) el.workflowsRepoSelect.value = prevWorkflowVal;
    if (prevIssueVal) el.issueRepoSelect.value = prevIssueVal;
  }

  // --- COMPONENT RENDERING ---

  // Overview
  function renderOverview() {
    if (state.prs.length === 0 && Object.keys(state.workflowRuns).length === 0) return;

    // Running workflows calculations
    let runningCount = 0;
    const allRecentRuns = [];

    Object.keys(state.workflowRuns).forEach(repo => {
      const runs = state.workflowRuns[repo] || [];
      runs.forEach(run => {
        allRecentRuns.push({ repo, ...run });
        if (run.status === 'in_progress' || run.status === 'queued') {
          runningCount++;
        }
      });
    });

    el.statRunningWorkflows.textContent = runningCount;

    // Render Table
    if (allRecentRuns.length === 0) {
      el.overviewWorkflowsTbody.innerHTML = `<tr><td colspan="6" style="text-align: center; color: var(--fg-secondary);">No recent runs found.</td></tr>`;
      return;
    }

    // Sort by updated_at
    allRecentRuns.sort((a, b) => new Date(b.updated_at) - new Date(a.updated_at));

    el.overviewWorkflowsTbody.innerHTML = allRecentRuns.slice(0, 10).map(run => {
      const statusBadge = getWorkflowStatusBadge(run.status, run.conclusion);
      const repoName = run.repo.split('/')[1];
      const timeStr = formatRelativeTime(run.updated_at);
      
      const cancelBtn = (run.status === 'in_progress' || run.status === 'queued')
        ? `<button class="btn btn-sm badge-danger" onclick="cancelWorkflowRun('${run.repo}', ${run.id})">Cancel</button>`
        : `<button class="btn btn-sm btn-primary" onclick="reRunWorkflow('${run.repo}', ${run.id})">Re-run</button>`;

      return `
        <tr>
          <td><strong><a href="https://github.com/${run.repo}" target="_blank">${repoName}</a></strong></td>
          <td><a href="${run.html_url}" target="_blank">${run.name} (#${run.run_number})</a></td>
          <td>${run.triggering_actor ? run.triggering_actor.login : 'system'}</td>
          <td><code>${run.event}</code></td>
          <td>${statusBadge}</td>
          <td>
            <div class="flex-align">
              ${cancelBtn}
            </div>
          </td>
        </tr>
      `;
    }).join('');
  }

  // PRs View
  function renderPRs() {
    if (state.prs.length === 0) {
      el.prsTbody.innerHTML = `<tr><td colspan="6" style="text-align: center; color: var(--fg-secondary);">No open pull requests found.</td></tr>`;
      return;
    }

    el.prsTbody.innerHTML = state.prs.map(pr => {
      // Extract repo name from repository_url
      const repoParts = pr.repository_url.split('/repos/');
      const repoName = repoParts[1] || 'Repo';
      const repoShort = repoName.split('/')[1] || repoName;
      
      // Build reviewer badges
      const reviewers = pr.requested_reviewers || [];
      const reviewerLabels = reviewers.map(r => `<span class="badge badge-neutral" style="padding: 2px 4px; font-size: 10px;">@${r.login}</span>`).join(' ');

      return `
        <tr>
          <td><strong><a href="https://github.com/${repoName}" target="_blank">${repoShort}</a></strong></td>
          <td>
            <a href="${pr.html_url}" target="_blank" style="font-weight: 700;">${pr.title}</a>
            <div class="card-desc">#${pr.number} opened ${formatRelativeTime(pr.created_at)}</div>
          </td>
          <td>
            <div class="flex-align">
              <img src="${pr.user.avatar_url}" style="width: 20px; height: 20px; border-radius: 50%;">
              <span>@${pr.user.login}</span>
            </div>
          </td>
          <td>
            ${reviewerLabels || '<span class="card-desc">None</span>'}
          </td>
          <td>
            ${pr.draft ? '<span class="badge badge-neutral">Draft</span>' : '<span class="badge badge-info">Open</span>'}
          </td>
          <td>
            <div class="flex-align">
              <button class="btn btn-sm btn-primary" onclick="mergePR('${repoName}', ${pr.number})"><i class="fa-solid fa-code-merge"></i> Merge</button>
              <button class="btn btn-sm" onclick="closePR('${repoName}', ${pr.number})">Close</button>
            </div>
          </td>
        </tr>
      `;
    }).join('');
  }

  // Issues View
  function renderIssues() {
    if (state.issues.length === 0) {
      el.issuesListContainer.innerHTML = `<div class="card" style="text-align: center; color: var(--fg-secondary);">No open issues assigned or found.</div>`;
      return;
    }

    // Group issues by Repository
    const grouped = {};
    state.issues.forEach(issue => {
      const repoParts = issue.repository_url.split('/repos/');
      const repoName = repoParts[1] || 'Other Repositories';
      if (!grouped[repoName]) {
        grouped[repoName] = [];
      }
      grouped[repoName].push(issue);
    });

    el.issuesListContainer.innerHTML = Object.keys(grouped).map(repoName => {
      const repoShort = repoName.split('/')[1] || repoName;
      const issues = grouped[repoName];
      
      const issueRows = issues.map(issue => {
        const labels = issue.labels.map(l => `<span class="badge" style="background-color: #${l.color}25; color: #${l.color}; border-color: #${l.color}; font-size: 10px; padding: 2px 6px; margin-right: 4px;">${l.name}</span>`).join('');
        
        return `
          <div style="padding: 16px 20px; border-bottom: 1px solid var(--border-color); display: flex; align-items: center; justify-content: space-between;">
            <div>
              <div class="flex-align" style="margin-bottom: 4px;">
                <a href="${issue.html_url}" target="_blank" style="font-weight: 700;">${issue.title}</a>
                <span class="card-desc">#${issue.number}</span>
              </div>
              <div class="flex-align">
                <span class="card-desc">Opened ${formatRelativeTime(issue.created_at)} by @${issue.user.login}</span>
                <div style="display: inline-flex; flex-wrap: wrap;">${labels}</div>
              </div>
            </div>
            <div class="flex-align">
              <button class="btn btn-sm" onclick="closeIssue('${repoName}', ${issue.number})">Close</button>
            </div>
          </div>
        `;
      }).join('');

      return `
        <div class="table-container" style="margin-bottom: 24px;">
          <div style="padding: 16px 20px; background-color: var(--bg-soft); border-bottom: 2px solid var(--border-color); font-weight: 700; font-family: var(--font-mono); font-size: 14px;">
            <i class="fa-solid fa-folder"></i> ${repoName} (${issues.length})
          </div>
          <div style="background-color: var(--bg-hard);">
            ${issueRows}
          </div>
        </div>
      `;
    }).join('');
  }

  // Security View
  function renderSecurityAlerts() {
    if (state.securityAlerts.length === 0) {
      el.securityAlertsTbody.innerHTML = `<tr><td colspan="6" style="text-align: center; color: var(--fg-secondary);">No security scan alerts found. Scans are healthy.</td></tr>`;
      el.statSecurityAlerts.textContent = 0;
      return;
    }

    el.statSecurityAlerts.textContent = state.securityAlerts.length;

    el.securityAlertsTbody.innerHTML = state.securityAlerts.map(alert => {
      const severityClass = `scan-severity-${alert.severity}`;
      const timeStr = formatRelativeTime(alert.created_at || alert.updated_at);
      const pkg = alert.security_advisory ? alert.security_advisory.package.name : (alert.rule ? alert.rule.id : 'General');
      const desc = alert.security_advisory ? alert.security_advisory.summary : (alert.description || 'Code scanning warning');
      const htmlUrl = alert.html_url || `https://github.com/${alert.repo}/security/alerts`;

      return `
        <tr>
          <td><strong>${alert.repo.split('/')[1]}</strong></td>
          <td>
            <a href="${htmlUrl}" target="_blank" style="font-weight:700;">${desc}</a>
            <div class="card-desc">ID: ${alert.number || alert.id}</div>
          </td>
          <td><span class="badge ${severityClass === 'scan-severity-critical' || severityClass === 'scan-severity-high' ? 'badge-danger' : 'badge-warning'}">${alert.severity.toUpperCase()}</span></td>
          <td><code>${pkg}</code></td>
          <td>${timeStr}</td>
          <td>
            <a href="${htmlUrl}" target="_blank" class="btn btn-sm">Fix Alert</a>
          </td>
        </tr>
      `;
    }).join('');
  }

  // Stars View
  function renderStars() {
    if (state.repos.length === 0) {
      el.starsTbody.innerHTML = `<tr><td colspan="6" style="text-align: center; color: var(--fg-secondary);">Connect account to load stars analytics.</td></tr>`;
      return;
    }

    // Sort repositories by star count descending
    const sortedRepos = [...state.repos].sort((a, b) => (b.stargazers_count || 0) - (a.stargazers_count || 0));

    el.starsTbody.innerHTML = sortedRepos.map(repo => {
      return `
        <tr>
          <td><strong><a href="${repo.html_url}" target="_blank">${repo.name}</a></strong></td>
          <td style="max-width: 300px; overflow: hidden; text-overflow: ellipsis; white-space: nowrap;" title="${repo.description || 'No description'}">
            <span class="card-desc">${repo.description || 'No description provided.'}</span>
          </td>
          <td><span class="badge badge-neutral">${repo.language || 'N/A'}</span></td>
          <td><i class="fa-solid fa-code-fork"></i> ${repo.forks_count}</td>
          <td>${formatRelativeTime(repo.updated_at)}</td>
          <td>
            <div class="flex-align" style="font-weight: 700; color: var(--yellow);">
              <i class="fa-solid fa-star"></i> ${repo.stargazers_count}
            </div>
          </td>
        </tr>
      `;
    }).join('');
  }

  // --- ACTIONS & OPERATIONS ---

  // Load Workflows for specific Repository
  async function loadRepoWorkflows(repoFull) {
    el.workflowsRunsTbody.innerHTML = `<tr><td colspan="6" style="text-align: center;"><i class="fa-solid fa-rotate fa-spin"></i> Loading workflows...</td></tr>`;

    try {
      // Fetch workflows
      const workflowsData = await ghFetch(`/repos/${repoFull}/actions/workflows`);
      const workflows = workflowsData.workflows || [];
      
      // Fetch latest runs
      const runsData = await ghFetch(`/repos/${repoFull}/actions/runs?per_page=30`);
      const runs = runsData.workflow_runs || [];

      // Save runs state
      state.workflowRuns[repoFull] = runs;

      if (runs.length === 0) {
        el.workflowsRunsTbody.innerHTML = `<tr><td colspan="6" style="text-align: center; color: var(--fg-secondary);">No workflow runs found.</td></tr>`;
        return;
      }

      el.workflowsRunsTbody.innerHTML = runs.map(run => {
        const statusBadge = getWorkflowStatusBadge(run.status, run.conclusion);
        const timeStr = formatRelativeTime(run.updated_at);

        const cancelBtn = (run.status === 'in_progress' || run.status === 'queued')
          ? `<button class="btn btn-sm badge-danger" onclick="cancelWorkflowRun('${repoFull}', ${run.id})">Cancel</button>`
          : `<button class="btn btn-sm btn-primary" onclick="reRunWorkflow('${repoFull}', ${run.id})">Re-run</button>`;

        // Find match workflow dispatch capability
        const matchingWorkflow = workflows.find(w => w.id === run.workflow_id);
        const dispatchBtn = (matchingWorkflow && run.event === 'workflow_dispatch')
          ? `<button class="btn btn-sm" onclick="dispatchWorkflow('${repoFull}', ${run.workflow_id}, '${run.head_branch}')" title="Trigger dispatch run"><i class="fa-solid fa-rocket"></i> Dispatch</button>`
          : '';

        return `
          <tr>
            <td>
              <a href="${run.html_url}" target="_blank" style="font-weight:700;">${run.name} (#${run.run_number})</a>
              <div class="card-desc">SHA: <code>${run.head_sha.substring(0, 7)}</code></div>
            </td>
            <td><code>${run.head_branch}</code></td>
            <td><code>${run.event}</code></td>
            <td>${statusBadge}</td>
            <td>${timeStr}</td>
            <td>
              <div class="flex-align">
                ${cancelBtn}
                ${dispatchBtn}
              </div>
            </td>
          </tr>
        `;
      }).join('');

    } catch (err) {
      el.workflowsRunsTbody.innerHTML = `<tr><td colspan="6" style="text-align: center; color: var(--red);">Error loading workflows: ${err.message}</td></tr>`;
    }
  }

  // Fetch recent workflows across active repos
  async function loadRecentOverviewWorkflows(topRepos) {
    const promises = topRepos.map(async (repo) => {
      try {
        const data = await ghFetch(`/repos/${repo.full_name}/actions/runs?per_page=5`);
        state.workflowRuns[repo.full_name] = data.workflow_runs || [];
      } catch (err) {
        // Fail silently for repositories without Action privileges
        state.workflowRuns[repo.full_name] = [];
      }
    });
    await Promise.all(promises);
  }

  // Load Security alerts for main repositories
  async function loadSecurityScans(topRepos) {
    let allAlerts = [];
    const promises = topRepos.map(async (repo) => {
      try {
        // Fetch Dependabot Alerts
        const dependabotAlerts = await ghFetch(`/repos/${repo.full_name}/dependabot/alerts?state=open&per_page=10`).catch(() => []);
        const formatted = dependabotAlerts.map(alert => ({
          repo: repo.full_name,
          id: alert.number,
          number: alert.number,
          severity: alert.security_vulnerability.severity,
          security_advisory: alert.security_advisory,
          created_at: alert.created_at,
          html_url: alert.html_url
        }));
        allAlerts.push(...formatted);

        // Fetch Code Scanning Alerts if possible
        const codeScans = await ghFetch(`/repos/${repo.full_name}/code-scanning/alerts?state=open&per_page=10`).catch(() => []);
        const codeFormatted = codeScans.map(alert => ({
          repo: repo.full_name,
          id: alert.number,
          number: alert.number,
          severity: alert.rule.severity === 'error' ? 'high' : (alert.rule.severity === 'warning' ? 'medium' : 'low'),
          rule: alert.rule,
          description: alert.rule.description,
          created_at: alert.created_at,
          html_url: alert.html_url
        }));
        allAlerts.push(...codeFormatted);
      } catch (err) {
        // Fails silently for permission lack
      }
    });
    await Promise.all(promises);
    state.securityAlerts = allAlerts;
  }

  // Cancel running workflows
  window.cancelWorkflowRun = async function (repoFull, runId) {
    if (!confirm('Are you sure you want to cancel this workflow run?')) return;
    try {
      await ghFetch(`/repos/${repoFull}/actions/runs/${runId}/cancel`, { method: 'POST' });
      alert('Cancel command sent to GitHub!');
      setTimeout(refreshDashboard, 2000);
    } catch (err) {
      alert(`Failed to cancel workflow: ${err.message}`);
    }
  };

  // Re-run workflow
  window.reRunWorkflow = async function (repoFull, runId) {
    try {
      await ghFetch(`/repos/${repoFull}/actions/runs/${runId}/rerun`, { method: 'POST' });
      alert('Workflow re-run queued!');
      setTimeout(refreshDashboard, 2000);
    } catch (err) {
      alert(`Failed to trigger re-run: ${err.message}`);
    }
  };

  // Dispatch manual workflow dispatch run
  window.dispatchWorkflow = async function (repoFull, workflowId, branch) {
    const ref = prompt('Enter git branch or tag to run on:', branch || 'master');
    if (!ref) return;

    try {
      await ghFetch(`/repos/${repoFull}/actions/workflows/${workflowId}/dispatches`, {
        method: 'POST',
        body: JSON.stringify({ ref: ref })
      });
      alert('Workflow run successfully dispatched!');
      setTimeout(refreshDashboard, 2000);
    } catch (err) {
      alert(`Failed to dispatch workflow: ${err.message}`);
    }
  };

  // Merge Pull Request
  window.mergePR = async function (repoFull, number) {
    if (!confirm(`Are you sure you want to MERGE Pull Request #${number}?`)) return;
    try {
      await ghFetch(`/repos/${repoFull}/pulls/${number}/merge`, {
        method: 'PUT',
        body: JSON.stringify({ commit_title: `Merged PR #${number} via Muninn` })
      });
      alert('PR merged successfully!');
      refreshDashboard();
    } catch (err) {
      alert(`Merge failed: ${err.message}`);
    }
  };

  // Close Pull Request
  window.closePR = async function (repoFull, number) {
    if (!confirm(`Are you sure you want to CLOSE Pull Request #${number}?`)) return;
    try {
      await ghFetch(`/repos/${repoFull}/pulls/${number}`, {
        method: 'PATCH',
        body: JSON.stringify({ state: 'closed' })
      });
      alert('PR closed.');
      refreshDashboard();
    } catch (err) {
      alert(`Operation failed: ${err.message}`);
    }
  };

  // Close Issue
  window.closeIssue = async function (repoFull, number) {
    if (!confirm(`Are you sure you want to CLOSE issue #${number}?`)) return;
    try {
      await ghFetch(`/repos/${repoFull}/issues/${number}`, {
        method: 'PATCH',
        body: JSON.stringify({ state: 'closed' })
      });
      alert('Issue closed successfully.');
      refreshDashboard();
    } catch (err) {
      alert(`Failed to close issue: ${err.message}`);
    }
  };

  // Create GitHub Issue
  async function createGitHubIssue() {
    const repoFull = el.issueRepoSelect.value;
    const title = el.issueTitleInput.value.trim();
    const body = el.issueBodyTextarea.value;

    if (!repoFull || !title) return;

    const btnSubmit = document.getElementById('btn-submit-issue');
    btnSubmit.disabled = true;
    btnSubmit.innerHTML = '<i class="fa-solid fa-spinner fa-spin"></i> Creating...';

    try {
      await ghFetch(`/repos/${repoFull}/issues`, {
        method: 'POST',
        body: JSON.stringify({ title, body })
      });
      alert('Issue created successfully!');
      
      // Close Modal and reload
      el.modalCreateIssue.classList.remove('active');
      el.createIssueForm.reset();
      refreshDashboard();
    } catch (err) {
      alert(`Failed to create issue: ${err.message}`);
    } finally {
      btnSubmit.disabled = false;
      btnSubmit.innerHTML = 'Create Issue';
    }
  }

  // --- AUTOMATIONS PANEL ---
  window.runPRLabeler = async function () {
    alert('PR auto-labeler starting...');
    // Demo implementation
    let count = 0;
    for (const pr of state.prs) {
      const repoParts = pr.repository_url.split('/repos/');
      const repoName = repoParts[1];
      if (pr.draft && !pr.labels.some(l => l.name === 'WIP')) {
        try {
          await ghFetch(`/repos/${repoName}/issues/${pr.number}/labels`, {
            method: 'POST',
            body: JSON.stringify({ labels: ['WIP'] })
          });
          count++;
        } catch (e) {
          console.error(e);
        }
      }
    }
    alert(`Auto-labeler complete. Marked ${count} draft PRs with 'WIP' label.`);
    refreshDashboard();
  };

  window.runStaleIssueScanner = async function () {
    alert('Scanning issues for stale status (30 days inactivity)...');
    let staleCount = 0;
    const now = new Date();
    const thirtyDaysAgo = new Date(now.setDate(now.getDate() - 30));

    const staleIssues = state.issues.filter(issue => {
      const updated = new Date(issue.updated_at);
      return updated < thirtyDaysAgo;
    });

    if (staleIssues.length === 0) {
      alert('No stale issues found.');
      return;
    }

    const confirmClose = confirm(`Found ${staleIssues.length} stale issues. Would you like to close them all?`);
    if (!confirmClose) return;

    for (const issue of staleIssues) {
      const repoParts = issue.repository_url.split('/repos/');
      const repoName = repoParts[1];
      try {
        await ghFetch(`/repos/${repoName}/issues/${issue.number}`, {
          method: 'PATCH',
          body: JSON.stringify({ state: 'closed', state_reason: 'not_planned' })
        });
        staleCount++;
      } catch (e) {
        console.error(e);
      }
    }
    alert(`Closed ${staleCount} stale issues successfully.`);
    refreshDashboard();
  };

  // Demo connection to local MCP SSE
  window.connectLocalMcp = function () {
    const url = document.getElementById('mcp-terminal-url').value.trim();
    if (!url) return;
    alert(`Attempting connection to local SSE server at: ${url}\n(Note: CORS settings on your local SSE endpoint must allow this browser origin).`);
  };

  // --- WEBMCP AGENT INTEGRATION (BROWSER NATIVE & FALLBACK BRIDGE) ---
  function checkWebMcpSupport() {
    const isSupported = ('modelContext' in navigator && 'registerTool' in navigator.modelContext);
    if (isSupported) {
      updateWebMcpStatusCard(true, 'Active (Native WebMCP)');
    } else {
      updateWebMcpStatusCard(false, 'Inactive (Connecting to Bridge...)');
      connectMcpBridge();
    }
  }

  function updateWebMcpStatusCard(active, text) {
    if (active) {
      el.agentStatusDot.classList.add('active');
    } else {
      el.agentStatusDot.classList.remove('active');
    }
    el.agentStatusText.textContent = text;
  }

  function getToolsList() {
    return [
      {
        name: 'list_loaded_repos',
        description: 'Returns the list of repositories loaded in the Muninn dashboard, including star counts and description.',
        inputSchema: { type: 'object', properties: {} }
      },
      {
        name: 'list_pull_requests',
        description: 'Returns active GitHub pull requests displayed in Muninn.',
        inputSchema: { type: 'object', properties: {} }
      },
      {
        name: 'list_issues',
        description: 'Returns open issues grouped by repository.',
        inputSchema: { type: 'object', properties: {} }
      },
      {
        name: 'trigger_action_workflow',
        description: 'Triggers a manual workflow dispatch run for a repository.',
        inputSchema: {
          type: 'object',
          properties: {
            repo: { type: 'string', description: 'The full repository name, e.g., "owner/repo".' },
            workflow_id: { type: 'number', description: 'The workflow ID to trigger.' },
            ref: { type: 'string', description: 'Git branch or tag to run on.' }
          },
          required: ['repo', 'workflow_id', 'ref']
        }
      }
    ];
  }

  async function executeTool(name, args) {
    if (name === 'list_loaded_repos') {
      return state.repos.map(r => ({
        name: r.name,
        full_name: r.full_name,
        stars: r.stargazers_count,
        forks: r.forks_count,
        language: r.language,
        description: r.description
      }));
    }
    if (name === 'list_pull_requests') {
      return state.prs.map(pr => ({
        number: pr.number,
        title: pr.title,
        author: pr.user.login,
        html_url: pr.html_url,
        created_at: pr.created_at,
        draft: pr.draft
      }));
    }
    if (name === 'list_issues') {
      return state.issues.map(issue => ({
        number: issue.number,
        title: issue.title,
        author: issue.user.login,
        created_at: issue.created_at,
        labels: issue.labels.map(l => l.name)
      }));
    }
    if (name === 'trigger_action_workflow') {
      await ghFetch(`/repos/${args.repo}/actions/workflows/${args.workflow_id}/dispatches`, {
        method: 'POST',
        body: JSON.stringify({ ref: args.ref })
      });
      refreshDashboard();
      return `Workflow ${args.workflow_id} successfully triggered on branch ${args.ref}!`;
    }
    throw new Error('Tool not found: ' + name);
  }

  function registerWebMcpTools() {
    if (!('modelContext' in navigator && 'registerTool' in navigator.modelContext)) {
      return;
    }

    if (state.mcpController) {
      state.mcpController.abort();
    }

    state.mcpController = new AbortController();
    const signal = state.mcpController.signal;

    try {
      const tools = getToolsList();
      tools.forEach(tool => {
        navigator.modelContext.registerTool({
          name: tool.name,
          description: tool.description,
          inputSchema: tool.inputSchema,
          execute(args) {
            return executeTool(tool.name, args);
          }
        }, { signal });
      });

      updateWebMcpStatusCard(true, 'Active (Native WebMCP - ' + tools.length + ' Tools)');
      console.log('Muninn WebMCP Native Tools successfully registered!');
    } catch (err) {
      console.error('Failed to register WebMCP tools:', err);
      updateWebMcpStatusCard(false, 'Registration Failed');
    }
  }

  function connectMcpBridge() {
    // If bridge is already connected or native WebMCP is running, do nothing
    if (state.bridgeSocket || ('modelContext' in navigator && 'registerTool' in navigator.modelContext)) {
      return;
    }

    console.log('[MCP Bridge] Attempting connection to local bridge at ' + state.bridgeUrl);
    
    try {
      const socket = new WebSocket(state.bridgeUrl);
      state.bridgeSocket = socket;

      socket.onopen = function () {
        console.log('[MCP Bridge] Connected to local bridge!');
        updateWebMcpStatusCard(true, 'Active (via Local Bridge)');
      };

      socket.onclose = function () {
        console.log('[MCP Bridge] Connection closed.');
        state.bridgeSocket = null;
        
        const isNativeSupported = ('modelContext' in navigator && 'registerTool' in navigator.modelContext);
        if (!isNativeSupported) {
          updateWebMcpStatusCard(false, 'Inactive (Bridge disconnected)');
        }

        // Try reconnecting in 5 seconds
        if (state.bridgeReconnectTimer) clearTimeout(state.bridgeReconnectTimer);
        state.bridgeReconnectTimer = setTimeout(connectMcpBridge, 5000);
      };

      socket.onerror = function () {
        socket.close();
      };

      socket.onmessage = async function (event) {
        try {
          const req = JSON.parse(event.data);
          const { method, id, params } = req;

          if (method === 'tools/list') {
            const toolsList = getToolsList();
            socket.send(JSON.stringify({
              jsonrpc: '2.0',
              id: id,
              result: { tools: toolsList }
            }));
          } else if (method === 'tools/call') {
            const toolName = params.name;
            const args = params.arguments || {};
            
            try {
              const res = await executeTool(toolName, args);
              socket.send(JSON.stringify({
                jsonrpc: '2.0',
                id: id,
                result: {
                  content: [{
                    type: 'text',
                    text: JSON.stringify(res, null, 2)
                  }]
                }
              }));
            } catch (err) {
              socket.send(JSON.stringify({
                jsonrpc: '2.0',
                id: id,
                error: { code: -32603, message: err.message }
              }));
            }
          }
        } catch (err) {
          console.error('[MCP Bridge] Error processing bridge message:', err);
        }
      };
    } catch (e) {
      state.bridgeSocket = null;
    }
  }

  // --- HELPERS ---
  function getWorkflowStatusBadge(status, conclusion) {
    if (status === 'in_progress') {
      return '<span class="badge badge-warning"><i class="fa-solid fa-spinner fa-spin"></i> Running</span>';
    }
    if (status === 'queued') {
      return '<span class="badge badge-neutral"><i class="fa-solid fa-hourglass-start"></i> Queued</span>';
    }
    if (conclusion === 'success') {
      return '<span class="badge badge-success"><i class="fa-solid fa-check"></i> Success</span>';
    }
    if (conclusion === 'failure') {
      return '<span class="badge badge-danger"><i class="fa-solid fa-xmark"></i> Failed</span>';
    }
    if (conclusion === 'cancelled') {
      return '<span class="badge badge-neutral"><i class="fa-solid fa-ban"></i> Cancelled</span>';
    }
    return `<span class="badge badge-neutral">${conclusion || status}</span>`;
  }

  function formatRelativeTime(dateStr) {
    const date = new Date(dateStr);
    const now = new Date();
    const diffMs = now - date;
    const diffSec = Math.floor(diffMs / 1000);
    const diffMin = Math.floor(diffSec / 60);
    const diffHr = Math.floor(diffMin / 60);
    const diffDays = Math.floor(diffHr / 24);

    if (diffSec < 60) return 'Just now';
    if (diffMin < 60) return `${diffMin}m ago`;
    if (diffHr < 24) return `${diffHr}h ago`;
    if (diffDays === 1) return 'Yesterday';
    return `${diffDays} days ago`;
  }

  // Kickstart App
  document.addEventListener('DOMContentLoaded', init);

})();
