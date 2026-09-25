import React from 'react';
import ReactDOM from 'react-dom/client';
import { QueryClientProvider } from '@tanstack/react-query';
import { queryClient } from './lib/queryClient';
import { BrowserRouter } from 'react-router-dom';
import { Toaster } from 'react-hot-toast';
import App from './App';
import { AuthProvider } from './context/AuthContext';
import { AcademicYearProvider } from './context/AcademicYearContext';
import { ThemeProvider } from './context/ThemeContext';
import { TenantProvider } from './context/TenantContext';
import './index.css';

ReactDOM.createRoot(document.getElementById('root')!).render(
  <React.StrictMode>
    <QueryClientProvider client={queryClient}>
      <ThemeProvider>
        <BrowserRouter>
          <TenantProvider>
            <AuthProvider>
              <AcademicYearProvider>
                <App />
                <Toaster position="top-right" toastOptions={{ duration: 4000 }} />
              </AcademicYearProvider>
            </AuthProvider>
          </TenantProvider>
        </BrowserRouter>
      </ThemeProvider>
    </QueryClientProvider>
  </React.StrictMode>
);
