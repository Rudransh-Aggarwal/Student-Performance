import { Navigate, Outlet } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import { ROLE_HOME } from '../lib/roles';
import { FullPageSpinner } from './FullPageSpinner';
/** Login and register pages: signed-in users are sent to their own home instead. */
export function PublicOnlyRoute() {
    const { user, status } = useAuth();
    if (status === 'loading')
        return <FullPageSpinner />;
    if (user)
        return <Navigate to={ROLE_HOME[user.role]} replace/>;
    return <Outlet />;
}
