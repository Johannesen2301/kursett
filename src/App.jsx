import { Routes, Route, Navigate } from 'react-router-dom'
import ProtectedRoute from './components/ProtectedRoute'
import AppShell from './pages/AppShell'
import Login from './pages/Login'
import MinSkatt from './pages/MinSkatt'
import Radgiver from './pages/Radgiver'
import Portefolje from './pages/Portefolje'
import Profil from './pages/Profil'
import InvestorProfil from './pages/InvestorProfil'
import Toppliste from './pages/Toppliste'
import Meldinger from './pages/Meldinger'
import Rom from './pages/Rom'
import Skattekunnskap from './pages/Skattekunnskap'
import AskEllerVps from './pages/AskEllerVps'
import Personvern from './pages/Personvern'
import Admin from './pages/Admin'
import Kalkulator from './pages/Kalkulator'
import KreverBrukernavn from './components/KreverBrukernavn'

export default function App() {
  return (
    <Routes>
      {/* ---------- ÅPENT: ingen innlogging ---------- */}
      <Route path="/" element={<Kalkulator />} />
      <Route path="/skjermingsfradrag" element={<Kalkulator />} />
      <Route path="/kalkulator" element={<Kalkulator />} />
      <Route path="/skatteregler" element={<Skattekunnskap />} />
      <Route path="/ask-eller-vps" element={<AskEllerVps />} />
      <Route path="/login" element={<Login />} />

      {/* ---------- APPEN: krever innlogging ---------- */}
      <Route
        path="/app"
        element={
          <ProtectedRoute>
            <AppShell />
          </ProtectedRoute>
        }
      >
        <Route index element={<Navigate to="/app/portefolje" replace />} />
        <Route path="portefolje" element={<Portefolje />} />
        <Route path="toppliste" element={<Toppliste />} />
        <Route path="profil" element={<Profil />} />
        <Route path="investor/:brukernavn" element={<InvestorProfil />} />
        <Route path="meldinger" element={<KreverBrukernavn><Meldinger /></KreverBrukernavn>} />
        <Route path="rom" element={<KreverBrukernavn><Rom /></KreverBrukernavn>} />
        <Route path="personvern" element={<Personvern />} />
        <Route path="admin" element={<Admin />} />
        <Route path="skatt" element={<MinSkatt />} />
        <Route path="radgiver" element={<Radgiver />} />
      </Route>

      {/* Gamle lenker → nye adresser */}
      <Route path="/portefolje" element={<Navigate to="/app/portefolje" replace />} />
      <Route path="/toppliste" element={<Navigate to="/app/toppliste" replace />} />
      <Route path="/profil" element={<Navigate to="/app/profil" replace />} />
      <Route path="/meldinger" element={<Navigate to="/app/meldinger" replace />} />
      <Route path="/rom" element={<Navigate to="/app/rom" replace />} />
      <Route path="/personvern" element={<Navigate to="/app/personvern" replace />} />
      <Route path="/admin" element={<Navigate to="/app/admin" replace />} />

      <Route path="*" element={<Navigate to="/" replace />} />
    </Routes>
  )
}
