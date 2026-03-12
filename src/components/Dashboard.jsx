import React, { useEffect, useMemo, useRef, useState } from 'react';
import { useAuth } from '../contexts/AuthContext';
import {
  Cog6ToothIcon,
  DocumentTextIcon,
  FolderIcon,
  MagnifyingGlassIcon,
  PlusIcon,
  RectangleStackIcon,
  RocketLaunchIcon,
  UserCircleIcon,
  ClockIcon,
  ArrowDownTrayIcon,
  ClipboardDocumentIcon,
  Bars3Icon,
  MoonIcon,
  SunIcon
} from '@heroicons/react/24/outline';

const API_BASE_URL = import.meta.env.VITE_API_BASE_URL || '';
const METHODS = ['GET', 'POST', 'PUT', 'PATCH', 'DELETE', 'HEAD', 'OPTIONS'];
const SIDEBAR_ITEMS = ['Dashboard', 'Projects', 'Workspace', 'API Collections', 'History', 'Exports', 'Settings'];

const apiFetch = async (path, options = {}) => {
  const response = await fetch(`${API_BASE_URL}${path}`, {
    credentials: 'include',
    headers: { 'Content-Type': 'application/json', ...(options.headers || {}) },
    ...options
  });

  const data = await response.json().catch(() => ({}));
  if (!response.ok) {
    throw new Error(data.error || `Request failed: ${response.status}`);
  }
  return data;
};

const parseHeaderLines = (raw) => {
  const result = {};
  String(raw || '')
    .split('\n')
    .map((line) => line.trim())
    .filter(Boolean)
    .forEach((line) => {
      const index = line.indexOf(':');
      if (index < 0) return;
      const key = line.slice(0, index).trim();
      const value = line.slice(index + 1).trim();
      if (key) result[key] = value;
    });
  return result;
};

const parseQueryParamLines = (raw) => {
  const text = String(raw || '').trim();
  if (!text) return {};

  // Prevent accidental JSON payload from turning into query params.
  if (text.startsWith('{') || text.startsWith('[')) {
    return {};
  }

  const result = {};
  text
    .split('\n')
    .map((line) => line.trim())
    .filter(Boolean)
    .forEach((line) => {
      const index = line.indexOf(':');
      if (index < 0) return;
      const key = line.slice(0, index).trim();
      if (!/^[A-Za-z0-9_.-]+$/.test(key)) return;
      const value = line.slice(index + 1).trim().replace(/,$/, '');
      result[key] = value;
    });
  return result;
};

const parseFormDataLines = (raw) => {
  const result = {};
  String(raw || '')
    .split('\n')
    .map((line) => line.trim())
    .filter(Boolean)
    .forEach((line) => {
      const index = line.indexOf(':');
      if (index < 0) return;
      const key = line.slice(0, index).trim();
      const value = line.slice(index + 1).trim();
      if (key) result[key] = value;
    });
  return result;
};

const toLines = (value) => Object.entries(value || {}).map(([k, v]) => `${k}: ${v}`).join('\n');

const toPretty = (value) => {
  if (typeof value === 'string') return value;
  try {
    return JSON.stringify(value, null, 2);
  } catch {
    return String(value);
  }
};

const escapeHtml = (value) => String(value || '')
  .replace(/&/g, '&amp;')
  .replace(/</g, '&lt;')
  .replace(/>/g, '&gt;');

const highlightWithRegex = (value, regex, colorResolver) => {
  const text = String(value || '');
  let result = '';
  let lastIndex = 0;
  let match = regex.exec(text);

  while (match) {
    const token = match[0];
    const start = match.index;
    result += escapeHtml(text.slice(lastIndex, start));
    const color = colorResolver(token);
    result += `<span style="color:${color}">${escapeHtml(token)}</span>`;
    lastIndex = start + token.length;
    match = regex.exec(text);
  }

  result += escapeHtml(text.slice(lastIndex));
  return result;
};

const getThemePalette = (isDark) => isDark
  ? {
    key: '#ff79c6',
    string: '#f1fa8c',
    number: '#ffb86c',
    boolean: '#50fa7b',
    null: '#bd93f9',
    flag: '#8be9fd',
    url: '#50fa7b'
  }
  : {
    key: '#be185d',
    string: '#1d4ed8',
    number: '#b45309',
    boolean: '#047857',
    null: '#7c3aed',
    flag: '#0f766e',
    url: '#15803d'
  };

const highlightJsonLike = (value, isDark) => {
  const palette = getThemePalette(isDark);
  const regex = /"(?:\\.|[^"\\])*"(?=\s*:)?|"(?:\\.|[^"\\])*"|\btrue\b|\bfalse\b|\bnull\b|-?\d+(?:\.\d+)?(?:[eE][+-]?\d+)?/g;
  return highlightWithRegex(value, regex, (token) => {
    if (/^"/.test(token) && /"$/.test(token)) {
      return /"\s*:?$/.test(token) ? palette.key : palette.string;
    }
    if (token === 'true' || token === 'false') return palette.boolean;
    if (token === 'null') return palette.null;
    return palette.number;
  });
};

const highlightCurl = (value, isDark) => {
  const palette = getThemePalette(isDark);
  const regex = /https?:\/\/[^\s\\]+|"(?:\\.|[^"\\])*"|\b(?:curl|-X|-H|--data|-d|-F)\b/g;
  return highlightWithRegex(value, regex, (token) => {
    if (/^https?:\/\//.test(token)) return palette.url;
    if (/^"/.test(token)) return palette.string;
    return palette.flag;
  });
};

const parseCurl = (curl) => {
  const text = String(curl || '').trim();
  const methodMatch = text.match(/-X\s+([A-Z]+)/i);
  const urlMatch = text.match(/https?:\/\/[^\s"']+/i);
  const headerMatches = [...text.matchAll(/-H\s+"([^"]+)"/g)];
  const bodyMatch = text.match(/--data\s+'([\s\S]*?)'/) || text.match(/-d\s+'([\s\S]*?)'/);
  const formDataMatches = [...text.matchAll(/-F\s+"([^=]+)=([^"]*)"/g)];

  const headers = {};
  headerMatches.forEach((m) => {
    const line = m[1];
    const idx = line.indexOf(':');
    if (idx > 0) headers[line.slice(0, idx).trim()] = line.slice(idx + 1).trim();
  });

  return {
    method: (methodMatch?.[1] || 'GET').toUpperCase(),
    url: urlMatch?.[0] || '',
    headers,
    bodyMode: formDataMatches.length > 0 ? 'form-data' : 'raw',
    body: formDataMatches.length > 0
      ? formDataMatches.map((item) => `${item[1]}: ${item[2]}`).join('\n')
      : (bodyMatch?.[1] || '')
  };
};

const Dashboard = () => {
  const { user, logout } = useAuth();
  const [activeNav, setActiveNav] = useState('Workspace');
  const [sidebarCollapsed, setSidebarCollapsed] = useState(false);
  const [isDark, setIsDark] = useState(false);
  const [profileMenuOpen, setProfileMenuOpen] = useState(false);
  const [avatarFailed, setAvatarFailed] = useState(false);
  const [searchApi, setSearchApi] = useState('');

  const [projects, setProjects] = useState([]);
  const [selectedProjectId, setSelectedProjectId] = useState('');
  const [apis, setApis] = useState([]);
  const [allApis, setAllApis] = useState([]);
  const [selectedApiId, setSelectedApiId] = useState('');
  const [history, setHistory] = useState([]);
  const [globalHistory, setGlobalHistory] = useState([]);
  const [pendingOpenApiId, setPendingOpenApiId] = useState('');
  const [latestCurl, setLatestCurl] = useState('');
  const [exportProjectId, setExportProjectId] = useState('');
  const [exportApiId, setExportApiId] = useState('');
  const [selectedHistoryIds, setSelectedHistoryIds] = useState([]);
  const [exportView, setExportView] = useState('project');

  const [mode, setMode] = useState('request');
  const [method, setMethod] = useState('GET');
  const [endpoint, setEndpoint] = useState('/');
  const [paramsText, setParamsText] = useState('');
  const [headersText, setHeadersText] = useState('Content-Type: application/json');
  const [requestEditorTab, setRequestEditorTab] = useState('params');
  const [bodyText, setBodyText] = useState('');
  const [bodyMode, setBodyMode] = useState('raw');
  const [formFiles, setFormFiles] = useState([]);
  const [formFileKeyInput, setFormFileKeyInput] = useState('file');
  const [formFileInput, setFormFileInput] = useState(null);
  const [authType, setAuthType] = useState('no_auth');
  const [authToken, setAuthToken] = useState('');
  const [apiName, setApiName] = useState('');
  const [apiDescription, setApiDescription] = useState('');
  const [curlInput, setCurlInput] = useState('');

  const [responseTab, setResponseTab] = useState('body');
  const [responseData, setResponseData] = useState(null);
  const [loadingRun, setLoadingRun] = useState(false);
  const [savingApi, setSavingApi] = useState(false);
  const [toasts, setToasts] = useState([]);
  const [projectModalOpen, setProjectModalOpen] = useState(false);
  const [projectDeleteModalOpen, setProjectDeleteModalOpen] = useState(false);
  const [projectToDelete, setProjectToDelete] = useState(null);
  const [projectDeleteNameInput, setProjectDeleteNameInput] = useState('');
  const [deletingProject, setDeletingProject] = useState(false);
  const [projectNameInput, setProjectNameInput] = useState('');
  const [projectBaseUrlInput, setProjectBaseUrlInput] = useState('');
  const [projectDescriptionInput, setProjectDescriptionInput] = useState('');
  const [collaborators, setCollaborators] = useState([]);
  const [collaboratorRole, setCollaboratorRole] = useState('owner');
  const [collaboratorEmailInput, setCollaboratorEmailInput] = useState('');
  const [loadingCollaborators, setLoadingCollaborators] = useState(false);
  const [collaboratorApiMissing, setCollaboratorApiMissing] = useState(false);
  const [sharingProjectId, setSharingProjectId] = useState('');
  const profileMenuRef = useRef(null);

  const userAvatar = user?.picture || user?.image || null;
  const selectedProject = projects.find((p) => String(p._id) === selectedProjectId) || null;
  const currentUserDbId = String(user?.dbUserId || user?._id || '');
  const currentShareProjectId = sharingProjectId || selectedProjectId;
  const shareProject = projects.find((p) => String(p._id) === currentShareProjectId) || null;
  const shareRole = collaboratorRole || 'owner';
  const canManageCollaborators = shareRole === 'owner';
  const canMutateCollaborators = canManageCollaborators && !collaboratorApiMissing;
  const fallbackShareRole = String(shareProject?.user_id || '') === currentUserDbId ? 'owner' : 'collaborator';
  const fallbackCollaborators = useMemo(() => {
    if (!shareProject) return [];

    const ownerId = String(shareProject.user_id || '');
    const collaboratorIds = Array.isArray(shareProject.collaborator_ids)
      ? shareProject.collaborator_ids.map(String)
      : [];
    const ids = [...new Set([ownerId, ...collaboratorIds].filter(Boolean))];

    return ids.map((id) => ({
      user_id: id,
      name: id === currentUserDbId ? user?.name || null : null,
      email: id === currentUserDbId ? user?.email || null : null,
      picture: id === currentUserDbId ? userAvatar || null : null,
      role: id === ownerId ? 'owner' : 'collaborator'
    }));
  }, [shareProject, currentUserDbId, user?.name, user?.email, userAvatar]);
  const filteredApis = apis.filter((api) => `${api.method} ${api.endpoint} ${api.name}`.toLowerCase().includes(searchApi.toLowerCase()));

  const fullUrl = useMemo(() => {
    const base = selectedProject?.base_url || '';
    const cleanEndpoint = endpoint || '/';
    const params = parseQueryParamLines(paramsText);
    const query = new URLSearchParams(params).toString();
    const target = /^https?:\/\//i.test(cleanEndpoint) ? cleanEndpoint : `${base}${cleanEndpoint}`;
    return query ? `${target}${target.includes('?') ? '&' : '?'}${query}` : target;
  }, [selectedProject?.base_url, endpoint, paramsText]);

  const generatedCurl = useMemo(() => {
    const headers = parseHeaderLines(headersText);
    if (authType === 'bearer' && authToken.trim()) {
      headers.Authorization = `Bearer ${authToken.trim()}`;
    }
    const parts = [`curl -X ${method} "${fullUrl}"`];
    if (bodyMode === 'form-data' && !['GET', 'HEAD'].includes(method)) {
      Object.entries(headers)
        .filter(([k]) => String(k).toLowerCase() !== 'content-type')
        .forEach(([k, v]) => parts.push(`-H "${k}: ${String(v).replace(/"/g, '\\"')}"`));
      Object.entries(parseFormDataLines(bodyText)).forEach(([k, v]) => {
        parts.push(`-F "${String(k).replace(/"/g, '\\"')}=${String(v).replace(/"/g, '\\"')}"`);
      });
      formFiles.forEach((item) => {
        if (!item?.key || !item?.name) return;
        parts.push(`-F "${String(item.key).replace(/"/g, '\\"')}=@${String(item.name).replace(/"/g, '\\"')}"`);
      });
    } else {
      Object.entries(headers).forEach(([k, v]) => parts.push(`-H "${k}: ${String(v).replace(/"/g, '\\"')}"`));
      if (!['GET', 'HEAD'].includes(method) && bodyText.trim()) {
        parts.push(`--data '${bodyText.replace(/'/g, "'\\''")}'`);
      }
    }
    return parts.join(' \\\n  ');
  }, [method, fullUrl, headersText, bodyText, authType, authToken, bodyMode, formFiles]);

  const pushToast = (type, message) => {
    const id = `${Date.now()}-${Math.random()}`;
    setToasts((prev) => [...prev, { id, type, message }]);
    setTimeout(() => {
      setToasts((prev) => prev.filter((item) => item.id !== id));
    }, 3000);
  };

  const copyToClipboard = async (value, label = 'Text') => {
    try {
      await navigator.clipboard.writeText(toPretty(value ?? ''));
      pushToast('success', `${label} copied`);
    } catch {
      pushToast('error', `Unable to copy ${label.toLowerCase()}`);
    }
  };

  const fileToBase64 = (file) => new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => {
      const result = String(reader.result || '');
      const commaIndex = result.indexOf(',');
      resolve(commaIndex >= 0 ? result.slice(commaIndex + 1) : result);
    };
    reader.onerror = () => reject(new Error('File read failed'));
    reader.readAsDataURL(file);
  });

  const serializeFormFiles = async () => {
    const rows = formFiles.filter((item) => item?.file && item?.key);
    const encoded = await Promise.all(
      rows.map(async (item) => ({
        key: String(item.key),
        name: item.file.name,
        contentType: item.file.type || 'application/octet-stream',
        base64: await fileToBase64(item.file)
      }))
    );
    return encoded;
  };

  useEffect(() => {
    setAvatarFailed(false);
  }, [userAvatar]);

  useEffect(() => {
    const savedTheme = localStorage.getItem('api_tracker_theme');
    const prefersDark = window.matchMedia && window.matchMedia('(prefers-color-scheme: dark)').matches;
    setIsDark(savedTheme ? savedTheme === 'dark' : prefersDark);
  }, []);

  useEffect(() => {
    document.documentElement.classList.toggle('dark', isDark);
    localStorage.setItem('api_tracker_theme', isDark ? 'dark' : 'light');
  }, [isDark]);

  useEffect(() => {
    const handleOutsideClick = (event) => {
      if (!profileMenuRef.current) return;
      if (!profileMenuRef.current.contains(event.target)) {
        setProfileMenuOpen(false);
      }
    };
    document.addEventListener('mousedown', handleOutsideClick);
    return () => document.removeEventListener('mousedown', handleOutsideClick);
  }, []);

  useEffect(() => {
    const loadProjects = async () => {
      try {
        const data = await apiFetch('/api/projects');
        setProjects(data);
      } catch (err) {
        pushToast('error', err.message);
      }
    };
    loadProjects();
  }, []);

  useEffect(() => {
    if (projects.length === 0) {
      if (selectedProjectId) setSelectedProjectId('');
      if (sharingProjectId) setSharingProjectId('');
      return;
    }

    const projectIds = new Set(projects.map((project) => String(project._id)));
    if (!selectedProjectId || !projectIds.has(String(selectedProjectId))) {
      setSelectedProjectId(String(projects[0]._id));
    }
    if (sharingProjectId && !projectIds.has(String(sharingProjectId))) {
      setSharingProjectId('');
    }
  }, [projects, selectedProjectId, sharingProjectId]);

  useEffect(() => {
    const hasSelectedProject = projects.some((project) => String(project._id) === String(selectedProjectId));
    const loadApis = async () => {
      if (!selectedProjectId || !hasSelectedProject) {
        setApis([]);
        return;
      }
      try {
        const data = await apiFetch(`/api/projects/${selectedProjectId}/apis`);
        setApis(data);
      } catch (err) {
        pushToast('error', err.message);
      }
    };
    loadApis();
  }, [selectedProjectId, projects]);

  useEffect(() => {
    if (!currentShareProjectId || !shareProject) {
      setCollaborators([]);
      setCollaboratorRole('owner');
      return;
    }
    if (collaboratorApiMissing) {
      setCollaborators(fallbackCollaborators);
      setCollaboratorRole(fallbackShareRole);
      return;
    }

    const loadCollaborators = async () => {
      setLoadingCollaborators(true);
      try {
        const data = await apiFetch(`/api/projects/${currentShareProjectId}/collaborators`);
        setCollaborators(Array.isArray(data?.collaborators) ? data.collaborators : []);
        setCollaboratorRole(data?.role || 'owner');
      } catch (err) {
        const message = String(err.message || '').trim().toLowerCase();
        if (message === 'not found') {
          setCollaboratorApiMissing(true);
          setCollaborators(fallbackCollaborators);
          setCollaboratorRole(fallbackShareRole);
          pushToast('error', 'Collaborator API is unavailable on the active backend.');
          return;
        }
        setCollaborators([]);
        setCollaboratorRole('collaborator');
        pushToast('error', err.message || 'Unable to load collaborators');
      } finally {
        setLoadingCollaborators(false);
      }
    };

    loadCollaborators();
  }, [currentShareProjectId, shareProject, collaboratorApiMissing, fallbackCollaborators, fallbackShareRole]);

  const loadHistory = async (apiId) => {
    if (!apiId) return;
    try {
      const rows = await apiFetch(`/api/apis/${apiId}/history`);
      const curls = await apiFetch(`/api/apis/${apiId}/curls`);
      setHistory(rows);
      setLatestCurl(curls?.[0]?.curl_command || '');
    } catch (err) {
      pushToast('error', err.message);
    }
  };

  const loadGlobalHistory = async () => {
    try {
      const query = selectedProjectId ? `?projectId=${encodeURIComponent(selectedProjectId)}&limit=200` : '?limit=200';
      const rows = await apiFetch(`/api/history${query}`);
      setGlobalHistory(rows);
    } catch (err) {
      pushToast('error', err.message);
    }
  };

  useEffect(() => {
    loadGlobalHistory();
  }, [selectedProjectId]);

  useEffect(() => {
    setExportApiId('');
    setSelectedHistoryIds([]);
  }, [exportProjectId]);

  useEffect(() => {
    const loadAllApis = async () => {
      if (projects.length === 0) {
        setAllApis([]);
        return;
      }

      try {
        const batches = await Promise.all(
          projects.map(async (project) => {
            const rows = await apiFetch(`/api/projects/${project._id}/apis`);
            return rows.map((api) => ({
              ...api,
              project_name: project.name || '',
              project_base_url: project.base_url || ''
            }));
          })
        );
        setAllApis(batches.flat());
      } catch (err) {
        pushToast('error', err.message);
      }
    };

    loadAllApis();
  }, [projects]);

  useEffect(() => {
    if (!pendingOpenApiId) return;
    const found = apis.find((item) => String(item._id) === pendingOpenApiId);
    if (!found) return;

    selectApi(found);
    setPendingOpenApiId('');
    pushToast('success', 'API opened in workspace');
  }, [apis, pendingOpenApiId]);

  const selectApi = (api) => {
    setSelectedApiId(String(api._id));
    setApiName(api.name || '');
    setApiDescription(api.description || '');
    setMethod(api.method || 'GET');
    setEndpoint(api.endpoint || '/');
    setHeadersText(toLines(api.headers || {}));
    setParamsText(toLines(api.query_params || {}));
    const mode = api.body_mode === 'form-data' ? 'form-data' : 'raw';
    setBodyMode(mode);
    setRequestEditorTab(mode);
    setBodyText(
      mode === 'form-data'
        ? (typeof api.body === 'string' ? api.body : toLines(api.body || {}))
        : (typeof api.body === 'string' ? api.body : toPretty(api.body || ''))
    );
    setFormFiles([]);
    setFormFileInput(null);
    setAuthType(api.auth?.type || 'no_auth');
    setAuthToken(api.auth?.token || '');
    loadHistory(String(api._id));
  };

  const openApiFromHistory = (apiId, projectId) => {
    if (!apiId) {
      pushToast('error', 'This run is not linked to a saved API');
      return;
    }

    const normalizedApiId = String(apiId);
    const normalizedProjectId = projectId ? String(projectId) : '';
    setActiveNav('Workspace');

    if (normalizedProjectId && normalizedProjectId !== selectedProjectId) {
      setSelectedProjectId(normalizedProjectId);
      setPendingOpenApiId(normalizedApiId);
      return;
    }

    const found = apis.find((item) => String(item._id) === normalizedApiId);
    if (found) {
      selectApi(found);
      pushToast('success', 'API opened in workspace');
      return;
    }

    setPendingOpenApiId(normalizedApiId);
  };

  const deleteHistoryRow = async (historyId) => {
    const key = String(historyId || '');
    if (!key) return;
    if (!window.confirm('Delete this history row?')) return;

    try {
      await apiFetch(`/api/history/${key}`, { method: 'DELETE' });
      setGlobalHistory((prev) => prev.filter((item) => String(item._id) !== key));
      setSelectedHistoryIds((prev) => prev.filter((id) => id !== key));
      pushToast('success', 'History row deleted');
    } catch (err) {
      pushToast('error', err.message || 'History delete failed');
    }
  };

  const deleteApi = async (apiId) => {
    const key = String(apiId || '');
    if (!key) return;
    if (!window.confirm('Delete this API and linked history?')) return;

    try {
      await apiFetch(`/api/apis/${key}`, { method: 'DELETE' });
      setApis((prev) => prev.filter((item) => String(item._id) !== key));
      setAllApis((prev) => prev.filter((item) => String(item._id) !== key));
      setGlobalHistory((prev) => prev.filter((item) => String(item.api_id || '') !== key));
      if (selectedApiId === key) {
        setSelectedApiId('');
        setApiName('');
        setApiDescription('');
        setMethod('GET');
        setEndpoint('/');
        setHeadersText('Content-Type: application/json');
        setParamsText('');
        setBodyText('');
        setBodyMode('raw');
        setRequestEditorTab('params');
        setFormFiles([]);
        setFormFileInput(null);
        setAuthType('no_auth');
        setAuthToken('');
        setResponseData(null);
        setHistory([]);
        setLatestCurl('');
      }
      pushToast('success', 'API deleted');
    } catch (err) {
      pushToast('error', err.message || 'API delete failed');
    }
  };

  const createProject = async () => {
    const name = projectNameInput.trim();
    if (!name) {
      pushToast('error', 'Project name is required');
      return;
    }
    try {
      const newProject = await apiFetch('/api/projects', {
        method: 'POST',
        body: JSON.stringify({
          name,
          base_url: projectBaseUrlInput.trim(),
          description: projectDescriptionInput.trim()
        })
      });
      setProjects((prev) => [newProject, ...prev]);
      setSelectedProjectId(String(newProject._id));
      setSharingProjectId(String(newProject._id));
      setActiveNav('Projects');
      setProjectModalOpen(false);
      setProjectNameInput('');
      setProjectBaseUrlInput('');
      setProjectDescriptionInput('');
      pushToast('success', 'Project created');
    } catch (err) {
      pushToast('error', err.message || 'Project create failed');
    }
  };

  const openProjectDeleteModal = (project) => {
    setProjectToDelete(project || null);
    setProjectDeleteNameInput('');
    setProjectDeleteModalOpen(true);
  };

  const closeProjectDeleteModal = () => {
    setProjectDeleteModalOpen(false);
    setProjectToDelete(null);
    setProjectDeleteNameInput('');
    setDeletingProject(false);
  };

  const confirmDeleteProject = async () => {
    const target = projectToDelete;
    if (!target?._id) return;
    const expectedName = String(target.name || '').trim();
    if (projectDeleteNameInput.trim() !== expectedName) {
      pushToast('error', 'Project name mismatch');
      return;
    }

    setDeletingProject(true);
    try {
      await apiFetch(`/api/projects/${target._id}`, { method: 'DELETE' });
      const deletedProjectId = String(target._id);

      setProjects((prev) => prev.filter((item) => String(item._id) !== deletedProjectId));
      setAllApis((prev) => prev.filter((item) => String(item.project_id || '') !== deletedProjectId));
      setApis((prev) => prev.filter((item) => String(item.project_id || '') !== deletedProjectId));
      setGlobalHistory((prev) => prev.filter((item) => String(item.project_id || '') !== deletedProjectId));
      setSelectedHistoryIds([]);

      if (selectedProjectId === deletedProjectId) {
        setSelectedProjectId('');
        setSelectedApiId('');
        setApiName('');
        setApiDescription('');
        setMethod('GET');
        setEndpoint('/');
        setHeadersText('Content-Type: application/json');
        setParamsText('');
        setBodyText('');
        setBodyMode('raw');
        setRequestEditorTab('params');
        setFormFiles([]);
        setFormFileInput(null);
        setAuthType('no_auth');
        setAuthToken('');
        setResponseData(null);
        setHistory([]);
        setLatestCurl('');
      }
      if (currentShareProjectId === deletedProjectId) {
        setSharingProjectId('');
      }

      closeProjectDeleteModal();
      pushToast('success', 'Project deleted');
    } catch (err) {
      pushToast('error', err.message || 'Project delete failed');
      setDeletingProject(false);
    }
  };

  const saveApi = async () => {
    if (!selectedProjectId) {
      pushToast('error', 'Select a project first');
      return;
    }
    if (!apiName.trim()) {
      pushToast('error', 'API name is required');
      return;
    }
    setSavingApi(true);
    const payload = {
      name: apiName,
      method,
      endpoint,
      headers: parseHeaderLines(headersText),
      query_params: parseQueryParamLines(paramsText),
      body: bodyMode === 'form-data' ? parseFormDataLines(bodyText) : bodyText,
      body_mode: bodyMode,
      description: apiDescription,
      auth: { type: authType, token: authToken }
    };
    try {
      if (selectedApiId) {
        const updated = await apiFetch(`/api/apis/${selectedApiId}`, {
          method: 'PUT',
          body: JSON.stringify(payload)
        });
        setApis((prev) => prev.map((item) => (String(item._id) === selectedApiId ? updated : item)));
        pushToast('success', 'API updated');
      } else {
        const created = await apiFetch(`/api/projects/${selectedProjectId}/apis`, {
          method: 'POST',
          body: JSON.stringify(payload)
        });
        setApis((prev) => [created, ...prev]);
        setSelectedApiId(String(created._id));
        pushToast('success', 'API saved');
      }
    } catch (err) {
      pushToast('error', err.message);
    } finally {
      setSavingApi(false);
    }
  };

  const inviteCollaborator = async () => {
    if (!currentShareProjectId) {
      pushToast('error', 'Select a project first');
      return;
    }
    if (collaboratorApiMissing) {
      pushToast('error', 'Collaborator management is unavailable on the active backend.');
      return;
    }

    const email = collaboratorEmailInput.trim();
    if (!email) {
      pushToast('error', 'Collaborator email is required');
      return;
    }

    try {
      const res = await fetch(`${API_BASE_URL}/api/projects/${currentShareProjectId}/collaborators`, {
        method: 'POST',
        credentials: 'include',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email })
      });
      const data = await res.json().catch(() => ({}));

      if (!res.ok) {
        pushToast('error', data.error || 'Collaborator add failed');
        return;
      }

      const invited = data?.collaborator;
      if (invited) {
        setCollaborators((prev) => {
          const exists = prev.some((item) => String(item.user_id) === String(invited.user_id));
          if (exists) return prev;
          return [...prev, invited];
        });
        setProjects((prev) => prev.map((project) => {
          if (String(project._id) !== String(currentShareProjectId)) return project;
          const currentIds = Array.isArray(project.collaborator_ids) ? project.collaborator_ids.map(String) : [];
          if (currentIds.includes(String(invited.user_id))) return project;
          return { ...project, collaborator_ids: [...currentIds, String(invited.user_id)] };
        }));
      }
      setCollaboratorEmailInput('');
      // Show success toast always
      pushToast('success', data?.message || 'Collaborator added');
      // If backend also returns a warning (like email failed), show warning toast
      if (data?.details && typeof data.details === 'string' && data.message && data.message.toLowerCase().includes('email')) {
        pushToast('warning', data.details);
      }
    } catch (err) {
      pushToast('error', err.message || 'Collaborator add failed');
    }
  };

  const removeCollaborator = async (collaboratorUserId) => {
    if (!currentShareProjectId || !collaboratorUserId) return;
    if (collaboratorApiMissing) {
      pushToast('error', 'Collaborator management is unavailable on the active backend.');
      return;
    }
    if (!window.confirm('Remove this collaborator from project?')) return;

    try {
      await apiFetch(`/api/projects/${currentShareProjectId}/collaborators/${collaboratorUserId}`, {
        method: 'DELETE'
      });
      setCollaborators((prev) => prev.filter((item) => String(item.user_id) !== String(collaboratorUserId)));
      setProjects((prev) => prev.map((project) => {
        if (String(project._id) !== String(currentShareProjectId)) return project;
        const currentIds = Array.isArray(project.collaborator_ids) ? project.collaborator_ids.map(String) : [];
        return { ...project, collaborator_ids: currentIds.filter((id) => id !== String(collaboratorUserId)) };
      }));
      pushToast('success', 'Collaborator removed');
    } catch (err) {
      pushToast('error', err.message || 'Collaborator remove failed');
    }
  };

  const runApi = async () => {
    setLoadingRun(true);
    if (paramsText.trim().startsWith('{') || paramsText.trim().startsWith('[')) {
      pushToast('error', 'Params field me key:value daalo. Raw JSON Body field me daalo.');
    }
    try {
      const encodedFormFiles = bodyMode === 'form-data' ? await serializeFormFiles() : [];
      let data;
      if (selectedApiId) {
        data = await apiFetch(`/api/apis/${selectedApiId}/run`, {
          method: 'POST',
          body: JSON.stringify({
            method,
            endpoint: fullUrl,
            headers: parseHeaderLines(headersText),
            body: bodyMode === 'form-data' ? parseFormDataLines(bodyText) : bodyText,
            body_mode: bodyMode,
            form_files: encodedFormFiles
          })
        });
        await loadHistory(selectedApiId);
      } else {
        data = await apiFetch('/api/proxy-request', {
          method: 'POST',
          body: JSON.stringify({
            method,
            url: fullUrl,
            headers: parseHeaderLines(headersText),
            body: bodyMode === 'form-data' ? parseFormDataLines(bodyText) : bodyText,
            body_mode: bodyMode,
            form_files: encodedFormFiles
          })
        });
      }
      await loadGlobalHistory();
      setResponseData(data);
      setResponseTab('body');
      pushToast('success', `API ran successfully (${data.status})`);
    } catch (err) {
      pushToast('error', err.message);
    } finally {
      setLoadingRun(false);
    }
  };

  const runCurl = async () => {
    const parsed = parseCurl(curlInput);
    if (!parsed.url) {
      pushToast('error', 'Invalid cURL command');
      return;
    }
    setMethod(parsed.method);
    setEndpoint(parsed.url);
    setHeadersText(toLines(parsed.headers));
    setBodyMode(parsed.bodyMode || 'raw');
    setRequestEditorTab(parsed.bodyMode || 'raw');
    setBodyText(parsed.body);
    setFormFiles([]);
    setFormFileInput(null);
    setMode('request');
    pushToast('success', 'cURL converted to request builder');
  };

  const exportProject = (format) => {
    const projectId = exportProjectId || selectedProjectId;
    if (!projectId) {
      pushToast('error', 'Select a project first');
      return;
    }
    window.open(`${API_BASE_URL}/api/projects/${projectId}/export?format=${format}`, '_blank');
    pushToast('success', `Export started (${format.toUpperCase()})`);
  };

  const downloadTextFile = (content, filename, mimeType = 'text/plain;charset=utf-8') => {
    const blob = new Blob([content], { type: mimeType });
    const url = URL.createObjectURL(blob);
    const anchor = document.createElement('a');
    anchor.href = url;
    anchor.download = filename;
    document.body.appendChild(anchor);
    anchor.click();
    document.body.removeChild(anchor);
    URL.revokeObjectURL(url);
  };

  const exportSavedApis = (format) => {
    const scoped = exportProjectId
      ? allApis.filter((item) => String(item.project_id) === String(exportProjectId))
      : allApis;
    const rows = exportApiId
      ? scoped.filter((item) => String(item._id) === String(exportApiId))
      : scoped;

    if (rows.length === 0) {
      pushToast('error', 'No APIs available for selected export scope');
      return;
    }

    if (format === 'excel') {
      const csvRows = [
        ['Project', 'API', 'Method', 'Endpoint', 'Description', 'Request Body', 'Response Body'].join(','),
        ...rows.map((item) => [
          `"${(item.project_name || '').replace(/"/g, '""')}"`,
          `"${(item.name || '').replace(/"/g, '""')}"`,
          `"${(item.method || '').replace(/"/g, '""')}"`,
          `"${(item.endpoint || '').replace(/"/g, '""')}"`,
          `"${(item.description || '').replace(/"/g, '""')}"`,
          `"${toPretty(item.body || '').replace(/"/g, '""')}"`,
          `"${toPretty(item.last_response_body || item.response_example || '').replace(/"/g, '""')}"`
        ].join(','))
      ];
      downloadTextFile(csvRows.join('\n'), 'saved_apis_export.csv', 'text/csv;charset=utf-8');
      pushToast('success', 'Saved APIs exported (Excel/CSV)');
      return;
    }

    const lines = [
      'Saved APIs Export',
      '',
      ...rows.map((item) =>
        `Project: ${item.project_name || '-'}\nAPI: ${item.name || '-'}\nMethod: ${item.method || '-'}\nEndpoint: ${item.endpoint || '-'}\nDescription: ${item.description || '-'}\nRequest Body: ${toPretty(item.body || '')}\nResponse Body: ${toPretty(item.last_response_body || item.response_example || '')}\n`
      )
    ];
    downloadTextFile(lines.join('\n'), 'saved_apis_export.txt');
    pushToast('success', 'Saved APIs exported (PDF text)');
  };

  const toggleHistorySelection = (id) => {
    const key = String(id);
    setSelectedHistoryIds((prev) =>
      prev.includes(key) ? prev.filter((item) => item !== key) : [...prev, key]
    );
  };

  const exportHistorySelection = (format) => {
    const rows = globalHistory.filter((item) => selectedHistoryIds.includes(String(item._id)));
    if (rows.length === 0) {
      pushToast('error', 'Select at least one history row');
      return;
    }

    if (format === 'excel') {
      const csvRows = [
        ['Hit At', 'Project ID', 'API Name', 'Method', 'URL', 'Status', 'Response Time(ms)', 'Source', 'Request Body', 'Response Body'].join(','),
        ...rows.map((item) => [
          `"${new Date(item.created_at).toLocaleString().replace(/"/g, '""')}"`,
          `"${String(item.project_id || '').replace(/"/g, '""')}"`,
          `"${String(item.api_name || '').replace(/"/g, '""')}"`,
          `"${String(item.method || '').replace(/"/g, '""')}"`,
          `"${String(item.url || '').replace(/"/g, '""')}"`,
          `"${String(item.status ?? '').replace(/"/g, '""')}"`,
          `"${String(item.response_time ?? '').replace(/"/g, '""')}"`,
          `"${String(item.source || '').replace(/"/g, '""')}"`,
          `"${toPretty(item.request_body || '').replace(/"/g, '""')}"`,
          `"${toPretty(item.response_body || '').replace(/"/g, '""')}"`
        ].join(','))
      ];
      downloadTextFile(csvRows.join('\n'), 'history_export.csv', 'text/csv;charset=utf-8');
      pushToast('success', 'History exported (Excel/CSV)');
      return;
    }

    const lines = [
      'History Export',
      '',
      ...rows.map((item) =>
        `Time: ${new Date(item.created_at).toLocaleString()}\nAPI: ${item.api_name || '-'}\nMethod: ${item.method || '-'}\nURL: ${item.url || '-'}\nStatus: ${item.status ?? '-'}\nTime(ms): ${item.response_time ?? '-'}\nSource: ${item.source || '-'}\nRequest Body: ${toPretty(item.request_body || '')}\nResponse Body: ${toPretty(item.response_body || '')}\n`
      )
    ];
    downloadTextFile(lines.join('\n'), 'history_export.txt');
    pushToast('success', 'History exported (PDF text)');
  };

  const topStats = [
    { label: 'Projects', value: projects.length },
    { label: 'APIs', value: apis.length },
    { label: 'History', value: globalHistory.length }
  ];

  const responsePreviewText = responseData
    ? responseTab === 'body'
      ? toPretty(responseData.body)
      : responseTab === 'headers'
        ? toPretty(responseData.headers)
        : toPretty(responseData)
    : 'Run API to see response';

  return (
    <div className="min-h-screen bg-slate-100 dark:bg-slate-950 text-slate-900 dark:text-slate-100">
      <div
        className="grid min-h-screen transition-all duration-200"
        style={{ gridTemplateColumns: sidebarCollapsed ? '76px 1fr' : '260px 1fr' }}
      >
        <aside className="p-4 bg-white border-r dark:bg-slate-900 border-slate-200 dark:border-slate-800">
          <div className={`flex items-center ${sidebarCollapsed ? 'justify-center' : 'gap-2'} px-3 py-2 mb-4`}>
            <div className="flex items-center justify-center text-white bg-indigo-600 rounded-lg w-9 h-9">
              <DocumentTextIcon className="w-5 h-5" />
            </div>
            {!sidebarCollapsed ? <div className="text-lg font-bold">API Tracker</div> : null}
          </div>
          <nav className="space-y-1">
            {SIDEBAR_ITEMS.map((item) => (
              <button
                key={item}
                onClick={() => setActiveNav(item)}
                title={item}
                className={`w-full ${sidebarCollapsed ? 'text-center px-1' : 'text-left px-3'} py-2 rounded-lg text-sm ${
                  activeNav === item ? 'bg-indigo-600 text-white' : 'hover:bg-slate-100 dark:hover:bg-slate-800'
                }`}
              >
                {sidebarCollapsed ? item.charAt(0) : item}
              </button>
            ))}
          </nav>
          {!sidebarCollapsed ? (
            <div className="p-3 mt-6 border rounded-xl bg-slate-50 dark:bg-slate-800 border-slate-200 dark:border-slate-700">
              <div className="mb-2 text-xs uppercase text-slate-500">Quick Stats</div>
              <div className="space-y-1 text-sm">
                {topStats.map((s) => <div key={s.label}>{s.label}: <b>{s.value}</b></div>)}
              </div>
            </div>
          ) : null}
        </aside>

        <section className="flex flex-col min-w-0">
          <header className="flex items-center justify-between h-16 px-5 bg-white border-b dark:bg-slate-900 border-slate-200 dark:border-slate-800">
            <div className="flex items-center min-w-0 gap-3">
              <button
                onClick={() => setSidebarCollapsed((prev) => !prev)}
                title={sidebarCollapsed ? 'Expand sidebar' : 'Collapse sidebar'}
                className="p-2 rounded-lg bg-slate-100 dark:bg-slate-800"
              >
                <Bars3Icon className="w-5 h-5" />
              </button>
              <select
                value={selectedProjectId}
                onChange={(e) => setSelectedProjectId(e.target.value)}
                className="bg-slate-100 dark:bg-slate-800 rounded-lg px-3 py-2 text-sm min-w-[220px]"
              >
                <option value="">Select Project</option>
                {projects.map((project) => (
                  <option key={String(project._id)} value={String(project._id)}>{project.name}</option>
                ))}
              </select>
              <div className="flex items-center gap-2 px-3 py-2 rounded-lg bg-slate-100 dark:bg-slate-800">
                <MagnifyingGlassIcon className="w-4 h-4" />
                <input
                  value={searchApi}
                  onChange={(e) => setSearchApi(e.target.value)}
                  placeholder="Search API"
                  className="text-sm bg-transparent outline-none w-44"
                />
              </div>
            </div>
            <div className="flex items-center gap-3">
              <button
                onClick={() => setIsDark((prev) => !prev)}
                title={isDark ? 'Switch to light' : 'Switch to dark'}
                className="flex items-center gap-2 px-3 py-2 text-sm border rounded-lg border-slate-300 dark:border-slate-700"
              >
                {isDark ? <SunIcon className="w-4 h-4" /> : <MoonIcon className="w-4 h-4" />}
                {isDark ? 'Light' : 'Dark'}
              </button>
              <button onClick={() => setProjectModalOpen(true)} className="flex items-center gap-1 px-3 py-2 text-sm text-white bg-indigo-600 rounded-lg">
                <PlusIcon className="w-4 h-4" /> New Project
              </button>
              <div className="relative" ref={profileMenuRef}>
                <button
                  onClick={() => setProfileMenuOpen((prev) => !prev)}
                  className="flex items-center gap-2 px-3 py-2 text-sm border rounded-lg border-slate-300 dark:border-slate-700"
                >
                  <UserCircleIcon className="w-4 h-4" /> Profile
                </button>
                {profileMenuOpen && (
                  <div className="absolute right-0 z-20 mt-2 overflow-hidden bg-white border rounded-lg shadow-lg w-44 border-slate-200 dark:border-slate-700 dark:bg-slate-900">
                    <button
                      onClick={() => {
                        setActiveNav('Settings');
                        setProfileMenuOpen(false);
                      }}
                      className="w-full px-3 py-2 text-sm text-left hover:bg-slate-100 dark:hover:bg-slate-800"
                    >
                      Settings
                    </button>
                    <button
                      onClick={() => {
                        setProfileMenuOpen(false);
                        logout();
                      }}
                      className="w-full px-3 py-2 text-sm text-left text-rose-700 hover:bg-rose-50 dark:hover:bg-rose-900/30"
                    >
                      Logout
                    </button>
                  </div>
                )}
              </div>
            </div>
          </header>

          <main className="flex-1 min-h-0 p-5 overflow-auto">
            {activeNav === 'Projects' && (
              <section className="p-5 bg-white border dark:bg-slate-900 rounded-2xl border-slate-200 dark:border-slate-800">
                <div className="flex items-center justify-between mb-4">
                  <h2 className="text-xl font-bold">Projects</h2>
                  <button onClick={() => setProjectModalOpen(true)} className="px-3 py-2 text-sm text-white bg-indigo-600 rounded-lg">+ New Project</button>
                </div>
                <div className="grid gap-3 md:grid-cols-2">
                  {projects.map((project) => (
                    <div
                      key={String(project._id)}
                      className={`text-left p-4 rounded-xl border hover:border-indigo-400 ${
                        String(project._id) === currentShareProjectId
                          ? 'border-indigo-500 bg-indigo-50/70 dark:bg-indigo-950/30'
                          : 'border-slate-200 dark:border-slate-700'
                      }`}
                    >
                      <div className="flex items-center justify-between gap-3">
                        <div className="min-w-0">
                          <div className="flex items-center gap-2 font-semibold">
                            {project.name}
                            <span className={`text-[10px] px-2 py-0.5 rounded-full ${
                              String(project.user_id || '') === currentUserDbId
                                ? 'bg-emerald-100 text-emerald-700'
                                : 'bg-amber-100 text-amber-700'
                            }`}>
                              {String(project.user_id || '') === currentUserDbId ? 'Owner' : 'Shared'}
                            </span>
                          </div>
                          <div className="mt-1 text-sm truncate text-slate-500">{project.base_url || '-'}</div>
                          <div className="mt-1 text-xs text-slate-500">
                            {(Array.isArray(project.collaborator_ids) ? project.collaborator_ids.length : 0)} collaborator(s)
                          </div>
                        </div>
                        <div className="flex items-center gap-2 shrink-0">
                          <button
                            onClick={() => {
                              setSelectedProjectId(String(project._id));
                              setSharingProjectId(String(project._id));
                              setActiveNav('Projects');
                            }}
                            className="px-3 py-1.5 rounded bg-slate-100 dark:bg-slate-800 text-xs"
                          >
                            Share
                          </button>
                          <button
                            onClick={() => {
                              setSelectedProjectId(String(project._id));
                              setSharingProjectId(String(project._id));
                              setActiveNav('Workspace');
                              pushToast('success', 'Project opened in workspace');
                            }}
                            className="px-3 py-1.5 rounded bg-indigo-600 text-white text-xs"
                          >
                            Go to Workspace
                          </button>
                          {String(project.user_id || '') === currentUserDbId && (
                            <button
                              onClick={() => openProjectDeleteModal(project)}
                              className="px-3 py-1.5 rounded bg-rose-100 text-rose-700 text-xs hover:bg-rose-200"
                            >
                              Delete
                            </button>
                          )}
                        </div>
                      </div>
                    </div>
                  ))}
                </div>

                <div className="p-4 mt-6 border rounded-xl border-slate-200 dark:border-slate-700">
                  <div className="flex flex-wrap items-center justify-between gap-3 mb-3">
                    <div>
                      <h3 className="font-semibold">Project Sharing</h3>
                      <p className="text-sm text-slate-500">
                        {shareProject
                          ? `${shareProject.name} (${canManageCollaborators ? 'Owner Access' : 'Collaborator Access'})`
                          : 'Select a project to manage collaborators'}
                      </p>
                    </div>
                    <select
                      value={currentShareProjectId}
                      onChange={(e) => setSharingProjectId(e.target.value)}
                      className="px-3 py-2 text-sm bg-white border rounded-lg border-slate-300 dark:border-slate-700 dark:bg-slate-900"
                    >
                      <option value="">Choose project</option>
                      {projects.map((project) => (
                        <option key={String(project._id)} value={String(project._id)}>
                          {project.name}
                        </option>
                      ))}
                    </select>
                  </div>

                  {shareProject && (
                    <>
                      {collaboratorApiMissing && (
                        <div className="px-3 py-2 mb-3 text-xs border rounded-lg border-amber-200 bg-amber-50 text-amber-800">
                          Collaborator endpoints are not available on this backend build. Update/restart backend to enable add/remove.
                        </div>
                      )}
                      <div className="flex flex-wrap gap-2 mb-4">
                        <input
                          type="email"
                          value={collaboratorEmailInput}
                          onChange={(e) => setCollaboratorEmailInput(e.target.value)}
                          disabled={!canMutateCollaborators}
                          placeholder="Collaborator email"
                          className="flex-1 min-w-[220px] rounded-lg border border-slate-300 dark:border-slate-700 bg-slate-50 dark:bg-slate-800 px-3 py-2 text-sm disabled:opacity-60"
                        />
                        <button
                          onClick={inviteCollaborator}
                          disabled={!canMutateCollaborators}
                          className="px-3 py-2 text-sm text-white bg-indigo-600 rounded-lg disabled:opacity-60"
                        >
                          Add by Email
                        </button>
                      </div>

                      {loadingCollaborators ? (
                        <div className="text-sm text-slate-500">Loading collaborators...</div>
                      ) : (
                        <div className="space-y-2">
                          {collaborators.length === 0 ? (
                            <div className="text-sm text-slate-500">No collaborators yet.</div>
                          ) : (
                            collaborators.map((entry) => (
                              <div key={String(entry.user_id)} className="flex items-center justify-between gap-3 p-3 border rounded-lg border-slate-200 dark:border-slate-700">
                                <div className="min-w-0">
                                  <div className="font-medium truncate">{entry.name || entry.email || entry.user_id}</div>
                                  <div className="text-xs truncate text-slate-500">{entry.email || '-'}</div>
                                </div>
                                <div className="flex items-center gap-2 shrink-0">
                                  <span className={`text-[11px] px-2 py-0.5 rounded-full ${
                                    entry.role === 'owner' ? 'bg-emerald-100 text-emerald-700' : 'bg-slate-100 text-slate-700'
                                  }`}>
                                    {entry.role}
                                  </span>
                                  {canMutateCollaborators && entry.role !== 'owner' && (
                                    <button
                                      onClick={() => removeCollaborator(entry.user_id)}
                                      className="px-2.5 py-1 rounded bg-rose-100 text-rose-700 text-xs hover:bg-rose-200"
                                    >
                                      Remove
                                    </button>
                                  )}
                                </div>
                              </div>
                            ))
                          )}
                        </div>
                      )}
                    </>
                  )}
                </div>
              </section>
            )}

            {activeNav === 'Workspace' && (
              <section className="grid xl:grid-cols-[280px_1fr_420px] gap-4 min-h-[70vh]">
                <div className="p-4 bg-white border dark:bg-slate-900 rounded-2xl border-slate-200 dark:border-slate-800">
                  <div className="flex items-center justify-between mb-3">
                    <h3 className="font-bold">API List</h3>
                    <button
                      onClick={() => {
                        setSelectedApiId('');
                        setApiName('');
                        setApiDescription('');
                        setMethod('GET');
                        setEndpoint('/');
                        setHeadersText('Content-Type: application/json');
                        setParamsText('');
                        setBodyText('');
                        setBodyMode('raw');
                        setRequestEditorTab('params');
                      }}
                      className="px-2 py-1 text-xs rounded bg-slate-100 dark:bg-slate-800"
                    >
                      + Add API
                    </button>
                  </div>
                  <div className="space-y-2 max-h-[70vh] overflow-auto">
                    {filteredApis.map((api) => (
                      <button
                        key={String(api._id)}
                        onClick={() => selectApi(api)}
                        className={`w-full text-left p-3 rounded-lg border ${
                          String(api._id) === selectedApiId
                            ? 'border-indigo-500 bg-indigo-50 dark:bg-indigo-950/40'
                            : 'border-slate-200 dark:border-slate-700'
                        }`}
                      >
                        <div className="text-xs font-bold text-indigo-600">{api.method}</div>
                        <div className="text-sm font-medium truncate">{api.endpoint}</div>
                        <div className="text-xs truncate text-slate-500">{api.name}</div>
                      </button>
                    ))}
                  </div>
                </div>

                <div className="p-4 bg-white border dark:bg-slate-900 rounded-2xl border-slate-200 dark:border-slate-800">
                  <div className="flex items-center justify-between mb-3">
                    <div className="flex gap-2">
                      <button className={`px-3 py-1.5 rounded text-sm ${mode === 'request' ? 'bg-indigo-600 text-white' : 'bg-slate-100 dark:bg-slate-800'}`} onClick={() => setMode('request')}>
                        Request Builder
                      </button>
                      <button className={`px-3 py-1.5 rounded text-sm ${mode === 'curl' ? 'bg-indigo-600 text-white' : 'bg-slate-100 dark:bg-slate-800'}`} onClick={() => setMode('curl')}>
                        cURL Runner
                      </button>
                    </div>
                    <div className="text-sm text-slate-500">{selectedProject?.name || 'No Project Selected'}</div>
                  </div>

                  {mode === 'curl' ? (
                    <div className="space-y-3">
                      <textarea
                        value={curlInput}
                        onChange={(e) => setCurlInput(e.target.value)}
                        placeholder={`curl -X POST https://api.example.com\n-H "Content-Type: application/json"\n-d '{"amount":1000}'`}
                        className="w-full p-3 font-mono text-sm border h-52 rounded-xl border-slate-300 dark:border-slate-700 bg-slate-50 dark:bg-slate-950"
                      />
                      <div className="flex gap-2">
                        <button onClick={runCurl} className="px-3 py-2 text-sm text-white bg-indigo-600 rounded-lg">Convert to Request Builder</button>
                        <button
                          onClick={() => {
                            navigator.clipboard.writeText(generatedCurl);
                            pushToast('success', 'cURL copied');
                          }}
                          className="px-3 py-2 text-sm rounded-lg bg-slate-100 dark:bg-slate-800"
                        >
                          Copy Latest cURL
                        </button>
                      </div>
                    </div>
                  ) : (
                    <div className="space-y-3">
                      <div className="grid grid-cols-[100px_1fr] gap-2">
                        <select value={method} onChange={(e) => setMethod(e.target.value)} className="px-2 py-2 rounded-lg bg-slate-100 dark:bg-slate-800">
                          {METHODS.map((m) => <option key={m} value={m}>{m}</option>)}
                        </select>
                        <input value={endpoint} onChange={(e) => setEndpoint(e.target.value)} className="px-3 py-2 rounded-lg bg-slate-100 dark:bg-slate-800" />
                      </div>
                      <input value={apiName} onChange={(e) => setApiName(e.target.value)} placeholder="API Name" className="w-full px-3 py-2 rounded-lg bg-slate-100 dark:bg-slate-800" />
                      <input value={apiDescription} onChange={(e) => setApiDescription(e.target.value)} placeholder="Description" className="w-full px-3 py-2 rounded-lg bg-slate-100 dark:bg-slate-800" />
                      <div>
                        <div className="flex items-center justify-between gap-2 mb-1 text-xs font-semibold text-slate-600 dark:text-slate-300">
                          <div className="inline-flex rounded bg-slate-100 dark:bg-slate-800 p-0.5">
                            {['params', 'headers', 'raw', 'form-data'].map((tab) => (
                              <button
                                key={tab}
                                onClick={() => {
                                  setRequestEditorTab(tab);
                                  if (tab === 'raw' || tab === 'form-data') {
                                    setBodyMode(tab);
                                  }
                                }}
                                className={`px-2 py-1 rounded text-[11px] ${
                                  requestEditorTab === tab
                                    ? 'bg-white dark:bg-slate-900 shadow text-indigo-700 dark:text-indigo-300'
                                    : 'text-slate-700 dark:text-slate-200'
                                }`}
                              >
                                {tab === 'form-data' ? 'Form Data' : tab.charAt(0).toUpperCase() + tab.slice(1)}
                              </button>
                            ))}
                          </div>
                          <button
                            onClick={() => {
                              if (requestEditorTab === 'params') copyToClipboard(paramsText || '', 'Params');
                              else if (requestEditorTab === 'headers') copyToClipboard(headersText || '', 'Headers');
                              else copyToClipboard(bodyText || '', 'Request body');
                            }}
                            title="Copy current editor value"
                            className="p-1 rounded bg-slate-100 text-slate-700 dark:bg-slate-800 dark:text-slate-200 hover:bg-slate-200 dark:hover:bg-slate-700"
                          >
                            <ClipboardDocumentIcon className="w-3.5 h-3.5" />
                          </button>
                        </div>
                        <div className="w-full overflow-hidden rounded-lg bg-slate-100 dark:bg-slate-800">
                          <textarea
                            value={requestEditorTab === 'params' ? paramsText : requestEditorTab === 'headers' ? headersText : bodyText}
                            onChange={(e) => {
                              if (requestEditorTab === 'params') setParamsText(e.target.value);
                              else if (requestEditorTab === 'headers') setHeadersText(e.target.value);
                              else setBodyText(e.target.value);
                            }}
                            placeholder={
                              requestEditorTab === 'params'
                                ? 'user_id: 12'
                                : requestEditorTab === 'headers'
                                  ? 'Content-Type: application/json'
                                  : requestEditorTab === 'form-data'
                                    ? 'name: aman\nemail: aman@example.com'
                                    : '{"amount":1000,"currency":"INR"}'
                            }
                            className="w-full px-3 py-2 font-mono text-xs bg-transparent outline-none h-36 text-slate-900 dark:text-slate-100 placeholder:text-slate-500 dark:placeholder:text-slate-400"
                          />
                          {requestEditorTab === 'form-data' && (
                            <div className="px-3 py-2 space-y-2 border-t border-slate-200 dark:border-slate-700">
                              <div className="text-[11px] font-semibold">File Upload Test (not stored)</div>
                              <div className="grid md:grid-cols-[160px_1fr_auto] gap-2">
                                <input
                                  value={formFileKeyInput}
                                  onChange={(e) => setFormFileKeyInput(e.target.value)}
                                  placeholder="file field key"
                                  className="rounded px-2 py-1.5 bg-white text-slate-900 dark:bg-slate-900 dark:text-slate-100 text-xs placeholder:text-slate-500 dark:placeholder:text-slate-400"
                                />
                                <input
                                  type="file"
                                  onChange={(e) => setFormFileInput(e.target.files?.[0] || null)}
                                  className="rounded px-2 py-1.5 bg-white text-slate-900 dark:bg-slate-900 dark:text-slate-100 text-xs"
                                />
                                <button
                                  onClick={() => {
                                    const key = formFileKeyInput.trim();
                                    if (!key || !formFileInput) {
                                      pushToast('error', 'File key aur file dono select karo');
                                      return;
                                    }
                                    setFormFiles((prev) => {
                                      const withoutSameKey = prev.filter((item) => item.key !== key);
                                      return [...withoutSameKey, { key, file: formFileInput }];
                                    });
                                    setFormFileInput(null);
                                    pushToast('success', 'File attached for test run');
                                  }}
                                  className="px-2 py-1.5 rounded bg-white text-slate-800 dark:bg-slate-900 dark:text-slate-100 text-xs"
                                >
                                  Add File
                                </button>
                              </div>
                              <div className="space-y-1">
                                {formFiles.length === 0 ? (
                                  <div className="text-[11px] text-slate-600 dark:text-slate-300">No files attached.</div>
                                ) : formFiles.map((item, index) => (
                                  <div key={`${item.key}-${index}`} className="flex items-center justify-between text-[11px] rounded bg-white text-slate-900 dark:bg-slate-900 dark:text-slate-100 px-2 py-1">
                                    <span>{item.key}: [file] {item.file?.name || 'unknown'}</span>
                                    <button
                                      onClick={() => setFormFiles((prev) => prev.filter((_, i) => i !== index))}
                                      className="px-1.5 py-0.5 rounded bg-rose-100 text-rose-700"
                                    >
                                      Remove
                                    </button>
                                  </div>
                                ))}
                              </div>
                            </div>
                          )}
                          {requestEditorTab === 'raw' && bodyText.trim() && (
                            <div className="px-3 py-2 border-t border-slate-200 dark:border-slate-700">
                              <div className="text-[11px] font-semibold mb-1 text-slate-600 dark:text-slate-300">Raw Preview</div>
                              <pre
                                className="p-2 overflow-auto text-xs bg-white rounded text-slate-900 dark:bg-slate-900 dark:text-slate-100"
                                dangerouslySetInnerHTML={{ __html: highlightJsonLike(bodyText, isDark) }}
                              />
                            </div>
                          )}
                        </div>
                      </div>
                      <div className="grid grid-cols-2 gap-2">
                        <select value={authType} onChange={(e) => setAuthType(e.target.value)} className="px-2 py-2 rounded-lg bg-slate-100 text-slate-900 dark:bg-slate-800 dark:text-slate-100">
                          <option value="no_auth">No Auth</option>
                          <option value="bearer">Bearer Token</option>
                          <option value="basic">Basic Auth</option>
                          <option value="api_key">API Key</option>
                        </select>
                        <input value={authToken} onChange={(e) => setAuthToken(e.target.value)} placeholder="Auth token / key" className="px-2 py-2 rounded-lg bg-slate-100 text-slate-900 dark:bg-slate-800 dark:text-slate-100 placeholder:text-slate-500 dark:placeholder:text-slate-400" />
                      </div>
                      <div className="flex flex-wrap gap-2">
                        <button onClick={runApi} disabled={loadingRun} className="flex items-center gap-1 px-3 py-2 text-sm text-white rounded-lg bg-emerald-600">
                          <RocketLaunchIcon className="w-4 h-4" /> {loadingRun ? 'Running...' : 'Run API'}
                        </button>
                        <button onClick={saveApi} disabled={savingApi} className="px-3 py-2 text-sm text-white bg-indigo-600 rounded-lg">{savingApi ? 'Saving...' : 'Save API'}</button>
                        <button
                          onClick={() => {
                            navigator.clipboard.writeText(generatedCurl);
                            pushToast('success', 'cURL generated and copied');
                          }}
                          className="px-3 py-2 text-sm rounded-lg bg-slate-100 dark:bg-slate-800"
                        >
                          Generate Curl
                        </button>
                        <button onClick={() => exportProject('excel')} className="px-3 py-2 text-sm rounded-lg bg-slate-100 dark:bg-slate-800">Export</button>
                      </div>
                      <pre
                        className="p-3 overflow-auto text-xs border rounded-xl bg-slate-100 text-slate-900 dark:bg-slate-950 dark:text-slate-100 border-slate-200 dark:border-slate-800"
                        dangerouslySetInnerHTML={{ __html: highlightCurl(generatedCurl, isDark) }}
                      />
                    </div>
                  )}
                </div>

                <div className="p-4 bg-white border dark:bg-slate-900 rounded-2xl border-slate-200 dark:border-slate-800">
                  <div className="flex items-center justify-between">
                    <h3 className="font-bold">Response Viewer</h3>
                    <div className="flex items-center gap-2">
                      {responseData ? <div className="text-sm">{responseData.status} | {responseData.durationMs}ms</div> : null}
                      <button
                        onClick={() => copyToClipboard(responseData?.body || '', 'Response body')}
                        disabled={!responseData}
                        title="Copy response body"
                        className={`p-1.5 rounded ${
                          responseData ? 'bg-slate-100 dark:bg-slate-800 hover:bg-slate-200 dark:hover:bg-slate-700' : 'bg-slate-100 dark:bg-slate-800 opacity-50 cursor-not-allowed'
                        }`}
                      >
                        <ClipboardDocumentIcon className="w-4 h-4" />
                      </button>
                    </div>
                  </div>
                  <div className="flex gap-2 mt-3">
                    {['body', 'headers', 'raw'].map((tab) => (
                      <button
                        key={tab}
                        onClick={() => setResponseTab(tab)}
                        className={`px-3 py-1.5 rounded text-xs uppercase ${
                          responseTab === tab
                            ? 'bg-indigo-600 text-white'
                            : 'bg-slate-100 text-slate-700 dark:bg-slate-800 dark:text-slate-200'
                        }`}
                      >
                        {tab}
                      </button>
                    ))}
                  </div>
                  <pre
                    className="p-3 mt-3 overflow-auto text-xs border rounded-xl h-72 bg-slate-100 text-slate-900 dark:bg-slate-950 dark:text-slate-100 border-slate-200 dark:border-slate-800"
                    dangerouslySetInnerHTML={{
                      __html: highlightJsonLike(responsePreviewText, isDark)
                    }}
                  />
                  <div className="mt-4">
                    <h4 className="mb-2 text-sm font-semibold">Latest cURL</h4>
                    <pre
                      className="h-24 p-3 overflow-auto text-xs border bg-slate-100 text-slate-900 dark:bg-slate-800 dark:text-slate-100 rounded-xl border-slate-200 dark:border-slate-700"
                      dangerouslySetInnerHTML={{ __html: highlightCurl(latestCurl || 'No run history yet', isDark) }}
                    />
                  </div>
                </div>
              </section>
            )}

            {activeNav === 'History' && (
              <section className="p-5 bg-white border dark:bg-slate-900 rounded-2xl border-slate-200 dark:border-slate-800">
                <div className="flex items-center justify-between mb-4">
                  <h2 className="text-xl font-bold">API History</h2>
                  <button onClick={loadGlobalHistory} className="px-3 py-2 text-sm rounded-lg bg-slate-100 dark:bg-slate-800">
                    Refresh
                  </button>
                </div>
                <div className="overflow-x-auto border rounded-xl border-slate-200 dark:border-slate-700">
                  {globalHistory.length === 0 ? (
                    <div className="p-4 text-sm text-slate-500">No history available.</div>
                  ) : (
                    <table className="w-full text-sm">
                      <thead className="bg-slate-50 dark:bg-slate-800">
                        <tr>
                          <th className="px-3 py-2 font-semibold text-left">Hit At</th>
                          <th className="px-3 py-2 font-semibold text-left">API</th>
                          <th className="px-3 py-2 font-semibold text-left">Method</th>
                          <th className="px-3 py-2 font-semibold text-left">URL</th>
                          <th className="px-3 py-2 font-semibold text-left">Status</th>
                          <th className="px-3 py-2 font-semibold text-left">Time</th>
                          <th className="px-3 py-2 font-semibold text-left">Source</th>
                          <th className="px-3 py-2 font-semibold text-left">Request Body</th>
                          <th className="px-3 py-2 font-semibold text-left">Response Body</th>
                          <th className="px-3 py-2 font-semibold text-left">Action</th>
                        </tr>
                      </thead>
                      <tbody>
                        {globalHistory.map((item) => (
                          <tr key={String(item._id)} className="border-t border-slate-200 dark:border-slate-700">
                            <td className="px-3 py-2 whitespace-nowrap">
                              <ClockIcon className="inline w-4 h-4 mr-1" />
                              {new Date(item.created_at).toLocaleString()}
                            </td>
                            <td className="px-3 py-2">{item.api_name || '-'}</td>
                            <td className="px-3 py-2 font-semibold">{item.method || '-'}</td>
                            <td className="px-3 py-2 max-w-[420px] truncate" title={item.url || ''}>{item.url || '-'}</td>
                            <td className="px-3 py-2">
                              <span className={`px-2 py-1 rounded text-xs font-semibold ${
                                Number(item.status) >= 200 && Number(item.status) < 300
                                  ? 'bg-emerald-100 text-emerald-700'
                                  : 'bg-rose-100 text-rose-700'
                              }`}>
                                {item.status ?? '-'}
                              </span>
                            </td>
                            <td className="px-3 py-2">{item.response_time ?? '-'}ms</td>
                            <td className="px-3 py-2">{item.source || '-'}</td>
                            <td className="px-3 py-2 max-w-[260px]" title={toPretty(item.request_body || '')}>
                              <div className="flex items-start gap-2">
                                <span className="flex-1 truncate">{toPretty(item.request_body || '-')}</span>
                                <button
                                  onClick={() => copyToClipboard(item.request_body || '', 'Request body')}
                                  title="Copy request body"
                                  className="p-1 rounded bg-slate-100 dark:bg-slate-800 hover:bg-slate-200 dark:hover:bg-slate-700"
                                >
                                  <ClipboardDocumentIcon className="w-3.5 h-3.5" />
                                </button>
                              </div>
                            </td>
                            <td className="px-3 py-2 max-w-[260px]" title={toPretty(item.response_body || '')}>
                              <div className="flex items-start gap-2">
                                <span className="flex-1 truncate">{toPretty(item.response_body || '-')}</span>
                                <button
                                  onClick={() => copyToClipboard(item.response_body || '', 'Response body')}
                                  title="Copy response body"
                                  className="p-1 rounded bg-slate-100 dark:bg-slate-800 hover:bg-slate-200 dark:hover:bg-slate-700"
                                >
                                  <ClipboardDocumentIcon className="w-3.5 h-3.5" />
                                </button>
                              </div>
                            </td>
                            <td className="px-3 py-2">
                              <div className="flex items-center gap-2">
                                <button
                                  onClick={() => openApiFromHistory(item.api_id, item.project_id)}
                                  disabled={!item.api_id}
                                  className={`px-2 py-1 rounded text-xs ${
                                    item.api_id
                                      ? 'bg-slate-100 dark:bg-slate-800'
                                      : 'bg-slate-100 dark:bg-slate-800 opacity-50 cursor-not-allowed'
                                  }`}
                                >
                                  Open
                                </button>
                                <button
                                  onClick={() => deleteHistoryRow(item._id)}
                                  className="px-2 py-1 text-xs rounded bg-rose-100 text-rose-700 hover:bg-rose-200"
                                >
                                  Delete
                                </button>
                              </div>
                            </td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  )}
                </div>
              </section>
            )}

            {activeNav === 'Exports' && (
              <section className="p-5 bg-white border dark:bg-slate-900 rounded-2xl border-slate-200 dark:border-slate-800">
                <h2 className="mb-4 text-xl font-bold">Export Center</h2>

                <div className="inline-flex p-1 mb-4 rounded-lg bg-slate-100 dark:bg-slate-800">
                  {[
                    { key: 'project', label: 'Project List' },
                    { key: 'apis', label: 'Saved APIs' },
                    { key: 'history', label: 'History List' }
                  ].map((item) => (
                    <button
                      key={item.key}
                      onClick={() => setExportView(item.key)}
                      className={`px-3 py-1.5 rounded text-sm ${
                        exportView === item.key
                          ? 'bg-white dark:bg-slate-900 shadow text-indigo-700 dark:text-indigo-300'
                          : 'text-slate-600 dark:text-slate-300'
                      }`}
                    >
                      {item.label}
                    </button>
                  ))}
                </div>

                {exportView === 'project' && (
                  <div className="p-4 mb-4 border rounded-xl border-slate-200 dark:border-slate-700">
                    <h3 className="mb-2 font-semibold">Project List</h3>
                    <div className="flex flex-wrap items-center gap-2">
                      <select
                        value={exportProjectId}
                        onChange={(e) => setExportProjectId(e.target.value)}
                        className="rounded-lg px-3 py-2 bg-slate-100 dark:bg-slate-800 text-sm min-w-[260px]"
                      >
                        <option value="">All Projects</option>
                        {projects.map((project) => (
                          <option key={String(project._id)} value={String(project._id)}>
                            {project.name}
                          </option>
                        ))}
                      </select>
                      <button onClick={() => exportProject('excel')} className="flex items-center gap-2 px-4 py-2 text-sm text-white bg-indigo-600 rounded-lg">
                        <ArrowDownTrayIcon className="w-4 h-4" /> Project Excel
                      </button>
                      <button onClick={() => exportProject('pdf')} className="flex items-center gap-2 px-4 py-2 text-sm rounded-lg bg-slate-100 dark:bg-slate-800">
                        <ArrowDownTrayIcon className="w-4 h-4" /> Project PDF
                      </button>
                      <button onClick={() => exportProject('curl')} className="flex items-center gap-2 px-4 py-2 text-sm rounded-lg bg-slate-100 dark:bg-slate-800">
                        <ArrowDownTrayIcon className="w-4 h-4" /> Curl Collection
                      </button>
                    </div>
                  </div>
                )}

                {exportView === 'apis' && (
                  <div className="p-4 mb-4 border rounded-xl border-slate-200 dark:border-slate-700">
                    <div className="flex items-center justify-between mb-2">
                      <h3 className="font-semibold">Saved APIs (Full List)</h3>
                      <div className="flex gap-2">
                        <button onClick={() => exportSavedApis('excel')} className="px-3 py-2 text-sm text-white bg-indigo-600 rounded-lg">Export APIs Excel</button>
                        <button onClick={() => exportSavedApis('pdf')} className="px-3 py-2 text-sm rounded-lg bg-slate-100 dark:bg-slate-800">Export APIs PDF</button>
                      </div>
                    </div>
                    <div className="mb-2">
                      <select
                        value={exportApiId}
                        onChange={(e) => setExportApiId(e.target.value)}
                        className="rounded-lg px-3 py-2 bg-slate-100 dark:bg-slate-800 text-sm min-w-[300px]"
                      >
                        <option value="">All Saved APIs</option>
                        {allApis
                          .filter((item) => !exportProjectId || String(item.project_id) === String(exportProjectId))
                          .map((api) => (
                            <option key={String(api._id)} value={String(api._id)}>
                              [{api.project_name || '-'}] {api.method} {api.endpoint}
                            </option>
                          ))}
                      </select>
                    </div>
                    <div className="overflow-x-auto border rounded-lg border-slate-200 dark:border-slate-700 max-h-60">
                      <table className="w-full text-sm">
                        <thead className="bg-slate-50 dark:bg-slate-800">
                          <tr>
                            <th className="px-3 py-2 text-left">Project</th>
                            <th className="px-3 py-2 text-left">API</th>
                            <th className="px-3 py-2 text-left">Method</th>
                            <th className="px-3 py-2 text-left">Endpoint</th>
                            <th className="px-3 py-2 text-left">Request Body</th>
                            <th className="px-3 py-2 text-left">Response Body</th>
                          </tr>
                        </thead>
                        <tbody>
                          {allApis
                            .filter((item) => !exportProjectId || String(item.project_id) === String(exportProjectId))
                            .map((item) => (
                              <tr key={String(item._id)} className="border-t border-slate-200 dark:border-slate-700">
                                <td className="px-3 py-2">{item.project_name || '-'}</td>
                                <td className="px-3 py-2">{item.name || '-'}</td>
                                <td className="px-3 py-2">{item.method || '-'}</td>
                                <td className="px-3 py-2 max-w-[360px] truncate">{item.endpoint || '-'}</td>
                                <td className="px-3 py-2 max-w-[260px]" title={toPretty(item.body || '')}>
                                  <div className="flex items-start gap-2">
                                    <span className="flex-1 truncate">{toPretty(item.body || '-')}</span>
                                    <button
                                      onClick={() => copyToClipboard(item.body || '', 'Request body')}
                                      title="Copy request body"
                                      className="p-1 rounded bg-slate-100 dark:bg-slate-800 hover:bg-slate-200 dark:hover:bg-slate-700"
                                    >
                                      <ClipboardDocumentIcon className="w-3.5 h-3.5" />
                                    </button>
                                  </div>
                                </td>
                                <td className="px-3 py-2 max-w-[260px]" title={toPretty(item.last_response_body || item.response_example || '')}>
                                  <div className="flex items-start gap-2">
                                    <span className="flex-1 truncate">{toPretty(item.last_response_body || item.response_example || '-')}</span>
                                    <button
                                      onClick={() => copyToClipboard(item.last_response_body || item.response_example || '', 'Response body')}
                                      title="Copy response body"
                                      className="p-1 rounded bg-slate-100 dark:bg-slate-800 hover:bg-slate-200 dark:hover:bg-slate-700"
                                    >
                                      <ClipboardDocumentIcon className="w-3.5 h-3.5" />
                                    </button>
                                  </div>
                                </td>
                              </tr>
                            ))}
                        </tbody>
                      </table>
                    </div>
                  </div>
                )}

                {exportView === 'history' && (
                  <div className="p-4 border rounded-xl border-slate-200 dark:border-slate-700">
                    <div className="flex items-center justify-between mb-2">
                      <h3 className="font-semibold">History List (Select and Export)</h3>
                      <div className="flex gap-2">
                        <button onClick={() => exportHistorySelection('excel')} className="px-3 py-2 text-sm text-white bg-indigo-600 rounded-lg">Export History Excel</button>
                        <button onClick={() => exportHistorySelection('pdf')} className="px-3 py-2 text-sm rounded-lg bg-slate-100 dark:bg-slate-800">Export History PDF</button>
                      </div>
                    </div>
                    <div className="overflow-x-auto border rounded-lg border-slate-200 dark:border-slate-700 max-h-72">
                      <table className="w-full text-sm">
                        <thead className="bg-slate-50 dark:bg-slate-800">
                          <tr>
                            <th className="px-3 py-2 text-left">Select</th>
                            <th className="px-3 py-2 text-left">Time</th>
                            <th className="px-3 py-2 text-left">API</th>
                            <th className="px-3 py-2 text-left">Method</th>
                            <th className="px-3 py-2 text-left">Status</th>
                            <th className="px-3 py-2 text-left">URL</th>
                            <th className="px-3 py-2 text-left">Request Body</th>
                            <th className="px-3 py-2 text-left">Response Body</th>
                          </tr>
                        </thead>
                        <tbody>
                          {globalHistory
                            .filter((item) => !exportProjectId || String(item.project_id || '') === String(exportProjectId))
                            .map((item) => (
                              <tr key={String(item._id)} className="border-t border-slate-200 dark:border-slate-700">
                                <td className="px-3 py-2">
                                  <input
                                    type="checkbox"
                                    checked={selectedHistoryIds.includes(String(item._id))}
                                    onChange={() => toggleHistorySelection(item._id)}
                                  />
                                </td>
                                <td className="px-3 py-2 whitespace-nowrap">{new Date(item.created_at).toLocaleString()}</td>
                                <td className="px-3 py-2">{item.api_name || '-'}</td>
                              <td className="px-3 py-2">{item.method || '-'}</td>
                              <td className="px-3 py-2">{item.status ?? '-'}</td>
                              <td className="px-3 py-2 max-w-[360px] truncate">{item.url || '-'}</td>
                              <td className="px-3 py-2 max-w-[260px]" title={toPretty(item.request_body || '')}>
                                <div className="flex items-start gap-2">
                                  <span className="flex-1 truncate">{toPretty(item.request_body || '-')}</span>
                                  <button
                                    onClick={() => copyToClipboard(item.request_body || '', 'Request body')}
                                    title="Copy request body"
                                    className="p-1 rounded bg-slate-100 dark:bg-slate-800 hover:bg-slate-200 dark:hover:bg-slate-700"
                                  >
                                    <ClipboardDocumentIcon className="w-3.5 h-3.5" />
                                  </button>
                                </div>
                              </td>
                              <td className="px-3 py-2 max-w-[260px]" title={toPretty(item.response_body || '')}>
                                <div className="flex items-start gap-2">
                                  <span className="flex-1 truncate">{toPretty(item.response_body || '-')}</span>
                                  <button
                                    onClick={() => copyToClipboard(item.response_body || '', 'Response body')}
                                    title="Copy response body"
                                    className="p-1 rounded bg-slate-100 dark:bg-slate-800 hover:bg-slate-200 dark:hover:bg-slate-700"
                                  >
                                    <ClipboardDocumentIcon className="w-3.5 h-3.5" />
                                  </button>
                                </div>
                              </td>
                            </tr>
                          ))}
                        </tbody>
                      </table>
                    </div>
                  </div>
                )}
              </section>
            )}

            {activeNav === 'API Collections' && (
              <section className="p-5 bg-white border dark:bg-slate-900 rounded-2xl border-slate-200 dark:border-slate-800">
                <div className="flex items-center justify-between mb-4">
                  <h2 className="text-xl font-bold">Saved API List</h2>
                  <div className="text-sm text-slate-500">
                    {selectedProject ? `Project: ${selectedProject.name}` : 'Select a project'}
                  </div>
                </div>

                {!selectedProjectId ? (
                  <div className="text-sm text-slate-500">Please select a project from topbar to view saved APIs.</div>
                ) : (
                  <div className="overflow-x-auto border rounded-xl border-slate-200 dark:border-slate-700">
                    {apis.length === 0 ? (
                      <div className="p-4 text-sm text-slate-500">No saved APIs in this project.</div>
                    ) : (
                      <table className="w-full text-sm">
                        <thead className="bg-slate-50 dark:bg-slate-800">
                          <tr>
                            <th className="px-3 py-2 font-semibold text-left">API Name</th>
                            <th className="px-3 py-2 font-semibold text-left">Method</th>
                            <th className="px-3 py-2 font-semibold text-left">Endpoint</th>
                            <th className="px-3 py-2 font-semibold text-left">Description</th>
                            <th className="px-3 py-2 font-semibold text-left">Request Body</th>
                            <th className="px-3 py-2 font-semibold text-left">Response Body</th>
                            <th className="px-3 py-2 font-semibold text-left">Action</th>
                          </tr>
                        </thead>
                        <tbody>
                          {apis.map((api) => (
                            <tr key={String(api._id)} className="border-t border-slate-200 dark:border-slate-700">
                              <td className="px-3 py-2 font-medium">{api.name || '-'}</td>
                              <td className="px-3 py-2">
                                <span className="px-2 py-1 text-xs text-indigo-700 bg-indigo-100 rounded">
                                  {api.method || '-'}
                                </span>
                              </td>
                              <td className="px-3 py-2 max-w-[380px] truncate" title={api.endpoint || ''}>{api.endpoint || '-'}</td>
                              <td className="px-3 py-2 max-w-[280px] truncate" title={api.description || ''}>{api.description || '-'}</td>
                              <td className="px-3 py-2 max-w-[260px]" title={toPretty(api.body || '')}>
                                <div className="flex items-start gap-2">
                                  <span className="flex-1 truncate">{toPretty(api.body || '-')}</span>
                                  <button
                                    onClick={() => copyToClipboard(api.body || '', 'Request body')}
                                    title="Copy request body"
                                    className="p-1 rounded bg-slate-100 dark:bg-slate-800 hover:bg-slate-200 dark:hover:bg-slate-700"
                                  >
                                    <ClipboardDocumentIcon className="w-3.5 h-3.5" />
                                  </button>
                                </div>
                              </td>
                              <td className="px-3 py-2 max-w-[260px]" title={toPretty(api.last_response_body || api.response_example || '')}>
                                <div className="flex items-start gap-2">
                                  <span className="flex-1 truncate">{toPretty(api.last_response_body || api.response_example || '-')}</span>
                                  <button
                                    onClick={() => copyToClipboard(api.last_response_body || api.response_example || '', 'Response body')}
                                    title="Copy response body"
                                    className="p-1 rounded bg-slate-100 dark:bg-slate-800 hover:bg-slate-200 dark:hover:bg-slate-700"
                                  >
                                    <ClipboardDocumentIcon className="w-3.5 h-3.5" />
                                  </button>
                                </div>
                              </td>
                              <td className="px-3 py-2">
                                <div className="flex items-center gap-2">
                                  <button
                                    onClick={() => {
                                      selectApi(api);
                                      setActiveNav('Workspace');
                                      pushToast('success', 'API opened in workspace');
                                    }}
                                    className="px-2 py-1 text-xs rounded bg-slate-100 dark:bg-slate-800"
                                  >
                                    Open
                                  </button>
                                  <button
                                    onClick={() => deleteApi(api._id)}
                                    className="px-2 py-1 text-xs rounded bg-rose-100 text-rose-700 hover:bg-rose-200"
                                  >
                                    Delete
                                  </button>
                                </div>
                              </td>
                            </tr>
                          ))}
                        </tbody>
                      </table>
                    )}
                  </div>
                )}
              </section>
            )}

            {['Dashboard', 'Settings'].includes(activeNav) && (
              <section className="p-5 bg-white border dark:bg-slate-900 rounded-2xl border-slate-200 dark:border-slate-800">
                <h2 className="mb-3 text-xl font-bold">{activeNav}</h2>
                <p className="text-sm text-slate-500">Section is available in this workspace layout. Main flow is implemented in Projects + Workspace + History + Exports.</p>
                <div className="flex items-center gap-3 mt-4">
                  {userAvatar && !avatarFailed ? (
                    <img src={userAvatar} alt={user?.name || 'User'} className="object-cover w-12 h-12 rounded-full" onError={() => setAvatarFailed(true)} />
                  ) : (
                    <UserCircleIcon className="w-12 h-12 text-indigo-500" />
                  )}
                  <div>
                    <div className="font-semibold">{user?.name || 'User'}</div>
                    <div className="text-sm text-slate-500">{user?.email || ''}</div>
                  </div>
                </div>
                <div className="grid gap-3 mt-5 md:grid-cols-3">
                  <div className="p-4 rounded-xl bg-slate-50 dark:bg-slate-800"><FolderIcon className="w-5 h-5 mb-2" /> Projects: <b>{projects.length}</b></div>
                  <div className="p-4 rounded-xl bg-slate-50 dark:bg-slate-800"><RectangleStackIcon className="w-5 h-5 mb-2" /> APIs: <b>{apis.length}</b></div>
                  <div className="p-4 rounded-xl bg-slate-50 dark:bg-slate-800"><Cog6ToothIcon className="w-5 h-5 mb-2" /> Workspace Active</div>
                </div>
              </section>
            )}
          </main>
        </section>
      </div>

      <div className="fixed top-5 right-5 z-[90] space-y-2">
        {toasts.map((toast) => (
          <div
            key={toast.id}
            className={`min-w-[260px] max-w-[340px] rounded-xl border px-4 py-3 text-sm shadow-xl ${
              toast.type === 'error'
                ? 'bg-rose-50 border-rose-200 text-rose-700'
                : 'bg-emerald-50 border-emerald-200 text-emerald-700'
            }`}
          >
            {toast.message}
          </div>
        ))}
      </div>

      {projectModalOpen && (
        <div className="fixed inset-0 z-[85] bg-black/45 flex items-center justify-center p-4">
          <div className="w-full max-w-lg bg-white border shadow-2xl rounded-2xl dark:bg-slate-900 border-slate-200 dark:border-slate-700">
            <div className="px-5 py-4 border-b border-slate-200 dark:border-slate-700">
              <h3 className="text-lg font-bold">Create New Project</h3>
              <p className="mt-1 text-sm text-slate-500">Add project name, base URL and optional description.</p>
            </div>
            <div className="p-5 space-y-3">
              <div>
                <label className="text-sm font-medium">Project Name</label>
                <input
                  autoFocus
                  value={projectNameInput}
                  onChange={(e) => setProjectNameInput(e.target.value)}
                  className="w-full px-3 py-2 mt-1 border rounded-lg border-slate-300 dark:border-slate-700 bg-slate-50 dark:bg-slate-800"
                  placeholder="Payment Service"
                />
              </div>
              <div>
                <label className="text-sm font-medium">Base URL</label>
                <input
                  value={projectBaseUrlInput}
                  onChange={(e) => setProjectBaseUrlInput(e.target.value)}
                  className="w-full px-3 py-2 mt-1 border rounded-lg border-slate-300 dark:border-slate-700 bg-slate-50 dark:bg-slate-800"
                  placeholder="https://api.example.com"
                />
              </div>
              <div>
                <label className="text-sm font-medium">Description</label>
                <textarea
                  value={projectDescriptionInput}
                  onChange={(e) => setProjectDescriptionInput(e.target.value)}
                  className="w-full h-24 px-3 py-2 mt-1 border rounded-lg border-slate-300 dark:border-slate-700 bg-slate-50 dark:bg-slate-800"
                  placeholder="Project description"
                />
              </div>
            </div>
            <div className="flex justify-end gap-2 px-5 py-4 border-t border-slate-200 dark:border-slate-700">
              <button
                onClick={() => setProjectModalOpen(false)}
                className="px-4 py-2 text-sm rounded-lg bg-slate-100 dark:bg-slate-800"
              >
                Cancel
              </button>
              <button
                onClick={createProject}
                className="px-4 py-2 text-sm text-white bg-indigo-600 rounded-lg"
              >
                Create Project
              </button>
            </div>
          </div>
        </div>
      )}

      {projectDeleteModalOpen && (
        <div className="fixed inset-0 z-[86] bg-black/45 flex items-center justify-center p-4">
          <div className="w-full max-w-lg bg-white border shadow-2xl rounded-2xl dark:bg-slate-900 border-slate-200 dark:border-slate-700">
            <div className="px-5 py-4 border-b border-slate-200 dark:border-slate-700">
              <h3 className="text-lg font-bold text-rose-700 dark:text-rose-300">Delete Project</h3>
              <p className="mt-1 text-sm text-slate-500">
                This will remove the project, all linked APIs, curls, and history.
              </p>
            </div>
            <div className="p-5 space-y-3">
              <div className="text-sm">
                Type project name to confirm:
                <b className="ml-1">{projectToDelete?.name || '-'}</b>
              </div>
              <input
                autoFocus
                value={projectDeleteNameInput}
                onChange={(e) => setProjectDeleteNameInput(e.target.value)}
                placeholder={projectToDelete?.name || 'Project name'}
                className="w-full px-3 py-2 border rounded-lg border-slate-300 dark:border-slate-700 bg-slate-50 dark:bg-slate-800"
              />
            </div>
            <div className="flex justify-end gap-2 px-5 py-4 border-t border-slate-200 dark:border-slate-700">
              <button
                onClick={closeProjectDeleteModal}
                disabled={deletingProject}
                className="px-4 py-2 text-sm rounded-lg bg-slate-100 dark:bg-slate-800"
              >
                Cancel
              </button>
              <button
                onClick={confirmDeleteProject}
                disabled={deletingProject}
                className="px-4 py-2 text-sm text-white rounded-lg bg-rose-600 disabled:opacity-60"
              >
                {deletingProject ? 'Deleting...' : 'Delete Project'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default Dashboard;
