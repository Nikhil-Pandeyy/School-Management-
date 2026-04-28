import { BrowserRouter as Router, Routes, Route, Navigate } from 'react-router-dom';
import { AuthProvider, useAuth } from './context/AuthContext';
import Login from './pages/Login';
import Dashboard from './pages/Dashboard';
import Classes from './pages/Classes';
import Students from './pages/Students';
import StudentProfile from './pages/StudentProfile';
import Teachers from './pages/Teachers';
import Attendance from './pages/Attendance';
import Complaints from './pages/Complaints';
import Applications from './pages/Applications';
import SchoolProfile from './pages/SchoolProfile';
import ActivateAccount from './pages/ActivateAccount';
import Chat from './pages/Chat';
import Results from './pages/Results';
import Permissions from './pages/Permissions';
import Admins from './pages/Admins';
import Settings from './pages/Settings';
import { Layout } from './components/layout/Layout';

function PrivateRoute({ children }: { children: React.ReactNode }) {
  const { user, loading } = useAuth();
  if (loading) return <div className="h-screen w-screen flex items-center justify-center font-mono animate-pulse text-brand-600">EduCloud AI Loading...</div>;
  return user ? <>{children}</> : <Navigate to="/login" />;
}

export default function App() {
  return (
    <Router>
      <AuthProvider>
        <Routes>
          <Route path="/login" element={<Login />} />
          <Route path="/activate" element={<ActivateAccount />} />
          <Route 
            path="/*" 
            element={
              <PrivateRoute>
                <Layout>
                  <Routes>
                    <Route path="/" element={<Dashboard />} />
                    <Route path="/classes" element={<Classes />} />
                    <Route path="/students" element={<Students />} />
                    <Route path="/students/:id" element={<StudentProfile />} />
                    <Route path="/teachers" element={<Teachers />} />
                    <Route path="/attendance" element={<Attendance />} />
                    <Route path="/complaints" element={<Complaints />} />
                    <Route path="/permissions" element={<Permissions />} />
                    <Route path="/admins" element={<Admins />} />
                    <Route path="/applications" element={<Applications />} />
                    <Route path="/results" element={<Results />} />
                    <Route path="/school-profile" element={<SchoolProfile />} />
                    <Route path="/chat" element={<Chat />} />
                    <Route path="/settings" element={<Settings />} />
                  </Routes>
                </Layout>
              </PrivateRoute>
            } 
          />
        </Routes>
      </AuthProvider>
    </Router>
  );
}
