import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import { ThemeProvider, createTheme } from '@mui/material/styles'
import CssBaseline from '@mui/material/CssBaseline'
import './index.css'
import App from './App.tsx'

const theme = createTheme({
  typography: {
    fontFamily: "'Inter', 'Plus Jakarta Sans', system-ui, -apple-system, sans-serif",
    h1: { fontFamily: "'Plus Jakarta Sans', 'Inter', sans-serif", fontWeight: 900 },
    h2: { fontFamily: "'Plus Jakarta Sans', 'Inter', sans-serif", fontWeight: 800 },
    h3: { fontFamily: "'Plus Jakarta Sans', 'Inter', sans-serif", fontWeight: 800 },
    h4: { fontFamily: "'Plus Jakarta Sans', 'Inter', sans-serif", fontWeight: 700 },
    h5: { fontFamily: "'Plus Jakarta Sans', 'Inter', sans-serif", fontWeight: 700 },
    h6: { fontFamily: "'Plus Jakarta Sans', 'Inter', sans-serif", fontWeight: 700 },
    button: { fontFamily: "'Inter', sans-serif", fontWeight: 700, textTransform: 'none' },
  },
  components: {
    MuiButton: {
      styleOverrides: {
        root: { textTransform: 'none', fontWeight: 700, fontFamily: "'Inter', sans-serif" },
      },
    },
    MuiTab: {
      styleOverrides: {
        root: { textTransform: 'none', fontFamily: "'Inter', sans-serif" },
      },
    },
  },
})

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <ThemeProvider theme={theme}>
      <CssBaseline />
      <App />
    </ThemeProvider>
  </StrictMode>,
)
