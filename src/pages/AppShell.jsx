import { Outlet } from 'react-router-dom'
import Sidebar from '../components/Sidebar'
export default function AppShell(){ return (<div className="app"><Sidebar /><main className="main"><Outlet /></main></div>) }
