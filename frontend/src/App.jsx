import { Navigate, Route, Routes } from 'react-router-dom';
import { ProtectedRoute } from './components/ProtectedRoute';
import { PublicOnlyRoute } from './components/PublicOnlyRoute';
import { LandingPage } from './pages/LandingPage';
import { ChooseRolePage } from './pages/ChooseRolePage';
import { LoginPage } from './pages/LoginPage';
import { RegisterPage } from './pages/RegisterPage';
import { RoleDashboardPage } from './pages/RoleDashboardPage';

export function App() {
  return (
    <Routes>
      <Route path="/" element={<LandingPage />} />

      <Route element={<PublicOnlyRoute />}>
        <Route path="/login" element={<LoginPage />} />
        <Route path="/register" element={<RegisterPage />} />
      </Route>

      <Route element={<ProtectedRoute />}>
        <Route path="/choose-role" element={<ChooseRolePage />} />
      </Route>

      <Route element={<ProtectedRoute roles={['student']} />}>
        <Route path="/student" element={<RoleDashboardPage />} />
      </Route>
      <Route element={<ProtectedRoute roles={['instructor']} />}>
        <Route path="/instructor" element={<RoleDashboardPage />} />
      </Route>
      <Route element={<ProtectedRoute roles={['admin']} />}>
        <Route path="/admin" element={<RoleDashboardPage />} />
      </Route>

      <Route path="*" element={<Navigate to="/" replace />} />
    </Routes>
  );
}