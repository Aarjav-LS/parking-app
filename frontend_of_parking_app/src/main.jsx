import React, { Component } from 'react'
import ReactDOM from 'react-dom/client'
import App from './SmartParking.jsx'
import './index.css'

class ErrorBoundary extends Component {
  constructor(props) {
    super(props)
    this.state = { hasError: false, error: null }
  }

  static getDerivedStateFromError(error) {
    return { hasError: true, error }
  }

  componentDidCatch(error, errorInfo) {
    console.error('React error boundary caught an error:', error, errorInfo)
  }

  render() {
    if (this.state.hasError) {
      return (
        <div className="min-h-screen flex items-center justify-center bg-white dark:bg-slate-950 p-6">
          <div className="text-center max-w-md">
            <h1 className="text-2xl font-semibold text-gray-900 dark:text-white mb-2">Something went wrong</h1>
            <p className="text-sm text-gray-500 dark:text-gray-400 mb-4">The application encountered an unexpected error. Please refresh the page.</p>
            <button onClick={() => window.location.reload()} className="px-4 py-2 rounded-xl bg-blue-600 text-white font-medium hover:bg-blue-700">Refresh page</button>
            {this.state.error && (
              <details className="mt-4 text-left">
                <summary className="text-xs text-gray-400 cursor-pointer">Error details</summary>
                <pre className="mt-2 p-3 rounded-xl bg-gray-100 dark:bg-slate-800 text-xs text-red-600 dark:text-red-400 overflow-auto">{this.state.error.message}</pre>
              </details>
            )}
          </div>
        </div>
      )
    }

    return this.props.children
  }
}

window.addEventListener('error', (event) => {
  console.error('Global error:', event.error)
})

window.addEventListener('unhandledrejection', (event) => {
  console.error('Unhandled promise rejection:', event.reason)
})

ReactDOM.createRoot(document.getElementById('root')).render(
  <React.StrictMode>
    <ErrorBoundary>
      <App />
    </ErrorBoundary>
  </React.StrictMode>,
)
