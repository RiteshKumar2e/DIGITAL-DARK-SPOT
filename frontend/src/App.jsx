import { lazy, Suspense } from 'react';
import { Route, Routes } from 'react-router-dom';
import SiteLayout from './layouts/SiteLayout.jsx';
import HomePage from './pages/HomePage.jsx';
import { Spinner } from './components/ui.jsx';

// The workspace is the heaviest route; static pages are small.
const WorkspacePage = lazy(() => import('./pages/WorkspacePage.jsx'));
const ResearchPage = lazy(() => import('./pages/ResearchPage.jsx'));
const DemoPage = lazy(() => import('./pages/DemoPage.jsx'));
const MethodPage = lazy(() => import('./pages/MethodPage.jsx'));
const PrivacyPage = lazy(() => import('./pages/PrivacyPage.jsx'));
const TermsPage = lazy(() => import('./pages/TermsPage.jsx'));
const NotFoundPage = lazy(() => import('./pages/NotFoundPage.jsx'));

export default function App() {
  return (
    <Suspense fallback={<div className="container page-loading"><Spinner label="Loading…" /></div>}>
      <Routes>
        <Route element={<SiteLayout />}>
          <Route index element={<HomePage />} />
          <Route path="research" element={<ResearchPage />} />
          <Route path="demo" element={<DemoPage />} />
          <Route path="research/:id" element={<WorkspacePage />} />
          <Route path="method" element={<MethodPage />} />
          <Route path="privacy" element={<PrivacyPage />} />
          <Route path="terms" element={<TermsPage />} />
          <Route path="*" element={<NotFoundPage />} />
        </Route>
      </Routes>
    </Suspense>
  );
}
