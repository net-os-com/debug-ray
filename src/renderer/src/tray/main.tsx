import { createRoot } from 'react-dom/client'
import { TrayPanel } from './tray-panel'
import '../tokens.css'
import '../app.css'
import './tray.css'

const root = document.getElementById('root')

if (!root) {
  throw new Error('Missing #root element')
}

createRoot(root).render(<TrayPanel />)
