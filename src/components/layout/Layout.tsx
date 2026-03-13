import { useFinnhubWebSocket } from '../../hooks/useFinnhubWebSocket'
import Sidebar from './Sidebar'
import TopBar from './TopBar'

export default function Layout({ children }: { children: React.ReactNode }) {
  useFinnhubWebSocket()
  return (
    <div className="min-h-screen bg-surface flex">
      <Sidebar />
      <div className="flex-1 flex flex-col min-w-0">
        <TopBar />
        <main className="flex-1 p-4 md:p-6 overflow-auto">
          {children}
        </main>
      </div>
    </div>
  )
}
