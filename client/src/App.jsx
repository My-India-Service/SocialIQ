import { BrowserRouter, Navigate, Route, Routes } from 'react-router-dom';
import { AuthProvider } from './context/AuthContext';
import { ThemeProvider } from './context/ThemeContext';
import AppLayout from './components/AppLayout';
import Landing from './pages/Landing';
import Login from './pages/Login';
import Register from './pages/Register';
import ForgotPassword from './pages/ForgotPassword';
import ResetPassword from './pages/ResetPassword';
import Dashboard from './pages/Dashboard';
import Connections from './pages/Connections';
import Report from './pages/Report';
import Revenue from './pages/Revenue';
import Insights from './pages/Insights';
import Conversations from './pages/Conversations';
import Leads from './pages/Leads';
import Complaints from './pages/Complaints';
import Settings from './pages/Settings';
import AiSetup from './pages/AiSetup';
import Privacy from './pages/Privacy';
import Terms from './pages/Terms';
import DataDeletion from './pages/DataDeletion';
import About from './pages/About';
import Faq from './pages/Faq';
import Help from './pages/Help';
import Pricing from './pages/Pricing';
import Billing from './pages/Billing';
import Onboarding from './pages/Onboarding';
import VerifyEmail from './pages/VerifyEmail';
import GoogleCallback from './pages/GoogleCallback';
import Moderation from './pages/Moderation';
import Posts from './pages/Posts';
import Tickets from './pages/Tickets';
import BrandHealth from './pages/BrandHealth';
import Checkout from './pages/Checkout';

/** Host redirects can drop the callback path but keep the hash; finish Google sign-in anyway. */
function CatchAll() {
  if (/(^#|&)token=/.test(window.location.hash)) return <GoogleCallback />;
  return <Navigate to="/" replace />;
}

export default function App() {
  return (
    <ThemeProvider>
      <AuthProvider>
        <BrowserRouter>
          <Routes>
            <Route path="/" element={<Landing />} />
            <Route path="/login" element={<Login />} />
            <Route path="/register" element={<Register />} />
            <Route path="/verify-email" element={<VerifyEmail />} />
            <Route path="/auth/google/callback" element={<GoogleCallback />} />
            <Route path="/onboarding" element={<Onboarding />} />
            <Route path="/forgot-password" element={<ForgotPassword />} />
            <Route path="/reset-password" element={<ResetPassword />} />
            <Route path="/privacy" element={<Privacy />} />
            <Route path="/terms" element={<Terms />} />
            <Route path="/data-deletion" element={<DataDeletion />} />
            <Route path="/about" element={<About />} />
            <Route path="/faq" element={<Faq />} />
            <Route path="/pricing" element={<Pricing />} />
            <Route path="/app" element={<AppLayout />}>
              <Route index element={<Dashboard />} />
              <Route path="connections" element={<Connections />} />
              <Route path="report" element={<Report />} />
              <Route path="revenue" element={<Revenue />} />
              <Route path="insights" element={<Insights />} />
              <Route path="conversations" element={<Conversations />} />
              <Route path="leads" element={<Leads />} />
              <Route path="complaints" element={<Complaints />} />
              <Route path="moderation" element={<Moderation />} />
              <Route path="posts" element={<Posts />} />
              <Route path="tickets" element={<Tickets />} />
              <Route path="brand-health" element={<BrandHealth />} />
              <Route path="checkout" element={<Checkout />} />
              <Route path="settings" element={<Settings />} />
              <Route path="ai-setup" element={<AiSetup />} />
              <Route path="billing" element={<Billing />} />
              <Route path="help" element={<Help />} />
            </Route>
            <Route path="/index.html" element={<CatchAll />} />
            <Route path="*" element={<CatchAll />} />
          </Routes>
        </BrowserRouter>
      </AuthProvider>
    </ThemeProvider>
  );
}
