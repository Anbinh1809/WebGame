import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import { PlayerAuthProvider } from './auth/PlayerAuthContext'
import { AetheriaRouter } from './components/AetheriaRouter'
import './styles.css'

const root = document.getElementById('root')

if (!root) {
  throw new Error('Không tìm thấy phần tử gốc của ứng dụng.')
}

createRoot(root).render(
  <StrictMode>
    <PlayerAuthProvider>
      <AetheriaRouter />
    </PlayerAuthProvider>
  </StrictMode>,
)
