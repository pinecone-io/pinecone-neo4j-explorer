'use client'
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { AppProvider } from './AppContext';
import App from "./components/App";
import { ThemeProvider } from "@material-tailwind/react";


const queryClient = new QueryClient();

export default function Home() {
  return (
     <QueryClientProvider client={queryClient}>
      <AppProvider>
        <ThemeProvider>
          <App />
        </ThemeProvider>
      </AppProvider>
    </QueryClientProvider>
  );
}