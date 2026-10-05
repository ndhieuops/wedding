import { render } from 'preact';
import { useCallback, useEffect, useState } from 'preact/hooks';
import { api } from './api.js';
import { Toaster } from './components/toast.jsx';
import { Admin } from './pages/Admin.jsx';
import { Editor } from './pages/Editor.jsx';
import { MyInvitations } from './pages/MyInvitations.jsx';
import { NewInvitation } from './pages/NewInvitation.jsx';
import './styles.css';

function useLocation() {
  const [path, setPath] = useState(location.pathname);
  useEffect(() => {
    const onPop = () => setPath(location.pathname);
    window.addEventListener('popstate', onPop);
    return () => window.removeEventListener('popstate', onPop);
  }, []);
  const navigate = useCallback((to) => {
    history.pushState(null, '', to);
    setPath(location.pathname);
    window.scrollTo(0, 0);
  }, []);
  return [path, navigate];
}

function App() {
  const [path, navigate] = useLocation();
  const [meta, setMeta] = useState(null);
  const [error, setError] = useState('');
  const refreshMeta = () => api('/api/meta').then(setMeta).catch((e) => setError(e.message));
  useEffect(() => {
    refreshMeta();
  }, []);

  const editMatch = /^\/edit\/([A-Za-z0-9_-]+)$/.exec(path);
  const isEditor = Boolean(editMatch);

  let page;
  if (error) page = <div class="center-page"><div class="card card--narrow"><h1>Không tải được</h1><p class="muted">{error}</p><button type="button" class="btn" onClick={() => location.reload()}>Thử lại</button></div></div>;
  else if (!meta) page = <div class="center-page"><div class="spinner" aria-label="Đang tải" /></div>;
  else if (editMatch) page = <Editor key={editMatch[1]} id={editMatch[1]} meta={meta} navigate={navigate} />;
  else if (path === '/new') page = <NewInvitation meta={meta} navigate={navigate} />;
  else if (path.startsWith('/admin')) page = <Admin navigate={navigate} refreshMeta={refreshMeta} />;
  else page = <MyInvitations meta={meta} navigate={navigate} />;

  return (
    <>
      {!isEditor && (
        <header class="topbar">
          <a class="logo" href="/"><span class="logo__mark" aria-hidden="true">囍</span><span>{meta?.brand?.name || 'Thiệp cưới'}</span></a>
          <nav>
            <a href="/templates">Mẫu thiệp</a>
            <a href="/my" onClick={(e) => (e.preventDefault(), navigate('/my'))}>Thiệp của tôi</a>
            {meta?.isAdmin && <a href="/admin" onClick={(e) => (e.preventDefault(), navigate('/admin'))}>Quản trị</a>}
          </nav>
        </header>
      )}
      <main class={isEditor ? 'main main--editor' : 'main'}>{page}</main>
      <Toaster />
    </>
  );
}

render(<App />, document.getElementById('app'));
