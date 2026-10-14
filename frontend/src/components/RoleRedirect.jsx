import { Navigate } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import { ROLE_HOME } from '../lib/roles';
export function RoleRedirect() {
    const { user } = useAuth();
    return <Navigate to={user ? ROLE_HOME[user.role] : '/login'} replace/>;
}
